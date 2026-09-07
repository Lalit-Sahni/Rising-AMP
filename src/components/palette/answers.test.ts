import { describe, expect, it } from 'vitest';
import { computeLedgerRollup } from '../../domain/ledgerRollup';
import { formatCents } from '../../money';
import { planVsActual } from '../../queries/plan';
import {
  spendAnswersForQuery,
  itemsFromRoutedQuery,
  looksLikeQuestion,
  matchTrades,
  workingFromProvenance,
  INCOMPLETE_CAP_MESSAGE,
  REFUSAL_TITLE,
  shouldUsePlanForNone,
} from './answers';

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

describe('Ask routing onto query rows', () => {
  it('treats a concreting question as Ask, not a keyword', () => {
    expect(looksLikeQuestion('concreting')).toBe(false);
    expect(looksLikeQuestion('how much have we spent on concreting')).toBe(true);
    expect(looksLikeQuestion('will we finish under budget')).toBe(true);
  });

  it('uses spendByTrade cents and ignores a model sentence with a fake total', () => {
    const queried = {
      ok: true as const,
      cents: 3_952_291,
      count: 1,
      buckets: [{ key: 'concreting', cents: 3_952_291, count: 1 }],
      uncoded: { count: 2, cents: 15_000 },
      affected: true,
      provenance: {
        query: 'spendByTrade' as const,
        params: { jobId: 'job-1', tradeId: 'concreting' },
        source: 'rollup' as const,
        revision: 41,
        rowCount: 7,
        capped: false,
      },
    };
    const items = itemsFromRoutedQuery({
      choice: {
        query: 'spendByTrade',
        params: { jobId: 'job-1', tradeId: 'concreting' },
        sentence: 'You have spent $99,999 on concreting.',
      },
      result: queried,
      tradeList: TRADE_LIST,
    });
    expect(items[0].kind).toBe('spend');
    if (items[0].kind !== 'spend') return;
    expect(items[0].answer.amount).toBe(formatCents(queried.cents));
    expect(items[0].answer.amount).not.toContain('99,999');
    expect(items[0].answer.title).toBe('Concreting');
    expect(items[0].answer.working?.call).toBe('spendByTrade(job: job-1, trade: Concreting)');
    expect(items[0].answer.working?.detail).toContain('rollup rev 41');
    expect(items[0].answer.working?.detail).toContain('see the 7 expenses');
    expect(items[0].answer.affected).toBe(true);
    expect(items[0].answer.warning).toContain('not coded to any trade');
  });

  it('a none route without a related query has no spend figure', () => {
    const items = itemsFromRoutedQuery({
      choice: { query: 'none', params: {}, reason: 'That cannot be answered from the queries.' },
    });
    expect(items[0].kind).toBe('none');
    if (items[0].kind !== 'none') return;
    expect(items[0].answer).not.toHaveProperty('amount');
    expect(items[0].answer.known).toBeUndefined();
    expect(items[0].answer.title).toBe(REFUSAL_TITLE);
    expect(JSON.stringify(items[0])).not.toMatch(/\$[\d,]/);
  });

  it('names the working line from provenance, not from the model', () => {
    const working = workingFromProvenance({
      query: 'spendByTrade',
      params: { jobId: 'job-1', tradeId: 'concreting' },
      source: 'rollup',
      revision: 41,
      rowCount: 7,
      capped: false,
    }, { job: '72 Centenary Dr' });
    expect(working.call).toBe('spendByTrade(job: 72 Centenary Dr, trade: concreting)');
    expect(working.detail).toBe('rollup rev 41 · see the 7 expenses');
  });

  it('a capped query result is incomplete, not a fake full total', () => {
    const items = itemsFromRoutedQuery({
      choice: {
        query: 'spendByTrade',
        params: { jobId: 'job-1', tradeId: 'concreting' },
        sentence: 'You have spent $99,999 on concreting.',
      },
      result: {
        ok: true as const,
        cents: null,
        count: null,
        buckets: [],
        uncoded: { count: 0, cents: 0 },
        affected: false,
        provenance: {
          query: 'spendByTrade' as const,
          params: { jobId: 'job-1', tradeId: 'concreting' },
          source: 'ledger' as const,
          rowCount: 0,
          capped: true,
        },
      },
      tradeList: TRADE_LIST,
    });
    expect(items[0].kind).toBe('spend');
    if (items[0].kind !== 'spend') return;
    expect(items[0].answer.amount).toBe('—');
    expect(items[0].answer.incomplete).toBe(INCOMPLETE_CAP_MESSAGE);
    expect(items[0].answer.working?.detail).toContain('incomplete');
    expect(`${items[0].answer.title} ${items[0].answer.detail} ${items[0].answer.amount}`).not.toContain('99,999');
    expect(items[0].answer.amount).not.toMatch(/\$[\d,]/);
  });

  it('none plus a job with a plan shows estimated and spent from planVsActual, not the model', () => {
    const plan = {
      id: 'current',
      jobId: 'job-1',
      level: 'target' as const,
      targetCents: 34_860_800,
      baselineDate: '2026-01-01',
      gstMode: 'inclusive' as const,
      status: 'draft' as const,
      sections: [],
      createdBy: 'u1',
    };
    const job = {
      jobId: 'job-1',
      rollup: computeLedgerRollup([
        { id: 'e1', total: 4656, category: 'trade', date: '2026-09-01', tradeId: 'concreting' },
      ], 4),
      expenses: [
        { id: 'e1', total: 4656, category: 'trade', date: '2026-09-01', tradeId: 'concreting' },
      ],
      expensesCapped: false,
      expensesLoaded: true,
    };
    const queried = planVsActual({
      scope: SCOPE,
      jobId: 'job-1',
      plan,
      job,
    });
    expect(queried.ok).toBe(true);
    if (!queried.ok) return;
    expect(shouldUsePlanForNone(queried)).toBe(true);

    const items = itemsFromRoutedQuery({
      choice: {
        query: 'none',
        params: { jobId: 'job-1' },
        reason: 'I forecast you will finish $99,999 under budget.',
      },
      result: queried,
      jobLabel: 'Kelly Street',
    });
    expect(items[0].kind).toBe('none');
    if (items[0].kind !== 'none') return;
    expect(items[0].answer.title).toBe(REFUSAL_TITLE);
    expect(items[0].answer).not.toHaveProperty('amount');
    expect(items[0].answer.known).toEqual([
      { label: 'Estimated', amount: formatCents(queried.planCents) },
      { label: 'Spent so far', amount: formatCents(queried.actualCents) },
    ]);
    expect(items[0].answer.known?.[0].amount).toBe(formatCents(34_860_800));
    expect(items[0].answer.known?.[1].amount).toBe(formatCents(465_600));
    expect(items[0].answer.working?.call).toContain('planVsActual');
    expect(items[0].answer.working?.call).toContain('Kelly Street');
    expect(JSON.stringify(items[0])).not.toContain('99,999');
    expect(items[0].answer.detail).not.toMatch(/[$£€¥0-9]/);
  });

  it('a none with a capped planVsActual is incomplete, not a fake full total', () => {
    const plan = {
      id: 'current',
      jobId: 'job-1',
      level: 'target' as const,
      targetCents: 34_860_800,
      baselineDate: '2026-01-01',
      gstMode: 'inclusive' as const,
      status: 'draft' as const,
      sections: [],
      createdBy: 'u1',
    };
    const queried = planVsActual({
      scope: SCOPE,
      jobId: 'job-1',
      plan,
      job: {
        jobId: 'job-1',
        expenses: [{ id: 'e1', total: 4656, category: 'trade', date: '2026-09-01' }],
        expensesCapped: true,
        expensesLoaded: true,
      },
    });
    expect(queried.ok).toBe(true);
    if (!queried.ok) return;
    expect(queried.provenance.capped).toBe(true);

    const items = itemsFromRoutedQuery({
      choice: { query: 'none', params: { jobId: 'job-1' }, reason: 'Will we finish $99,999 under.' },
      result: queried,
    });
    expect(items[0].kind).toBe('none');
    if (items[0].kind !== 'none') return;
    expect(items[0].answer.incomplete).toBe(INCOMPLETE_CAP_MESSAGE);
    expect(items[0].answer.known?.[0]).toEqual({ label: 'Estimated', amount: formatCents(34_860_800) });
    expect(items[0].answer.known?.[1].amount).toBe('—');
    expect(JSON.stringify(items[0])).not.toContain('99,999');
    expect(items[0].answer.known?.[1].amount).not.toMatch(/\$[\d,]/);
  });

  it('a none refusal does not display a dollar amount that exists only in the model sentence', () => {
    const items = itemsFromRoutedQuery({
      choice: {
        query: 'none',
        params: {},
        reason: 'You will save $99,999 if you finish early.',
      },
    });
    expect(items[0].kind).toBe('none');
    if (items[0].kind !== 'none') return;
    expect(items[0].answer.known).toBeUndefined();
    expect(JSON.stringify(items[0])).not.toContain('99,999');
    expect(JSON.stringify(items[0])).not.toMatch(/\$[\d,]/);
  });

  it('answerFromDocuments paints the stored quote, not a invented clause', () => {
    const stored = 'Progress claims may deduct 5% retention on each claim until practical completion.';
    const items = itemsFromRoutedQuery({
      choice: {
        query: 'answerFromDocuments',
        params: { jobId: 'job-1', type: 'contract', text: 'retention' },
        sentence: 'The contract secretly waives retention entirely.',
      },
      result: {
        ok: true as const,
        passages: [{
          id: 'f1',
          jobId: 'job-1',
          name: 'HIA contract.pdf',
          type: 'contract',
          textStatus: 'ok' as const,
          match: 'quoted' as const,
          quote: 'Progress claims may deduct 5% retention on each claim until practical completion.',
          start: 0,
          end: stored.length,
        }],
        provenance: {
          query: 'answerFromDocuments' as const,
          params: { jobId: 'job-1', type: 'contract', text: 'retention' },
          source: 'files' as const,
          rowCount: 1,
          capped: false,
        },
      },
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('document');
    if (items[0].kind !== 'document') return;
    expect(stored.includes(items[0].file.quote as string)).toBe(true);
    expect(items[0].file.quote).toBe(stored);
    expect(items[0].file.name).toBe('HIA contract.pdf');
    expect(items[0].file.match).toBe('quoted');
    expect(`${items[0].file.quote} ${items[0].file.detail}`).not.toContain('waives retention');
  });

  it('a scan from answerFromDocuments is marked unreadable, with no quote', () => {
    const items = itemsFromRoutedQuery({
      choice: {
        query: 'answerFromDocuments',
        params: { jobId: 'job-1', type: 'plan' },
        sentence: 'The site plan requires a three metre setback.',
      },
      result: {
        ok: true as const,
        passages: [{
          id: 'scan',
          jobId: 'job-1',
          name: 'site-plan.pdf',
          type: 'plan',
          textStatus: 'none' as const,
          match: 'unreadable' as const,
        }],
        provenance: {
          query: 'answerFromDocuments' as const,
          params: { jobId: 'job-1', type: 'plan' },
          source: 'files' as const,
          rowCount: 1,
          capped: false,
        },
      },
    });
    expect(items[0].kind).toBe('document');
    if (items[0].kind !== 'document') return;
    expect(items[0].file.quote).toBeUndefined();
    expect(items[0].file.match).toBe('unreadable');
    expect(items[0].file.unreadableDetail).toContain('scan');
    expect(JSON.stringify(items[0])).not.toContain('three metre');
    expect(JSON.stringify(items[0])).not.toContain('setback');
  });
});
