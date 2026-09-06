'use strict';

const { isSafeProjectId } = require('./emailMatch');

const TEXT_CHAR_CAP = 80_000;
const CONTENT_COLLECTION = 'content';
const CONTENT_DOC_ID = 'text';
const TEXT_STATUSES = ['ok', 'truncated', 'none', 'unsupported', 'error'];

const IMAGE_NONE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
]);

function isSafeOrgId(orgId) {
  return /^[a-z0-9-]{3,80}$/.test(String(orgId || ''));
}

function isSafeFileId(fileId) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(String(fileId || ''));
}

function normalizedContentType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function isSafeStoragePath(orgId, jobId, fileId, storagePath) {
  const path = String(storagePath || '');
  if (!path || path.includes('..') || path.includes('\\') || path.startsWith('/')) {
    return false;
  }
  const prefix = `files/${orgId}/${jobId}/${fileId}/`;
  return path.startsWith(prefix) && path.length > prefix.length;
}

function contentRef(db, orgId, jobId, fileId) {
  return db
    .collection('organizations')
    .doc(orgId)
    .collection('projects')
    .doc(jobId)
    .collection('files')
    .doc(fileId)
    .collection(CONTENT_COLLECTION)
    .doc(CONTENT_DOC_ID);
}

function applyTextCap(raw) {
  const text = String(raw || '').replace(/\u0000/g, '');
  if (!text.trim()) {
    return {
      text: '',
      textStatus: 'none',
      truncated: false,
      charCount: 0,
    };
  }
  if (text.length > TEXT_CHAR_CAP) {
    const sliced = text.slice(0, TEXT_CHAR_CAP);
    return {
      text: sliced,
      textStatus: 'truncated',
      truncated: true,
      charCount: sliced.length,
    };
  }
  return {
    text,
    textStatus: 'ok',
    truncated: false,
    charCount: text.length,
  };
}

function decodePlainText(bytes) {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  let text = buffer.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

function toUint8Array(bytes) {
  if (bytes instanceof Uint8Array) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return new Uint8Array(bytes || []);
}

async function extractPdfText(bytes) {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(toUint8Array(bytes));
  const result = await extractText(pdf, { mergePages: true });
  return String(result && result.text != null ? result.text : '');
}

function needsObjectBytes(contentType) {
  const type = normalizedContentType(contentType);
  return type === 'application/pdf' || type === 'text/plain';
}

async function extractFromBytes(contentType, bytes, extractPdf) {
  const type = normalizedContentType(contentType);
  const runPdf = extractPdf || extractPdfText;
  if (IMAGE_NONE_TYPES.has(type)) {
    return {
      text: '',
      textStatus: 'none',
      truncated: false,
      charCount: 0,
      contentType: type,
    };
  }
  if (type === 'text/plain') {
    return { ...applyTextCap(decodePlainText(bytes)), contentType: type };
  }
  if (type === 'application/pdf') {
    try {
      const raw = await runPdf(bytes);
      return { ...applyTextCap(raw), contentType: type };
    } catch (error) {
      console.error('extractJobFileText pdf failed', error && error.message);
      return {
        text: '',
        textStatus: 'error',
        truncated: false,
        charCount: 0,
        contentType: type,
      };
    }
  }
  return {
    text: '',
    textStatus: 'unsupported',
    truncated: false,
    charCount: 0,
    contentType: type,
  };
}

function buildContentPayload(extracted, FieldValue) {
  const textStatus = TEXT_STATUSES.includes(extracted.textStatus)
    ? extracted.textStatus
    : 'error';
  const truncated = textStatus === 'truncated';
  const text = textStatus === 'truncated' || textStatus === 'ok'
    ? String(extracted.text || '')
    : '';
  return {
    text,
    textStatus,
    charCount: text.length,
    truncated,
    contentType: String(extracted.contentType || ''),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function shouldSkipWrite(existing, next) {
  if (!existing || typeof existing !== 'object') return false;
  return existing.textStatus === next.textStatus && existing.charCount === next.charCount;
}

function snapshotData(event) {
  const snap = event && event.data;
  if (!snap) return null;
  if (typeof snap.data === 'function') return snap.data() || {};
  return snap;
}

async function downloadObject(storage, storagePath) {
  const bucket = storage.bucket();
  const [bytes] = await bucket.file(storagePath).download();
  return bytes;
}

/**
 * Firestore onCreate for a job file. The file record is already written;
 * this never blocks upload and never deletes that record. Text lives only
 * on files/{fileId}/content/text. Embedded PDF text only — no OCR, no OpenAI.
 */
async function handleJobFileCreated(event, deps) {
  const params = (event && event.params) || {};
  const orgId = String(params.orgId || '');
  const jobId = String(params.jobId || '');
  const fileId = String(params.fileId || '');
  if (!isSafeOrgId(orgId) || !isSafeProjectId(jobId) || !isSafeFileId(fileId)) {
    return { skipped: true, reason: 'invalid-path' };
  }

  const data = snapshotData(event);
  if (!data) return { skipped: true, reason: 'no-data' };

  const db = deps.db;
  const storage = deps.storage;
  const FieldValue = deps.FieldValue;
  const extractPdf = deps.extractPdfText || extractPdfText;
  const download = deps.downloadObject || downloadObject;
  if (!db || !FieldValue) {
    throw new Error('Missing Firestore db/FieldValue');
  }

  const contentType = normalizedContentType(data.contentType);
  const storagePath = String(data.storagePath || '');
  let extracted;

  if (!needsObjectBytes(contentType)) {
    extracted = await extractFromBytes(contentType, Buffer.alloc(0), extractPdf);
  } else if (!isSafeStoragePath(orgId, jobId, fileId, storagePath)) {
    extracted = {
      text: '',
      textStatus: 'error',
      truncated: false,
      charCount: 0,
      contentType,
    };
  } else {
    const bytes = await download(storage, storagePath);
    extracted = await extractFromBytes(contentType, bytes, extractPdf);
  }

  const payload = buildContentPayload(extracted, FieldValue);
  const ref = contentRef(db, orgId, jobId, fileId);
  const existingSnap = await ref.get();
  const existing = existingSnap.exists ? existingSnap.data() : null;
  if (shouldSkipWrite(existing, payload)) {
    return { skipped: true, reason: 'idempotent', payload };
  }
  await ref.set(payload);
  return { skipped: false, payload };
}

module.exports = {
  TEXT_CHAR_CAP,
  CONTENT_COLLECTION,
  CONTENT_DOC_ID,
  applyTextCap,
  buildContentPayload,
  decodePlainText,
  extractFromBytes,
  extractPdfText,
  handleJobFileCreated,
  isSafeStoragePath,
  needsObjectBytes,
  normalizedContentType,
  shouldSkipWrite,
};
