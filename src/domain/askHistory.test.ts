import { computeLedgerRollup } from './ledgerRollup';
import { formatCents } from '../money';
import { spendByTrade } from '../queries/spend';
import {
  askHistorySchema,
  historyChoiceFromRoute,
  historyHasModelProse,
  snapshotFromQueryResult,
} from './askHistory';

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-1'] };

const EXPENSES = [
  {
    id: 'e1',
    total: 48.5,
    category: 'trade',
    date: '2026-09-01',
    tradeId: 'concreting',
    tradeName: 'Concreting',
  },
];

describe('ask history schema', () => {
  const queried = spendByTrade({
    scope: SCOPE,
    jobId: 'job-1',
    tradeId: 'concreting',
    jobs: [{
      jobId: 'job-1',
      rollup: computeLedgerRollup(EXPENSES, 1),
      expenses: EXPENSES,
      expensesCapped: false,
      expensesLoaded: true,
    }],
  });

  test('stores query name and cents from the query snapshot, not a model sentence', () => {
    expect(queried.ok).toBe(true);
    if (!queried.ok) return;
    expect(queried.cents).toBe(4850);

    const routed = {
      query: 'spendByTrade' as const,
      params: { jobId: 'job-1', tradeId: 'concreting' },
      sentence: 'You have spent $99,999 on concreting.',
      reason: 'Because $99,999',
    };
    const choice = historyChoiceFromRoute(routed, queried);

    expect(choice.query).toBe('spendByTrade');
    expect(choice.snapshot?.cents).toBe(queried.cents);
    expect(choice.snapshot?.cents).toBe(4850);
    expect(choice.snapshot?.cents).not.toBe(9_999_900);
    expect(JSON.stringify(choice)).not.toContain('sentence');
    expect(JSON.stringify(choice)).not.toContain('reason');
    expect(JSON.stringify(choice)).not.toContain('99,999');
    expect(JSON.stringify(choice)).not.toContain('$99,999');

    const row = askHistorySchema.parse({
      uid: 'u1',
      orgId: 'opal-ss-constructions',
      jobId: 'job-1',
      jobLabel: '72 Centenary Dr',
      question: 'how much on concreting',
      askedAt: new Date('2026-09-08T02:00:00Z'),
      choices: [choice],
    });
    expect(row.choices[0].snapshot?.cents).toBe(4850);
    expect(formatCents(row.choices[0].snapshot?.cents as number)).toBe('$48.50');
  });

  test('rejects a document that includes model prose', () => {
    const choice = historyChoiceFromRoute({
      query: 'spendByTrade',
      params: { jobId: 'job-1', tradeId: 'concreting' },
    }, queried);
    const base = {
      uid: 'u1',
      orgId: 'opal-ss-constructions',
      jobId: 'job-1',
      jobLabel: '72 Centenary Dr',
      question: 'how much on concreting',
      askedAt: new Date('2026-09-08T02:00:00Z'),
      choices: [choice],
    };
    expect(askHistorySchema.safeParse({ ...base, sentence: 'You spent $99,999' }).success).toBe(false);
    expect(askHistorySchema.safeParse({ ...base, reason: 'Because' }).success).toBe(false);
    expect(askHistorySchema.safeParse({
      ...base,
      messages: [{ role: 'assistant', content: 'You spent $99,999' }],
    }).success).toBe(false);
    expect(askHistorySchema.safeParse({
      ...base,
      choices: [{ ...choice, sentence: 'You spent $99,999' }],
    }).success).toBe(false);
    expect(askHistorySchema.safeParse({
      ...base,
      choices: [{ ...choice, reason: 'Because $99,999' }],
    }).success).toBe(false);
    expect(historyHasModelProse({ ...base, sentence: 'hi' })).toBe(true);
    expect(historyHasModelProse(base)).toBe(false);
  });

  test('snapshotFromQueryResult reads cents from the query, not from prose', () => {
    expect(queried.ok).toBe(true);
    if (!queried.ok) return;
    const snap = snapshotFromQueryResult({
      ...queried,
      sentence: 'You have spent $99,999 on concreting.',
    });
    expect(snap?.cents).toBe(4850);
    expect(JSON.stringify(snap)).not.toContain('99,999');
    expect(JSON.stringify(snap)).not.toContain('sentence');
  });
});
