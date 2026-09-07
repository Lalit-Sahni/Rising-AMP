'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyReextract,
  parseReextractTarget,
  planReextract,
} = require('./reextractJobFileText');

const PROJECTS = {
  stagingProject: 'rising-amp-staging',
  productionProject: 'rising-amp-467702-b5',
};

function file(partial) {
  return {
    orgId: 'opal-ss-constructions',
    jobId: 'job-1',
    jobName: '72 Centenary Dr',
    fileId: partial.fileId || 'f1',
    name: partial.name || 'doc.pdf',
    contentType: partial.contentType,
    storagePath: partial.storagePath || 'files/opal-ss-constructions/job-1/f1/doc.pdf',
    content: partial.content === undefined ? null : partial.content,
  };
}

test('parseReextractTarget refuses --production', () => {
  assert.throws(() => parseReextractTarget(['--production'], PROJECTS), /production/);
  assert.throws(() => parseReextractTarget(['--apply', '--production'], PROJECTS), /production/);
  assert.throws(
    () => parseReextractTarget(['--apply', '--staging', '--production'], PROJECTS),
    /production/,
  );
  assert.throws(() => parseReextractTarget(['--apply'], PROJECTS), /--staging/);
  const dry = parseReextractTarget(['--staging'], PROJECTS);
  assert.equal(dry.apply, false);
  assert.equal(dry.destination, 'rising-amp-staging');
});

test('PDF or text/plain with missing sibling is planned; images and office files are not', () => {
  const plan = planReextract([
    file({ fileId: 'pdf-missing', contentType: 'application/pdf', content: null }),
    file({ fileId: 'txt-missing', name: 'note.txt', contentType: 'text/plain', content: null }),
    file({ fileId: 'jpg', name: 'site.jpg', contentType: 'image/jpeg', content: null }),
    file({
      fileId: 'docx',
      name: 'spec.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      content: null,
    }),
    file({
      fileId: 'xlsx',
      name: 'boq.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content: null,
    }),
  ]);
  assert.equal(plan.scanned, 5);
  assert.deepEqual(plan.planned.map((row) => row.fileId).sort(), ['pdf-missing', 'txt-missing']);
  assert.equal(plan.skipped.some((row) => row.fileId === 'jpg' && row.reason === 'image'), true);
  assert.equal(plan.skipped.some((row) => row.fileId === 'docx' && row.reason === 'unsupported'), true);
  assert.equal(plan.skipped.some((row) => row.fileId === 'xlsx' && row.reason === 'unsupported'), true);
});

test('existing none/ok on a PDF is already extracted; error is retried', () => {
  assert.equal(
    classifyReextract(
      file({ contentType: 'application/pdf', content: { textStatus: 'none', charCount: 0 } }),
      { textStatus: 'none', charCount: 0 },
    ).action,
    'skip',
  );
  assert.equal(
    classifyReextract(
      file({ contentType: 'application/pdf', content: { textStatus: 'ok', charCount: 12 } }),
      { textStatus: 'ok', charCount: 12 },
    ).reason,
    'already ok',
  );
  assert.equal(
    classifyReextract(
      file({ contentType: 'application/pdf', content: { textStatus: 'error', charCount: 0 } }),
      { textStatus: 'error', charCount: 0 },
    ).action,
    'extract',
  );
});

test('octet-stream named .pdf is extractable; .docx is not', () => {
  assert.equal(
    classifyReextract(file({ name: 'contract.pdf', contentType: 'application/octet-stream', content: null }), null).action,
    'extract',
  );
  assert.equal(
    classifyReextract(file({ name: 'letter.docx', contentType: 'application/octet-stream', storagePath: 'files/opal-ss-constructions/job-1/f1/letter.docx', content: null }), null).reason,
    'unsupported',
  );
});

test('a second plan after successful extract is zero writes', () => {
  const first = planReextract([
    file({ fileId: 'p1', contentType: 'application/pdf', content: null }),
  ]);
  assert.equal(first.writeCount, 1);
  const second = planReextract([
    file({ fileId: 'p1', contentType: 'application/pdf', content: { textStatus: 'ok', charCount: 40 } }),
  ]);
  assert.equal(second.writeCount, 0);
  const emptyPdf = planReextract([
    file({ fileId: 'p1', contentType: 'application/pdf', content: { textStatus: 'none', charCount: 0 } }),
  ]);
  assert.equal(emptyPdf.writeCount, 0);
});
