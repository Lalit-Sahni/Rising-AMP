import { INVESTOR_TRADE_ID } from './costPlanCore';

export const EXPENSE_CATEGORIES = [
  'labour',
  'trade',
  'equipment',
  'service',
  'purchase',
  'investor',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

const ALLOWED = new Set<string>(EXPENSE_CATEGORIES);

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && ALLOWED.has(value);
}

export function normalizeExpenseCategory(value: unknown): ExpenseCategory | null {
  if (value === 'materials') return 'purchase';
  if (isExpenseCategory(value)) return value;
  return null;
}

/** Investor is not construction, so retagging onto it codes the expense. Leaving it uncodes. */
export function tradeIdAfterCategoryChange(
  category: string,
  currentTradeId: string | null | undefined,
): string | null {
  const current = String(currentTradeId || '').trim() || null;
  if (category === 'investor') return INVESTOR_TRADE_ID;
  if (current === INVESTOR_TRADE_ID) return null;
  return current;
}
