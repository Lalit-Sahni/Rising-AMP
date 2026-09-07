import { z } from 'zod';
import { hasActiveCostPlan } from '../domain/costPlanCore';
import {
  computeLedgerRollup,
  idBucketKey,
  parseCompleteRollup,
  resolveExpenseTotals,
} from '../domain/ledgerRollup';
import type { CostPlan } from '../domain/schemas';
import {
  affectedByUncoded,
  compactParams,
  firstZodIssue,
  invalidInput,
  provenanceSchema,
  queryScopeSchema,
  resolveTargetJobIds,
  uncodedPoolSchema,
  type JobMoneySnapshot,
} from './core';
import { uncodedPoolForJob } from './spend';

const inputSchema = z.object({
  scope: queryScopeSchema,
  jobId: z.string().min(1),
  tradeId: z.string().max(80).optional(),
  plan: z.custom<CostPlan | null>().optional(),
  job: z.custom<JobMoneySnapshot>().optional(),
});

const tradeRowSchema = z.object({
  tradeId: z.string(),
  planCents: z.number().int().nonnegative(),
  actualCents: z.number().int().nonnegative().nullable(),
  count: z.number().int().nonnegative().nullable(),
});

export const planVsActualResultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    hasPlan: z.boolean(),
    targetCents: z.number().int().nonnegative().nullable(),
    planCents: z.number().int().nonnegative(),
    actualCents: z.number().int().nonnegative().nullable(),
    trades: z.array(tradeRowSchema),
    uncoded: uncodedPoolSchema,
    affected: z.boolean(),
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

export type PlanVsActualResult = z.infer<typeof planVsActualResultSchema>;

export function planVsActual(input: unknown): PlanVsActualResult {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(firstZodIssue(parsed.error));
  const access = resolveTargetJobIds(parsed.data.scope, parsed.data.jobId);
  if (!access.ok) return access;

  const job = parsed.data.job || { jobId: parsed.data.jobId };
  const overlay = resolveExpenseTotals({
    rollup: job.rollup,
    expenses: job.expenses,
    expensesCapped: job.expensesCapped,
    expensesLoaded: job.expensesLoaded,
  });
  const params = compactParams({
    jobId: parsed.data.jobId,
    tradeId: parsed.data.tradeId,
  });
  const plan = hasActiveCostPlan(parsed.data.plan) ? parsed.data.plan : null;
  const uncoded = uncodedPoolForJob(job);
  const affected = affectedByUncoded(uncoded);

  if (overlay.hidden) {
    return planVsActualResultSchema.parse({
      ok: true,
      hasPlan: Boolean(plan),
      targetCents: plan ? plan.targetCents : null,
      planCents: 0,
      actualCents: null,
      trades: [],
      uncoded,
      affected,
      provenance: {
        query: 'planVsActual',
        params,
        source: 'ledger',
        rowCount: 0,
        capped: true,
      },
    });
  }

  const rollup = parseCompleteRollup(job.rollup);
  const fromLedger = overlay.source === 'ledger' || overlay.ledgerWins;
  const tradeMap = fromLedger
    ? computeLedgerRollup(job.expenses || []).byTrade
    : (rollup?.byTrade || {});
  const filter = parsed.data.tradeId ? idBucketKey(parsed.data.tradeId) : undefined;
  const sections = (plan?.sections || []).filter((section) => (
    !filter || idBucketKey(section.tradeId) === filter
  ));
  const trades = sections.map((section) => {
    const key = idBucketKey(section.tradeId);
    const bucket = tradeMap[key];
    return {
      tradeId: key,
      planCents: Math.max(0, Math.round(section.amountCents || 0)),
      actualCents: bucket ? bucket.cents : 0,
      count: bucket ? bucket.count : 0,
    };
  });

  if (filter && !trades.some((row) => row.tradeId === filter)) {
    const bucket = tradeMap[filter];
    trades.push({
      tradeId: filter,
      planCents: 0,
      actualCents: bucket ? bucket.cents : 0,
      count: bucket ? bucket.count : 0,
    });
  }

  const sectionPlanCents = trades.reduce((sum, row) => sum + row.planCents, 0);
  const planCents = filter
    ? sectionPlanCents
    : (plan ? (sections.length > 0 ? sectionPlanCents : plan.targetCents) : 0);
  const actualCents = filter ? (tradeMap[filter]?.cents || 0) : overlay.costCents;
  const source = fromLedger ? 'ledger' : 'rollup';

  return planVsActualResultSchema.parse({
    ok: true,
    hasPlan: Boolean(plan),
    targetCents: plan ? plan.targetCents : null,
    planCents,
    actualCents,
    trades,
    uncoded,
    affected,
    provenance: {
      query: 'planVsActual',
      params,
      source,
      revision: source === 'rollup' && rollup ? rollup.revision : undefined,
      rowCount: overlay.liveCount,
      capped: false,
    },
  });
}
