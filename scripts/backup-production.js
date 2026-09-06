#!/usr/bin/env node
/**
 * Read-only backup of production Firestore + Storage.
 * Refuses to run against any project other than production.
 * Writes to backups/production-<timestamp>/ (gitignored).
 *
 * Usage: node scripts/backup-production.js
 */

const fs = require('fs');
const path = require('path');
const {
  PRODUCTION_PROJECT,
  PRODUCTION_BUCKET,
  getAccessToken,
  exportDatabase,
  listStorageObjects,
  downloadStorageObject,
} = require('./lib/phase1Firebase');

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(__dirname, '..', 'backups', `production-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Phase 1 production backup (read-only)');
  console.log(`Source project: ${PRODUCTION_PROJECT}`);
  console.log(`Output: ${outDir}`);

  const accessToken = await getAccessToken();

  const databases = ['(default)', 'cost-tracker'];
  const firestoreSummary = {};

  for (const databaseId of databases) {
    console.log(`Reading Firestore database: ${databaseId}`);
    const exported = await exportDatabase(accessToken, PRODUCTION_PROJECT, databaseId);
    const file = path.join(outDir, `firestore-${databaseId === '(default)' ? 'default' : databaseId}.json`);
    fs.writeFileSync(file, JSON.stringify({
      projectId: PRODUCTION_PROJECT,
      databaseId,
      exportedAt: new Date().toISOString(),
      rootCollectionIds: exported.rootCollectionIds,
      documentCount: exported.documents.length,
      countsByCollection: exported.countsByCollection,
      documents: exported.documents,
    }, null, 2));
    const perUser = {};
    for (const d of exported.documents) {
      if (!d.path.startsWith('users/')) continue;
      const parts = d.path.split('/');
      const code = parts[1];
      if (!perUser[code]) perUser[code] = { collections: {} };
      if (parts.length === 2) {
        perUser[code].userDoc = true;
      } else {
        const col = parts[2];
        perUser[code].collections[col] = (perUser[code].collections[col] || 0) + 1;
      }
    }
    firestoreSummary[databaseId] = {
      rootCollectionIds: exported.rootCollectionIds,
      documentCount: exported.documents.length,
      countsByCollection: exported.countsByCollection,
      userIds: Object.keys(perUser),
      perUser,
    };
    console.log(`  ${exported.documents.length} documents`);
  }

  const storageDir = path.join(outDir, 'storage');
  fs.mkdirSync(storageDir, { recursive: true });
  console.log(`Listing Storage bucket: ${PRODUCTION_BUCKET}`);
  const listed = await listStorageObjects(accessToken, PRODUCTION_BUCKET);
  const storageManifest = {
    bucket: PRODUCTION_BUCKET,
    ok: listed.ok,
    status: listed.status || 200,
    error: listed.ok ? null : listed.error,
    objects: [],
  };

  if (!listed.ok) {
    console.log(`  Storage list failed (HTTP ${listed.status}). Receipt files not downloaded.`);
  } else {
    console.log(`  ${listed.objects.length} files`);
    for (const obj of listed.objects) {
      const rel = obj.name;
      const dest = path.join(storageDir, rel);
      try {
        const bytes = await downloadStorageObject(accessToken, PRODUCTION_BUCKET, rel, dest);
        storageManifest.objects.push({
          name: rel,
          contentType: obj.contentType || null,
          size: bytes,
          ok: true,
        });
      } catch (err) {
        storageManifest.objects.push({
          name: rel,
          contentType: obj.contentType || null,
          ok: false,
          error: String(err.message || err),
        });
        console.log(`  failed: ${rel}`);
      }
    }
  }
  fs.writeFileSync(path.join(outDir, 'storage-manifest.json'), JSON.stringify(storageManifest, null, 2));

  const metadata = {
    kind: 'rising-amp-production-backup',
    mode: 'read-only',
    sourceProjectId: PRODUCTION_PROJECT,
    createdAt: new Date().toISOString(),
    firestore: firestoreSummary,
    storage: {
      bucket: PRODUCTION_BUCKET,
      listed: listed.ok,
      fileCount: storageManifest.objects.length,
      downloaded: storageManifest.objects.filter((o) => o.ok).length,
      failed: storageManifest.objects.filter((o) => !o.ok).length,
    },
  };
  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  const latest = path.join(__dirname, '..', 'backups', 'latest-production-backup.txt');
  fs.writeFileSync(latest, outDir + '\n');

  console.log('Backup finished.');
  console.log(JSON.stringify({
    outDir,
    firestoreDocuments: Object.fromEntries(
      Object.entries(firestoreSummary).map(([k, v]) => [k, v.documentCount])
    ),
    userIds: firestoreSummary['(default)']?.userIds || [],
    storageDownloaded: metadata.storage.downloaded,
    storageFailed: metadata.storage.failed,
  }, null, 2));
}

main().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
