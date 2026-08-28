import { nextInvoiceNumber } from './invoiceNumber';

describe('invoice numbering', () => {
  test('is unique and monotonic for a thousand allocations', () => {
    let state = { year: 2026, next: 1 };
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const result = nextInvoiceNumber(state, 2026);
      state = result.state;
      seen.add(result.invoiceNumber);
    }
    expect(seen.size).toBe(1000);
    expect(seen.has('2026-0001')).toBe(true);
    expect(seen.has('2026-1000')).toBe(true);
    expect(state.next).toBe(1001);
  });

  test('parallel callers sharing one lock never duplicate', async () => {
    let state = { year: 2026, next: 1 };
    let chain = Promise.resolve();
    const takeNext = () =>
      new Promise<string>((resolve) => {
        chain = chain.then(() => {
          const result = nextInvoiceNumber(state, 2026);
          state = result.state;
          resolve(result.invoiceNumber);
        });
      });
    const numbers = await Promise.all(Array.from({ length: 1000 }, () => takeNext()));
    expect(new Set(numbers).size).toBe(1000);
  });

  test('a new year restarts at 0001', () => {
    const result = nextInvoiceNumber({ year: 2025, next: 44 }, 2026);
    expect(result.invoiceNumber).toBe('2026-0001');
  });
});
