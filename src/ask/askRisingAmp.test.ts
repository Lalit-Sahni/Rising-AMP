import { parseAskClientResponse, stripAskFigures } from './askRisingAmp';

test('drops a model sentence that still contains a dollar amount', () => {
  const parsed = parseAskClientResponse({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{
      query: 'spendByTrade',
      params: { jobId: 'job-1', tradeId: 'concreting' },
      sentence: 'You have spent $99,999 on concreting.',
    }],
  });
  expect('query' in parsed.choices[0] && parsed.choices[0].query).toBe('spendByTrade');
  const choice = parsed.choices[0];
  if (!('query' in choice) || choice.query === 'none') return;
  expect(choice.sentence).toBeUndefined();
});

test('none with digits in the reason keeps a figure-free reason', () => {
  const stripped = stripAskFigures({
    ok: true,
    model: 'gpt-4o-mini',
    choices: [{ query: 'none', params: {}, reason: 'I guessed $12,000.' }],
  });
  const parsed = parseAskClientResponse(stripped);
  expect('query' in parsed.choices[0] && parsed.choices[0].query).toBe('none');
  const choice = parsed.choices[0];
  if (!('query' in choice) || choice.query !== 'none') return;
  expect(choice.reason).not.toMatch(/[$£€¥0-9]/);
});
