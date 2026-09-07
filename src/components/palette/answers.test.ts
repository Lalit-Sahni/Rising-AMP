import { describe, expect, it } from 'vitest';
import { computeLedgerRollup } from '../../domain/ledgerRollup';
import { formatCents } from '../../money';
import { spendAnswersForQuery, matchTrades } from './answers';

/**
 * Every search returned the same three trades, whatever was typed.
 *
 * matchTrades ended with `name.includes(alias)`, which never read the query. So
 * any trade whose display name contained one of its own aliases matched
 * everything: "Tiling and flooring" (flooring), "Kitchen and joinery" (joinery)
 * and "Air-conditioning" (air-conditioning).
 *
 * A second, milder fault: `hay.includes(q)` and `word.includes(q)` matched two
 * letters found anywhere, so "in" hit 13 of 20 trades (concret-in-g,
 * plumb-in-g, roof-in-g) and "er" hit 13.
 */
const TRADES = [
  ['site-works', 'Site works'],
  ['demolition', 'Demolition'],
  ['concreting', 'Concreting'],
  ['plumbing', 'Plumbing'],
  ['carpentry', 'Carpentry'],
  ['roofing', 'Roofing'],
  ['electrical', 'Electrical'],
  ['waterproofing', 'Waterproofing'],
  ['plastering', 'Plastering'],
  ['tiling-flooring', 'Tiling and flooring'],
  ['painting', 'Painting'],
  ['kitchen-joinery', 'Kitchen and joinery'],
  ['hvac', 'Air-conditioning'],
  ['landscaping', 'Landscaping'],
  ['other', 'Internal works and materials'],
].map(([id, name]) => ({ id, name, order: 0, isAppDefault: true, status: 'active' as const }));

describe('matchTrades', () => {
  it('returns nothing for a query that names no trade', () => {
    ['xy', 'xx', 'ing', 'air', 'mark', 'bunnings', 'slab cert', 'how much did we spend', 'zzz', 'zzzzq', 'banana-xyz'].forEach((q) => {
      expect(matchTrades(TRADES, q), `"${q}" should match no trade`).toHaveLength(0);
    });
  });

  it('never returns a trade just because its name contains its own alias', () => {
    const always = ['Tiling and flooring', 'Kitchen and joinery', 'Air-conditioning'];
    const hits = matchTrades(TRADES, 'xy').map((t) => t.name);
    always.forEach((name) => expect(hits).not.toContain(name));
  });

  it('does not match two letters found in the middle of a word', () => {
    expect(matchTrades(TRADES, 'er')).toHaveLength(0);
    expect(matchTrades(TRADES, 'on')).toHaveLength(0);
    // "in" is a real prefix of "internal", and only that.
    expect(matchTrades(TRADES, 'in').map((t) => t.id)).toEqual(['other']);
  });

  it('finds the one trade a real query names', () => {
    const cases: Array<[string, string]> = [
      ['concreting', 'concreting'],
      ['concrete', 'concreting'],
      ['kitchen', 'kitchen-joinery'],
      ['joinery', 'kitchen-joinery'],
      ['plumb', 'plumbing'],
      ['plumber', 'plumbing'],
      ['aircon', 'hvac'],
      ['tiling', 'tiling-flooring'],
      ['paint', 'painting'],
      ['elect', 'electrical'],
    ];
    cases.forEach(([q, id]) => {
      expect(matchTrades(TRADES, q).map((t) => t.id), `"${q}"`).toContain(id);
      expect(matchTrades(TRADES, q).length, `"${q}" should be specific`).toBeLessThanOrEqual(2);
    });
  });

  it('ignores archived trades and very short queries', () => {
    expect(matchTrades(TRADES, 'c')).toHaveLength(0);
    const archived = TRADES.map((t) => ({ ...t, status: 'archived' as const }));
    expect(matchTrades(archived, 'concreting')).toHaveLength(0);
  });
});

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-1'] };
const TRADE_LIST = [{ id: 'concreting', name: 'Concreting', status: 'active' as const }];
const UNCODED_JOB = {
  jobId: 'job-1',
  rollup: computeLedgerRollup([
    { id: 'e1', total: 39522.91, category: 'trade', date: '2026-09-01', tradeId: 'concreting' },
    { id: 'e2', total: 100, category: 'purchase', date: '2026-09-02' },
    { id: 'e3', total: 50, category: 'purchase', date: '2026-09-03' },
  ], 4),
  expenses: [
    { id: 'e1', total: 39522.91, category: 'trade', date: '2026-09-01', tradeId: 'concreting' },
    { id: 'e2', total: 100, category: 'purchase', date: '2026-09-02' },
    { id: 'e3', total: 50, category: 'purchase', date: '2026-09-03' },
  ],
  expensesCapped: false,
  expensesLoaded: true,
};

describe('spend answers', () => {
  it('returns no spend Answers for a nonsense query', () => {
    ['zzzzq', 'banana-xyz', 'xx', 'ing', 'air'].forEach((query) => {
      expect(spendAnswersForQuery({
        query,
        tradeList: TRADES,
        scope: SCOPE,
        jobId: 'job-1',
        jobs: [UNCODED_JOB],
      }), `"${query}" should not produce a spend answer`).toEqual([]);
    });
  });

  it('states the uncoded pool and cannot mark affected false while cents remain', () => {
    const answers = spendAnswersForQuery({
      query: 'concreting',
      tradeList: TRADE_LIST,
      scope: SCOPE,
      jobId: 'job-1',
      jobs: [UNCODED_JOB],
    });
    expect(answers).toHaveLength(1);
    const row = answers[0];
    expect(row.affected).toBe(true);
    expect(row.uncoded.count).toBe(2);
    expect(row.uncoded.cents).toBe(15000);
    expect(row.warning).toContain('2 expenses');
    expect(row.warning).toContain(formatCents(15000));
    expect(row.warning).toContain('not coded to any trade');
    expect(row.warning).toContain('concreting');
  });

  it('uses plan vs actual copy when a plan is present', () => {
    const plan = {
      id: 'current',
      jobId: 'job-1',
      level: 'trades' as const,
      targetCents: 3737291,
      baselineDate: '2026-01-01',
      gstMode: 'inclusive' as const,
      status: 'draft' as const,
      sections: [{
        id: 's1',
        tradeId: 'concreting',
        name: 'Concreting',
        order: 0,
        amountCents: 3737291,
      }],
      createdBy: 'u1',
    };
    const answers = spendAnswersForQuery({
      query: 'concrete',
      tradeList: TRADE_LIST,
      scope: SCOPE,
      jobId: 'job-1',
      jobs: [UNCODED_JOB],
      plan,
    });
    expect(answers).toHaveLength(1);
    const row = answers[0];
    const over = 3952291 - 3737291;
    expect(row.title).toBe(`Concreting is ${formatCents(over)} over.`);
    expect(row.detail).toContain(`Estimated ${formatCents(3737291)}`);
    expect(row.detail).toContain(`spent ${formatCents(3952291)}`);
    expect(row.detail).toContain('1 coded expense');
    expect(row.warning).toContain(formatCents(15000));
    expect(row.affected).toBe(true);
  });

  it('hides the uncoded warning when the pool is zero', () => {
    const coded = {
      jobId: 'job-1',
      rollup: computeLedgerRollup([
        { id: 'e1', total: 10, category: 'trade', date: '2026-09-01', tradeId: 'concreting' },
      ], 4),
      expenses: [
        { id: 'e1', total: 10, category: 'trade', date: '2026-09-01', tradeId: 'concreting' },
      ],
      expensesCapped: false,
      expensesLoaded: true,
    };
    const answers = spendAnswersForQuery({
      query: 'concreting',
      tradeList: TRADE_LIST,
      scope: SCOPE,
      jobId: 'job-1',
      jobs: [coded],
    });
    expect(answers[0].affected).toBe(false);
    expect(answers[0].uncoded).toEqual({ count: 0, cents: 0 });
    expect(answers[0].warning).toBeUndefined();
  });
});
