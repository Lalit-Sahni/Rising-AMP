import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLedgerRollup } from '../domain/ledgerRollup';
import { formatCents } from '../money';
import { spendByTrade } from '../queries/spend';
import { defaultPaletteScope, itemsFromRoutedQuery, spendAnswersForQuery } from './palette/answers';

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
    const app = read('src/App.js');
    expect(app).not.toContain('queries/');
    expect(app).not.toContain('JobFileViewer');
    expect(app).not.toContain('useTradeList');
    expect(app).not.toContain('spendByTrade');
    expect(app).not.toContain('askRisingAmp');
    expect(app).not.toContain("from './ask/");
    expect(app).not.toContain('runAsk');
    const palette = read('src/components/CommandPalette.tsx');
    expect(palette).toContain("lazy(() => import('./files/JobFileViewer'))");
    expect(palette).toContain("import('../queries/fetch')");
    expect(palette).toContain("import('./palette/runAsk')");
    expect(palette).toContain('Ask this job');
    expect(palette).not.toMatch(/^import .+ from ['\"]\.\.\/queries\/fetch['\"]/m);
    expect(palette).not.toMatch(/^import .+ from ['\"]\.\.\/ask\//m);
    expect(palette).not.toMatch(/^import .+ from ['\"]\.\/palette\/runAsk['\"]/m);
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
  });

  test('a none route shows no spend figure', () => {
    const items = itemsFromRoutedQuery({
      choice: { query: 'none', params: {}, reason: 'That cannot be answered from the queries.' },
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('none');
    if (items[0].kind !== 'none') return;
    expect(items[0].answer).not.toHaveProperty('amount');
    expect(JSON.stringify(items[0])).not.toMatch(/\$[\d,]/);
    expect(JSON.stringify(items[0])).not.toContain('99,999');
    const rows = read('src/components/palette/ResultRows.tsx');
    expect(rows).toContain('RefusalAnswerBody');
    expect(rows).toContain("row.kind === 'none'");
  });
});
