import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { fromCents } from '../money';
import {
  commitCompleteRollup,
  commitRollupIfRevisionUnchanged,
  computeLedgerRollup,
  emptyLedgerRollup,
  expenseCalendarYmd,
  overlayExpenseTotals,
  parseCompleteRollup,
  periodFromRollup,
  resolveExpenseTotals,
  rollupsAgree,
} from './ledgerRollup';

const require = createRequire(import.meta.url);
const js = require('../../functions/lib/ledgerRollup.js') as {
  computeLedgerRollup: typeof computeLedgerRollup;
  rollupsAgree: typeof rollupsAgree;
};

const FIXTURES = [
  { id: 'a', total: 20, category: 'purchase', date: '2026-09-01' },
  { id: 'b', category: 'labour', hours: 8, rate: 50, date: '2026-09-01' },
  { id: 'c', quantity: 2, unitCost: '3.5', category: 'purchase', date: '2026-08-15' },
  { id: 'd', total: 1000, category: 'investor', date: '2026-09-02' },
  { id: 'e', total: 80, status: 'void', category: 'purchase', date: '2026-09-02' },
];

describe('computeLedgerRollup', () => {
  test('counts live rows, keeps investor off construction cost, and buckets by day', () => {
    const rollup = computeLedgerRollup(FIXTURES, 3);
    expect(rollup.documentCount).toBe(5);
    expect(rollup.liveCount).toBe(4);
    expect(rollup.costCents).toBe(2000 + 40000 + 700);
    expect(rollup.investorCents).toBe(100000);
    expect(rollup.byCategory.purchase.cents).toBe(2700);
    expect(rollup.byCategory.labour.cents).toBe(40000);
    expect(rollup.byCategory.investor.cents).toBe(100000);
    expect(rollup.byMonth['2026-09'].count).toBe(3);
    expect(rollup.byDay['2026-09-01'].count).toBe(2);
    expect(rollup.revision).toBe(3);
  });

  test('a UTC afternoon that is already tomorrow in Sydney lands on the Sydney day', () => {
    const ymd = expenseCalendarYmd({
      timestamp: new Date('2026-09-05T14:00:00.000Z'),
    });
    expect(ymd).toBe('2026-09-06');
  });

  test('TypeScript and the Cloud Function copy agree on the same expenses', () => {
    const ts = computeLedgerRollup(FIXTURES, 1);
    const fn = js.computeLedgerRollup(FIXTURES, 1);
    expect(rollupsAgree(ts, fn)).toBe(true);
    expect(js.rollupsAgree(ts, fn)).toBe(true);
  });
});

describe('do not half-write money totals', () => {
  test('refuses a payload that only has costCents', () => {
    let stored = emptyLedgerRollup(1);
    stored = { ...stored, costCents: 465600, liveCount: 5 };
    expect(parseCompleteRollup({ costCents: 99 })).toBeNull();
    expect(() => commitCompleteRollup({ costCents: 99 }, () => {
      stored = emptyLedgerRollup(99);
    })).toThrow(/incomplete rollup/);
    expect(stored.costCents).toBe(465600);
    expect(stored.liveCount).toBe(5);
  });

  test('a failed write leaves the previous complete document', () => {
    const previous = computeLedgerRollup(FIXTURES, 4);
    let stored = previous;
    const next = computeLedgerRollup(FIXTURES.slice(0, 1), 5);
    expect(() => commitCompleteRollup(next, () => {
      throw new Error('unavailable');
    })).toThrow('unavailable');
    expect(stored).toBe(previous);
    expect(stored.costCents).toBe(previous.costCents);
  });

  test('a complete set replaces the whole document at once', () => {
    let stored = emptyLedgerRollup(0);
    const next = computeLedgerRollup(FIXTURES, 1);
    commitCompleteRollup(next, (doc) => {
      stored = doc;
    });
    expect(stored.costCents).toBe(next.costCents);
    expect(stored.liveCount).toBe(next.liveCount);
    expect(stored.byCategory.labour.count).toBe(1);
  });

  test('a stale recompute does not overwrite a newer revision', () => {
    let stored = computeLedgerRollup(FIXTURES, 2);
    const stale = computeLedgerRollup(FIXTURES.slice(0, 2), 0);
    const wrote = commitRollupIfRevisionUnchanged(stored, 1, stale, (doc) => {
      stored = doc;
    });
    expect(wrote).toBe(false);
    expect(stored.revision).toBe(2);
    expect(stored.liveCount).toBe(4);
  });

  test('a matching revision writes the next complete revision', () => {
    let stored = computeLedgerRollup(FIXTURES.slice(0, 1), 1);
    const next = computeLedgerRollup(FIXTURES, 1);
    const wrote = commitRollupIfRevisionUnchanged(stored, 1, next, (doc) => {
      stored = doc;
    });
    expect(wrote).toBe(true);
    expect(stored.revision).toBe(2);
    expect(stored.liveCount).toBe(4);
  });
});

describe('resolveExpenseTotals', () => {
  test('uses the rollup when it matches the ledger', () => {
    const rollup = computeLedgerRollup(FIXTURES, 1);
    const overlay = resolveExpenseTotals({
      rollup,
      expenses: FIXTURES,
      expensesCapped: false,
      expensesLoaded: true,
      period: 'month',
      now: new Date(2026, 8, 5),
    });
    expect(overlay.source).toBe('rollup');
    expect(overlay.ledgerWins).toBe(false);
    expect(overlay.costCents).toBe(rollup.costCents);
    expect(overlay.periodCount).toBe(periodFromRollup(rollup, 'month', new Date(2026, 8, 5)).count);
  });

  test('ledger wins and the app says so when the rollup is wrong', () => {
    const rollup = computeLedgerRollup(FIXTURES, 1);
    const stale = { ...rollup, costCents: rollup.costCents + 1 };
    const overlay = resolveExpenseTotals({
      rollup: stale,
      expenses: FIXTURES,
      expensesCapped: false,
      expensesLoaded: true,
    });
    expect(overlay.source).toBe('ledger');
    expect(overlay.ledgerWins).toBe(true);
    expect(overlay.costCents).toBe(rollup.costCents);
  });

  test('a capped job without a rollup hides spend instead of a partial total', () => {
    const overlay = resolveExpenseTotals({
      rollup: null,
      expenses: FIXTURES,
      expensesCapped: true,
      expensesLoaded: true,
    });
    expect(overlay.hidden).toBe(true);
    expect(overlay.source).toBe('hidden');
  });

  test('an extra id field is not a complete stored rollup', () => {
    const rollup = computeLedgerRollup(FIXTURES, 1);
    expect(parseCompleteRollup({ ...rollup, id: 'current' })).toBeNull();
  });

  test('a capped job with a rollup still shows the complete total', () => {
    const rollup = computeLedgerRollup(FIXTURES, 1);
    const overlay = resolveExpenseTotals({
      rollup,
      expenses: FIXTURES.slice(0, 1),
      expensesCapped: true,
      expensesLoaded: true,
    });
    expect(overlay.hidden).toBe(false);
    expect(overlay.source).toBe('rollup');
    expect(overlay.costCents).toBe(rollup.costCents);
  });

  test('before the ledger has loaded, a rollup is used so cost does not flash as zero', () => {
    const rollup = computeLedgerRollup(FIXTURES, 1);
    const overlay = resolveExpenseTotals({
      rollup,
      expenses: [],
      expensesCapped: false,
      expensesLoaded: false,
    });
    expect(overlay.source).toBe('rollup');
    expect(overlay.costCents).toBe(rollup.costCents);
    expect(overlay.ledgerWins).toBe(false);
  });

  test('overlay puts construction cost on metrics and keeps invoice cash', () => {
    const overlay = resolveExpenseTotals({
      rollup: computeLedgerRollup(FIXTURES, 1),
      expenses: FIXTURES,
      expensesLoaded: true,
      now: new Date(2026, 8, 5),
    });
    const next = overlayExpenseTotals({
      cash: { invoiced: 1000, paid: 1000, outstanding: 0, cost: 0 },
      expenseCount: 0,
      hasMargin: false,
      margin: null,
      marginPct: null,
      verdict: 'getting-started',
      periodSpend: 0,
      periodCount: 0,
      categories: [],
      expensesCapped: false,
      jobKind: 'client',
    }, overlay);
    expect(next.cash.cost).toBe(fromCents(overlay.costCents));
    expect(next.cash.paid).toBe(1000);
    expect(next.expenseCount).toBe(4);
    expect(next.expensesCapped).toBe(false);
    expect(next.ledgerWins).toBe(false);
  });
});

describe('screens read the rollup for totals', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

  function read(relative: string) {
    return fs.readFileSync(path.join(root, relative), 'utf8');
  }

  test('Overview and Cost Plan overlay rollup totals', () => {
    const dashboard = read('src/components/pages/DashboardPage.js');
    expect(dashboard).toContain('useLedgerRollup');
    expect(dashboard).toContain('resolveExpenseTotals');
    expect(dashboard).toContain('overlayExpenseTotals');
    const costPlan = read('src/components/pages/CostPlanPage.tsx');
    expect(costPlan).toContain('useLedgerRollup');
    expect(costPlan).toContain('resolveExpenseTotals');
    expect(costPlan).toContain('deriveCostPlanProgressFromSpent');
  });

  test('Jobs home reads the rollup document, not the expense ledger', () => {
    const catalog = read('src/firebase/projectCatalog.js');
    expect(catalog).toContain('ledgerRollup');
    expect(catalog).not.toContain('fetchExpensesFromFirestore');
    const home = read('src/components/pages/JobsHomePage.js');
    expect(home).not.toContain('fetchExpensesFromFirestore');
    expect(home).not.toContain('loadInvitedJobSummaries');
  });

  test('the named function is maintainLedgerRollup', () => {
    const index = read('functions/index.js');
    expect(index).toContain('exports.maintainLedgerRollup');
    expect(index).toContain('onDocumentWritten');
    expect(index).toContain('recomputeLedgerRollupForJob');
    const maintain = read('functions/lib/maintainLedgerRollup.js');
    expect(maintain).toContain('commitRollupIfRevisionUnchanged');
    expect(maintain).toContain('tx.set');
  });
});
