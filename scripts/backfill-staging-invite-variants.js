#!/usr/bin/env node
/**
 * Store Gmail dotted/undotted variants on staging invite lists.
 * Staging only. Lets an invited Gmail sign in even if Google returns a
 * slightly different spelling of the same address.
 *
 * Usage: node scripts/backfill-staging-invite-variants.js --apply
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
  return null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function canonicalEmail(email) {
  const lowered = normalizeEmail(email);
  const at = lowered.lastIndexOf('@');
  if (at < 1) return lowered;
  let local = lowered.slice(0, at);
  let domain = lowered.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '').replace(/\+.*$/, '');
  }
  return `${local}@${domain}`;
}

function emailInviteVariants(email) {
  const lowered = normalizeEmail(email);
  const canonical = canonicalEmail(lowered);
  if (!lowered.includes('@')) return [];
  return [lowered, canonical].filter(Boolean);
}

function expandList(emails) {
  const merged = [];
  const seen = new Set();
  for (const email of emails || []) {
    for (const variant of emailInviteVariants(email)) {
      if (seen.has(variant)) continue;
      seen.add(variant);
      merged.push(variant);
    }
  }
  return merged;
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

  const orgEmails = expandList(decodeValue(orgRes.json.fields && orgRes.json.fields.invitedEmails) || []);
  const writes = [
    {
      update: {
        name: docResourceName(STAGING_PROJECT, '(default)', `organizations/${ORG_ID}`),
        fields: {
          invitedEmails: stringArray(orgEmails),
        },
      },
      updateMask: { fieldPaths: ['invitedEmails'] },
    },
  ];

  const rootName = `projects/${STAGING_PROJECT}/databases/(default)/documents/organizations/${ORG_ID}`;
  const projects = await listDocuments(accessToken, rootName, 'projects');
  for (const projectDoc of projects) {
    const existing = decodeValue(projectDoc.fields && projectDoc.fields.invitedEmails) || [];
    writes.push({
      update: {
        name: docResourceName(STAGING_PROJECT, '(default)', relativeDocPath(projectDoc.name)),
        fields: {
          invitedEmails: stringArray(expandList(existing)),
        },
      },
      updateMask: { fieldPaths: ['invitedEmails'] },
    });
  }

  await batchWrite(accessToken, STAGING_PROJECT, '(default)', writes);
  console.log(JSON.stringify({
    destination: STAGING_PROJECT,
    orgInviteSlots: orgEmails.length,
    projectsUpdated: projects.length,
  }, null, 2));
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
