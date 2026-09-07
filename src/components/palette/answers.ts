/**
 * Palette answers from the Part D query layer. Numbers come from
 * spendByTrade / invoicesByStatus / portfolioSummary, never a model.
 */
import { parseCalendarDate } from '../../dates';
import { filesDrawerMeta, isJobFileType, type FilesDrawerType } from '../../domain/jobFiles';
import { formatCents } from '../../money';
import type { JobMoneySnapshot, QueryFailure, QueryScope } from '../../queries/core';
import { scopeFromMembership } from '../../queries/core';
import type { FindFilesResult } from '../../queries/files';
import { invoicesByStatus, type InvoicesByStatusResult } from '../../queries/invoices';
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

function tradeHaystack(trade: TradeListRow): string {
  return [trade.name, String(trade.id || '').replace(/-/g, ' ')].map(norm).join(' ');
}

export function matchTrades(tradeList: TradeListRow[] | null | undefined, query: string): TradeListRow[] {
  const q = norm(query);
  if (q.length < 2) return [];
  return (tradeList || []).filter((trade) => {
    if (!trade || trade.status === 'archived') return false;
    // A word in the trade STARTS with what was typed. A raw
    // `hay.includes(q)` matched two letters anywhere, so "in" hit 13 of 20
    // trades (concret-in-g, plumb-in-g, roof-in-g) and "er" hit 13.
    const hay = tradeHaystack(trade);
    if (hay.split(/[^a-z0-9]+/).some((word) => word && word.startsWith(q))) return true;
    const name = norm(trade.name);
    if (name.length >= 4 && q.includes(name)) return true;
    // A name word counts when the query is a real prefix of it, or the query
    // names it outright. `word.includes(q)` matched any two letters found
    // anywhere: "in" hit 13 of 20 trades, "er" hit 13.
    const words = name.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
    if (q.length >= 3 && words.some((word) => word.startsWith(q) || q.includes(word))) return true;
    // An alias counts only against the QUERY. The old third condition was
    // `name.includes(alias)`, which never read the query, so every trade whose
    // display name contained its own alias matched everything typed:
    // "Tiling and flooring" (flooring), "Kitchen and joinery" (joinery) and
    // "Air-conditioning" (air-conditioning) were returned for every search.
    const aliases = TRADE_ALIASES[trade.id] || [];
    return aliases.some((alias) => (
      alias.length >= 4 && (q.includes(alias) || (q.length >= 3 && alias.startsWith(q)))
    ));
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

export function spendAnswersForQuery(input: {
  query: string;
  tradeList: TradeListRow[] | null | undefined;
  scope: QueryScope;
  jobId?: string | null;
  jobs: JobMoneySnapshot[];
}): SpendAnswer[] {
  const jobId = input.jobId || undefined;
  const out: SpendAnswer[] = [];
  matchTrades(input.tradeList, input.query).slice(0, 4).forEach((trade) => {
    const result = spendByTrade({
      scope: input.scope,
      jobId,
      tradeId: trade.id,
      jobs: input.jobs,
    });
    if (!result.ok) return;
    const amount = formatCents(result.cents);
    const count = result.count;
    const countBit = count == null ? null : `${count} expense${count === 1 ? '' : 's'}`;
    const where = jobId ? 'On this job' : 'Across jobs';
    const hidden = result.cents == null || result.provenance.capped;
    out.push({
      id: `spend:${trade.id}`,
      section: 'Answers',
      kind: 'spend',
      title: trade.name,
      amount,
      detail: hidden
        ? [amount, 'Spend hidden', where].join(' · ')
        : [amount, countBit, where].filter(Boolean).join(' · '),
      tradeId: trade.id,
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
