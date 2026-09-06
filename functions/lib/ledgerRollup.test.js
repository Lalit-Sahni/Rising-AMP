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
  sumLedgerRollups,
  LEDGER_ROLLUP_SCHEMA_VERSION,
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

test('an extra id field is not a complete stored rollup', () => {
  const rollup = computeLedgerRollup(FIXTURES, 1);
  assert.equal(parseCompleteRollup({ ...rollup, id: 'current' }), null);
});

test('schema version stays 1 and extra org keys are rejected', () => {
  const rollup = computeLedgerRollup(FIXTURES, 1);
  assert.equal(rollup.schemaVersion, 1);
  assert.equal(LEDGER_ROLLUP_SCHEMA_VERSION, 1);
  assert.equal(parseCompleteRollup({ ...rollup, jobCount: 2 }), null);
});

test('two tradeIds bucket separately', () => {
  const rollup = computeLedgerRollup([
    { id: 'a', total: 10, category: 'purchase', date: '2026-09-01', tradeId: 'carpentry' },
    { id: 'b', total: 20, category: 'purchase', date: '2026-09-01', tradeId: 'concreting' },
  ], 1);
  assert.equal(rollup.byTrade.carpentry.cents, 1000);
  assert.equal(rollup.byTrade.carpentry.count, 1);
  assert.equal(rollup.byTrade.concreting.cents, 2000);
  assert.equal(rollup.byTrade.concreting.count, 1);
  assert.equal(rollup.byTrade.unassigned, undefined);
});

test('missing tradeId and partyId go to unassigned', () => {
  const rollup = computeLedgerRollup([
    { id: 'a', total: 10, category: 'purchase', date: '2026-09-01' },
    { id: 'b', total: 5, category: 'labour', date: '2026-09-01', tradeId: '  ', partyId: '' },
  ], 1);
  assert.equal(rollup.byTrade.unassigned.cents, 1500);
  assert.equal(rollup.byTrade.unassigned.count, 2);
  assert.equal(rollup.byParty.unassigned.cents, 1500);
  assert.equal(rollup.byParty.unassigned.count, 2);
});

test('byParty uses partyId not the typed name', () => {
  const rollup = computeLedgerRollup([
    {
      id: 'a',
      total: 10,
      category: 'purchase',
      date: '2026-09-01',
      partyId: 'party-mark',
      supplier: 'Mark Joinery Pty Ltd',
      name: 'Mark',
    },
  ], 1);
  assert.equal(rollup.byParty['party-mark'].cents, 1000);
  assert.equal(rollup.byParty.Mark, undefined);
  assert.equal(rollup.byParty['Mark Joinery Pty Ltd'], undefined);
  assert.equal(rollup.byParty.unassigned, undefined);
});

test('rollupsAgree is false when byTrade or byParty are missing', () => {
  const rollup = computeLedgerRollup(FIXTURES, 1);
  const { byTrade, ...noTrade } = rollup;
  const { byParty, ...noParty } = rollup;
  assert.equal(parseCompleteRollup(noTrade), null);
  assert.equal(parseCompleteRollup(noParty), null);
  assert.equal(rollupsAgree(noTrade, rollup), false);
  assert.equal(rollupsAgree(noParty, rollup), false);
  void byTrade;
  void byParty;
});

test('org sum of two jobs adds cents and counts', () => {
  const jobA = computeLedgerRollup([
    { id: 'a', total: 10, category: 'purchase', date: '2026-09-01', tradeId: 'carpentry', partyId: 'p1' },
  ], 1);
  const jobB = computeLedgerRollup([
    { id: 'b', total: 25, category: 'labour', date: '2026-09-02', tradeId: 'carpentry', partyId: 'p2' },
    { id: 'c', total: 100, category: 'investor', date: '2026-09-02', tradeId: 'investor', partyId: 'p1' },
  ], 2);
  const summed = sumLedgerRollups([jobA, jobB], 0);
  assert.equal(summed.costCents, jobA.costCents + jobB.costCents);
  assert.equal(summed.investorCents, jobA.investorCents + jobB.investorCents);
  assert.equal(summed.liveCount, jobA.liveCount + jobB.liveCount);
  assert.equal(summed.documentCount, jobA.documentCount + jobB.documentCount);
  assert.equal(summed.byTrade.carpentry.cents, 1000 + 2500);
  assert.equal(summed.byTrade.carpentry.count, 2);
  assert.equal(summed.byParty.p1.cents, 1000 + 10000);
  assert.equal(summed.byParty.p1.count, 2);
  assert.equal(summed.schemaVersion, 1);
  assert.equal(sumLedgerRollups([jobA, { costCents: 1 }], 0).costCents, jobA.costCents);
});
