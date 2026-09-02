import { expenseDisplayName, formatExpenseDay } from './expenseDisplay';

describe('expenseDisplayName', () => {
  test('uses the category fields History already knows', () => {
    expect(expenseDisplayName({ category: 'purchase', itemName: 'Land deposit' })).toBe('Land deposit');
    expect(expenseDisplayName({ category: 'labour', workerName: 'Sam' })).toBe('Sam');
    expect(expenseDisplayName({ category: 'investor', itemName: 'Solicitor identity' })).toBe('Solicitor identity');
  });

  test('does not fall back to a blank Expense when a description exists', () => {
    expect(expenseDisplayName({ category: 'purchase' })).toBe('Purchase');
    expect(expenseDisplayName({ description: 'Mortgage payment' })).toBe('Mortgage payment');
    expect(expenseDisplayName({})).toBe('Expense');
  });
});

describe('formatExpenseDay', () => {
  test('formats a form date', () => {
    expect(formatExpenseDay({ date: '2026-08-12' })).toBe('12 Aug 2026');
  });
});
