import { isValidEmail, isValidPassword } from '../utils/authValidation';

describe('auth helpers', () => {
  test('accepts any email domain, not only Gmail', () => {
    expect(isValidEmail('owner@opalss.com.au')).toBe(true);
    expect(isValidEmail('books@outlook.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('missing@domain')).toBe(false);
  });

  test('password must be 8+ characters with a number', () => {
    expect(isValidPassword('short1')).toBe(false);
    expect(isValidPassword('longenough')).toBe(false);
    expect(isValidPassword('builder12')).toBe(true);
  });
});
