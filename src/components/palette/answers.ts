/**
 * Palette answers from the Part D query layer. Numbers come from
 * spendByTrade / invoicesByStatus / portfolioSummary, never a model.
 * Ask (Part B) maps a routed choice onto these same rows after the
 * client runs src/queries/.
 */
import { parseCalendarDate } from '../../dates';
import { filesDrawerMeta, isJobFileType, type FilesDrawerType } from '../../domain/jobFiles';
import { categoryKey } from '../../domain/ledgerRollup';
import { formatCents } from '../../money';
import type { CostPlan } from '../../domain/schemas';
import type { JobMoneySnapshot, QueryFailure, QueryName, QueryProvenance, QueryScope, UncodedPool } from '../../queries/core';
import { provenanceSchema, scopeFromMembership } from '../../queries/core';
import type { FindExpensesResult } from '../../queries/expenses';
import type { FindFilesResult } from '../../queries/files';
import { invoicesByStatus, type InvoicesByStatusResult } from '../../queries/invoices';
import { planVsActual, type PlanVsActualResult } from '../../queries/plan';
import { spendByTrade, type SpendResult } from '../../queries/spend';
import { portfolioSummary, type PortfolioSummaryResult } from '../../queries/summary';
import type { QuotesForTradeResult } from '../../queries/quotes';
import { getInvoiceTotalCents, isInvoiceOverdue } from '../../utils/jobMetrics';

export type TradeListRow = {
  id: string;
  name: string;
  status?: string;
};

export type AnswerWorking = {
  query: QueryName;
  call: string;
  detail: string;
  capped: boolean;
};

export type KnownFigure = {
  label: string;
  amount: string;
};

export type WorkingLabels = {
  job?: string;
  trade?: string;
};

export const INCOMPLETE_CAP_MESSAGE = 'This answer is incomplete. More than 1,000 expenses — spend is not shown.';
export const REFUSAL_TITLE = "I can't answer that honestly.";

export type SpendAnswer = {
  id: string;
  section: 'Answers';
  kind: 'spend';
  title: string;
  detail: string;
  amount: string;
  tradeId: string;
  uncoded: UncodedPool;
  affected: boolean;
  warning?: string;
  working?: AnswerWorking;
  incomplete?: string;
};

export type PortfolioAnswer = {
  id: string;
  section: 'Answers';
  kind: 'portfolio';
  title: string;
  detail: string;
  amount: string;
  working?: AnswerWorking;
  incomplete?: string;
};

export type RefusalAnswer = {
  id: string;
  section: 'Answers';
  kind: 'none';
  title: string;
  detail: string;
  known?: KnownFigure[];
  working?: AnswerWorking;
  incomplete?: string;
  uncoded?: UncodedPool;
  affected?: boolean;
  warning?: string;
};

export type PaletteAnswer = SpendAnswer | PortfolioAnswer | RefusalAnswer;

export type InvoiceHit = {
  id: string;
  jobId: string;
  invoiceNumber?: string;
  clientName?: string;
  status: string;
  statusLabel: string;
  totalCents: number;
  amount: string;
  invoiceDate?: string;
  dueDate?: string;
  overdue: boolean;
  issuedLabel: string;
  dueLabel: string;
};

export type FileHit = {
  id: string;
  jobId: string;
  name: string;
  type: string;
  typeLabel: string;
  typeColor: string;
  matchedOn: string;
  snippet?: string;
  detail: string;
};

export type PaletteScope = {
  jobId: string | null;
  label: string;
  orgWide: boolean;
};

export type ExpenseHit = {
  id: string;
  jobId: string;
  title: string;
  category: string;
  cents: number;
  amount: string;
  detail: string;
};

export type QuoteHit = {
  id: string;
  jobId: string;
  party: string;
  status: string;
  cents: number;
  amount: string;
  detail: string;
};

export type RoutedAskParams = {
  jobId?: string;
  tradeId?: string;
  trade?: string;
  partyId?: string;
  party?: string;
  category?: string;
  status?: string;
  type?: string;
  text?: string;
  from?: string;
  to?: string;
  period?: 'week' | 'month' | 'quarter';
  olderThanDays?: number;
};

export type RoutedAskChoice = {
  query: QueryName | 'none';
  params: RoutedAskParams;
  sentence?: string;
  reason?: string;
};

export type RoutedPaletteItem =
  | { kind: 'spend'; answer: SpendAnswer }
  | { kind: 'portfolio'; answer: PortfolioAnswer }
  | { kind: 'none'; answer: RefusalAnswer }
  | { kind: 'invoice'; invoice: InvoiceHit }
  | { kind: 'file'; file: FileHit }
  | { kind: 'expense'; expense: ExpenseHit }
  | { kind: 'quote'; quote: QuoteHit };

const DAY = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
const FIGURE_IN_TEXT = /[$£€¥0-9]/;

const TRADE_ALIASES: Record<string, string[]> = {
  concreting: ['concrete', 'concreter'],
  electrical: ['electrician', 'sparky'],
  plumbing: ['plumber'],
  carpentry: ['carpenter'],
  painting: ['painter'],
  roofing: ['roofer'],
  brickwork: ['bricks', 'masonry', 'bricklayer'],
  hvac: ['aircon', 'air-conditioning'],
  'kitchen-joinery': ['joinery', 'kitchen'],
  plastering: ['plasterer'],
  'tiling-flooring': ['tiler', 'flooring'],
};

export function norm(value: unknown): string {
  return String(value ?? '').toLowerCase().trim();
}

export function defaultPaletteScope(input: {
  jobId?: string | null;
  projectName?: string | null;
}): PaletteScope {
  const jobId = String(input.jobId || '').trim() || null;
  if (!jobId) {
    return { jobId: null, label: 'All jobs', orgWide: true };
  }
  return {
    jobId,
    label: String(input.projectName || '').trim() || 'This job',
    orgWide: false,
  };
}

export function isQueryScope(value: QueryScope | QueryFailure): value is QueryScope {
  return !('ok' in value);
}

export function membershipScope(
  orgId: string | null | undefined,
  allowedJobs: Array<{ projectId?: string; id?: string }> | null | undefined,
): QueryScope | null {
  const next = scopeFromMembership(orgId, allowedJobs);
  return isQueryScope(next) ? next : null;
}

function tradeWords(trade: TradeListRow): string[] {
  return [trade.name, String(trade.id || '').replace(/-/g, ' ')]
    .map(norm)
    .join(' ')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Prefix of a longer name word, or an exact token of at least 4 letters. */
function nameWordMatches(word: string, q: string): boolean {
  if (!word || !q) return false;
  if (word === q) return q.length >= 4;
  if (!word.startsWith(q)) return false;
  if (q.length >= 3) return true;
  return word.length >= 6;
}

/**
 * Aliases fire only when the typed query matches the alias
 * ("concrete" → Concreting). A short fragment of an alias ("air" vs
 * "aircon") does not count.
 */
function queryMatchesAlias(q: string, alias: string): boolean {
  const a = norm(alias);
  if (!a || a.length < 3) return false;
  if (q === a || q.includes(a)) return true;
  return q.length >= 4 && a.startsWith(q);
}

export function matchTrades(tradeList: TradeListRow[] | null | undefined, query: string): TradeListRow[] {
  const q = norm(query);
  if (q.length < 2) return [];
  return (tradeList || []).filter((trade) => {
    if (!trade || trade.status === 'archived') return false;
    const name = norm(trade.name);
    if (name.length >= 4 && (q === name || q.includes(name))) return true;
    if (tradeWords(trade).some((word) => nameWordMatches(word, q))) return true;
    const aliases = TRADE_ALIASES[trade.id] || [];
    return aliases.some((alias) => queryMatchesAlias(q, alias));
  });
}

export function isPortfolioQuery(query: string): boolean {
  const q = norm(query);
  return q === '' || q === 'spend' || q === 'cost' || q === 'total' || q === 'cost to date';
}

/** Typed search stays on keywords. Ask runs when this is a real question. */
export function looksLikeQuestion(query: string): boolean {
  const q = norm(query);
  if (q.length < 6) return false;
  if (q.includes('?')) return true;
  if (/^(how|what|who|where|when|why|are|is|am|will|did|does|do|can|could|find|show|tell|list)\b/.test(q)) {
    return true;
  }
  return /\b(how much|spent on|spend on|over on|paid to|have we|quoted on|contract say|anything overdue)\b/.test(q);
}

/** Model prose may sit above an answer. Digits mean we throw the line away. */
export function safeAskText(value: unknown): string | undefined {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text || FIGURE_IN_TEXT.test(text)) return undefined;
  return text;
}

function rowNoun(query: QueryName, count: number): string {
  if (query === 'findFiles') return count === 1 ? 'file' : 'files';
  if (query === 'invoicesByStatus') return count === 1 ? 'invoice' : 'invoices';
  if (query === 'quotesForTrade') return count === 1 ? 'quote' : 'quotes';
  return count === 1 ? 'expense' : 'expenses';
}

function paramLabel(key: string): string {
  if (key === 'jobId') return 'job';
  if (key === 'tradeId') return 'trade';
  if (key === 'partyId') return 'party';
  return key;
}

/** Query name, params, rollup revision or row count. From provenance, not the model. */
export function workingFromProvenance(
  provenance: QueryProvenance,
  labels?: WorkingLabels,
): AnswerWorking {
  const inner = Object.entries(provenance.params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const name = paramLabel(key);
      const shown = name === 'job' && labels?.job
        ? labels.job
        : name === 'trade' && labels?.trade
          ? labels.trade
          : String(value);
      return `${name}: ${shown}`;
    })
    .join(', ');
  const call = `${provenance.query}(${inner})`;
  const bits: string[] = [];
  if (provenance.capped) {
    bits.push('incomplete');
  } else if (provenance.source === 'rollup' && provenance.revision != null) {
    bits.push(`rollup rev ${provenance.revision}`);
  } else if (provenance.source === 'ledger') {
    bits.push('ledger');
  } else if (provenance.source === 'files') {
    bits.push('files');
  } else if (provenance.source === 'mixed') {
    bits.push('mixed');
  } else if (provenance.source === 'rollup') {
    bits.push('rollup');
  }
  if (!provenance.capped && provenance.rowCount > 0) {
    bits.push(`see the ${provenance.rowCount} ${rowNoun(provenance.query, provenance.rowCount)}`);
  }
  return {
    query: provenance.query,
    call,
    detail: bits.join(' · '),
    capped: provenance.capped,
  };
}

export function provenanceOf(result: unknown): QueryProvenance | null {
  if (!result || typeof result !== 'object') return null;
  const parsed = provenanceSchema.safeParse((result as { provenance?: unknown }).provenance);
  return parsed.success ? parsed.data : null;
}

export function invoiceStatusesForQuery(query: string): string[] | null {
  const q = norm(query);
  if (!q) return null;
  const tokens = q.split(/\s+/).filter(Boolean);
  const has = (word: string) => q === word || tokens.includes(word);
  if (has('overdue')) return ['overdue'];
  if (has('draft') || has('drafts')) return ['draft'];
  if (has('unpaid')) return ['unpaid', 'sent', 'draft'];
  if (has('paid')) return ['paid'];
  if (has('sent')) return ['sent'];
  return null;
}

function formatInvoiceDay(value: unknown): string {
  const date = value instanceof Date ? value : parseCalendarDate(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return DAY.format(date);
}

function statusLabel(status: string, overdue: boolean): string {
  if (overdue && status !== 'paid') return 'Overdue';
  const key = String(status || 'draft').toLowerCase();
  if (key === 'paid') return 'Paid';
  if (key === 'sent') return 'Sent';
  if (key === 'draft') return 'Draft';
  if (key === 'unpaid') return 'Unpaid';
  if (key === 'overdue') return 'Overdue';
  return status || 'Draft';
}

function expenseCountBit(count: number | null | undefined): string | null {
  if (count == null) return null;
  return `${count} expense${count === 1 ? '' : 's'}`;
}

function uncodedWarning(tradeName: string | undefined, uncoded: UncodedPool, affected: boolean): string | undefined {
  if (!affected || (uncoded.count === 0 && uncoded.cents === 0)) return undefined;
  const countBit = `${uncoded.count} expense${uncoded.count === 1 ? '' : 's'}`;
  const verb = uncoded.count === 1 ? 'is' : 'are';
  const base = `${countBit} worth ${formatCents(uncoded.cents)} ${verb} not coded to any trade`;
  if (!tradeName) return `${base}.`;
  return `${base}, so some of that could be ${tradeName.toLowerCase()} too.`;
}

function spendTitleFromPlan(tradeName: string, planCents: number, actualCents: number): string {
  const delta = actualCents - planCents;
  if (delta > 0) return `${tradeName} is ${formatCents(delta)} over.`;
  if (delta < 0) return `${tradeName} is ${formatCents(-delta)} under.`;
  return `${tradeName} is on plan.`;
}

export function spendAnswersForQuery(input: {
  query: string;
  tradeList: TradeListRow[] | null | undefined;
  scope: QueryScope;
  jobId?: string | null;
  jobs: JobMoneySnapshot[];
  plan?: CostPlan | null;
}): SpendAnswer[] {
  const jobId = input.jobId || undefined;
  const job = jobId ? input.jobs.find((row) => row.jobId === jobId) : undefined;
  const out: SpendAnswer[] = [];
  matchTrades(input.tradeList, input.query).slice(0, 4).forEach((trade) => {
    const result = spendByTrade({
      scope: input.scope,
      jobId,
      tradeId: trade.id,
      jobs: input.jobs,
    });
    if (!result.ok) return;
    const planResult = jobId
      ? planVsActual({
        scope: input.scope,
        jobId,
        tradeId: trade.id,
        plan: input.plan,
        job,
      })
      : null;
    const uncoded = (planResult && planResult.ok ? planResult.uncoded : result.uncoded);
    const affected = (planResult && planResult.ok ? planResult.affected : result.affected);
    const warning = uncodedWarning(trade.name, uncoded, affected);
    const amount = formatCents(result.cents);
    const count = result.count;
    const countBit = expenseCountBit(count);
    const where = jobId ? 'On this job' : 'Across jobs';
    const hidden = result.cents == null || result.provenance.capped;
    const hasPlanLine = Boolean(
      planResult
      && planResult.ok
      && planResult.hasPlan
      && planResult.actualCents != null
      && !planResult.provenance.capped,
    );
    const codedBit = count == null
      ? null
      : `across ${count} coded expense${count === 1 ? '' : 's'}`;
    out.push({
      id: `spend:${trade.id}`,
      section: 'Answers',
      kind: 'spend',
      title: hasPlanLine && planResult && planResult.ok && planResult.actualCents != null
        ? spendTitleFromPlan(trade.name, planResult.planCents, planResult.actualCents)
        : trade.name,
      amount: hasPlanLine && planResult && planResult.ok
        ? formatCents(planResult.actualCents)
        : amount,
      detail: hidden
        ? [where].filter(Boolean).join(' · ')
        : hasPlanLine && planResult && planResult.ok
          ? [
            `Estimated ${formatCents(planResult.planCents)}, spent ${formatCents(planResult.actualCents)} ${codedBit || ''}`.trim(),
            where,
          ].filter(Boolean).join(' · ')
          : [amount, countBit, where].filter(Boolean).join(' · '),
      tradeId: trade.id,
      uncoded,
      affected,
      warning,
      working: workingFromProvenance(
        hasPlanLine && planResult && planResult.ok ? planResult.provenance : result.provenance,
      ),
      incomplete: hidden ? INCOMPLETE_CAP_MESSAGE : undefined,
    });
  });
  return out;
}

export function portfolioAnswerForQuery(input: {
  query: string;
  scope: QueryScope;
  jobId?: string | null;
  jobs: JobMoneySnapshot[];
}): PortfolioAnswer | null {
  if (input.jobId || !isPortfolioQuery(input.query)) return null;
  const result = portfolioSummary({
    scope: input.scope,
    jobs: input.jobs,
  });
  if (!result.ok) return null;
  const amount = result.totals.hidden ? '—' : formatCents(result.totals.costCents);
  return {
    id: 'portfolio:cost',
    section: 'Answers',
    kind: 'portfolio',
    title: 'Cost to date',
    amount,
    detail: result.totals.hidden
      ? `${amount} · Across jobs`
      : `${amount} · ${result.totals.jobCount} job${result.totals.jobCount === 1 ? '' : 's'}`,
    working: workingFromProvenance(result.provenance),
    incomplete: result.totals.hidden ? INCOMPLETE_CAP_MESSAGE : undefined,
  };
}

export function invoiceHitsFromStatusQuery(input: {
  query: string;
  scope: QueryScope;
  jobId?: string | null;
  jobs: Array<{ jobId: string; invoices: Array<Record<string, unknown>> }>;
  clientNameById?: Record<string, string>;
  now?: Date;
}): InvoiceHit[] {
  const statuses = invoiceStatusesForQuery(input.query);
  if (!statuses) return [];
  const seen = new Set<string>();
  const out: InvoiceHit[] = [];
  statuses.forEach((status) => {
    const result = invoicesByStatus({
      scope: input.scope,
      jobId: input.jobId || undefined,
      status,
      jobs: input.jobs,
      now: input.now,
    });
    pushInvoiceHits(result, out, seen, input.clientNameById);
  });
  return out.slice(0, 8);
}

function pushInvoiceHits(
  result: InvoicesByStatusResult,
  out: InvoiceHit[],
  seen: Set<string>,
  clientNameById: Record<string, string> = {},
) {
  if (!result.ok) return;
  result.invoices.forEach((row) => {
    const key = `${row.jobId}:${row.id}`;
    if (!row.id || seen.has(key)) return;
    seen.add(key);
    const overdue = Boolean(row.overdue);
    out.push({
      id: row.id,
      jobId: row.jobId,
      invoiceNumber: row.invoiceNumber,
      clientName: clientNameById[row.id],
      status: row.status,
      statusLabel: statusLabel(row.status, overdue),
      totalCents: row.totalCents,
      amount: formatCents(row.totalCents),
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      overdue,
      issuedLabel: formatInvoiceDay(row.invoiceDate),
      dueLabel: formatInvoiceDay(row.dueDate),
    });
  });
}

export function fileHitsFromResult(result: FindFilesResult): FileHit[] {
  if (!result.ok) return [];
  return result.files.slice(0, 6).map((file) => {
    const type = isJobFileType(file.type) ? file.type : 'other';
    const meta = filesDrawerMeta(type as FilesDrawerType);
    const where = file.matchedOn === 'text'
      ? (file.snippet ? `In the file · ${file.snippet}` : 'In the file')
      : file.matchedOn === 'note'
        ? 'In the note'
        : file.matchedOn === 'type'
          ? meta.label
          : 'Name';
    return {
      id: file.id,
      jobId: file.jobId,
      name: file.name,
      type: file.type,
      typeLabel: meta.label,
      typeColor: meta.color,
      matchedOn: file.matchedOn,
      snippet: file.snippet,
      detail: [meta.label, where].filter(Boolean).join(' · '),
    };
  });
}

export function invoiceHitsFromStatusResult(
  result: InvoicesByStatusResult,
  clientNameById?: Record<string, string>,
): InvoiceHit[] {
  const out: InvoiceHit[] = [];
  pushInvoiceHits(result, out, new Set(), clientNameById);
  return out;
}

export function invoiceHitFromRecord(
  invoice: Record<string, unknown>,
  jobId: string,
  now?: Date,
): InvoiceHit {
  const overdue = isInvoiceOverdue(invoice, now);
  const totalCents = getInvoiceTotalCents(invoice);
  const status = String(invoice.status || 'draft');
  return {
    id: String(invoice.id || ''),
    jobId,
    invoiceNumber: invoice.invoiceNumber == null ? undefined : String(invoice.invoiceNumber),
    clientName: invoice.clientName == null ? undefined : String(invoice.clientName),
    status,
    statusLabel: statusLabel(status, overdue),
    totalCents,
    amount: formatCents(totalCents),
    invoiceDate: typeof invoice.invoiceDate === 'string' ? invoice.invoiceDate : undefined,
    dueDate: typeof invoice.dueDate === 'string' ? invoice.dueDate : undefined,
    overdue,
    issuedLabel: formatInvoiceDay(invoice.invoiceDate),
    dueLabel: formatInvoiceDay(invoice.dueDate),
  };
}

function refusalItem(id: string, title: string, detail: string): RoutedPaletteItem {
  return {
    kind: 'none',
    answer: {
      id,
      section: 'Answers',
      kind: 'none',
      title: safeAskText(title) || 'That cannot be answered from the records.',
      detail: safeAskText(detail) || 'Nothing was added up.',
    },
  };
}

function failedQueryItem(result: unknown): RoutedPaletteItem | null {
  if (!result || typeof result !== 'object' || (result as { ok?: unknown }).ok !== false) return null;
  const message = String((result as QueryFailure).error?.message || 'That could not be answered.');
  return refusalItem('ask:error', message, 'Nothing was added up.');
}

function tradeLabel(choice: RoutedAskChoice, tradeList: TradeListRow[] | null | undefined): string {
  const id = String(choice.params.tradeId || choice.params.trade || '').trim();
  const hit = (tradeList || []).find((row) => row.id === id || norm(row.name) === norm(id));
  if (hit?.name) return hit.name;
  if (choice.params.trade) return String(choice.params.trade);
  if (!id) return 'Spend';
  return id.replace(/-/g, ' ').replace(/\b[a-z]/g, (char) => char.toUpperCase());
}

function whereBit(jobId: string | undefined): string {
  return jobId ? 'On this job' : 'Across jobs';
}

function spendItemFromResult(
  choice: RoutedAskChoice,
  result: Extract<SpendResult, { ok: true }>,
  tradeList: TradeListRow[] | null | undefined,
  bucketKey?: string,
  labels?: WorkingLabels,
): RoutedPaletteItem {
  const name = choice.query === 'spendByCategory'
    ? (bucketKey ? bucketKey.replace(/_/g, ' ') : 'Category spend')
    : choice.query === 'spendByParty'
      ? (choice.params.party || 'Supplier')
      : tradeLabel(choice, tradeList);
  const bucket = bucketKey ? result.buckets.find((row) => row.key === bucketKey) : undefined;
  const hidden = result.cents == null || result.provenance.capped;
  const cents = hidden ? null : (bucketKey ? (bucket ? bucket.cents : 0) : result.cents);
  const count = hidden ? null : (bucketKey ? (bucket ? bucket.count : 0) : result.count);
  const amount = hidden ? '—' : formatCents(cents);
  const countBit = expenseCountBit(count);
  const warning = choice.query === 'spendByParty'
    ? undefined
    : uncodedWarning(name, result.uncoded, result.affected);
  return {
    kind: 'spend',
    answer: {
      id: `ask:${choice.query}:${bucketKey || choice.params.tradeId || choice.params.partyId || 'row'}`,
      section: 'Answers',
      kind: 'spend',
      title: safeAskText(choice.sentence) || name,
      amount,
      detail: hidden
        ? whereBit(choice.params.jobId)
        : [amount, countBit, whereBit(choice.params.jobId)].filter(Boolean).join(' · '),
      tradeId: String(choice.params.tradeId || bucketKey || ''),
      uncoded: result.uncoded,
      affected: result.affected,
      warning,
      working: workingFromProvenance(result.provenance, {
        job: labels?.job,
        trade: choice.query === 'spendByTrade' ? name : labels?.trade,
      }),
      incomplete: hidden ? INCOMPLETE_CAP_MESSAGE : undefined,
    },
  };
}

function isSpendOk(value: unknown): value is Extract<SpendResult, { ok: true }> {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as SpendResult).ok === true
    && 'cents' in (value as object)
    && 'buckets' in (value as object)
    && 'uncoded' in (value as object),
  );
}

function isPlanOk(value: unknown): value is Extract<PlanVsActualResult, { ok: true }> {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as PlanVsActualResult).ok === true
    && 'actualCents' in (value as object)
    && 'planCents' in (value as object),
  );
}

/** A none route may still show planVsActual when the job has a plan. */
export function shouldUsePlanForNone(result: unknown): boolean {
  return isPlanOk(result) && result.hasPlan;
}

function isPortfolioOk(value: unknown): value is Extract<PortfolioSummaryResult, { ok: true }> {
  return Boolean(
    value
    && typeof value === 'object'
    && (value as PortfolioSummaryResult).ok === true
    && (value as PortfolioSummaryResult).ok
    && 'totals' in (value as object)
    && 'jobCount' in ((value as { totals?: { jobCount?: unknown } }).totals || {}),
  );
}

function knownFiguresFromRelated(result: unknown): KnownFigure[] {
  if (isPlanOk(result) && result.hasPlan) {
    const estimated = result.provenance.capped
      ? (result.targetCents != null ? formatCents(result.targetCents) : null)
      : formatCents(result.planCents);
    const spent = result.provenance.capped || result.actualCents == null
      ? '—'
      : formatCents(result.actualCents);
    const figures: KnownFigure[] = [];
    if (estimated) figures.push({ label: 'Estimated', amount: estimated });
    figures.push({ label: 'Spent so far', amount: spent });
    return figures;
  }
  const totals = isOkRecordWithTotals(result);
  if (totals) {
    return [{
      label: 'Cost to date',
      amount: totals.hidden ? '—' : formatCents(totals.costCents),
    }];
  }
  return [];
}

function noneAnswer(
  choice: RoutedAskChoice,
  result: unknown,
  labels?: WorkingLabels,
): RoutedPaletteItem {
  const reason = safeAskText(choice.reason);
  const known = knownFiguresFromRelated(result);
  const provenance = provenanceOf(result);
  const hidden = Boolean(provenance?.capped) || Boolean(isOkRecordWithTotals(result)?.hidden);
  const uncoded = isPlanOk(result) ? result.uncoded : undefined;
  const affected = isPlanOk(result) ? result.affected : undefined;
  const warning = isPlanOk(result)
    ? uncodedWarning(undefined, result.uncoded, result.affected)
    : undefined;
  const detail = [
    reason || (known.length
      ? 'RisingAMP only stores what has actually happened.'
      : 'RisingAMP only answers from the queries it already has.'),
    known.length ? 'Here is what it does know.' : null,
  ].filter(Boolean).join(' ');
  return {
    kind: 'none',
    answer: {
      id: 'ask:none',
      section: 'Answers',
      kind: 'none',
      title: REFUSAL_TITLE,
      detail,
      known: known.length ? known : undefined,
      working: provenance ? workingFromProvenance(provenance, labels) : undefined,
      incomplete: hidden ? INCOMPLETE_CAP_MESSAGE : undefined,
      uncoded,
      affected,
      warning,
    },
  };
}

/**
 * Turn one routed choice plus the query result into palette rows.
 * Amounts come from formatCents on the query. Model sentences with
 * digits are dropped, never shown as money.
 */
export function itemsFromRoutedQuery(input: {
  choice: RoutedAskChoice;
  result?: unknown;
  tradeList?: TradeListRow[] | null;
  jobLabel?: string;
}): RoutedPaletteItem[] {
  const choice = input.choice;
  const labels: WorkingLabels = {
    job: input.jobLabel,
    trade: choice.query === 'none' ? undefined : tradeLabel(choice, input.tradeList),
  };
  if (choice.query === 'none') {
    return [noneAnswer(choice, input.result, { job: input.jobLabel })];
  }

  const failed = failedQueryItem(input.result);
  if (failed) return [failed];

  if (choice.query === 'spendByTrade' || choice.query === 'spendByParty' || choice.query === 'spendByCategory') {
    if (!isSpendOk(input.result)) {
      return [refusalItem('ask:spend', 'That spend question could not be answered.', 'Nothing was added up.')];
    }
    const bucketKey = choice.query === 'spendByCategory' && choice.params.category
      ? categoryKey({ category: choice.params.category })
      : undefined;
    return [spendItemFromResult(choice, input.result, input.tradeList, bucketKey, labels)];
  }

  if (choice.query === 'planVsActual') {
    if (!isPlanOk(input.result)) {
      return [refusalItem('ask:plan', 'That plan question could not be answered.', 'Nothing was added up.')];
    }
    const result = input.result;
    const name = tradeLabel(choice, input.tradeList);
    const hidden = result.actualCents == null || result.provenance.capped;
    const amount = hidden ? '—' : formatCents(result.actualCents);
    const codedBit = result.trades[0]
      ? `across ${result.trades[0].count} coded expense${result.trades[0].count === 1 ? '' : 's'}`
      : null;
    const warning = uncodedWarning(name, result.uncoded, result.affected);
    return [{
      kind: 'spend',
      answer: {
        id: `ask:planVsActual:${choice.params.tradeId || 'job'}`,
        section: 'Answers',
        kind: 'spend',
        title: hidden
          ? (safeAskText(choice.sentence) || name)
          : (result.hasPlan
            ? spendTitleFromPlan(name, result.planCents, result.actualCents || 0)
            : (safeAskText(choice.sentence) || name)),
        amount,
        detail: hidden
          ? whereBit(choice.params.jobId)
          : result.hasPlan
            ? [
              `Estimated ${formatCents(result.planCents)}, spent ${formatCents(result.actualCents)} ${codedBit || ''}`.trim(),
              whereBit(choice.params.jobId),
            ].filter(Boolean).join(' · ')
            : [amount, whereBit(choice.params.jobId)].filter(Boolean).join(' · '),
        tradeId: String(choice.params.tradeId || ''),
        uncoded: result.uncoded,
        affected: result.affected,
        warning,
        working: workingFromProvenance(result.provenance, { job: input.jobLabel, trade: name }),
        incomplete: hidden ? INCOMPLETE_CAP_MESSAGE : undefined,
      },
    }];
  }

  if (choice.query === 'invoicesByStatus') {
    const result = input.result as InvoicesByStatusResult | undefined;
    if (!result || !result.ok) {
      return [refusalItem('ask:invoices', 'Those invoices could not be loaded.', 'Nothing was added up.')];
    }
    const hits = invoiceHitsFromStatusResult(result).slice(0, 8);
    if (hits.length === 0) {
      return [refusalItem('ask:invoices:empty', 'No matching invoices.', 'Nothing was added up.')];
    }
    return hits.map((invoice) => ({ kind: 'invoice' as const, invoice }));
  }

  if (choice.query === 'findFiles') {
    const result = input.result as FindFilesResult | undefined;
    if (!result || !result.ok) {
      return [refusalItem('ask:files', 'Those files could not be loaded.', 'Nothing was added up.')];
    }
    const hits = fileHitsFromResult(result);
    if (hits.length === 0) {
      return [refusalItem('ask:files:empty', 'No matching files.', 'Nothing was added up.')];
    }
    return hits.map((file) => ({ kind: 'file' as const, file }));
  }

  if (choice.query === 'findExpenses') {
    const result = input.result as FindExpensesResult | undefined;
    if (!result || !result.ok) {
      return [refusalItem('ask:expenses', 'Those expenses could not be loaded.', 'Nothing was added up.')];
    }
    if (result.provenance.capped && result.expenses.length === 0) {
      return [{
        kind: 'none',
        answer: {
          id: 'ask:expenses:capped',
          section: 'Answers',
          kind: 'none',
          title: REFUSAL_TITLE,
          detail: 'Spend cannot be totalled on this job.',
          working: workingFromProvenance(result.provenance, { job: input.jobLabel }),
          incomplete: INCOMPLETE_CAP_MESSAGE,
        },
      }];
    }
    const rows = result.expenses.slice(0, 8);
    if (rows.length === 0) {
      return [refusalItem('ask:expenses:empty', 'No matching expenses.', 'Nothing was added up.')];
    }
    return rows.map((row) => {
      const amount = formatCents(row.cents);
      return {
        kind: 'expense' as const,
        expense: {
          id: row.id,
          jobId: row.jobId,
          title: row.description,
          category: row.category,
          cents: row.cents,
          amount,
          detail: [amount, row.date || '—'].join(' · '),
        },
      };
    });
  }

  if (choice.query === 'quotesForTrade') {
    const result = input.result as QuotesForTradeResult | undefined;
    if (!result || !result.ok) {
      return [refusalItem('ask:quotes', 'Those quotes could not be loaded.', 'Nothing was added up.')];
    }
    if (result.quotes.length === 0) {
      return [refusalItem('ask:quotes:empty', 'No quotes on that trade.', 'Nothing was added up.')];
    }
    return result.quotes.slice(0, 8).map((row) => {
      const amount = formatCents(row.tradeCents);
      return {
        kind: 'quote' as const,
        quote: {
          id: row.id,
          jobId: row.jobId,
          party: row.party,
          status: row.status,
          cents: row.tradeCents,
          amount,
          detail: `${amount} · ${row.status}`,
        },
      };
    });
  }

  if (choice.query === 'jobSummary') {
    const totals = isOkRecordWithTotals(input.result);
    if (!totals) {
      return [refusalItem('ask:job', 'That job summary could not be loaded.', 'Nothing was added up.')];
    }
    return [summaryItem(
      'jobSummary',
      choice,
      totals.hidden,
      totals.costCents,
      totals.liveCount,
      undefined,
      provenanceOf(input.result),
      input.jobLabel,
    )];
  }

  if (choice.query === 'portfolioSummary') {
    if (!isPortfolioOk(input.result)) {
      return [refusalItem('ask:portfolio', 'That company total could not be loaded.', 'Nothing was added up.')];
    }
    return [summaryItem(
      'portfolioSummary',
      choice,
      input.result.totals.hidden,
      input.result.totals.costCents,
      input.result.totals.liveCount,
      input.result.totals.jobCount,
      input.result.provenance,
      input.jobLabel,
    )];
  }

  return [refusalItem('ask:unknown', 'That cannot be answered from the records.', 'Nothing was added up.')];
}

function isOkRecordWithTotals(value: unknown): { hidden: boolean; costCents: number; liveCount: number } | null {
  if (!value || typeof value !== 'object' || (value as { ok?: unknown }).ok !== true) return null;
  const totals = (value as { totals?: { hidden?: unknown; costCents?: unknown; liveCount?: unknown } }).totals;
  if (!totals || typeof totals !== 'object') return null;
  return {
    hidden: Boolean(totals.hidden),
    costCents: Number(totals.costCents) || 0,
    liveCount: Number(totals.liveCount) || 0,
  };
}

function summaryItem(
  query: 'jobSummary' | 'portfolioSummary',
  choice: RoutedAskChoice,
  hidden: boolean,
  costCents: number,
  liveCount: number,
  jobCount: number | undefined,
  provenance: QueryProvenance | null,
  jobLabel?: string,
): RoutedPaletteItem {
  const amount = hidden ? '—' : formatCents(costCents);
  const detail = hidden
    ? whereBit(choice.params.jobId)
    : jobCount != null
      ? `${amount} · ${jobCount} job${jobCount === 1 ? '' : 's'}`
      : `${amount} · ${liveCount} expense${liveCount === 1 ? '' : 's'}`;
  return {
    kind: 'portfolio',
    answer: {
      id: `ask:${query}`,
      section: 'Answers',
      kind: 'portfolio',
      title: safeAskText(choice.sentence) || 'Cost to date',
      amount,
      detail,
      working: provenance ? workingFromProvenance(provenance, { job: jobLabel }) : undefined,
      incomplete: hidden ? INCOMPLETE_CAP_MESSAGE : undefined,
    },
  };
}
