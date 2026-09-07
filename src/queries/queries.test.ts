import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLedgerRollup, resolveExpenseTotals } from '../domain/ledgerRollup';
import { formatCents } from '../money';
import { findExpenses } from './expenses';
import { contentKey, findFiles } from './files';
import { invoicesByStatus } from './invoices';
import { planVsActual } from './plan';
import { quotesForTrade } from './quotes';
import { spendByCategory, spendByParty, spendByTrade } from './spend';
import { jobSummary, portfolioSummary } from './summary';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-a', 'job-b'] };

const EXPENSES_A = [
  { id: 'a1', total: 10, category: 'purchase', date: '2026-09-01', tradeId: 'concreting', partyId: 'party-mark' },
  { id: 'a2', total: 4, category: 'labour', date: '2026-09-02', partyId: 'party-sam' },
  { id: 'a3', total: 6, category: 'purchase', date: '2026-08-15', tradeId: 'carpentry' },
];

function jobSnap(
  jobId: string,
  expenses: Array<Record<string, unknown>> = EXPENSES_A,
  extra: Record<string, unknown> = {},
) {
  return {
    jobId,
    rollup: computeLedgerRollup(expenses, 4),
    expenses,
    expensesCapped: false,
    expensesLoaded: true,
    ...extra,
  };
}

describe('query layer schemas and membership', () => {
  test('rejects a job that is not on the invited list, including phase8-isolation', () => {
    const result = spendByTrade({
      scope: SCOPE,
      jobId: 'phase8-isolation',
      jobs: [jobSnap('phase8-isolation')],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('job_not_allowed');
  });

  test('org-wide spend ignores snapshot jobs that are not invited', () => {
    const isolation = [
      { id: 'x', total: 999, category: 'purchase', date: '2026-09-01', tradeId: 'concreting' },
    ];
    const result = spendByTrade({
      scope: { orgId: SCOPE.orgId, allowedJobIds: ['job-a'] },
      tradeId: 'concreting',
      jobs: [jobSnap('job-a'), jobSnap('phase8-isolation', isolation)],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cents).toBe(1000);
    expect(result.provenance.capped).toBe(false);
  });

  test('invalid calendar range is a typed error', () => {
    const result = spendByCategory({
      scope: SCOPE,
      jobId: 'job-a',
      from: '2026-09-10',
      to: '2026-09-01',
      jobs: [jobSnap('job-a')],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid_input');
  });

  test('missing org id is a typed error', () => {
    const result = jobSummary({
      scope: { orgId: '', allowedJobIds: ['job-a'] },
      jobId: 'job-a',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(['org_required', 'invalid_input']).toContain(result.error.code);
  });
});

describe('rollup-first spend', () => {
  test('painted cents stay byte-identical to the query helper', () => {
    const result = spendByTrade({
      scope: SCOPE,
      jobId: 'job-a',
      tradeId: 'concreting',
      jobs: [jobSnap('job-a')],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.is(result.cents, 1000)).toBe(true);
    const helperCents = JSON.stringify(result.cents);
    const expectedCents = JSON.stringify(1000);
    expect(helperCents).toBe(expectedCents);
    expect(Buffer.from(helperCents).equals(Buffer.from(expectedCents))).toBe(true);
    const painted = formatCents(result.cents);
    expect(painted).toBe(formatCents(1000));
    expect(Buffer.from(painted).equals(Buffer.from(formatCents(1000)))).toBe(true);
    expect(painted).not.toBe('$9,000,000.00');
  });

  test('spendByTrade reads byTrade from the rollup, including unassigned', () => {
    const result = spendByTrade({
      scope: SCOPE,
      jobId: 'job-a',
      jobs: [jobSnap('job-a')],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance.source).toBe('rollup');
    expect(result.provenance.revision).toBe(4);
    expect(result.provenance.capped).toBe(false);
    const concreting = result.buckets.find((row) => row.key === 'concreting');
    const unassigned = result.buckets.find((row) => row.key === 'unassigned');
    expect(concreting?.cents).toBe(1000);
    expect(unassigned?.cents).toBe(400);
  });

  test('spendByParty uses partyId buckets, never a typed name', () => {
    const result = spendByParty({
      scope: SCOPE,
      jobId: 'job-a',
      partyId: 'party-mark',
      jobs: [jobSnap('job-a')],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cents).toBe(1000);
    expect(result.buckets).toEqual([{ key: 'party-mark', cents: 1000, count: 1 }]);
    expect(result.provenance.source).toBe('rollup');
  });

  test('unassigned partyId is its own bucket', () => {
    const expenses = [
      { id: 'n', total: 8, category: 'purchase', date: '2026-09-01', supplier: 'Mark' },
    ];
    const result = spendByParty({
      scope: SCOPE,
      jobId: 'job-a',
      partyId: 'unassigned',
      jobs: [jobSnap('job-a', expenses)],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cents).toBe(800);
  });

  test('a date slice falls through to expense rows', () => {
    const result = spendByTrade({
      scope: SCOPE,
      jobId: 'job-a',
      tradeId: 'concreting',
      from: '2026-09-01',
      to: '2026-09-30',
      jobs: [jobSnap('job-a')],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.provenance.source).toBe('ledger');
    expect(result.cents).toBe(1000);
    expect(result.provenance.capped).toBe(false);
  });

  test('past 1,000 expenses with no rollup cannot answer', () => {
    const result = spendByCategory({
      scope: SCOPE,
      jobId: 'job-a',
      jobs: [{
        jobId: 'job-a',
        expenses: EXPENSES_A,
        expensesCapped: true,
        expensesLoaded: true,
      }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cents).toBeNull();
    expect(result.provenance.capped).toBe(true);
    expect(result.buckets).toEqual([]);
  });

  test('a complete rollup can still answer when the expense page is capped', () => {
    const result = spendByTrade({
      scope: SCOPE,
      jobId: 'job-a',
      tradeId: 'concreting',
      jobs: [jobSnap('job-a', EXPENSES_A, { expensesCapped: true })],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cents).toBe(1000);
    expect(result.provenance.capped).toBe(false);
    expect(result.provenance.source).toBe('rollup');
  });

  test('uncoded is live expenses with no stored tradeId — never a typed name', () => {
    const expenses = [
      { id: 'coded', total: 10, category: 'purchase', date: '2026-09-01', tradeId: 'concreting' },
      { id: 'named', total: 50, category: 'purchase', date: '2026-09-01', tradeName: 'Concreting' },
      { id: 'blank', total: 7, category: 'purchase', date: '2026-09-01', tradeId: '  ' },
      { id: 'voided', total: 99, category: 'purchase', date: '2026-09-01', status: 'void' },
    ];
    const result = spendByTrade({
      scope: SCOPE,
      jobId: 'job-a',
      tradeId: 'concreting',
      jobs: [jobSnap('job-a', expenses)],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cents).toBe(1000);
    expect(result.uncoded).toEqual({ count: 2, cents: 5700 });
    expect(result.affected).toBe(true);
  });

  test('a job with uncoded spend cannot omit the pool or set affected false', () => {
    const spend = spendByTrade({
      scope: SCOPE,
      jobId: 'job-a',
      tradeId: 'concreting',
      jobs: [jobSnap('job-a')],
    });
    expect(spend.ok).toBe(true);
    if (!spend.ok) return;
    expect(spend.cents).toBe(1000);
    expect(spend.uncoded.count).toBe(1);
    expect(spend.uncoded.cents).toBe(400);
    expect(spend.affected).toBe(true);

    const category = spendByCategory({
      scope: SCOPE,
      jobId: 'job-a',
      jobs: [jobSnap('job-a')],
    });
    expect(category.ok).toBe(true);
    if (!category.ok) return;
    expect(category.cents).toBe(2000);
    expect(category.uncoded).toEqual({ count: 1, cents: 400 });
    expect(category.affected).toBe(true);
  });

  test('investor rows are not the uncoded-to-trade pool', () => {
    const expenses = [
      { id: 'c', total: 10, category: 'purchase', date: '2026-09-01', tradeId: 'concreting' },
      { id: 'land', total: 50, category: 'investor', date: '2026-09-01' },
    ];
    const result = spendByTrade({
      scope: SCOPE,
      jobId: 'job-a',
      tradeId: 'concreting',
      jobs: [jobSnap('job-a', expenses)],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cents).toBe(1000);
    expect(result.uncoded).toEqual({ count: 0, cents: 0 });
    expect(result.affected).toBe(false);
  });

  test('job totals stay inclusive of uncoded spend', () => {
    const result = spendByTrade({
      scope: SCOPE,
      jobId: 'job-a',
      jobs: [jobSnap('job-a')],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.cents).toBe(2000);
    expect(result.uncoded.cents).toBe(400);
    expect(result.affected).toBe(true);
  });

  test('a fully coded job reports an empty uncoded pool', () => {
    const expenses = EXPENSES_A.filter((row) => row.tradeId);
    const result = spendByTrade({
      scope: SCOPE,
      jobId: 'job-a',
      tradeId: 'concreting',
      jobs: [jobSnap('job-a', expenses)],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.uncoded).toEqual({ count: 0, cents: 0 });
    expect(result.affected).toBe(false);
  });
});

describe('jobSummary and portfolioSummary', () => {
  test('jobSummary uses resolveExpenseTotals so the ledger wins a disagreement', () => {
    const expenses = EXPENSES_A;
    const stale = computeLedgerRollup([], 1);
    const expected = resolveExpenseTotals({
      rollup: stale,
      expenses,
      expensesCapped: false,
      expensesLoaded: true,
      period: 'month',
    });
    const result = jobSummary({
      scope: SCOPE,
      jobId: 'job-a',
      period: 'month',
      rollup: stale,
      expenses,
      expensesCapped: false,
      expensesLoaded: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totals.ledgerWins).toBe(true);
    expect(result.totals.source).toBe('ledger');
    expect(result.totals.costCents).toBe(expected.costCents);
    expect(result.provenance.query).toBe('jobSummary');
    expect(result.provenance.capped).toBe(false);
  });

  test('jobSummary hides spend when capped with no rollup', () => {
    const result = jobSummary({
      scope: SCOPE,
      jobId: 'job-a',
      expenses: EXPENSES_A,
      expensesCapped: true,
      expensesLoaded: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totals.hidden).toBe(true);
    expect(result.provenance.capped).toBe(true);
  });

  test('portfolioSummary sums invited jobs from rollups', () => {
    const result = portfolioSummary({
      scope: { orgId: SCOPE.orgId, allowedJobIds: ['job-a', 'job-b'] },
      jobs: [jobSnap('job-a'), jobSnap('job-b', EXPENSES_A)],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totals.costCents).toBe(2000 + 2000);
    expect(result.totals.jobCount).toBe(2);
    expect(result.provenance.source).toBe('rollup');
    expect(result.provenance.capped).toBe(false);
  });
});

describe('plan, invoices, quotes', () => {
  test('planVsActual uses cost plan amounts and rollup byTrade', () => {
    const plan = {
      id: 'current',
      jobId: 'job-a',
      level: 'trades' as const,
      targetCents: 5000,
      baselineDate: '2026-01-01',
      gstMode: 'inclusive' as const,
      status: 'draft' as const,
      sections: [
        {
          id: 's1',
          tradeId: 'concreting',
          name: 'Concreting',
          order: 0,
          amountCents: 2500,
        },
      ],
      createdBy: 'u1',
    };
    const result = planVsActual({
      scope: SCOPE,
      jobId: 'job-a',
      tradeId: 'concreting',
      plan,
      job: jobSnap('job-a'),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.planCents).toBe(2500);
    expect(result.actualCents).toBe(1000);
    expect(result.uncoded).toEqual({ count: 1, cents: 400 });
    expect(result.affected).toBe(true);
    expect(result.provenance.source).toBe('rollup');
  });

  test('invoicesByStatus can select overdue from due dates', () => {
    const result = invoicesByStatus({
      scope: SCOPE,
      jobId: 'job-a',
      status: 'overdue',
      now: new Date(2026, 8, 7),
      jobs: [{
        jobId: 'job-a',
        invoices: [
          { id: 'i1', status: 'sent', dueDate: '2026-08-01', total: 20 },
          { id: 'i2', status: 'paid', dueDate: '2026-08-01', total: 20 },
          { id: 'i3', status: 'sent', dueDate: '2026-09-20', total: 20 },
        ],
      }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.invoices.map((row) => row.id)).toEqual(['i1']);
    expect(result.invoices[0].overdue).toBe(true);
    expect(result.provenance.source).toBe('ledger');
  });

  test('quotesForTrade returns allocations for that trade and skips void', () => {
    const result = quotesForTrade({
      scope: SCOPE,
      jobId: 'job-a',
      tradeId: 'concreting',
      quotes: [
        {
          id: 'q1',
          jobId: 'job-a',
          party: 'Acme',
          partyId: 'p1',
          receivedDate: '2026-09-01',
          status: 'chosen',
          amountCents: 1000,
          gstMode: 'inclusive',
          allocations: [{ tradeId: 'concreting', amountCents: 1000 }],
          createdBy: 'u1',
        },
        {
          id: 'q2',
          jobId: 'job-a',
          party: 'Void Co',
          receivedDate: '2026-09-01',
          status: 'void',
          amountCents: 1000,
          gstMode: 'inclusive',
          allocations: [{ tradeId: 'concreting', amountCents: 1000 }],
          createdBy: 'u1',
          voidedAt: new Date(),
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.quotes.map((row) => row.id)).toEqual(['q1']);
    expect(result.quotes[0].tradeCents).toBe(1000);
  });
});

describe('findFiles and findExpenses', () => {
  test('a missing content document does not match on body text', () => {
    const files = [{
      id: 'f1',
      jobId: 'job-a',
      name: 'contract.pdf',
      type: 'contract' as const,
      status: 'active',
    }];
    const missed = findFiles({
      scope: SCOPE,
      jobId: 'job-a',
      text: 'retention',
      files,
      content: {},
    });
    expect(missed.ok).toBe(true);
    if (!missed.ok) return;
    expect(missed.files).toEqual([]);

    const named = findFiles({
      scope: SCOPE,
      jobId: 'job-a',
      text: 'retention',
      files: [{ ...files[0], name: 'retention-clause.pdf' }],
      content: {},
    });
    expect(named.ok).toBe(true);
    if (!named.ok) return;
    expect(named.files[0].matchedOn).toBe('name');

    const body = findFiles({
      scope: SCOPE,
      jobId: 'job-a',
      text: 'retention',
      files,
      content: {
        [contentKey('job-a', 'f1')]: { text: '5% retention on each claim', textStatus: 'ok' },
      },
    });
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.files[0].matchedOn).toBe('text');
    expect(body.provenance.source).toBe('files');
  });

  test('none or unsupported textStatus is not a body match', () => {
    const result = findFiles({
      scope: SCOPE,
      jobId: 'job-a',
      text: 'retention',
      files: [{
        id: 'f1',
        jobId: 'job-a',
        name: 'scan.pdf',
        type: 'contract',
        status: 'active',
      }],
      content: {
        [contentKey('job-a', 'f1')]: { text: 'retention', textStatus: 'none' },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files).toEqual([]);
  });

  test('findExpenses filters by partyId and text without namesMatch', () => {
    const result = findExpenses({
      scope: SCOPE,
      jobId: 'job-a',
      partyId: 'party-mark',
      text: 'purchase',
      jobs: [jobSnap('job-a')],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.expenses.map((row) => row.id)).toEqual(['a1']);
    expect(result.expenses[0].partyId).toBe('party-mark');
  });
});

describe('query layer stays read-only and off the Dashboard barrel', () => {
  test('query modules never write', () => {
    const dir = path.join(root, 'src/queries');
    fs.readdirSync(dir).forEach((name) => {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) return;
      const source = fs.readFileSync(path.join(dir, name), 'utf8');
      expect(source).not.toMatch(/\bsetDoc\b/);
      expect(source).not.toMatch(/\bupdateDoc\b/);
      expect(source).not.toMatch(/\baddDoc\b/);
      expect(source).not.toMatch(/\bdeleteDoc\b/);
      expect(source).not.toMatch(/\bwriteBatch\b/);
    });
  });

  test('there is no queries barrel for Dashboard to import', () => {
    expect(fs.existsSync(path.join(root, 'src/queries/index.ts'))).toBe(false);
    expect(read('src/hooks/useJobSummary.ts')).toContain('../queries/summary');
    expect(read('src/queries/spend.ts')).not.toContain('namesMatch');
    expect(read('src/queries/spend.ts')).not.toContain('partyName');
    expect(read('src/queries/expenses.ts')).not.toContain('namesMatch');
    const fetch = read('src/queries/fetch.ts');
    expect(fetch).toContain('getDoc');
    expect(fetch).toContain('getDocs');
    expect(fetch).not.toContain('setDoc');
  });
});
