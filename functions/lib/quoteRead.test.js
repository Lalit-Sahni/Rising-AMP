'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseQuoteReadContent, sanitizeQuoteReadInput } = require('./quoteRead');

test('parses a fenced quote read', () => {
  const result = parseQuoteReadContent('```json\n{"party":"Asif","amount":30000,"gstMode":"inclusive","tradeId":"concreting","warnings":[]}\n```', ['concreting']);
  assert.equal(result.party, 'Asif');
  assert.equal(result.amount, 30000);
  assert.equal(result.tradeId, 'concreting');
});

test('drops a trade id that is not on the job', () => {
  const result = parseQuoteReadContent('{"party":"Asif","amount":10,"tradeId":"made-up"}', ['concreting']);
  assert.equal(result.tradeId, null);
});

test('caps the trade list', () => {
  const cleaned = sanitizeQuoteReadInput({
    fileName: 'q.pdf',
    trades: Array.from({ length: 50 }, (_, i) => ({ id: `t${i}`, name: `Trade ${i}` })),
  });
  assert.equal(cleaned.trades.length, 40);
});
