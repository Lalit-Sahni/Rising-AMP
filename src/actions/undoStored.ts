/**
 * Undo from a stored receipt id after reload. Not a client-side buffer.
 * Lazy activity page only. Do not import from App.js or PaletteHost.
 */
import { scopeFromMembership } from '../queries/core';
import { undoAction } from './undo';

export type UndoStoredReceiptInput = {
  orgId: string | null | undefined;
  allowedJobs: Array<{ projectId?: string; id?: string }> | null | undefined;
  receiptId: string;
};

export type UndoStoredReceiptResult =
  | { ok: true; jobId: string }
  | { ok: false; message: string };

export async function undoStoredReceipt(
  input: UndoStoredReceiptInput,
): Promise<UndoStoredReceiptResult> {
  const receiptId = String(input.receiptId || '').trim();
  if (!receiptId) return { ok: false, message: 'That receipt was not found.' };
  const scope = scopeFromMembership(input.orgId, input.allowedJobs);
  if ('ok' in scope) return { ok: false, message: scope.error.message };

  const { createFirestoreActionStore } = await import('../firebase/assistantReceipts');
  const store = createFirestoreActionStore();
  const result = await undoAction({
    scope,
    receiptId,
    clientKey: `undo-${receiptId}`.slice(0, 128).padEnd(8, 'x'),
  }, store);
  if (!result.ok) return { ok: false, message: result.error.message };

  try {
    const { invalidateKeys, queryKeys } = await import('../query/client');
    invalidateKeys(queryKeys.expenses(String(input.orgId || ''), result.receipt.jobId));
  } catch {
    // Listener still updates.
  }
  return { ok: true, jobId: result.receipt.jobId };
}
