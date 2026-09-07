import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAskCallableResponse } from './askRoute';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('parses a spendByTrade route with no figures', () => {
  const result = parseAskCallableResponse({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{
      query: 'spendByTrade',
      params: { jobId: 'job-1', tradeId: 'concreting' },
      sentence: 'Here is concreting spend for this job.',
    }],
  });
  expect(result.choices[0].query).toBe('spendByTrade');
  if (result.choices[0].query !== 'none') {
    expect(result.choices[0].params.tradeId).toBe('concreting');
  }
});

test('rejects a sentence that still contains a dollar amount', () => {
  expect(() => parseAskCallableResponse({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{
      query: 'spendByTrade',
      params: { tradeId: 'concreting' },
      sentence: 'You have spent $12,450 on concreting.',
    }],
  })).toThrow();
});

test('none is accepted', () => {
  const result = parseAskCallableResponse({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{ query: 'none', params: {}, reason: 'That cannot be answered from the queries.' }],
  });
  expect(result.choices[0].query).toBe('none');
});

test('answerFromDocuments is an allowed query name', () => {
  const result = parseAskCallableResponse({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{
      query: 'answerFromDocuments',
      params: { jobId: 'job-1', type: 'contract', text: 'retention' },
      sentence: 'Here is the passage from that document.',
    }],
  });
  expect(result.choices[0].query).toBe('answerFromDocuments');
});

test('App.js and PaletteHost do not import the Ask helper', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.js'), 'utf8');
  const host = fs.readFileSync(path.join(root, 'src/components/PaletteHost.tsx'), 'utf8');
  expect(app).not.toContain('ask/askRoute');
  expect(app).not.toContain('askRisingAmp');
  expect(app).not.toContain('runAsk');
  expect(host).not.toContain('ask/askRoute');
  expect(host).not.toContain('askRisingAmp');
  expect(host).not.toContain('runAsk');
  expect(host).toContain("lazy(() => import('./CommandPalette'))");
});
