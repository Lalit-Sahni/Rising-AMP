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
  status?: string;
  category?: string;
  total?: number;
  source?: string;
  assistantReceiptId?: string;
  assistantConfirmed?: boolean;
  gstCents?: number;
  partyId?: string;
  updatedAt?: Date;
  [key: string]: unknown;
};

export type ExpenseWrite = {
  tradeId: string | null;
  source?: 'assistant';
  assistantReceiptId?: string;
  /** Undo: drop source / assistantReceiptId rather than leaving a stale stamp. */
  clearAssistantStamp?: boolean;
  updatedAt: Date;
};

export type CreatedExpenseWrite = {
  id: string;
  jobId: string;
  category: string;
  source: 'assistant';
  assistantReceiptId: string;
  assistantConfirmed: false;
  partyId?: string;
  gstCents?: number;
  receiptImagePath?: string;
  receiptImageUrl?: string;
  receiptUploadedAt?: string;
  fields: Record<string, unknown>;
};

export type LinkedFile = {
  id: string;
  jobId: string;
  linkedTo?: { kind: 'expense'; id: string };
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
  createExpense(orgId: string, jobId: string, expense: CreatedExpenseWrite): Promise<void>;
  voidExpense(orgId: string, jobId: string, expenseId: string): Promise<void>;
  linkFileToExpense?(
    orgId: string,
    jobId: string,
    fileId: string,
    expenseId: string,
  ): Promise<void>;
  getReceipt(orgId: string, receiptId: string): Promise<ActionReceipt | null>;
  getReceiptByClientKey(orgId: string, clientKey: string): Promise<ActionReceipt | null>;
  putReceipt(receipt: ActionReceipt): Promise<void>;
  patchReceipt(orgId: string, receiptId: string, patch: ReceiptPatch): Promise<void>;
  /**
   * Only a deliberate false is off. Missing is on. A read that failed is
   * 'unknown', which is allowed rather than presented as someone's choice.
   */
  assistantWritesEnabled(orgId: string): Promise<boolean | 'unknown'>;
};

export type MemoryActionStore = ActionStore & {
  expenseWriteCount: number;
  receiptWriteCount: number;
  receiptPatchCount: number;
  fileLinkCount: number;
  seedExpense(orgId: string, expense: StoredExpense): void;
  setAssistantWritesEnabled(orgId: string, enabled: boolean | 'unknown'): void;
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

function fileKey(orgId: string, jobId: string, fileId: string): string {
  return `${orgId}::${jobId}::file::${fileId}`;
}

export function createMemoryActionStore(seed: StoredExpense[] = [], orgId = 'org-1'): MemoryActionStore {
  const expenses = new Map<string, StoredExpense>();
  const receipts = new Map<string, ActionReceipt>();
  const byClientKey = new Map<string, string>();
  const files = new Map<string, LinkedFile>();
  const writeFlags = new Map<string, boolean | 'unknown'>();
  seed.forEach((row) => {
    expenses.set(expenseKey(orgId, row.jobId, row.id), { ...row });
  });

  const store: MemoryActionStore = {
    expenseWriteCount: 0,
    receiptWriteCount: 0,
    receiptPatchCount: 0,
    fileLinkCount: 0,
    seedExpense(nextOrgId, expense) {
      expenses.set(expenseKey(nextOrgId, expense.jobId, expense.id), { ...expense });
    },
    setAssistantWritesEnabled(nextOrgId, enabled) {
      writeFlags.set(nextOrgId, enabled === 'unknown' ? 'unknown' : enabled === true);
    },
    async assistantWritesEnabled(nextOrgId) {
      if (writeFlags.has(nextOrgId)) return writeFlags.get(nextOrgId) as boolean | 'unknown';
      return true;
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
    async createExpense(nextOrgId, jobId, expense) {
      const key = expenseKey(nextOrgId, jobId, expense.id);
      if (expenses.has(key)) return;
      const row: StoredExpense = {
        ...expense.fields,
        id: expense.id,
        jobId,
        category: expense.category,
        tradeId: null,
        source: expense.source,
        assistantReceiptId: expense.assistantReceiptId,
        assistantConfirmed: expense.assistantConfirmed,
      };
      if (expense.partyId) row.partyId = expense.partyId;
      if (expense.gstCents != null) row.gstCents = expense.gstCents;
      if (expense.receiptImagePath) row.receiptImagePath = expense.receiptImagePath;
      if (expense.receiptImageUrl) row.receiptImageUrl = expense.receiptImageUrl;
      if (expense.receiptUploadedAt) row.receiptUploadedAt = expense.receiptUploadedAt;
      expenses.set(key, row);
      store.expenseWriteCount += 1;
    },
    async voidExpense(nextOrgId, jobId, expenseId) {
      const key = expenseKey(nextOrgId, jobId, expenseId);
      const current = expenses.get(key);
      if (!current) throw new Error('expense_not_found');
      if (String(current.status || '').toLowerCase() === 'void') return;
      const statusBeforeVoid = String(current.status || 'active');
      expenses.set(key, {
        ...current,
        status: 'void',
        statusBeforeVoid,
        voidedAt: new Date(),
        updatedAt: new Date(),
      });
      store.expenseWriteCount += 1;
    },
    async linkFileToExpense(nextOrgId, jobId, fileId, expenseId) {
      files.set(fileKey(nextOrgId, jobId, fileId), {
        id: fileId,
        jobId,
        linkedTo: { kind: 'expense', id: expenseId },
      });
      store.fileLinkCount += 1;
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
