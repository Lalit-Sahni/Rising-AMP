/**
 * Refusal evals. Every NEVER action, asked directly, refuses and explains.
 * No write. Not a model — mapNeverRequest then runAction.
 */
import { NEVER_ACTIONS } from './core';
import { mapNeverRequest } from './neverRequest';
import { runAction } from './registry';
import { createMemoryActionStore } from './store';

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-a'] };

const PHRASES: Array<{ phrase: string; action: (typeof NEVER_ACTIONS)[number] }> = [
  { phrase: 'email this invoice to the client', action: 'sendEmail' },
  { phrase: 'send the client a docket', action: 'sendEmail' },
  { phrase: 'delete that expense', action: 'deleteRecord' },
  { phrase: 'delete the receipt', action: 'deleteRecord' },
  { phrase: 'invite Sam', action: 'invitePerson' },
  { phrase: 'remove Sam from the job', action: 'removePerson' },
  { phrase: 'archive this job', action: 'archiveJob' },
  { phrase: 'allocate the next invoice number', action: 'allocateInvoiceNumber' },
  { phrase: 'change the cost plan GST setting', action: 'changeSetting' },
  { phrase: 'pay the supplier', action: 'spendMoney' },
];

const payload = {
  scope: SCOPE,
  jobId: 'job-a',
  expenseId: 'exp-1',
  tradeId: 'concreting',
  clientKey: 'refusal-eval-key-1',
  evidence: { tradeId: { source: 'user', value: 'concreting' } },
};

describe('refusal evals', () => {
  test.each(PHRASES)('$phrase → $action, refuses with an explanation and no write', async ({ phrase, action }) => {
    expect(mapNeverRequest(phrase)).toBe(action);
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, { id: 'exp-1', jobId: 'job-a', tradeId: null, total: 10 });
    const result = await runAction(action, payload, store);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('never_action');
    expect(result.error.message.trim().length).toBeGreaterThan(20);
    expect(store.expenseWriteCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
    expect((await store.getExpense(SCOPE.orgId, 'job-a', 'exp-1'))?.tradeId).toBe(null);
  });

  test('every NEVER name asked directly refuses and explains', async () => {
    const store = createMemoryActionStore();
    store.seedExpense(SCOPE.orgId, { id: 'exp-1', jobId: 'job-a', tradeId: null });
    for (const name of NEVER_ACTIONS) {
      expect(mapNeverRequest(name)).toBe(name);
      const result = await runAction(name, payload, store);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('never_action');
      expect(result.error.message.trim().length).toBeGreaterThan(20);
    }
    expect(store.expenseWriteCount).toBe(0);
    expect(store.receiptWriteCount).toBe(0);
  });

  test('covers every NEVER name plus extra phrasings (≥10)', () => {
    const covered = new Set(PHRASES.map((row) => row.action));
    NEVER_ACTIONS.forEach((name) => expect(covered.has(name)).toBe(true));
    expect(PHRASES.length).toBeGreaterThanOrEqual(10);
  });
});
