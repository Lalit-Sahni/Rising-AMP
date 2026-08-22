#!/usr/bin/env node
/**
 * Put the owner Gmail on each staging job list's invitedEmails.
 * Staging only. Needed before per-project invite rules go live.
 *
 * Usage: node scripts/backfill-staging-project-invites.js --apply
 */

const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  getAccessToken,
  googleFetch,
  documentsBase,
  docResourceName,
  listDocuments,
  relativeDocPath,
  batchWrite,
} = require('./lib/phase1Firebase');

const ORG_ID = 'opal-ss-constructions';

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeValue);
  if (value.mapValue) {
    const out = {};
    for (const [key, nested] of Object.entries(value.mapValue.fields || {})) {
      out[key] = decodeValue(nested);
    }
    return out;
  }
  return null;
}

function stringArray(values) {
  return {
    arrayValue: {
      values: values.map((value) => ({ stringValue: value })),
    },
  };
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('Refusing to run without --apply (staging write).');
  }
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Refusing: staging and production IDs match.');
  }

  const accessToken = await getAccessToken();
  const orgUrl = `${documentsBase(STAGING_PROJECT, '(default)')}/organizations/${ORG_ID}`;
  const orgRes = await googleFetch(orgUrl, { accessToken });
  if (!orgRes.ok) throw new Error(`Could not read staging org (${orgRes.status})`);
  const ownerEmail = String(decodeValue(orgRes.json.fields && orgRes.json.fields.ownerEmail) || '')
    .trim()
    .toLowerCase();
  if (!ownerEmail.includes('@')) throw new Error('Staging org is missing ownerEmail.');

  const rootName = `projects/${STAGING_PROJECT}/databases/(default)/documents/organizations/${ORG_ID}`;
  const projects = await listDocuments(accessToken, rootName, 'projects');
  const writes = projects.map((projectDoc) => {
    const existing = decodeValue(projectDoc.fields && projectDoc.fields.invitedEmails) || [];
    const merged = Array.from(new Set([...existing.map((e) => String(e).toLowerCase()), ownerEmail]));
    return {
      update: {
        name: docResourceName(STAGING_PROJECT, '(default)', relativeDocPath(projectDoc.name)),
        fields: {
          invitedEmails: stringArray(merged),
        },
      },
      updateMask: { fieldPaths: ['invitedEmails'] },
    };
  });

  if (writes.length === 0) throw new Error('No staging projects found.');
  await batchWrite(accessToken, STAGING_PROJECT, '(default)', writes);
  console.log(JSON.stringify({
    destination: STAGING_PROJECT,
    projectsUpdated: writes.length,
    ownerAdded: true,
  }, null, 2));
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
