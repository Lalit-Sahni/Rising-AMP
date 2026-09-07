#!/usr/bin/env node
/**
 * Re-extract text from existing job files on staging (embedded PDF text
 * and text/plain only). Same helpers as extractJobFileText. No OCR. No OpenAI.
 *
 * Dry-run is the default. Writes require --apply --staging.
 * Refuses --production. Never deletes files.
 *
 *   node scripts/reextract-job-file-text.js --dry-run --staging
 *   node scripts/reextract-job-file-text.js --apply --staging
 */

const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  STAGING_BUCKET,
  getAccessToken,
  googleFetch,
  listDocuments,
  relativeDocPath,
  docResourceName,
  batchWrite,
} = require('./lib/phase1Firebase');
const {
  CONTENT_COLLECTION,
  CONTENT_DOC_ID,
  TEXT_CHAR_CAP,
  buildContentPayload,
  extractFromBytes,
  isSafeStoragePath,
  needsObjectBytes,
  shouldSkipWrite,
} = require('../functions/lib/extractJobFileText');
const {
  OPAL_ORG_ID,
  parseReextractTarget,
  planReextract,
} = require('./lib/reextractJobFileText');

function parseArgs(argv) {
  return parseReextractTarget(argv, {
    stagingProject: STAGING_PROJECT,
    productionProject: PRODUCTION_PROJECT,
  });
}

function decodeValue(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return new Date(value.timestampValue);
  if (value.mapValue) {
    const out = {};
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

function decodeFields(doc) {
  const data = {};
  Object.entries(doc.fields || {}).forEach(([key, value]) => {
    data[key] = decodeValue(value);
  });
  const parts = relativeDocPath(doc.name).split('/');
  data.id = parts[parts.length - 1];
  return data;
}

function encodeValue(value) {
  if (value == null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { integerValue: '0' };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    const fields = {};
    Object.entries(value).forEach(([key, nested]) => {
      fields[key] = encodeValue(nested);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

async function listOrEmpty(accessToken, parentName, collectionId) {
  try {
    return await listDocuments(accessToken, parentName, collectionId);
  } catch (error) {
    const message = String(error && error.message);
    if (message.includes(' 404 ') || message.includes('"code":5')) return [];
    throw error;
  }
}

async function getDocumentOrNull(accessToken, name) {
  const url = `https://firestore.googleapis.com/v1/${name}`;
  const { ok, status, json } = await googleFetch(url, { accessToken });
  if (status === 404) return null;
  if (!ok) {
    throw new Error(`getDocument ${status} ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}

async function downloadBytes(accessToken, bucket, objectName) {
  const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`download ${objectName} HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function loadFiles(accessToken, projectId) {
  const root = `projects/${projectId}/databases/(default)/documents`;
  const orgs = await listDocuments(accessToken, root, 'organizations');
  const files = [];
  for (const org of orgs) {
    const orgId = relativeDocPath(org.name).split('/')[1];
    if (orgId !== OPAL_ORG_ID) {
      console.log(`Skipping org ${orgId}`);
      continue;
    }
    const jobs = await listOrEmpty(accessToken, org.name, 'projects');
    for (const job of jobs) {
      const jobId = relativeDocPath(job.name).split('/')[3];
      const jobName = decodeValue(job.fields && job.fields.name) || jobId;
      const fileDocs = await listOrEmpty(accessToken, job.name, 'files');
      for (const fileDoc of fileDocs) {
        const data = decodeFields(fileDoc);
        const contentName = `${fileDoc.name}/${CONTENT_COLLECTION}/${CONTENT_DOC_ID}`;
        const contentDoc = await getDocumentOrNull(accessToken, contentName);
        const content = contentDoc ? decodeFields(contentDoc) : null;
        files.push({
          orgId,
          jobId,
          jobName,
          fileId: data.id,
          name: data.name || data.id,
          contentType: data.contentType || '',
          storagePath: data.storagePath || '',
          content: content
            ? { textStatus: content.textStatus, charCount: content.charCount }
            : null,
        });
      }
    }
  }
  return files;
}

function printPlan(plan) {
  console.log(`scanned: ${plan.scanned}`);
  console.log(`skipped image: ${plan.skipCounts.image || 0}`);
  console.log(`skipped unsupported: ${plan.skipCounts.unsupported || 0}`);
  console.log(`skipped already ok: ${plan.skipCounts['already ok'] || 0}`);
  console.log(`planned writes: ${plan.writeCount}`);
  plan.planned.forEach((row) => {
    console.log(`  ${row.jobName} ${row.fileId} ${row.name} (${row.contentType}) [${row.reason}]`);
  });
}

function contentWrite(projectId, row, payload) {
  const fields = {};
  Object.entries(payload).forEach(([key, value]) => {
    fields[key] = encodeValue(value);
  });
  return {
    update: {
      name: docResourceName(
        projectId,
        '(default)',
        `organizations/${row.orgId}/projects/${row.jobId}/files/${row.fileId}/${CONTENT_COLLECTION}/${CONTENT_DOC_ID}`,
      ),
      fields,
    },
  };
}

async function extractRow(accessToken, bucket, row) {
  const FieldValue = { serverTimestamp: () => new Date() };
  let extracted;
  if (!needsObjectBytes(row.contentType)) {
    extracted = await extractFromBytes(row.contentType, Buffer.alloc(0));
  } else if (!isSafeStoragePath(row.orgId, row.jobId, row.fileId, row.storagePath)) {
    extracted = {
      text: '',
      textStatus: 'error',
      truncated: false,
      charCount: 0,
      contentType: row.contentType,
    };
  } else {
    const bytes = await downloadBytes(accessToken, bucket, row.storagePath);
    extracted = await extractFromBytes(row.contentType, bytes);
  }
  return buildContentPayload(extracted, FieldValue);
}

async function applyPlan(accessToken, projectId, bucket, plan) {
  const writes = [];
  for (const row of plan.planned) {
    const payload = await extractRow(accessToken, bucket, row);
    if (shouldSkipWrite(row.content, payload)) {
      console.log(`  skip idempotent ${row.fileId}`);
      continue;
    }
    writes.push(contentWrite(projectId, row, payload));
    console.log(`  extracted ${row.fileId} ${payload.textStatus} ${payload.charCount} chars`);
  }
  const chunkSize = 50;
  for (let i = 0; i < writes.length; i += chunkSize) {
    await batchWrite(accessToken, projectId, '(default)', writes.slice(i, i + chunkSize));
  }
  return { writes: writes.length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.destination === PRODUCTION_PROJECT) {
    throw new Error('Job-file re-extract refuses production. Staging only.');
  }

  const mode = args.apply ? 'WRITE' : 'DRY RUN';
  console.log(`Job-file re-extract (${mode}, ${args.destination})`);
  console.log(`Org ${OPAL_ORG_ID} only. PDF / text/plain. No OCR. No OpenAI. Cap ${TEXT_CHAR_CAP}.`);

  const accessToken = await getAccessToken();
  const files = await loadFiles(accessToken, args.destination);
  const plan = planReextract(files);
  printPlan(plan);

  if (!args.apply) {
    console.log('Dry run. Re-run with --apply --staging to write.');
    return;
  }

  if (plan.writeCount === 0) {
    console.log('Nothing to write.');
    return;
  }

  const result = await applyPlan(accessToken, args.destination, STAGING_BUCKET, plan);
  console.log(`Wrote ${result.writes} content/text document(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
