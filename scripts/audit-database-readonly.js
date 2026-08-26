#!/usr/bin/env node
/**
 * Phase 5 Part A — read-only scan of Firestore + Storage.
 * Writes analysis to gitignored backups/phase5-audit-*. Does not write to Firebase.
 *
 * Usage: node scripts/audit-database-readonly.js
 */

const fs = require('fs');
const path = require('path');
const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  PRODUCTION_BUCKET,
  STAGING_BUCKET,
  getAccessToken,
  googleFetch,
  listCollectionIds,
  listDocuments,
  relativeDocPath,
  exportDatabase,
  listStorageObjects,
} = require('./lib/phase1Firebase');

const ORG_ID = 'opal-ss-constructions';
const JOB_STRING_KEYS = [
  'projectName',
  'project',
  'job',
  'jobName',
  'jobId',
  'projectId',
  'siteName',
  'projectReference',
];

function decodeValue(value) {
  if (value == null || typeof value !== 'object') return value;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.bytesValue !== undefined) return `[bytes ${String(value.bytesValue).length}]`;
  if (value.referenceValue !== undefined) return { _ref: value.referenceValue };
  if (value.geoPointValue !== undefined) return value.geoPointValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeValue);
  if (value.mapValue) {
    const out = {};
    for (const [key, nested] of Object.entries(value.mapValue.fields || {})) {
      out[key] = decodeValue(nested);
    }
    return out;
  }
  return value;
}

function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    out[key] = decodeValue(value);
  }
  return out;
}

function typeOf(value) {
  if (value == null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') {
    if (value._ref) return 'reference';
    if (typeof value.latitude === 'number') return 'geopoint';
    return 'map';
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return 'timestamp-string';
  return typeof value;
}

function parseDateish(value) {
  if (value == null || value === '') return { ok: false, reason: 'missing' };
  if (typeof value === 'string' && value.trim().toLowerCase() === 'invalid date') {
    return { ok: false, reason: 'invalid-date-string' };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { ok: false, reason: 'unparseable', raw: String(value).slice(0, 80) };
  return { ok: true, iso: date.toISOString() };
}

function normalizeSiteName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bump(map, key, n = 1) {
  map[key] = (map[key] || 0) + n;
}

function maskEmail(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 1) return '(invalid-email)';
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  const keep = local.slice(0, 1);
  return `${keep}***@${domain}`;
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter((v) => v != null && String(v).trim() !== ''))).sort();
}

function collectionBucket(docPath) {
  const parts = docPath.split('/');
  if (parts.length === 1) return `${parts[0]}/(root-docs-missing-id)`;
  if (parts.length === 2) return `${parts[0]}/{id}`;
  if (parts[0] === 'organizations' && parts[2] === 'projects' && parts.length === 4) {
    return 'organizations/{orgId}/projects/{projectId}';
  }
  if (parts[0] === 'organizations' && parts[2] === 'projects' && parts.length >= 6) {
    return `organizations/{orgId}/projects/{projectId}/${parts[4]}`;
  }
  if (parts[0] === 'users' && parts.length >= 4) {
    return `users/{accessCode}/${parts[2]}`;
  }
  if (parts[0] === 'profiles' && parts.length === 2) return 'profiles/{uid}';
  return parts.filter((_, i) => i % 2 === 0).join('/');
}

function parentProjectId(docPath) {
  const parts = docPath.split('/');
  if (parts[0] === 'organizations' && parts[2] === 'projects' && parts.length >= 4) {
    return parts[3];
  }
  return null;
}

function parentUserCode(docPath) {
  const parts = docPath.split('/');
  if (parts[0] === 'users' && parts.length >= 2) return parts[1];
  return null;
}

function analyzeDocuments(rawDocs) {
  const decoded = rawDocs.map((doc) => ({
    path: doc.path,
    createTime: doc.createTime,
    updateTime: doc.updateTime,
    bytes: Buffer.byteLength(JSON.stringify(doc.fields || {}), 'utf8'),
    data: decodeFields(doc.fields),
  }));

  const byBucket = {};
  const treeCounts = {};
  const fieldShapes = {};
  const oversized = [];
  const jobStrings = {
    invoices: [],
    expenses: [],
    hiaContracts: [],
    nestedProjects: [],
    progressPayments: [],
    other: [],
  };

  for (const doc of decoded) {
    const bucket = collectionBucket(doc.path);
    bump(treeCounts, bucket);
    if (!byBucket[bucket]) byBucket[bucket] = [];
    byBucket[bucket].push(doc);
    if (!fieldShapes[bucket]) fieldShapes[bucket] = {};
    for (const [key, value] of Object.entries(doc.data)) {
      if (!fieldShapes[bucket][key]) fieldShapes[bucket][key] = { count: 0, types: {}, missing: 0 };
      fieldShapes[bucket][key].count += 1;
      bump(fieldShapes[bucket][key].types, typeOf(value));
    }
    if (doc.bytes > 50 * 1024) {
      oversized.push({ path: doc.path, bytes: doc.bytes });
    }

    const leaf = doc.path.split('/').slice(-2, -1)[0] || '';
    const payload = {
      path: doc.path,
      parentJobId: parentProjectId(doc.path),
      parentPin: parentUserCode(doc.path),
      strings: {},
    };
    for (const key of JOB_STRING_KEYS) {
      if (doc.data[key] != null && doc.data[key] !== '') {
        payload.strings[key] = doc.data[key];
      }
    }
    if (leaf === 'projects' && doc.path.includes('/projects/') && doc.path.split('/').length >= 6) {
      payload.strings.name = doc.data.name || '';
      jobStrings.nestedProjects.push(payload);
    } else if (Object.keys(payload.strings).length) {
      if (leaf === 'invoices') jobStrings.invoices.push(payload);
      else if (leaf === 'expenses') jobStrings.expenses.push(payload);
      else if (leaf === 'hiaContracts') jobStrings.hiaContracts.push(payload);
      else if (leaf === 'progressPayments') jobStrings.progressPayments.push(payload);
      else jobStrings.other.push(payload);
    }
  }

  for (const [bucket, docs] of Object.entries(byBucket)) {
    const keys = Object.keys(fieldShapes[bucket] || {});
    for (const key of keys) {
      fieldShapes[bucket][key].missing = docs.length - fieldShapes[bucket][key].count;
    }
  }

  return { decoded, byBucket, treeCounts, fieldShapes, oversized, jobStrings };
}

function integrityForJobScoped(docs, kind) {
  const rows = [];
  for (const doc of docs) {
    const data = doc.data;
    const issues = [];
    if (kind === 'invoice') {
      const date = parseDateish(data.invoiceDate);
      const due = parseDateish(data.dueDate);
      if (!date.ok) issues.push(`invoiceDate:${date.reason}`);
      if (data.dueDate != null && data.dueDate !== '' && !due.ok) issues.push(`dueDate:${due.reason}`);
      if (!data.projectName) issues.push('missing-projectName');
      if (!data.status) issues.push('missing-status');
      if (data.total == null || data.total === '') issues.push('missing-total');
      if (!data.projectId && !data.jobId) issues.push('no-stable-job-id-field');
    }
    if (kind === 'expense') {
      const date = parseDateish(data.date);
      if (data.date != null && data.date !== '' && !date.ok) issues.push(`date:${date.reason}`);
      if (!data.category && !data.tradeName) issues.push('uncategorised');
      if (!data.receiptImageUrl && !data.receiptImagePath) issues.push('no-receipt');
      if (data.reviewed === true || data.reviewed === false) issues.push('has-reviewed-field');
      if (!data.projectId && !data.jobId) issues.push('no-stable-job-id-field');
      const totalish = [data.total, data.amount, data.cost, data.totalPrice].some((v) => v != null && v !== '');
      const labour = data.hours != null && data.rate != null;
      const qty = data.quantity != null && data.unitCost != null;
      if (!totalish && !labour && !qty) issues.push('no-amount-fields');
    }
    if (issues.length) {
      rows.push({
        path: doc.path,
        issues,
        projectName: data.projectName || null,
        category: data.category || null,
        invoiceNumber: data.invoiceNumber || null,
        status: data.status || null,
      });
    }
  }
  return rows;
}

function clusterNames(entries, pick) {
  const groups = {};
  for (const entry of entries) {
    const raw = pick(entry);
    if (!raw) continue;
    const key = normalizeSiteName(raw) || '(empty)';
    if (!groups[key]) groups[key] = { canonicalGuess: raw, variants: {}, count: 0 };
    bump(groups[key].variants, String(raw));
    groups[key].count += 1;
  }
  return Object.entries(groups)
    .map(([key, value]) => ({
      normalized: key,
      count: value.count,
      variantCount: Object.keys(value.variants).length,
      variants: value.variants,
    }))
    .sort((a, b) => b.count - a.count);
}

function summarizeOrg(decoded) {
  const orgDoc = decoded.find((d) => d.path === `organizations/${ORG_ID}`);
  const projectDocs = decoded.filter(
    (d) => d.path.startsWith(`organizations/${ORG_ID}/projects/`) && d.path.split('/').length === 4
  );
  const org = orgDoc ? orgDoc.data : null;
  const invited = (org && org.invitedEmails) || [];
  return {
    exists: Boolean(orgDoc),
    name: org && org.name,
    ownerMasked: org && org.ownerEmail ? maskEmail(org.ownerEmail) : null,
    invitedCount: invited.length,
    invitedMasked: uniqueSorted(invited.map(maskEmail)),
    ownerOnInviteList: org && invited.map((e) => String(e).toLowerCase()).includes(String(org.ownerEmail || '').toLowerCase()),
    legacyWorkspaceIdCount: Array.isArray(org && org.legacyWorkspaceIds) ? org.legacyWorkspaceIds.length : 0,
    legacyWorkspaceNames: (org && org.legacyWorkspaceNames) || {},
    jobs: projectDocs.map((doc) => {
      const emails = doc.data.invitedEmails || [];
      return {
        id: doc.path.split('/')[3],
        name: doc.data.name || null,
        legacyWorkspaceIdSet: Boolean(doc.data.legacyWorkspaceId),
        orgId: doc.data.orgId || null,
        invitedCount: emails.length,
        invitedMasked: uniqueSorted(emails.map(maskEmail)),
        ownerOnJob: org && org.ownerEmail
          ? emails.map((e) => String(e).toLowerCase()).includes(String(org.ownerEmail).toLowerCase())
          : null,
        fieldKeys: Object.keys(doc.data).sort(),
        archived: Boolean(doc.data.archived || doc.data.archivedAt || doc.data.status === 'archived'),
        bytes: doc.bytes,
      };
    }),
  };
}

function summarizeProfiles(decoded) {
  const docs = decoded.filter((d) => d.path.startsWith('profiles/'));
  return {
    count: docs.length,
    complete: docs.filter((d) => d.data.setupComplete === true).length,
    withPhoto: docs.filter((d) => d.data.photoUrl).length,
    fieldKeys: uniqueSorted(docs.flatMap((d) => Object.keys(d.data))),
  };
}

function summarizePins(decoded) {
  const roots = decoded.filter((d) => d.path.startsWith('users/') && d.path.split('/').length === 2);
  const byCode = {};
  for (const doc of decoded.filter((d) => d.path.startsWith('users/'))) {
    const code = doc.path.split('/')[1];
    if (!byCode[code]) byCode[code] = { collections: {}, docCount: 0, hasRoot: false };
    byCode[code].docCount += 1;
    const parts = doc.path.split('/');
    if (parts.length === 2) byCode[code].hasRoot = true;
    else bump(byCode[code].collections, parts[2]);
  }
  return {
    leftoverTreeCount: Object.keys(byCode).length,
    codeLengths: uniqueSorted(Object.keys(byCode).map((c) => String(c).length)),
    trees: Object.entries(byCode).map(([code, info]) => ({
      idLength: String(code).length,
      idCharset: /^[0-9]+$/.test(code) ? 'digits' : /^[A-Za-z]+$/.test(code) ? 'letters' : 'mixed',
      ...info,
    })),
    rootFieldKeys: uniqueSorted(roots.flatMap((d) => Object.keys(d.data))),
  };
}

function storageSummary(listed) {
  if (!listed.ok) {
    return { ok: false, status: listed.status, error: listed.error, fileCount: 0, prefixes: {}, totalBytes: 0 };
  }
  const prefixes = {};
  let totalBytes = 0;
  for (const object of listed.objects) {
    const name = object.name || '';
    const top = name.split('/')[0] || '(root)';
    const second = name.split('/')[1] || '(file)';
    const key = `${top}/${second}`;
    if (!prefixes[key]) prefixes[key] = { count: 0, bytes: 0 };
    const size = Number(object.size || 0);
    prefixes[key].count += 1;
    prefixes[key].bytes += size;
    totalBytes += size;
  }
  return {
    ok: true,
    fileCount: listed.objects.length,
    totalBytes,
    prefixes,
    topFolders: uniqueSorted((listed.objects || []).map((o) => (o.name || '').split('/')[0])),
  };
}

async function listIndexes(accessToken, projectId) {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups`;
  const { ok, status, json } = await googleFetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default):listCollectionIds`,
    { method: 'POST', accessToken, body: { pageSize: 1 } }
  );
  // Prefer the indexes REST on the database.
  const idxUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/indexes`;
  const listed = await googleFetch(idxUrl, { accessToken });
  return {
    ok: listed.ok,
    status: listed.status,
    indexes: (listed.json && listed.json.indexes) || [],
    error: listed.ok ? null : listed.json,
    collectionGroupsProbe: { ok, status, jsonKeys: json && Object.keys(json) },
    probeUrl: url,
  };
}

async function listAuthUsers(accessToken, projectId) {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet?maxResults=100`;
  const { ok, status, json } = await googleFetch(url, { method: 'POST', accessToken, body: {} });
  if (!ok) return { ok: false, status, error: json, count: 0 };
  const users = json.users || json.records || [];
  return {
    ok: true,
    count: users.length,
    providers: uniqueSorted(users.flatMap((u) => (u.providerUserInfo || []).map((p) => p.providerId))),
    withEmail: users.filter((u) => u.email).length,
  };
}

function estimateReads({ org, invoiceCount, expenseCount, clientCount, profileCount, jobCount }) {
  const jobsHomePerVisit =
    2 + // email variants × array-contains
    jobCount * (1 + invoiceCount / Math.max(jobCount, 1) + expenseCount / Math.max(jobCount, 1) + clientCount / Math.max(jobCount, 1));
  // Rough: listInvitedProjects (1–2) + per job full expenses + invoices + clients.
  const openJob =
    1 + // project get
    Math.ceil(expenseCount / Math.max(jobCount, 1)) +
    Math.ceil(invoiceCount / Math.max(jobCount, 1)) +
    8; // labour, trades, clients, projects, payments, hia, bank, payers (approx)
  return {
    jobsHomePerVisit: Math.round(jobsHomePerVisit),
    openJobApprox: openJob,
    profileLookupFullScan: profileCount,
    at10xJobsHome: Math.round(jobsHomePerVisit) * 10,
    at100xJobsHome: Math.round(jobsHomePerVisit) * 100,
    note: 'Jobs home currently downloads every expense, invoice, and client for every invited job on each visit.',
  };
}

async function scanProject(accessToken, projectId, bucket) {
  console.log(`\nScanning Firestore ${projectId} (default) — read only`);
  const exported = await exportDatabase(accessToken, projectId, '(default)');
  const analysis = analyzeDocuments(exported.documents);
  const org = summarizeOrg(analysis.decoded);
  const profiles = summarizeProfiles(analysis.decoded);
  const pins = summarizePins(analysis.decoded);

  const invoiceDocs = analysis.decoded.filter((d) => collectionBucket(d.path).endsWith('/invoices'));
  const expenseDocs = analysis.decoded.filter((d) => collectionBucket(d.path).endsWith('/expenses'));
  const orgInvoiceDocs = invoiceDocs.filter((d) => d.path.startsWith('organizations/'));
  const orgExpenseDocs = expenseDocs.filter((d) => d.path.startsWith('organizations/'));

  const invoiceIntegrity = integrityForJobScoped(orgInvoiceDocs, 'invoice');
  const expenseIntegrity = integrityForJobScoped(orgExpenseDocs, 'expense');

  const invoiceNameClusters = clusterNames(orgInvoiceDocs, (d) => d.data.projectName);
  const expenseNameClusters = clusterNames(orgExpenseDocs, (d) => d.data.projectName);
  const nestedProjectClusters = clusterNames(
    analysis.decoded.filter((d) => collectionBucket(d.path) === 'organizations/{orgId}/projects/{projectId}/projects'),
    (d) => d.data.name
  );

  console.log(`  documents: ${exported.documents.length}`);
  console.log(`Listing Storage ${bucket}`);
  const listed = await listStorageObjects(accessToken, bucket);
  const storage = storageSummary(listed);
  console.log(storage.ok ? `  files: ${storage.fileCount}` : `  storage list failed: ${storage.status}`);

  const indexes = await listIndexes(accessToken, projectId);
  const auth = await listAuthUsers(accessToken, projectId);

  const otherRoots = exported.rootCollectionIds.filter((id) => !['organizations', 'profiles', 'users'].includes(id));

  return {
    projectId,
    scannedAt: new Date().toISOString(),
    rootCollectionIds: exported.rootCollectionIds,
    otherRootCollections: otherRoots,
    documentCount: exported.documents.length,
    treeCounts: analysis.treeCounts,
    fieldShapes: analysis.fieldShapes,
    oversized: analysis.oversized,
    org,
    profiles,
    pins,
    jobStrings: {
      invoiceProjectNames: uniqueSorted(orgInvoiceDocs.map((d) => d.data.projectName)),
      expenseProjectNames: uniqueSorted(orgExpenseDocs.map((d) => d.data.projectName)),
      nestedProjectNames: uniqueSorted(
        analysis.decoded
          .filter((d) => collectionBucket(d.path) === 'organizations/{orgId}/projects/{projectId}/projects')
          .map((d) => d.data.name)
      ),
      invoicesWithJobId: orgInvoiceDocs.filter((d) => d.data.jobId || d.data.projectId).length,
      expensesWithJobId: orgExpenseDocs.filter((d) => d.data.jobId || d.data.projectId).length,
      invoiceNameClusters,
      expenseNameClusters,
      nestedProjectClusters,
    },
    integrity: {
      invoices: {
        total: orgInvoiceDocs.length,
        withIssues: invoiceIntegrity.length,
        invalidDate: invoiceIntegrity.filter((r) => r.issues.some((i) => i.startsWith('invoiceDate:'))).length,
        missingProjectName: invoiceIntegrity.filter((r) => r.issues.includes('missing-projectName')).length,
        noStableId: invoiceIntegrity.filter((r) => r.issues.includes('no-stable-job-id-field')).length,
        samples: invoiceIntegrity.slice(0, 20),
      },
      expenses: {
        total: orgExpenseDocs.length,
        withIssues: expenseIntegrity.length,
        uncategorised: expenseIntegrity.filter((r) => r.issues.includes('uncategorised')).length,
        noReceipt: expenseIntegrity.filter((r) => r.issues.includes('no-receipt')).length,
        invalidDate: expenseIntegrity.filter((r) => r.issues.some((i) => i.startsWith('date:'))).length,
        reviewedInUse: expenseIntegrity.filter((r) => r.issues.includes('has-reviewed-field')).length,
        noStableId: expenseIntegrity.filter((r) => r.issues.includes('no-stable-job-id-field')).length,
        categoryCounts: orgExpenseDocs.reduce((acc, d) => {
          bump(acc, d.data.category || '(none)');
          return acc;
        }, {}),
        samples: expenseIntegrity.slice(0, 20),
      },
      pinOrgExpenseDelta: {
        pinExpenses: expenseDocs.filter((d) => d.path.startsWith('users/')).length,
        orgExpenses: orgExpenseDocs.length,
        pinInvoices: invoiceDocs.filter((d) => d.path.startsWith('users/')).length,
        orgInvoices: orgInvoiceDocs.length,
      },
    },
    storage,
    indexes: {
      ok: indexes.ok,
      status: indexes.status,
      count: (indexes.indexes || []).length,
      indexes: indexes.indexes,
      error: indexes.error,
    },
    auth,
    cost: estimateReads({
      org,
      invoiceCount: orgInvoiceDocs.length,
      expenseCount: orgExpenseDocs.length,
      clientCount: analysis.decoded.filter((d) => collectionBucket(d.path).endsWith('/clients')).length,
      profileCount: profiles.count,
      jobCount: Math.max((org.jobs || []).length, 1),
    }),
    largestDocs: analysis.decoded
      .slice()
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 10)
      .map((d) => ({ path: d.path, bytes: d.bytes })),
  };
}

async function main() {
  console.log('Phase 5 Part A — READ-ONLY database audit');
  console.log('This script does not write to Firestore, Storage, Auth, or rules.');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'backups', `phase5-audit-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const accessToken = await getAccessToken();

  const production = await scanProject(accessToken, PRODUCTION_PROJECT, PRODUCTION_BUCKET);
  fs.writeFileSync(path.join(outDir, 'production-analysis.json'), JSON.stringify(production, null, 2));

  // Empty named database check (metadata only).
  console.log('\nScanning production cost-tracker database — read only');
  const costTracker = await exportDatabase(accessToken, PRODUCTION_PROJECT, 'cost-tracker');
  fs.writeFileSync(
    path.join(outDir, 'production-cost-tracker.json'),
    JSON.stringify(
      {
        databaseId: 'cost-tracker',
        rootCollectionIds: costTracker.rootCollectionIds,
        documentCount: costTracker.documents.length,
      },
      null,
      2
    )
  );

  const staging = await scanProject(accessToken, STAGING_PROJECT, STAGING_BUCKET);
  fs.writeFileSync(path.join(outDir, 'staging-analysis.json'), JSON.stringify(staging, null, 2));

  const comparison = {
    productionJobs: (production.org.jobs || []).map((j) => ({ id: j.id, name: j.name, invitedCount: j.invitedCount })),
    stagingJobs: (staging.org.jobs || []).map((j) => ({ id: j.id, name: j.name, invitedCount: j.invitedCount })),
    productionOrgExpenses: production.integrity.expenses.total,
    stagingOrgExpenses: staging.integrity.expenses.total,
    productionOrgInvoices: production.integrity.invoices.total,
    stagingOrgInvoices: staging.integrity.invoices.total,
    productionPins: production.pins.leftoverTreeCount,
    stagingPins: staging.pins.leftoverTreeCount,
    productionProfiles: production.profiles.count,
    stagingProfiles: staging.profiles.count,
    productionInvoiceNames: production.jobStrings.invoiceProjectNames,
    stagingInvoiceNames: staging.jobStrings.invoiceProjectNames,
  };
  fs.writeFileSync(path.join(outDir, 'comparison.json'), JSON.stringify(comparison, null, 2));

  const pointer = path.join(__dirname, '..', 'backups', 'latest-phase5-audit.txt');
  fs.writeFileSync(pointer, outDir);

  console.log('\nWrote read-only analysis to', outDir);
  console.log('Production jobs:', comparison.productionJobs);
  console.log('Production invoice projectName values:', production.jobStrings.invoiceProjectNames);
  console.log('Production invoices', production.integrity.invoices.total, 'invalidDate', production.integrity.invoices.invalidDate);
  console.log('Production expenses', production.integrity.expenses.total, 'uncategorised', production.integrity.expenses.uncategorised, 'noReceipt', production.integrity.expenses.noReceipt);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
