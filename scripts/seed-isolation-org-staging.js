#!/usr/bin/env node
/**
 * Create the Phase 8 isolation org on STAGING only.
 * Invites the owner's second account so they can prove they cannot
 * read Opal jobs. Does not write to production. Does not add this
 * email to Opal.
 *
 * Usage:
 *   node scripts/seed-isolation-org-staging.js --dry-run
 *   node scripts/seed-isolation-org-staging.js --apply
 */

const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  getAccessToken,
  docResourceName,
  batchWrite,
} = require('./lib/phase1Firebase');

const ORG_ID = 'phase8-isolation';
const OWNER_EMAIL = 'z5476228@ad.unsw.edu.au';

function parseArgs(argv) {
  return { apply: argv.includes('--apply') };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Refusing to run: staging and production IDs match.');
  }

  const now = new Date().toISOString();
  const docPath = `organizations/${ORG_ID}`;

  console.log(apply ? 'SEED ISOLATION ORG (writing staging)' : 'SEED ISOLATION ORG (dry run)');
  console.log(`Destination: ${STAGING_PROJECT}`);
  console.log(`Production ${PRODUCTION_PROJECT} will not be touched.`);
  console.log(`Org id: ${ORG_ID}`);
  console.log('Invited emails: 1 (second account only; not added to Opal)');

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
          name: { stringValue: 'Phase 8 isolation' },
          ownerEmail: { stringValue: OWNER_EMAIL },
          invitedEmails: {
            arrayValue: { values: [{ stringValue: OWNER_EMAIL }] },
          },
          createdAt: { timestampValue: now },
          updatedAt: { timestampValue: now },
        },
      },
      updateMask: {
        fieldPaths: ['name', 'ownerEmail', 'invitedEmails', 'createdAt', 'updatedAt'],
      },
    },
  ]);

  console.log(JSON.stringify({ apply: true, destination: STAGING_PROJECT, orgId: ORG_ID }, null, 2));
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
