import { useMemo } from 'react';
import { useLedgerRollup } from './useLedgerRollup';
import {
  emptyJobSummaryTotals,
  HIDDEN_TOTALS,
  jobSummary,
  type JobSummaryResult,
} from '../queries/summary';
import type { ExpenseTotalsOverlay } from '../domain/ledgerRollup';

type JobRow = { projectId?: string; id?: string };

type UseJobSummaryOptions = {
  orgId?: string | null;
  jobId?: string | null;
  allowedJobs?: JobRow[] | null;
  expenses?: Array<Record<string, unknown>>;
  expensesCapped?: boolean;
  expensesLoaded?: boolean;
  period?: string;
  now?: Date;
};

export type JobSummaryView = JobSummaryResult & {
  totals: ExpenseTotalsOverlay;
};

function allowedIds(allowedJobs: JobRow[] | null | undefined, jobId?: string | null): string[] {
  const ids = (allowedJobs || [])
    .map((row) => String(row.projectId || row.id || '').trim())
    .filter(Boolean);
  if (ids.length === 0 && jobId) return [jobId];
  return ids;
}

export function useJobSummary(options: UseJobSummaryOptions): JobSummaryView {
  const {
    orgId,
    jobId,
    allowedJobs,
    expenses,
    expensesCapped,
    expensesLoaded,
    period,
    now,
  } = options;
  const rollupQuery = useLedgerRollup(orgId, jobId);

  return useMemo(() => {
    if (!orgId || !jobId) {
      const totals = emptyJobSummaryTotals();
      return {
        ok: true as const,
        totals,
        provenance: {
          query: 'jobSummary' as const,
          params: {},
          source: (totals.source === 'hidden' ? 'ledger' : totals.source) as 'rollup' | 'ledger',
          rowCount: 0,
          capped: false,
        },
      };
    }
    const result = jobSummary({
      scope: { orgId, allowedJobIds: allowedIds(allowedJobs, jobId) },
      jobId,
      period: period === 'week' || period === 'quarter' ? period : 'month',
      now,
      rollup: rollupQuery.rollup,
      expenses: expenses || [],
      expensesCapped: Boolean(expensesCapped),
      expensesLoaded: expensesLoaded !== false,
    });
    if (!result.ok) {
      return { ...result, totals: HIDDEN_TOTALS };
    }
    return result;
  }, [
    orgId,
    jobId,
    allowedJobs,
    expenses,
    expensesCapped,
    expensesLoaded,
    period,
    now,
    rollupQuery.rollup,
  ]);
}
