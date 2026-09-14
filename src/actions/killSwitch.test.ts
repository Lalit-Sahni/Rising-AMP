/**
 * The kill switch is an off-ramp, not the default posture.
 * Missing is on, a failed read is 'unknown' and allowed, and only a do-tier
 * assistant write is refused. A person's own choice always writes.
 */
import {
  ASSISTANT_WRITES_OFF_MEMBER_MESSAGE,
  ASSISTANT_WRITES_OFF_OWNER_MESSAGE,
  assistantWritesOffMessage,
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
    origin: 'assistant',
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

function codeInput(overrides: Record<string, unknown> = {}) {
  return {
    scope: SCOPE,
    jobId: 'job-a',
    expenseId: 'exp-1',
    tradeId: 'concreting',
    clientKey: 'kill-code-1xxxxxxx',
    origin: 'assistant',
    evidence: { tradeId: { source: 'user', value: 'concreting' } },
    ...overrides,
  };
}

function batchInput(overrides: Record<string, unknown> = {}) {
  return {
    scope: SCOPE,
    jobId: 'job-a',
    clientKey: 'kill-batch-1xxxxxx',
    origin: 'assistant',
    rows: [{
      expenseId: 'exp-1',
      tradeId: 'concreting',
      evidence: { tradeId: { source: 'user', value: 'concreting' } },
    }],
    ...overrides,
  };
}

function storeWithExpense() {
  const store = createMemoryActionStore();
  store.seedExpense(SCOPE.orgId, { id: 'exp-1', jobId: 'job-a', tradeId: null, total: 10 });
  return store;
}

describe('kill switch value', () => {
  test('only an explicit false is off', () => {
    expect(isAssistantWritesEnabledValue(undefined)).toBe(true);
    expect(isAssistantWritesEnabledValue(null)).toBe(true);
    expect(isAssistantWritesEnabledValue('yes')).toBe(true);
    expect(isAssistantWritesEnabledValue('true')).toBe(true);
    expect(isAssistantWritesEnabledValue(1)).toBe(true);
    expect(isAssistantWritesEnabledValue('unknown')).toBe(true);
    expect(isAssistantWritesEnabledValue(true)).toBe(true);
    expect(isAssistantWritesEnabledValue(false)).toBe(false);
  });
});

describe('an org that never touched the switch', () => {
  test('a fresh org writes normally', async () => {
    const store = storeWithExpense();
    expect(await store.assistantWritesEnabled(SCOPE.orgId)).toBe(true);

    const coded = await codeExpense(codeInput(), store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    expect(coded.receipt.status).toBe('applied');
    expect(coded.receipt.origin).toBe('assistant');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe('concreting');

    const created = await runAction('createExpense', createInput(), store);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.receipt.status).toBe('applied');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-kill'))?.category).toBe('purchase');
  });
});

describe('the switch turned off deliberately', () => {
  test('a do-tier assistant write is refused with no expense and no receipt', async () => {
    const store = storeWithExpense();
    store.setAssistantWritesEnabled(SCOPE.orgId, false);

    const coded = await codeExpense(codeInput(), store);
    expect(coded.ok).toBe(false);
    if (coded.ok) return;
    expect(coded.error.code).toBe('assistant_writes_disabled');

    const created = await createExpense(createInput(), store);
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.error.code).toBe('assistant_writes_disabled');

    const batched = await codeExpenseBatch(batchInput(), store);
    expect(batched.ok).toBe(false);
    if (batched.ok) return;
    expect(batched.error.code).toBe('assistant_writes_disabled');

    expect(store.expenseWriteCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe(null);
    expect(await store.getExpense(SCOPE.orgId, 'job-a', 'exp-kill')).toBe(null);
  });

  test('a row the owner accepted by hand still writes', async () => {
    const store = storeWithExpense();
    store.setAssistantWritesEnabled(SCOPE.orgId, false);

    const batched = await codeExpenseBatch(batchInput({ origin: 'human' }), store);
    expect(batched.ok).toBe(true);
    if (!batched.ok) return;
    expect(batched.receipt.status).toBe('applied');
    expect(batched.receipt.origin).toBe('human');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe('concreting');

    const created = await createExpense(createInput({ origin: 'human' }), store);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.receipt.status).toBe('applied');
    expect(created.receipt.origin).toBe('human');
  });

  test('a propose is never gated', async () => {
    const store = storeWithExpense();
    store.setAssistantWritesEnabled(SCOPE.orgId, false);

    const coded = await codeExpense(codeInput({
      evidence: { tradeId: { source: 'inferred', value: 'concreting' } },
    }), store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    expect(coded.receipt.tier).toBe('propose');
    expect(coded.receipt.status).toBe('proposed');
    expect(coded.receipt.origin).toBe('assistant');
    expect(store.receiptWriteCount).toBe(1);
    expect(store.expenseWriteCount).toBe(0);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe(null);

    const batched = await codeExpenseBatch(batchInput({
      rows: [{
        expenseId: 'exp-1',
        tradeId: 'concreting',
        evidence: { tradeId: { source: 'inferred', value: 'concreting' } },
      }],
    }), store);
    expect(batched.ok).toBe(true);
    if (!batched.ok) return;
    expect(batched.receipt.status).toBe('proposed');
    expect(store.expenseWriteCount).toBe(0);
  });

  test('undo still works while the switch is off', async () => {
    const store = storeWithExpense();
    const created = await createExpense(createInput(), store);
    const coded = await codeExpense(codeInput(), store);
    expect(created.ok && coded.ok).toBe(true);
    if (!created.ok || !coded.ok) return;

    store.setAssistantWritesEnabled(SCOPE.orgId, false);
    const refused = await createExpense(createInput({
      clientKey: 'kill-create-2xxxxx',
      id: 'exp-kill-2',
    }), store);
    expect(refused.ok).toBe(false);

    const undoneCreate = await undoAction({
      scope: SCOPE,
      receiptId: created.receipt.id,
      clientKey: 'kill-undo-createxx',
    }, store);
    expect(undoneCreate.ok).toBe(true);
    if (!undoneCreate.ok) return;
    expect(undoneCreate.receipt.status).toBe('undone');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-kill'))?.status).toBe('void');

    const undoneCode = await undoAction({
      scope: SCOPE,
      receiptId: coded.receipt.id,
      clientKey: 'kill-undo-codexxxx',
    }, store);
    expect(undoneCode.ok).toBe(true);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe(null);
  });

  test('the same clientKey replayed after off returns the original receipt', async () => {
    const store = createMemoryActionStore();
    const first = await createExpense(createInput(), store);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    store.setAssistantWritesEnabled(SCOPE.orgId, false);
    const replay = await createExpense(createInput({ supplier: 'Other' }), store);
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.receipt.id).toBe(first.receipt.id);
    expect(replay.receipt.status).toBe('applied');
    expect(store.expenseWriteCount).toBe(1);
    expect(store.receiptWriteCount).toBe(1);
  });
});

describe('a read that failed is not a decision', () => {
  test("'unknown' allows the write and blames nobody", async () => {
    const store = storeWithExpense();
    store.setAssistantWritesEnabled(SCOPE.orgId, 'unknown');
    expect(await store.assistantWritesEnabled(SCOPE.orgId)).toBe('unknown');

    const coded = await codeExpense(codeInput(), store);
    expect(coded.ok).toBe(true);
    if (!coded.ok) return;
    expect(coded.receipt.status).toBe('applied');
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe('concreting');
    expect(JSON.stringify(coded)).not.toContain('Assistant writes are off');
  });
});

describe('the refusal names who can fix it', () => {
  test('the owner is told where the toggle is, anyone else is told who to ask', async () => {
    expect(assistantWritesOffMessage(true)).toBe(ASSISTANT_WRITES_OFF_OWNER_MESSAGE);
    expect(assistantWritesOffMessage(false)).toBe(ASSISTANT_WRITES_OFF_MEMBER_MESSAGE);
    expect(ASSISTANT_WRITES_OFF_OWNER_MESSAGE).toContain('Profile');
    expect(ASSISTANT_WRITES_OFF_MEMBER_MESSAGE).toContain('owner');

    const store = storeWithExpense();
    store.setAssistantWritesEnabled(SCOPE.orgId, false);

    const asOwner = await codeExpense(codeInput({ viewerIsOwner: true }), store);
    expect(asOwner.ok).toBe(false);
    if (asOwner.ok) return;
    expect(asOwner.error.message).toBe(ASSISTANT_WRITES_OFF_OWNER_MESSAGE);

    const asMember = await codeExpense(codeInput({ viewerIsOwner: false }), store);
    expect(asMember.ok).toBe(false);
    if (asMember.ok) return;
    expect(asMember.error.message).toBe(ASSISTANT_WRITES_OFF_MEMBER_MESSAGE);

    const unstated = await codeExpense(codeInput(), store);
    expect(unstated.ok).toBe(false);
    if (unstated.ok) return;
    expect(unstated.error.message).toBe(ASSISTANT_WRITES_OFF_MEMBER_MESSAGE);
  });
});
