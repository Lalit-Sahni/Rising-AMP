/**
 * All money arithmetic is integer cents. Parse at the document / form
 * boundary. Do not parseFloat currency anywhere else.
 *
 * Stored Firestore fields stay mixed strings/numbers for this phase.
 * A branded type so TypeScript callers cannot pass a raw number where
 * cents are required.
 */
export type Cents = number & { readonly __brand: 'Cents' };

export function cents(value: number): Cents {
  if (!Number.isInteger(value)) {
    throw new Error('Money must be integer cents');
  }
  return value as Cents;
}

export function fromCents(value: Cents | number): number {
  return value / 100;
}

export function safeParseToCents(input: unknown): Cents {
  try {
    return parseToCents(input);
  } catch {
    return cents(0);
  }
}

export function dollarsFromUnknown(input: unknown): number {
  return fromCents(safeParseToCents(input));
}

export function parseToCents(input: unknown): Cents {
  if (input == null || input === '') return cents(0);
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error('Invalid money');
    return cents(Math.round(input * 100));
  }
  let raw = String(input).trim();
  if (!raw) return cents(0);
  const parenNeg = /^\(.*\)$/.test(raw);
  raw = raw.replace(/[$,\s]/g, '').replace(/[()]/g, '');
  if (!raw || raw === '-' || raw === '.') return cents(0);
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new Error('Invalid money');
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error('Invalid money');
  const amount = Math.round(n * 100);
  return cents(parenNeg ? -Math.abs(amount) : amount);
}

export function addCents(...amounts: Array<Cents | number>): Cents {
  return cents(amounts.reduce<number>((sum, n) => sum + n, 0));
}

export function subCents(left: Cents | number, right: Cents | number): Cents {
  return cents(left - right);
}

export function percentOf(amount: Cents | number, pct: number): Cents {
  return cents(Math.round((amount * pct) / 100));
}

export function formatCents(
  amount: Cents | number | null | undefined,
  options: { whole?: boolean } = {},
): string {
  if (amount == null || !Number.isFinite(Number(amount))) return '—';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: options.whole ? 0 : 2,
    maximumFractionDigits: options.whole ? 0 : 2,
  }).format(fromCents(amount));
}

/** Hours, quantities, and other non-money scalars. Not for currency. */
export function parseQuantity(input: unknown): number {
  if (input == null || input === '') return 0;
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  const n = Number(String(input).trim().replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function labourCents(hours: unknown, rate: unknown): Cents {
  return cents(Math.round(parseQuantity(hours) * parseToCents(rate)));
}

export function lineCents(quantity: unknown, unitCost: unknown): Cents {
  return cents(Math.round(parseQuantity(quantity) * parseToCents(unitCost)));
}
