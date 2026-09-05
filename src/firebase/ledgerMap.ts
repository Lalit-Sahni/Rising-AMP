import { parseAtBoundary, expenseSchema, invoiceSchema } from '../domain/schemas';
import { getExpenseFaceTotalCents } from '../utils/jobMetrics';

type FirestoreRow = {
  id: string;
  data: () => Record<string, unknown>;
};

export type SnapshotLike = {
  forEach: (callback: (row: FirestoreRow) => void) => void;
};

function timestampValue(value: unknown): Date {
  if (value && typeof value === 'object' && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (value instanceof Date) return value;
  return new Date();
}

export function mapExpenseSnapshot(snapshot: SnapshotLike) {
  const expenses: Array<Record<string, unknown>> = [];
  snapshot.forEach((row) => {
    const data = row.data() || {};
    const parsed = parseAtBoundary(expenseSchema, { id: row.id, ...data });
    const body = parsed.data;
    expenses.push({
      ...body,
      id: row.id,
      totalCents: getExpenseFaceTotalCents(body),
      _invalid: parsed.ok ? false : true,
      timestamp: timestampValue(data.timestamp),
    });
  });
  return expenses;
}

export function mapInvoiceSnapshot(snapshot: SnapshotLike) {
  const invoices: Array<Record<string, unknown>> = [];
  snapshot.forEach((row) => {
    const data = row.data() || {};
    const parsed = parseAtBoundary(invoiceSchema, { id: row.id, ...data });
    invoices.push({
      ...parsed.data,
      id: row.id,
      _invalid: parsed.ok ? false : true,
    });
  });
  return invoices;
}

/** An empty IndexedDB snapshot must not wipe a boot-cached list while Iowa answers. */
export function shouldApplyCachedSnapshot(fromCache: boolean, rowCount: number): boolean {
  return !(fromCache && rowCount === 0);
}
