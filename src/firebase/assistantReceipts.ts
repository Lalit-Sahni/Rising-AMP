/**
 * Firestore adapter for assistant receipts.
 * Path: organizations/{orgId}/assistantReceipts/{receiptId}
 * Palette / later activity chunk only. Do not import from App.js or PaletteHost.
 */
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  actionReceiptSchema,
  asTradeId,
  type ActionReceipt,
} from '../actions/core';
import type {
  ActionStore,
  CreatedExpenseWrite,
  ExpenseWrite,
  ReceiptPatch,
  StoredExpense,
} from '../actions/store';
import { db } from './config';
import { readAssistantWritesEnabled } from './assistantWrites';

export const ASSISTANT_RECEIPTS_COLLECTION = 'assistantReceipts';

function receiptsCol(orgId: string) {
  return collection(db, 'organizations', orgId, ASSISTANT_RECEIPTS_COLLECTION);
}

function receiptRef(orgId: string, receiptId: string) {
  return doc(db, 'organizations', orgId, ASSISTANT_RECEIPTS_COLLECTION, receiptId);
}

function expenseRef(orgId: string, jobId: string, expenseId: string) {
  return doc(db, 'organizations', orgId, 'projects', jobId, 'expenses', expenseId);
}

function fileRef(orgId: string, jobId: string, fileId: string) {
  return doc(db, 'organizations', orgId, 'projects', jobId, 'files', fileId);
}

function definedFields(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') return toDate();
  }
  const ms = typeof value === 'number' ? value : Date.parse(String(value || ''));
  return Number.isFinite(ms) ? new Date(ms) : new Date();
}

function firestoreSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Family org: read the collection with getDocs, then sort createdAt in
 * memory (newest 50). A composite index is not required.
 */
export async function listAssistantReceipts(orgId: string): Promise<ActionReceipt[]> {
  const id = String(orgId || '').trim();
  if (!id) return [];
  const snap = await getDocs(receiptsCol(id));
  const rows: ActionReceipt[] = [];
  snap.docs.forEach((row) => {
    const parsed = parseStoredReceipt(row.id, row.data() as Record<string, unknown>);
    if (parsed) rows.push(parsed);
  });
  return rows;
}

export function parseStoredReceipt(id: string, data: Record<string, unknown>): ActionReceipt | null {
  const parsed = actionReceiptSchema.safeParse({
    ...data,
    id: data.id || id,
    createdAt: asDate(data.createdAt),
    undoneAt: data.undoneAt == null ? undefined : asDate(data.undoneAt),
  });
  return parsed.success ? parsed.data : null;
}

export function createFirestoreActionStore(): ActionStore {
  return {
    async getExpense(orgId, jobId, expenseId) {
      const snap = await getDoc(expenseRef(orgId, jobId, expenseId));
      if (!snap.exists()) return null;
      const data = snap.data() || {};
      const row: StoredExpense = {
        id: snap.id,
        jobId,
        tradeId: asTradeId(data.tradeId),
      };
      if (typeof data.status === 'string') row.status = data.status;
      if (typeof data.category === 'string') row.category = data.category;
      if (typeof data.source === 'string') row.source = data.source;
      if (typeof data.assistantReceiptId === 'string') row.assistantReceiptId = data.assistantReceiptId;
      if (typeof data.assistantConfirmed === 'boolean') row.assistantConfirmed = data.assistantConfirmed;
      if (typeof data.gstCents === 'number') row.gstCents = data.gstCents;
      if (typeof data.partyId === 'string') row.partyId = data.partyId;
      return row;
    },
    async updateExpense(orgId, jobId, expenseId, patch: ExpenseWrite) {
      await updateDoc(expenseRef(orgId, jobId, expenseId), {
        tradeId: patch.tradeId,
        updatedAt: serverTimestamp(),
        ...(patch.clearAssistantStamp
          ? { source: deleteField(), assistantReceiptId: deleteField() }
          : {
            ...(patch.source ? { source: patch.source } : {}),
            ...(patch.assistantReceiptId ? { assistantReceiptId: patch.assistantReceiptId } : {}),
            ...(patch.assistantConfirmed === undefined
              ? {}
              : { assistantConfirmed: patch.assistantConfirmed }),
          }),
      });
    },
    async createExpense(orgId, jobId, expense: CreatedExpenseWrite) {
      await setDoc(expenseRef(orgId, jobId, expense.id), definedFields({
        ...expense.fields,
        id: expense.id,
        jobId,
        category: expense.category,
        source: expense.source,
        assistantReceiptId: expense.assistantReceiptId,
        assistantConfirmed: expense.assistantConfirmed,
        partyId: expense.partyId,
        gstCents: expense.gstCents,
        receiptImagePath: expense.receiptImagePath,
        receiptImageUrl: expense.receiptImageUrl,
        receiptUploadedAt: expense.receiptUploadedAt,
        timestamp: serverTimestamp(),
      }));
    },
    async voidExpense(orgId, jobId, expenseId) {
      const snap = await getDoc(expenseRef(orgId, jobId, expenseId));
      if (!snap.exists()) throw new Error('expense_not_found');
      const current = String(snap.data()?.status || 'active');
      if (current.toLowerCase() === 'void') return;
      await updateDoc(expenseRef(orgId, jobId, expenseId), {
        status: 'void',
        statusBeforeVoid: current,
        voidedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    async linkFileToExpense(orgId, jobId, fileId, expenseId) {
      await updateDoc(fileRef(orgId, jobId, fileId), {
        linkedTo: { kind: 'expense', id: expenseId },
        updatedAt: serverTimestamp(),
      });
    },
    async getReceipt(orgId, receiptId) {
      const snap = await getDoc(receiptRef(orgId, receiptId));
      if (!snap.exists()) return null;
      return parseStoredReceipt(snap.id, snap.data() as Record<string, unknown>);
    },
    async getReceiptByClientKey(orgId, clientKey) {
      const snap = await getDocs(
        query(receiptsCol(orgId), where('clientKey', '==', clientKey), limit(1)),
      );
      const row = snap.docs[0];
      if (!row) return null;
      return parseStoredReceipt(row.id, row.data() as Record<string, unknown>);
    },
    async putReceipt(receipt: ActionReceipt) {
      const { createdAt: _createdAt, undoneAt: _undoneAt, ...rest } = receipt;
      await setDoc(receiptRef(receipt.orgId, receipt.id), {
        ...firestoreSafe(rest),
        createdAt: serverTimestamp(),
      });
    },
    async patchReceipt(orgId, receiptId, patch: ReceiptPatch) {
      await updateDoc(receiptRef(orgId, receiptId), {
        status: patch.status,
        undoneAt: serverTimestamp(),
        ...(patch.undoReceiptId ? { undoReceiptId: patch.undoReceiptId } : {}),
      });
    },
    async assistantWritesEnabled(orgId) {
      return readAssistantWritesEnabled(orgId);
    },
  };
}
