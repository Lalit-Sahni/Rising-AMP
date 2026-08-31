import { addCents, cents, type Cents } from '../money';
import { getExpenseTotalCents } from '../utils/jobMetrics';
import type { CostPlan } from './schemas';

export const COST_PLAN_DOC_ID = 'current';

export const APP_TRADES = [
  { id: 'site-works', name: 'Site works' },
  { id: 'demolition', name: 'Demolition' },
  { id: 'concreting', name: 'Concreting' },
  { id: 'structural-steel', name: 'Structural steel' },
  { id: 'plumbing', name: 'Plumbing' },
  { id: 'carpentry', name: 'Carpentry' },
  { id: 'brickwork', name: 'Bricks and masonry' },
  { id: 'roofing', name: 'Roofing' },
  { id: 'windows-doors', name: 'Windows and doors' },
  { id: 'electrical', name: 'Electrical' },
  { id: 'waterproofing', name: 'Waterproofing' },
  { id: 'plastering', name: 'Plastering' },
  { id: 'tiling-flooring', name: 'Tiling and flooring' },
  { id: 'painting', name: 'Painting' },
  { id: 'kitchen-joinery', name: 'Kitchen and joinery' },
  { id: 'hvac', name: 'Air conditioning' },
  { id: 'scaffolding', name: 'Scaffolding' },
  { id: 'external-works', name: 'External works' },
  { id: 'landscaping', name: 'Landscaping' },
  { id: 'other', name: 'Other' },
] as const;

export type AppTradeId = (typeof APP_TRADES)[number]['id'];

export function hasActiveCostPlan(
  plan: CostPlan | null | undefined,
): plan is CostPlan {
  return Boolean(plan && plan.status !== 'archived');
}

export type CostPlanProgress = {
  targetCents: Cents;
  spentCents: Cents | null;
  leftCents: Cents | null;
  percent: number | null;
  barPercent: number;
  overTarget: boolean | null;
  expensesCapped: boolean;
};

export function deriveCostPlanProgress(
  targetCents: number,
  expenses: Array<Record<string, unknown>> = [],
  expensesCapped = false,
): CostPlanProgress {
  const target = cents(targetCents);
  if (expensesCapped) {
    return {
      targetCents: target,
      spentCents: null,
      leftCents: null,
      percent: null,
      barPercent: 0,
      overTarget: null,
      expensesCapped: true,
    };
  }

  const spent = addCents(...expenses.map((expense) => getExpenseTotalCents(expense)), 0);
  const left = cents(target - spent);
  const percent = target > 0 ? (spent / target) * 100 : null;

  return {
    targetCents: target,
    spentCents: spent,
    leftCents: left,
    percent,
    barPercent: percent == null ? 0 : Math.max(0, Math.min(100, percent)),
    overTarget: spent > target,
    expensesCapped: false,
  };
}
