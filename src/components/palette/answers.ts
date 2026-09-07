/**
 * Palette answers from the Part D query layer. Numbers come from
 * spendByTrade / invoicesByStatus / portfolioSummary, never a model.
 */
import { parseCalendarDate } from '../../dates';
import { filesDrawerMeta, isJobFileType, type FilesDrawerType } from '../../domain/jobFiles';
import { formatCents } from '../../money';
import type { CostPlan } from '../../domain/schemas';
import type { JobMoneySnapshot, QueryFailure, QueryScope, UncodedPool } from '../../queries/core';
import { scopeFromMembership } from '../../queries/core';
import type { FindFilesResult } from '../../queries/files';
import { invoicesByStatus, type InvoicesByStatusResult } from '../../queries/invoices';
import { planVsActual } from '../../queries/plan';
import { spendByTrade } from '../../queries/spend';
import { portfolioSummary } from '../../queries/summary';
import { getInvoiceTotalCents, isInvoiceOverdue } from '../../utils/jobMetrics';

export type TradeListRow = {
  id: string;
  name: string;
  status?: string;
};

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
};

export type PortfolioAnswer = {
  id: string;
  section: 'Answers';
  kind: 'portfolio';
  title: string;
  detail: string;
  amount: string;
};

export type PaletteAnswer = SpendAnswer | PortfolioAnswer;

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

const DAY = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

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

function uncodedWarning(tradeName: string, uncoded: UncodedPool, affected: boolean): string | undefined {
  if (!affected || (uncoded.count === 0 && uncoded.cents === 0)) return undefined;
  const countBit = `${uncoded.count} expense${uncoded.count === 1 ? '' : 's'}`;
  const verb = uncoded.count === 1 ? 'is' : 'are';
  return `${countBit} worth ${formatCents(uncoded.cents)} ${verb} not coded to any trade, so some of that could be ${tradeName.toLowerCase()} too.`;
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
        ? [amount, 'Spend hidden', where].join(' · ')
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
      ? `${amount} · Spend hidden · Across jobs`
      : `${amount} · ${result.totals.jobCount} job${result.totals.jobCount === 1 ? '' : 's'}`,
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
