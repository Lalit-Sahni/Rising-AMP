import {
  addCents,
  cents,
  dollarsFromUnknown,
  formatCents,
  fromCents,
  labourCents,
  lineCents,
  parseToCents,
  percentOf,
  safeParseToCents,
  subCents,
} from './money';

describe('parseToCents', () => {
  test('parses common user input', () => {
    expect(parseToCents('1,234.56')).toBe(123456);
    expect(parseToCents('$40')).toBe(4000);
    expect(parseToCents(' 40 ')).toBe(4000);
    expect(parseToCents('')).toBe(0);
    expect(parseToCents(null)).toBe(0);
    expect(parseToCents(undefined)).toBe(0);
    expect(parseToCents(12.5)).toBe(1250);
    expect(parseToCents(-8.2)).toBe(-820);
    expect(parseToCents('-$12.00')).toBe(-1200);
    expect(parseToCents('(12.34)')).toBe(-1234);
  });

  test('rejects junk', () => {
    expect(() => parseToCents('abc')).toThrow(/Invalid money/);
    expect(() => parseToCents(Number.NaN)).toThrow(/Invalid money/);
  });

  test('rejects junk', () => {
    expect(() => parseToCents('abc')).toThrow(/Invalid money/);
    expect(() => parseToCents(Number.NaN)).toThrow(/Invalid money/);
  });

  test('safeParseToCents never throws', () => {
    expect(safeParseToCents('abc')).toBe(0);
    expect(safeParseToCents(Number.NaN)).toBe(0);
    expect(dollarsFromUnknown('$40')).toBe(40);
  });
});

describe('cents arithmetic', () => {
  test('adds a thousand values without drift', () => {
    const values = Array.from({ length: 1000 }, () => parseToCents('0.01'));
    expect(addCents(...values)).toBe(1000);
    expect(fromCents(addCents(...values))).toBe(10);
  });

  test('subtracts and takes a percentage in integer cents', () => {
    expect(subCents(parseToCents('100'), parseToCents('40.50'))).toBe(5950);
    expect(percentOf(parseToCents('200'), 8)).toBe(1600);
  });

  test('labour and quantity lines', () => {
    expect(labourCents(8, 50)).toBe(40000);
    expect(lineCents('2', '3.5')).toBe(700);
  });

  test('branded cents refuse fractional numbers', () => {
    expect(() => cents(1.5)).toThrow(/integer cents/);
  });
});

describe('formatCents', () => {
  test('formats AUD', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(null)).toBe('—');
  });
});
