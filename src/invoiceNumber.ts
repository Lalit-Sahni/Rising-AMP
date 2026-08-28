export type InvoiceCounter = {
  year: number;
  next: number;
};

export function formatInvoiceNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(4, '0')}`;
}

export function nextInvoiceNumber(
  state: InvoiceCounter | null,
  year: number,
): { invoiceNumber: string; state: InvoiceCounter } {
  const seq = state && state.year === year ? state.next : 1;
  return {
    invoiceNumber: formatInvoiceNumber(year, seq),
    state: { year, next: seq + 1 },
  };
}

export async function allocateMany(
  count: number,
  year: number,
  takeNext: () => Promise<string>,
): Promise<string[]> {
  return Promise.all(Array.from({ length: count }, () => takeNext()));
}
