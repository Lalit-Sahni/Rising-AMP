#!/usr/bin/env node
/**
 * Recompute ledgerRollup/current from every expense on each job, then
 * rebuild organizations/{orgId}/ledgerRollup/current by summing complete
 * job rollups (not by scanning every expense in the org).
 *
 * Idempotent: if the stored rollup already matches, it is skipped.
 * Reversible: this only writes (or with --clear, deletes) ledgerRollup/current
 * on jobs and the org. Expenses, invoices and jobs are never changed.
 * Reverse is --clear, or a Firestore restore; it does not delete user records.
 *
 * Dry-run is the default. Writes require --apply and --staging, or
 * --apply and --production. --clear is staging only.
 *
 *   node scripts/recompute-ledger-rollups.js --dry-run --staging
 *   node scripts/recompute-ledger-rollups.js --apply --staging
 *   node scripts/recompute-ledger-rollups.js --clear --apply --staging
 *   node scripts/recompute-ledger-rollups.js --dry-run --production
 *   node scripts/recompute-ledger-rollups.js --apply --production
 *
 * Production writes only ledgerRollup/current (job + org). Follow immediately
 * with Phase 13+ hosting: Phase 12 hosting rejects byTrade/byParty extra keys.
 */

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
  computeLedgerRollup,
  parseCompleteRollup,
  rollupsAgree,
  firestorePayload,
  sumLedgerRollups,
  LEDGER_ROLLUP_COLLECTION,
  LEDGER_ROLLUP_DOC_ID,
} = require('../functions/lib/ledgerRollup');

function parseArgs(argv) {
  const production = argv.includes('--production');
  const staging = argv.includes('--staging');
  const apply = argv.includes('--apply');
  const clear = argv.includes('--clear');
  const dryRun = argv.includes('--dry-run') || !apply;
  const jobFlag = argv.find((arg) => arg.startsWith('--job='));
  const jobId = jobFlag ? jobFlag.slice('--job='.length).trim() : '';
  if (production && staging) {
    throw new Error('Pick --staging or --production, not both.');
  }
  if (!production && !staging) {
    throw new Error('Pass --staging or --production.');
  }
  if (clear && production) {
    throw new Error('Refusing --clear on production.');
  }
  return {
    apply,
    clear,
    dryRun: !apply || dryRun,
    production,
    jobId,
    destination: production ? PRODUCTION_PROJECT : STAGING_PROJECT,
  };
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
  return data;
}

function decodeExpense(doc) {
  const data = decodeFields(doc);
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

function encodeRollup(rollup) {
  const payload = firestorePayload(rollup, new Date());
  const fields = {};
  Object.entries(payload).forEach(([key, value]) => {
    fields[key] = encodeValue(value);
  });
  return fields;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply && args.production && !process.argv.includes('--production')) {
    throw new Error('Refusing to write without --apply --production.');
  }
  if (args.apply && !args.production && !process.argv.includes('--staging')) {
    throw new Error('Refusing to write without --apply --staging.');
  }
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Staging and production IDs match. Stop.');
  }

  const destination = args.destination;
  const mode = args.apply ? (args.clear ? 'CLEAR' : 'WRITE') : 'DRY RUN';
  console.log(`Ledger rollups (${mode}, ${destination})`);
  console.log('Only ledgerRollup/current is touched (job + org). Expenses are not changed.');

  const accessToken = await getAccessToken();
  const root = `projects/${destination}/databases/(default)/documents`;
  const orgs = await listDocuments(accessToken, root, 'organizations');
  const jobPlans = [];
  const jobsByOrg = new Map();

  for (const org of orgs) {
    const orgId = relativeDocPath(org.name).split('/')[1];
    const jobs = await listDocuments(accessToken, org.name, 'projects');
    const orgJobs = [];
    for (const job of jobs) {
      const jobId = relativeDocPath(job.name).split('/')[3];
      const name = decodeValue(job.fields && job.fields.name) || jobId;
      const expenses = (await listOrEmpty(accessToken, job.name, 'expenses')).map(decodeExpense);
      const computed = computeLedgerRollup(expenses, 0);
      const existingDocs = await listOrEmpty(accessToken, job.name, LEDGER_ROLLUP_COLLECTION);
      const existingDoc = existingDocs.find((doc) => relativeDocPath(doc.name).endsWith(`/${LEDGER_ROLLUP_DOC_ID}`));
      // Do not attach `id` — parseCompleteRollup rejects extra keys.
      const existing = existingDoc ? parseCompleteRollup(decodeFields(existingDoc)) : null;
      const path = `organizations/${orgId}/projects/${jobId}/${LEDGER_ROLLUP_COLLECTION}/${LEDGER_ROLLUP_DOC_ID}`;
      const agrees = existing ? rollupsAgree(existing, computed) : false;
      const row = {
        orgId,
        jobId,
        name,
        path,
        expenseRows: expenses.length,
        liveCount: computed.liveCount,
        costCents: computed.costCents,
        investorCents: computed.investorCents,
        agrees,
        hasExisting: Boolean(existingDoc),
        parseFailed: Boolean(existingDoc) && !existing,
        nextRevision: (existing && existing.revision ? existing.revision : 0) + 1,
        computed,
        existing,
      };
      orgJobs.push(row);
      if (args.jobId && args.jobId !== jobId) continue;
      jobPlans.push(row);
    }
    jobsByOrg.set(orgId, orgJobs);
  }

  jobPlans.forEach((row) => {
    const flag = args.clear
      ? (row.hasExisting ? 'delete' : 'skip')
      : (row.agrees ? 'ok' : (row.parseFailed ? 'repair' : (row.hasExisting ? 'update' : 'create')));
    console.log(
      `${flag.padEnd(6)} ${row.jobId}  ${row.name}  docs=${row.expenseRows} live=${row.liveCount} costCents=${row.costCents} investorCents=${row.investorCents}`,
    );
  });

  const orgPlans = [];
  for (const org of orgs) {
    const orgId = relativeDocPath(org.name).split('/')[1];
    const orgJobs = jobsByOrg.get(orgId) || [];
    if (args.jobId && !orgJobs.some((row) => row.jobId === args.jobId)) continue;
    const parts = [];
    if (!args.clear) {
      orgJobs.forEach((row) => {
        const inWriteSet = !args.jobId || args.jobId === row.jobId;
        const willWrite = inWriteSet && !row.agrees;
        const afterWrite = willWrite ? row.computed : row.existing;
        const parsed = parseCompleteRollup(afterWrite);
        if (parsed) parts.push(parsed);
      });
    }
    const computed = sumLedgerRollups(parts, 0);
    const existingDocs = await listOrEmpty(accessToken, org.name, LEDGER_ROLLUP_COLLECTION);
    const existingDoc = existingDocs.find((doc) => relativeDocPath(doc.name).endsWith(`/${LEDGER_ROLLUP_DOC_ID}`));
    const existing = existingDoc ? parseCompleteRollup(decodeFields(existingDoc)) : null;
    const path = `organizations/${orgId}/${LEDGER_ROLLUP_COLLECTION}/${LEDGER_ROLLUP_DOC_ID}`;
    const agrees = existing ? rollupsAgree(existing, computed) : false;
    orgPlans.push({
      orgId,
      path,
      liveCount: computed.liveCount,
      costCents: computed.costCents,
      investorCents: computed.investorCents,
      agrees,
      hasExisting: Boolean(existingDoc),
      parseFailed: Boolean(existingDoc) && !existing,
      nextRevision: (existing && existing.revision ? existing.revision : 0) + 1,
      computed,
      jobsIncluded: parts.length,
      jobCount: orgJobs.length,
    });
  }

  orgPlans.forEach((row) => {
    const flag = args.clear
      ? (row.hasExisting ? 'delete' : 'skip')
      : (row.agrees ? 'ok' : (row.parseFailed ? 'repair' : (row.hasExisting ? 'update' : 'create')));
    console.log(
      `${flag.padEnd(6)} org ${row.orgId}  jobs=${row.jobsIncluded}/${row.jobCount} live=${row.liveCount} costCents=${row.costCents} investorCents=${row.investorCents}`,
    );
  });

  const jobWrites = args.clear
    ? jobPlans.filter((row) => row.hasExisting).map((row) => ({
      delete: docResourceName(destination, '(default)', row.path),
    }))
    : jobPlans.filter((row) => !row.agrees).map((row) => ({
      update: {
        name: docResourceName(destination, '(default)', row.path),
        fields: encodeRollup({ ...row.computed, revision: row.nextRevision }),
      },
    }));

  const orgWrites = args.clear
    ? orgPlans.filter((row) => row.hasExisting).map((row) => ({
      delete: docResourceName(destination, '(default)', row.path),
    }))
    : orgPlans.filter((row) => !row.agrees).map((row) => ({
      update: {
        name: docResourceName(destination, '(default)', row.path),
        fields: encodeRollup({ ...row.computed, revision: row.nextRevision }),
      },
    }));

  const writes = jobWrites.concat(orgWrites);

  console.log(`${writes.length} write(s) planned`);

  if (!args.apply) {
    console.log(
      args.production
        ? 'Dry run. Re-run with --apply --production to write.'
        : 'Dry run. Re-run with --apply --staging to write.',
    );
    return;
  }

  if (writes.length === 0) {
    console.log('Nothing to write.');
    return;
  }

  const chunkSize = 20;
  for (let i = 0; i < writes.length; i += chunkSize) {
    await batchWrite(accessToken, destination, '(default)', writes.slice(i, i + chunkSize));
  }
  console.log(args.clear ? 'Cleared rollup documents.' : 'Wrote complete rollup documents.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
