/**
 * Undo returns ledger totals to the prior value, to the cent.
 * Same clientKey writes once for createExpense and codeExpenseBatch.
 * Never hard-deletes.
 */
import { codeExpense } from './codeExpense';
import { codeExpenseBatch } from './codeExpenseBatch';
import { createExpense } from './createExpense';
import { resolveExpenseTotals } from '../domain/ledgerRollup';
import { getExpenseTotalCents } from '../utils/jobMetrics';
import { createMemoryActionStore, type MemoryActionStore } from './store';
import { undoAction } from './undo';

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-a', 'job-b'] };
const JOB = 'job-a';

async function rows(store: MemoryActionStore, ids: string[]) {
  const expenses = [];
  for (const id of ids) {
    const row = await store.getExpense(SCOPE.orgId, JOB, id);
    if (row) expenses.push(row);
  }
  return expenses;
}

async function costCents(store: MemoryActionStore, ids: string[]) {
  const expenses = await rows(store, ids);
  return resolveExpenseTotals({ expenses, expensesLoaded: true }).costCents;
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    scope: SCOPE,
    jobId: JOB,
    clientKey: 'undo-ledger-create-1',
    origin: 'assistant',
    id: 'exp-new',
    category: 'purchase',
    date: '2026-08-14',
    supplier: 'Bunnings',
    unitCost: 124.5,
    quantity: 1,
    total: 124.5,
    partyId: 'party-bunnings',
    evidence: {
      date: { source: 'ocr', value: '2026-08-14' },
      amount: { source: 'ocr', value: '12450' },
      party: { source: 'record', value: 'party-bunnings' },
    },
    ...overrides,
  };
}

describe('idempotency', () => {
  test('createExpense same clientKey writes once', async () => {
    const store = createMemoryActionStore();
    const first = await createExpense(createInput(), store);
    const second = await createExpense(createInput({
      supplier: 'Someone else',
      total: 9,
    }), store);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.receipt.id).toBe(first.receipt.id);
    expect(store.expenseWriteCount).toBe(1);
    expect(store.receiptWriteCount).toBe(1);
    const expense = await store.getExpense(SCOPE.orgId, JOB, 'exp-new');
    expect(expense?.total).toBe(124.5);
  });

  test('codeExpenseBatch same clientKey writes once', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, { id: 'e1', jobId: JOB, tradeId: null, total: 10 });
    const payload = {
      scope: SCOPE,
      jobId: JOB,
      clientKey: 'undo-ledger-batch-1',
      origin: 'human',
      rows: [{
        expenseId: 'e1',
        tradeId: 'concreting',
        evidence: { tradeId: { source: 'record', value: 'concreting' } },
      }],
    };
    const first = await codeExpenseBatch(payload, store);
    const second = await codeExpenseBatch({
      ...payload,
      rows: [{
        expenseId: 'e1',
        tradeId: 'carpentry',
        evidence: { tradeId: { source: 'user', value: 'carpentry' } },
      }],
    }, store);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.receipt.id).toBe(first.receipt.id);
    expect(store.expenseWriteCount).toBe(1);
    expect((await store.getExpense(SCOPE.orgId, JOB, 'e1'))?.tradeId).toBe('concreting');
  });

  test('codeExpense same clientKey writes once', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, { id: 'e1', jobId: JOB, tradeId: null, total: 10 });
    const payload = {
      scope: SCOPE,
      jobId: JOB,
      expenseId: 'e1',
      tradeId: 'concreting',
      clientKey: 'undo-ledger-code-1x',
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    };
    const first = await codeExpense(payload, store);
    const second = await codeExpense({
      ...payload,
      tradeId: 'carpentry',
      evidence: { tradeId: { source: 'user', value: 'carpentry' } },
    }, store);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.receipt.id).toBe(first.receipt.id);
    expect(store.expenseWriteCount).toBe(1);
    expect((await store.getExpense(SCOPE.orgId, JOB, 'e1'))?.tradeId).toBe('concreting');
  });
});

describe('undo + ledger cents', () => {
  test('createExpense increases costCents; undo voids; costCents returns exactly', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, {
      id: 'exp-seed',
      jobId: JOB,
      tradeId: null,
      total: 100,
      status: 'active',
    });
    const ids = ['exp-seed', 'exp-new'];
    const prior = await costCents(store, ids);
    expect(prior).toBe(10000);
    expect(getExpenseTotalCents(await store.getExpense(SCOPE.orgId, JOB, 'exp-seed'))).toBe(10000);

    const created = await createExpense(createInput(), store);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const afterCreate = await costCents(store, ids);
    expect(afterCreate).toBe(22450);
    expect(getExpenseTotalCents(await store.getExpense(SCOPE.orgId, JOB, 'exp-new'))).toBe(12450);

    const undone = await undoAction({
      scope: SCOPE,
      receiptId: created.receipt.id,
      clientKey: 'undo-ledger-void-1',
    }, store);
    expect(undone.ok).toBe(true);
    const voided = await store.getExpense(SCOPE.orgId, JOB, 'exp-new');
    expect(voided).not.toBe(null);
    expect(voided?.status).toBe('void');
    expect(getExpenseTotalCents(voided)).toBe(0);
    expect(await costCents(store, ids)).toBe(prior);
  });

  test('codeExpense does not change costCents; undo restores tradeId including null', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, {
      id: 'exp-1',
      jobId: JOB,
      tradeId: null,
      total: 48.5,
      status: 'active',
    });
    const ids = ['exp-1'];
    const prior = await costCents(store, ids);
    expect(prior).toBe(4850);

    const coded = await codeExpense({
      scope: SCOPE,
      jobId: JOB,
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'undo-ledger-code-1',
      origin: 'human',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    expect(await costCents(store, ids)).toBe(prior);
    expect((await store.getExpense(SCOPE.orgId, JOB, 'exp-1'))?.tradeId).toBe('concreting');

    const undone = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'undo-ledger-code-u1',
    }, store);
    expect(undone.ok).toBe(true);
    const restored = await store.getExpense(SCOPE.orgId, JOB, 'exp-1');
    expect(restored?.tradeId).toBe(null);
    expect(await costCents(store, ids)).toBe(prior);
    expect(getExpenseTotalCents(restored)).toBe(4850);
  });

  test('codeExpense undo restores a previous coded tradeId; costCents stays exact', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, {
      id: 'exp-1',
      jobId: JOB,
      tradeId: 'plumbing',
      total: 20,
      status: 'active',
    });
    const ids = ['exp-1'];
    const prior = await costCents(store, ids);
    const coded = await codeExpense({
      scope: SCOPE,
      jobId: JOB,
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'undo-ledger-recode-1',
      origin: 'human',
      evidence: { tradeId: { source: 'record', value: 'concreting' } },
    }, store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    expect(await costCents(store, ids)).toBe(prior);
    const undone = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'undo-ledger-recode-u',
    }, store);
    expect(undone.ok).toBe(true);
    expect((await store.getExpense(SCOPE.orgId, JOB, 'exp-1'))?.tradeId).toBe('plumbing');
    expect(await costCents(store, ids)).toBe(prior);
  });

  test('codeExpenseBatch undo restores every child; costCents stays exact', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, {
      id: 'e1',
      jobId: JOB,
      tradeId: null,
      total: 10,
      status: 'active',
    });
    store.seedExpense(SCOPE.orgId, {
      id: 'e2',
      jobId: JOB,
      tradeId: null,
      total: 20,
      status: 'active',
    });
    const ids = ['e1', 'e2'];
    const prior = await costCents(store, ids);
    expect(prior).toBe(3000);

    const coded = await codeExpenseBatch({
      scope: SCOPE,
      jobId: JOB,
      clientKey: 'undo-ledger-batch-u1',
      origin: 'human',
      rows: [
        {
          expenseId: 'e1',
          tradeId: 'concreting',
          evidence: { tradeId: { source: 'record', value: 'concreting' } },
        },
        {
          expenseId: 'e2',
          tradeId: 'carpentry',
          evidence: { tradeId: { source: 'user', value: 'carpentry' } },
        },
      ],
    }, store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    expect(await costCents(store, ids)).toBe(prior);
    expect((await store.getExpense(SCOPE.orgId, JOB, 'e1'))?.tradeId).toBe('concreting');
    expect((await store.getExpense(SCOPE.orgId, JOB, 'e2'))?.tradeId).toBe('carpentry');

    const undone = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'undo-ledger-batch-undo',
    }, store);
    expect(undone.ok).toBe(true);
    expect((await store.getExpense(SCOPE.orgId, JOB, 'e1'))?.tradeId).toBe(null);
    expect((await store.getExpense(SCOPE.orgId, JOB, 'e2'))?.tradeId).toBe(null);
    expect(await costCents(store, ids)).toBe(prior);
  });
});
