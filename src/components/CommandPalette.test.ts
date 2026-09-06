import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeLedgerRollup } from '../domain/ledgerRollup';
import { formatCents } from '../money';
import { spendByTrade } from '../queries/spend';
import { defaultPaletteScope, spendAnswersForQuery } from './palette/answers';

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
    const app = read('src/App.js');
    expect(app).not.toContain('queries/');
    expect(app).not.toContain('JobFileViewer');
    expect(app).not.toContain('useTradeList');
    expect(app).not.toContain('spendByTrade');
    const palette = read('src/components/CommandPalette.tsx');
    expect(palette).toContain("lazy(() => import('./files/JobFileViewer'))");
    expect(palette).toContain("import('../queries/fetch')");
    expect(palette).not.toMatch(/^import .+ from ['\"]\.\.\/queries\/fetch['\"]/m);
  });
});
