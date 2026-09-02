import { INVESTOR_TRADE_ID } from './costPlanCore';
import {
  normalizeExpenseCategory,
  tradeIdAfterCategoryChange,
} from './expenseCategory';

describe('expense category retag', () => {
  test('materials is the old name for purchase', () => {
    expect(normalizeExpenseCategory('materials')).toBe('purchase');
    expect(normalizeExpenseCategory('investor')).toBe('investor');
    expect(normalizeExpenseCategory('mystery')).toBeNull();
  });

  test('retagging to Investor codes it off construction', () => {
    expect(tradeIdAfterCategoryChange('investor', 'concreting')).toBe(INVESTOR_TRADE_ID);
    expect(tradeIdAfterCategoryChange('investor', null)).toBe(INVESTOR_TRADE_ID);
  });

  test('leaving Investor uncodes so it does not stay off the plan by accident', () => {
    expect(tradeIdAfterCategoryChange('purchase', INVESTOR_TRADE_ID)).toBeNull();
    expect(tradeIdAfterCategoryChange('purchase', 'concreting')).toBe('concreting');
  });
});
