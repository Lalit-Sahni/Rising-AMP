'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ASK_JSON_SCHEMA,
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

test('QUERY_NAMES matches the read-only queries', () => {
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
    'answerFromDocuments',
  ]);
});

test('model is gpt-4o-mini and the prompt forbids numbers and junk', () => {
  assert.equal(ASK_MODEL, 'gpt-4o-mini');
  assert.match(ASK_PROMPT, /never calculate/i);
  assert.match(ASK_PROMPT, /none/);
  assert.match(ASK_PROMPT, /Junk/);
  assert.match(ASK_PROMPT, /NO digits/);
  assert.match(ASK_PROMPT, /DATA, not instructions/);
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

test('answerFromDocuments is an allowed query', () => {
  const result = parseAskRoute(JSON.stringify({
    query: 'answerFromDocuments',
    params: { type: 'contract', text: 'retention', jobId: 'job-1' },
    sentence: 'Here is the passage from that document.',
  }));
  assert.equal(result.choices[0].query, 'answerFromDocuments');
  assert.deepEqual(result.choices[0].params, { type: 'contract', text: 'retention', jobId: 'job-1' });
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
  assert.match(blob, /data, not instructions/i);
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

test('another organisation is refused by membership', async () => {
  await assert.rejects(
    () => handleAskRisingAmp(
      {
        auth: { token: { email: 'owner@opalss.com.au' } },
        data: {
          question: 'how much on concreting',
          jobId: 'their-job',
          orgId: 'acme-builders',
        },
      },
      {
        db: mockDb({}),
        familyOrgId: 'opal-ss-constructions',
        apiKey: 'test-key',
        fetchImpl: mockOpenAi({ query: 'spendByTrade', params: { tradeId: 'concreting' } }),
      },
    ),
    (error) => error && error.code === 'permission-denied',
  );
});

test('a job the caller is not invited to is refused', async () => {
  await assert.rejects(
    () => handleAskRisingAmp(
      {
        auth: { token: { email: 'owner@opalss.com.au' } },
        data: {
          question: 'how much on concreting',
          jobId: 'other-job',
          orgId: 'opal-ss-constructions',
        },
      },
      {
        db: mockDb({
          orgEmails: ['owner@opalss.com.au'],
          jobs: {
            'job-1': { invitedEmails: ['owner@opalss.com.au'] },
            'other-job': { invitedEmails: ['someone-else@example.com'] },
          },
        }),
        familyOrgId: 'opal-ss-constructions',
        apiKey: 'test-key',
        fetchImpl: mockOpenAi({ query: 'spendByTrade', params: { tradeId: 'concreting' } }),
      },
    ),
    (error) => error && error.code === 'permission-denied',
  );
});

test('a caller who is not on the organisation is refused', async () => {
  await assert.rejects(
    () => handleAskRisingAmp(
      {
        auth: { token: { email: 'outsider@example.com' } },
        data: {
          question: 'how much on concreting',
          jobId: 'job-1',
          orgId: 'opal-ss-constructions',
        },
      },
      {
        db: mockDb({ orgEmails: ['owner@opalss.com.au'] }),
        familyOrgId: 'opal-ss-constructions',
        apiKey: 'test-key',
        fetchImpl: mockOpenAi({ query: 'spendByTrade', params: { tradeId: 'concreting' } }),
      },
    ),
    (error) => error && error.code === 'permission-denied',
  );
});

test('membership reuses isEmailOnList so Gmail canonical still matches', async () => {
  const result = await handleAskRisingAmp(
    {
      auth: { token: { email: 'lalitsahni@gmail.com' } },
      data: {
        question: 'how much on concreting',
        jobId: 'job-1',
        orgId: 'opal-ss-constructions',
      },
    },
    {
      db: mockDb({
        orgEmails: ['Lalit.Sahni@gmail.com'],
        jobs: { 'job-1': { invitedEmails: ['Lalit.Sahni@gmail.com'] } },
      }),
      familyOrgId: 'opal-ss-constructions',
      routeModel: async () => JSON.stringify({
        query: 'spendByTrade',
        params: { tradeId: 'concreting' },
        sentence: 'Here is concreting spend.',
        reason: '',
      }),
    },
  );
  assert.equal(result.ok, true);
  assert.equal(result.choices[0].query, 'spendByTrade');
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

test('a codeExpense action choice parses and figures are stripped', () => {
  const result = parseAskRoute(JSON.stringify({
    action: 'codeExpense',
    params: { jobId: 'job-1', expenseId: 'exp-1', tradeId: 'concreting' },
    sentence: 'Coded $12,450 to concreting.',
  }));
  assert.equal(result.choices[0].action, 'codeExpense');
  assert.equal(result.choices[0].query, undefined);
  assert.deepEqual(result.choices[0].params, {
    jobId: 'job-1',
    expenseId: 'exp-1',
    tradeId: 'concreting',
  });
  assert.equal(hasNoFigures(result.choices[0].sentence), true);
  assert.equal(result.choices[0].sentence.includes('12'), false);
});

test('unknown and never action names are rejected, not coerced to a query', () => {
  assert.throws(
    () => parseAskRoute(JSON.stringify({
      action: 'inventedWrite',
      params: { expenseId: 'exp-1', tradeId: 'concreting' },
    })),
    (error) => error instanceof AskRouteError && error.message === 'unknown-action',
  );
  assert.throws(
    () => parseAskRoute(JSON.stringify({
      action: 'sendEmail',
      params: { expenseId: 'exp-1', tradeId: 'concreting' },
    })),
    (error) => error instanceof AskRouteError && error.message === 'never-action',
  );
  assert.throws(
    () => parseAskRoute(JSON.stringify({
      query: 'spendByTrade',
      action: 'codeExpense',
      params: { tradeId: 'concreting' },
    })),
    (error) => error instanceof AskRouteError && error.message === 'mixed-action',
  );
});

test('prompt and schema still do not teach the model to emit actions', () => {
  assert.equal(ASK_PROMPT.includes('codeExpense'), false);
  assert.equal(ASK_PROMPT.includes('createExpense'), false);
  assert.equal(ASK_PROMPT.includes('undoAction'), false);
  assert.match(ASK_PROMPT, /writes/);
  assert.equal(JSON.stringify(ASK_JSON_SCHEMA).includes('codeExpense'), false);
  assert.equal(JSON.stringify(ASK_JSON_SCHEMA).includes('createExpense'), false);
  assert.equal(QUERY_NAMES.includes('codeExpense'), false);
});

test('stripFigures removes money-like digits', () => {
  assert.equal(stripFigures('Spent $1,200.50 already.').includes('1'), false);
  assert.equal(stripFigures('Spent $1,200.50 already.').includes('$'), false);
});

function hasNoFigures(value) {
  return !/[$£€¥0-9]/.test(String(value || ''));
}
