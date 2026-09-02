import { applyQuoteAutofill, isQuoteReadableFile, matchQuoteTradeId, quoteCheckFields, sanitizeQuoteRead } from './quoteRead';

const trades = [
  { id: 'concreting', name: 'Concreting' },
  { id: 'plumbing', name: 'Plumbing' },
];

describe('quote AI fill', () => {
  test('accepts photos and PDFs only', () => {
    expect(isQuoteReadableFile({ name: 'q.pdf', type: 'application/pdf' })).toBe(true);
    expect(isQuoteReadableFile({ name: 'q.jpg', type: 'image/jpeg' })).toBe(true);
    expect(isQuoteReadableFile({ name: 'q.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe(false);
  });

  test('matches a trade from a name or id', () => {
    expect(matchQuoteTradeId('concreting', trades)).toBe('concreting');
    expect(matchQuoteTradeId('Plumbing quote', trades)).toBe('plumbing');
    expect(matchQuoteTradeId('site', trades)).toBeNull();
  });

  test('sanitizes the AI payload', () => {
    const read = sanitizeQuoteRead({
      party: '  Asif Concreting  ',
      receivedDate: '2026-07-12',
      amount: 30000,
      amountHigh: 28000,
      gstMode: 'exclusive',
      tradeId: 'concreting',
      quoteNumber: 'Q-12',
      warnings: ['Date is faint'],
    }, trades);
    expect(read.party).toBe('Asif Concreting');
    expect(read.amount).toBe('30000');
    expect(read.amountHigh).toBeNull();
    expect(read.gstMode).toBe('exclusive');
    expect(read.tradeId).toBe('concreting');
    expect(read.uncertain.receivedDate).toBe(true);
  });

  test('fills empty quote fields and leaves typed ones', () => {
    const read = sanitizeQuoteRead({
      party: 'Asif',
      receivedDate: '2026-07-12',
      amount: 15000,
      gstMode: 'inclusive',
      tradeId: 'concreting',
    }, trades);
    const filled = applyQuoteAutofill({
      party: '',
      receivedDate: '2026-09-02',
      amount: '',
      amountHigh: '',
      gstMode: 'inclusive',
      allocations: [{ tradeId: 'plumbing', amount: '' }],
      note: '',
    }, read);
    expect(filled.party).toBe('Asif');
    expect(filled.amount).toBe('15000');
    expect(filled.receivedDate).toBe('2026-09-02');
    expect(filled.allocations[0]).toEqual({ tradeId: 'plumbing', amount: '15000' });

    const kept = applyQuoteAutofill({
      party: 'Mark',
      receivedDate: '2026-01-01',
      amount: '10',
      amountHigh: '',
      gstMode: 'exclusive',
      allocations: [{ tradeId: 'plumbing', amount: '10' }],
      note: 'Keep me',
    }, read);
    expect(kept.party).toBe('Mark');
    expect(kept.amount).toBe('10');
    expect(kept.note).toBe('Keep me');
  });

  test('overwrite replaces the form from the file', () => {
    const read = sanitizeQuoteRead({
      party: 'Asif',
      receivedDate: '2026-07-12',
      amount: 15000,
      gstMode: 'inclusive',
      tradeId: 'concreting',
      quoteNumber: '44',
    }, trades);
    const next = applyQuoteAutofill({
      party: 'Mark',
      receivedDate: '2026-01-01',
      amount: '10',
      amountHigh: '',
      gstMode: 'exclusive',
      allocations: [{ tradeId: 'plumbing', amount: '10' }],
      note: 'Old',
    }, read, { overwrite: true });
    expect(next.party).toBe('Asif');
    expect(next.amount).toBe('15000');
    expect(next.allocations[0].tradeId).toBe('concreting');
    expect(next.note).toMatch(/Quote 44/);
  });

  test('marks Check this only on fields this read filled', () => {
    const read = sanitizeQuoteRead({
      party: 'Asif',
      receivedDate: '2026-07-12',
      amount: 15000,
      gstMode: 'inclusive',
      tradeId: 'concreting',
      warnings: ['Date is faint'],
    }, trades);
    const current = {
      party: '',
      receivedDate: '',
      amount: '',
      amountHigh: '',
      gstMode: 'inclusive' as const,
      allocations: [{ tradeId: 'plumbing', amount: '' }],
      note: '',
    };
    const next = applyQuoteAutofill(current, read);
    const flags = quoteCheckFields(current, next, read);
    expect(flags.party).toBeUndefined();
    expect(flags.receivedDate).toBe(true);
    expect(flags.amount).toBeUndefined();
    expect(flags.tradeId).toBeUndefined();
  });
});
