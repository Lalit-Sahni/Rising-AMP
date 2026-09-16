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
  writeBatch,
  type DocumentData,
  type UpdateData,
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

/** Shared patch shaping: updateExpense and commitCoding must never drift. */
function expensePatchFields(patch: ExpenseWrite): UpdateData<DocumentData> {
  return {
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
  };
}

/** Shared create shaping: createExpense and commitCreation must never drift. */
function expenseCreateFields(jobId: string, expense: CreatedExpenseWrite): DocumentData {
  return definedFields({
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
  });
}

function expenseVoidFields(statusBeforeVoid: string): UpdateData<DocumentData> {
  return {
    status: 'void',
    statusBeforeVoid,
    voidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function fileLinkFields(expenseId: string): UpdateData<DocumentData> {
  return {
    linkedTo: { kind: 'expense', id: expenseId },
    updatedAt: serverTimestamp(),
  };
}

/** Shared receipt shaping: putReceipt and the commit methods must never drift. */
function receiptCreateFields(receipt: ActionReceipt): DocumentData {
  const { createdAt: _createdAt, undoneAt: _undoneAt, ...rest } = receipt;
  return {
    ...firestoreSafe(rest),
    createdAt: serverTimestamp(),
  };
}

function receiptPatchFields(patch: ReceiptPatch): UpdateData<DocumentData> {
  return {
    status: patch.status,
    undoneAt: serverTimestamp(),
    ...(patch.undoReceiptId ? { undoReceiptId: patch.undoReceiptId } : {}),
  };
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
      await updateDoc(expenseRef(orgId, jobId, expenseId), expensePatchFields(patch));
    },
    async createExpense(orgId, jobId, expense: CreatedExpenseWrite) {
      await setDoc(expenseRef(orgId, jobId, expense.id), expenseCreateFields(jobId, expense));
    },
    async voidExpense(orgId, jobId, expenseId) {
      const snap = await getDoc(expenseRef(orgId, jobId, expenseId));
      if (!snap.exists()) throw new Error('expense_not_found');
      const current = String(snap.data()?.status || 'active');
      if (current.toLowerCase() === 'void') return;
      await updateDoc(expenseRef(orgId, jobId, expenseId), expenseVoidFields(current));
    },
    async linkFileToExpense(orgId, jobId, fileId, expenseId) {
      await updateDoc(fileRef(orgId, jobId, fileId), fileLinkFields(expenseId));
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
      await setDoc(receiptRef(receipt.orgId, receipt.id), receiptCreateFields(receipt));
    },
    async patchReceipt(orgId, receiptId, patch: ReceiptPatch) {
      await updateDoc(receiptRef(orgId, receiptId), receiptPatchFields(patch));
    },
    async commitCoding(commit) {
      const batch = writeBatch(db);
      batch.update(
        expenseRef(commit.orgId, commit.jobId, commit.expenseId),
        expensePatchFields(commit.patch),
      );
      batch.set(receiptRef(commit.receipt.orgId, commit.receipt.id), receiptCreateFields(commit.receipt));
      await batch.commit();
    },
    async commitCreation(commit) {
      const batch = writeBatch(db);
      batch.set(
        expenseRef(commit.orgId, commit.jobId, commit.expense.id),
        expenseCreateFields(commit.jobId, commit.expense),
      );
      if (commit.fileId) {
        batch.update(fileRef(commit.orgId, commit.jobId, commit.fileId), fileLinkFields(commit.expense.id));
      }
      batch.set(receiptRef(commit.receipt.orgId, commit.receipt.id), receiptCreateFields(commit.receipt));
      await batch.commit();
    },
    async commitUndo(commit) {
      const batch = writeBatch(db);
      if (commit.expense.kind === 'restoreTradeId') {
        batch.update(
          expenseRef(commit.orgId, commit.jobId, commit.expenseId),
          expensePatchFields(commit.expense.patch),
        );
      } else {
        const snap = await getDoc(expenseRef(commit.orgId, commit.jobId, commit.expenseId));
        if (!snap.exists()) throw new Error('expense_not_found');
        const current = String(snap.data()?.status || 'active');
        if (current.toLowerCase() !== 'void') {
          batch.update(
            expenseRef(commit.orgId, commit.jobId, commit.expenseId),
            expenseVoidFields(current),
          );
        }
      }
      batch.update(receiptRef(commit.orgId, commit.receiptId), receiptPatchFields(commit.receiptPatch));
      await batch.commit();
    },
    async assistantWritesEnabled(orgId) {
      return readAssistantWritesEnabled(orgId);
    },
  };
}
