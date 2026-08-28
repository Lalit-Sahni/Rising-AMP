import { expenseSchema, invoiceSchema, parseAtBoundary } from './schemas';

describe('domain schemas', () => {
  test('accepts mixed money types from the Phase 5 audit', () => {
    const expense = expenseSchema.parse({
      id: 'e1',
      category: 'labour',
      hours: '8',
      rate: 50,
      amount: '40.00',
      date: '2026-08-01',
    });
    expect(expense.hours).toBe('8');
    expect(expense.rate).toBe(50);
  });

  test('flags a document with a completely wrong shape', () => {
    const result = parseAtBoundary(invoiceSchema, 'not-an-object');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.data._invalid).toBe(true);
  });

  test('void is a known invoice status', () => {
    expect(invoiceSchema.parse({ status: 'void', invoiceNumber: '2026-0001' }).status).toBe('void');
  });
});
