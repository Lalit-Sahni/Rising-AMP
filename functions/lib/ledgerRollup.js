'use strict';

/**
 * Keep in sync with src/domain/ledgerRollup.ts.
 * Cloud Function and the recompute script use this copy so they do not
 * import the Vite TypeScript graph.
 */

const LEDGER_ROLLUP_COLLECTION = 'ledgerRollup';
const LEDGER_ROLLUP_DOC_ID = 'current';
const LEDGER_ROLLUP_SCHEMA_VERSION = 1;
const LEDGER_ROLLUP_TIME_ZONE = 'Australia/Sydney';
const MAINTAIN_LEDGER_ROLLUP_FUNCTION = 'maintainLedgerRollup';

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/;
const CATEGORY_KEY = /^[^\s].{0,79}$/;

function isInt(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNonNegInt(value) {
  return isInt(value) && value >= 0;
}

function parseQuantity(input) {
  if (input == null || input === '') return 0;
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  const n = Number(String(input).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function toCents(input) {
  if (input == null || input === '') return 0;
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return 0;
    return Math.round(input * 100);
  }
  let raw = String(input).trim();
  if (!raw) return 0;
  const parenNeg = /^\(.*\)$/.test(raw);
  raw = raw.replace(/[$,\s]/g, '').replace(/[()]/g, '');
  if (!raw || raw === '-' || raw === '.') return 0;
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  const amount = Math.round(n * 100);
  return parenNeg ? -Math.abs(amount) : amount;
}

function isVoidExpense(expense) {
  return String((expense && expense.status) || '').toLowerCase() === 'void';
}

function isInvestorExpense(expense) {
  if (!expense) return false;
  const tradeId = String(expense.tradeId || '').trim();
  if (tradeId === 'investor') return true;
  return String(expense.category || '').toLowerCase().trim() === 'investor';
}

function expenseMoneyCents(expense) {
  if (!expense) return 0;
  if (Number.isInteger(expense.totalCents)) return expense.totalCents;
  if (expense.total != null && expense.total !== '') return toCents(expense.total);
  if (expense.amount != null && expense.amount !== '') return toCents(expense.amount);
  if (expense.cost != null && expense.cost !== '') return toCents(expense.cost);
  if (expense.totalPrice != null && expense.totalPrice !== '') return toCents(expense.totalPrice);
  if (expense.category === 'labour' && expense.hours != null && expense.rate != null) {
    return Math.round(parseQuantity(expense.hours) * toCents(expense.rate));
  }
  if (expense.quantity != null && expense.unitCost != null) {
    return Math.round(parseQuantity(expense.quantity) * toCents(expense.unitCost));
  }
  return 0;
}

function categoryKey(expense) {
  const raw = String((expense && expense.category) || '').trim() || 'uncategorized';
  return raw.replace(/\//g, '_').slice(0, 80);
}

function formatYmdInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: timeZone || LEDGER_ROLLUP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year') && parts.find((part) => part.type === 'year').value;
  const month = parts.find((part) => part.type === 'month') && parts.find((part) => part.type === 'month').value;
  const day = parts.find((part) => part.type === 'day') && parts.find((part) => part.type === 'day').value;
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

function timestampToDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function expenseCalendarYmd(expense) {
  if (!expense) return null;
  if (typeof expense.date === 'string') {
    const ymd = expense.date.trim().slice(0, 10);
    if (YMD.test(ymd)) return ymd;
  }
  const instant = timestampToDate(expense.timestamp);
  if (!instant) return null;
  const ymd = formatYmdInTimeZone(instant, LEDGER_ROLLUP_TIME_ZONE);
  return YMD.test(ymd) ? ymd : null;
}

function addBucket(map, key, cents) {
  const current = map[key] || { cents: 0, count: 0 };
  current.cents += cents;
  current.count += 1;
  map[key] = current;
}

function sortBucketMap(map) {
  const out = {};
  Object.keys(map).sort().forEach((key) => {
    out[key] = { cents: map[key].cents, count: map[key].count };
  });
  return out;
}

function isBucket(value) {
  if (!value || typeof value !== 'object') return false;
  return isNonNegInt(value.cents) && isNonNegInt(value.count);
}

function isBucketMap(value, keyPattern) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, bucket]) => key.length > 0 && key.length <= 80 && keyPattern.test(key) && isBucket(bucket),
  );
}

function parseCompleteRollup(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.schemaVersion !== LEDGER_ROLLUP_SCHEMA_VERSION) return null;
  if (!isNonNegInt(value.documentCount)) return null;
  if (!isNonNegInt(value.liveCount)) return null;
  if (!isNonNegInt(value.costCents)) return null;
  if (!isNonNegInt(value.investorCents)) return null;
  if (!isNonNegInt(value.revision)) return null;
  if (value.liveCount > value.documentCount) return null;
  if (!isBucketMap(value.byCategory, CATEGORY_KEY)) return null;
  if (!isBucketMap(value.byMonth, YEAR_MONTH)) return null;
  if (!isBucketMap(value.byDay, YMD)) return null;
  const allowed = {
    schemaVersion: true,
    documentCount: true,
    liveCount: true,
    costCents: true,
    investorCents: true,
    byCategory: true,
    byMonth: true,
    byDay: true,
    revision: true,
    updatedAt: true,
  };
  if (Object.keys(value).some((key) => !allowed[key])) return null;
  return {
    schemaVersion: LEDGER_ROLLUP_SCHEMA_VERSION,
    documentCount: value.documentCount,
    liveCount: value.liveCount,
    costCents: value.costCents,
    investorCents: value.investorCents,
    byCategory: sortBucketMap(value.byCategory),
    byMonth: sortBucketMap(value.byMonth),
    byDay: sortBucketMap(value.byDay),
    revision: value.revision,
    updatedAt: value.updatedAt,
  };
}

function isCompleteRollup(value) {
  return parseCompleteRollup(value) != null;
}

function emptyLedgerRollup(revision) {
  return {
    schemaVersion: LEDGER_ROLLUP_SCHEMA_VERSION,
    documentCount: 0,
    liveCount: 0,
    costCents: 0,
    investorCents: 0,
    byCategory: {},
    byMonth: {},
    byDay: {},
    revision: revision || 0,
  };
}

function computeLedgerRollup(expenses, revision) {
  const byCategory = {};
  const byDay = {};
  let documentCount = 0;
  let liveCount = 0;
  let costCents = 0;
  let investorCents = 0;

  (expenses || []).forEach((expense) => {
    if (!expense) return;
    documentCount += 1;
    if (isVoidExpense(expense)) return;
    liveCount += 1;
    const amount = expenseMoneyCents(expense);
    if (isInvestorExpense(expense)) investorCents += amount;
    else costCents += amount;
    addBucket(byCategory, categoryKey(expense), amount);
    const ymd = expenseCalendarYmd(expense);
    if (ymd) addBucket(byDay, ymd, amount);
  });

  const byMonth = {};
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
    revision: revision || 0,
  };
}

function moneyShape(rollup) {
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

function rollupsAgree(left, right) {
  const a = parseCompleteRollup(left);
  const b = parseCompleteRollup(right);
  if (!a || !b) return false;
  return JSON.stringify(moneyShape(a)) === JSON.stringify(moneyShape(b));
}

function commitCompleteRollup(payload, write) {
  const next = parseCompleteRollup(payload);
  if (!next) {
    throw new Error('Refusing to write an incomplete rollup');
  }
  write(next);
  return next;
}

function commitRollupIfRevisionUnchanged(current, expectedRevision, payload, write) {
  const currentRev = current && isNonNegInt(current.revision) ? current.revision : 0;
  if (currentRev !== expectedRevision) return false;
  const parsed = parseCompleteRollup(payload);
  if (!parsed) {
    throw new Error('Refusing to write an incomplete rollup');
  }
  write(Object.assign({}, parsed, { revision: expectedRevision + 1 }));
  return true;
}

function firestorePayload(rollup, updatedAt) {
  const complete = parseCompleteRollup(rollup);
  if (!complete) {
    throw new Error('Refusing to write an incomplete rollup');
  }
  const payload = {
    schemaVersion: complete.schemaVersion,
    documentCount: complete.documentCount,
    liveCount: complete.liveCount,
    costCents: complete.costCents,
    investorCents: complete.investorCents,
    byCategory: complete.byCategory,
    byMonth: complete.byMonth,
    byDay: complete.byDay,
    revision: complete.revision,
  };
  if (updatedAt !== undefined) payload.updatedAt = updatedAt;
  return payload;
}

module.exports = {
  LEDGER_ROLLUP_COLLECTION,
  LEDGER_ROLLUP_DOC_ID,
  LEDGER_ROLLUP_SCHEMA_VERSION,
  LEDGER_ROLLUP_TIME_ZONE,
  MAINTAIN_LEDGER_ROLLUP_FUNCTION,
  categoryKey,
  formatYmdInTimeZone,
  expenseCalendarYmd,
  parseCompleteRollup,
  isCompleteRollup,
  emptyLedgerRollup,
  computeLedgerRollup,
  rollupsAgree,
  commitCompleteRollup,
  commitRollupIfRevisionUnchanged,
  firestorePayload,
};
