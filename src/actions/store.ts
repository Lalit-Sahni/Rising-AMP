/**
 * Persistence for assistant receipts and the expense rows they touch.
 * Unit tests use the in-memory Map store. Firestore lives in
 * src/firebase/assistantReceipts.ts and must stay off App.js / PaletteHost.
 */
import type { ActionReceipt } from './core';

export type StoredExpense = {
  id: string;
  jobId: string;
  tradeId: string | null;
  source?: string;
  assistantReceiptId?: string;
  updatedAt?: Date;
};

export type ExpenseWrite = {
  tradeId: string | null;
  source?: 'assistant';
  assistantReceiptId?: string;
  /** Undo: drop source / assistantReceiptId rather than leaving a stale stamp. */
  clearAssistantStamp?: boolean;
  updatedAt: Date;
};

export type ReceiptPatch = {
  status: 'undone';
  undoneAt: Date;
  undoReceiptId?: string;
};

export type ActionStore = {
  getExpense(orgId: string, jobId: string, expenseId: string): Promise<StoredExpense | null>;
  updateExpense(
    orgId: string,
    jobId: string,
    expenseId: string,
    patch: ExpenseWrite,
  ): Promise<void>;
  getReceipt(orgId: string, receiptId: string): Promise<ActionReceipt | null>;
  getReceiptByClientKey(orgId: string, clientKey: string): Promise<ActionReceipt | null>;
  putReceipt(receipt: ActionReceipt): Promise<void>;
  patchReceipt(orgId: string, receiptId: string, patch: ReceiptPatch): Promise<void>;
};

export type MemoryActionStore = ActionStore & {
  expenseWriteCount: number;
  receiptWriteCount: number;
  receiptPatchCount: number;
  seedExpense(orgId: string, expense: StoredExpense): void;
};

function expenseKey(orgId: string, jobId: string, expenseId: string): string {
  return `${orgId}::${jobId}::${expenseId}`;
}

function clientKeyIndex(orgId: string, clientKey: string): string {
  return `${orgId}::${clientKey}`;
}

function receiptKey(orgId: string, receiptId: string): string {
  return `${orgId}::${receiptId}`;
}

export function createMemoryActionStore(seed: StoredExpense[] = [], orgId = 'org-1'): MemoryActionStore {
  const expenses = new Map<string, StoredExpense>();
  const receipts = new Map<string, ActionReceipt>();
  const byClientKey = new Map<string, string>();
  seed.forEach((row) => {
    expenses.set(expenseKey(orgId, row.jobId, row.id), { ...row });
  });

  const store: MemoryActionStore = {
    expenseWriteCount: 0,
    receiptWriteCount: 0,
    receiptPatchCount: 0,
    seedExpense(nextOrgId, expense) {
      expenses.set(expenseKey(nextOrgId, expense.jobId, expense.id), { ...expense });
    },
    async getExpense(nextOrgId, jobId, expenseId) {
      const row = expenses.get(expenseKey(nextOrgId, jobId, expenseId));
      return row ? { ...row } : null;
    },
    async updateExpense(nextOrgId, jobId, expenseId, patch) {
      const key = expenseKey(nextOrgId, jobId, expenseId);
      const current = expenses.get(key);
      if (!current) throw new Error('expense_not_found');
      const next: StoredExpense = {
        ...current,
        tradeId: patch.tradeId,
        updatedAt: patch.updatedAt,
        id: current.id,
        jobId: current.jobId,
      };
      if (patch.clearAssistantStamp) {
        delete next.source;
        delete next.assistantReceiptId;
      } else {
        if (patch.source) next.source = patch.source;
        if (patch.assistantReceiptId) next.assistantReceiptId = patch.assistantReceiptId;
      }
      expenses.set(key, next);
      store.expenseWriteCount += 1;
    },
    async getReceipt(nextOrgId, receiptId) {
      const row = receipts.get(receiptKey(nextOrgId, receiptId));
      return row ? { ...row } : null;
    },
    async getReceiptByClientKey(nextOrgId, clientKey) {
      const id = byClientKey.get(clientKeyIndex(nextOrgId, clientKey));
      if (!id) return null;
      return store.getReceipt(nextOrgId, id);
    },
    async putReceipt(receipt) {
      receipts.set(receiptKey(receipt.orgId, receipt.id), { ...receipt });
      byClientKey.set(clientKeyIndex(receipt.orgId, receipt.clientKey), receipt.id);
      store.receiptWriteCount += 1;
    },
    async patchReceipt(nextOrgId, receiptId, patch) {
      const key = receiptKey(nextOrgId, receiptId);
      const current = receipts.get(key);
      if (!current) throw new Error('receipt_not_found');
      receipts.set(key, { ...current, ...patch });
      store.receiptPatchCount += 1;
    },
  };
  return store;
}
