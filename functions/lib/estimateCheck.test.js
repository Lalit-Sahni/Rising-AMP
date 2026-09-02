'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseEstimateCheckContent,
  sanitizeEstimateCheckInput,
} = require('./estimateCheck');

test('parses a fenced JSON check', () => {
  const result = parseEstimateCheckContent('```json\n{"ok":true,"summary":"Looks right.","warnings":[]}\n```');
  assert.equal(result.ok, true);
  assert.equal(result.summary, 'Looks right.');
  assert.deepEqual(result.warnings, []);
});

test('warnings force ok to false', () => {
  const result = parseEstimateCheckContent('{"ok":true,"summary":"Painting is under plumbing.","warnings":["Painting is mapped to Plumbing."]}');
  assert.equal(result.ok, false);
  assert.equal(result.warnings.length, 1);
});

test('caps sections and sample rows', () => {
  const cleaned = sanitizeEstimateCheckInput({
    fileName: 'Kelly.xlsx',
    addGst: true,
    layoutTotalCents: 100,
    planTotalCents: 110,
    sections: Array.from({ length: 90 }, (_, i) => ({ name: `S${i}`, amountCents: 1, tradeName: 'Other' })),
    sampleRows: Array.from({ length: 40 }, () => ['a', 'b', 'c']),
  });
  assert.equal(cleaned.sections.length, 80);
  assert.equal(cleaned.sampleRows.length, 30);
  assert.equal(cleaned.addGst, true);
});
