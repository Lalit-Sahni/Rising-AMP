/**
 * Who chose the value, at the write. A coding a person confirmed on screen is
 * confirmed, so History must not ask him to check it again. Undo reverts the
 * trade and leaves that confirmation alone: he still looked at the row.
 */
import { assistantHistoryMarker } from '../domain/assistantActivity';
import { codeExpense } from './codeExpense';
import { codeExpenseBatch } from './codeExpenseBatch';
import { createMemoryActionStore, type MemoryActionStore } from './store';
import { undoAction } from './undo';

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-a'] };

function storeWithUncoded(ids: string[], extra: Record<string, unknown> = {}): MemoryActionStore {
  const store = createMemoryActionStore();
  ids.forEach((id) => {
    store.seedExpense(SCOPE.orgId, {
      id,
      jobId: 'job-a',
      tradeId: null,
      ...extra,
    });
  });
  return store;
}

function codeOne(store: MemoryActionStore, origin: 'human' | 'assistant', expenseId = 'e1') {
  return codeExpense({
    scope: SCOPE,
    jobId: 'job-a',
    expenseId,
    tradeId: 'electrical',
    clientKey: `client-key-${origin}-${expenseId}`,
    origin,
    evidence: {
      tradeId: {
        source: origin === 'human' ? 'user' : 'record',
        value: 'electrical',
      },
    },
  }, store);
}

function marker(store: MemoryActionStore, expenseId = 'e1') {
  return store.getExpense(SCOPE.orgId, 'job-a', expenseId).then(assistantHistoryMarker);
}

describe('a coding he confirmed is confirmed', () => {
  test('human origin stamps assistantConfirmed and History stays quiet', async () => {
    const store = storeWithUncoded(['e1']);
    const result = await codeOne(store, 'human');
    expect(result.ok).toBe(true);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'e1');
    expect(expense?.tradeId).toBe('electrical');
    expect(expense?.assistantConfirmed).toBe(true);
    expect(await marker(store)).toEqual({ show: false, label: '' });
  });

  test('assistant origin writes no confirmation, so the Check marker stands', async () => {
    const store = storeWithUncoded(['e1']);
    const result = await codeOne(store, 'assistant');
    expect(result.ok).toBe(true);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'e1');
    expect(expense?.assistantConfirmed).toBeUndefined();
    expect(await marker(store)).toEqual({ show: true, label: 'Check' });
  });

  test('a scanned row he codes by hand stops asking to be checked', async () => {
    const store = storeWithUncoded(['e1'], {
      source: 'assistant',
      assistantConfirmed: false,
    });
    expect(await marker(store)).toEqual({ show: true, label: 'Check' });
    await codeOne(store, 'human');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.assistantConfirmed).toBe(true);
    expect(await marker(store)).toEqual({ show: false, label: '' });
  });

  test('a scanned row the assistant codes still asks to be checked', async () => {
    const store = storeWithUncoded(['e1'], {
      source: 'assistant',
      assistantConfirmed: false,
    });
    await codeOne(store, 'assistant');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.assistantConfirmed).toBe(false);
    expect(await marker(store)).toEqual({ show: true, label: 'Check' });
  });

  test('accepting a batch by hand leaves no rows to check', async () => {
    const store = storeWithUncoded(['e1', 'e2', 'e3']);
    const result = await codeExpenseBatch({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'client-key-batch-human',
      origin: 'human',
      rows: ['e1', 'e2', 'e3'].map((expenseId) => ({
        expenseId,
        tradeId: 'electrical',
        evidence: { tradeId: { source: 'user' as const, value: 'electrical' } },
      })),
    }, store);
    expect(result.ok).toBe(true);
    for (const expenseId of ['e1', 'e2', 'e3']) {
      expect(await marker(store, expenseId)).toEqual({ show: false, label: '' });
    }
  });

  test('the same batch run by the assistant leaves every row to check', async () => {
    const store = storeWithUncoded(['e1', 'e2', 'e3']);
    await codeExpenseBatch({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'client-key-batch-assistant',
      origin: 'assistant',
      rows: ['e1', 'e2', 'e3'].map((expenseId) => ({
        expenseId,
        tradeId: 'electrical',
        evidence: { tradeId: { source: 'record' as const, value: 'electrical' } },
      })),
    }, store);
    for (const expenseId of ['e1', 'e2', 'e3']) {
      expect(await marker(store, expenseId)).toEqual({ show: true, label: 'Check' });
    }
  });
});

describe('undo reverts the trade, not the fact that he looked', () => {
  test('undoing his own coding keeps assistantConfirmed and clears the stamp', async () => {
    const store = storeWithUncoded(['e1']);
    const coded = await codeOne(store, 'human');
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    const undone = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'client-key-undo-human',
    }, store);
    expect(undone.ok).toBe(true);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'e1');
    expect(expense?.tradeId).toBe(null);
    expect(expense?.assistantConfirmed).toBe(true);
    expect(expense?.source).toBeUndefined();
    expect(expense?.assistantReceiptId).toBeUndefined();
  });

  test('undoing a scanned row he coded keeps it out of the check list', async () => {
    const store = storeWithUncoded(['e1'], {
      source: 'assistant',
      assistantConfirmed: false,
    });
    const coded = await codeOne(store, 'human');
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'client-key-undo-scan',
    }, store);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'e1');
    expect(expense?.assistantConfirmed).toBe(true);
    expect(await marker(store)).toEqual({ show: false, label: '' });
  });

  test('undoing an assistant coding never invents a confirmation', async () => {
    const store = storeWithUncoded(['e1'], {
      source: 'assistant',
      assistantConfirmed: false,
    });
    const coded = await codeOne(store, 'assistant');
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'client-key-undo-assistant',
    }, store);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'e1'))?.assistantConfirmed).toBe(false);
  });
});
