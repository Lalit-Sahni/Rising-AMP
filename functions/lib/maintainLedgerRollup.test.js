'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeLedgerRollup } = require('./ledgerRollup');
const { recomputeLedgerRollupForJob, RevisionConflict } = require('./maintainLedgerRollup');

function memoryJob(expenses, rollup) {
  const state = { expenses: expenses.slice(), rollup: rollup || null, writes: [] };
  const rollupRef = {
    async get() {
      return {
        exists: Boolean(state.rollup),
        data: () => state.rollup,
      };
    },
  };
  function nest() {
    return {
      collection(name) {
        if (name === 'ledgerRollup') return { doc: () => rollupRef };
        return nest();
      },
      doc() {
        return nest();
      },
    };
  }
  const db = {
    collection() {
      return nest();
    },
    async runTransaction(fn) {
      const tx = {
        async get() {
          return {
            exists: Boolean(state.rollup),
            data: () => state.rollup,
          };
        },
        set(_ref, payload) {
          state.writes.push(payload);
          state.rollup = payload;
        },
      };
      await fn(tx);
    },
  };
  return { db, state, rollupRef };
}

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
const FieldPath = { documentId: () => '__name__' };

test('writes one complete document from the ledger', async () => {
  const expenses = [
    { id: 'a', total: 46.56, category: 'purchase', date: '2026-09-01' },
    { id: 'b', total: 100, category: 'investor', date: '2026-09-01' },
  ];
  const { db, state } = memoryJob(expenses, null);
  await recomputeLedgerRollupForJob(db, 'opal-ss-constructions', 'job-kelly', {
    FieldValue,
    FieldPath,
    listExpenses: async () => expenses,
  });
  assert.equal(state.writes.length, 1);
  const written = state.writes[0];
  assert.equal(written.costCents, 4656);
  assert.equal(written.investorCents, 10000);
  assert.equal(written.liveCount, 2);
  assert.equal(written.revision, 1);
  assert.equal(written.updatedAt, 'SERVER_TIME');
  assert.deepEqual(computeLedgerRollup(expenses, 0).costCents, written.costCents);
});

test('a failed transaction does not keep a partial payload', async () => {
  const previous = computeLedgerRollup([{ id: 'a', total: 20, category: 'purchase', date: '2026-09-01' }], 3);
  previous.updatedAt = 'old';
  const { db, state } = memoryJob([], previous);
  db.runTransaction = async () => {
    throw new Error('unavailable');
  };
  await assert.rejects(
    () => recomputeLedgerRollupForJob(db, 'opal-ss-constructions', 'job-kelly', {
      FieldValue,
      FieldPath,
      listExpenses: async () => [{ id: 'b', total: 99, category: 'purchase', date: '2026-09-02' }],
    }),
    /unavailable/,
  );
  assert.equal(state.rollup.costCents, previous.costCents);
  assert.equal(state.rollup.revision, 3);
  assert.equal(state.writes.length, 0);
});

test('a revision conflict retries and then writes the later complete document', async () => {
  const expenses = [{ id: 'a', total: 20, category: 'purchase', date: '2026-09-01' }];
  const { db, state } = memoryJob(expenses, computeLedgerRollup([], 1));
  let attempts = 0;
  const inner = db.runTransaction;
  db.runTransaction = async (fn) => {
    attempts += 1;
    if (attempts === 1) {
      const err = new RevisionConflict();
      throw err;
    }
    return inner.call(db, fn);
  };
  await recomputeLedgerRollupForJob(db, 'opal-ss-constructions', 'job-kelly', {
    FieldValue,
    FieldPath,
    listExpenses: async () => expenses,
  });
  assert.equal(attempts, 2);
  assert.equal(state.rollup.costCents, 2000);
  assert.equal(state.rollup.liveCount, 1);
});
