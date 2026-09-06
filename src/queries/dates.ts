import { expenseCalendarYmd } from '../domain/ledgerRollup';

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmdRange(from?: string, to?: string): boolean {
  if (from && !YMD.test(from)) return false;
  if (to && !YMD.test(to)) return false;
  if (from && to && from > to) return false;
  return true;
}

/** Inclusive Sydney calendar range, same keys as rollup byDay. */
export function ymdInRange(ymd: string | null | undefined, from?: string, to?: string): boolean {
  if (!ymd || !YMD.test(ymd)) return false;
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
}

export function expenseInRange(
  expense: Record<string, unknown> | null | undefined,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  return ymdInRange(expenseCalendarYmd(expense), from, to);
}

/**
 * Trade × day (and party/category × day) are not nested on the rollup.
 * A date filter on those questions cannot use byTrade/byParty/byCategory
 * or the all-trade byDay map, so we fall through to expense rows.
 */
export function dateFilterNeedsRows(from?: string, to?: string): boolean {
  return Boolean(from || to);
}
