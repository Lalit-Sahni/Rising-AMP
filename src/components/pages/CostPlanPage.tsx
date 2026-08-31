import React, { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCostPlan } from '../../hooks/useCostPlan';
import { deriveCostPlanProgress, hasActiveCostPlan } from '../../domain/costPlan';
import { formatCents } from '../../money';
import { ymdToLocalDate } from '../../dates';
import EmptyState from '../EmptyState';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import SetTargetCostSheet from '../costPlan/SetTargetCostSheet';

function formatBaselineDate(value: string) {
  const date = ymdToLocalDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export default function CostPlanPage() {
  const {
    orgId,
    jobId,
    projectName,
    authUser,
    expenses,
    expensesCapped,
    showToast,
  } = useApp();
  const planQuery = useCostPlan(orgId, jobId);
  const [targetSheetOpen, setTargetSheetOpen] = useState(false);

  const progress = useMemo(
    () => (
      planQuery.data
        ? deriveCostPlanProgress(planQuery.data.targetCents, expenses || [], expensesCapped)
        : null
    ),
    [planQuery.data, expenses, expensesCapped],
  );

  if (!jobId) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <EmptyState
          title="Open a job"
          body="Open a job to see its cost plan."
          actionLabel="Jobs"
          to="/"
        />
      </div>
    );
  }

  if (planQuery.isLoading) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <div className="max-w-7xl mx-auto">
          <LoadingSkeleton type="job" lines={4} />
        </div>
      </div>
    );
  }

  if (planQuery.isError) {
    const message = planQuery.error instanceof Error ? planQuery.error.message : 'Could not load the cost plan';
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <div className="max-w-7xl mx-auto">
          <EmptyState
            title="Cost plan unavailable"
            body={message}
            actionLabel="Try again"
            onAction={() => planQuery.refetch()}
          />
        </div>
      </div>
    );
  }

  const plan = planQuery.data;
  if (!hasActiveCostPlan(plan)) {
    return <Navigate to={`/jobs/${jobId}`} replace />;
  }

  const leftAmount = progress?.leftCents == null
    ? null
    : Math.abs(progress.leftCents);

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <div className="eyebrow">Cost plan</div>
            <h1 className="text-[25px] font-extrabold tracking-tight mt-1">{projectName || 'Job'}</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">
              Target cost measured against every active expense on this job.
            </p>
          </div>
          {plan.status === 'draft' ? (
            <button
              type="button"
              onClick={() => setTargetSheetOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 px-3.5 py-2 rounded-ot-sm bg-surface border border-hairline text-[13px] font-bold text-ink hover:border-accent"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.7} />
              Edit target
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
          <div className="bg-surface border border-hairline rounded-ot p-[17px] shadow-whisper">
            <div className="text-[11.5px] text-slate-400 font-semibold">Target cost</div>
            <div className="tabular font-extrabold text-[23px] tracking-tight my-2">
              {formatCents(plan.targetCents, { whole: true })}
            </div>
            <div className="text-xs text-slate-600">
              Baseline, {formatBaselineDate(plan.baselineDate)}
            </div>
          </div>
          <div className="relative bg-surface border border-hairline rounded-ot p-[17px] shadow-whisper">
            <span className="absolute left-[17px] right-[17px] top-0 h-0.5 bg-accent rounded-b" />
            <div className="text-[11.5px] text-slate-400 font-semibold">Spent so far</div>
            <div className="tabular font-extrabold text-[23px] tracking-tight my-2">
              {formatCents(progress?.spentCents, { whole: true })}
            </div>
            <div className="text-xs text-slate-600">
              {progress?.percent == null
                ? 'Not shown while the job cannot be totalled in full'
                : `${Math.round(progress.percent)}% of target`}
            </div>
          </div>
          <div className="bg-surface border border-hairline rounded-ot p-[17px] shadow-whisper">
            <div className="text-[11.5px] text-slate-400 font-semibold">
              {progress?.overTarget ? 'Over target' : 'Left before target'}
            </div>
            <div className={`tabular font-extrabold text-[23px] tracking-tight my-2 ${progress?.overTarget ? 'text-neg' : ''}`}>
              {formatCents(leftAmount, { whole: true })}
            </div>
            <div className="text-xs text-slate-600">GST inclusive</div>
          </div>
        </div>

        {progress?.expensesCapped ? (
          <div className="bg-warn-tint border border-hairline border-l-2 border-l-warn rounded-ot-sm px-4 py-3 text-[13px] text-slate-600">
            There are more than 1,000 expenses on this job, so spend and progress are not shown. A missing number is honest; a partial one is not.
          </div>
        ) : (
          <div className="bg-surface border border-hairline rounded-ot px-5 py-[18px] shadow-whisper">
            <div className="flex items-center justify-between gap-3 text-[12.5px] mb-3">
              <span className="font-bold text-ink">Progress against target</span>
              <span className={`tabular font-bold ${progress?.overTarget ? 'text-neg' : 'text-slate-600'}`}>
                {progress?.percent == null ? '—' : `${progress.percent.toFixed(1)}%`}
              </span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden bg-[#EEF0F2] border border-hairline">
              <span
                className={`block h-full ${progress?.overTarget ? 'bg-neg' : 'bg-pos'}`}
                style={{ width: `${progress?.barPercent || 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 mt-3 text-[12px] text-slate-500">
              <span>Spent {formatCents(progress?.spentCents, { whole: true })}</span>
              <span>
                {progress?.overTarget ? 'Past the baseline' : `${formatCents(progress?.leftCents, { whole: true })} left`}
              </span>
            </div>
          </div>
        )}
      </div>

      <SetTargetCostSheet
        open={targetSheetOpen}
        orgId={orgId || ''}
        jobId={jobId}
        jobName={projectName}
        userId={authUser?.uid || ''}
        plan={plan}
        onClose={() => setTargetSheetOpen(false)}
        onSaved={() => setTargetSheetOpen(false)}
        showToast={showToast}
      />
    </div>
  );
}
