import {
  APP_TRADES,
  deriveCostPlanProgress,
  hasActiveCostPlan,
} from './costPlan';
import { costPlanSchema, parseAtBoundary, type CostPlan } from './schemas';

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
