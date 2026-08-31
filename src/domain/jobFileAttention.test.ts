import { jobFileSchema } from './schemas';
import {
  FILE_INVOICE_LINK_MIN_CENTS,
  deriveFileAttentionItems,
  withFileAttention,
} from './jobFileAttention';

const now = new Date('2026-08-31T12:00:00+10:00');

function file(overrides: Record<string, unknown>) {
  return jobFileSchema.parse({
    id: 'f1',
    name: 'Doc',
    type: 'permit',
    storagePath: 'files/org/job/f1/doc.pdf',
    thumbnailPath: null,
    contentType: 'application/pdf',
    sizeBytes: 1000,
    uploadedBy: 'owner-1',
    uploadedAt: '2026-08-20',
    documentDate: '2026-03-14',
    status: 'active',
    ...overrides,
  });
}

describe('file attention items', () => {
  test('says nothing when the job has no files', () => {
    const items = deriveFileAttentionItems({
      files: [],
      invoices: [{ id: 'inv-1', total: 20000, status: 'sent' }],
    }, now);
    expect(items).toEqual([]);
  });

  test('photos alone do not mean a missing contract', () => {
    const items = deriveFileAttentionItems({
      files: [file({ id: 'p1', type: 'photo', name: 'Site', contentType: 'image/jpeg', storagePath: 'files/org/job/p1/site.jpg' })],
      invoices: [],
    }, now);
    expect(items.some((item) => item.id === 'files-no-contract')).toBe(false);
  });

  test('flags a missing contract only after other paperwork is filed', () => {
    const items = deriveFileAttentionItems({
      files: [file({ type: 'permit', name: 'DA permit' })],
      invoices: [],
    }, now);
    expect(items.find((item) => item.id === 'files-no-contract')?.title).toMatch(/contract/i);
  });

  test('does not flag a missing contract when one is on the job', () => {
    const items = deriveFileAttentionItems({
      files: [
        file({ id: 'c1', type: 'contract', name: 'HIA', storagePath: 'files/org/job/c1/hia.pdf' }),
        file({ id: 'p1', type: 'permit', name: 'DA', storagePath: 'files/org/job/p1/da.pdf' }),
      ],
    }, now);
    expect(items.some((item) => item.id === 'files-no-contract')).toBe(false);
  });

  test('does not nag large invoices until a quote or variation exists on the job', () => {
    const items = deriveFileAttentionItems({
      files: [file({ type: 'permit' })],
      invoices: [{ id: 'inv-1', total: 12400, status: 'sent' }],
    }, now);
    expect(items.some((item) => item.id === 'files-invoice-unlinked')).toBe(false);
  });

  test('flags large invoices with no linked quote or variation once that drawer is in use', () => {
    const items = deriveFileAttentionItems({
      files: [file({
        id: 'v1',
        type: 'variation',
        name: 'Window',
        storagePath: 'files/org/job/v1/var.pdf',
      })],
      invoices: [
        { id: 'inv-1', total: 12400, status: 'sent' },
        { id: 'inv-2', total: 200, status: 'sent' },
        { id: 'inv-3', total: 8000, status: 'void' },
      ],
    }, now);
    const item = items.find((row) => row.id === 'files-invoice-unlinked');
    expect(item?.title).toMatch(/1 invoice/);
    expect(FILE_INVOICE_LINK_MIN_CENTS).toBe(500000);
  });

  test('a linked variation clears that invoice from the gap', () => {
    const items = deriveFileAttentionItems({
      files: [file({
        id: 'v1',
        type: 'variation',
        name: 'Window',
        storagePath: 'files/org/job/v1/var.pdf',
        linkedTo: { kind: 'invoice', id: 'inv-1' },
      })],
      invoices: [{ id: 'inv-1', total: 12400, status: 'sent' }],
    }, now);
    expect(items.some((item) => item.id === 'files-invoice-unlinked')).toBe(false);
  });

  test('Other files only count as stale when we know they are older than a week', () => {
    const stale = deriveFileAttentionItems({
      files: [file({
        id: 'o1',
        type: 'other',
        name: 'Scan',
        storagePath: 'files/org/job/o1/scan.pdf',
        uploadedAt: '2026-08-20',
      })],
    }, now);
    expect(stale.some((item) => item.id === 'files-other-stale')).toBe(true);

    const fresh = deriveFileAttentionItems({
      files: [file({
        id: 'o2',
        type: 'other',
        name: 'Scan',
        storagePath: 'files/org/job/o2/scan.pdf',
        uploadedAt: '2026-08-30',
      })],
    }, now);
    expect(fresh.some((item) => item.id === 'files-other-stale')).toBe(false);

    const unknownAge = deriveFileAttentionItems({
      files: [file({
        id: 'o3',
        type: 'other',
        name: 'Scan',
        storagePath: 'files/org/job/o3/scan.pdf',
        uploadedAt: undefined,
      })],
    }, now);
    expect(unknownAge.some((item) => item.id === 'files-other-stale')).toBe(false);
  });

  test('does not guess that an old certificate has expired', () => {
    const items = deriveFileAttentionItems({
      files: [file({
        type: 'certificate',
        name: 'Slab engineer',
        documentDate: '2024-03-14',
      })],
    }, now);
    expect(items.some((item) => /certificate/i.test(item.id) && item.id !== 'files-no-contract')).toBe(false);
  });

  test('withFileAttention appends file gaps without changing the rest of the metrics', () => {
    const next = withFileAttention(
      {
        attentionItems: [{
          id: 'invoices-overdue',
          page: 'new-invoice',
          title: 'Overdue',
          detail: 'Pay',
          action: 'Open',
          tone: 'warn' as const,
        }],
        attentionCount: 1,
        cash: { paid: 1 },
      },
      { files: [file({ type: 'permit' })], invoices: [] },
      now,
    );
    expect(next.cash).toEqual({ paid: 1 });
    expect(next.attentionItems.map((item) => item.id)).toEqual(['invoices-overdue', 'files-no-contract']);
    expect(next.attentionCount).toBe(2);
  });
});
