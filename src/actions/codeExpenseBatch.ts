/**
 * Code several uncoded expenses in one reviewable pass.
 * Never recodes a row that already has a tradeId. Inferred evidence is skipped,
 * not repaired into do. Each child goes through codeExpense so it has a receipt.
 */
import { z } from 'zod';
import { resolveTargetJobIds } from '../queries/core';
import { codeExpense } from './codeExpense';
import {
  actionFailure,
  actionReceiptSchema,
  asTradeId,
  assignTier,
  fieldEvidenceSchema,
  firstZodIssue,
  invalidActionInput,
  isDirectEvidence,
  newReceiptId,
  queryScopeSchema,
  type ActionReceipt,
  type ActionResult,
  type EvidenceSource,
} from './core';
import type { ActionStore } from './store';
import { refuseIfAssistantWritesDisabled } from './writesGate';

const batchRowSchema = z
  .object({
    expenseId: z.string().min(1).max(128),
    tradeId: z.string().min(1).max(80),
    evidence: z
      .object({
        tradeId: fieldEvidenceSchema,
      })
      .strict(),
  })
  .strict();

export const codeExpenseBatchInputSchema = z
  .object({
    scope: queryScopeSchema,
    jobId: z.string().min(1).max(128),
    clientKey: z.string().min(8).max(128),
    rows: z.array(batchRowSchema).min(1).max(80),
  })
  .strict();

export type CodeExpenseBatchInput = z.infer<typeof codeExpenseBatchInputSchema>;

function childClientKey(batchKey: string, expenseId: string): string {
  const raw = `${batchKey}:${expenseId}`;
  return raw.slice(0, 128).padEnd(8, 'x');
}

function parentSource(sources: EvidenceSource[]): EvidenceSource {
  if (sources.includes('user')) return 'user';
  if (sources.includes('record')) return 'record';
  return 'ocr';
}

function buildReceipt(row: ActionReceipt): ActionReceipt {
  return actionReceiptSchema.parse(row);
}

export async function codeExpenseBatch(input: unknown, store: ActionStore): Promise<ActionResult> {
  const parsed = codeExpenseBatchInputSchema.safeParse(input);
  if (!parsed.success) return invalidActionInput(firstZodIssue(parsed.error));
  const { scope, jobId, clientKey, rows } = parsed.data;
  if (!scope.orgId) return actionFailure('org_required', 'An organisation is required.');

  const target = resolveTargetJobIds(scope, jobId);
  if (!target.ok) {
    return actionFailure(target.error.code, target.error.message);
  }

  const replay = await store.getReceiptByClientKey(scope.orgId, clientKey);
  if (replay) return { ok: true, receipt: replay };

  const blocked = await refuseIfAssistantWritesDisabled(scope.orgId, store);
  if (blocked) return blocked;

  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.expenseId)) {
      return invalidActionInput('Each expense may appear only once.');
    }
    seen.add(row.expenseId);
  }

  const loaded = [];
  for (const row of rows) {
    const expense = await store.getExpense(scope.orgId, jobId, row.expenseId);
    if (!expense) return invalidActionInput('That expense was not found.');
    const current = asTradeId(expense.tradeId);
    const childKey = childClientKey(clientKey, row.expenseId);
    const existingChild = await store.getReceiptByClientKey(scope.orgId, childKey);
    if (current) {
      const alreadyThisBatch = Boolean(
        existingChild
        && existingChild.status === 'applied'
        && existingChild.changed?.tradeId?.to === row.tradeId,
      );
      if (!alreadyThisBatch) {
        return invalidActionInput('That expense is already coded.');
      }
    }
    loaded.push({ row, expense, current, existingChild });
  }

  const applied: Array<{
    expenseId: string;
    tradeId: string;
    previousTradeId: string | null;
    receiptId: string;
    source: EvidenceSource;
  }> = [];

  for (const item of loaded) {
    const source = item.row.evidence.tradeId.source;
    if (!isDirectEvidence(source)) continue;

    if (item.existingChild && item.existingChild.status === 'applied') {
      const prior = item.existingChild.changed?.tradeId;
      applied.push({
        expenseId: item.row.expenseId,
        tradeId: item.row.tradeId,
        previousTradeId: prior ? asTradeId(prior.from) : item.current,
        receiptId: item.existingChild.id,
        source,
      });
      continue;
    }

    const child = await codeExpense({
      scope,
      jobId,
      expenseId: item.row.expenseId,
      tradeId: item.row.tradeId,
      clientKey: childClientKey(clientKey, item.row.expenseId),
      evidence: item.row.evidence,
    }, store);
    if (!child.ok) return child;
    if (child.receipt.tier !== 'do' || child.receipt.status !== 'applied') continue;
    const prior = child.receipt.changed?.tradeId;
    applied.push({
      expenseId: item.row.expenseId,
      tradeId: item.row.tradeId,
      previousTradeId: prior ? asTradeId(prior.from) : item.current,
      receiptId: child.receipt.id,
      source,
    });
  }

  const createdAt = new Date();
  const id = newReceiptId();
  const sources = applied.map((row) => row.source);
  const evidence = applied.length > 0
    ? { batch: { source: parentSource(sources), value: String(applied.length) } }
    : { batch: { source: 'inferred' as const, value: '0' } };
  const tier = assignTier({ action: 'codeExpenseBatch', evidence });

  if (applied.length === 0 || tier !== 'do') {
    const receipt = buildReceipt({
      id,
      orgId: scope.orgId,
      jobId,
      action: 'codeExpenseBatch',
      source: 'assistant',
      clientKey,
      tier: 'propose',
      status: 'proposed',
      evidence,
      documentIds: {},
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
    action: 'codeExpenseBatch',
    source: 'assistant',
    clientKey,
    tier: 'do',
    status: 'applied',
    evidence,
    documentIds: {
      expenseIds: applied.map((row) => row.expenseId),
      receiptIds: applied.map((row) => row.receiptId),
    },
    undo: {
      kind: 'restoreTradeIdBatch',
      items: applied.map((row) => ({
        expenseId: row.expenseId,
        previousTradeId: row.previousTradeId,
        receiptId: row.receiptId,
      })),
    },
    createdAt,
  });
  await store.putReceipt(receipt);
  return { ok: true, receipt };
}
