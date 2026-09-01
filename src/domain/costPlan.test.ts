import {
  APP_TRADES,
  NOT_IN_ESTIMATE_TRADE_ID,
  allocationsCoverTotal,
  canCodeExpenses,
  convertGstCents,
  deriveCostPlanAttention,
  deriveCostPlanBoard,
  deriveCostPlanProgress,
  hasActiveCostPlan,
  quoteForecastCents,
  quotesForTrade,
  sectionsFromTradeAmounts,
  suggestTradeForExpense,
  sumSectionAmounts,
} from './costPlan';
import { costPlanQuoteSchema, costPlanSchema, parseAtBoundary, type CostPlan } from './schemas';

const samplePlan = {
  id: 'current',
  jobId: 'job-1',
  level: 'target',
  targetCents: 34_000_000,
  baselineDate: '2026-08-31',
  gstMode: 'inclusive',
  status: 'draft',
  sections: [],
  createdBy: 'owner-1',
  archivedAt: null,
} satisfies CostPlan;

const tradesPlan: CostPlan = {
  ...samplePlan,
  level: 'trades',
  sections: [
    { id: 'concreting', tradeId: 'concreting', name: 'Concreting', order: 0, amountCents: 4_111_000 },
    { id: 'kitchen-joinery', tradeId: 'kitchen-joinery', name: 'Kitchen and joinery', order: 1, amountCents: 2_181_300 },
    { id: 'painting', tradeId: 'painting', name: 'Painting', order: 2, amountCents: 1_142_500 },
  ],
};

describe('cost plan model', () => {
  test('uses stable, unique app trade ids', () => {
    expect(APP_TRADES).toHaveLength(20);
    expect(new Set(APP_TRADES.map((trade) => trade.id)).size).toBe(APP_TRADES.length);
    expect(APP_TRADES.at(-1)).toEqual({ id: 'other', name: 'Other' });
  });

  test('accepts a target-only plan in integer cents', () => {
    const plan = costPlanSchema.parse(samplePlan);
    expect(plan.targetCents).toBe(34_000_000);
    expect(hasActiveCostPlan(plan)).toBe(true);
    expect(canCodeExpenses(plan)).toBe(false);
  });

  test('rejects zero, fractional, and string targets', () => {
    expect(parseAtBoundary(costPlanSchema, { ...samplePlan, targetCents: 0 }).ok).toBe(false);
    expect(parseAtBoundary(costPlanSchema, { ...samplePlan, targetCents: 10.5 }).ok).toBe(false);
    expect(parseAtBoundary(costPlanSchema, { ...samplePlan, targetCents: '34000000' }).ok).toBe(false);
  });

  test('an archived plan is not active', () => {
    expect(hasActiveCostPlan({ ...samplePlan, status: 'archived' })).toBe(false);
    expect(hasActiveCostPlan(null)).toBe(false);
  });

  test('trade sections stay in integer cents', () => {
    const sections = sectionsFromTradeAmounts([
      { tradeId: 'plumbing', name: 'Plumbing', amountCents: 50000 },
      { tradeId: 'painting', name: 'Painting', amountCents: 0 },
    ]);
    expect(sections).toHaveLength(1);
    expect(sumSectionAmounts(sections)).toBe(50000);
    expect(costPlanSchema.parse({ ...samplePlan, level: 'trades', sections }).sections[0].tradeId).toBe('plumbing');
  });
});

describe('cost plan progress', () => {
  test('totals active expenses from mixed stored money fields', () => {
    const progress = deriveCostPlanProgress(100_000, [
      { total: '250.00' },
      { amount: 100 },
      { category: 'labour', hours: 2, rate: 50 },
      { quantity: 2, unitCost: '25' },
      { total: 999, status: 'void' },
    ]);

    expect(progress.spentCents).toBe(50_000);
    expect(progress.leftCents).toBe(50_000);
    expect(progress.percent).toBe(50);
    expect(progress.overTarget).toBe(false);
  });

  test('shows an over-target amount without overflowing the bar', () => {
    const progress = deriveCostPlanProgress(10_000, [{ total: 125 }]);
    expect(progress.leftCents).toBe(-2_500);
    expect(progress.percent).toBe(125);
    expect(progress.barPercent).toBe(100);
    expect(progress.overTarget).toBe(true);
  });

  test('refuses to show partial spend when expenses are capped', () => {
    const progress = deriveCostPlanProgress(100_000, [{ total: 25 }], true);
    expect(progress.spentCents).toBeNull();
    expect(progress.leftCents).toBeNull();
    expect(progress.percent).toBeNull();
    expect(progress.expensesCapped).toBe(true);
  });
});

describe('quotes and coding', () => {
  test('quote parts must add up to the total', () => {
    expect(allocationsCoverTotal({
      amountCents: 3000000,
      allocations: [
        { tradeId: 'concreting', amountCents: 2000000 },
        { tradeId: 'external-works', amountCents: 1000000 },
      ],
    })).toBe(true);
    expect(allocationsCoverTotal({
      amountCents: 3000000,
      allocations: [{ tradeId: 'concreting', amountCents: 2000000 }],
    })).toBe(false);
    expect(costPlanQuoteSchema.safeParse({
      jobId: 'job-1',
      party: 'Asif',
      receivedDate: '2026-08-31',
      status: 'chosen',
      amountCents: 3000000,
      gstMode: 'inclusive',
      allocations: [{ tradeId: 'concreting', amountCents: 3000000 }],
      createdBy: 'owner-1',
    }).success).toBe(true);
  });

  test('forecast uses the high figure when a range is recorded', () => {
    expect(quoteForecastCents({ amountCents: 3000000, amountHighCents: 3500000 })).toBe(3500000);
    expect(quoteForecastCents({ amountCents: 3000000 })).toBe(3000000);
  });

  test('quotes on a trade hide voided rows and keep the chosen quote first', () => {
    const quotes = [
      {
        id: 'voided',
        jobId: 'job-1',
        party: 'Old',
        receivedDate: '2026-07-01',
        status: 'void' as const,
        amountCents: 100,
        gstMode: 'inclusive' as const,
        allocations: [{ tradeId: 'concreting', amountCents: 100 }],
        createdBy: 'owner-1',
      },
      {
        id: 'received',
        jobId: 'job-1',
        party: 'Other',
        receivedDate: '2026-08-02',
        status: 'received' as const,
        amountCents: 2800000,
        gstMode: 'inclusive' as const,
        allocations: [{ tradeId: 'concreting', amountCents: 2800000 }],
        createdBy: 'owner-1',
      },
      {
        id: 'chosen',
        jobId: 'job-1',
        party: 'Asif',
        receivedDate: '2026-08-01',
        status: 'chosen' as const,
        amountCents: 3000000,
        gstMode: 'inclusive' as const,
        allocations: [{ tradeId: 'concreting', amountCents: 3000000 }],
        createdBy: 'owner-1',
      },
      {
        id: 'other-trade',
        jobId: 'job-1',
        party: 'Mark',
        receivedDate: '2026-08-03',
        status: 'chosen' as const,
        amountCents: 500,
        gstMode: 'inclusive' as const,
        allocations: [{ tradeId: 'kitchen-joinery', amountCents: 500 }],
        createdBy: 'owner-1',
      },
    ];
    expect(quotesForTrade(quotes, 'concreting').map((quote) => quote.id)).toEqual(['chosen', 'received']);
  });

  test('exclusive quotes convert into the inclusive plan', () => {
    expect(convertGstCents(3950000, 'exclusive', 'inclusive')).toBe(4345000);
    expect(convertGstCents(4345000, 'inclusive', 'exclusive')).toBe(3950000);
  });

  test('suggestions come from a prior supplier or a matching trade name, never silently', () => {
    const trades = APP_TRADES.map((trade, index) => ({
      id: trade.id,
      name: trade.name,
      order: index,
      isAppDefault: true,
      status: 'active' as const,
    }));
    expect(suggestTradeForExpense(
      { supplier: 'Rodgers', itemName: 'Bricks' },
      trades,
      [{ supplier: 'Rodgers', tradeId: 'brickwork' }],
    )?.id).toBe('brickwork');
    expect(suggestTradeForExpense(
      { tradeName: 'Electrician spark', category: 'trade' },
      trades,
      [],
    )?.id).toBe('electrical');
    expect(suggestTradeForExpense({ supplier: 'Unknown Co' }, trades, [])).toBeNull();
  });

  test('uncoded expenses sit outside section variance but in the whole-job forecast', () => {
    const board = deriveCostPlanBoard({
      plan: tradesPlan,
      expenses: [
        { id: 'e1', tradeId: 'concreting', total: 1000 },
        { id: 'e2', total: 250 },
        { id: 'e3', tradeId: NOT_IN_ESTIMATE_TRADE_ID, itemName: 'Scaffold ticket', total: 80 },
        { id: 'void', tradeId: 'concreting', total: 999, status: 'void' },
      ],
      quotes: [{
        id: 'q1',
        jobId: 'job-1',
        party: 'Asif',
        receivedDate: '2026-08-01',
        status: 'chosen',
        amountCents: 3_000_000,
        gstMode: 'inclusive',
        allocations: [{ tradeId: 'concreting', amountCents: 3_000_000 }],
        createdBy: 'owner-1',
      }],
    });
    expect(board.trades[0].quotedCents).toBe(3_000_000);
    expect(board.trades[0].status).toBe('in-progress');
    expect(board.trades[1].status).toBe('not-started');
    expect(board.uncoded.count).toBe(1);
    expect(board.uncoded.spentCents).toBe(25000);
    expect(board.extras.count).toBe(1);
    expect(board.expectedCents).toBe(3_000_000 + 2_181_300 + 1_142_500 + 25000 + 8000);
  });

  test('kitchen quoted well over plan is Over even with no spend', () => {
    const board = deriveCostPlanBoard({
      plan: tradesPlan,
      quotes: [{
        id: 'q2',
        jobId: 'job-1',
        party: 'Mark',
        receivedDate: '2026-08-01',
        status: 'chosen',
        amountCents: 4_345_000,
        gstMode: 'inclusive',
        allocations: [{ tradeId: 'kitchen-joinery', amountCents: 4_345_000 }],
        createdBy: 'owner-1',
      }],
    });
    expect(board.trades[1].status).toBe('over');
  });

  test('attention stays quiet when nobody has coded or quoted yet', () => {
    const now = new Date('2026-08-31T12:00:00+10:00');
    expect(deriveCostPlanAttention({
      plan: tradesPlan,
      expenses: [{ id: 'old', total: 40, date: '2026-08-01' }],
    }, now)).toEqual([]);
  });

  test('attention names a quote well over plan and stale uncoded once coding is in use', () => {
    const now = new Date('2026-08-31T12:00:00+10:00');
    const items = deriveCostPlanAttention({
      plan: tradesPlan,
      expenses: [
        { id: 'coded', tradeId: 'painting', total: 10, date: '2026-08-20' },
        { id: 'stale', total: 40, date: '2026-08-01' },
      ],
      quotes: [{
        id: 'q2',
        jobId: 'job-1',
        party: 'Mark',
        receivedDate: '2026-08-01',
        status: 'chosen',
        amountCents: 4_345_000,
        gstMode: 'inclusive',
        allocations: [{ tradeId: 'kitchen-joinery', amountCents: 4_345_000 }],
        createdBy: 'owner-1',
      }],
    }, now);
    expect(items.map((item) => item.id)).toEqual([
      'cost-plan-quote-over',
      'cost-plan-uncoded-stale',
      'cost-plan-spend-no-quote',
    ]);
  });
});
