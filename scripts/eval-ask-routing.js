#!/usr/bin/env node
'use strict';

/**
 * Live Ask routing eval against OpenAI. Not part of npm test.
 * Without OPENAI_API_KEY this prints a skip line and exits 0.
 */
const fixtures = require('../functions/lib/askRisingAmp.eval.json');
const {
  OPENAI_URL,
  buildAskMessages,
  openaiBody,
  parseAskRoute,
} = require('../functions/lib/askRisingAmp');
const { evalCounts } = require('../functions/lib/askRisingAmp.eval');

async function scoreOne(fixture, apiKey) {
  const input = {
    question: fixture.question,
    jobId: 'job-1',
    orgId: 'opal-ss-constructions',
  };
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(openaiBody(buildAskMessages(input))),
  });
  if (!response.ok) {
    return { id: fixture.id, ok: false, got: `http-${response.status}`, expected: fixture.expectedQuery };
  }
  const payload = await response.json().catch(() => ({}));
  const content =
    payload &&
    payload.choices &&
    payload.choices[0] &&
    payload.choices[0].message &&
    payload.choices[0].message.content;
  try {
    const route = parseAskRoute(content);
    const got = route.choices[0] && route.choices[0].query;
    return { id: fixture.id, ok: got === fixture.expectedQuery, got, expected: fixture.expectedQuery };
  } catch (error) {
    return {
      id: fixture.id,
      ok: false,
      got: error && error.message ? error.message : 'parse-failed',
      expected: fixture.expectedQuery,
    };
  }
}

async function main() {
  const counts = evalCounts(fixtures);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log(
      `eval-ask-routing: skip (no OPENAI_API_KEY). CI does not need a live key. Fixtures: ${counts.total} total, ${counts.none} none.`,
    );
    process.exit(0);
  }

  const results = [];
  for (const fixture of fixtures) {
    results.push(await scoreOne(fixture, apiKey));
  }
  const failed = results.filter((row) => !row.ok);
  console.log(`eval-ask-routing: ${results.length - failed.length}/${results.length} matched golden query (${counts.none} none fixtures).`);
  failed.forEach((row) => {
    console.log(`  fail ${row.id}: expected ${row.expected}, got ${row.got}`);
  });
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error('eval-ask-routing failed to run.');
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
