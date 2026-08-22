#!/usr/bin/env node
/**
 * Seed the family organisation + owner invite on STAGING only.
 * Reads emails/workspace ids from gitignored .phase1-local.json.
 * Does not write to production. Does not move tracker data.
 *
 * Usage:
 *   node scripts/seed-staging-org.js --dry-run
 *   node scripts/seed-staging-org.js --apply
 */

const fs = require('fs');
const path = require('path');
const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  getAccessToken,
  docResourceName,
  batchWrite,
} = require('./lib/phase1Firebase');

const ORG_ID = 'opal-ss-constructions';
const LOCAL_NOTES = path.join(__dirname, '..', '.phase1-local.json');

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
  };
}

function loadLocalNotes() {
  if (!fs.existsSync(LOCAL_NOTES)) {
    throw new Error('Missing .phase1-local.json (gitignored). It must contain ownerEmail and realAccessCodes.');
  }
  const notes = JSON.parse(fs.readFileSync(LOCAL_NOTES, 'utf8'));
  const ownerEmail = String(notes.ownerEmail || '').trim().toLowerCase();
  const realAccessCodes = (notes.realAccessCodes || [])
    .map((code) => String(code).trim())
    .filter(Boolean);
  if (!ownerEmail || !ownerEmail.includes('@')) {
    throw new Error('.phase1-local.json is missing a valid ownerEmail.');
  }
  if (realAccessCodes.length === 0) {
    throw new Error('.phase1-local.json is missing realAccessCodes.');
  }
  return { ownerEmail, realAccessCodes };
}

function stringArray(values) {
  return {
    arrayValue: {
      values: values.map((value) => ({ stringValue: value })),
    },
  };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Refusing to run: staging and production IDs match.');
  }

  const { ownerEmail, realAccessCodes } = loadLocalNotes();
  const now = new Date().toISOString();
  const docPath = `organizations/${ORG_ID}`;

  console.log(apply ? 'SEED STAGING ORG (writing)' : 'SEED STAGING ORG (dry run)');
  console.log(`Destination: ${STAGING_PROJECT}`);
  console.log(`Production ${PRODUCTION_PROJECT} will not be touched.`);
  console.log(`Org id: ${ORG_ID}`);
  console.log(`Invited emails: 1 (owner only)`);
  console.log(`Legacy workspaces: ${realAccessCodes.length}`);

  if (!apply) {
    console.log(JSON.stringify({ dryRun: true, destination: STAGING_PROJECT, orgId: ORG_ID }, null, 2));
    return;
  }

  const accessToken = await getAccessToken();
  await batchWrite(accessToken, STAGING_PROJECT, '(default)', [
    {
      update: {
        name: docResourceName(STAGING_PROJECT, '(default)', docPath),
        fields: {
          name: { stringValue: 'Opal SS Constructions' },
          ownerEmail: { stringValue: ownerEmail },
          invitedEmails: stringArray([ownerEmail]),
          legacyWorkspaceIds: stringArray(realAccessCodes),
          createdAt: { timestampValue: now },
          updatedAt: { timestampValue: now },
        },
      },
      updateMask: {
        fieldPaths: [
          'name',
          'ownerEmail',
          'invitedEmails',
          'legacyWorkspaceIds',
          'createdAt',
          'updatedAt',
        ],
      },
    },
  ]);

  console.log(JSON.stringify({ apply: true, destination: STAGING_PROJECT, orgId: ORG_ID }, null, 2));
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
