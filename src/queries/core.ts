/**
 * Shared types for the read-only query layer. Numbers come from rollups
 * and ledger helpers, never from a model. Callers pass membership scope;
 * a free orgId cannot be used to look at another org.
 */
import { z } from 'zod';
import type { ExpenseTotalsOverlay } from '../domain/ledgerRollup';

export const QUERY_NAMES = [
  'spendByTrade',
  'spendByParty',
  'spendByCategory',
  'planVsActual',
  'invoicesByStatus',
  'jobSummary',
  'portfolioSummary',
  'findFiles',
  'findExpenses',
  'quotesForTrade',
  'answerFromDocuments',
  'jobFacts',
] as const;

export type QueryName = (typeof QUERY_NAMES)[number];

export const provenanceSourceSchema = z.enum(['rollup', 'ledger', 'files', 'mixed', 'facts']);
export type ProvenanceSource = z.infer<typeof provenanceSourceSchema>;

export const queryScopeSchema = z.object({
  orgId: z.string().min(1),
  allowedJobIds: z.array(z.string().min(1)),
});
export type QueryScope = z.infer<typeof queryScopeSchema>;

export const ymdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const provenanceSchema = z.object({
  query: z.enum(QUERY_NAMES),
  params: z.record(z.string(), z.unknown()),
  source: provenanceSourceSchema,
  revision: z.number().int().nonnegative().optional(),
  rowCount: z.number().int().nonnegative(),
  capped: z.boolean(),
});
export type QueryProvenance = z.infer<typeof provenanceSchema>;

/** Live expenses with no stored tradeId. Not a category bucket. */
export const uncodedPoolSchema = z.object({
  count: z.number().int().nonnegative(),
  cents: z.number().int().nonnegative(),
});
export type UncodedPool = z.infer<typeof uncodedPoolSchema>;

export function affectedByUncoded(pool: UncodedPool): boolean {
  return pool.cents > 0 || pool.count > 0;
}

export const queryErrorCodeSchema = z.enum(['job_not_allowed', 'invalid_input', 'org_required']);
export type QueryErrorCode = z.infer<typeof queryErrorCodeSchema>;

export const queryFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: queryErrorCodeSchema,
    message: z.string().min(1),
  }),
});
export type QueryFailure = z.infer<typeof queryFailureSchema>;

export const HIDDEN_TOTALS: ExpenseTotalsOverlay = {
  hidden: true,
  costCents: 0,
  investorCents: 0,
  liveCount: 0,
  documentCount: 0,
  periodCents: 0,
  periodCount: 0,
  categories: [],
  source: 'hidden',
  ledgerWins: false,
};

export function queryFailure(code: QueryErrorCode, message: string): QueryFailure {
  return queryFailureSchema.parse({ ok: false, error: { code, message } });
}

export function invalidInput(message: string): QueryFailure {
  return queryFailure('invalid_input', message);
}

export function firstZodIssue(error: z.ZodError): string {
  return error.issues[0]?.message || 'Invalid input';
}

/** Invited job ids only. A requested job outside that list is rejected. */
export function resolveTargetJobIds(
  scope: QueryScope,
  jobId?: string | null,
): { ok: true; jobIds: string[] } | QueryFailure {
  if (!scope.orgId) {
    return queryFailure('org_required', 'An organisation is required.');
  }
  const allowed = new Set(scope.allowedJobIds);
  if (jobId) {
    if (!allowed.has(jobId)) {
      return queryFailure('job_not_allowed', 'That job is not on your list.');
    }
    return { ok: true, jobIds: [jobId] };
  }
  return { ok: true, jobIds: scope.allowedJobIds.slice() };
}

export function scopeFromMembership(
  orgId: string | null | undefined,
  allowedJobs: Array<{ projectId?: string; id?: string }> | null | undefined,
): QueryScope | QueryFailure {
  const parsed = queryScopeSchema.safeParse({
    orgId: String(orgId || '').trim(),
    allowedJobIds: (allowedJobs || [])
      .map((row) => String(row.projectId || row.id || '').trim())
      .filter(Boolean),
  });
  if (!parsed.success) {
    if (!String(orgId || '').trim()) {
      return queryFailure('org_required', 'An organisation is required.');
    }
    return invalidInput(firstZodIssue(parsed.error));
  }
  return parsed.data;
}

export type JobMoneySnapshot = {
  jobId: string;
  rollup?: unknown;
  expenses?: Array<Record<string, unknown>>;
  expensesCapped?: boolean;
  expensesLoaded?: boolean;
};

export function jobsById(jobs: JobMoneySnapshot[] | undefined): Map<string, JobMoneySnapshot> {
  const map = new Map<string, JobMoneySnapshot>();
  (jobs || []).forEach((job) => {
    if (job && job.jobId) map.set(job.jobId, job);
  });
  return map;
}

export function needleOf(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function textHaystack(...parts: unknown[]): string {
  return parts.map((part) => String(part == null ? '' : part)).join(' ').toLowerCase();
}

export function textMatches(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.includes(needle);
}

export function compactParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    out[key] = value;
  });
  return out;
}
