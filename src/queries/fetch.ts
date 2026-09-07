/**
 * Thin Firestore readers for the query layer. Read-only: getDoc / getDocs /
 * getCountFromServer. Org id comes from membership scope.
 */
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { COST_PLAN_DOC_ID } from '../domain/costPlanCore';
import {
  LEDGER_ROLLUP_COLLECTION,
  LEDGER_ROLLUP_DOC_ID,
} from '../domain/ledgerRollupMeta';
import { costPlanQuoteSchema, costPlanSchema, jobFileSchema, parseAtBoundary } from '../domain/schemas';
import { resolveTargetJobIds, type JobMoneySnapshot, type QueryScope } from './core';
import { answerFromDocuments } from './documents';
import { contentKey, findFiles, type FileRecordSnapshot, type FileTextSnapshot } from './files';
import { findExpenses } from './expenses';
import { invoicesByStatus, type InvoiceSnapshot } from './invoices';
import { jobSummary, portfolioSummary } from './summary';
import { planVsActual } from './plan';
import { quotesForTrade } from './quotes';
import { spendByCategory, spendByParty, spendByTrade } from './spend';

const EXPENSE_PAGE = 1000;

function jobDoc(scope: QueryScope, jobId: string) {
  return doc(db, 'organizations', scope.orgId, 'projects', jobId);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function loadJobMoney(scope: QueryScope, jobId: string): Promise<JobMoneySnapshot> {
  const project = jobDoc(scope, jobId);
  const expensesQuery = query(
    collection(project, 'expenses'),
    orderBy('timestamp', 'desc'),
    limit(EXPENSE_PAGE),
  );
  const [rollupSnap, expenseSnap] = await Promise.all([
    getDoc(doc(project, LEDGER_ROLLUP_COLLECTION, LEDGER_ROLLUP_DOC_ID)),
    getDocs(expensesQuery),
  ]);
  const expenses = expenseSnap.docs.map((row) => ({ id: row.id, ...asRecord(row.data()) }));
  let expensesCapped = expenseSnap.size >= EXPENSE_PAGE;
  if (expensesCapped) {
    const countSnap = await getCountFromServer(collection(project, 'expenses'));
    expensesCapped = (countSnap.data().count || 0) > expenses.length;
  }
  return {
    jobId,
    rollup: rollupSnap.exists() ? rollupSnap.data() : null,
    expenses,
    expensesCapped,
    expensesLoaded: true,
  };
}

export async function loadJobsMoney(scope: QueryScope, jobIds: string[]): Promise<JobMoneySnapshot[]> {
  return Promise.all(jobIds.map((id) => loadJobMoney(scope, id)));
}

async function loadJobInvoices(scope: QueryScope, jobId: string): Promise<InvoiceSnapshot> {
  const snap = await getDocs(collection(jobDoc(scope, jobId), 'invoices'));
  return {
    jobId,
    invoices: snap.docs.map((row) => ({ id: row.id, ...asRecord(row.data()) })),
  };
}

async function loadJobFiles(scope: QueryScope, jobId: string): Promise<FileRecordSnapshot[]> {
  const snap = await getDocs(collection(jobDoc(scope, jobId), 'files'));
  return snap.docs.map((row) => {
    const parsed = parseAtBoundary(jobFileSchema, { id: row.id, ...row.data() });
    const data = parsed.data;
    return {
      id: row.id,
      jobId,
      name: String(data.name || ''),
      type: String(data.type || 'other'),
      note: typeof data.note === 'string' ? data.note : undefined,
      status: typeof data.status === 'string' ? data.status : 'active',
    };
  });
}

async function loadFileText(
  scope: QueryScope,
  jobId: string,
  fileId: string,
): Promise<FileTextSnapshot | undefined> {
  const snap = await getDoc(doc(jobDoc(scope, jobId), 'files', fileId, 'content', 'text'));
  if (!snap.exists()) return undefined;
  const data = asRecord(snap.data());
  const page = data.page;
  return {
    text: typeof data.text === 'string' ? data.text : '',
    textStatus: typeof data.textStatus === 'string' ? data.textStatus : '',
    page: typeof page === 'number' && Number.isInteger(page) && page > 0 ? page : undefined,
  };
}

async function loadPlan(scope: QueryScope, jobId: string) {
  const snap = await getDoc(doc(jobDoc(scope, jobId), 'costPlan', COST_PLAN_DOC_ID));
  if (!snap.exists()) return null;
  const parsed = parseAtBoundary(costPlanSchema, { id: snap.id, ...snap.data() });
  return parsed.ok ? parsed.data : null;
}

async function loadQuotes(scope: QueryScope, jobId: string) {
  const snap = await getDocs(collection(jobDoc(scope, jobId), 'quotes'));
  return snap.docs.map((row) => {
    const parsed = parseAtBoundary(costPlanQuoteSchema, { id: row.id, ...row.data() });
    return parsed.data;
  });
}

export async function fetchSpendByTrade(input: { scope: QueryScope; jobId?: string } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const jobs = await loadJobsMoney(input.scope, access.jobIds);
  return spendByTrade({ ...input, jobs });
}

export async function fetchSpendByParty(input: { scope: QueryScope; jobId?: string } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const jobs = await loadJobsMoney(input.scope, access.jobIds);
  return spendByParty({ ...input, jobs });
}

export async function fetchSpendByCategory(input: { scope: QueryScope; jobId?: string } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const jobs = await loadJobsMoney(input.scope, access.jobIds);
  return spendByCategory({ ...input, jobs });
}

export async function fetchJobSummary(input: { scope: QueryScope; jobId: string } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const job = await loadJobMoney(input.scope, input.jobId);
  return jobSummary({ ...input, ...job });
}

export async function fetchPortfolioSummary(input: { scope: QueryScope } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope);
  if (!access.ok) return access;
  const jobs = await loadJobsMoney(input.scope, access.jobIds);
  return portfolioSummary({ ...input, jobs });
}

export async function fetchPlanVsActual(input: { scope: QueryScope; jobId: string } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const [job, plan] = await Promise.all([
    loadJobMoney(input.scope, input.jobId),
    loadPlan(input.scope, input.jobId),
  ]);
  return planVsActual({ ...input, job, plan });
}

export async function fetchInvoicesByStatus(input: { scope: QueryScope; jobId?: string } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const jobs = await Promise.all(access.jobIds.map((jobId) => loadJobInvoices(input.scope, jobId)));
  return invoicesByStatus({ ...input, jobs });
}

export async function fetchFindExpenses(input: { scope: QueryScope; jobId?: string } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const jobs = await loadJobsMoney(input.scope, access.jobIds);
  return findExpenses({ ...input, jobs });
}

export async function fetchQuotesForTrade(input: { scope: QueryScope; jobId: string } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const quotes = await loadQuotes(input.scope, input.jobId);
  return quotesForTrade({ ...input, quotes });
}

export async function fetchFindFiles(input: { scope: QueryScope; jobId?: string; text?: string } & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const files = (await Promise.all(access.jobIds.map((jobId) => loadJobFiles(input.scope, jobId)))).flat();
  const content: Record<string, FileTextSnapshot | undefined> = {};
  if (String(input.text || '').trim()) {
    await Promise.all(files.map(async (file) => {
      content[contentKey(file.jobId, file.id)] = await loadFileText(input.scope, file.jobId, file.id);
    }));
  }
  return findFiles({ ...input, files, content });
}

export async function fetchAnswerFromDocuments(input: {
  scope: QueryScope;
  jobId?: string;
  question?: string;
  text?: string;
  type?: string;
} & Record<string, unknown>) {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const files = (await Promise.all(access.jobIds.map((jobId) => loadJobFiles(input.scope, jobId)))).flat();
  const content: Record<string, FileTextSnapshot | undefined> = {};
  await Promise.all(files.map(async (file) => {
    content[contentKey(file.jobId, file.id)] = await loadFileText(input.scope, file.jobId, file.id);
  }));
  return answerFromDocuments({ ...input, files, content });
}
