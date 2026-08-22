#!/usr/bin/env node
/**
 * Promote the two real family workspaces into the staging organisation.
 * COPY, do not delete. Leaves leftover PIN folders untouched.
 * Default is --dry-run. Refuses to run against production.
 *
 * Each renamed job list becomes one project under the org. Invoice-name
 * spellings are not turned into extra projects.
 *
 * Usage:
 *   node scripts/migrate-staging-org.js
 *   node scripts/migrate-staging-org.js --dry-run
 *   node scripts/migrate-staging-org.js --apply
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  getAccessToken,
  googleFetch,
  documentsBase,
  docResourceName,
  listCollectionIds,
  listDocuments,
  relativeDocPath,
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
    throw new Error('Missing .phase1-local.json (gitignored).');
  }
  const notes = JSON.parse(fs.readFileSync(LOCAL_NOTES, 'utf8'));
  const ownerEmail = String(notes.ownerEmail || '').trim().toLowerCase();
  const realAccessCodes = (notes.realAccessCodes || [])
    .map((code) => String(code).trim())
    .filter(Boolean);
  if (!ownerEmail || realAccessCodes.length === 0) {
    throw new Error('.phase1-local.json is missing ownerEmail or realAccessCodes.');
  }
  return { ownerEmail, realAccessCodes };
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue) {
    return (value.arrayValue.values || []).map(decodeValue);
  }
  if (value.mapValue) {
    const out = {};
    for (const [key, nested] of Object.entries(value.mapValue.fields || {})) {
      out[key] = decodeValue(nested);
    }
    return out;
  }
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    out[key] = decodeValue(value);
  }
  return out;
}

function projectIdFor(workspaceId) {
  const digest = crypto.createHash('sha256').update(`rising-amp:${workspaceId}`).digest('hex').slice(0, 16);
  return `job-${digest}`;
}

function sameSet(a, b) {
  const left = [...a].map(String).sort();
  const right = [...b].map(String).sort();
  return left.length === right.length && left.every((value, i) => value === right[i]);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, size + i));
  return out;
}

function stringArray(values) {
  return {
    arrayValue: {
      values: values.map((value) => ({ stringValue: value })),
    },
  };
}

async function getDocument(accessToken, projectId, docPath) {
  const url = `${documentsBase(projectId, '(default)')}/${docPath}`;
  const { ok, status, json } = await googleFetch(url, { accessToken });
  if (status === 404) return null;
  if (!ok) throw new Error(`getDocument ${docPath} ${status} ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

async function walkTree(accessToken, parentName) {
  const records = [];
  const counts = {};
  const nestedWarnings = [];

  const cols = await listCollectionIds(accessToken, parentName);
  for (const collectionId of cols) {
    const docs = await listDocuments(accessToken, parentName, collectionId);
    counts[collectionId] = docs.length;
    for (const doc of docs) {
      records.push({
        relative: relativeDocPath(doc.name),
        fields: doc.fields || {},
      });
    }
    if (docs[0]) {
      const nested = await listCollectionIds(accessToken, docs[0].name);
      if (nested.length) {
        nestedWarnings.push(`${collectionId}: ${nested.join(', ')}`);
        for (const nestedId of nested) {
          const nestedDocs = await listDocuments(accessToken, docs[0].name, nestedId);
          for (const nestedDoc of nestedDocs) {
            records.push({
              relative: relativeDocPath(nestedDoc.name),
              fields: nestedDoc.fields || {},
            });
          }
        }
      }
    }
  }

  return { records, counts, nestedWarnings };
}

function rewritePath(relative, workspaceId, projectId) {
  const prefix = `users/${workspaceId}`;
  if (relative === prefix) {
    return `organizations/${ORG_ID}/projects/${projectId}`;
  }
  if (!relative.startsWith(`${prefix}/`)) {
    throw new Error(`Unexpected path outside workspace: ${relative.split('/')[0]}`);
  }
  return `organizations/${ORG_ID}/projects/${projectId}/${relative.slice(prefix.length + 1)}`;
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Refusing to run: staging and production IDs match.');
  }

  const { ownerEmail, realAccessCodes } = loadLocalNotes();

  console.log(apply ? 'MIGRATE STAGING ORG (writing copies)' : 'MIGRATE STAGING ORG (dry run)');
  console.log(`Destination: ${STAGING_PROJECT}`);
  console.log(`Production ${PRODUCTION_PROJECT} will not be touched.`);
  console.log('Old PIN folders will not be deleted.');

  const accessToken = await getAccessToken();
  const orgDoc = await getDocument(accessToken, STAGING_PROJECT, `organizations/${ORG_ID}`);
  if (!orgDoc) {
    throw new Error('Organisation document is missing on staging. Re-run scripts/seed-staging-org.js --apply.');
  }

  const org = decodeFields(orgDoc.fields);
  const workspaceIds = Array.isArray(org.legacyWorkspaceIds) ? org.legacyWorkspaceIds.map(String) : [];
  if (!sameSet(workspaceIds, realAccessCodes)) {
    throw new Error('Staging org job lists do not match the local family notes. Stopping.');
  }
  if (String(org.ownerEmail || '').toLowerCase() !== ownerEmail) {
    throw new Error('Staging org owner email does not match the local family notes. Stopping.');
  }

  const rootName = `projects/${STAGING_PROJECT}/databases/(default)/documents`;
  const allUserDocs = await listDocuments(accessToken, rootName, 'users');
  const leftoverCount = allUserDocs.filter((doc) => {
    const rel = relativeDocPath(doc.name);
    const id = rel.split('/')[1];
    return !workspaceIds.includes(id);
  }).length;

  const savedNames = org.legacyWorkspaceNames && typeof org.legacyWorkspaceNames === 'object'
    ? org.legacyWorkspaceNames
    : {};

  const jobLists = [];
  const writes = [];

  for (const workspaceId of workspaceIds) {
    const userDoc = await getDocument(accessToken, STAGING_PROJECT, `users/${workspaceId}`);
    const { records, counts, nestedWarnings } = await walkTree(
      accessToken,
      `${rootName}/users/${encodeURIComponent(workspaceId)}`
    );
    const projectId = projectIdFor(workspaceId);
    const name = (savedNames[workspaceId] && String(savedNames[workspaceId]).trim())
      || `Job list ${jobLists.length + 1}`;

    const projectFields = {
      ...(userDoc && userDoc.fields ? userDoc.fields : {}),
      name: { stringValue: name },
      invitedEmails: stringArray([ownerEmail]),
      orgId: { stringValue: ORG_ID },
      legacyWorkspaceId: { stringValue: workspaceId },
      migratedAt: { timestampValue: new Date().toISOString() },
    };

    writes.push({
      update: {
        name: docResourceName(STAGING_PROJECT, '(default)', `organizations/${ORG_ID}/projects/${projectId}`),
        fields: projectFields,
      },
    });

    for (const record of records) {
      writes.push({
        update: {
          name: docResourceName(
            STAGING_PROJECT,
            '(default)',
            rewritePath(record.relative, workspaceId, projectId)
          ),
          fields: record.fields,
        },
      });
    }

    jobLists.push({
      name,
      projectId,
      documentCount: records.length + 1,
      collections: counts,
      nestedWarnings,
    });
  }

  const summary = {
    dryRun: !apply,
    destination: STAGING_PROJECT,
    orgId: ORG_ID,
    orgName: org.name || 'Opal SS Constructions',
    invitedEmails: 1,
    jobLists: jobLists.map((row) => ({
      name: row.name,
      expenses: row.collections.expenses || 0,
      invoices: row.collections.invoices || 0,
      otherCollections: Object.keys(row.collections)
        .filter((key) => key !== 'expenses' && key !== 'invoices')
        .sort(),
      documentsToCopy: row.documentCount,
      nestedWarnings: row.nestedWarnings,
    })),
    leftoverPinFoldersLeftUntouched: leftoverCount,
    wouldDeleteOldFolders: false,
    wouldMergeTheTwoLists: false,
    copiesToWrite: writes.length,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log('No writes. Re-run with --apply after Lalit says this log looks right.');
    return;
  }

  let wrote = 0;
  for (const group of chunk(writes, 400)) {
    await batchWrite(accessToken, STAGING_PROJECT, '(default)', group);
    wrote += group.length;
    console.log(`  copied ${wrote}/${writes.length}`);
  }

  console.log(JSON.stringify({ apply: true, destination: STAGING_PROJECT, copied: wrote }, null, 2));
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
