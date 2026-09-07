/**
 * Per-user Ask history under the org.
 * Path: organizations/{orgId}/askHistory/{uid}/items/{id}
 * Palette chunk only. Do not import from App.js or PaletteHost.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  asAskedAt,
  askHistorySchema,
  askHistoryWriteSchema,
  type AskHistoryChoice,
  type AskHistoryRow,
} from '../domain/askHistory';
import { parseAtBoundary } from '../domain/schemas';
import { db } from './config';

export const ASK_HISTORY_COLLECTION = 'askHistory';
export const ASK_HISTORY_ITEMS = 'items';
const HISTORY_CAP = 40;

export function askHistoryItemsPath(orgId: string, uid: string): string {
  return `organizations/${orgId}/${ASK_HISTORY_COLLECTION}/${uid}/${ASK_HISTORY_ITEMS}`;
}

function itemsCol(orgId: string, uid: string) {
  return collection(db, 'organizations', orgId, ASK_HISTORY_COLLECTION, uid, ASK_HISTORY_ITEMS);
}

function itemRef(orgId: string, uid: string, id: string) {
  return doc(db, 'organizations', orgId, ASK_HISTORY_COLLECTION, uid, ASK_HISTORY_ITEMS, id);
}

function firestoreSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function scopeJobId(jobId: string | null | undefined): string {
  return jobId || '';
}

export type SaveAskHistoryInput = {
  orgId: string;
  uid: string;
  question: string;
  jobId: string | null | undefined;
  jobLabel?: string;
  choices: AskHistoryChoice[];
};

export async function saveAskHistory(input: SaveAskHistoryInput): Promise<AskHistoryRow | null> {
  const payload = askHistoryWriteSchema.parse({
    uid: input.uid,
    orgId: input.orgId,
    jobId: scopeJobId(input.jobId),
    jobLabel: input.jobLabel || '',
    question: input.question,
    choices: input.choices,
  });
  const ref = doc(itemsCol(payload.orgId, payload.uid));
  await setDoc(ref, {
    ...firestoreSafe(payload),
    askedAt: serverTimestamp(),
  });
  return {
    ...payload,
    id: ref.id,
    askedAt: new Date(),
  };
}

export async function listAskHistory(input: {
  orgId: string;
  uid: string;
  jobId: string | null | undefined;
}): Promise<AskHistoryRow[]> {
  const snap = await getDocs(query(
    itemsCol(input.orgId, input.uid),
    where('jobId', '==', scopeJobId(input.jobId)),
  ));
  const rows: AskHistoryRow[] = [];
  snap.docs.forEach((row) => {
    const parsed = parseAtBoundary(askHistorySchema, {
      id: row.id,
      ...row.data(),
      askedAt: asAskedAt(row.data().askedAt),
    });
    if (parsed.ok) rows.push(parsed.data);
  });
  rows.sort((a, b) => b.askedAt.getTime() - a.askedAt.getTime());
  return rows.slice(0, HISTORY_CAP);
}

export async function deleteAskHistory(orgId: string, uid: string, id: string): Promise<void> {
  await deleteDoc(itemRef(orgId, uid, id));
}

export async function clearAskHistory(input: {
  orgId: string;
  uid: string;
  jobId: string | null | undefined;
}): Promise<void> {
  const rows = await listAskHistory(input);
  if (rows.length === 0) return;
  const batch = writeBatch(db);
  rows.forEach((row) => {
    if (row.id) batch.delete(itemRef(input.orgId, input.uid, row.id));
  });
  await batch.commit();
}
