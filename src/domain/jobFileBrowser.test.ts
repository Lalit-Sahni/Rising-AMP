import { jobFileSchema } from './schemas';
import {
  RECEIPT_FILE_TYPE,
  firstName,
} from './jobFiles';
import {
  combineJobFilesAndReceipts,
  fileAddedByLabel,
  fileLinkLabel,
  fileTypeCounts,
  receiptsFromExpenses,
  searchFileItems,
  visibleFileItems,
} from './jobFileBrowser';

const sampleFile = jobFileSchema.parse({
  id: 'f1',
  name: 'Slab engineer certificate',
  type: 'certificate',
  storagePath: 'files/opal-ss-constructions/job-1/f1/slab.pdf',
  thumbnailPath: 'files/opal-ss-constructions/job-1/f1/thumb.jpg',
  contentType: 'application/pdf',
  sizeBytes: 412000,
  uploadedBy: 'owner-1',
  documentDate: '2026-03-14',
  note: 'Engineer cert',
  status: 'active',
});

describe('Files screen browser', () => {
  test('search matches name, note and type', () => {
    const items = combineJobFilesAndReceipts([sampleFile], []);
    expect(searchFileItems(items, 'slab')[0].name).toMatch(/Slab/);
    expect(searchFileItems(items, 'engineer cert')).toHaveLength(1);
    expect(searchFileItems(items, 'certificate')).toHaveLength(1);
    expect(searchFileItems(items, 'permit')).toHaveLength(0);
  });

  test('type counts skip empty drawers and include receipts', () => {
    const items = combineJobFilesAndReceipts(
      [sampleFile],
      [{
        id: 'e1',
        category: 'purchase',
        itemName: 'Bunnings',
        date: '2026-03-12',
        receiptImagePath: 'receipts/org/job/e1/receipt.jpg',
      }],
    );
    const chips = fileTypeCounts(items);
    expect(chips[0]).toMatchObject({ type: 'all', count: 2 });
    expect(chips.find((chip) => chip.type === 'certificate')?.count).toBe(1);
    expect(chips.find((chip) => chip.type === RECEIPT_FILE_TYPE)?.count).toBe(1);
    expect(chips.find((chip) => chip.type === 'photo')).toBeUndefined();
  });

  test('receipts stay on the expense and never use the original as a thumbnail', () => {
    const receipts = receiptsFromExpenses([
      {
        id: 'e1',
        category: 'purchase',
        itemName: 'Bunnings',
        date: '2026-03-12',
        receiptImagePath: 'receipts/org/job/e1/receipt.jpg',
        receiptImageUrl: 'https://example.test/original.jpg',
        status: 'active',
      },
      {
        id: 'voided',
        category: 'purchase',
        itemName: 'Gone',
        receiptImagePath: 'receipts/org/job/voided/receipt.jpg',
        status: 'void',
      },
      {
        id: 'no-pic',
        category: 'labour',
        workerName: 'Julian',
      },
    ]);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].readOnly).toBe(true);
    expect(receipts[0].type).toBe(RECEIPT_FILE_TYPE);
    expect(receipts[0].thumbnailPath).toBeNull();
    expect(receipts[0].originalPath).toBe('receipts/org/job/e1/receipt.jpg');
    expect(receipts[0].name).toBe('Bunnings receipt');
  });

  test('sorts by document date, newest first', () => {
    const newer = jobFileSchema.parse({
      ...sampleFile,
      id: 'f2',
      name: 'Permit',
      type: 'permit',
      storagePath: 'files/opal-ss-constructions/job-1/f2/permit.pdf',
      documentDate: '2026-08-31',
    });
    const visible = visibleFileItems(
      combineJobFilesAndReceipts([sampleFile, newer], []),
      '',
      'all',
    );
    expect(visible.map((item) => item.name)).toEqual(['Permit', 'Slab engineer certificate']);
  });

  test('added-by is honest when we only know the current user', () => {
    const item = combineJobFilesAndReceipts([sampleFile], [])[0];
    expect(fileAddedByLabel(item, 'owner-1', 'Lalit Sahni')).toBe('added by Lalit');
    expect(fileAddedByLabel(item, 'someone-else', 'Lalit Sahni')).toBe('added by a teammate');
    expect(firstName('Lalit Sahni')).toBe('Lalit');
  });

  test('link labels name the expense or invoice when we have it', () => {
    expect(fileLinkLabel(
      { kind: 'expense', id: 'e1' },
      { expenses: [{ id: 'e1', category: 'purchase', itemName: 'Bunnings' }] },
    )).toBe('linked to Bunnings');
    expect(fileLinkLabel(
      { kind: 'invoice', id: 'inv-1' },
      { invoices: [{ id: 'inv-1', invoiceNumber: '2026-0004' }] },
    )).toBe('linked to 2026-0004');
  });
});
