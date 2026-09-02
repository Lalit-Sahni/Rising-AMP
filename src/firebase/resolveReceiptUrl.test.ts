import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./storage', () => ({
  getDownloadUrlForPath: vi.fn(),
  getReceiptImageUrl: vi.fn(),
}));

import { getDownloadUrlForPath, getReceiptImageUrl } from './storage';
import { resolveExpenseReceiptUrl } from './resolveReceiptUrl';

describe('resolveExpenseReceiptUrl', () => {
  beforeEach(() => {
    vi.mocked(getDownloadUrlForPath).mockReset();
    vi.mocked(getReceiptImageUrl).mockReset();
    vi.mocked(getReceiptImageUrl).mockResolvedValue({ success: false });
  });

  it('prefers a fresh URL from the stored path', async () => {
    vi.mocked(getDownloadUrlForPath).mockResolvedValue('https://fresh.example/r.jpg');
    await expect(resolveExpenseReceiptUrl({
      receiptImagePath: 'receipts/job/e1/receipt.jpg',
      receiptImageUrl: 'https://old.example/r.jpg',
    })).resolves.toBe('https://fresh.example/r.jpg');
  });

  it('falls back to the stored URL when the path cannot be read', async () => {
    vi.mocked(getDownloadUrlForPath).mockResolvedValue(null);
    await expect(resolveExpenseReceiptUrl({
      receiptImagePath: 'receipts/job/e1/receipt.jpg',
      receiptImageUrl: 'https://old.example/r.jpg',
    })).resolves.toBe('https://old.example/r.jpg');
  });

  it('returns null when there is no receipt', async () => {
    await expect(resolveExpenseReceiptUrl({ itemName: 'No photo' })).resolves.toBeNull();
  });

  it('lists the expense folder when path and url are missing', async () => {
    vi.mocked(getReceiptImageUrl).mockResolvedValue({
      success: true,
      url: 'https://listed.example/r.jpg',
    });
    await expect(resolveExpenseReceiptUrl(
      { id: 'e1', jobId: 'job-1' },
    )).resolves.toBe('https://listed.example/r.jpg');
  });
});
