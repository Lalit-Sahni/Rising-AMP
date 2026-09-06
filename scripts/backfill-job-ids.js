#!/usr/bin/env node
/**
 * Additive jobId backfill. Writes only the missing jobId field on child
 * documents under organizations/{org}/projects/{jobId}/…
 *
 * Usage:
 *   node scripts/backfill-job-ids.js --dry-run
 *   node scripts/backfill-job-ids.js --apply --staging
 *
 * Refuses production unless both --apply and --production are passed.
 */

const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  getAccessToken,
  listCollectionIds,
  listDocuments,
  relativeDocPath,
  docResourceName,
  batchWrite,
} = require('./lib/phase1Firebase');

const ORG_ID = 'opal-ss-constructions';

function parseArgs(argv) {
  const production = argv.includes('--production');
  const staging = argv.includes('--staging');
  const apply = argv.includes('--apply');
  if (production && staging) {
    throw new Error('Pick --staging or --production, not both.');
  }
  return {
    apply,
    production,
    destination: production ? PRODUCTION_PROJECT : STAGING_PROJECT,
  };
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.nullValue !== undefined) return null;
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply && args.production && !process.argv.includes('--production')) {
    throw new Error('Refusing production apply without --production.');
  }
  if (args.apply && !args.production && !process.argv.includes('--staging')) {
    throw new Error('Refusing to write without --apply --staging (or --apply --production).');
  }
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Staging and production IDs match. Stop.');
  }

  const destination = args.destination;

  console.log(args.apply ? `BACKFILL jobId (writing ${destination})` : `BACKFILL jobId (dry run, ${destination})`);
  if (destination === PRODUCTION_PROJECT) {
    console.log('Destination is PRODUCTION. This should only run after staging and an owner yes.');
  }

  const accessToken = await getAccessToken();
  const orgParent = `projects/${destination}/databases/(default)/documents/organizations/${ORG_ID}`;
  const jobs = await listDocuments(accessToken, orgParent, 'projects');
  const planned = [];

  for (const job of jobs) {
    const jobId = relativeDocPath(job.name).split('/')[3];
    const childCols = await listCollectionIds(accessToken, job.name);
    for (const col of childCols) {
      const docs = await listDocuments(accessToken, job.name, col);
      for (const child of docs) {
        const existing = decodeValue(child.fields && child.fields.jobId);
        if (existing === jobId) continue;
        planned.push({
          path: relativeDocPath(child.name),
          jobId,
          previous: existing,
        });
      }
    }
  }

  console.log(`Jobs: ${jobs.length}. Documents missing jobId (or with a different value): ${planned.length}`);
  planned.slice(0, 12).forEach((row) => {
    console.log(`  ${row.path} -> ${row.jobId}`);
  });
  if (planned.length > 12) console.log(`  … ${planned.length - 12} more`);

  if (!args.apply) {
    console.log('Dry run. No writes.');
    return;
  }

  let wrote = 0;
  for (let i = 0; i < planned.length; i += 400) {
    const group = planned.slice(i, i + 400);
    const updateWrites = group.map((row) => ({
      update: {
        name: docResourceName(destination, '(default)', row.path),
        fields: {
          jobId: { stringValue: row.jobId },
        },
      },
      updateMask: { fieldPaths: ['jobId'] },
      currentDocument: { exists: true },
    }));
    await batchWrite(accessToken, destination, '(default)', updateWrites);
    wrote += group.length;
    console.log(`  wrote ${wrote}/${planned.length}`);
  }

  console.log('Backfill finished.', { wrote, destination });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
