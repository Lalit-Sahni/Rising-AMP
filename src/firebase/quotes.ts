import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import { allocationsCoverTotal } from '../domain/costPlan';
import {
  addQuoteFileIds,
  liveQuoteFileTargets,
  quoteFileIds,
  quoteFilePayload,
  removeQuoteFileId,
} from '../domain/quoteFiles';
import { costPlanQuoteSchema, parseAtBoundary, type CostPlanQuote } from '../domain/schemas';
import { db } from './config';
import { getActiveOrgId } from './tenancy';

type QuoteWrite = {
  party: string;
  partyId?: string;
  receivedDate: string;
  status: 'received' | 'chosen' | 'passed';
  amountCents: number;
  amountHighCents?: number | null;
  gstMode: 'inclusive' | 'exclusive';
  note?: string;
  fileId?: string | null;
  fileIds?: string[];
  allocations: Array<{ tradeId: string; amountCents: number }>;
  createdBy: string;
};

function quotesCol(jobId: string) {
  if (!jobId) throw new Error('Missing job');
  return collection(db, 'organizations', getActiveOrgId(), 'projects', jobId, 'quotes');
}

function quoteRef(jobId: string, quoteId: string) {
  return doc(db, 'organizations', getActiveOrgId(), 'projects', jobId, 'quotes', quoteId);
}

function definedFields(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function validationError(issues: string[]) {
  return issues[0] || 'That quote is not valid';
}

export async function fetchQuotes(jobId: string): Promise<CostPlanQuote[]> {
  const snap = await getDocs(quotesCol(jobId));
  return snap.docs.map((row) => {
    const parsed = parseAtBoundary(costPlanQuoteSchema, {
      id: row.id,
      ...row.data(),
    });
    if (parsed.ok) return parsed.data;
    return { id: row.id, ...parsed.data, _invalid: true } as unknown as CostPlanQuote;
  });
}

async function demoteOverlappingChosen(
  jobId: string,
  quoteId: string,
  allocations: QuoteWrite['allocations'],
) {
  const tradeIds = new Set(allocations.map((row) => row.tradeId));
  const existing = await fetchQuotes(jobId);
  const overlapping = existing.filter((quote) => (
    quote.id
    && quote.id !== quoteId
    && quote.status === 'chosen'
    && (quote.allocations || []).some((row) => tradeIds.has(row.tradeId))
  ));
  if (overlapping.length === 0) return;
  const batch = writeBatch(db);
  overlapping.forEach((quote) => {
    if (!quote.id) return;
    batch.update(quoteRef(jobId, quote.id), {
      status: 'received',
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

export async function saveQuote(jobId: string, input: QuoteWrite, quoteId?: string): Promise<CostPlanQuote> {
  const now = new Date();
  const files = quoteFilePayload(input.fileIds || (input.fileId ? [input.fileId] : []));
  const candidate = {
    id: quoteId || 'new',
    jobId,
    party: String(input.party || '').trim(),
    partyId: input.partyId,
    receivedDate: input.receivedDate,
    status: input.status,
    amountCents: input.amountCents,
    amountHighCents: input.amountHighCents ?? null,
    gstMode: input.gstMode,
    note: input.note,
    fileId: files.fileId,
    fileIds: files.fileIds,
    allocations: input.allocations,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
    voidedAt: null,
  };
  const parsed = parseAtBoundary(costPlanQuoteSchema, candidate);
  if (!parsed.ok) throw new Error(validationError(parsed.issues));
  if (!allocationsCoverTotal(parsed.data)) {
    throw new Error('Quote parts must add up to the total');
  }

  const payload = definedFields({
    jobId: parsed.data.jobId,
    party: parsed.data.party,
    partyId: parsed.data.partyId || null,
    receivedDate: parsed.data.receivedDate,
    status: parsed.data.status,
    amountCents: parsed.data.amountCents,
    amountHighCents: parsed.data.amountHighCents ?? null,
    gstMode: parsed.data.gstMode,
    note: parsed.data.note || null,
    fileId: files.fileId,
    fileIds: files.fileIds,
    allocations: parsed.data.allocations,
    createdBy: parsed.data.createdBy,
    updatedAt: serverTimestamp(),
    voidedAt: null,
  });

  let id = quoteId;
  if (id) {
    await updateDoc(quoteRef(jobId, id), payload as UpdateData<DocumentData>);
  } else {
    const created = await addDoc(quotesCol(jobId), {
      ...payload,
      createdAt: serverTimestamp(),
    });
    id = created.id;
  }

  if (parsed.data.status === 'chosen' && id) {
    await demoteOverlappingChosen(jobId, id, parsed.data.allocations);
  }
  if (id && files.fileIds.length > 0) {
    await exclusiveQuoteFiles(jobId, id, files.fileIds);
  }

  return { ...parsed.data, id };
}

export async function voidQuote(jobId: string, quoteId: string): Promise<void> {
  await updateDoc(quoteRef(jobId, quoteId), {
    status: 'void',
    voidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function applyFilePayload(
  batch: ReturnType<typeof writeBatch>,
  jobId: string,
  quoteId: string,
  ids: string[],
) {
  const payload = quoteFilePayload(ids);
  batch.update(quoteRef(jobId, quoteId), {
    fileId: payload.fileId,
    fileIds: payload.fileIds,
    updatedAt: serverTimestamp(),
  });
}

async function exclusiveQuoteFiles(jobId: string, ownerQuoteId: string, ids: string[]) {
  const moving = new Set(ids);
  if (moving.size === 0) return;
  const quotes = await fetchQuotes(jobId);
  const batch = writeBatch(db);
  let writes = 0;
  liveQuoteFileTargets(quotes).forEach((quote) => {
    if (!quote.id || quote.id === ownerQuoteId) return;
    const current = quoteFileIds(quote);
    const next = current.filter((id) => !moving.has(id));
    if (next.length === current.length) return;
    applyFilePayload(batch, jobId, quote.id, next);
    writes += 1;
  });
  if (writes > 0) await batch.commit();
}

/** Pointers only. Bytes stay in Files. A file sits on one live quote. */
export async function assignFilesToQuote(
  jobId: string,
  quoteId: string,
  fileIdsToAdd: string[],
): Promise<void> {
  if (!jobId) throw new Error('Missing job');
  if (!quoteId) throw new Error('Missing quote');
  const incoming = uniqueIncoming(fileIdsToAdd);
  if (incoming.length === 0) return;
  const quotes = await fetchQuotes(jobId);
  const target = quotes.find((quote) => quote.id === quoteId);
  if (!target || target.status === 'void') throw new Error('Choose a live quote.');
  const added = addQuoteFileIds(quoteFileIds(target), incoming);
  if (!added.ok) throw new Error(added.error);
  const batch = writeBatch(db);
  const moving = new Set(incoming);
  liveQuoteFileTargets(quotes).forEach((quote) => {
    if (!quote.id) return;
    if (quote.id === quoteId) {
      applyFilePayload(batch, jobId, quote.id, added.ids);
      return;
    }
    const current = quoteFileIds(quote);
    const next = current.filter((id) => !moving.has(id));
    if (next.length === current.length) return;
    applyFilePayload(batch, jobId, quote.id, next);
  });
  await batch.commit();
}

export async function unassignFileFromQuotes(jobId: string, fileId: string): Promise<void> {
  if (!jobId) throw new Error('Missing job');
  const drop = String(fileId || '').trim();
  if (!drop) return;
  const quotes = await fetchQuotes(jobId);
  const batch = writeBatch(db);
  let writes = 0;
  liveQuoteFileTargets(quotes).forEach((quote) => {
    if (!quote.id) return;
    const current = quoteFileIds(quote);
    if (!current.includes(drop)) return;
    applyFilePayload(batch, jobId, quote.id, removeQuoteFileId(current, drop));
    writes += 1;
  });
  if (writes > 0) await batch.commit();
}

function uniqueIncoming(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  (ids || []).forEach((value) => {
    const id = String(value || '').trim();
    if (!id || id.length > 80 || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}
