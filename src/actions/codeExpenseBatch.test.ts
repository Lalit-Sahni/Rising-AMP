import { codeExpenseBatch } from './codeExpenseBatch';
import { ACTION_NAMES } from './core';
import { runAction } from './registry';
import { createMemoryActionStore } from './store';
import { undoAction } from './undo';

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-a', 'job-b'] };
const BATCH_KEY = 'client-key-batch-1';

function storeWithUncoded(ids: string[]) {
  const store = createMemoryActionStore();
  ids.forEach((id) => {
    store.seedExpense(SCOPE.orgId, {
      id,
      jobId: 'job-a',
      tradeId: null,
      partyId: 'party-bunnings',
    });
  });
  return store;
}

describe('codeExpenseBatch', () => {
  test('codes direct rows, skips inferred, and does not recode', async () => {
    const store = storeWithUncoded(['e1', 'e2', 'e3']);
    const result = await codeExpenseBatch({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: BATCH_KEY,
      origin: 'human',
      rows: [
        {
          expenseId: 'e1',
          tradeId: 'concreting',
          evidence: { tradeId: { source: 'record', value: 'concreting' } },
        },
        {
          expenseId: 'e2',
          tradeId: 'plumbing',
          evidence: { tradeId: { source: 'inferred', value: 'plumbing' } },
        },
        {
          expenseId: 'e3',
          tradeId: 'carpentry',
          evidence: { tradeId: { source: 'user', value: 'carpentry' } },
        },
      ],
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.action).toBe('codeExpenseBatch');
    expect(result.receipt.tier).toBe('do');
    expect(result.receipt.status).toBe('applied');
    expect(result.receipt.documentIds.expenseIds).toEqual(['e1', 'e3']);
    expect(result.receipt.undo.kind).toBe('restoreTradeIdBatch');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.tradeId).toBe('concreting');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e2'))?.tradeId).toBe(null);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e3'))?.tradeId).toBe('carpentry');
    expect(store.expenseWriteCount).toBe(2);
  });

  test('rejects when any target expense already has a tradeId', async () => {
    const store = storeWithUncoded(['e1', 'e2']);
    store.seedExpense(SCOPE.orgId, {
      id: 'e2',
      jobId: 'job-a',
      tradeId: 'plumbing',
    });
    const result = await codeExpenseBatch({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'client-key-batch-coded',
      origin: 'human',
      rows: [
        {
          expenseId: 'e1',
          tradeId: 'concreting',
          evidence: { tradeId: { source: 'record', value: 'concreting' } },
        },
        {
          expenseId: 'e2',
          tradeId: 'concreting',
          evidence: { tradeId: { source: 'user', value: 'concreting' } },
        },
      ],
    }, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_input');
    expect(store.expenseWriteCount).toBe(0);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.tradeId).toBe(null);
  });

  test('inferred-only payload writes nothing and stays proposed', async () => {
    const store = storeWithUncoded(['e1']);
    const result = await codeExpenseBatch({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'client-key-batch-inf',
      origin: 'human',
      rows: [{
        expenseId: 'e1',
        tradeId: 'concreting',
        evidence: { tradeId: { source: 'inferred', value: 'concreting' } },
      }],
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.tier).toBe('propose');
    expect(result.receipt.undo.kind).toBe('none');
    expect(store.expenseWriteCount).toBe(0);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.tradeId).toBe(null);
  });

  test('the same clientKey writes once', async () => {
    const store = storeWithUncoded(['e1']);
    const payload = {
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: BATCH_KEY,
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
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.receipt.id).toBe(first.receipt.id);
    expect(store.expenseWriteCount).toBe(1);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.tradeId).toBe('concreting');
  });

  test('undo-all restores every child tradeId', async () => {
    const store = storeWithUncoded(['e1', 'e2']);
    const coded = await codeExpenseBatch({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: BATCH_KEY,
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
    const undone = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'undo-batch-all-1',
    }, store);
    expect(undone.ok).toBe(true);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.tradeId).toBe(null);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e2'))?.tradeId).toBe(null);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.source).toBeUndefined();
  });

  test('per-row undo restores one child and leaves the other', async () => {
    const store = storeWithUncoded(['e1', 'e2']);
    const coded = await codeExpenseBatch({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: BATCH_KEY,
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
    if (!coded.ok || coded.receipt.undo.kind !== 'restoreTradeIdBatch') return;
    const childId = coded.receipt.undo.items[0].receiptId;
    const undone = await undoAction({
      scope: SCOPE,
      receiptId: childId,
      clientKey: 'undo-child-row-1',
    }, store);
    expect(undone.ok).toBe(true);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.tradeId).toBe(null);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e2'))?.tradeId).toBe('carpentry');
  });

  test('a job that is not invited does not write', async () => {
    const store = storeWithUncoded(['e1']);
    const result = await codeExpenseBatch({
      scope: SCOPE,
      jobId: 'phase8-isolation',
      clientKey: BATCH_KEY,
      origin: 'human',
      rows: [{
        expenseId: 'e1',
        tradeId: 'concreting',
        evidence: { tradeId: { source: 'user', value: 'concreting' } },
      }],
    }, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('job_not_allowed');
    expect(store.expenseWriteCount).toBe(0);
  });

  test('runAction dispatches codeExpenseBatch', async () => {
    const store = storeWithUncoded(['e1']);
    const result = await runAction('codeExpenseBatch', {
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'client-key-batch-run',
      origin: 'human',
      rows: [{
        expenseId: 'e1',
        tradeId: 'concreting',
        evidence: { tradeId: { source: 'record', value: 'concreting' } },
      }],
    }, store);
    expect(result.ok).toBe(true);
    expect(ACTION_NAMES).toContain('codeExpenseBatch');
  });
});
