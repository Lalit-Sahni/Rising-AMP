import type { CostPlan } from './schemas';

export const COST_PLAN_DOC_ID = 'current';
export const NOT_IN_ESTIMATE_TRADE_ID = 'not-in-estimate';
export const UNCODED_TRADE_ID = 'uncoded';

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

export function planHasTrades(plan: CostPlan | null | undefined): plan is CostPlan {
  return hasActiveCostPlan(plan) && (plan.level === 'trades' || plan.level === 'imported');
}

export function canCodeExpenses(plan: CostPlan | null | undefined): boolean {
  return planHasTrades(plan);
}
