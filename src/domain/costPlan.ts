import { addCents, cents, type Cents } from '../money';
import { expenseDate, getExpenseTotalCents, isVoidExpense } from '../utils/jobMetrics';
import type { CostPlan, CostPlanLine, CostPlanQuote, CostPlanSection, TradeListItem } from './schemas';
import {
  APP_TRADES,
  COST_PLAN_DOC_ID,
  INVESTOR_TRADE_ID,
  NOT_IN_ESTIMATE_TRADE_ID,
  UNCODED_TRADE_ID,
  canCodeExpenses,
  hasActiveCostPlan,
  isInvestorExpense,
  planHasTrades,
} from './costPlanCore';

export {
  APP_TRADES,
  COST_PLAN_DOC_ID,
  INVESTOR_TRADE_ID,
  NOT_IN_ESTIMATE_TRADE_ID,
  UNCODED_TRADE_ID,
  canCodeExpenses,
  hasActiveCostPlan,
  isInvestorExpense,
  planHasTrades,
};
export type { AppTradeId } from './costPlanCore';

export const QUOTE_OVER_PLAN_RATIO = 1.2;
export const UNCODED_STALE_DAYS = 14;

export type CostPlanProgress = {
  targetCents: Cents;
  spentCents: Cents | null;
  leftCents: Cents | null;
  percent: number | null;
  barPercent: number;
  overTarget: boolean | null;
  expensesCapped: boolean;
};

export function deriveCostPlanProgressFromSpent(
  targetCents: number,
  spentCents: number | null,
): CostPlanProgress {
  const target = cents(targetCents);
  if (spentCents == null) {
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

  const spent = cents(Math.round(Number(spentCents) || 0));
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

export function deriveCostPlanProgress(
  targetCents: number,
  expenses: Array<Record<string, unknown>> = [],
  expensesCapped = false,
): CostPlanProgress {
  if (expensesCapped) {
    return deriveCostPlanProgressFromSpent(targetCents, null);
  }

  const spent = addCents(
    ...expenses
      .filter((expense) => !isInvestorExpense(expense))
      .map((expense) => getExpenseTotalCents(expense)),
    0,
  );
  return deriveCostPlanProgressFromSpent(targetCents, spent);
}

export function convertGstCents(
  amountCents: number,
  fromMode: 'inclusive' | 'exclusive',
  toMode: 'inclusive' | 'exclusive',
): Cents {
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  if (fromMode === toMode) return cents(amount);
  if (fromMode === 'exclusive' && toMode === 'inclusive') {
    return cents(Math.round((amount * 11) / 10));
  }
  return cents(Math.round((amount * 10) / 11));
}

/** Add 10% GST onto imported trade amounts and their line items. */
export function applyGstToPlanSections(
  sections: CostPlanSection[],
  addGst: boolean,
): CostPlanSection[] {
  if (!addGst) return sections;
  return sections.map((section) => ({
    ...section,
    amountCents: convertGstCents(section.amountCents, 'exclusive', 'inclusive'),
    lines: section.lines?.map((line) => ({
      ...line,
      totalCents: convertGstCents(line.totalCents, 'exclusive', 'inclusive'),
      unitPriceCents: line.unitPriceCents == null
        ? line.unitPriceCents
        : convertGstCents(line.unitPriceCents, 'exclusive', 'inclusive'),
    })),
  }));
}

export function liveQuotes(quotes: CostPlanQuote[] = []): CostPlanQuote[] {
  return (quotes || []).filter((quote) => quote && quote.status !== 'void');
}

function quoteStatusRank(status: CostPlanQuote['status']): number {
  if (status === 'chosen') return 0;
  if (status === 'received') return 1;
  if (status === 'passed') return 2;
  return 3;
}

export function quotesForTrade(quotes: CostPlanQuote[] = [], tradeId: string): CostPlanQuote[] {
  return liveQuotes(quotes)
    .filter((quote) => (quote.allocations || []).some((row) => row.tradeId === tradeId))
    .sort((a, b) => quoteStatusRank(a.status) - quoteStatusRank(b.status));
}

export function quoteAllocationsSum(quote: Pick<CostPlanQuote, 'allocations'>): Cents {
  return addCents(
    ...(quote.allocations || []).map((row) => cents(Math.max(0, Math.round(row.amountCents || 0)))),
    0,
  );
}

export function allocationsCoverTotal(quote: Pick<CostPlanQuote, 'amountCents' | 'allocations'>): boolean {
  return quoteAllocationsSum(quote) === cents(quote.amountCents);
}

export function quoteForecastCents(
  quote: Pick<CostPlanQuote, 'amountCents' | 'amountHighCents'>,
): Cents {
  const high = quote.amountHighCents;
  if (Number.isInteger(high) && (high as number) > quote.amountCents) {
    return cents(high as number);
  }
  return cents(quote.amountCents);
}

export function allocationForecastCents(
  allocationCents: number,
  quote: Pick<CostPlanQuote, 'amountCents' | 'amountHighCents'>,
): Cents {
  const base = Math.max(0, Math.round(allocationCents || 0));
  const forecast = quoteForecastCents(quote);
  if (forecast === quote.amountCents || quote.amountCents <= 0) return cents(base);
  return cents(Math.round((base * forecast) / quote.amountCents));
}

export function mergeTradeList(orgTrades: TradeListItem[] = []): TradeListItem[] {
  const byId = new Map<string, TradeListItem>();
  APP_TRADES.forEach((trade, index) => {
    byId.set(trade.id, {
      id: trade.id,
      name: trade.name,
      order: index,
      isAppDefault: true,
      status: 'active',
    });
  });
  (orgTrades || []).forEach((trade) => {
    if (!trade || !trade.id) return;
    const existing = byId.get(trade.id);
    if (existing && trade.isAppDefault !== false) {
      byId.set(trade.id, {
        ...existing,
        ...trade,
        name: trade.name || existing.name,
        order: Number.isInteger(trade.order) ? trade.order : existing.order,
        isAppDefault: true,
      });
      return;
    }
    byId.set(trade.id, {
      id: trade.id,
      name: trade.name || 'Trade',
      order: Number.isInteger(trade.order) ? trade.order : byId.size,
      isAppDefault: Boolean(trade.isAppDefault),
      status: trade.status === 'archived' ? 'archived' : 'active',
    });
  });
  return Array.from(byId.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function activeTrades(orgTrades: TradeListItem[] = []): TradeListItem[] {
  return mergeTradeList(orgTrades).filter((trade) => trade.status !== 'archived');
}

export function tradeNameById(orgTrades: TradeListItem[] = [], tradeId: string): string {
  if (tradeId === NOT_IN_ESTIMATE_TRADE_ID) return 'Not in the estimate';
  if (tradeId === INVESTOR_TRADE_ID) return 'Investor';
  const match = mergeTradeList(orgTrades).find((trade) => trade.id === tradeId);
  return match?.name || tradeId;
}

export function expenseTradeId(expense: Record<string, unknown> | null | undefined): string | null {
  const value = expense && expense.tradeId;
  if (value == null) return null;
  const id = String(value).trim();
  return id || null;
}

export function isCodedExpense(expense: Record<string, unknown> | null | undefined): boolean {
  return Boolean(expenseTradeId(expense));
}

function liveExpenses(expenses: Array<Record<string, unknown>> = []) {
  return (expenses || []).filter((expense) => expense && !isVoidExpense(expense));
}

const TRADE_ALIASES: Record<string, string[]> = {
  electrical: ['electrician', 'sparky'],
  plumbing: ['plumber'],
  carpentry: ['carpenter'],
  painting: ['painter'],
  roofing: ['roofer'],
  concreting: ['concreter', 'concrete'],
  brickwork: ['bricks', 'masonry', 'bricklayer'],
  hvac: ['aircon', 'air-conditioning'],
  'kitchen-joinery': ['joinery', 'kitchen'],
  plastering: ['plasterer'],
  'tiling-flooring': ['tiler', 'flooring'],
};

function tradeMatchesHint(trade: { id: string; name: string }, hint: string): boolean {
  const name = String(trade.name || '').trim().toLowerCase();
  if (name.length >= 4 && hint.includes(name)) return true;
  const words = name.split(/[^a-z0-9]+/).filter((word) => word.length >= 5);
  if (words.some((word) => hint.includes(word))) return true;
  const aliases = TRADE_ALIASES[trade.id] || [];
  return aliases.some((alias) => alias.length >= 4 && hint.includes(alias));
}

function expenseHint(expense: Record<string, unknown>): string {
  return [
    expense.supplier,
    expense.tradeName,
    expense.tradeCategory,
    expense.provider,
    expense.workerName,
    expense.itemName,
    expense.equipmentName,
    expense.serviceName,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean)
    .join(' ');
}

export function suggestTradeForExpense(
  expense: Record<string, unknown> | null | undefined,
  trades: TradeListItem[] = [],
  codedExpenses: Array<Record<string, unknown>> = [],
): TradeListItem | null {
  if (!expense || isInvestorExpense(expense)) return null;
  const active = (trades || []).filter((trade) => trade && trade.status !== 'archived');
  const supplier = String(expense.supplier || expense.tradeName || expense.provider || '').trim().toLowerCase();
  if (supplier) {
    const prior = (codedExpenses || []).find((row) => {
      const priorId = expenseTradeId(row);
      if (!priorId || priorId === NOT_IN_ESTIMATE_TRADE_ID || priorId === INVESTOR_TRADE_ID) return false;
      const priorParty = String(row.supplier || row.tradeName || row.provider || '').trim().toLowerCase();
      return priorParty === supplier;
    });
    const priorId = expenseTradeId(prior || null);
    const fromPrior = priorId ? active.find((trade) => trade.id === priorId) : null;
    if (fromPrior) return fromPrior;
  }

  const hint = expenseHint(expense);
  if (!hint) return null;
  const matches = active.filter((trade) => tradeMatchesHint(trade, hint));
  if (matches.length === 1) return matches[0];
  return null;
}

export function sectionsFromTradeAmounts(
  amounts: Array<{ tradeId: string; name: string; amountCents: number; code?: string }>,
): CostPlanSection[] {
  return applyTradeAmountEdits([], amounts);
}

/** Keep imported line items when only the trade totals change. */
export function applyTradeAmountEdits(
  existing: CostPlanSection[],
  amounts: Array<{ tradeId: string; name: string; amountCents: number; code?: string }>,
): CostPlanSection[] {
  const byId = new Map(existing.map((section) => [section.tradeId, section]));
  return amounts
    .filter((row) => Number.isInteger(row.amountCents) && row.amountCents > 0)
    .map((row, index) => {
      const current = byId.get(row.tradeId);
      if (!current) {
        return {
          id: row.tradeId,
          tradeId: row.tradeId,
          code: row.code,
          name: row.name,
          order: index,
          amountCents: row.amountCents,
        };
      }
      return {
        ...current,
        name: row.name,
        order: index,
        amountCents: row.amountCents,
      };
    });
}

export function sumSectionAmounts(sections: CostPlanSection[] = []): Cents {
  return addCents(...(sections || []).map((section) => cents(Math.max(0, Math.round(section.amountCents || 0)))), 0);
}

export type CostPlanTradeStatus = 'not-started' | 'quoted' | 'in-progress' | 'done' | 'over';

export type CostPlanTradeRow = {
  tradeId: string;
  name: string;
  code?: string;
  order: number;
  estimatedCents: Cents;
  quotedCents: Cents | null;
  quoteRange: boolean;
  quoteCount: number;
  chosenParty: string | null;
  spentCents: Cents;
  expectedCents: Cents;
  expenseCount: number;
  status: CostPlanTradeStatus;
  lines: CostPlanLine[];
};

export type CostPlanExtraRow = {
  id: string;
  label: string;
  tradeId: string | null;
  spentCents: Cents;
};

export type CostPlanBoard = {
  expensesCapped: boolean;
  estimatedCents: Cents;
  spentCents: Cents | null;
  quotedCents: Cents | null;
  expectedCents: Cents | null;
  paidCents: Cents | null;
  quotedUnpaidCents: Cents | null;
  estimatedUnpaidCents: Cents | null;
  unquotedTradeCount: number;
  trades: CostPlanTradeRow[];
  uncoded: { count: number; spentCents: Cents; expenses: Array<Record<string, unknown>> };
  extras: { count: number; spentCents: Cents; rows: CostPlanExtraRow[] };
  investor: { count: number; spentCents: Cents; expenses: Array<Record<string, unknown>> };
};

function tradeStatus(row: {
  estimatedCents: number;
  quotedCents: number | null;
  spentCents: number;
  expectedCents: number;
  expenseCount: number;
}): CostPlanTradeStatus {
  const quotedOver = row.quotedCents != null
    && row.estimatedCents > 0
    && row.quotedCents > row.estimatedCents;
  const spentOver = row.expectedCents > 0 && row.spentCents > row.expectedCents;
  if (quotedOver || spentOver) return 'over';
  if (row.quotedCents != null && row.expenseCount === 0) return 'quoted';
  if (row.expenseCount === 0 && row.quotedCents == null) return 'not-started';
  if (row.expectedCents > 0 && row.spentCents >= row.expectedCents) return 'done';
  return 'in-progress';
}

export function deriveCostPlanBoard({
  plan,
  expenses = [],
  quotes = [],
  trades = [],
  expensesCapped = false,
}: {
  plan: CostPlan;
  expenses?: Array<Record<string, unknown>>;
  quotes?: CostPlanQuote[];
  trades?: TradeListItem[];
  expensesCapped?: boolean;
}): CostPlanBoard {
  const names = mergeTradeList(trades);
  const sections = [...(plan.sections || [])].sort((a, b) => a.order - b.order);
  const planGst = plan.gstMode || 'inclusive';
  const live = liveExpenses(expenses);
  const openQuotes = liveQuotes(quotes);
  const chosen = openQuotes.filter((quote) => quote.status === 'chosen');

  const spentByTrade = new Map<string, { cents: Cents; count: number }>();
  const uncodedExpenses: Array<Record<string, unknown>> = [];
  const extraExpenses: Array<Record<string, unknown>> = [];
  const investorExpenses: Array<Record<string, unknown>> = [];
  const sectionIds = new Set(sections.map((section) => section.tradeId));

  live.forEach((expense) => {
    const tradeId = expenseTradeId(expense);
    const amount = getExpenseTotalCents(expense);
    if (isInvestorExpense(expense)) {
      investorExpenses.push(expense);
      return;
    }
    if (!tradeId) {
      uncodedExpenses.push(expense);
      return;
    }
    if (tradeId === NOT_IN_ESTIMATE_TRADE_ID || !sectionIds.has(tradeId)) {
      extraExpenses.push(expense);
      return;
    }
    const current = spentByTrade.get(tradeId) || { cents: cents(0), count: 0 };
    spentByTrade.set(tradeId, {
      cents: cents(current.cents + amount),
      count: current.count + 1,
    });
  });

  const quoteByTrade = new Map<string, { forecast: Cents; count: number; range: boolean; party: string | null }>();
  openQuotes.forEach((quote) => {
    (quote.allocations || []).forEach((allocation) => {
      if (!sectionIds.has(allocation.tradeId)) return;
      const current = quoteByTrade.get(allocation.tradeId) || {
        forecast: cents(0),
        count: 0,
        range: false,
        party: null,
      };
      current.count += 1;
      quoteByTrade.set(allocation.tradeId, current);
    });
  });
  chosen.forEach((quote) => {
    const inPlan = convertGstCents(quoteForecastCents(quote), quote.gstMode, planGst);
    (quote.allocations || []).forEach((allocation) => {
      if (!sectionIds.has(allocation.tradeId)) return;
      const share = quote.amountCents > 0
        ? Math.round((allocation.amountCents * inPlan) / quote.amountCents)
        : 0;
      const current = quoteByTrade.get(allocation.tradeId) || {
        forecast: cents(0),
        count: 0,
        range: false,
        party: null,
      };
      quoteByTrade.set(allocation.tradeId, {
        forecast: cents(current.forecast + share),
        count: current.count,
        range: current.range || Boolean(quote.amountHighCents && quote.amountHighCents > quote.amountCents),
        party: current.party || quote.party || null,
      });
    });
  });

  const tradeRows: CostPlanTradeRow[] = sections.map((section) => {
    const spent = spentByTrade.get(section.tradeId) || { cents: cents(0), count: 0 };
    const quoted = quoteByTrade.get(section.tradeId);
    const quotedCents = quoted && chosen.some((quote) => (
      (quote.allocations || []).some((row) => row.tradeId === section.tradeId)
    ))
      ? quoted.forecast
      : null;
    const expected = quotedCents != null ? quotedCents : cents(section.amountCents);
    return {
      tradeId: section.tradeId,
      name: tradeNameById(names, section.tradeId) || section.name,
      code: section.code,
      order: section.order,
      estimatedCents: cents(section.amountCents),
      quotedCents,
      quoteRange: Boolean(quoted?.range),
      quoteCount: quoted?.count || 0,
      chosenParty: quoted?.party || null,
      spentCents: spent.cents,
      expectedCents: expected,
      expenseCount: spent.count,
      status: tradeStatus({
        estimatedCents: section.amountCents,
        quotedCents,
        spentCents: spent.cents,
        expectedCents: expected,
        expenseCount: spent.count,
      }),
      lines: section.lines || [],
    };
  });

  const extraByTrade = new Map<string, CostPlanExtraRow>();
  extraExpenses.forEach((expense) => {
    const tradeId = expenseTradeId(expense);
    const key = tradeId || 'extra';
    const current = extraByTrade.get(key) || {
      id: key,
      label: tradeId && tradeId !== NOT_IN_ESTIMATE_TRADE_ID
        ? tradeNameById(names, tradeId)
        : (String(expense.itemName || expense.tradeName || expense.supplier || expense.serviceName || 'Extra').trim() || 'Extra'),
      tradeId: tradeId === NOT_IN_ESTIMATE_TRADE_ID ? null : tradeId,
      spentCents: cents(0),
    };
    extraByTrade.set(key, {
      ...current,
      spentCents: cents(current.spentCents + getExpenseTotalCents(expense)),
    });
  });

  const uncodedSpent = addCents(...uncodedExpenses.map((expense) => getExpenseTotalCents(expense)), 0);
  const extrasSpent = addCents(...extraExpenses.map((expense) => getExpenseTotalCents(expense)), 0);
  const investorSpent = addCents(...investorExpenses.map((expense) => getExpenseTotalCents(expense)), 0);
  const estimated = sections.length > 0 ? sumSectionAmounts(sections) : cents(plan.targetCents);
  const quotedTotal = addCents(...tradeRows.map((row) => row.quotedCents || 0), 0);
  const tradesExpected = addCents(...tradeRows.map((row) => row.expectedCents), 0);
  const spentTotal = addCents(
    ...live
      .filter((expense) => !isInvestorExpense(expense))
      .map((expense) => getExpenseTotalCents(expense)),
    0,
  );
  const quotedUnpaid = addCents(
    ...tradeRows.map((row) => (
      row.quotedCents == null ? 0 : Math.max(0, row.quotedCents - row.spentCents)
    )),
    0,
  );
  const estimatedUnpaid = addCents(
    ...tradeRows.map((row) => (
      row.quotedCents != null ? 0 : Math.max(0, row.estimatedCents - row.spentCents)
    )),
    0,
  );

  if (expensesCapped) {
    return {
      expensesCapped: true,
      estimatedCents: estimated,
      spentCents: null,
      quotedCents: quotedTotal,
      expectedCents: null,
      paidCents: null,
      quotedUnpaidCents: null,
      estimatedUnpaidCents: null,
      unquotedTradeCount: tradeRows.filter((row) => row.quotedCents == null).length,
      trades: tradeRows.map((row) => ({ ...row, spentCents: cents(0), expenseCount: 0, status: row.quotedCents == null ? 'not-started' : 'quoted' })),
      uncoded: { count: 0, spentCents: cents(0), expenses: [] },
      extras: { count: 0, spentCents: cents(0), rows: [] },
      investor: { count: 0, spentCents: cents(0), expenses: [] },
    };
  }

  return {
    expensesCapped: false,
    estimatedCents: estimated,
    spentCents: spentTotal,
    quotedCents: quotedTotal,
    expectedCents: cents(tradesExpected + extrasSpent + uncodedSpent),
    paidCents: spentTotal,
    quotedUnpaidCents: quotedUnpaid,
    estimatedUnpaidCents: estimatedUnpaid,
    unquotedTradeCount: tradeRows.filter((row) => row.quotedCents == null).length,
    trades: tradeRows,
    uncoded: {
      count: uncodedExpenses.length,
      spentCents: uncodedSpent,
      expenses: uncodedExpenses,
    },
    extras: {
      count: extraExpenses.length,
      spentCents: extrasSpent,
      rows: Array.from(extraByTrade.values()),
    },
    investor: {
      count: investorExpenses.length,
      spentCents: investorSpent,
      expenses: investorExpenses,
    },
  };
}

export type CostPlanAttentionItem = {
  id: string;
  page: string;
  title: string;
  detail: string;
  action: string;
  tone: 'warn' | 'neutral';
};

function formatAudFromCents(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysOld(date: Date, now: Date): number {
  return Math.floor((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000);
}

export function deriveCostPlanAttention({
  plan,
  expenses = [],
  quotes = [],
  trades = [],
  expensesCapped = false,
}: {
  plan: CostPlan | null | undefined;
  expenses?: Array<Record<string, unknown>>;
  quotes?: CostPlanQuote[];
  trades?: TradeListItem[];
  expensesCapped?: boolean;
}, now = new Date()): CostPlanAttentionItem[] {
  if (!planHasTrades(plan) || expensesCapped) return [];
  const board = deriveCostPlanBoard({ plan, expenses, quotes, trades, expensesCapped });
  const items: CostPlanAttentionItem[] = [];
  const openQuotes = liveQuotes(quotes);
  const someQuotes = openQuotes.length > 0;
  const someCoded = liveExpenses(expenses).some((expense) => isCodedExpense(expense));

  const overPlan = board.trades.filter((row) => (
    row.quotedCents != null
    && row.estimatedCents > 0
    && row.quotedCents >= Math.round(row.estimatedCents * QUOTE_OVER_PLAN_RATIO)
  ));
  if (overPlan.length > 0) {
    const first = overPlan[0];
    items.push({
      id: 'cost-plan-quote-over',
      page: 'cost-plan',
      title: overPlan.length === 1
        ? `${first.name} is quoted well over plan`
        : `${overPlan.length} trades are quoted well over plan`,
      detail: `${first.name} ${formatAudFromCents(first.quotedCents || 0)} vs ${formatAudFromCents(first.estimatedCents)} estimated`,
      action: 'Review',
      tone: 'warn',
    });
  }

  const pastQuote = board.trades.filter((row) => (
    row.quotedCents != null && row.spentCents > row.quotedCents
  ));
  if (pastQuote.length > 0) {
    const first = pastQuote[0];
    items.push({
      id: 'cost-plan-paid-past-quote',
      page: 'cost-plan',
      title: pastQuote.length === 1
        ? `${first.name} is paid past its quote`
        : `${pastQuote.length} trades are paid past their quotes`,
      detail: `${formatAudFromCents(first.spentCents)} spent on a ${formatAudFromCents(first.quotedCents || 0)} quote`,
      action: 'Review',
      tone: 'warn',
    });
  }

  if (someCoded) {
    const stale = board.uncoded.expenses.filter((expense) => {
      const dated = expenseDate(expense);
      return dated != null && daysOld(dated, now) >= UNCODED_STALE_DAYS;
    });
    if (stale.length > 0) {
      items.push({
        id: 'cost-plan-uncoded-stale',
        page: 'history',
        title: stale.length === 1
          ? '1 expense has been uncoded for two weeks'
          : `${stale.length} expenses have been uncoded for two weeks`,
        detail: 'Section variances stay true, but the forecast has a pool sitting outside it.',
        action: 'Code',
        tone: 'neutral',
      });
    }
  }

  if (someQuotes) {
    const spendNoQuote = board.trades.filter((row) => row.expenseCount > 0 && row.quotedCents == null);
    if (spendNoQuote.length > 0) {
      const first = spendNoQuote[0];
      items.push({
        id: 'cost-plan-spend-no-quote',
        page: 'cost-plan',
        title: spendNoQuote.length === 1
          ? `${first.name} has spend and no quote`
          : `${spendNoQuote.length} trades have spend and no quote`,
        detail: 'Paying as it goes is fine. This is only a reminder that nothing is on file.',
        action: 'Add quote',
        tone: 'neutral',
      });
    }
  }

  return items;
}

export function withCostPlanAttention<T extends { attentionItems?: CostPlanAttentionItem[]; attentionCount?: number }>(
  metrics: T,
  input: Parameters<typeof deriveCostPlanAttention>[0],
  now = new Date(),
): T {
  const extra = deriveCostPlanAttention(input, now);
  if (!metrics || extra.length === 0) return metrics;
  const attentionItems = [...(metrics.attentionItems || []), ...extra];
  return {
    ...metrics,
    attentionItems,
    attentionCount: attentionItems.length,
  };
}

export function tradeStatusLabel(status: CostPlanTradeStatus): string {
  if (status === 'quoted') return 'Quoted';
  if (status === 'in-progress') return 'In progress';
  if (status === 'done') return 'Done';
  if (status === 'over') return 'Over';
  return 'Not started';
}
