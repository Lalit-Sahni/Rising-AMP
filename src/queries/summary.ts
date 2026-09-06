/**
 * Job and portfolio money summaries. Overview totals go through jobSummary,
 * which calls resolveExpenseTotals so a rollup/ledger disagreement still
 * lets the ledger win.
 */
import { z } from 'zod';
import {
  computeLedgerRollup,
  parseCompleteRollup,
  resolveExpenseTotals,
  sumLedgerRollups,
  type ExpenseTotalsOverlay,
} from '../domain/ledgerRollup';
import {
  compactParams,
  firstZodIssue,
  HIDDEN_TOTALS,
  invalidInput,
  jobsById,
  provenanceSchema,
  queryScopeSchema,
  resolveTargetJobIds,
  type JobMoneySnapshot,
  type QueryProvenance,
} from './core';

const periodSchema = z.enum(['week', 'month', 'quarter']);

const totalsSchema = z.object({
  hidden: z.boolean(),
  costCents: z.number().int().nonnegative(),
  investorCents: z.number().int().nonnegative(),
  liveCount: z.number().int().nonnegative(),
  documentCount: z.number().int().nonnegative(),
  periodCents: z.number().int().nonnegative(),
  periodCount: z.number().int().nonnegative(),
  categories: z.array(z.object({
    key: z.string(),
    amount: z.number(),
    count: z.number().int().nonnegative(),
  })),
  source: z.enum(['rollup', 'ledger', 'hidden']),
  ledgerWins: z.boolean(),
});

export const jobSummaryInputSchema = z.object({
  scope: queryScopeSchema,
  jobId: z.string().min(1),
  period: periodSchema.optional(),
  now: z.date().optional(),
  rollup: z.unknown().optional(),
  expenses: z.array(z.record(z.string(), z.unknown())).optional(),
  expensesCapped: z.boolean().optional(),
  expensesLoaded: z.boolean().optional(),
});

export const jobSummaryResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    totals: totalsSchema,
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

export type JobSummaryResult = z.infer<typeof jobSummaryResultSchema>;

const portfolioInputSchema = z.object({
  scope: queryScopeSchema,
  jobs: z.array(z.custom<JobMoneySnapshot>()).optional(),
});

export const portfolioSummaryResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    totals: z.object({
      hidden: z.boolean(),
      costCents: z.number().int().nonnegative(),
      investorCents: z.number().int().nonnegative(),
      liveCount: z.number().int().nonnegative(),
      documentCount: z.number().int().nonnegative(),
      jobCount: z.number().int().nonnegative(),
      ledgerWins: z.boolean(),
    }),
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

export type PortfolioSummaryResult = z.infer<typeof portfolioSummaryResultSchema>;

export function emptyJobSummaryTotals(): ExpenseTotalsOverlay {
  return resolveExpenseTotals({
    expenses: [],
    expensesLoaded: true,
    expensesCapped: false,
  });
}

function overlayProvenanceSource(overlay: ExpenseTotalsOverlay): QueryProvenance['source'] {
  if (overlay.source === 'hidden') return 'ledger';
  return overlay.source;
}

export function jobSummary(input: unknown): JobSummaryResult {
  const parsed = jobSummaryInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  const access = resolveTargetJobIds(parsed.data.scope, parsed.data.jobId);
  if (!access.ok) return access;

  const overlay = resolveExpenseTotals({
    rollup: parsed.data.rollup,
    expenses: parsed.data.expenses,
    expensesCapped: parsed.data.expensesCapped,
    expensesLoaded: parsed.data.expensesLoaded,
    period: parsed.data.period || 'month',
    now: parsed.data.now,
  });
  const rollup = parseCompleteRollup(parsed.data.rollup);
  return jobSummaryResultSchema.parse({
    ok: true,
    totals: overlay,
    provenance: {
      query: 'jobSummary',
      params: compactParams({
        jobId: parsed.data.jobId,
        period: parsed.data.period || 'month',
      }),
      source: overlayProvenanceSource(overlay),
      revision: overlay.source === 'rollup' && rollup ? rollup.revision : undefined,
      rowCount: overlay.hidden ? 0 : overlay.liveCount,
      capped: overlay.hidden,
    },
  });
}

export function portfolioSummary(input: unknown): PortfolioSummaryResult {
  const parsed = portfolioInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  const access = resolveTargetJobIds(parsed.data.scope);
  if (!access.ok) return access;

  const byJob = jobsById(parsed.data.jobs);
  const parts: unknown[] = [];
  const sources = new Set<'rollup' | 'ledger'>();
  let ledgerWins = false;
  let revision: number | undefined;

  for (const jobId of access.jobIds) {
    const job = byJob.get(jobId) || { jobId };
    const overlay = resolveExpenseTotals({
      rollup: job.rollup,
      expenses: job.expenses,
      expensesCapped: job.expensesCapped,
      expensesLoaded: job.expensesLoaded,
    });
    if (overlay.hidden) {
      return portfolioSummaryResultSchema.parse({
        ok: true,
        totals: {
          hidden: true,
          costCents: 0,
          investorCents: 0,
          liveCount: 0,
          documentCount: 0,
          jobCount: access.jobIds.length,
          ledgerWins: false,
        },
        provenance: {
          query: 'portfolioSummary',
          params: {},
          source: 'ledger',
          rowCount: 0,
          capped: true,
        },
      });
    }
    if (overlay.source === 'ledger' || overlay.ledgerWins) {
      parts.push(computeLedgerRollup(job.expenses || []));
      sources.add('ledger');
      ledgerWins = ledgerWins || overlay.ledgerWins;
    } else {
      parts.push(job.rollup);
      sources.add('rollup');
      if (access.jobIds.length === 1) {
        revision = parseCompleteRollup(job.rollup)?.revision;
      }
    }
  }

  const summed = sumLedgerRollups(parts);
  const source = sources.has('rollup') && sources.has('ledger')
    ? 'mixed'
    : sources.has('ledger') ? 'ledger' : 'rollup';

  return portfolioSummaryResultSchema.parse({
    ok: true,
    totals: {
      hidden: false,
      costCents: summed.costCents,
      investorCents: summed.investorCents,
      liveCount: summed.liveCount,
      documentCount: summed.documentCount,
      jobCount: access.jobIds.length,
      ledgerWins,
    },
    provenance: {
      query: 'portfolioSummary',
      params: {},
      source,
      revision,
      rowCount: summed.liveCount,
      capped: false,
    },
  });
}

export { HIDDEN_TOTALS };
