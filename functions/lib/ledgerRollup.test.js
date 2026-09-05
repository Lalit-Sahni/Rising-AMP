'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeLedgerRollup,
  parseCompleteRollup,
  commitCompleteRollup,
  commitRollupIfRevisionUnchanged,
  emptyLedgerRollup,
  rollupsAgree,
} = require('./ledgerRollup');

const FIXTURES = [
  { id: 'a', total: 20, category: 'purchase', date: '2026-09-01' },
  { id: 'b', category: 'labour', hours: 8, rate: 50, date: '2026-09-01' },
  { id: 'c', quantity: 2, unitCost: '3.5', category: 'purchase', date: '2026-08-15' },
  { id: 'd', total: 1000, category: 'investor', date: '2026-09-02' },
  { id: 'e', total: 80, status: 'void', category: 'purchase', date: '2026-09-02' },
];

test('labour hours, investor, and void rows', () => {
  const rollup = computeLedgerRollup(FIXTURES, 1);
  assert.equal(rollup.liveCount, 4);
  assert.equal(rollup.costCents, 42700);
  assert.equal(rollup.investorCents, 100000);
  assert.equal(rollup.documentCount, 5);
});

test('incomplete payload is not written', () => {
  let stored = emptyLedgerRollup(1);
  stored.costCents = 465600;
  assert.equal(parseCompleteRollup({ costCents: 1, liveCount: 5 }), null);
  assert.throws(() => commitCompleteRollup({ costCents: 1 }, () => {
    stored = { broken: true };
  }), /incomplete rollup/);
  assert.equal(stored.costCents, 465600);
});

test('a throwing write leaves the previous totals', () => {
  const previous = computeLedgerRollup(FIXTURES, 2);
  let stored = previous;
  assert.throws(() => commitCompleteRollup(computeLedgerRollup(FIXTURES.slice(0, 1), 3), () => {
    throw new Error('unavailable');
  }), /unavailable/);
  assert.equal(stored, previous);
});

test('stale revision does not clobber a newer complete document', () => {
  let stored = computeLedgerRollup(FIXTURES, 4);
  const wrote = commitRollupIfRevisionUnchanged(
    stored,
    3,
    computeLedgerRollup(FIXTURES.slice(0, 1), 0),
    (next) => {
      stored = next;
    },
  );
  assert.equal(wrote, false);
  assert.equal(stored.revision, 4);
  assert.equal(stored.liveCount, 4);
});

test('two rollups of the same ledger agree', () => {
  assert.equal(rollupsAgree(computeLedgerRollup(FIXTURES, 1), computeLedgerRollup(FIXTURES, 9)), true);
});
