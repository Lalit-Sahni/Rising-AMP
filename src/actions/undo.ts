/**
 * Undo an applied action from its receipt. Restores the previous tradeId
 * (including null), or voids a created expense. Never hard-deletes.
 */
import { z } from 'zod';
import { resolveTargetJobIds } from '../queries/core';
import {
  actionFailure,
  firstZodIssue,
  invalidActionInput,
  queryScopeSchema,
  type ActionResult,
} from './core';
import type { ActionStore } from './store';

export const undoActionInputSchema = z
  .object({
    scope: queryScopeSchema,
    receiptId: z.string().min(1).max(128),
    clientKey: z.string().min(8).max(128),
  })
  .strict();

export type UndoActionInput = z.infer<typeof undoActionInputSchema>;

export async function undoAction(input: unknown, store: ActionStore): Promise<ActionResult> {
  const parsed = undoActionInputSchema.safeParse(input);
  if (!parsed.success) return invalidActionInput(firstZodIssue(parsed.error));
  const { scope, receiptId } = parsed.data;
  if (!scope.orgId) return actionFailure('org_required', 'An organisation is required.');

  const receipt = await store.getReceipt(scope.orgId, receiptId);
  if (!receipt) return invalidActionInput('That receipt was not found.');

  const target = resolveTargetJobIds(scope, receipt.jobId);
  if (!target.ok) {
    return actionFailure(target.error.code, target.error.message);
  }

  if (receipt.status === 'undone') {
    return { ok: true, receipt };
  }

  if (receipt.status === 'applied' && receipt.undo.kind === 'restoreTradeId') {
    await store.updateExpense(scope.orgId, receipt.jobId, receipt.undo.expenseId, {
      tradeId: receipt.undo.previousTradeId,
      clearAssistantStamp: true,
      updatedAt: new Date(),
    });
  }

  if (receipt.status === 'applied' && receipt.undo.kind === 'voidExpense') {
    await store.voidExpense(scope.orgId, receipt.jobId, receipt.undo.expenseId);
  }

  const undoneAt = new Date();
  await store.patchReceipt(scope.orgId, receipt.id, { status: 'undone', undoneAt });
  return { ok: true, receipt: { ...receipt, status: 'undone', undoneAt } };
}
