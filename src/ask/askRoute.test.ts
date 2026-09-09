import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QUERY_NAMES } from '../queries/core';
import {
  AskRouteError,
  parseActionChoice,
  parseAskCallableResponse,
} from './askRoute';
import { parseAskClientResponse, stripAskFigures } from './askRisingAmp';

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
  const choice = result.choices[0];
  expect('query' in choice && choice.query).toBe('spendByTrade');
  if (!('query' in choice) || choice.query === 'none') return;
  expect(choice.params.tradeId).toBe('concreting');
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
  const choice = result.choices[0];
  expect('query' in choice && choice.query).toBe('none');
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
  const choice = result.choices[0];
  expect('query' in choice && choice.query).toBe('answerFromDocuments');
});

test('jobFacts is an allowed query name', () => {
  const result = parseAskCallableResponse({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{
      query: 'jobFacts',
      params: { jobId: 'job-1', field: 'floorArea' },
      sentence: 'Here is that recorded job fact.',
    }],
  });
  const choice = result.choices[0];
  expect('query' in choice && choice.query).toBe('jobFacts');
});

test('a codeExpense action choice is accepted', () => {
  const result = parseAskCallableResponse({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{
      action: 'codeExpense',
      params: { jobId: 'job-1', expenseId: 'exp-1', tradeId: 'concreting' },
      sentence: 'That expense will be coded to concreting.',
    }],
  });
  const choice = result.choices[0];
  expect('action' in choice && choice.action).toBe('codeExpense');
  if (!('action' in choice) || choice.action !== 'codeExpense') return;
  expect(choice.params.expenseId).toBe('exp-1');
  expect(choice.params.tradeId).toBe('concreting');
});

test('parseActionChoice accepts codeExpense and rejects unknown and never names', () => {
  const parsed = parseActionChoice({
    action: 'codeExpense',
    params: { expenseId: 'exp-1', tradeId: null, clientKey: 'client-key-1' },
  });
  expect(parsed.action).toBe('codeExpense');
  if (parsed.action !== 'codeExpense') return;
  expect(parsed.params.tradeId).toBe(null);
  expect(() => parseActionChoice({
    action: 'inventedWrite',
    params: { expenseId: 'exp-1', tradeId: 'concreting' },
  })).toThrow(AskRouteError);
  try {
    parseActionChoice({ action: 'inventedWrite', params: { expenseId: 'exp-1', tradeId: 'x' } });
  } catch (error) {
    expect(error).toBeInstanceOf(AskRouteError);
    expect((error as AskRouteError).message).toBe('unknown-action');
  }
  try {
    parseActionChoice({ action: 'sendEmail', params: { expenseId: 'exp-1', tradeId: 'x' } });
  } catch (error) {
    expect(error).toBeInstanceOf(AskRouteError);
    expect((error as AskRouteError).message).toBe('never-action');
  }
});

test('an unknown action is rejected and not coerced to a query', () => {
  expect(() => parseAskCallableResponse({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{
      action: 'inventedWrite',
      params: { expenseId: 'exp-1', tradeId: 'concreting' },
      sentence: 'Coded to concreting.',
    }],
  })).toThrow();
  expect(() => parseAskCallableResponse({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{
      query: 'spendByTrade',
      action: 'codeExpense',
      params: { tradeId: 'concreting' },
      sentence: 'Here is concreting spend for this job.',
    }],
  })).toThrow();
});

test('figures are still stripped from an action sentence', () => {
  const stripped = stripAskFigures({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{
      action: 'codeExpense',
      params: { expenseId: 'exp-1', tradeId: 'concreting' },
      sentence: 'Coded $12,450 to concreting.',
    }],
  });
  const parsed = parseAskClientResponse(stripped);
  const choice = parsed.choices[0];
  expect('action' in choice && choice.action).toBe('codeExpense');
  if (!('action' in choice)) return;
  expect(choice.sentence).toBeUndefined();
});

test('action names are not query names', () => {
  expect(QUERY_NAMES).not.toContain('codeExpense');
  expect(QUERY_NAMES).not.toContain('createExpense');
  expect(QUERY_NAMES).not.toContain('codeExpenseBatch');
  expect(QUERY_NAMES).not.toContain('undoAction');
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
