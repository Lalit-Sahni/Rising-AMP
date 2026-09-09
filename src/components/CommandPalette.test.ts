import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLedgerRollup } from '../domain/ledgerRollup';
import { historyChoiceFromRoute } from '../domain/askHistory';
import { formatCents } from '../money';
import { planVsActual } from '../queries/plan';
import { spendByTrade } from '../queries/spend';
import {
  defaultPaletteScope,
  itemsFromRoutedQuery,
  INCOMPLETE_CAP_MESSAGE,
  REFUSAL_TITLE,
  spendAnswersForQuery,
} from './palette/answers';
import { historySubtitle, itemsFromAskHistory } from './palette/historyDisplay';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(relative: string) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

const SCOPE = { orgId: 'opal-ss-constructions', allowedJobIds: ['job-1'] };

const EXPENSES = [
  {
    id: 'e1',
    total: 48.5,
    category: 'trade',
    date: '2026-09-01',
    tradeId: 'concreting',
    tradeName: 'Concreting',
  },
  {
    id: 'e2',
    total: 10,
    category: 'labour',
    date: '2026-09-02',
    workerName: 'concreting labour',
  },
];

describe('command palette answers', () => {
  test('concreting includes spendByTrade cents in Answers, not only a History expense match', () => {
    const tradeList = [{
      id: 'concreting',
      name: 'Concreting',
      status: 'active' as const,
      order: 0,
      isAppDefault: true,
    }];
    const jobs = [{
      jobId: 'job-1',
      rollup: computeLedgerRollup(EXPENSES, 4),
      expenses: EXPENSES,
      expensesCapped: false,
      expensesLoaded: true,
    }];
    const queried = spendByTrade({
      scope: SCOPE,
      jobId: 'job-1',
      tradeId: 'concreting',
      jobs,
    });
    expect(queried.ok).toBe(true);
    if (!queried.ok) return;
    expect(queried.cents).toBe(4850);
    expect(queried.provenance.query).toBe('spendByTrade');

    const answers = spendAnswersForQuery({
      query: 'concreting',
      tradeList,
      scope: SCOPE,
      jobId: 'job-1',
      jobs,
    });
    expect(answers.length).toBeGreaterThan(0);
    const row = answers[0];
    expect(row.section).toBe('Answers');
    expect(row.kind).toBe('spend');
    expect(row.title).toBe('Concreting');
    const money = formatCents(queried.cents);
    expect(`${row.title} ${row.detail} ${row.amount}`).toContain(money);
    expect(row.detail).toContain('On this job');
    expect(money).toBe('$48.50');
    expect(row.affected).toBe(true);
    expect(row.uncoded.count).toBe(1);
    expect(row.uncoded.cents).toBe(1000);
    expect(row.warning).toContain(formatCents(1000));
    expect(row.warning).toContain('not coded to any trade');
  });

  test('a nonsense query returns no spend Answers', () => {
    const tradeList = [{
      id: 'concreting',
      name: 'Concreting',
      status: 'active' as const,
      order: 0,
      isAppDefault: true,
    }];
    const jobs = [{
      jobId: 'job-1',
      rollup: computeLedgerRollup(EXPENSES, 4),
      expenses: EXPENSES,
      expensesCapped: false,
      expensesLoaded: true,
    }];
    ['zzzzq', 'banana-xyz', 'xx', 'ing', 'air'].forEach((query) => {
      expect(spendAnswersForQuery({
        query,
        tradeList,
        scope: SCOPE,
        jobId: 'job-1',
        jobs,
      })).toEqual([]);
    });
  });

  test('scope chip is the current job by default', () => {
    expect(defaultPaletteScope({ jobId: 'job-1', projectName: '72 Centenary Dr' })).toEqual({
      jobId: 'job-1',
      label: '72 Centenary Dr',
      orgWide: false,
    });
    const palette = read('src/components/CommandPalette.tsx');
    expect(palette).toContain('setScopedJobId(jobId || null)');
    expect(palette).toContain('Clear to search all jobs');
    expect(palette).toContain('All jobs');
  });

  test('no OpenAI, PaletteHost stays lazy, App.js does not import queries', () => {
    const files = [
      'src/components/CommandPalette.tsx',
      'src/components/palette/answers.ts',
      'src/components/palette/ResultRows.tsx',
      'src/components/palette/HistoryList.tsx',
      'src/components/palette/historyDisplay.ts',
      'src/domain/askHistory.ts',
      'src/domain/askRefusal.ts',
      'src/firebase/askHistory.ts',
      'src/components/PaletteHost.tsx',
      'src/App.js',
    ];
    files.forEach((relative) => {
      const source = read(relative);
      expect(source).not.toMatch(/openai/i);
      expect(source).not.toMatch(/chat\.completions/);
    });
    const host = read('src/components/PaletteHost.tsx');
    expect(host).toContain("lazy(() => import('./CommandPalette'))");
    expect(host).not.toContain('queries/');
    expect(host).not.toContain('JobFileViewer');
    expect(host).not.toContain('useTradeList');
    expect(host).not.toContain('askRisingAmp');
    expect(host).not.toContain('runAsk');
    expect(host).not.toContain('askHistory');
    expect(host).not.toContain('HistoryList');
    expect(host).not.toContain('askRefusal');
    const app = read('src/App.js');
    expect(app).not.toContain('queries/');
    expect(app).not.toContain('JobFileViewer');
    expect(app).not.toContain('useTradeList');
    expect(app).not.toContain('spendByTrade');
    expect(app).not.toContain('askRisingAmp');
    expect(app).not.toContain("from './ask/");
    expect(app).not.toContain('runAsk');
    expect(app).not.toContain('askHistory');
    expect(app).not.toContain('HistoryList');
    expect(app).not.toContain('askRefusal');
    expect(app).not.toContain('jobFacts');
    expect(app).not.toContain('firebase/jobFacts');
    const header = read('src/components/Header.js');
    expect(header).not.toContain('queries/');
    expect(header).not.toContain('askRisingAmp');
    expect(header).not.toContain('runAsk');
    expect(header).not.toContain('firebase/jobFacts');
    expect(host).not.toContain('jobFacts');
    expect(host).not.toContain('firebase/jobFacts');
    const palette = read('src/components/CommandPalette.tsx');
    expect(palette).toContain("lazy(() => import('./files/JobFileViewer'))");
    expect(palette).toContain("import('../queries/fetch')");
    expect(palette).toContain("import('./palette/runAsk')");
    expect(palette).toContain("import('../firebase/askHistory')");
    expect(palette).toContain('HistoryList');
    expect(palette).toContain('Ask this job');
    expect(palette).not.toMatch(/^import .+ from ['\"]\.\.\/queries\/fetch['\"]/m);
    expect(palette).not.toMatch(/^import .+ from ['\"]\.\.\/ask\//m);
    expect(palette).not.toMatch(/^import .+ from ['\"]\.\/palette\/runAsk['\"]/m);
    expect(palette).not.toMatch(/^import .+ from ['\"]\.\.\/firebase\/askHistory['\"]/m);
  });

  test('routed spendByTrade paints formatCents from the query, not a model sentence', () => {
    const tradeList = [{
      id: 'concreting',
      name: 'Concreting',
      status: 'active' as const,
    }];
    const jobs = [{
      jobId: 'job-1',
      rollup: computeLedgerRollup(EXPENSES, 4),
      expenses: EXPENSES,
      expensesCapped: false,
      expensesLoaded: true,
    }];
    const queried = spendByTrade({
      scope: SCOPE,
      jobId: 'job-1',
      tradeId: 'concreting',
      jobs,
    });
    expect(queried.ok).toBe(true);
    if (!queried.ok) return;

    const items = itemsFromRoutedQuery({
      choice: {
        query: 'spendByTrade',
        params: { jobId: 'job-1', tradeId: 'concreting' },
        sentence: 'You have spent $99,999 on concreting.',
      },
      result: queried,
      tradeList,
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('spend');
    if (items[0].kind !== 'spend') return;
    const money = formatCents(queried.cents);
    expect(money).toBe('$48.50');
    expect(items[0].answer.amount).toBe(money);
    expect(items[0].answer.amount).not.toContain('99,999');
    expect(items[0].answer.title).toBe('Concreting');
    expect(`${items[0].answer.title} ${items[0].answer.detail} ${items[0].answer.amount}`).not.toContain('99,999');
    expect(`${items[0].answer.title} ${items[0].answer.detail} ${items[0].answer.amount}`).toContain(money);
    expect(items[0].answer.affected).toBe(true);
    expect(items[0].answer.warning).toContain('not coded to any trade');
    expect(items[0].answer.working?.call).toContain('spendByTrade');
  });

  test('a none route shows no spend figure', () => {
    const items = itemsFromRoutedQuery({
      choice: { query: 'none', params: {}, reason: 'That cannot be answered from the queries.' },
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('none');
    if (items[0].kind !== 'none') return;
    expect(items[0].answer).not.toHaveProperty('amount');
    expect(items[0].answer.known).toBeUndefined();
    expect(items[0].answer.title).toBe(REFUSAL_TITLE);
    expect(JSON.stringify(items[0])).not.toMatch(/\$[\d,]/);
    expect(JSON.stringify(items[0])).not.toContain('99,999');
    const rows = read('src/components/palette/ResultRows.tsx');
    expect(rows).toContain('RefusalAnswerBody');
    expect(rows).toContain("row.kind === 'none'");
    expect(rows).toContain('Worked out by');
    expect(rows).toContain('Code them');
    expect(read('src/components/CommandPalette.tsx')).toContain('cost-plan?code=1');
    const runAsk = read('src/components/palette/runAsk.ts');
    expect(runAsk).toContain("if ('action' in raw)");
    expect(runAsk).toContain("query: 'none'");
    expect(runAsk).toContain('loadRelatedForNone');
    expect(runAsk).toContain('shouldUsePlanForNone');
    expect(runAsk).toContain('fetchPlanVsActual');
    expect(runAsk).toContain('fetchJobSummary');
    expect(runAsk).toContain('fetchAnswerFromDocuments');
    expect(runAsk).toContain('answerFromDocuments');
    expect(runAsk).toContain('fetchJobFacts');
    expect(runAsk).toContain('jobFacts');
    expect(runAsk).toContain('assignRefusalReason');
    expect(rows).toContain('nothing_coded');
    expect(rows).toContain('fact_missing');
    expect(rows).toContain('Overview');
    expect(rows).not.toContain('facts/current');
    expect(rows).not.toMatch(/\bsetDoc\b/);
    expect(read('src/components/CommandPalette.tsx')).toContain("setCurrentPage('dashboard'");
  });

  test('none plus a plan still shows estimated and spent from planVsActual', () => {
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
    const jobs = [{
      jobId: 'job-1',
      rollup: computeLedgerRollup(EXPENSES, 4),
      expenses: EXPENSES,
      expensesCapped: false,
      expensesLoaded: true,
    }];
    const queried = planVsActual({
      scope: SCOPE,
      jobId: 'job-1',
      plan,
      job: jobs[0],
    });
    expect(queried.ok).toBe(true);
    if (!queried.ok) return;
    const items = itemsFromRoutedQuery({
      choice: {
        query: 'none',
        params: { jobId: 'job-1' },
        reason: 'I forecast $99,999 under budget.',
      },
      result: queried,
      jobLabel: 'Kelly Street',
    });
    expect(items[0].kind).toBe('none');
    if (items[0].kind !== 'none') return;
    expect(items[0].answer.known?.[0].amount).toBe(formatCents(queried.planCents));
    expect(items[0].answer.known?.[1].amount).toBe(formatCents(queried.actualCents));
    expect(items[0].answer.working?.query).toBe('planVsActual');
    expect(JSON.stringify(items[0])).not.toContain('99,999');
  });

  test('a capped routed spend answer is incomplete', () => {
    const items = itemsFromRoutedQuery({
      choice: { query: 'spendByTrade', params: { jobId: 'job-1', tradeId: 'concreting' } },
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
      tradeList: [{ id: 'concreting', name: 'Concreting', status: 'active' as const }],
    });
    expect(items[0].kind).toBe('spend');
    if (items[0].kind !== 'spend') return;
    expect(items[0].answer.amount).toBe('—');
    expect(items[0].answer.incomplete).toBe(INCOMPLETE_CAP_MESSAGE);
  });
});

describe('command palette question history', () => {
  test('a saved item shows query name and cents from the snapshot, not a model sentence', () => {
    const jobs = [{
      jobId: 'job-1',
      rollup: computeLedgerRollup(EXPENSES, 4),
      expenses: EXPENSES,
      expensesCapped: false,
      expensesLoaded: true,
    }];
    const queried = spendByTrade({
      scope: SCOPE,
      jobId: 'job-1',
      tradeId: 'concreting',
      jobs,
    });
    expect(queried.ok).toBe(true);
    if (!queried.ok) return;
    const routed = {
      query: 'spendByTrade' as const,
      params: { jobId: 'job-1', tradeId: 'concreting', trade: 'Concreting' },
      sentence: 'You have spent $99,999 on concreting.',
      reason: '$99,999',
    };
    const choice = historyChoiceFromRoute(routed, queried);
    expect(choice.query).toBe('spendByTrade');
    expect(choice.snapshot?.cents).toBe(queried.cents);
    expect(choice.snapshot?.cents).toBe(4850);
    expect(JSON.stringify(choice)).not.toContain('99,999');
    expect(JSON.stringify(choice)).not.toContain('sentence');

    const row = {
      id: 'h1',
      uid: 'u1',
      orgId: 'opal-ss-constructions',
      jobId: 'job-1',
      jobLabel: '72 Centenary Dr',
      question: 'spend on concreting',
      askedAt: new Date('2026-09-08T02:00:00Z'),
      choices: [choice],
    };
    const subtitle = historySubtitle(row, new Date('2026-09-08T12:00:00Z'));
    expect(subtitle).toContain(formatCents(4850));
    expect(subtitle).not.toContain('99,999');
    const items = itemsFromAskHistory(row);
    expect(items[0].kind).toBe('spend');
    if (items[0].kind !== 'spend') return;
    expect(items[0].answer.amount).toBe(formatCents(4850));
    expect(items[0].answer.amount).toBe('$48.50');
    expect(items[0].answer.working?.query).toBe('spendByTrade');
    expect(`${items[0].answer.title} ${items[0].answer.detail} ${items[0].answer.amount}`).not.toContain('99,999');
    const list = read('src/components/palette/HistoryList.tsx');
    expect(list).toContain('Recent questions');
    expect(list).toContain('Clear all');
    expect(list).toContain('Remove question');
  });

  test('a stored refusalReason round-trips into teaching copy', () => {
    const choice = historyChoiceFromRoute({
      query: 'none',
      params: { jobId: 'job-1' },
      refusalReason: 'out_of_scope',
    }, null);
    expect(choice.refusalReason).toBe('out_of_scope');
    const items = itemsFromAskHistory({
      id: 'h2',
      uid: 'u1',
      orgId: 'opal-ss-constructions',
      jobId: 'job-1',
      jobLabel: 'Kelly Street',
      question: 'will we finish under budget',
      askedAt: new Date('2026-09-08T02:00:00Z'),
      choices: [choice],
    });
    expect(items[0].kind).toBe('none');
    if (items[0].kind !== 'none') return;
    expect(items[0].answer.refusalReason).toBe('out_of_scope');
    expect(items[0].answer.detail.toLowerCase()).toMatch(/estimated|spent/);
    expect(JSON.stringify(items[0])).not.toContain('99,999');
  });
});
