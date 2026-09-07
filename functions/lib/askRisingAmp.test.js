'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ASK_MODEL,
  ASK_PROMPT,
  OPENAI_URL,
  QUERY_NAMES,
  AskRouteError,
  buildAskMessages,
  handleAskRisingAmp,
  openaiBody,
  parseAskRoute,
  stampJobId,
  stripFigures,
} = require('./askRisingAmp');

const SOURCE = fs.readFileSync(path.join(__dirname, 'askRisingAmp.js'), 'utf8');

function mockDb(options) {
  const orgEmails = options.orgEmails || ['owner@opalss.com.au'];
  const jobs = options.jobs || {
    'job-1': { invitedEmails: orgEmails },
  };
  return {
    collection(name) {
      assert.equal(name, 'organizations');
      return {
        doc(orgId) {
          return {
            async get() {
              return {
                exists: true,
                data: () => ({ invitedEmails: orgEmails }),
              };
            },
            collection(sub) {
              assert.equal(sub, 'projects');
              return {
                doc(jobId) {
                  return {
                    async get() {
                      const job = jobs[jobId];
                      return {
                        exists: Boolean(job),
                        data: () => job || {},
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function mockOpenAi(payload) {
  return async function fetchImpl(url, init) {
    assert.equal(url, OPENAI_URL);
    const body = JSON.parse(init.body);
    assert.equal(body.model, ASK_MODEL);
    assert.equal(String(init.body).includes('expenses/'), false);
    assert.match(init.headers.Authorization, /^Bearer test-key/);
    return {
      ok: true,
      async json() {
        return {
          choices: [{ message: { content: JSON.stringify(payload) } }],
        };
      },
    };
  };
}

test('QUERY_NAMES matches the ten read-only queries', () => {
  assert.deepEqual(QUERY_NAMES, [
    'spendByTrade',
    'spendByParty',
    'spendByCategory',
    'planVsActual',
    'invoicesByStatus',
    'jobSummary',
    'portfolioSummary',
    'findFiles',
    'findExpenses',
    'quotesForTrade',
  ]);
});

test('model is gpt-4o-mini and the prompt forbids numbers and junk', () => {
  assert.equal(ASK_MODEL, 'gpt-4o-mini');
  assert.match(ASK_PROMPT, /never calculate/i);
  assert.match(ASK_PROMPT, /none/);
  assert.match(ASK_PROMPT, /Junk/);
  assert.match(ASK_PROMPT, /NO digits/);
  const body = openaiBody([{ role: 'user', content: 'hi' }]);
  assert.equal(body.model, 'gpt-4o-mini');
  assert.equal(body.response_format.json_schema.strict, true);
});

test('router source does not run queries or read the ledger', () => {
  assert.equal(SOURCE.includes("collection('expenses')"), false);
  assert.equal(SOURCE.includes('spendByTrade('), false);
  assert.equal(SOURCE.includes('computeLedgerRollup'), false);
  assert.equal(SOURCE.includes('maintainLedgerRollup'), false);
  assert.equal(SOURCE.includes('planVsActual('), false);
  assert.match(SOURCE, /never runs a query/);
});

test('valid spendByTrade route parses', () => {
  const result = parseAskRoute(JSON.stringify({
    query: 'spendByTrade',
    params: { tradeId: 'concreting', jobId: 'job-1' },
    sentence: 'Here is concreting spend for this job.',
  }));
  assert.equal(result.choices.length, 1);
  assert.equal(result.choices[0].query, 'spendByTrade');
  assert.deepEqual(result.choices[0].params, { tradeId: 'concreting', jobId: 'job-1' });
  assert.equal(result.choices[0].sentence, 'Here is concreting spend for this job.');
});

test('unknown query name is rejected', () => {
  assert.throws(
    () => parseAskRoute('{"query":"inventedQuery","params":{}}'),
    (error) => error instanceof AskRouteError && error.message === 'unknown-query',
  );
});

test('none is a first-class result', () => {
  const result = parseAskRoute(JSON.stringify({
    query: 'none',
    params: {},
    reason: 'That needs a forecast.',
  }));
  assert.equal(result.choices[0].query, 'none');
  assert.deepEqual(result.choices[0].params, {});
  assert.equal(result.choices[0].reason, 'That needs a forecast.');
});

test('a dollar amount in sentence is stripped', () => {
  const result = parseAskRoute(JSON.stringify({
    query: 'spendByTrade',
    params: { tradeId: 'concreting' },
    sentence: 'You have spent $12,450 on concreting.',
  }));
  assert.equal(result.choices[0].query, 'spendByTrade');
  assert.equal(hasNoFigures(result.choices[0].sentence), true);
  assert.equal(result.choices[0].sentence.includes('12'), false);
  assert.equal(result.choices[0].sentence.includes('$'), false);
  assert.match(result.choices[0].sentence, /concreting/);
});

test('a dollar amount in none reason is stripped', () => {
  const result = parseAskRoute(JSON.stringify({
    query: 'none',
    reason: 'Cannot forecast a $348,608 finish.',
  }));
  assert.equal(result.choices[0].query, 'none');
  assert.equal(result.choices[0].reason.includes('348'), false);
  assert.equal(result.choices[0].reason.includes('$'), false);
});

test('cents in params are rejected', () => {
  assert.throws(
    () => parseAskRoute(JSON.stringify({
      query: 'spendByTrade',
      params: { tradeId: 'concreting', cents: 1245000 },
    })),
    AskRouteError,
  );
});

test('prompt and user message never include an expense table', () => {
  const messages = buildAskMessages({
    question: 'how much on concreting',
    jobId: 'job-1',
    orgId: 'opal-ss-constructions',
  });
  const blob = JSON.stringify(messages);
  assert.equal(blob.includes('totalCents'), false);
  assert.equal(blob.includes('byTrade'), false);
  assert.match(blob, /how much on concreting/);
  assert.match(blob, /job-1/);
});

test('how much on concreting routes to spendByTrade with a trade param', async () => {
  const result = await handleAskRisingAmp(
    {
      auth: { token: { email: 'owner@opalss.com.au' } },
      data: {
        question: 'how much on concreting',
        jobId: 'job-1',
        orgId: 'opal-ss-constructions',
      },
    },
    {
      db: mockDb({}),
      familyOrgId: 'opal-ss-constructions',
      apiKey: 'test-key',
      fetchImpl: mockOpenAi({
        choices: [{
          query: 'spendByTrade',
          params: {
            jobId: 'job-1',
            tradeId: 'concreting',
            trade: null,
            partyId: null,
            party: null,
            category: null,
            status: null,
            type: null,
            text: null,
            from: null,
            to: null,
            period: null,
            olderThanDays: null,
          },
          sentence: 'Here is concreting spend for this job.',
          reason: '',
        }],
      }),
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.model, 'gpt-4o-mini');
  assert.equal(result.choices[0].query, 'spendByTrade');
  assert.equal(result.choices[0].params.tradeId, 'concreting');
  assert.equal(result.choices[0].params.jobId, 'job-1');
  assert.equal(Object.prototype.hasOwnProperty.call(result.choices[0].params, 'cents'), false);
});

test('unauthenticated calls are rejected', async () => {
  await assert.rejects(
    () => handleAskRisingAmp({ data: { question: 'how much on concreting' } }, { familyOrgId: 'opal-ss-constructions' }),
    (error) => error && error.code === 'unauthenticated',
  );
});

test('jobId from the request is stamped when the model omits it', () => {
  const stamped = stampJobId(
    parseAskRoute(JSON.stringify({
      query: 'spendByTrade',
      params: { tradeId: 'concreting' },
    })).choices,
    'job-1',
  );
  assert.equal(stamped[0].params.jobId, 'job-1');
  assert.equal(stamped[0].params.tradeId, 'concreting');
});

test('stripFigures removes money-like digits', () => {
  assert.equal(stripFigures('Spent $1,200.50 already.').includes('1'), false);
  assert.equal(stripFigures('Spent $1,200.50 already.').includes('$'), false);
});

function hasNoFigures(value) {
  return !/[$£€¥0-9]/.test(String(value || ''));
}
