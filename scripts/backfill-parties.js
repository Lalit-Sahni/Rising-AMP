#!/usr/bin/env node
/**
 * Backfill organizations/{org}/parties from live directory names, then stamp
 * partyId onto directory rows, expenses, invoices and quotes.
 *
 * Linking bar: exact canonicalPartyName equality only, plus kind.
 * namesMatch is listed for the owner and never written as a partyId.
 *
 * Dry-run is the default. Writes require --apply --staging.
 * Part A2 refuses --production even if it is passed.
 *
 *   node scripts/backfill-parties.js --dry-run --staging
 *   node scripts/backfill-parties.js --apply --staging
 *
 * Org: opal-ss-constructions only. Never deletes. No --clear.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  getAccessToken,
  listDocuments,
  relativeDocPath,
  docResourceName,
  batchWrite,
} = require('./lib/phase1Firebase');
const {
  OPAL_ORG_ID,
  DIRECTORY_SPECS,
  resolveBackfillTarget,
  planPartyBackfill,
  formatOwnerReport,
} = require('./lib/partyBackfill');

const REPORT_PATH = path.join(__dirname, 'party-backfill-unlinked-staging.md');
const AUTO_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function parseArgs(argv) {
  return resolveBackfillTarget(argv, {
    stagingProject: STAGING_PROJECT,
    productionProject: PRODUCTION_PROJECT,
  });
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return new Date(value.timestampValue);
  if (value.mapValue) {
    const out = {};
    Object.entries(value.mapValue.fields || {}).forEach(([key, nested]) => {
      out[key] = decodeValue(nested);
    });
    return out;
  }
  if (value.arrayValue && Array.isArray(value.arrayValue.values)) {
    return value.arrayValue.values.map(decodeValue);
  }
  return null;
}

function decodeFields(doc) {
  const data = {};
  Object.entries(doc.fields || {}).forEach(([key, value]) => {
    data[key] = decodeValue(value);
  });
  const parts = relativeDocPath(doc.name).split('/');
  data.id = parts[parts.length - 1];
  return data;
}

function encodeValue(value) {
  if (value == null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { integerValue: '0' };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    Object.entries(value).forEach(([key, nested]) => {
      fields[key] = encodeValue(nested);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

function newPartyId(existing) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const bytes = crypto.randomBytes(20);
    let id = '';
    for (let i = 0; i < 20; i += 1) {
      id += AUTO_ID_ALPHABET[bytes[i] % AUTO_ID_ALPHABET.length];
    }
    if (!existing.has(id)) return id;
  }
  throw new Error('Could not allocate a party id.');
}

async function listOrEmpty(accessToken, parentName, collectionId) {
  try {
    return await listDocuments(accessToken, parentName, collectionId);
  } catch (error) {
    const message = String(error && error.message);
    if (message.includes(' 404 ') || message.includes('"code":5')) return [];
    throw error;
  }
}

async function loadSnapshot(accessToken, projectId) {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const orgs = await listDocuments(accessToken, root, 'organizations');
  let orgDoc = null;
  for (const org of orgs) {
    const orgId = relativeDocPath(org.name).split('/')[1];
    if (orgId === OPAL_ORG_ID) {
      orgDoc = org;
      continue;
    }
    console.log(`Skipping org ${orgId}`);
  }
  if (!orgDoc) {
    throw new Error(`Organisation ${OPAL_ORG_ID} was not found.`);
  }

  const parties = (await listOrEmpty(accessToken, orgDoc.name, 'parties')).map((doc) => {
    const data = decodeFields(doc);
    return {
      id: data.id,
      displayName: data.displayName,
      canonicalName: data.canonicalName,
      kind: data.kind,
      status: data.status || 'active',
      mergedInto: data.mergedInto || null,
      abn: data.abn || null,
      email: data.email || null,
      phone: data.phone || null,
    };
  });

  const jobDocs = await listOrEmpty(accessToken, orgDoc.name, 'projects');
  const jobs = [];
  for (const jobDoc of jobDocs) {
    const data = decodeFields(jobDoc);
    const directories = {};
    for (const spec of DIRECTORY_SPECS) {
      directories[spec.collection] = (await listOrEmpty(accessToken, jobDoc.name, spec.collection)).map(decodeFields);
    }
    jobs.push({
      id: data.id,
      name: data.name || data.id,
      directories,
      expenses: (await listOrEmpty(accessToken, jobDoc.name, 'expenses')).map(decodeFields),
      invoices: (await listOrEmpty(accessToken, jobDoc.name, 'invoices')).map(decodeFields),
      quotes: (await listOrEmpty(accessToken, jobDoc.name, 'quotes')).map(decodeFields),
    });
  }

  return { orgId: OPAL_ORG_ID, parties, jobs };
}

function printSummary(plan) {
  console.log(`Org: ${plan.orgId}`);
  console.log(`parties to create: ${plan.counts.partiesCreated}`);
  console.log(`rows to stamp: ${plan.counts.rowsStamped}`);
  console.log(`already stamped: ${plan.counts.rowsSkippedAlreadyStamped}`);
  console.log(`unlinked ledger rows: ${plan.counts.unlinkedLedger}`);
  console.log(`candidate merge groups: ${plan.candidateMergeGroups.length}`);
  plan.candidateMergeGroups.forEach((group, index) => {
    console.log(`  group ${index + 1} ${group.kind} [${group.reason}] ${group.canonicals.join(' | ')}`);
    group.members.forEach((member) => {
      console.log(`    ${member.displayName}  (${member.canonicalName})  ${member.jobName}  ${member.collection}`);
    });
  });
  console.log(`${plan.writeCount} write(s) planned`);
}

function partyCreateWrite(projectId, orgId, party) {
  const fields = {};
  const payload = {
    displayName: party.displayName,
    canonicalName: party.canonicalName,
    kind: party.kind,
    status: 'active',
    abn: party.abn || null,
    email: party.email || null,
    phone: party.phone || null,
    mergedInto: null,
    createdAt: party.createdAt,
    updatedAt: party.updatedAt,
  };
  Object.entries(payload).forEach(([key, value]) => {
    fields[key] = encodeValue(value);
  });
  return {
    update: {
      name: docResourceName(projectId, '(default)', `organizations/${orgId}/parties/${party.id}`),
      fields,
    },
    currentDocument: { exists: false },
  };
}

function partyIdStampWrite(projectId, pathStr, partyId) {
  return {
    update: {
      name: docResourceName(projectId, '(default)', pathStr),
      fields: {
        partyId: { stringValue: partyId },
      },
    },
    updateMask: { fieldPaths: ['partyId'] },
  };
}

async function applyPlan(accessToken, projectId, plan, existingPartyIds) {
  const now = new Date();
  const existingIds = new Set(existingPartyIds || []);
  const idMap = {};
  const writes = [];

  plan.partiesToCreate.forEach((row) => {
    const id = newPartyId(existingIds);
    existingIds.add(id);
    idMap[row.plannedId] = id;
    writes.push(partyCreateWrite(projectId, plan.orgId, {
      id,
      displayName: row.displayName,
      canonicalName: row.canonicalName,
      kind: row.kind,
      abn: row.abn,
      email: row.email,
      phone: row.phone,
      createdAt: now,
      updatedAt: now,
    }));
  });

  plan.stamps.forEach((stamp) => {
    const partyId = idMap[stamp.partyId] || stamp.partyId;
    if (String(partyId).startsWith('new:')) {
      throw new Error(`Missing created party for ${stamp.partyId}`);
    }
    writes.push(partyIdStampWrite(projectId, stamp.path, partyId));
  });

  const chunkSize = 200;
  for (let i = 0; i < writes.length; i += chunkSize) {
    await batchWrite(accessToken, projectId, '(default)', writes.slice(i, i + chunkSize));
  }
  return { created: plan.partiesToCreate.length, stamped: plan.stamps.length, writes: writes.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.destination === PRODUCTION_PROJECT) {
    throw new Error('Part A2 refuses production. Staging only.');
  }

  const mode = args.apply ? 'WRITE' : 'DRY RUN';
  console.log(`Party backfill (${mode}, ${args.destination})`);
  console.log('Exact canonical equality only. No namesMatch writes. No deletes.');

  const accessToken = await getAccessToken();
  const snapshot = await loadSnapshot(accessToken, args.destination);
  const plan = planPartyBackfill(snapshot);
  const report = formatOwnerReport(plan);
  fs.writeFileSync(REPORT_PATH, report);
  printSummary(plan);
  console.log(`Wrote owner list ${path.relative(process.cwd(), REPORT_PATH)}`);

  if (!args.apply) {
    console.log('Dry run. Re-run with --apply --staging to write.');
    return;
  }

  if (plan.writeCount === 0) {
    console.log('Nothing to write.');
    return;
  }

  const result = await applyPlan(
    accessToken,
    args.destination,
    plan,
    snapshot.parties.map((row) => row.id),
  );
  console.log(`Created ${result.created} part(y/ies). Stamped ${result.stamped} row(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
