/**
 * A write and its receipt are one commit. If the commit fails, nothing
 * lands: no coded expense pointing at a missing receipt, no created row
 * without its undo handle, no reverted row still showing 'applied'.
 * A failed commit never burns the clientKey, so the same tap retries clean.
 */
import { codeExpense } from './codeExpense';
import { createExpense } from './createExpense';
import { createMemoryActionStore } from './store';
import { undoAction } from './undo';

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-a'] };

function storeWithUncoded() {
  const store = createMemoryActionStore();
  store.seedExpense(SCOPE.orgId, { id: 'exp-1', jobId: 'job-a', tradeId: null });
  return store;
}

function codeInput(overrides: Record<string, unknown> = {}) {
  return {
    scope: SCOPE,
    jobId: 'job-a',
    expenseId: 'exp-1',
    tradeId: 'concreting',
    clientKey: 'client-key-atomic-code',
    origin: 'human' as const,
    evidence: { tradeId: { source: 'user' as const, value: 'concreting' } },
    ...overrides,
  };
}

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    scope: SCOPE,
    jobId: 'job-a',
    clientKey: 'client-key-atomic-create',
    origin: 'assistant' as const,
    id: 'exp-new',
    category: 'purchase',
    date: '2026-08-14',
    supplier: 'Bunnings',
    unitCost: 124.5,
    quantity: 1,
    total: 124.5,
    partyId: 'party-bunnings',
    evidence: {
      date: { source: 'ocr' as const, value: '2026-08-14' },
      amount: { source: 'ocr' as const, value: '12450' },
      party: { source: 'record' as const, value: 'party-bunnings' },
    },
    ...overrides,
  };
}

describe('commitCoding', () => {
  test('a successful commit patches the expense and stores the receipt together', async () => {
    const store = storeWithUncoded();
    const result = await codeExpense(codeInput(), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.expenseWriteCount).toBe(1);
    expect(store.receiptWriteCount).toBe(1);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe('concreting');
    expect(expense?.source).toBe('assistant');
    expect(expense?.assistantReceiptId).toBe(result.receipt.id);
    const stored = await store.getReceipt(SCOPE.orgId, result.receipt.id);
    expect(stored?.status).toBe('applied');
    expect(stored?.undo).toEqual({
      kind: 'restoreTradeId',
      expenseId: 'exp-1',
      previousTradeId: null,
    });
  });

  test('when the commit fails nothing lands and the expense stays codeable', async () => {
    const store = storeWithUncoded();
    store.failNextCommit = true;
    await expect(codeExpense(codeInput(), store)).rejects.toThrow('injected_commit_failure');
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe(null);
    expect(expense?.source).toBeUndefined();
    expect(expense?.assistantReceiptId).toBeUndefined();
    expect(store.expenseWriteCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
    expect(await store.getReceiptByClientKey(SCOPE.orgId, 'client-key-atomic-code')).toBe(null);

    const retry = await codeExpense(codeInput(), store);
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    const coded = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(coded?.tradeId).toBe('concreting');
    expect(coded?.assistantReceiptId).toBe(retry.receipt.id);
    expect(await store.getReceipt(SCOPE.orgId, retry.receipt.id)).not.toBe(null);
  });
});

describe('undo after an atomic coding', () => {
  test('restores a previous null tradeId and stamps the receipt undone', async () => {
    const store = storeWithUncoded();
    const coded = await codeExpense(codeInput(), store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    const undone = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'client-key-atomic-undo',
    }, store);
    expect(undone.ok).toBe(true);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe(null);
    expect(expense?.source).toBeUndefined();
    expect(expense?.assistantReceiptId).toBeUndefined();
    expect((await store.getReceipt(SCOPE.orgId, coded.receipt.id))?.status).toBe('undone');
  });

  test('a human confirmation survives the undo', async () => {
    const store = storeWithUncoded();
    const coded = await codeExpense(codeInput(), store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.assistantConfirmed).toBe(true);
    await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'client-key-atomic-undo',
    }, store);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.assistantConfirmed).toBe(true);
    expect(expense?.tradeId).toBe(null);
  });

  test('when the undo commit fails neither the revert nor the stamp lands, and undo retries clean', async () => {
    const store = storeWithUncoded();
    const coded = await codeExpense(codeInput(), store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    store.failNextCommit = true;
    await expect(undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'client-key-atomic-undo',
    }, store)).rejects.toThrow('injected_commit_failure');
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1');
    expect(expense?.tradeId).toBe('concreting');
    expect((await store.getReceipt(SCOPE.orgId, coded.receipt.id))?.status).toBe('applied');

    const retry = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'client-key-atomic-undo',
    }, store);
    expect(retry.ok).toBe(true);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe(null);
    expect((await store.getReceipt(SCOPE.orgId, coded.receipt.id))?.status).toBe('undone');
  });
});

describe('commitCreation', () => {
  test('a scanned expense, its file link and its receipt land together', async () => {
    const store = createMemoryActionStore();
    const result = await createExpense(createInput({ fileId: 'file-1' }), store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.expenseWriteCount).toBe(1);
    expect(store.fileLinkCount).toBe(1);
    expect(store.receiptWriteCount).toBe(1);
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new');
    expect(expense?.assistantReceiptId).toBe(result.receipt.id);
    expect((await store.getReceipt(SCOPE.orgId, result.receipt.id))?.status).toBe('applied');
  });

  test('when the creation commit fails nothing lands and the clientKey retries clean', async () => {
    const store = createMemoryActionStore();
    store.failNextCommit = true;
    await expect(createExpense(createInput({ fileId: 'file-1' }), store))
      .rejects.toThrow('injected_commit_failure');
    expect(await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new')).toBe(null);
    expect(store.expenseWriteCount).toBe(0);
    expect(store.fileLinkCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
    expect(await store.getReceiptByClientKey(SCOPE.orgId, 'client-key-atomic-create')).toBe(null);

    const retry = await createExpense(createInput({ fileId: 'file-1' }), store);
    expect(retry.ok).toBe(true);
    expect(await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new')).not.toBe(null);
    expect(store.fileLinkCount).toBe(1);
  });

  test('voiding a created expense and stamping the receipt are one commit', async () => {
    const store = createMemoryActionStore();
    const created = await createExpense(createInput(), store);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    store.failNextCommit = true;
    await expect(undoAction({
      scope: SCOPE,
      receiptId: created.receipt.id,
      clientKey: 'client-key-atomic-void',
    }, store)).rejects.toThrow('injected_commit_failure');
    const expense = await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new');
    expect(expense?.status).not.toBe('void');
    expect((await store.getReceipt(SCOPE.orgId, created.receipt.id))?.status).toBe('applied');

    const retry = await undoAction({
      scope: SCOPE,
      receiptId: created.receipt.id,
      clientKey: 'client-key-atomic-void',
    }, store);
    expect(retry.ok).toBe(true);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-new'))?.status).toBe('void');
    expect((await store.getReceipt(SCOPE.orgId, created.receipt.id))?.status).toBe('undone');
  });
});
