/**
 * Display helpers for what the assistant did. Newest-first list, History
 * marker, and the daily line in what needs you. No Firestore. No actions
 * import — keep this off App.js / PaletteHost.
 */
import { addDaysYmd, toYmd } from '../dates';

function isVoidExpense(expense: { status?: unknown } | null | undefined): boolean {
  return String((expense && expense.status) || '').toLowerCase() === 'void';
}

export const ACTIVITY_LIST_LIMIT = 50;
export const ACTIVITY_LIST_STATUSES = ['applied', 'proposed', 'undone'] as const;

export type ActivityStatus = (typeof ACTIVITY_LIST_STATUSES)[number];

export type ActivityEvidenceField = {
  source?: string;
  value?: unknown;
};

export type ActivityReceiptLike = {
  id: string;
  jobId: string;
  action: string;
  status: string;
  createdAt: Date | string | number;
  evidence?: Record<string, ActivityEvidenceField>;
  documentIds?: {
    expenseId?: string;
    expenseIds?: string[];
  };
};

export type AssistantAttentionItem = {
  id: string;
  page: string;
  title: string;
  detail: string;
  action: string;
  tone: 'warn' | 'neutral';
};

function createdAtMs(value: Date | string | number): number {
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : 0;
}

export function sortReceiptsNewestFirst<T extends { createdAt: Date | string | number; id?: string }>(
  rows: T[],
): T[] {
  return [...(rows || [])].sort((a, b) => {
    const diff = createdAtMs(b.createdAt) - createdAtMs(a.createdAt);
    if (diff !== 0) return diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

function isActivityStatus(status: string): status is ActivityStatus {
  return (ACTIVITY_LIST_STATUSES as readonly string[]).includes(status);
}

/**
 * Family org: getDocs the collection, then sort here. A composite
 * index is not required. Cap at 50 after the sort so the newest stay.
 */
export function activityReceiptsForView<T extends ActivityReceiptLike>(
  rows: T[],
  limit = ACTIVITY_LIST_LIMIT,
): T[] {
  return sortReceiptsNewestFirst(
    (rows || []).filter((row) => isActivityStatus(String(row.status || ''))),
  ).slice(0, limit);
}

export function activityActionLabel(action: string, receipt?: ActivityReceiptLike): string {
  if (action === 'createExpense') return 'Added an expense';
  if (action === 'codeExpense') return 'Coded an expense';
  if (action === 'codeExpenseBatch') {
    const count = receipt?.documentIds?.expenseIds?.length;
    if (count === 1) return 'Coded 1 expense';
    if (count && count > 1) return `Coded ${count} expenses`;
    return 'Coded expenses';
  }
  if (action === 'undoAction') return 'Undo';
  return action || 'Action';
}

export function activityStatusLabel(status: string): string {
  if (status === 'applied') return 'Applied';
  if (status === 'proposed') return 'Proposed';
  if (status === 'undone') return 'Undone';
  if (status === 'refused') return 'Refused';
  return status || '';
}

function fieldText(field: ActivityEvidenceField | undefined): string {
  if (!field || field.value == null || field.value === '') return '';
  return String(field.value).trim();
}

export function activityEvidenceSummary(receipt: ActivityReceiptLike): string {
  const evidence = receipt.evidence || {};
  if (receipt.action === 'createExpense') {
    const party = fieldText(evidence.party);
    const amount = fieldText(evidence.amount);
    const date = fieldText(evidence.date);
    return [party, amount, date].filter(Boolean).join(' · ');
  }
  if (receipt.action === 'codeExpense') {
    const trade = fieldText(evidence.tradeId);
    const source = String(evidence.tradeId?.source || '').trim();
    if (trade && source) return `${trade} (${source})`;
    return trade;
  }
  if (receipt.action === 'codeExpenseBatch') {
    const count = receipt.documentIds?.expenseIds?.length || 0;
    if (count === 1) return '1 expense';
    if (count > 1) return `${count} expenses`;
    return '';
  }
  return '';
}

export function canUndoReceipt(receipt: { status: string }): boolean {
  return String(receipt.status || '') === 'applied';
}

/**
 * Quiet History marker until a human opens or saves the expense.
 * Any assistant-touched live row, not only scans with assistantConfirmed: false.
 */
export function assistantHistoryMarker(expense: {
  source?: unknown;
  status?: unknown;
  assistantConfirmed?: unknown;
} | null | undefined): { show: boolean; label: string } {
  if (!expense) return { show: false, label: '' };
  if (String(expense.source || '') !== 'assistant') return { show: false, label: '' };
  if (isVoidExpense(expense)) return { show: false, label: '' };
  if (expense.assistantConfirmed === true) return { show: false, label: '' };
  return { show: true, label: 'Check' };
}

export function unconfirmedAssistantScanCount(expenses: Array<{
  source?: unknown;
  status?: unknown;
  assistantConfirmed?: unknown;
}> | null | undefined): number {
  return (expenses || []).filter((expense) => (
    !isVoidExpense(expense)
    && expense.source === 'assistant'
    && expense.assistantConfirmed === false
  )).length;
}

function isLocalYesterday(value: Date | string | number, now: Date): boolean {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return toYmd(date) === addDaysYmd(toYmd(now), -1);
}

/**
 * Yesterday on the local calendar (AU phone = AU day). Applied createExpense
 * and codeExpense only, so a batch parent is not counted twice.
 */
export function assistantYesterdayCounts(
  receipts: ActivityReceiptLike[] | null | undefined,
  jobId: string,
  now = new Date(),
): { added: number; coded: number } {
  const job = String(jobId || '').trim();
  let added = 0;
  let coded = 0;
  (receipts || []).forEach((row) => {
    if (!job || row.jobId !== job) return;
    if (String(row.status || '') !== 'applied') return;
    if (!isLocalYesterday(row.createdAt, now)) return;
    if (row.action === 'createExpense') added += 1;
    if (row.action === 'codeExpense') coded += 1;
  });
  return { added, coded };
}

export function assistantDailyLineCopy(added: number, coded: number, needLook: number): string | null {
  if (added <= 0 && coded <= 0) return null;
  const did: string[] = [];
  if (added > 0) {
    did.push(added === 1 ? 'added 1 expense' : `added ${added} expenses`);
  }
  if (coded > 0) {
    did.push(`coded ${coded}`);
  }
  const look = needLook <= 0
    ? ''
    : (needLook === 1 ? ' 1 needs a look.' : ` ${needLook} need a look.`);
  return `The assistant ${did.join(' and ')} yesterday.${look}`;
}

export function assistantDailyLineItem(input: {
  receipts?: ActivityReceiptLike[] | null;
  jobId: string;
  expenses?: Array<{ source?: unknown; status?: unknown; assistantConfirmed?: unknown }> | null;
  now?: Date;
}): AssistantAttentionItem | null {
  const now = input.now || new Date();
  const { added, coded } = assistantYesterdayCounts(input.receipts, input.jobId, now);
  const needLook = unconfirmedAssistantScanCount(input.expenses);
  const title = assistantDailyLineCopy(added, coded, needLook);
  if (!title) return null;
  return {
    id: 'assistant-yesterday',
    page: 'assistant-activity',
    title,
    detail: 'Open the list to undo, or check History.',
    action: 'See',
    tone: 'neutral',
  };
}

export function withAssistantDailyLine<T extends {
  attentionItems?: AssistantAttentionItem[];
  attentionCount?: number;
}>(
  metrics: T,
  input: {
    receipts?: ActivityReceiptLike[] | null;
    jobId: string;
    expenses?: Array<{ source?: unknown; status?: unknown; assistantConfirmed?: unknown }> | null;
    now?: Date;
  },
): T {
  const extra = assistantDailyLineItem(input);
  if (!metrics || !extra) return metrics;
  const attentionItems = [extra, ...(metrics.attentionItems || [])];
  return {
    ...metrics,
    attentionItems,
    attentionCount: attentionItems.length,
  };
}
