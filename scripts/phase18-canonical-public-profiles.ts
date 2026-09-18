#!/usr/bin/env npx tsx
/**
 * Propose copying publicProfiles cards onto canonical Gmail ids.
 * Dry-run is the default. Writes nothing unless --apply is passed on staging.
 *
 *   npx esbuild scripts/phase18-canonical-public-profiles.ts --bundle --platform=node --format=cjs --outfile=/tmp/phase18-canonical-profiles.cjs
 *   node /tmp/phase18-canonical-profiles.cjs --staging
 *   node /tmp/phase18-canonical-profiles.cjs --apply --staging
 *
 * Refuses --production without --i-mean-production. Never --apply on production.
 * Never copies mobile, ABN, address, or business name.
 */

import {
  formatCanonicalProfilePlan,
  parseCanonicalProfileArgs,
  planCanonicalPublicProfileMoves,
} from '../src/domain/canonicalPublicProfiles';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fb = require('./lib/phase1Firebase');

function decodeValue(value: any): any {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return new Date(value.timestampValue);
  if (value.mapValue) {
    const out: Record<string, unknown> = {};
    Object.entries(value.mapValue.fields || {}).forEach(([key, nested]) => {
      out[key] = decodeValue(nested);
    });
    return out;
  }
  if (value.arrayValue && Array.isArray(value.arrayValue.values)) {
    return value.arrayValue.values.map(decodeValue);
  }
  return null;
}

function decodeDoc(doc: any): Record<string, unknown> {
  const parts = String(doc.name || '').split('/');
  const out: Record<string, unknown> = { id: parts[parts.length - 1] };
  Object.entries(doc.fields || {}).forEach(([key, value]) => {
    out[key] = decodeValue(value);
  });
  return out;
}

async function main() {
  const flags = parseCanonicalProfileArgs(process.argv.slice(2));
  const projectId = flags.production ? fb.PRODUCTION_PROJECT : fb.STAGING_PROJECT;
  const accessToken = await fb.getAccessToken();
  const listed = await fb.listDocuments(
    accessToken,
    `projects/${projectId}/databases/(default)/documents`,
    'publicProfiles',
  );
  const rows = (listed || []).map((doc: any) => {
    const data = decodeDoc(doc);
    return {
      id: String(data.id || ''),
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      photoUrl: data.photoUrl,
    };
  });
  const plans = planCanonicalPublicProfileMoves(rows);
  const copies = plans.filter((row) => row.action === 'copy');
  console.log(`publicProfiles canonical-id backfill  ${flags.production ? 'production' : 'staging'}`);
  console.log(formatCanonicalProfilePlan(plans));
  console.log('Source dotted cards are left in place. Lookups try both ids.');
  console.log('Private fields are never copied.');

  if (!flags.apply) {
    console.log(`Dry-run. ${copies.length} copy(ies) proposed. 0 write(s).`);
    return;
  }

  if (copies.length === 0) {
    console.log('Nothing to write.');
    return;
  }

  let wrote = 0;
  for (let i = 0; i < copies.length; i += 400) {
    const group = copies.slice(i, i + 400);
    const writes = group.map((row) => ({
      update: {
        name: fb.docResourceName(projectId, '(default)', `publicProfiles/${row.toId}`),
        fields: {
          uid: { stringValue: row.card.uid },
          email: { stringValue: row.card.email },
          displayName: { stringValue: row.card.displayName },
          photoUrl: { stringValue: row.card.photoUrl },
        },
      },
      currentDocument: { exists: false },
    }));
    await fb.batchWrite(accessToken, projectId, '(default)', writes);
    wrote += group.length;
    console.log(`  wrote ${wrote}/${copies.length}`);
  }
  console.log(`Wrote ${wrote} publicProfiles card(s).`);
}

const isDirect = typeof require !== 'undefined' && require.main === module;
if (isDirect) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { main };
