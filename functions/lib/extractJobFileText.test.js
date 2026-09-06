'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  TEXT_CHAR_CAP,
  applyTextCap,
  buildContentPayload,
  extractFromBytes,
  extractPdfText,
  handleJobFileCreated,
  isSafeStoragePath,
  shouldSkipWrite,
} = require('./extractJobFileText');

function buildPdf(contentStream) {
  const streamBody = String(contentStream || '');
  const length = Buffer.byteLength(streamBody, 'latin1');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${length} >>\nstream\n${streamBody}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objs.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const startxref = Buffer.byteLength(body, 'latin1');
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer, 'latin1');
}

function pdfWithText(text) {
  const escaped = String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  return buildPdf(`BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`);
}

function pdfWithNoText() {
  return buildPdf('');
}

function memoryStore() {
  const files = new Map();
  const docs = new Map();
  const writes = [];
  const storage = {
    bucket() {
      return {
        file(path) {
          return {
            async download() {
              if (!files.has(path)) {
                const error = new Error(`No object at ${path}`);
                error.code = 404;
                throw error;
              }
              return [files.get(path)];
            },
          };
        },
      };
    },
  };
  function docRef(path) {
    return {
      async get() {
        const data = docs.get(path);
        return {
          exists: data != null,
          data: () => data,
        };
      },
      async set(payload) {
        writes.push({ path, payload });
        docs.set(path, payload);
      },
      async delete() {
        throw new Error('must not delete');
      },
      collection(name) {
        return {
          doc(id) {
            return docRef(`${path}/${name}/${id}`);
          },
        };
      },
    };
  }
  const db = {
    collection(name) {
      return {
        doc(id) {
          return docRef(`${name}/${id}`);
        },
      };
    },
  };
  return { db, storage, files, docs, writes };
}

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
const ORG = 'opal-ss-constructions';
const JOB = 'job-kelly';
const FILE = 'file1';
const STORAGE = `files/${ORG}/${JOB}/${FILE}/contract.pdf`;

function createdEvent(data, params) {
  return {
    params: params || { orgId: ORG, jobId: JOB, fileId: FILE },
    data: {
      data: () => data,
    },
  };
}

test('PDF with a text layer stores that text', async () => {
  const bytes = pdfWithText('Hello RisingAMP');
  const extracted = await extractPdfText(bytes);
  assert.match(extracted.replace(/\s+/g, ' '), /Hello RisingAMP/);
  const result = await extractFromBytes('application/pdf', bytes);
  assert.equal(result.textStatus, 'ok');
  assert.equal(result.truncated, false);
  assert.match(result.text.replace(/\s+/g, ' '), /Hello RisingAMP/);
  assert.equal(result.charCount, result.text.length);
  assert.equal(result.contentType, 'application/pdf');
});

test('PDF with no extractable text is none, not faked', async () => {
  const result = await extractFromBytes('application/pdf', pdfWithNoText());
  assert.equal(result.textStatus, 'none');
  assert.equal(result.text, '');
  assert.equal(result.charCount, 0);
  assert.equal(result.truncated, false);
});

test('a corrupt PDF is error, not a throw', async () => {
  const result = await extractFromBytes('application/pdf', Buffer.from('%PDF-not-valid'));
  assert.equal(result.textStatus, 'error');
  assert.equal(result.text, '');
});

test('images are none with no OCR', async () => {
  const result = await extractFromBytes('image/jpeg', Buffer.from([0xff, 0xd8, 0xff]));
  assert.equal(result.textStatus, 'none');
  assert.equal(result.text, '');
  assert.equal(result.contentType, 'image/jpeg');
});

test('text/plain stores the first 80_000 characters', async () => {
  const body = `${'a'.repeat(TEXT_CHAR_CAP)}Z`;
  const result = await extractFromBytes('text/plain', Buffer.from(body, 'utf8'));
  assert.equal(result.textStatus, 'truncated');
  assert.equal(result.truncated, true);
  assert.equal(result.charCount, TEXT_CHAR_CAP);
  assert.equal(result.text.length, TEXT_CHAR_CAP);
  assert.equal(result.text.endsWith('a'), true);
  assert.equal(result.text.includes('Z'), false);
});

test('text/plain under the cap is ok', async () => {
  const result = await extractFromBytes('text/plain', Buffer.from('Site note\n', 'utf8'));
  assert.equal(result.textStatus, 'ok');
  assert.equal(result.text, 'Site note\n');
  assert.equal(result.charCount, 10);
  assert.equal(result.truncated, false);
});

test('Word, Excel and other types are unsupported', async () => {
  const word = await extractFromBytes(
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    Buffer.from('PK'),
  );
  const excel = await extractFromBytes(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    Buffer.from('PK'),
  );
  const rtf = await extractFromBytes('application/rtf', Buffer.from('{\\rtf1}'));
  assert.equal(word.textStatus, 'unsupported');
  assert.equal(excel.textStatus, 'unsupported');
  assert.equal(rtf.textStatus, 'unsupported');
  assert.equal(word.text, '');
  assert.equal(excel.text, '');
});

test('applyTextCap slices at 80_000 and marks truncated', () => {
  const exact = applyTextCap('x'.repeat(TEXT_CHAR_CAP));
  assert.equal(exact.textStatus, 'ok');
  assert.equal(exact.truncated, false);
  assert.equal(exact.charCount, TEXT_CHAR_CAP);

  const over = applyTextCap('x'.repeat(TEXT_CHAR_CAP + 1));
  assert.equal(over.textStatus, 'truncated');
  assert.equal(over.truncated, true);
  assert.equal(over.charCount, TEXT_CHAR_CAP);
  assert.equal(over.text.length, TEXT_CHAR_CAP);
});

test('payload has only the six stored keys', () => {
  const payload = buildContentPayload(
    { text: 'hello', textStatus: 'ok', contentType: 'application/pdf' },
    FieldValue,
  );
  assert.deepEqual(Object.keys(payload).sort(), [
    'charCount',
    'contentType',
    'text',
    'textStatus',
    'truncated',
    'updatedAt',
  ]);
  assert.equal(payload.updatedAt, 'SERVER_TIME');
  assert.equal(payload.charCount, 5);
  assert.equal(payload.truncated, false);
});

test('idempotent skip uses textStatus and charCount only', () => {
  const next = { textStatus: 'ok', charCount: 12 };
  assert.equal(shouldSkipWrite({ textStatus: 'ok', charCount: 12, text: 'old' }, next), true);
  assert.equal(shouldSkipWrite({ textStatus: 'ok', charCount: 11 }, next), false);
  assert.equal(shouldSkipWrite(null, next), false);
});

test('storage path must belong to this file', () => {
  assert.equal(isSafeStoragePath(ORG, JOB, FILE, STORAGE), true);
  assert.equal(isSafeStoragePath(ORG, JOB, FILE, `files/${ORG}/${JOB}/other/x.pdf`), false);
  assert.equal(isSafeStoragePath(ORG, JOB, FILE, `files/${ORG}/${JOB}/${FILE}/../x.pdf`), false);
});

test('handleJobFileCreated writes the sibling and never deletes the file', async () => {
  const { db, storage, files, docs, writes } = memoryStore();
  files.set(STORAGE, pdfWithText('Retention is 5 percent'));
  const result = await handleJobFileCreated(
    createdEvent({
      contentType: 'application/pdf',
      storagePath: STORAGE,
      name: 'Contract',
    }),
    { db, storage, FieldValue },
  );
  assert.equal(result.skipped, false);
  assert.equal(result.payload.textStatus, 'ok');
  assert.match(result.payload.text.replace(/\s+/g, ' '), /Retention is 5 percent/);
  assert.equal(writes.length, 1);
  assert.equal(
    writes[0].path,
    `organizations/${ORG}/projects/${JOB}/files/${FILE}/content/text`,
  );
  assert.equal(docs.has(`organizations/${ORG}/projects/${JOB}/files/${FILE}`), false);
});

test('a second run with the same status and count skips the write', async () => {
  const { db, storage, files, writes } = memoryStore();
  files.set(STORAGE, pdfWithText('Same text'));
  const deps = { db, storage, FieldValue };
  const event = createdEvent({ contentType: 'application/pdf', storagePath: STORAGE });
  await handleJobFileCreated(event, deps);
  await handleJobFileCreated(event, deps);
  assert.equal(writes.length, 1);
});

test('images write none without downloading', async () => {
  const { db, storage, writes } = memoryStore();
  const result = await handleJobFileCreated(
    createdEvent({
      contentType: 'image/png',
      storagePath: `files/${ORG}/${JOB}/${FILE}/site.png`,
    }),
    { db, storage, FieldValue },
  );
  assert.equal(result.payload.textStatus, 'none');
  assert.equal(writes.length, 1);
});

test('download failure throws so retry can run', async () => {
  const { db, storage, writes } = memoryStore();
  await assert.rejects(
    () => handleJobFileCreated(
      createdEvent({ contentType: 'application/pdf', storagePath: STORAGE }),
      { db, storage, FieldValue },
    ),
    /No object/,
  );
  assert.equal(writes.length, 0);
});
