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
    fileId: input.fileId ?? null,
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
    fileId: parsed.data.fileId ?? null,
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

  return { ...parsed.data, id };
}

export async function voidQuote(jobId: string, quoteId: string): Promise<void> {
  await updateDoc(quoteRef(jobId, quoteId), {
    status: 'void',
    voidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
