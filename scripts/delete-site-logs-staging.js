#!/usr/bin/env node
/**
 * Delete Site Log documents from STAGING only.
 * Refuses to run against production.
 *
 * Usage:
 *   node scripts/delete-site-logs-staging.js --dry-run
 *   node scripts/delete-site-logs-staging.js --apply
 */

const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  getAccessToken,
  listCollectionIds,
  listDocuments,
  batchWrite,
} = require('./lib/phase1Firebase');

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Refusing to run: staging and production IDs match.');
  }

  console.log(apply ? 'DELETE SITE LOGS ON STAGING (writing)' : 'DELETE SITE LOGS ON STAGING (dry run)');
  console.log(`Destination: ${STAGING_PROJECT}`);
  console.log(`Production ${PRODUCTION_PROJECT} will not be touched.`);

  const accessToken = await getAccessToken();
  const rootName = `projects/${STAGING_PROJECT}/databases/(default)/documents`;
  const users = await listDocuments(accessToken, rootName, 'users');
  const toDelete = [];

  for (const userDoc of users) {
    const cols = await listCollectionIds(accessToken, userDoc.name);
    if (!cols.includes('siteLogs')) continue;
    const logs = await listDocuments(accessToken, userDoc.name, 'siteLogs');
    for (const log of logs) {
      toDelete.push(log.name);
    }
  }

  if (!apply) {
    console.log(JSON.stringify({ dryRun: true, wouldDelete: toDelete.length, sample: toDelete.slice(0, 8) }, null, 2));
    return;
  }

  let deleted = 0;
  for (const group of chunk(toDelete, 400)) {
    await batchWrite(
      accessToken,
      STAGING_PROJECT,
      '(default)',
      group.map((name) => ({ delete: name }))
    );
    deleted += group.length;
    console.log(`  deleted ${deleted}/${toDelete.length}`);
  }

  console.log(JSON.stringify({ apply: true, deleted, destination: STAGING_PROJECT }, null, 2));
}

main().catch((err) => {
  console.error('Delete failed:', err);
  process.exit(1);
});
