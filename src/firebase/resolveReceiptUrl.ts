import { getDownloadUrlForPath, getReceiptImageUrl } from './storage';

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export type ResolveReceiptOptions = {
  jobId?: string;
  expenseId?: string;
};

/** Fresh Storage URL when a path exists; otherwise the stored download URL. */
export async function resolveExpenseReceiptUrl(
  expense: unknown,
  options: ResolveReceiptOptions = {},
): Promise<string | null> {
  const row = expense && typeof expense === 'object' ? expense as Record<string, unknown> : null;
  if (!row) return null;
  const path = asText(row.receiptImagePath);
  const stored = asText(row.receiptImageUrl);
  if (path) {
    const fresh = await getDownloadUrlForPath(path);
    if (fresh) return fresh;
  }
  if (stored) return stored;

  const jobId = asText(options.jobId) || asText(row.jobId);
  const expenseId = asText(options.expenseId) || asText(row.id);
  if (!jobId || !expenseId) return null;
  const listed = await getReceiptImageUrl(jobId, expenseId);
  return listed?.success && listed.url ? listed.url : null;
}
