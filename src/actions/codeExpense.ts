/**
 * Code (or clear) one existing expense's tradeId. Does not create expenses.
 * Does not invent money. The model never runs here. A human-origin coding is
 * confirmed by definition, so History does not ask him to check it again.
 * The patch and its receipt commit atomically: a half-write is un-undoable.
 */
import { z } from 'zod';
import { resolveTargetJobIds } from '../queries/core';
import {
  actionFailure,
  actionOriginSchema,
  actionReceiptSchema,
  assignTier,
  asTradeId,
  fieldEvidenceSchema,
  firstZodIssue,
  invalidActionInput,
  newReceiptId,
  queryScopeSchema,
  type ActionReceipt,
  type ActionResult,
} from './core';
import type { ActionStore } from './store';
import { refuseIfWriteBlocked } from './writesGate';

export const codeExpenseInputSchema = z
  .object({
    scope: queryScopeSchema,
    jobId: z.string().min(1).max(128),
    expenseId: z.string().min(1).max(128),
    tradeId: z.string().min(1).max(80).nullable(),
    clientKey: z.string().min(8).max(128),
    origin: actionOriginSchema,
    viewerIsOwner: z.boolean().optional(),
    evidence: z
      .object({
        tradeId: fieldEvidenceSchema,
      })
      .strict(),
  })
  .strict();

export type CodeExpenseInput = z.infer<typeof codeExpenseInputSchema>;

function buildReceipt(row: ActionReceipt): ActionReceipt {
  return actionReceiptSchema.parse(row);
}

export async function codeExpense(input: unknown, store: ActionStore): Promise<ActionResult> {
  const parsed = codeExpenseInputSchema.safeParse(input);
  if (!parsed.success) return invalidActionInput(firstZodIssue(parsed.error));
  const { scope, jobId, expenseId, tradeId, clientKey, origin, viewerIsOwner, evidence } = parsed.data;
  if (!scope.orgId) return actionFailure('org_required', 'An organisation is required.');

  const target = resolveTargetJobIds(scope, jobId);
  if (!target.ok) {
    return actionFailure(target.error.code, target.error.message);
  }

  const replay = await store.getReceiptByClientKey(scope.orgId, clientKey);
  if (replay) return { ok: true, receipt: replay };

  const expense = await store.getExpense(scope.orgId, jobId, expenseId);
  if (!expense) return invalidActionInput('That expense was not found.');

  const tier = assignTier({ action: 'codeExpense', evidence });
  const blocked = await refuseIfWriteBlocked({
    orgId: scope.orgId,
    origin,
    tier,
    viewerIsOwner: viewerIsOwner === true,
    store,
  });
  if (blocked) return blocked;

  const previousTradeId = asTradeId(expense.tradeId);
  const createdAt = new Date();
  const id = newReceiptId();

  if (tier !== 'do') {
    const receipt = buildReceipt({
      id,
      orgId: scope.orgId,
      jobId,
      action: 'codeExpense',
      source: 'assistant',
      origin,
      clientKey,
      tier,
      status: tier === 'refuse' ? 'refused' : 'proposed',
      evidence,
      documentIds: { expenseId },
      changed: { tradeId: { from: previousTradeId, to: tradeId } },
      undo: { kind: 'none' },
      createdAt,
    });
    await store.putReceipt(receipt);
    return { ok: true, receipt };
  }

  const receipt = buildReceipt({
    id,
    orgId: scope.orgId,
    jobId,
    action: 'codeExpense',
    source: 'assistant',
    origin,
    clientKey,
    tier: 'do',
    status: 'applied',
    evidence,
    documentIds: { expenseId },
    changed: { tradeId: { from: previousTradeId, to: tradeId } },
    undo: {
      kind: 'restoreTradeId',
      expenseId,
      previousTradeId,
    },
    createdAt,
  });

  await store.commitCoding({
    orgId: scope.orgId,
    jobId,
    expenseId,
    patch: {
      tradeId,
      source: 'assistant',
      assistantReceiptId: id,
      ...(origin === 'human' ? { assistantConfirmed: true } : {}),
      updatedAt: createdAt,
    },
    receipt,
  });
  return { ok: true, receipt };
}
