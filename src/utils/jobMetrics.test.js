import {
  CATEGORY_TREND_MIN_PCT,
  MARGIN_AT_RISK_PCT,
  VERDICT,
  bannerMessage,
  deriveAttentionItems,
  deriveCash,
  deriveCategoryTrend,
  deriveJobMetrics,
  deriveMargin,
  derivePortfolio,
  deriveVerdict,
  formatMoney,
  expenseDate,
  getExpenseFaceTotalCents,
  getExpenseTotal,
  invoiceHasDate,
  isInvoiceOverdue,
  parseRecordDate,
  reviewedFieldInUse,
} from './jobMetrics';

const now = new Date('2026-08-23T12:00:00+10:00');

describe('parseRecordDate', () => {
  test('rejects empty and Invalid Date strings', () => {
    expect(parseRecordDate(null)).toBeNull();
    expect(parseRecordDate('')).toBeNull();
    expect(parseRecordDate('Invalid Date')).toBeNull();
  });

  test('accepts ISO strings and Date objects', () => {
    const date = parseRecordDate('2026-08-01');
    expect(date.getFullYear()).toBe(2026);
    expect(parseRecordDate(new Date('2026-08-01')).getFullYear()).toBe(2026);
  });

  test('accepts Firestore-like timestamps', () => {
    const date = parseRecordDate({ seconds: 1750000000, nanoseconds: 0 });
    expect(date).toBeInstanceOf(Date);
  });
});

describe('expenseDate', () => {
  test('prefers form date, then timestamp, and skips Invalid Date', () => {
    expect(expenseDate({ date: 'Invalid Date', timestamp: new Date(2026, 6, 4) }).getMonth()).toBe(6);
    expect(expenseDate({ date: new Date(2026, 7, 1), timestamp: new Date(2026, 6, 4) }).getMonth()).toBe(7);
    expect(expenseDate({})).toBeNull();
  });

  test('this-month spend can use timestamp when form date is missing', () => {
    const metrics = deriveJobMetrics({
      expenses: [{ total: 40, timestamp: now, receiptImageUrl: 'x', category: 'purchase' }],
      invoices: [],
    }, { now, period: 'month' });
    expect(metrics.periodSpend).toBe(40);
    expect(metrics.periodCount).toBe(1);
  });
});

describe('getExpenseTotal', () => {
  test('prefers total, then amount, then labour hours × rate', () => {
    expect(getExpenseTotal({ total: '12.5' })).toBe(12.5);
    expect(getExpenseTotal({ amount: 40 })).toBe(40);
    expect(getExpenseTotal({ category: 'labour', hours: 8, rate: 50 })).toBe(400);
    expect(getExpenseTotal({ quantity: 2, unitCost: '3.5' })).toBe(7);
    expect(getExpenseTotal({})).toBe(0);
  });

  test('the Firestore boundary keeps labour and quantity totals in cents', () => {
    expect(getExpenseFaceTotalCents({ category: 'labour', hours: 8, rate: 50 })).toBe(40000);
    expect(getExpenseFaceTotalCents({ quantity: 2, unitCost: '3.5' })).toBe(700);
    expect(getExpenseFaceTotalCents({ totalCents: 1234, total: 99 })).toBe(1234);
  });
});

describe('margin and verdict', () => {
  test('no paid invoices means no margin and Getting started', () => {
    const cash = deriveCash([{ total: 100, status: 'draft' }], [{ total: 20 }]);
    expect(cash.paid).toBe(0);
    expect(cash.cost).toBe(20);
    const margin = deriveMargin(cash.paid, cash.cost);
    expect(margin.hasMargin).toBe(false);
    expect(margin.margin).toBeNull();
    expect(deriveVerdict(margin)).toBe(VERDICT.GETTING_STARTED);
  });

  test('paid minus cost is the margin, never a fake zero', () => {
    const margin = deriveMargin(1000, 881);
    expect(margin.hasMargin).toBe(true);
    expect(margin.margin).toBe(119);
    expect(margin.marginPct).toBeCloseTo(11.9, 5);
    expect(deriveVerdict(margin)).toBe(VERDICT.ON_TRACK);
  });

  test(`margin below ${MARGIN_AT_RISK_PCT}% is at risk, including losses`, () => {
    expect(deriveVerdict(deriveMargin(1000, 960))).toBe(VERDICT.MARGIN_AT_RISK);
    expect(deriveVerdict(deriveMargin(1000, 1100))).toBe(VERDICT.MARGIN_AT_RISK);
  });
});

describe('attention items', () => {
  test('flags invoices with missing dates and does not invent overdue from a missing due date', () => {
    const invoices = [
      { total: 50, status: 'sent', invoiceDate: 'Invalid Date' },
      { total: 20, status: 'sent', invoiceDate: '2026-01-01' },
    ];
    const items = deriveAttentionItems({ invoices, expenses: [] }, now);
    expect(items.some((item) => item.id === 'invoices-missing-dates')).toBe(true);
    expect(items.some((item) => item.id === 'invoices-overdue')).toBe(false);
    expect(invoiceHasDate(invoices[0])).toBe(false);
    expect(isInvoiceOverdue(invoices[1], now)).toBe(false);
  });

  test('flags overdue unpaid invoices with a real due date', () => {
    const invoices = [
      { total: 80, status: 'sent', invoiceDate: '2026-01-01', dueDate: '2026-02-01' },
      { total: 80, status: 'paid', invoiceDate: '2026-01-01', dueDate: '2026-02-01' },
    ];
    expect(isInvoiceOverdue(invoices[0], now)).toBe(true);
    expect(isInvoiceOverdue(invoices[1], now)).toBe(false);
    const items = deriveAttentionItems({ invoices, expenses: [] }, now);
    expect(items.some((item) => item.id === 'invoices-overdue')).toBe(true);
  });

  test('flags missing receipts and uncategorised expenses', () => {
    const expenses = [
      { total: 10, category: 'purchase' },
      { total: 5, category: 'trade', receiptImageUrl: 'https://example' },
      { total: 7 },
    ];
    const items = deriveAttentionItems({ expenses, invoices: [] }, now);
    expect(items.find((item) => item.id === 'expenses-no-receipt').title).toMatch(/2 expenses/);
    expect(items.some((item) => item.id === 'expenses-uncategorized')).toBe(true);
  });

  test('skips unreviewed unless the reviewed field is actually in use', () => {
    const unused = [{ total: 1, category: 'trade' }];
    expect(reviewedFieldInUse(unused)).toBe(false);
    expect(deriveAttentionItems({ expenses: unused, invoices: [] }, now).some((item) => item.id === 'expenses-unreviewed')).toBe(false);

    const used = [
      { total: 1, category: 'trade', reviewed: true },
      { total: 2, category: 'trade', reviewed: false },
    ];
    expect(reviewedFieldInUse(used)).toBe(true);
    expect(deriveAttentionItems({ expenses: used, invoices: [] }, now).some((item) => item.id === 'expenses-unreviewed')).toBe(true);
  });

  test('skips category trend when the sample is too small', () => {
    const expenses = [
      { category: 'purchase', total: 100, date: '2026-08-02' },
      { category: 'purchase', total: 100, date: '2026-07-02' },
    ];
    expect(deriveCategoryTrend(expenses, now)).toBeNull();
  });

  test(`reports a category trend only with dated spend in both months and >= ${CATEGORY_TREND_MIN_PCT}%`, () => {
    const expenses = [
      { category: 'purchase', total: 100, date: '2026-07-01' },
      { category: 'purchase', total: 100, date: '2026-07-15' },
      { category: 'purchase', total: 150, date: '2026-08-01' },
      { category: 'purchase', total: 150, date: '2026-08-10' },
    ];
    const trend = deriveCategoryTrend(expenses, now);
    expect(trend.category).toBe('purchase');
    expect(trend.pct).toBe(50);
  });
});

describe('void invoices and the expense cap', () => {
  test('void invoices are excluded from cash and overdue', () => {
    const cash = deriveCash(
      [
        { total: 100, status: 'paid' },
        { total: 50, status: 'void' },
      ],
      [{ total: 20 }],
    );
    expect(cash.paid).toBe(100);
    expect(cash.invoiced).toBe(100);
    expect(cash.cost).toBe(20);
  });

  test('void expenses are excluded from cash and margin', () => {
    const cash = deriveCash(
      [{ total: 100, status: 'paid' }],
      [
        { total: 20 },
        { total: 80, status: 'void' },
      ],
    );
    expect(cash.cost).toBe(20);
    const metrics = deriveJobMetrics({
      expenses: [{ total: 20 }, { total: 80, status: 'void' }],
      invoices: [{ total: 100, status: 'paid', invoiceDate: '2026-01-01' }],
    }, { now });
    expect(metrics.cash.cost).toBe(20);
    expect(metrics.hasMargin).toBe(true);
    expect(metrics.margin).toBe(80);
  });

  test('refuses margin when the 1,000 expense cap is hit', () => {
    const metrics = deriveJobMetrics({
      expenses: [{ total: 20 }],
      invoices: [{ total: 100, status: 'paid', invoiceDate: '2026-01-01' }],
    }, { now, expensesCapped: true });
    expect(metrics.hasMargin).toBe(false);
    expect(metrics.margin).toBeNull();
    expect(metrics.cash.cost).toBeNull();
    expect(formatMoney(metrics.cash.cost)).toBe('—');
    expect(metrics.categories).toEqual([]);
    expect(bannerMessage(metrics).line).toMatch(/1,000 expenses/);
  });
});

describe('deriveJobMetrics and portfolio', () => {
  test('Getting started job shows em-dash margin, not $0', () => {
    const metrics = deriveJobMetrics({
      expenses: [{ total: 25, date: '2026-08-01', category: 'purchase', receiptImageUrl: 'x' }],
      invoices: [],
    }, { now });
    expect(metrics.verdict).toBe(VERDICT.GETTING_STARTED);
    expect(metrics.hasMargin).toBe(false);
    expect(formatMoney(metrics.margin)).toBe('—');
    expect(bannerMessage(metrics).label).toBe('Getting started');
  });

  test('portfolio combined margin only uses jobs that have paid invoices', () => {
    const started = deriveJobMetrics({
      expenses: [{ total: 500, date: '2026-08-01', category: 'purchase', receiptImageUrl: 'x' }],
      invoices: [],
    }, { now });
    const tracking = deriveJobMetrics({
      expenses: [{ total: 881, date: '2026-08-01', category: 'purchase', receiptImageUrl: 'x' }],
      invoices: [{ total: 1000, status: 'paid', invoiceDate: '2026-01-01' }],
    }, { now });
    const portfolio = derivePortfolio([
      { metrics: started },
      { metrics: tracking },
    ]);
    expect(portfolio.activeJobs).toBe(2);
    expect(portfolio.contracts).toBe(1000);
    expect(portfolio.hasMargin).toBe(true);
    expect(portfolio.margin).toBe(119);
  });
});
