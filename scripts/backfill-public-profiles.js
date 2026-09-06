#!/usr/bin/env node
/**
 * Additive publicProfiles backfill. Creates missing name-and-photo cards
 * from profiles/{uid}. Does not change existing publicProfiles docs.
 * Never copies mobile, ABN, business name, or address.
 *
 * Usage:
 *   node scripts/backfill-public-profiles.js --dry-run
 *   node scripts/backfill-public-profiles.js --apply --staging
 *   node scripts/backfill-public-profiles.js --apply --production
 *
 * Refuses production unless both --apply and --production are passed.
 *
 * Needed because syncPublicProfile only runs when someone loads or saves a
 * complete profile. Existing family members have private docs and no cards.
 * Run this before production rules, after (or with) the new client.
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

function decodeString(field) {
  if (!field || typeof field !== 'object') return '';
  if (field.stringValue !== undefined) return String(field.stringValue);
  return '';
}

function isComplete(fields) {
  if (!fields) return false;
  if (fields.setupComplete && fields.setupComplete.booleanValue === true) return true;
  if (decodeString(fields.setupComplete) === 'true') return true;
  return Boolean(decodeString(fields.displayName).trim() && decodeString(fields.businessName).trim());
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function toPublicCard(uid, fields) {
  const email = normalizeEmail(decodeString(fields && fields.email));
  if (!uid || !email) return null;
  return {
    uid,
    email,
    displayName: decodeString(fields.displayName).trim(),
    photoUrl: decodeString(fields.photoUrl),
    complete: isComplete(fields),
  };
}

function pickBetter(existing, next) {
  if (!existing) return next;
  if (next.complete && !existing.complete) return next;
  if (existing.complete && !next.complete) return existing;
  if (next.displayName && !existing.displayName) return next;
  return existing;
}

async function listOrEmpty(accessToken, parentName, collectionId) {
  try {
    return await listDocuments(accessToken, parentName, collectionId);
  } catch (error) {
    const message = String(error && error.message);
    if (message.includes(' 404 ') || message.includes('"code":404')) return [];
    throw error;
  }
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
  console.log(args.apply
    ? `BACKFILL publicProfiles (writing ${destination})`
    : `BACKFILL publicProfiles (dry run, ${destination})`);
  if (destination === PRODUCTION_PROJECT) {
    console.log('Destination is PRODUCTION. Staging first, then an explicit yes.');
  }

  const accessToken = await getAccessToken();
  const root = `projects/${destination}/databases/(default)/documents`;
  const profileDocs = await listOrEmpty(accessToken, root, 'profiles');
  const publicDocs = await listOrEmpty(accessToken, root, 'publicProfiles');

  const existing = new Set();
  publicDocs.forEach((doc) => {
    const id = relativeDocPath(doc.name).split('/')[1];
    if (id) existing.add(normalizeEmail(id));
  });

  const byEmail = new Map();
  const skipped = [];
  profileDocs.forEach((doc) => {
    const uid = relativeDocPath(doc.name).split('/')[1];
    const card = toPublicCard(uid, doc.fields || {});
    if (!card) {
      skipped.push({ uid, reason: 'no-email' });
      return;
    }
    byEmail.set(card.email, pickBetter(byEmail.get(card.email), card));
  });

  const planned = [];
  const already = [];
  byEmail.forEach((card) => {
    if (existing.has(card.email)) {
      already.push(card.email);
      return;
    }
    planned.push(card);
  });

  console.log(`Private profiles: ${profileDocs.length}. Public cards already: ${existing.size}.`);
  console.log(`Would create: ${planned.length}. Already present (unchanged): ${already.length}. Skipped (no email): ${skipped.length}.`);
  planned.forEach((card) => {
    console.log(`  create publicProfiles/${card.email}  uid=${card.uid}  name=${card.displayName || '(blank)'}`);
  });
  skipped.forEach((row) => {
    console.log(`  skip profiles/${row.uid} (${row.reason})`);
  });

  if (!args.apply) {
    console.log('Dry run. No writes.');
    return;
  }

  if (planned.length === 0) {
    console.log('Nothing to write.');
    return;
  }

  let wrote = 0;
  for (let i = 0; i < planned.length; i += 400) {
    const group = planned.slice(i, i + 400);
    const writes = group.map((card) => ({
      update: {
        name: docResourceName(destination, '(default)', `publicProfiles/${card.email}`),
        fields: {
          uid: { stringValue: card.uid },
          email: { stringValue: card.email },
          displayName: { stringValue: card.displayName },
          photoUrl: { stringValue: card.photoUrl },
        },
      },
      currentDocument: { exists: false },
    }));
    await batchWrite(accessToken, destination, '(default)', writes);
    wrote += group.length;
    console.log(`  wrote ${wrote}/${planned.length}`);
  }

  console.log('Backfill finished.', { wrote, destination });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
