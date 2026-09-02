import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  Check,
  Download,
  FileText,
  PlusCircle,
  Target,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ExportDialog from '../ExportDialog';
import JobPeople from '../JobPeople';
import EmptyState from '../EmptyState';
import { fetchJobFiles } from '../../firebase/jobFiles';
import { withFileAttention } from '../../domain/jobFileAttention';
import { withCostPlanAttention, deriveCostPlanProgress, hasActiveCostPlan, planHasTrades } from '../../domain/costPlan';
import { useCostPlan, useCostPlanQuotes } from '../../hooks/useCostPlan';
import SetTargetCostSheet from '../costPlan/SetTargetCostSheet';
import { getCategoryStyle } from '../../utils/categoryStyle';
import { formatCents } from '../../money';
import {
  VERDICT,
  bannerMessage,
  contractSubtitle,
  deriveJobMetrics,
  formatMoney,
  formatPercent,
  getExpenseTotal,
  jobSubtitle,
  periodLabel,
} from '../../utils/jobMetrics';

function expenseLabel(expense) {
  return expense.description || expense.itemName || expense.tradeName || expense.supplier || expense.category || 'Expense';
}

function marginBarWidth(marginPct) {
  if (marginPct == null || !Number.isFinite(marginPct)) return 0;
  return Math.max(0, Math.min(100, marginPct));
}

function costPlanDismissKey(jobId) {
  return `risingAmp.costPlan.setupDismissed.${jobId}`;
}

export default function DashboardPage() {
  const {
    orgId,
    expenses,
    invoices,
    clients,
    projectName,
    jobId,
    jobStatus,
    expensesCapped,
    setCurrentPage,
    showToast,
    jobInvitedEmails,
    authUser,
    jobKind,
    onJobKindChange,
  } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [showExport, setShowExport] = useState(false);
  const [jobFiles, setJobFiles] = useState([]);
  const [targetSheetOpen, setTargetSheetOpen] = useState(false);
  const [costPlanSetupDismissed, setCostPlanSetupDismissed] = useState(false);
  const attentionRef = useRef(null);
  const [kindBusy, setKindBusy] = useState(false);
  const costPlanQuery = useCostPlan(orgId, jobId);
  const quotesQuery = useCostPlanQuotes(orgId, jobId, planHasTrades(costPlanQuery.data));

  useEffect(() => {
    if (!jobId) {
      setCostPlanSetupDismissed(false);
      return;
    }
    setCostPlanSetupDismissed(localStorage.getItem(costPlanDismissKey(jobId)) === '1');
  }, [jobId]);

  useEffect(() => {
    let cancelled = false;
    if (!jobId) {
      setJobFiles([]);
      return undefined;
    }
    fetchJobFiles(jobId).then((result) => {
      if (!cancelled && result.success) setJobFiles(result.files || []);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const metrics = useMemo(
    () => {
      const base = withFileAttention(
        deriveJobMetrics({ expenses, invoices }, { period: selectedPeriod, expensesCapped, jobKind }),
        { files: jobFiles, invoices },
      );
      return withCostPlanAttention(base, {
        plan: costPlanQuery.data,
        expenses,
        quotes: quotesQuery.data || [],
        expensesCapped,
      });
    },
    [expenses, invoices, jobFiles, selectedPeriod, expensesCapped, jobKind, costPlanQuery.data, quotesQuery.data]
  );
  const planProgress = useMemo(
    () => (
      hasActiveCostPlan(costPlanQuery.data)
        ? deriveCostPlanProgress(costPlanQuery.data.targetCents, expenses || [], expensesCapped)
        : null
    ),
    [costPlanQuery.data, expenses, expensesCapped],
  );
  let banner = bannerMessage(metrics);
  if (jobKind === 'own' && planProgress?.spentCents != null) {
    banner = {
      ...banner,
      tone: planProgress.overTarget ? 'warn' : 'ok',
      line: `${formatCents(planProgress.spentCents, { whole: true })} spent of ${formatCents(planProgress.targetCents, { whole: true })} target.`,
    };
  }
  const subtitle = jobSubtitle({ clients, invoices, metrics });
  const maxCategory = metrics.categories[0]?.amount || 1;

  const handleNavigate = (page) => {
    if (!page) return;
    setCurrentPage(page);
  };

  const handleExport = async (filename) => {
    const { exportExpensesToExcel } = await import('../../utils/excelExport');
    const result = await exportExpensesToExcel(expenses || [], filename);
    if (result.success) {
      showToast('Excel file exported.', 'success');
    } else {
      showToast(result.error || 'Export failed.', 'error');
    }
  };

  const scrollToAttention = () => {
    if (attentionRef.current) {
      attentionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const dismissCostPlanSetup = () => {
    if (jobId) {
      localStorage.setItem(costPlanDismissKey(jobId), '1');
    }
    setCostPlanSetupDismissed(true);
  };

  const handleKind = async (next) => {
    if (!jobId || next === jobKind || kindBusy) return;
    setKindBusy(true);
    try {
      const { setOrgProjectKind } = await import('../../firebase/projectCatalog');
      const saved = await setOrgProjectKind(jobId, next);
      if (onJobKindChange) onJobKindChange(saved);
      showToast(saved === 'own' ? 'This job is now an own build.' : 'This job is now a client build.', 'success');
    } catch (error) {
      showToast(error.message || 'Could not update this job.', 'error');
    } finally {
      setKindBusy(false);
    }
  };

  if (!jobId) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <EmptyState
          title="Open a job"
          body="Pick a job from the list to see margin, cash, and what needs you today."
          actionLabel="Jobs"
          to="/"
        />
      </div>
    );
  }

  const leftTone = {
    ok: 'border-l-pos',
    warn: 'border-l-warn',
    new: 'border-l-slate-400',
  }[banner.tone];
  const iconTone = {
    ok: 'bg-pos-tint text-pos',
    warn: 'bg-warn-tint text-warn',
    new: 'bg-canvas text-slate-500',
  }[banner.tone];

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 mb-5">
          <div>
            <div className="eyebrow">Project overview</div>
            <h1 className="text-[25px] font-extrabold tracking-tight mt-1">{projectName || 'Job'}</h1>
            {jobStatus === 'archived' && (
              <p className="text-[13.5px] text-warn mt-1">This job is archived. Records stay. The owner can bring it back from Jobs.</p>
            )}
            <p className="text-[13.5px] text-slate-600 mt-0.5">{subtitle}</p>
            <JobPeople emails={jobInvitedEmails} />
            <div className="inline-flex mt-3 bg-surface border border-hairline rounded-[9px] p-[3px]">
              {[
                { id: 'client', label: 'Client build' },
                { id: 'own', label: 'Own build' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  disabled={kindBusy}
                  onClick={() => handleKind(option.id)}
                  className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium ${
                    jobKind === option.id ? 'bg-accent text-white' : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex bg-surface border border-hairline rounded-[9px] p-[3px]">
              {['week', 'month', 'quarter'].map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-medium capitalize ${
                    selectedPeriod === period ? 'bg-accent text-white' : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleNavigate('add-expense')}
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-600 text-white text-[13px] font-bold px-[15px] py-[9px] rounded-[9px]"
            >
              <PlusCircle className="w-4 h-4" strokeWidth={2} />
              Add expense
            </button>
          </div>
        </div>

        <div className={`flex items-center gap-4 bg-surface border border-hairline ${leftTone} border-l-[3px] rounded-ot p-4 md:px-5 shadow-whisper mb-4`}>
          <span className={`w-[34px] h-[34px] rounded-[9px] grid place-items-center shrink-0 ${iconTone}`}>
            {metrics.verdict === VERDICT.ON_TRACK || metrics.verdict === VERDICT.OWN_BUILD ? (
              <Check className="w-[18px] h-[18px]" strokeWidth={2} />
            ) : (
              <AlertTriangle className="w-[18px] h-[18px]" strokeWidth={2} />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <b className="block text-[14.5px] font-extrabold">{banner.label}</b>
            <p className="text-[13px] text-slate-600 mt-0.5">
              {metrics.hasMargin ? (
                <>
                  You are {metrics.margin < 0 ? 'behind' : 'making'}{' '}
                  <span className={`font-bold ${metrics.margin < 0 ? 'text-neg' : 'text-pos'}`}>
                    {formatMoney(Math.abs(metrics.margin))} ({formatPercent(metrics.marginPct)})
                  </span>{' '}
                  on this job, and {metrics.overdueCount > 0
                    ? `${metrics.overdueCount} invoice${metrics.overdueCount === 1 ? ' is' : 's are'} overdue`
                    : 'nothing is overdue'}
                  . {metrics.attentionCount === 0
                    ? 'Nothing else needs tidying up.'
                    : metrics.attentionCount === 1
                      ? 'One small thing needs tidying up.'
                      : `${metrics.attentionCount} small things need tidying up.`}
                </>
              ) : (
                banner.line
              )}
            </p>
          </div>
          {metrics.attentionCount > 0 && (
            <button
              type="button"
              onClick={scrollToAttention}
              className="shrink-0 hidden sm:inline-flex items-center gap-1.5 bg-surface text-ink border border-hairline text-xs font-semibold px-3 py-1.5 rounded-ot-sm hover:border-[#D6D9DD]"
            >
              Review {metrics.attentionCount} item{metrics.attentionCount === 1 ? '' : 's'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
          <div className="bg-surface border border-hairline rounded-ot p-[17px] shadow-whisper">
            <div className="text-[11.5px] text-slate-400 font-semibold">{jobKind === 'own' ? 'Target' : 'Contract'}</div>
            <div className="tabular font-extrabold text-[23px] tracking-tight my-2">
              {jobKind === 'own'
                ? (planProgress ? formatCents(planProgress.targetCents, { whole: true }) : '—')
                : (metrics.cash.paid > 0 ? formatMoney(metrics.cash.paid) : '—')}
            </div>
            <div className="text-xs text-slate-600">
              {jobKind === 'own'
                ? (planProgress ? 'Cost plan baseline' : 'Set a target on Cost plan')
                : contractSubtitle(metrics.cash)}
            </div>
          </div>
          <div className="bg-surface border border-hairline rounded-ot p-[17px] shadow-whisper">
            <div className="text-[11.5px] text-slate-400 font-semibold">Cost to date</div>
            <div className="tabular font-extrabold text-[23px] tracking-tight my-2">
              {formatMoney(metrics.cash.cost)}
            </div>
            <div className="text-xs text-slate-600">
              {metrics.expensesCapped
                ? 'More than 1,000 expenses — cost not shown'
                : (
                  <>
                    <span className="tabular">{metrics.expenseCount}</span> expense{metrics.expenseCount === 1 ? '' : 's'}
                  </>
                )}
            </div>
          </div>
          <div className="relative bg-surface border border-hairline rounded-ot p-[17px] shadow-whisper">
            <span className="absolute left-[17px] right-[17px] top-0 h-0.5 bg-accent rounded-b" />
            <div className="text-[11.5px] text-slate-400 font-semibold">{jobKind === 'own' ? 'Vs target' : 'Margin'}</div>
            <div className="tabular font-extrabold text-[23px] tracking-tight my-2">
              {jobKind === 'own'
                ? formatCents(planProgress?.leftCents, { whole: true })
                : (metrics.hasMargin ? formatMoney(metrics.margin) : '—')}
            </div>
            <div className="text-xs text-slate-600 flex items-center gap-1.5">
              {jobKind === 'own' ? (
                <span>{planProgress?.overTarget ? 'Past the baseline' : 'Left before target'}</span>
              ) : metrics.hasMargin ? (
                <>
                  <span className={`font-bold ${metrics.margin < 0 ? 'text-neg' : metrics.verdict === VERDICT.MARGIN_AT_RISK ? 'text-warn' : 'text-pos'}`}>
                    {formatPercent(metrics.marginPct)}
                  </span>
                  <span className="flex-1 h-[7px] bg-[#EEF0F2] rounded overflow-hidden max-w-[72px]">
                    <span
                      className="block h-full rounded"
                      style={{
                        width: `${marginBarWidth(metrics.marginPct)}%`,
                        background: metrics.verdict === VERDICT.MARGIN_AT_RISK ? 'var(--warn)' : 'var(--pos)',
                      }}
                    />
                  </span>
                </>
              ) : metrics.expensesCapped ? (
                <span>Not shown while this job cannot be totalled in full</span>
              ) : (
                <span>Needs a paid invoice total</span>
              )}
            </div>
          </div>
          <div className="bg-surface border border-hairline rounded-ot p-[17px] shadow-whisper">
            <div className="text-[11.5px] text-slate-400 font-semibold">{periodLabel(selectedPeriod)}</div>
            <div className="tabular font-extrabold text-[23px] tracking-tight my-2">
              {formatMoney(metrics.periodSpend)}
            </div>
            <div className="text-xs text-slate-600">
              {metrics.expensesCapped
                ? 'Not shown while this job cannot be totalled in full'
                : metrics.periodCount === 0 ? 'No dated spend in this period' : 'Spend so far'}
            </div>
          </div>
        </div>

        {!costPlanQuery.isLoading
          && !costPlanQuery.isError
          && costPlanQuery.data === null
          && !costPlanSetupDismissed && (
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 bg-surface border border-dashed border-hairline rounded-ot px-5 py-4 mb-4">
            <span className="w-9 h-9 rounded-[9px] bg-canvas border border-hairline grid place-items-center text-slate-600 shrink-0">
              <Target className="w-[17px] h-[17px]" strokeWidth={1.7} />
            </span>
            <div className="flex-1 min-w-0 pr-7 sm:pr-0">
              <b className="block text-[14px] font-extrabold text-ink">Know roughly what this job should cost?</b>
              <p className="text-[12.5px] text-slate-600 mt-0.5">
                Put in one number, or import your bill of quantities. Excel or CSV. You check it before it saves.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setTargetSheetOpen(true)}
                className="min-h-[44px] inline-flex items-center justify-center px-3.5 py-2 rounded-ot-sm bg-accent hover:bg-accent-600 text-white text-[13px] font-bold"
              >
                Set a target cost
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('cost-plan')}
                className="min-h-[44px] inline-flex items-center justify-center px-3.5 py-2 rounded-ot-sm bg-surface border border-hairline text-[13px] font-bold"
              >
                Import a BOQ
              </button>
            </div>
            <button
              type="button"
              onClick={dismissCostPlanSetup}
              className="absolute top-2 right-2 w-11 h-11 grid place-items-center rounded-ot-sm text-slate-400 hover:bg-canvas hover:text-ink"
              aria-label="Dismiss cost plan suggestion"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-3.5 mb-4">
          <div ref={attentionRef} className="bg-surface border border-hairline rounded-ot px-5 py-[18px] shadow-whisper">
            <h3 className="text-sm font-extrabold flex items-center justify-between mb-1">
              What needs you today
              {metrics.attentionCount > 0 && (
                <span className="text-[11px] font-bold text-warn bg-warn-tint px-2 py-0.5 rounded-full">
                  {metrics.attentionCount}
                </span>
              )}
            </h3>
            {metrics.attentionItems.length === 0 ? (
              <p className="text-[13px] text-slate-400 mt-3">All clear. Nothing on this job needs you right now.</p>
            ) : (
              metrics.attentionItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3 border-b border-hairline last:border-0">
                  <span
                    className={`w-[34px] h-[34px] rounded-[9px] grid place-items-center shrink-0 ${
                      item.tone === 'warn'
                        ? 'bg-warn-tint text-warn border-0'
                        : 'bg-canvas border border-hairline text-slate-600'
                    }`}
                  >
                    {item.id.startsWith('invoices') ? (
                      <CalendarDays className="w-4 h-4" strokeWidth={1.7} />
                    ) : item.id === 'expenses-no-receipt' ? (
                      <Camera className="w-4 h-4" strokeWidth={1.7} />
                    ) : item.id.startsWith('files') ? (
                      <FileText className="w-4 h-4" strokeWidth={1.7} />
                    ) : (
                      <AlertTriangle className="w-4 h-4" strokeWidth={1.7} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <b className="block text-[13.5px] font-bold">{item.title}</b>
                    <small className="block text-xs text-slate-400">{item.detail}</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigate(item.page)}
                    className="shrink-0 inline-flex items-center bg-surface text-ink border border-hairline text-xs font-semibold px-3 py-1.5 rounded-ot-sm hover:border-[#D6D9DD]"
                  >
                    {item.action}
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="bg-surface border border-hairline rounded-ot px-5 py-[18px] shadow-whisper">
            <h3 className="text-sm font-extrabold mb-1">Cash</h3>
            <div className="mt-1.5">
              {[
                { k: 'Invoiced', v: metrics.cash.invoiced },
                { k: 'Paid in', v: metrics.cash.paid, pos: metrics.cash.paid > 0 },
                { k: 'Outstanding', v: metrics.cash.outstanding },
                { k: 'Spent out', v: metrics.cash.cost },
              ].map((row) => (
                <div key={row.k} className="flex items-center justify-between py-2.5 border-b border-hairline last:border-0 text-[13px]">
                  <span className="text-slate-600">{row.k}</span>
                  <span className={`tabular font-bold ${row.pos ? 'text-pos' : ''}`}>{formatMoney(row.v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-3.5 mb-4">
          <div className="bg-surface border border-hairline rounded-ot px-5 py-[18px] shadow-whisper">
            <h3 className="text-sm font-extrabold flex items-center justify-between">
              Where the money&apos;s going
              <button
                type="button"
                onClick={() => handleNavigate('history')}
                className="text-[11px] text-accent font-bold uppercase tracking-[0.08em]"
              >
                View all
              </button>
            </h3>
            {metrics.expensesCapped ? (
              <p className="text-[13px] text-slate-400 mt-4">Spend breakdown is hidden until this job can be totalled in full.</p>
            ) : metrics.categories.length === 0 ? (
              <p className="text-[13px] text-slate-400 mt-4">Add expenses to see a breakdown.</p>
            ) : (
              metrics.categories.slice(0, 5).map((row) => {
                const style = getCategoryStyle(row.key);
                return (
                  <div key={row.key} className="flex items-center gap-3 mt-3.5">
                    <span className="w-[82px] flex items-center gap-2 text-[12.5px] text-slate-600 truncate">
                      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: style.hex }} />
                      {style.label}
                    </span>
                    <span className="flex-1 h-2 bg-[#EEF0F2] rounded overflow-hidden">
                      <span
                        className="block h-full rounded"
                        style={{ width: `${Math.max(6, (row.amount / maxCategory) * 100)}%`, backgroundColor: style.hex }}
                      />
                    </span>
                    <span className="w-16 text-right tabular text-xs text-slate-500 font-semibold">
                      {formatMoney(row.amount)}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="bg-surface border border-hairline rounded-ot px-5 py-[18px] shadow-whisper">
            <h3 className="text-sm font-extrabold">Recent</h3>
            {metrics.recent.length === 0 ? (
              <EmptyState
                title="No expenses yet"
                body="The first receipt or labour row you add will show up here."
                actionLabel="Add expense"
                to={jobId ? `/jobs/${jobId}/expenses/new` : '/'}
              />
            ) : (
              <div className="mt-1.5">
                {metrics.recent.map((expense, index) => {
                  const style = getCategoryStyle(expense.category);
                  return (
                    <div key={expense.id || index} className="flex items-center justify-between py-2.5 border-b border-hairline last:border-0 text-[13px] gap-3">
                      <span className="text-slate-600 truncate">
                        {expenseLabel(expense)}
                        {expense.category && (
                          <>
                            {' · '}
                            <span style={{ color: style.hex }}>{style.label}</span>
                          </>
                        )}
                      </span>
                      <span className="tabular font-bold shrink-0">{formatMoney(getExpenseTotal(expense), { cents: true })}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {[
            { title: 'Scan a receipt', description: 'Snap it, we read it', icon: Camera, page: 'add-expense' },
            {
              title: 'Invoices',
              description: metrics.cash.outstanding === 0 && metrics.cash.invoiced > 0 ? 'All paid, nothing due' : 'Manage & track',
              icon: FileText,
              page: 'new-invoice',
            },
            { title: 'Export', description: 'For your accountant', icon: Download, page: 'export' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => (card.page === 'export' ? setShowExport(true) : handleNavigate(card.page))}
                className="pressable flex items-center gap-3.5 text-left bg-surface border border-hairline rounded-ot p-4"
              >
                <span className="w-9 h-9 rounded-[9px] bg-canvas border border-hairline grid place-items-center text-ink shrink-0">
                  <Icon className="w-[17px] h-[17px]" strokeWidth={1.6} />
                </span>
                <span className="min-w-0">
                  <b className="block text-[13.5px] font-bold text-ink">{card.title}</b>
                  <small className="block text-xs text-slate-400">{card.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ExportDialog
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={handleExport}
        expenseCount={(expenses || []).length}
      />
      <SetTargetCostSheet
        open={targetSheetOpen}
        orgId={orgId || ''}
        jobId={jobId}
        jobName={projectName}
        userId={(authUser && authUser.uid) || ''}
        plan={null}
        onClose={() => setTargetSheetOpen(false)}
        onSaved={() => {
          setTargetSheetOpen(false);
          setCurrentPage('cost-plan');
        }}
        showToast={showToast}
      />
    </div>
  );
}
