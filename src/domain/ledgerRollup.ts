/**
 * Job expense rollup. Cost, count, category and calendar totals live on one
 * small document so Overview and Jobs home do not add up the ledger.
 *
 * The Cloud Function writes the whole document in one set(), and only after
 * the payload is complete. A failed write leaves the previous document.
 * If a rollup and an uncapped ledger disagree, the ledger wins.
 */
import { fromCents } from '../money';
import { isInvestorExpense } from './costPlanCore';
import {
  deriveMargin,
  deriveVerdict,
  getExpenseTotalCents,
  isVoidExpense,
  VERDICT,
} from '../utils/jobMetrics';

import {
  LEDGER_ROLLUP_COLLECTION,
  LEDGER_ROLLUP_DOC_ID,
  LEDGER_ROLLUP_SCHEMA_VERSION,
  LEDGER_ROLLUP_TIME_ZONE,
  MAINTAIN_LEDGER_ROLLUP_FUNCTION,
} from './ledgerRollupMeta';

export {
  LEDGER_ROLLUP_COLLECTION,
  LEDGER_ROLLUP_DOC_ID,
  LEDGER_ROLLUP_SCHEMA_VERSION,
  LEDGER_ROLLUP_TIME_ZONE,
  MAINTAIN_LEDGER_ROLLUP_FUNCTION,
};

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;

export type RollupBucket = {
  cents: number;
  count: number;
};

export type LedgerRollup = {
  schemaVersion: number;
  documentCount: number;
  liveCount: number;
  costCents: number;
  investorCents: number;
  byCategory: Record<string, RollupBucket>;
  byMonth: Record<string, RollupBucket>;
  byDay: Record<string, RollupBucket>;
  revision: number;
  updatedAt?: unknown;
};

export type ExpenseTotalsOverlay = {
  hidden: boolean;
  costCents: number;
  investorCents: number;
  liveCount: number;
  documentCount: number;
  periodCents: number;
  periodCount: number;
  categories: Array<{ key: string; amount: number; count: number }>;
  source: 'rollup' | 'ledger' | 'hidden';
  ledgerWins: boolean;
};

type ExpenseLike = Record<string, unknown>;

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNonNegInt(value: unknown): value is number {
  return isInt(value) && value >= 0;
}

export function categoryKey(expense: ExpenseLike | null | undefined): string {
  const raw = String((expense && expense.category) || '').trim() || 'uncategorized';
  return raw.replace(/\//g, '_').slice(0, 80);
}

export function formatYmdInTimeZone(date: Date, timeZone = LEDGER_ROLLUP_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

function timestampToDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && typeof (value as { seconds?: number }).seconds === 'number') {
    const date = new Date((value as { seconds: number }).seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** Form date first (YYYY-MM-DD as written). Timestamps use Sydney, not the function's US clock. */
export function expenseCalendarYmd(expense: ExpenseLike | null | undefined): string | null {
  if (!expense) return null;
  if (typeof expense.date === 'string') {
    const ymd = expense.date.trim().slice(0, 10);
    if (YMD.test(ymd)) return ymd;
  }
  const instant = timestampToDate(expense.timestamp);
  if (!instant) return null;
  const ymd = formatYmdInTimeZone(instant);
  return YMD.test(ymd) ? ymd : null;
}

function addBucket(map: Record<string, RollupBucket>, key: string, cents: number) {
  const current = map[key] || { cents: 0, count: 0 };
  current.cents += cents;
  current.count += 1;
  map[key] = current;
}

function sortBucketMap(map: Record<string, RollupBucket>): Record<string, RollupBucket> {
  const out: Record<string, RollupBucket> = {};
  Object.keys(map).sort().forEach((key) => {
    out[key] = { cents: map[key].cents, count: map[key].count };
  });
  return out;
}

function isBucket(value: unknown): value is RollupBucket {
  if (!value || typeof value !== 'object') return false;
  const row = value as RollupBucket;
  return isNonNegInt(row.cents) && isNonNegInt(row.count);
}

function isBucketMap(value: unknown, keyPattern: RegExp): value is Record<string, RollupBucket> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value as Record<string, unknown>).every(
    ([key, bucket]) => key.length > 0 && key.length <= 80 && keyPattern.test(key) && isBucket(bucket),
  );
}

const CATEGORY_KEY = /^[^\s].{0,79}$/;

export function parseCompleteRollup(value: unknown): LedgerRollup | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.schemaVersion !== LEDGER_ROLLUP_SCHEMA_VERSION) return null;
  if (!isNonNegInt(row.documentCount)) return null;
  if (!isNonNegInt(row.liveCount)) return null;
  if (!isNonNegInt(row.costCents)) return null;
  if (!isNonNegInt(row.investorCents)) return null;
  if (!isNonNegInt(row.revision)) return null;
  if (row.liveCount > row.documentCount) return null;
  if (!isBucketMap(row.byCategory, CATEGORY_KEY)) return null;
  if (!isBucketMap(row.byMonth, YEAR_MONTH)) return null;
  if (!isBucketMap(row.byDay, YMD)) return null;
  const keys = Object.keys(row);
  const allowed = new Set([
    'schemaVersion',
    'documentCount',
    'liveCount',
    'costCents',
    'investorCents',
    'byCategory',
    'byMonth',
    'byDay',
    'revision',
    'updatedAt',
  ]);
  if (keys.some((key) => !allowed.has(key))) return null;
  return {
    schemaVersion: LEDGER_ROLLUP_SCHEMA_VERSION,
    documentCount: row.documentCount,
    liveCount: row.liveCount,
    costCents: row.costCents,
    investorCents: row.investorCents,
    byCategory: sortBucketMap(row.byCategory as Record<string, RollupBucket>),
    byMonth: sortBucketMap(row.byMonth as Record<string, RollupBucket>),
    byDay: sortBucketMap(row.byDay as Record<string, RollupBucket>),
    revision: row.revision,
    updatedAt: row.updatedAt,
  };
}

export function isCompleteRollup(value: unknown): value is LedgerRollup {
  return parseCompleteRollup(value) != null;
}

export function emptyLedgerRollup(revision = 0): LedgerRollup {
  return {
    schemaVersion: LEDGER_ROLLUP_SCHEMA_VERSION,
    documentCount: 0,
    liveCount: 0,
    costCents: 0,
    investorCents: 0,
    byCategory: {},
    byMonth: {},
    byDay: {},
    revision,
  };
}

export function computeLedgerRollup(
  expenses: Array<ExpenseLike | null | undefined> = [],
  revision = 0,
): LedgerRollup {
  const byCategory: Record<string, RollupBucket> = {};
  const byDay: Record<string, RollupBucket> = {};
  let documentCount = 0;
  let liveCount = 0;
  let costCents = 0;
  let investorCents = 0;

  (expenses || []).forEach((expense) => {
    if (!expense) return;
    documentCount += 1;
    if (isVoidExpense(expense)) return;
    liveCount += 1;
    const amount = getExpenseTotalCents(expense);
    if (isInvestorExpense(expense)) investorCents += amount;
    else costCents += amount;
    addBucket(byCategory, categoryKey(expense), amount);
    const ymd = expenseCalendarYmd(expense);
    if (ymd) addBucket(byDay, ymd, amount);
  });

  const byMonth: Record<string, RollupBucket> = {};
  Object.entries(byDay).forEach(([ymd, bucket]) => {
    const month = ymd.slice(0, 7);
    const current = byMonth[month] || { cents: 0, count: 0 };
    current.cents += bucket.cents;
    current.count += bucket.count;
    byMonth[month] = current;
  });

  return {
    schemaVersion: LEDGER_ROLLUP_SCHEMA_VERSION,
    documentCount,
    liveCount,
    costCents,
    investorCents,
    byCategory: sortBucketMap(byCategory),
    byMonth: sortBucketMap(byMonth),
    byDay: sortBucketMap(byDay),
    revision,
  };
}

function moneyShape(rollup: LedgerRollup) {
  return {
    documentCount: rollup.documentCount,
    liveCount: rollup.liveCount,
    costCents: rollup.costCents,
    investorCents: rollup.investorCents,
    byCategory: rollup.byCategory,
    byMonth: rollup.byMonth,
    byDay: rollup.byDay,
  };
}

export function rollupsAgree(left: unknown, right: unknown): boolean {
  const a = parseCompleteRollup(left);
  const b = parseCompleteRollup(right);
  if (!a || !b) return false;
  return JSON.stringify(moneyShape(a)) === JSON.stringify(moneyShape(b));
}

/**
 * Write the whole rollup or throw before the store changes.
 * Callers pass a write() that either persists the complete object or throws.
 */
export function commitCompleteRollup(
  payload: unknown,
  write: (next: LedgerRollup) => void,
): LedgerRollup {
  const next = parseCompleteRollup(payload);
  if (!next) {
    throw new Error('Refusing to write an incomplete rollup');
  }
  write(next);
  return next;
}

/** Compare-and-set on revision so a stale full recompute cannot clobber a newer one. */
export function commitRollupIfRevisionUnchanged(
  current: LedgerRollup | null,
  expectedRevision: number,
  payload: unknown,
  write: (next: LedgerRollup) => void,
): boolean {
  const currentRev = current && isNonNegInt(current.revision) ? current.revision : 0;
  if (currentRev !== expectedRevision) return false;
  const parsed = parseCompleteRollup(payload);
  if (!parsed) {
    throw new Error('Refusing to write an incomplete rollup');
  }
  write({ ...parsed, revision: expectedRevision + 1 });
  return true;
}

function ymdToNaiveDate(ymd: string): Date | null {
  const match = ymd.match(YMD);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eachYmd(start: Date, endExclusive: Date): string[] {
  const out: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor < endExclusive) {
    out.push(toYmd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function periodYmds(
  period: string,
  now: Date = new Date(),
  timeZone = LEDGER_ROLLUP_TIME_ZONE,
): string[] {
  const today = ymdToNaiveDate(formatYmdInTimeZone(now, timeZone));
  if (!today) return [];
  if (period === 'week') {
    const start = new Date(today);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return eachYmd(start, end);
  }
  if (period === 'quarter') {
    const quarter = Math.floor(today.getMonth() / 3);
    const start = new Date(today.getFullYear(), quarter * 3, 1);
    const end = new Date(today.getFullYear(), quarter * 3 + 3, 1);
    return eachYmd(start, end);
  }
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return eachYmd(start, end);
}

export function periodFromRollup(
  rollup: LedgerRollup,
  period: string,
  now: Date = new Date(),
): { cents: number; count: number } {
  let cents = 0;
  let count = 0;
  periodYmds(period, now).forEach((ymd) => {
    const bucket = rollup.byDay[ymd];
    if (!bucket) return;
    cents += bucket.cents;
    count += bucket.count;
  });
  return { cents, count };
}

function categoriesFromRollup(rollup: LedgerRollup): Array<{ key: string; amount: number; count: number }> {
  return Object.entries(rollup.byCategory)
    .map(([key, bucket]) => ({
      key,
      amount: fromCents(bucket.cents),
      count: bucket.count,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function overlayFromRollup(
  rollup: LedgerRollup,
  period: string,
  now: Date,
  source: 'rollup' | 'ledger',
  ledgerWins: boolean,
): ExpenseTotalsOverlay {
  const periodSpend = periodFromRollup(rollup, period, now);
  return {
    hidden: false,
    costCents: rollup.costCents,
    investorCents: rollup.investorCents,
    liveCount: rollup.liveCount,
    documentCount: rollup.documentCount,
    periodCents: periodSpend.cents,
    periodCount: periodSpend.count,
    categories: categoriesFromRollup(rollup),
    source,
    ledgerWins,
  };
}

const HIDDEN_TOTALS: ExpenseTotalsOverlay = {
  hidden: true,
  costCents: 0,
  investorCents: 0,
  liveCount: 0,
  documentCount: 0,
  periodCents: 0,
  periodCount: 0,
  categories: [],
  source: 'hidden',
  ledgerWins: false,
};

export function resolveExpenseTotals(options: {
  rollup?: unknown;
  expenses?: Array<ExpenseLike | null | undefined>;
  expensesCapped?: boolean;
  expensesLoaded?: boolean;
  period?: string;
  now?: Date;
}): ExpenseTotalsOverlay {
  const period = options.period || 'month';
  const now = options.now || new Date();
  const parsedRollup = parseCompleteRollup(options.rollup);
  const capped = Boolean(options.expensesCapped);
  const loaded = options.expensesLoaded !== false;
  const expenses = options.expenses || [];

  if (capped) {
    if (parsedRollup) return overlayFromRollup(parsedRollup, period, now, 'rollup', false);
    return HIDDEN_TOTALS;
  }

  if (!loaded) {
    if (parsedRollup) return overlayFromRollup(parsedRollup, period, now, 'rollup', false);
    return overlayFromRollup(computeLedgerRollup(expenses), period, now, 'ledger', false);
  }

  const fromLedger = computeLedgerRollup(expenses);
  if (!parsedRollup) {
    return overlayFromRollup(fromLedger, period, now, 'ledger', false);
  }
  if (rollupsAgree(parsedRollup, fromLedger)) {
    return overlayFromRollup(parsedRollup, period, now, 'rollup', false);
  }
  return overlayFromRollup(fromLedger, period, now, 'ledger', true);
}

type JobMetricsLike = {
  cash: { paid: number; invoiced: number; outstanding: number; cost: number | null };
  expenseCount: number;
  hasMargin: boolean;
  margin: number | null;
  marginPct: number | null;
  verdict: string;
  periodSpend: number | null;
  periodCount: number | null;
  categories: Array<{ key: string; amount: number; count: number }>;
  expensesCapped: boolean;
  jobKind?: string;
  ledgerWins?: boolean;
  totalsSource?: ExpenseTotalsOverlay['source'];
  [key: string]: unknown;
};

export function overlayExpenseTotals<T extends JobMetricsLike>(
  metrics: T,
  overlay: ExpenseTotalsOverlay,
): T & { ledgerWins: boolean; totalsSource: ExpenseTotalsOverlay['source'] } {
  if (overlay.hidden) {
    return {
      ...metrics,
      cash: { ...metrics.cash, cost: null },
      expensesCapped: true,
      periodSpend: null,
      periodCount: null,
      categories: [],
      ledgerWins: false,
      totalsSource: 'hidden',
    };
  }

  const cost = fromCents(overlay.costCents);
  const cash = { ...metrics.cash, cost };
  const ownBuild = metrics.jobKind === 'own';
  const margin = ownBuild
    ? { hasMargin: false, margin: null as number | null, marginPct: null as number | null }
    : deriveMargin(cash.paid, cost);
  const verdict = ownBuild
    ? VERDICT.OWN_BUILD
    : deriveVerdict({ hasMargin: margin.hasMargin, marginPct: margin.marginPct });

  return {
    ...metrics,
    cash,
    expenseCount: overlay.liveCount,
    hasMargin: margin.hasMargin,
    margin: margin.margin,
    marginPct: margin.marginPct,
    verdict,
    periodSpend: fromCents(overlay.periodCents),
    periodCount: overlay.periodCount,
    categories: overlay.categories,
    expensesCapped: false,
    ledgerWins: overlay.ledgerWins,
    totalsSource: overlay.source,
  };
}

export function liveSpendCents(overlay: ExpenseTotalsOverlay): number | null {
  if (overlay.hidden) return null;
  return overlay.costCents + overlay.investorCents;
}
