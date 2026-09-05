import { mapExpenseSnapshot, mapInvoiceSnapshot, shouldApplyCachedSnapshot } from './ledgerMap';

function snapshotOf(rows: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    forEach(callback: (row: { id: string; data: () => Record<string, unknown> }) => void) {
      rows.forEach((row) => callback({ id: row.id, data: () => row.data }));
    },
  };
}

describe('ledger mapping', () => {
  test('keeps labour hours × rate on the face total', () => {
    const expenses = mapExpenseSnapshot(snapshotOf([
      {
        id: 'e1',
        data: {
          category: 'labour',
          hours: 8,
          rate: 50,
          timestamp: { toDate: () => new Date('2026-09-01T00:00:00Z') },
        },
      },
    ]));
    expect(expenses).toHaveLength(1);
    expect(expenses[0].id).toBe('e1');
    expect(expenses[0].totalCents).toBe(40000);
    expect(expenses[0]._invalid).toBe(false);
    expect(expenses[0].timestamp).toEqual(new Date('2026-09-01T00:00:00Z'));
  });

  test('maps an invoice without inventing a total', () => {
    const invoices = mapInvoiceSnapshot(snapshotOf([
      { id: 'inv-1', data: { invoiceNumber: '2026-0001', status: 'paid', total: 1200 } },
    ]));
    expect(invoices[0].id).toBe('inv-1');
    expect(invoices[0].invoiceNumber).toBe('2026-0001');
    expect(invoices[0]._invalid).toBe(false);
  });
});

describe('cached snapshots', () => {
  test('does not apply an empty disk snapshot over a painted list', () => {
    expect(shouldApplyCachedSnapshot(true, 0)).toBe(false);
    expect(shouldApplyCachedSnapshot(true, 2)).toBe(true);
    expect(shouldApplyCachedSnapshot(false, 0)).toBe(true);
  });
});
