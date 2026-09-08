import {
  ASSISTANT_WRITES_OFF_MESSAGE,
  isAssistantWritesEnabledValue,
} from './writesGate';
import { codeExpense } from './codeExpense';
import { codeExpenseBatch } from './codeExpenseBatch';
import { createExpense } from './createExpense';
import { runAction } from './registry';
import { createMemoryActionStore } from './store';
import { undoAction } from './undo';

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-a'] };

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    scope: SCOPE,
    jobId: 'job-a',
    clientKey: 'kill-create-1xxxxx',
    id: 'exp-kill',
    category: 'purchase',
    date: '2026-08-14',
    total: 12,
    partyId: 'party-1',
    evidence: {
      date: { source: 'ocr', value: '2026-08-14' },
      amount: { source: 'ocr', value: '1200' },
      party: { source: 'record', value: 'party-1' },
    },
    ...overrides,
  };
}

describe('kill switch', () => {
  test('Firestore missing or not true is off', () => {
    expect(isAssistantWritesEnabledValue(undefined)).toBe(false);
    expect(isAssistantWritesEnabledValue(null)).toBe(false);
    expect(isAssistantWritesEnabledValue(false)).toBe(false);
    expect(isAssistantWritesEnabledValue('yes')).toBe(false);
    expect(isAssistantWritesEnabledValue('true')).toBe(false);
    expect(isAssistantWritesEnabledValue(1)).toBe(false);
    expect(isAssistantWritesEnabledValue(true)).toBe(true);
  });

  test('runAction is the choke point for create, code and batch when off', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, { id: 'exp-1', jobId: 'job-a', tradeId: null, total: 10 });
    store.setAssistantWritesEnabled(SCOPE.orgId, false);

    const created = await runAction('createExpense', createInput(), store);
    const coded = await runAction('codeExpense', {
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'kill-run-codexxxxxx',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    const batched = await runAction('codeExpenseBatch', {
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'kill-run-batchxxxxx',
      rows: [{
        expenseId: 'exp-1',
        tradeId: 'concreting',
        evidence: { tradeId: { source: 'user', value: 'concreting' } },
      }],
    }, store);

    expect(created.ok).toBe(false);
    expect(coded.ok).toBe(false);
    expect(batched.ok).toBe(false);
    if (created.ok || coded.ok || batched.ok) return;
    expect(created.error.code).toBe('assistant_writes_disabled');
    expect(coded.error.code).toBe('assistant_writes_disabled');
    expect(batched.error.code).toBe('assistant_writes_disabled');
    expect(store.expenseWriteCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
  });

  test('memory store defaults on so existing writes still run', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, { id: 'exp-1', jobId: 'job-a', tradeId: null });
    expect(await store.assistantWritesEnabled(SCOPE.orgId)).toBe(true);
    const result = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'kill-default-onxxx',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.status).toBe('applied');
  });

  test('off refuses createExpense, codeExpense and codeExpenseBatch with no write', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, { id: 'exp-1', jobId: 'job-a', tradeId: null, total: 10 });
    store.setAssistantWritesEnabled(SCOPE.orgId, false);

    const created = await createExpense(createInput(), store);
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe('assistant_writes_disabled');
    expect(created.error.message).toBe(ASSISTANT_WRITES_OFF_MESSAGE);

    const coded = await codeExpense({
      scope: SCOPE,
      jobId: 'job-a',
      expenseId: 'exp-1',
      tradeId: 'concreting',
      clientKey: 'kill-code-offxxxxx',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }, store);
    expect(coded.ok).toBe(false);
    if (coded.ok) return;
    expect(coded.error.code).toBe('assistant_writes_disabled');

    const batched = await codeExpenseBatch({
      scope: SCOPE,
      jobId: 'job-a',
      clientKey: 'kill-batch-offxxxx',
      rows: [{
        expenseId: 'exp-1',
        tradeId: 'concreting',
        evidence: { tradeId: { source: 'user', value: 'concreting' } },
      }],
    }, store);
    expect(batched.ok).toBe(false);
    if (batched.ok) return;
    expect(batched.error.code).toBe('assistant_writes_disabled');

    expect(store.expenseWriteCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
    expect(await store.getExpense(SCOPE.orgId, 'job-a', 'exp-kill')).toBe(null);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe(null);
  });

  test('off still allows undo of an already-applied receipt', async () => {
    const store = createMemoryActionStore();
    const created = await createExpense(createInput(), store);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-kill'))?.status).not.toBe('void');

    store.setAssistantWritesEnabled(SCOPE.orgId, false);
    const blocked = await runAction('createExpense', createInput({
      clientKey: 'kill-create-2xxxxx',
      id: 'exp-kill-2',
    }), store);
    expect(blocked.ok).toBe(false);

    const undone = await undoAction({
      scope: SCOPE,
      receiptId: created.receipt.id,
      clientKey: 'kill-undo-stillxxxx',
    }, store);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.receipt.status).toBe('undone');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-kill'))?.status).toBe('void');
  });

  test('same clientKey after off still returns the original applied receipt', async () => {
    const store = createMemoryActionStore();
    const first = await createExpense(createInput(), store);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    store.setAssistantWritesEnabled(SCOPE.orgId, false);
    const replay = await createExpense(createInput({ supplier: 'Other' }), store);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.receipt.id).toBe(first.receipt.id);
    expect(store.expenseWriteCount).toBe(1);
  });
});
