import { addCents, fromCents, labourCents, lineCents, parseToCents } from '../money';
import { parseCalendarDate } from '../dates';
import { normalizeJobKind } from '../domain/jobKind';

/**
 * Read-only derived job metrics.
 * Every figure comes from stored expense / invoice fields. No writes.
 *
 * Money is integer cents internally, converted once for display.
 * Margin $ = paid invoice totals − cost to date
 * Margin % = margin / paid invoice totals, only when paid > 0
 * Verdict is computed, never stored.
 */

export const MARGIN_AT_RISK_PCT = 8;
export const CATEGORY_TREND_MIN_PCT = 15;
export const CATEGORY_TREND_MIN_EACH_MONTH = 2;

export const VERDICT = {
  ON_TRACK: 'on-track',
  MARGIN_AT_RISK: 'margin-at-risk',
  GETTING_STARTED: 'getting-started',
  OWN_BUILD: 'own-build',
};

export function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function parseRecordDate(value) {
  return parseCalendarDate(value);
}

function moneyCents(value) {
  try {
    return parseToCents(value);
  } catch (error) {
    return 0;
  }
}

export function isVoidExpense(expense) {
  return String((expense && expense.status) || '').toLowerCase() === 'void';
}

function expenseMoneyCents(expense) {
  if (!expense) return 0;
  if (Number.isInteger(expense.totalCents)) return expense.totalCents;
  if (expense.total != null && expense.total !== '') return moneyCents(expense.total);
  if (expense.amount != null && expense.amount !== '') return moneyCents(expense.amount);
  if (expense.cost != null && expense.cost !== '') return moneyCents(expense.cost);
  if (expense.totalPrice != null && expense.totalPrice !== '') return moneyCents(expense.totalPrice);
  if (expense.category === 'labour' && expense.hours != null && expense.rate != null) {
    return labourCents(expense.hours, expense.rate);
  }
  if (expense.quantity != null && expense.unitCost != null) {
    return lineCents(expense.quantity, expense.unitCost);
  }
  return 0;
}

export function getExpenseTotalCents(expense) {
  if (!expense || isVoidExpense(expense)) return 0;
  return expenseMoneyCents(expense);
}

export function getExpenseTotal(expense) {
  return fromCents(getExpenseTotalCents(expense));
}

/** Amount stored on the row, even when the expense is void. */
export function getExpenseFaceTotal(expense) {
  return fromCents(expenseMoneyCents(expense));
}

export function getExpenseFaceTotalCents(expense) {
  return expenseMoneyCents(expense);
}

export function getInvoiceTotalCents(invoice) {
  if (!invoice || isVoidInvoice(invoice)) return 0;
  if (Number.isInteger(invoice.totalCents)) return invoice.totalCents;
  return moneyCents(invoice && invoice.total);
}

export function getInvoiceTotal(invoice) {
  return fromCents(getInvoiceTotalCents(invoice));
}

export function isVoidInvoice(invoice) {
  return String((invoice && invoice.status) || '').toLowerCase() === 'void';
}

export function isPaidInvoice(invoice) {
  if (isVoidInvoice(invoice)) return false;
  return String((invoice && invoice.status) || '').toLowerCase() === 'paid';
}

export function invoiceHasDate(invoice) {
  return parseRecordDate(invoice && invoice.invoiceDate) != null;
}

export function expenseHasReceipt(expense) {
  return Boolean((expense && expense.receiptImageUrl) || (expense && expense.receiptImagePath));
}

export function expenseDate(expense) {
  if (!expense) return null;
  // Same rule as History: receipt/form date first, then created timestamp.
  return parseRecordDate(expense.date) || parseRecordDate(expense.timestamp);
}

export function inCalendarPeriod(date, period, now) {
  if (!isValidDate(date) || !isValidDate(now)) return false;
  if (period === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return date >= start && date < end;
  }
  if (period === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3);
    return date.getFullYear() === now.getFullYear() && Math.floor(date.getMonth() / 3) === quarter;
  }
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

export function isInvoiceOverdue(invoice, now = new Date()) {
  if (!invoice || isPaidInvoice(invoice) || isVoidInvoice(invoice)) return false;
  const due = parseRecordDate(invoice.dueDate);
  if (!due) return false;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return dueDay < today;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function previousMonthKey(now) {
  const prior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return monthKey(prior);
}

export function reviewedFieldInUse(expenses) {
  return (expenses || []).some((expense) => expense.reviewed === true || expense.reviewed === false);
}

export function deriveCash(invoices = [], expenses = []) {
  const liveInvoices = (invoices || []).filter((invoice) => !isVoidInvoice(invoice));
  const liveExpenses = (expenses || []).filter((expense) => !isVoidExpense(expense));
  const invoiced = fromCents(addCents(...liveInvoices.map((invoice) => getInvoiceTotalCents(invoice)), 0));
  const paid = fromCents(addCents(
    ...liveInvoices.filter(isPaidInvoice).map((invoice) => getInvoiceTotalCents(invoice)),
    0,
  ));
  const cost = fromCents(addCents(...liveExpenses.map((expense) => getExpenseTotalCents(expense)), 0));
  return {
    invoiced,
    paid,
    outstanding: invoiced - paid,
    cost,
  };
}

export function deriveMargin(paid, cost) {
  if (!(paid > 0)) {
    return { hasMargin: false, margin: null, marginPct: null };
  }
  const margin = paid - cost;
  return {
    hasMargin: true,
    margin,
    marginPct: (margin / paid) * 100,
  };
}

export function deriveVerdict({ hasMargin, marginPct }) {
  if (!hasMargin) return VERDICT.GETTING_STARTED;
  if (!Number.isFinite(marginPct) || marginPct < MARGIN_AT_RISK_PCT) {
    return VERDICT.MARGIN_AT_RISK;
  }
  return VERDICT.ON_TRACK;
}

export function deriveCategorySpend(expenses = []) {
  const grouped = new Map();
  (expenses || []).filter((expense) => !isVoidExpense(expense)).forEach((expense) => {
    const key = String(expense.category || '').trim() || 'uncategorized';
    const current = grouped.get(key) || { key, amount: 0, count: 0 };
    current.amount += getExpenseTotal(expense);
    current.count += 1;
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
}

export function deriveCategoryTrend(expenses = [], now = new Date()) {
  const thisKey = monthKey(now);
  const lastKey = previousMonthKey(now);
  const buckets = new Map();

  (expenses || []).filter((expense) => !isVoidExpense(expense)).forEach((expense) => {
    // Trend only uses the form/receipt date, never created-at timestamp.
    const dated = parseRecordDate(expense && expense.date);
    if (!dated) return;
    const category = String(expense.category || '').trim();
    if (!category) return;
    const key = monthKey(dated);
    if (key !== thisKey && key !== lastKey) return;
    const amount = getExpenseTotal(expense);
    const bucket = buckets.get(category) || {
      category,
      thisAmount: 0,
      lastAmount: 0,
      thisCount: 0,
      lastCount: 0,
    };
    if (key === thisKey) {
      bucket.thisAmount += amount;
      bucket.thisCount += 1;
    } else {
      bucket.lastAmount += amount;
      bucket.lastCount += 1;
    }
    buckets.set(category, bucket);
  });

  let best = null;
  buckets.forEach((bucket) => {
    if (
      bucket.thisCount < CATEGORY_TREND_MIN_EACH_MONTH ||
      bucket.lastCount < CATEGORY_TREND_MIN_EACH_MONTH ||
      !(bucket.lastAmount > 0)
    ) {
      return;
    }
    const pct = ((bucket.thisAmount - bucket.lastAmount) / bucket.lastAmount) * 100;
    if (pct < CATEGORY_TREND_MIN_PCT) return;
    if (!best || pct > best.pct) {
      best = {
        category: bucket.category,
        pct,
        thisAmount: bucket.thisAmount,
        lastAmount: bucket.lastAmount,
      };
    }
  });
  return best;
}

export function deriveAttentionItems({ expenses = [], invoices = [] } = {}, now = new Date()) {
  const items = [];
  const liveExpenses = (expenses || []).filter((expense) => !isVoidExpense(expense));
  const missingDateInvoices = (invoices || []).filter((invoice) => !invoiceHasDate(invoice));
  if (missingDateInvoices.length > 0) {
    items.push({
      id: 'invoices-missing-dates',
      page: 'new-invoice',
      title:
        missingDateInvoices.length === 1
          ? '1 invoice is missing a date'
          : `${missingDateInvoices.length} invoices are missing dates`,
      detail: "They can't age or be reported until dated",
      action: 'Add dates',
      tone: 'warn',
    });
  }

  const overdueInvoices = (invoices || []).filter((invoice) => isInvoiceOverdue(invoice, now));
  if (overdueInvoices.length > 0) {
    const overdueTotal = overdueInvoices.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);
    items.push({
      id: 'invoices-overdue',
      page: 'new-invoice',
      title:
        overdueInvoices.length === 1
          ? '1 invoice is overdue'
          : `${overdueInvoices.length} invoices are overdue`,
      detail: `${formatMoney(overdueTotal)} still unpaid past the due date`,
      action: 'Review',
      tone: 'warn',
    });
  }

  const noReceipt = liveExpenses.filter((expense) => !expenseHasReceipt(expense));
  if (noReceipt.length > 0) {
    const total = noReceipt.reduce((sum, expense) => sum + getExpenseTotal(expense), 0);
    items.push({
      id: 'expenses-no-receipt',
      page: 'history',
      title:
        noReceipt.length === 1
          ? '1 expense has no receipt'
          : `${noReceipt.length} expenses have no receipt`,
      detail: `${formatMoney(total)} without a stored photo`,
      action: 'Upload',
      tone: 'neutral',
    });
  }

  const uncategorized = liveExpenses.filter(
    (expense) => !expense.category && !expense.tradeName
  );
  if (uncategorized.length > 0) {
    items.push({
      id: 'expenses-uncategorized',
      page: 'history',
      title:
        uncategorized.length === 1
          ? '1 expense has no category'
          : `${uncategorized.length} expenses have no category`,
      detail: 'They are left out of the category breakdown until labelled',
      action: 'Review',
      tone: 'neutral',
    });
  }

  if (reviewedFieldInUse(liveExpenses)) {
    const unreviewed = liveExpenses.filter((expense) => expense.reviewed !== true);
    if (unreviewed.length > 0) {
      items.push({
        id: 'expenses-unreviewed',
        page: 'history',
        title:
          unreviewed.length === 1
            ? '1 expense still needs review'
            : `${unreviewed.length} expenses still need review`,
        detail: 'Marked as not yet reviewed',
        action: 'Review',
        tone: 'neutral',
      });
    }
  }

  const trend = deriveCategoryTrend(liveExpenses, now);
  if (trend) {
    items.push({
      id: 'category-trend',
      page: 'history',
      title: `${categoryLabel(trend.category)} spend is up ${Math.round(trend.pct)}% this month`,
      detail: `${formatMoney(trend.thisAmount)} this month, against ${formatMoney(trend.lastAmount)} last month`,
      action: 'Review',
      tone: 'neutral',
      category: trend.category,
    });
  }

  return items;
}

function categoryLabel(key) {
  const labels = {
    labour: 'Labour',
    trade: 'Trade',
    equipment: 'Equipment',
    service: 'Service',
    purchase: 'Materials',
    materials: 'Materials',
    installation: 'Installation',
  };
  return labels[String(key || '').toLowerCase()] || key || 'This category';
}

export function formatMoney(amount, { cents = false } = {}) {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  }).format(amount);
}

export function formatMoneyCompact(amount) {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1000000) {
    const value = abs / 1000000;
    const digits = value >= 10 ? 1 : 2;
    return `${sign}$${value.toFixed(digits).replace(/\.0$/, '')}M`;
  }
  if (abs >= 10000) {
    return `${sign}$${Math.round(abs / 1000)}k`;
  }
  return formatMoney(amount);
}

export function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${Number(value).toFixed(1)}%`;
}

export function periodLabel(period) {
  if (period === 'week') return 'This week';
  if (period === 'quarter') return 'This quarter';
  return 'This month';
}

export function deriveJobMetrics({ expenses = [], invoices = [] } = {}, options = {}) {
  const now = options.now || new Date();
  const period = options.period || 'month';
  const expensesCapped = Boolean(options.expensesCapped);
  const jobKind = normalizeJobKind(options.jobKind);
  const liveInvoices = (invoices || []).filter((invoice) => !isVoidInvoice(invoice));
  const liveExpenses = (expenses || []).filter((expense) => !isVoidExpense(expense));
  const cash = deriveCash(liveInvoices, liveExpenses);
  if (expensesCapped) {
    cash.cost = null;
  }
  const ownBuild = jobKind === 'own';
  const capped = expensesCapped || ownBuild
    ? { hasMargin: false, margin: null, marginPct: null }
    : deriveMargin(cash.paid, cash.cost);
  const { hasMargin, margin, marginPct } = capped;
  const overdueCount = liveInvoices.filter((invoice) => isInvoiceOverdue(invoice, now)).length;
  const periodExpenses = liveExpenses.filter((expense) => {
    const dated = expenseDate(expense);
    return dated && inCalendarPeriod(dated, period, now);
  });
  const periodSpend = expensesCapped
    ? null
    : fromCents(addCents(...periodExpenses.map((expense) => getExpenseTotalCents(expense)), 0));
  const attentionItems = deriveAttentionItems({
    expenses: liveExpenses,
    invoices: liveInvoices,
  }, now);
  const invalidCount = liveExpenses.filter((expense) => expense && expense._invalid).length
    + (invoices || []).filter((invoice) => invoice && invoice._invalid).length;
  if (invalidCount > 0) {
    attentionItems.unshift({
      id: 'invalid-records',
      page: 'history',
      title: invalidCount === 1 ? '1 record needs checking' : `${invalidCount} records need checking`,
      detail: 'They did not match the expected shape. They are listed, not dropped.',
      action: 'Review',
      tone: 'warn',
    });
  }
  const verdict = ownBuild
    ? VERDICT.OWN_BUILD
    : (expensesCapped ? VERDICT.GETTING_STARTED : deriveVerdict({ hasMargin, marginPct }));
  const categories = expensesCapped ? [] : deriveCategorySpend(liveExpenses);

  return {
    expenseCount: liveExpenses.length,
    invoiceCount: liveInvoices.length,
    cash,
    hasMargin,
    margin,
    marginPct,
    verdict,
    overdueCount,
    periodSpend,
    periodCount: expensesCapped ? null : periodExpenses.length,
    attentionItems,
    attentionCount: attentionItems.length,
    categories,
    recent: liveExpenses.slice(0, 4),
    expensesCapped,
    jobKind,
  };
}

export function derivePortfolio(jobRows = []) {
  const jobs = jobRows || [];
  const withMargin = jobs.filter((row) => row.metrics && row.metrics.hasMargin);
  const paid = withMargin.reduce((sum, row) => sum + row.metrics.cash.paid, 0);
  const cost = withMargin.reduce((sum, row) => sum + row.metrics.cash.cost, 0);
  const { hasMargin, margin, marginPct } = deriveMargin(paid, cost);
  const contracts = jobs.reduce((sum, row) => sum + ((row.metrics && row.metrics.cash.paid) || 0), 0);
  const needAttention = jobs.reduce(
    (sum, row) => sum + ((row.metrics && row.metrics.attentionCount) || 0),
    0
  );
  return {
    activeJobs: jobs.length,
    contracts: contracts > 0 ? contracts : null,
    hasMargin,
    margin,
    marginPct,
    needAttention,
  };
}

export function verdictCopy(verdict) {
  if (verdict === VERDICT.MARGIN_AT_RISK) {
    return { label: 'Margin at risk', tone: 'warn' };
  }
  if (verdict === VERDICT.GETTING_STARTED) {
    return { label: 'Getting started', tone: 'new' };
  }
  if (verdict === VERDICT.OWN_BUILD) {
    return { label: 'Own build', tone: 'ok' };
  }
  return { label: 'On track', tone: 'ok' };
}

export function jobSubtitle({ clients = [], invoices = [], metrics } = {}) {
  const billed = (clients || []).find((row) => row && String(row.email || '').includes('@'))
    || (clients || []).find((row) => row && (row.name || row.clientName));
  const clientName = (billed && (billed.name || billed.clientName))
    || (invoices || []).find((invoice) => invoice.clientName && String(invoice.clientName).trim())?.clientName;
  const address = billed && billed.address ? String(billed.address).trim() : '';
  const suburb = suburbFromAddress(address);

  if (clientName && suburb) return `${clientName} · ${suburb}`;
  if (clientName) return clientName;

  const expenseCount = (metrics && metrics.expenseCount) || 0;
  if (!expenseCount && !(metrics && metrics.invoiceCount)) return 'No records yet';
  if (metrics && metrics.verdict === VERDICT.GETTING_STARTED) {
    return expenseCount ? `${expenseCount} expenses so far` : 'Getting started';
  }
  return expenseCount ? `${expenseCount} expenses` : `${metrics.invoiceCount} invoices`;
}

function suburbFromAddress(address) {
  if (!address || !address.includes(',')) return '';
  const parts = address.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return '';
  return parts[parts.length - 1];
}

export function jobMark(name) {
  const trimmed = String(name || '').trim();
  const digits = trimmed.match(/^(\d+)/);
  if (digits) return digits[1].slice(0, 3);
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase() || '?';
}

export function bannerMessage(metrics) {
  const copy = verdictCopy(metrics.verdict);
  const overdue = metrics.overdueCount > 0
    ? metrics.overdueCount === 1
      ? '1 invoice is overdue'
      : `${metrics.overdueCount} invoices are overdue`
    : 'nothing is overdue';
  const tidy = metrics.attentionCount === 0
    ? 'Nothing else needs tidying up.'
    : metrics.attentionCount === 1
      ? 'One small thing needs tidying up.'
      : `${metrics.attentionCount} small things need tidying up.`;

  if (metrics.expensesCapped) {
    return {
      ...copy,
      line: 'There are more than 1,000 expenses on this job, so margin is not shown. A missing number is honest; a wrong one is not.',
    };
  }

  if (metrics.verdict === VERDICT.GETTING_STARTED) {
    return {
      ...copy,
      line: `There is no paid invoice total yet, so margin cannot be shown. ${tidy}`,
    };
  }

  if (metrics.verdict === VERDICT.OWN_BUILD) {
    return {
      ...copy,
      line: metrics.expensesCapped
        ? 'This is your own build. Spend is hidden until the job can be totalled in full.'
        : 'This is your own build, so there is no client margin to show. Cost against the plan is the number that matters.',
    };
  }

  const moneyBit = `${formatMoney(metrics.margin)} (${formatPercent(metrics.marginPct)})`;
  if (metrics.margin < 0) {
    return {
      ...copy,
      line: `Cost is ahead of paid invoices by ${moneyBit.replace('-', '')}, and ${overdue}. ${tidy}`,
    };
  }
  return {
    ...copy,
    lineParts: { moneyBit, overdue, tidy },
    line: `You are making ${moneyBit} on this job, and ${overdue}. ${tidy}`,
  };
}

export function contractSubtitle(cash) {
  if (!cash || (!(cash.paid > 0) && !(cash.invoiced > 0))) return 'No invoices yet';
  if (cash.outstanding === 0 && cash.invoiced > 0) return 'Invoiced, fully paid';
  if (cash.paid > 0 && cash.outstanding > 0) {
    return `${formatMoney(cash.paid)} paid of ${formatMoney(cash.invoiced)} invoiced`;
  }
  if (cash.paid > 0) return 'From paid invoices';
  return `${formatMoney(cash.invoiced)} invoiced, none paid`;
}
