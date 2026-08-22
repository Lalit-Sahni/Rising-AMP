#!/usr/bin/env node
/**
 * Restore a production backup into STAGING only.
 * Refuses to write if the destination is production.
 *
 * Usage:
 *   node scripts/restore-to-staging.js --dry-run
 *   node scripts/restore-to-staging.js --apply
 */

const fs = require('fs');
const path = require('path');
const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  STAGING_BUCKET,
  getAccessToken,
  docResourceName,
  batchWrite,
  uploadStorageObject,
} = require('./lib/phase1Firebase');

function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
    apply: argv.includes('--apply'),
    dir: (() => {
      const idx = argv.indexOf('--dir');
      if (idx !== -1 && argv[idx + 1]) return path.resolve(argv[idx + 1]);
      const latest = path.join(__dirname, '..', 'backups', 'latest-production-backup.txt');
      if (!fs.existsSync(latest)) throw new Error('No --dir and no backups/latest-production-backup.txt');
      return fs.readFileSync(latest, 'utf8').trim();
    })(),
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function restoreFirestore(accessToken, backupDir, apply) {
  const files = [
    { file: 'firestore-default.json', databaseId: '(default)' },
    { file: 'firestore-cost-tracker.json', databaseId: 'cost-tracker' },
  ];
  const summary = [];

  for (const { file, databaseId } of files) {
    const full = path.join(backupDir, file);
    if (!fs.existsSync(full)) {
      summary.push({ databaseId, skipped: true, reason: 'file missing' });
      continue;
    }
    const payload = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (payload.projectId !== PRODUCTION_PROJECT) {
      throw new Error(`${file} was not taken from production (${payload.projectId})`);
    }
    const docs = payload.documents || [];
    if (docs.length === 0) {
      summary.push({ databaseId, documentCount: 0 });
      continue;
    }

    if (!apply) {
      summary.push({ databaseId, documentCount: docs.length, wrote: 0, dryRun: true });
      continue;
    }

    let wrote = 0;
    for (const group of chunk(docs, 400)) {
      const writes = group.map((doc) => ({
        update: {
          name: docResourceName(STAGING_PROJECT, databaseId, doc.path),
          fields: doc.fields || {},
        },
      }));
      await batchWrite(accessToken, STAGING_PROJECT, databaseId, writes);
      wrote += group.length;
      console.log(`  ${databaseId}: wrote ${wrote}/${docs.length}`);
    }
    summary.push({ databaseId, documentCount: docs.length, wrote });
  }
  return summary;
}

async function restoreStorage(accessToken, backupDir, apply) {
  const manifestPath = path.join(backupDir, 'storage-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { skipped: true, reason: 'no storage manifest' };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const objects = (manifest.objects || []).filter((o) => o.ok);
  if (!apply) {
    return { fileCount: objects.length, uploaded: 0, dryRun: true };
  }

  let uploaded = 0;
  const failures = [];
  for (const obj of objects) {
    const filePath = path.join(backupDir, 'storage', obj.name);
    if (!fs.existsSync(filePath)) {
      failures.push({ name: obj.name, error: 'file missing on disk' });
      continue;
    }
    const result = await uploadStorageObject(
      accessToken,
      STAGING_BUCKET,
      obj.name,
      filePath,
      obj.contentType
    );
    if (!result.ok) {
      failures.push({ name: obj.name, status: result.status, body: result.body });
      if (failures.length === 1) {
        console.log(`  Storage upload failed (HTTP ${result.status}). Stopping further uploads.`);
        return {
          fileCount: objects.length,
          uploaded,
          failed: objects.length - uploaded,
          firstError: failures[0],
          aborted: true,
        };
      }
    } else {
      uploaded += 1;
    }
  }
  return { fileCount: objects.length, uploaded, failed: failures.length, failures: failures.slice(0, 5) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Refusing to run: staging and production project IDs are identical.');
  }
  if (!fs.existsSync(args.dir)) {
    throw new Error(`Backup folder not found: ${args.dir}`);
  }

  console.log(args.apply ? 'RESTORE TO STAGING (writing)' : 'RESTORE TO STAGING (dry run, no writes)');
  console.log(`Destination project: ${STAGING_PROJECT}`);
  console.log(`Backup folder: ${args.dir}`);

  const accessToken = await getAccessToken();
  const firestore = await restoreFirestore(accessToken, args.dir, args.apply);
  const storage = await restoreStorage(accessToken, args.dir, args.apply);

  console.log(JSON.stringify({
    destination: STAGING_PROJECT,
    refusedProduction: true,
    apply: args.apply,
    firestore,
    storage,
  }, null, 2));
}

main().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});
