#!/usr/bin/env node
/**
 * Owner-named party merges on staging (7 Sep 2026).
 *
 * Lalit (worker) → Lalit Sahni. Sydney Excavation and Demo (service provider)
 * → Sydney Excavation and Demolition. Metro Consulting is not merged.
 *
 * Uses mergeParty field writes: status merged, mergedInto, never delete.
 * Dry-run is the default. Writes require --apply --staging.
 *
 *   node scripts/merge-parties-staging.js --dry-run --staging
 *   node scripts/merge-parties-staging.js --apply --staging
 */

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
const { DIRECTORY_SPECS } = require('./lib/partyBackfill');
const {
  OPAL_ORG_ID,
  parseMergeTarget,
  planApprovedMerges,
} = require('./lib/partyMerge');

const AUTO_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function parseArgs(argv) {
  return parseMergeTarget(argv, {
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

function printPlan(plan) {
  console.log(`Org: ${plan.orgId}`);
  console.log('Metro Consulting / Metro Consulting Group: untouched');
  console.log('Cross-kind leftovers (nameless expenses, ACME SCREW PILES, Client): untouched');
  plan.survivors.forEach((row) => {
    console.log(`Survivor ${row.displayName}: ${row.id} (${row.canonicalName}, ${row.kind})`);
  });
  plan.creates.forEach((row) => {
    console.log(`  create merged party ${row.displayName} (${row.canonicalName}, ${row.kind}) → ${row.mergedInto}`);
  });
  plan.merges.forEach((row) => {
    console.log(`  merge ${row.fromDisplayName} ${row.fromId} → ${row.intoId}`);
  });
  plan.stamps.forEach((row) => {
    console.log(`  stamp ${row.path}  ${row.displayName} → ${row.partyId}`);
  });
  console.log(`${plan.writeCount} write(s) planned`);
}

function partyCreateWrite(projectId, orgId, party) {
  const payload = {
    displayName: party.displayName,
    canonicalName: party.canonicalName,
    kind: party.kind,
    status: 'merged',
    abn: null,
    email: null,
    phone: null,
    mergedInto: party.mergedInto,
    createdAt: party.createdAt,
    updatedAt: party.updatedAt,
  };
  const fields = {};
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

function mergeWrite(projectId, orgId, fromId, intoId, updatedAt) {
  return {
    update: {
      name: docResourceName(projectId, '(default)', `organizations/${orgId}/parties/${fromId}`),
      fields: {
        status: { stringValue: 'merged' },
        mergedInto: { stringValue: intoId },
        updatedAt: encodeValue(updatedAt),
      },
    },
    updateMask: { fieldPaths: ['status', 'mergedInto', 'updatedAt'] },
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
  const writes = [];

  plan.creates.forEach((row) => {
    const id = newPartyId(existingIds);
    existingIds.add(id);
    writes.push(partyCreateWrite(projectId, plan.orgId, {
      id,
      displayName: row.displayName,
      canonicalName: row.canonicalName,
      kind: row.kind,
      mergedInto: row.mergedInto,
      createdAt: now,
      updatedAt: now,
    }));
    console.log(`  created ${row.displayName} as ${id} mergedInto ${row.mergedInto}`);
  });

  plan.merges.forEach((row) => {
    writes.push(mergeWrite(projectId, plan.orgId, row.fromId, row.intoId, now));
  });

  plan.stamps.forEach((stamp) => {
    writes.push(partyIdStampWrite(projectId, stamp.path, stamp.partyId));
  });

  const chunkSize = 200;
  for (let i = 0; i < writes.length; i += chunkSize) {
    await batchWrite(accessToken, projectId, '(default)', writes.slice(i, i + chunkSize));
  }
  return { writes: writes.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.destination === PRODUCTION_PROJECT) {
    throw new Error('Party merge refuses production. Staging only.');
  }

  const mode = args.apply ? 'WRITE' : 'DRY RUN';
  console.log(`Party merge (${mode}, ${args.destination})`);
  console.log('Owner-named pairs only. Never delete. Metro untouched.');

  const accessToken = await getAccessToken();
  const snapshot = await loadSnapshot(accessToken, args.destination);
  const plan = planApprovedMerges(snapshot);
  printPlan(plan);

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
  console.log(`Wrote ${result.writes} document(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
