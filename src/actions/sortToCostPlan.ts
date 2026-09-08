/**
 * Apply a reviewed set of trade proposals. Lazy-loaded from Cost Plan.
 * Do not import from App.js or PaletteHost.
 */
import { scopeFromMembership } from '../queries/core';
import { codeExpenseBatch } from './codeExpenseBatch';
import type { ActionReceipt, EvidenceSource } from './core';
import { undoAction } from './undo';

export type ApplyTradeRow = {
  expenseId: string;
  tradeId: string;
  source: EvidenceSource;
};

export type ApplyTradesInput = {
  jobId: string;
  orgId: string | null | undefined;
  allowedJobs: Array<{ projectId?: string; id?: string }> | null | undefined;
  rows: ApplyTradeRow[];
};

export type ApplyTradesResult =
  | {
    kind: 'applied';
    receipt: ActionReceipt;
    message: string;
    undo: () => Promise<void>;
  }
  | { kind: 'proposed'; message: string }
  | { kind: 'error'; message: string };

function clientKeyFor(jobId: string, rows: ApplyTradeRow[]): string {
  const stamp = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : String(Date.now());
  const ids = rows.map((row) => row.expenseId).join(',');
  return `codeExpenseBatch:${jobId}:${stamp}:${ids}`.slice(0, 128).padEnd(8, 'x');
}

async function loadStore() {
  const { createFirestoreActionStore } = await import('../firebase/assistantReceipts');
  return createFirestoreActionStore();
}

export async function applyProposedTrades(input: ApplyTradesInput): Promise<ApplyTradesResult> {
  const jobId = String(input.jobId || '').trim();
  if (!jobId) return { kind: 'error', message: 'Open a job first.' };
  const scope = scopeFromMembership(input.orgId, input.allowedJobs);
  if ('ok' in scope) {
    return { kind: 'error', message: scope.error.message };
  }
  const rows = (input.rows || []).filter((row) => (
    row
    && row.expenseId
    && row.tradeId
    && (row.source === 'user' || row.source === 'record' || row.source === 'ocr')
  ));
  if (rows.length === 0) {
    return { kind: 'error', message: 'Nothing ready to accept.' };
  }

  const store = await loadStore();
  const result = await codeExpenseBatch({
    scope,
    jobId,
    clientKey: clientKeyFor(jobId, rows),
    rows: rows.map((row) => ({
      expenseId: row.expenseId,
      tradeId: row.tradeId,
      evidence: { tradeId: { source: row.source, value: row.tradeId } },
    })),
  }, store);

  if (!result.ok) {
    return { kind: 'error', message: result.error.message };
  }
  if (result.receipt.tier !== 'do' || result.receipt.status !== 'applied') {
    return { kind: 'proposed', message: 'Those rows still need a trade picked.' };
  }

  try {
    const { invalidateKeys, queryKeys } = await import('../query/client');
    invalidateKeys(queryKeys.expenses(String(input.orgId || ''), jobId));
  } catch {
    // Listener still updates.
  }

  const count = result.receipt.documentIds.expenseIds?.length || rows.length;
  const message = count === 1
    ? '1 expense coded to the cost plan.'
    : `${count} expenses coded to the cost plan.`;

  return {
    kind: 'applied',
    receipt: result.receipt,
    message,
    undo: async () => {
      await undoAction({
        scope,
        receiptId: result.receipt.id,
        clientKey: `undo-${result.receipt.id}`.slice(0, 128).padEnd(8, 'x'),
      }, store);
      try {
        const { invalidateKeys, queryKeys } = await import('../query/client');
        invalidateKeys(queryKeys.expenses(String(input.orgId || ''), jobId));
      } catch {
        // Listener still updates.
      }
    },
  };
}
