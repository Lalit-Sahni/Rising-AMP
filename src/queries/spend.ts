/**
 * Rollup-first spend. Date slices that byDay/byMonth cannot answer for a
 * trade, party or category fall through to expense rows.
 */
import { z } from 'zod';
import {
  categoryKey,
  computeLedgerRollup,
  idBucketKey,
  parseCompleteRollup,
  resolveExpenseTotals,
  sumLedgerRollups,
  type LedgerRollup,
  type RollupBucket,
} from '../domain/ledgerRollup';
import { getExpenseTotalCents, isVoidExpense } from '../utils/jobMetrics';
import {
  compactParams,
  firstZodIssue,
  invalidInput,
  jobsById,
  provenanceSchema,
  queryScopeSchema,
  resolveTargetJobIds,
  ymdSchema,
  type JobMoneySnapshot,
  type QueryFailure,
} from './core';
import { dateFilterNeedsRows, expenseInRange, isYmdRange } from './dates';

const spendParamsSchema = z.object({
  scope: queryScopeSchema,
  jobId: z.string().min(1).optional(),
  tradeId: z.string().max(80).optional(),
  partyId: z.string().max(80).optional(),
  from: ymdSchema.optional(),
  to: ymdSchema.optional(),
  jobs: z.array(z.custom<JobMoneySnapshot>()).optional(),
});

const spendBucketSchema = z.object({
  key: z.string(),
  cents: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
});

export const spendResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    cents: z.number().int().nonnegative().nullable(),
    count: z.number().int().nonnegative().nullable(),
    buckets: z.array(spendBucketSchema),
    provenance: provenanceSchema,
  }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.enum(['job_not_allowed', 'invalid_input', 'org_required']),
      message: z.string(),
    }),
  }),
]);

export type SpendResult = z.infer<typeof spendResultSchema>;

type Dimension = 'trade' | 'party' | 'category';

type SpendInput = {
  query: 'spendByTrade' | 'spendByParty' | 'spendByCategory';
  dimension: Dimension;
  filterKey?: string;
  jobId?: string;
  from?: string;
  to?: string;
  scope: z.infer<typeof queryScopeSchema>;
  jobs?: JobMoneySnapshot[];
};

function sortBuckets(buckets: Array<{ key: string; cents: number; count: number }>) {
  return buckets.slice().sort((a, b) => b.cents - a.cents || a.key.localeCompare(b.key));
}

function dimensionMap(rollup: LedgerRollup, dimension: Dimension): Record<string, RollupBucket> {
  if (dimension === 'trade') return rollup.byTrade;
  if (dimension === 'party') return rollup.byParty;
  return rollup.byCategory;
}

function mapKey(value: string | undefined, dimension: Dimension): string | undefined {
  if (value == null || value === '') return undefined;
  return dimension === 'category' ? categoryKey({ category: value }) : idBucketKey(value);
}

function bucketsFromMap(map: Record<string, RollupBucket>, filterKey?: string) {
  const keys = filterKey ? [filterKey] : Object.keys(map);
  const rows = keys.map((key) => {
    const bucket = map[key] || { cents: 0, count: 0 };
    return { key, cents: bucket.cents, count: bucket.count };
  });
  if (filterKey) return rows;
  return sortBuckets(rows.filter((row) => row.count > 0 || row.cents > 0));
}

function expenseDimensionKey(expense: Record<string, unknown>, dimension: Dimension): string {
  if (dimension === 'trade') return idBucketKey(expense.tradeId);
  if (dimension === 'party') return idBucketKey(expense.partyId);
  return categoryKey(expense);
}

function cappedSpend(
  query: SpendInput['query'],
  params: Record<string, unknown>,
  source: 'rollup' | 'ledger' | 'mixed' = 'ledger',
): SpendResult {
  return spendResultSchema.parse({
    ok: true,
    cents: null,
    count: null,
    buckets: [],
    provenance: {
      query,
      params,
      source,
      rowCount: 0,
      capped: true,
    },
  });
}

function resolveJobRollup(job: JobMoneySnapshot | undefined): {
  rollup: LedgerRollup | null;
  source: 'rollup' | 'ledger';
  revision?: number;
  cappedIncomplete: boolean;
} {
  const overlay = resolveExpenseTotals({
    rollup: job?.rollup,
    expenses: job?.expenses,
    expensesCapped: job?.expensesCapped,
    expensesLoaded: job?.expensesLoaded,
  });
  if (overlay.hidden) {
    return { rollup: null, source: 'ledger', cappedIncomplete: true };
  }
  const parsed = parseCompleteRollup(job?.rollup);
  if (overlay.source === 'ledger' || overlay.ledgerWins) {
    return {
      rollup: computeLedgerRollup(job?.expenses || []),
      source: 'ledger',
      cappedIncomplete: false,
    };
  }
  return {
    rollup: parsed,
    source: 'rollup',
    revision: parsed?.revision,
    cappedIncomplete: false,
  };
}

function liveExpenses(job: JobMoneySnapshot | undefined): Array<Record<string, unknown>> {
  return (job?.expenses || []).filter((row) => row && !isVoidExpense(row)) as Array<Record<string, unknown>>;
}

function spendFromRows(
  input: SpendInput,
  jobIds: string[],
  byJob: Map<string, JobMoneySnapshot>,
  params: Record<string, unknown>,
): SpendResult {
  const map: Record<string, RollupBucket> = {};
  let rowCount = 0;
  for (const jobId of jobIds) {
    const job = byJob.get(jobId);
    if (job?.expensesCapped) {
      return cappedSpend(input.query, params, 'ledger');
    }
    liveExpenses(job).forEach((expense) => {
      if (!expenseInRange(expense, input.from, input.to)) return;
      const key = expenseDimensionKey(expense, input.dimension);
      if (input.filterKey && key !== input.filterKey) return;
      const cents = getExpenseTotalCents(expense);
      const current = map[key] || { cents: 0, count: 0 };
      current.cents += cents;
      current.count += 1;
      map[key] = current;
      rowCount += 1;
    });
  }

  const buckets = bucketsFromMap(map, input.filterKey);
  const cents = buckets.reduce((sum, row) => sum + row.cents, 0);
  const count = buckets.reduce((sum, row) => sum + row.count, 0);
  return spendResultSchema.parse({
    ok: true,
    cents,
    count,
    buckets,
    provenance: {
      query: input.query,
      params,
      source: 'ledger',
      rowCount,
      capped: false,
    },
  });
}

function runSpend(input: SpendInput): SpendResult {
  const access = resolveTargetJobIds(input.scope, input.jobId);
  if (!access.ok) return access;
  const params = compactParams({
    jobId: input.jobId,
    tradeId: input.dimension === 'trade' ? input.filterKey : undefined,
    partyId: input.dimension === 'party' ? input.filterKey : undefined,
    from: input.from,
    to: input.to,
  });
  const byJob = jobsById(input.jobs);

  if (dateFilterNeedsRows(input.from, input.to)) {
    return spendFromRows(input, access.jobIds, byJob, params);
  }

  const parts: LedgerRollup[] = [];
  const sources = new Set<'rollup' | 'ledger'>();
  let revision: number | undefined;
  for (const jobId of access.jobIds) {
    const resolved = resolveJobRollup(byJob.get(jobId) || { jobId });
    if (resolved.cappedIncomplete || !resolved.rollup) {
      return cappedSpend(input.query, params, 'rollup');
    }
    parts.push(resolved.rollup);
    sources.add(resolved.source);
    if (access.jobIds.length === 1 && resolved.source === 'rollup') {
      revision = resolved.revision;
    }
  }

  const combined = parts.length === 1 ? parts[0] : sumLedgerRollups(parts);
  const buckets = bucketsFromMap(dimensionMap(combined, input.dimension), input.filterKey);
  const cents = buckets.reduce((sum, row) => sum + row.cents, 0);
  const count = buckets.reduce((sum, row) => sum + row.count, 0);
  const source = sources.has('rollup') && sources.has('ledger')
    ? 'mixed'
    : sources.has('ledger') ? 'ledger' : 'rollup';

  return spendResultSchema.parse({
    ok: true,
    cents,
    count,
    buckets,
    provenance: {
      query: input.query,
      params,
      source,
      revision,
      rowCount: count,
      capped: false,
    },
  });
}

function parseSpendBase(input: unknown): z.infer<typeof spendParamsSchema> | QueryFailure {
  const parsed = spendParamsSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  if (!isYmdRange(parsed.data.from, parsed.data.to)) {
    return invalidInput('from and to must be YYYY-MM-DD calendar dates, with from not after to.');
  }
  return parsed.data;
}

function isFailure(value: z.infer<typeof spendParamsSchema> | QueryFailure): value is QueryFailure {
  return 'ok' in value && value.ok === false;
}

export function spendByTrade(input: unknown): SpendResult {
  const parsed = parseSpendBase(input);
  if (isFailure(parsed)) return parsed;
  return runSpend({
    query: 'spendByTrade',
    dimension: 'trade',
    filterKey: mapKey(parsed.tradeId, 'trade'),
    jobId: parsed.jobId,
    from: parsed.from,
    to: parsed.to,
    scope: parsed.scope,
    jobs: parsed.jobs,
  });
}

export function spendByParty(input: unknown): SpendResult {
  const parsed = parseSpendBase(input);
  if (isFailure(parsed)) return parsed;
  return runSpend({
    query: 'spendByParty',
    dimension: 'party',
    filterKey: mapKey(parsed.partyId, 'party'),
    jobId: parsed.jobId,
    from: parsed.from,
    to: parsed.to,
    scope: parsed.scope,
    jobs: parsed.jobs,
  });
}

export function spendByCategory(input: unknown): SpendResult {
  const parsed = parseSpendBase(input);
  if (isFailure(parsed)) return parsed;
  return runSpend({
    query: 'spendByCategory',
    dimension: 'category',
    jobId: parsed.jobId,
    from: parsed.from,
    to: parsed.to,
    scope: parsed.scope,
    jobs: parsed.jobs,
  });
}
