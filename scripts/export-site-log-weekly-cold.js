#!/usr/bin/env node
/**
 * Throwaway insurance copy of Site Log + Weekly Report data.
 * Reads the existing production backup on disk. Does not touch Firebase.
 *
 * Usage: node scripts/export-site-log-weekly-cold.js
 */

const fs = require('fs');
const path = require('path');

const latestPath = path.join(__dirname, '..', 'backups', 'latest-production-backup.txt');
const backupDir = fs.readFileSync(latestPath, 'utf8').trim();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(__dirname, '..', 'backups', `cold-export-site-log-weekly-${stamp}`);

fs.mkdirSync(outDir, { recursive: true });

const firestore = JSON.parse(fs.readFileSync(path.join(backupDir, 'firestore-default.json'), 'utf8'));
const siteLogDocs = (firestore.documents || []).filter((d) => d.path.includes('/siteLogs/'));
fs.writeFileSync(
  path.join(outDir, 'siteLogs.json'),
  JSON.stringify({ sourceBackup: backupDir, documentCount: siteLogDocs.length, documents: siteLogDocs }, null, 2)
);

const manifest = JSON.parse(fs.readFileSync(path.join(backupDir, 'storage-manifest.json'), 'utf8'));
const media = (manifest.objects || []).filter(
  (o) => o.ok && (o.name.startsWith('siteLogs/') || o.name.startsWith('reports/'))
);

const mediaDir = path.join(outDir, 'files');
const copied = [];
for (const obj of media) {
  const src = path.join(backupDir, 'storage', obj.name);
  const dest = path.join(mediaDir, obj.name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    copied.push(obj.name);
  }
}

const readme = [
  'Site Log and Weekly Report — cold export (throwaway insurance).',
  '',
  'This folder is not re-imported. It exists only so these two features are never truly unrecoverable.',
  `Copied from backup: ${backupDir}`,
  `Created: ${new Date().toISOString()}`,
  `Site log records: ${siteLogDocs.length}`,
  `Photos / report files copied: ${copied.length}`,
  '',
  'Live production was not changed when this folder was created.',
].join('\n');
fs.writeFileSync(path.join(outDir, 'README.txt'), readme + '\n');
fs.writeFileSync(path.join(__dirname, '..', 'backups', 'latest-cold-export-site-log-weekly.txt'), outDir + '\n');

console.log(JSON.stringify({
  outDir,
  siteLogRecords: siteLogDocs.length,
  filesCopied: copied.length,
}, null, 2));
