#!/usr/bin/env node
/**
 * Production cutover: seed the family org and COPY the two real job lists
 * under organizations/opal-ss-constructions.
 *
 * Reads latest tracker data from production PIN folders.
 * Copies job names + per-job invitedEmails from staging (localhost invites).
 * Does not delete old users/{code} trees. Does not merge the two jobs.
 *
 * Usage:
 *   node scripts/cutover-production-org.js
 *   node scripts/cutover-production-org.js --apply --production
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
    production: argv.includes('--production'),
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
      values: values.map((value) => ({ stringValue: String(value) })),
    },
  };
}

function mapValue(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj || {})) {
    fields[key] = { stringValue: String(value) };
  }
  return { mapValue: { fields } };
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
  const { apply, production } = parseArgs(process.argv.slice(2));
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Refusing to run: staging and production IDs match.');
  }
  if (apply && !production) {
    throw new Error('Refusing to write to production without both --apply and --production.');
  }

  const { ownerEmail, realAccessCodes } = loadLocalNotes();
  const destination = PRODUCTION_PROJECT;

  console.log(apply ? 'CUTOVER PRODUCTION (writing copies)' : 'CUTOVER PRODUCTION (dry run)');
  console.log(`Destination: ${destination}`);
  console.log(`Invite names copied from staging: ${STAGING_PROJECT}`);
  console.log('Old PIN folders will not be deleted.');
  console.log('Site Log rows in the old folders will not be deleted.');

  const accessToken = await getAccessToken();
  const stagingOrgDoc = await getDocument(accessToken, STAGING_PROJECT, `organizations/${ORG_ID}`);
  if (!stagingOrgDoc) {
    throw new Error('Staging organisation is missing. Stop. Do not invent a live org.');
  }

  const stagingOrg = decodeFields(stagingOrgDoc.fields);
  const workspaceIds = Array.isArray(stagingOrg.legacyWorkspaceIds)
    ? stagingOrg.legacyWorkspaceIds.map(String)
    : [];
  if (!sameSet(workspaceIds, realAccessCodes)) {
    throw new Error('Staging org job lists do not match the local family notes. Stopping.');
  }
  if (String(stagingOrg.ownerEmail || '').toLowerCase() !== ownerEmail) {
    throw new Error('Staging org owner email does not match the local family notes. Stopping.');
  }

  const stagingInvited = (stagingOrg.invitedEmails || []).map((value) => String(value).trim().toLowerCase())
    .filter(Boolean);
  if (!stagingInvited.includes(ownerEmail)) {
    throw new Error('Owner Gmail is missing from the staging invite list. Stopping.');
  }

  const savedNames = stagingOrg.legacyWorkspaceNames && typeof stagingOrg.legacyWorkspaceNames === 'object'
    ? stagingOrg.legacyWorkspaceNames
    : {};

  const rootName = `projects/${destination}/databases/(default)/documents`;
  const allUserDocs = await listDocuments(accessToken, rootName, 'users');
  const leftoverCount = allUserDocs.filter((doc) => {
    const rel = relativeDocPath(doc.name);
    const id = rel.split('/')[1];
    return !workspaceIds.includes(id);
  }).length;

  const now = new Date().toISOString();
  const writes = [
    {
      update: {
        name: docResourceName(destination, '(default)', `organizations/${ORG_ID}`),
        fields: {
          name: { stringValue: String(stagingOrg.name || 'Opal SS Constructions') },
          ownerEmail: { stringValue: ownerEmail },
          invitedEmails: stringArray(stagingInvited),
          legacyWorkspaceIds: stringArray(workspaceIds),
          legacyWorkspaceNames: mapValue(savedNames),
          createdAt: { timestampValue: stagingOrg.createdAt || now },
          updatedAt: { timestampValue: now },
          cutoverAt: { timestampValue: now },
        },
      },
    },
  ];

  const jobLists = [];

  for (const workspaceId of workspaceIds) {
    const userDoc = await getDocument(accessToken, destination, `users/${workspaceId}`);
    if (!userDoc) {
      throw new Error('A real job-list folder is missing on production. Stopping.');
    }
    const { records, counts, nestedWarnings } = await walkTree(
      accessToken,
      `${rootName}/users/${encodeURIComponent(workspaceId)}`
    );
    const projectId = projectIdFor(workspaceId);
    const stagingProject = await getDocument(
      accessToken,
      STAGING_PROJECT,
      `organizations/${ORG_ID}/projects/${projectId}`
    );
    const stagingProjectFields = stagingProject ? decodeFields(stagingProject.fields) : {};
    const name = (stagingProjectFields.name && String(stagingProjectFields.name).trim())
      || (savedNames[workspaceId] && String(savedNames[workspaceId]).trim())
      || `Job list ${jobLists.length + 1}`;
    const invitedEmails = (stagingProjectFields.invitedEmails || [ownerEmail])
      .map((value) => String(value).trim().toLowerCase())
      .filter(Boolean);
    if (!invitedEmails.includes(ownerEmail)) {
      invitedEmails.unshift(ownerEmail);
    }

    const projectFields = {
      ...(userDoc.fields || {}),
      name: { stringValue: name },
      invitedEmails: stringArray(invitedEmails),
      orgId: { stringValue: ORG_ID },
      legacyWorkspaceId: { stringValue: workspaceId },
      migratedAt: { timestampValue: now },
    };

    writes.push({
      update: {
        name: docResourceName(destination, '(default)', `organizations/${ORG_ID}/projects/${projectId}`),
        fields: projectFields,
      },
    });

    for (const record of records) {
      writes.push({
        update: {
          name: docResourceName(
            destination,
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
      inviteSlots: invitedEmails.length,
      documentCount: records.length + 1,
      collections: counts,
      nestedWarnings,
    });
  }

  const summary = {
    dryRun: !apply,
    destination,
    orgId: ORG_ID,
    orgName: stagingOrg.name || 'Opal SS Constructions',
    orgInviteSlots: stagingInvited.length,
    jobLists: jobLists.map((row) => ({
      name: row.name,
      expenses: row.collections.expenses || 0,
      invoices: row.collections.invoices || 0,
      inviteSlots: row.inviteSlots,
      otherCollections: Object.keys(row.collections)
        .filter((key) => key !== 'expenses' && key !== 'invoices')
        .sort(),
      documentsToCopy: row.documentCount,
      nestedWarnings: row.nestedWarnings,
    })),
    leftoverPinFoldersLeftUntouched: leftoverCount,
    wouldDeleteOldFolders: false,
    wouldMergeTheTwoLists: false,
    wouldDeleteSiteLogs: false,
    copiesToWrite: writes.length,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!apply) {
    console.log('No writes. Re-run with --apply --production after this log looks right.');
    return;
  }

  let wrote = 0;
  for (const group of chunk(writes, 400)) {
    await batchWrite(accessToken, destination, '(default)', group);
    wrote += group.length;
    console.log(`  copied ${wrote}/${writes.length}`);
  }

  console.log(JSON.stringify({ apply: true, destination, copied: wrote }, null, 2));
}

main().catch((err) => {
  console.error('Cutover failed:', err);
  process.exit(1);
});
