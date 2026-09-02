import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Paperclip, Pencil, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useCostPlan, useCostPlanQuotes, useTradeList } from '../../hooks/useCostPlan';
import {
  activeTrades,
  canCodeExpenses,
  deriveCostPlanBoard,
  deriveCostPlanProgress,
  hasActiveCostPlan,
  planHasTrades,
  quotesForTrade,
  tradeStatusLabel,
} from '../../domain/costPlan';
import { formatCents } from '../../money';
import { ymdToLocalDate } from '../../dates';
import EmptyState from '../EmptyState';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import SetTargetCostSheet from '../costPlan/SetTargetCostSheet';
import BreakIntoTradesSheet from '../costPlan/BreakIntoTradesSheet';
import QuoteSheet from '../costPlan/QuoteSheet';
import ImportEstimateSheet from '../costPlan/ImportEstimateSheet';
import ExpenseTradePicker from '../costPlan/ExpenseTradePicker';
import EditCategoriesSheet from '../costPlan/EditCategoriesSheet';
import type { CostPlanQuote, JobFile } from '../../domain/schemas';
import { expenseDisplayName, formatExpenseDay } from '../../domain/expenseDisplay';
import { quoteFileIds } from '../../domain/quoteFiles';
import { getExpenseTotalCents } from '../../utils/jobMetrics';

function formatBaselineDate(value: string) {
  const date = ymdToLocalDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function statusClass(status: string) {
  if (status === 'over') return 'text-neg bg-[#F8EBE8]';
  if (status === 'quoted') return 'text-[#3D6486] bg-[#E9F0F6]';
  if (status === 'done') return 'text-pos bg-pos-tint';
  if (status === 'in-progress') return 'text-warn bg-warn-tint';
  return 'text-slate-600 bg-canvas';
}

function quoteStatusLabel(status: CostPlanQuote['status']) {
  if (status === 'chosen') return 'Chosen';
  if (status === 'passed') return 'Passed';
  if (status === 'void') return 'Void';
  return 'Received';
}

function quoteAmountLabel(quote: CostPlanQuote) {
  const high = quote.amountHighCents;
  if (Number.isInteger(high) && (high as number) > quote.amountCents) {
    return `${formatCents(quote.amountCents, { whole: true })} to ${formatCents(high as number, { whole: true })}`;
  }
  return formatCents(quote.amountCents, { whole: true });
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
    codeExpenseTrade,
  } = useApp();
  const planQuery = useCostPlan(orgId, jobId);
  const tradeQuery = useTradeList(orgId);
  const quotesQuery = useCostPlanQuotes(orgId, jobId, planHasTrades(planQuery.data));
  const [targetSheetOpen, setTargetSheetOpen] = useState(false);
  const [tradesSheetOpen, setTradesSheetOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteTradeId, setQuoteTradeId] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<CostPlanQuote | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [jobFiles, setJobFiles] = useState<JobFile[]>([]);

  useEffect(() => {
    setJobFiles([]);
  }, [jobId]);

  const plan = planQuery.data;
  const trades = useMemo(() => activeTrades(tradeQuery.data || []), [tradeQuery.data]);
  const quotes = quotesQuery.data || [];
  const progress = useMemo(
    () => (plan ? deriveCostPlanProgress(plan.targetCents, expenses || [], expensesCapped) : null),
    [plan, expenses, expensesCapped],
  );
  const board = useMemo(
    () => (plan && planHasTrades(plan)
      ? deriveCostPlanBoard({
        plan,
        expenses: expenses || [],
        quotes,
        trades,
        expensesCapped,
      })
      : null),
    [plan, expenses, quotes, trades, expensesCapped],
  );

  const openQuoteSheet = async (tradeId?: string, quote?: CostPlanQuote | null) => {
    setQuoteTradeId(tradeId || null);
    setEditingQuote(quote || null);
    if (jobId && jobFiles.length === 0) {
      const { fetchJobFiles } = await import('../../firebase/jobFiles');
      const result = await fetchJobFiles(jobId);
      if (result.success) setJobFiles(result.files || []);
    }
    setQuoteOpen(true);
  };

  if (!jobId) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <EmptyState title="Open a job" body="Open a job to see its cost plan." actionLabel="Jobs" to="/" />
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
          <EmptyState title="Cost plan unavailable" body={message} actionLabel="Try again" onAction={() => planQuery.refetch()} />
        </div>
      </div>
    );
  }

  if (!hasActiveCostPlan(plan)) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <div className="max-w-7xl mx-auto">
          <div className="eyebrow">Cost plan</div>
          <h1 className="text-[25px] font-extrabold tracking-tight mt-1">{projectName || 'Job'}</h1>
          <p className="text-[13.5px] text-slate-600 mt-0.5 max-w-xl">
            Set one number, or import your bill of quantities. Excel and CSV are mapped for you. You check the mapping before anything is saved.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <button
              type="button"
              onClick={() => setTargetSheetOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold"
            >
              Set a target cost
            </button>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center px-3.5 py-2 rounded-ot-sm bg-surface border border-hairline text-[13px] font-bold"
            >
              Import a bill of quantities
            </button>
          </div>
        </div>
        <SetTargetCostSheet
          open={targetSheetOpen}
          orgId={orgId || ''}
          jobId={jobId}
          jobName={projectName}
          userId={authUser?.uid || ''}
          plan={null}
          onClose={() => setTargetSheetOpen(false)}
          onSaved={() => setTargetSheetOpen(false)}
          showToast={showToast}
        />
        <ImportEstimateSheet
          open={importOpen}
          orgId={orgId || ''}
          jobId={jobId}
          userId={authUser?.uid || ''}
          plan={null}
          trades={trades}
          onClose={() => setImportOpen(false)}
          onSaved={() => setImportOpen(false)}
          showToast={showToast}
        />
      </div>
    );
  }

  const leftAmount = progress?.leftCents == null ? null : Math.abs(progress.leftCents);
  const expected = board?.expectedCents;
  const layerTotal = board && !board.expensesCapped
    ? Math.max(board.paidCents || 0, (board.paidCents || 0) + (board.quotedUnpaidCents || 0) + (board.estimatedUnpaidCents || 0), 1)
    : 1;

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
          <div>
            <div className="eyebrow">Cost plan</div>
            <h1 className="text-[25px] font-extrabold tracking-tight mt-1">{projectName || 'Job'}</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">
              {planHasTrades(plan)
                ? 'Estimated, quoted and spent. Forecast uses the chosen quote, or the estimate when there is none.'
                : 'Target cost measured against construction spend. Investor costs stay off this number.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {plan.status === 'draft' && plan.level === 'target' ? (
              <button type="button" onClick={() => setTargetSheetOpen(true)} className="inline-flex min-h-[44px] items-center justify-center gap-2 px-3.5 py-2 rounded-ot-sm bg-surface border border-hairline text-[13px] font-bold text-ink hover:border-accent">
                <Pencil className="w-4 h-4" strokeWidth={1.7} />
                Edit target
              </button>
            ) : null}
            {plan.status === 'draft' && plan.level === 'target' ? (
              <button type="button" onClick={() => setTradesSheetOpen(true)} className="inline-flex min-h-[44px] items-center justify-center px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold">
                Break it into trades
              </button>
            ) : null}
            {plan.status === 'draft' && plan.level !== 'imported' ? (
              <button type="button" onClick={() => setImportOpen(true)} className="inline-flex min-h-[44px] items-center justify-center px-3.5 py-2 rounded-ot-sm bg-surface border border-hairline text-[13px] font-bold">
                Import a bill of quantities
              </button>
            ) : null}
            {hasActiveCostPlan(plan) ? (
              <button type="button" onClick={() => setCategoriesOpen(true)} className="inline-flex min-h-[44px] items-center justify-center gap-2 px-3.5 py-2 rounded-ot-sm bg-surface border border-hairline text-[13px] font-bold">
                <Pencil className="w-4 h-4" strokeWidth={1.7} />
                Edit categories
              </button>
            ) : null}
            {plan.status === 'draft' && planHasTrades(plan) ? (
              <>
                <button type="button" onClick={() => setTradesSheetOpen(true)} className="inline-flex min-h-[44px] items-center justify-center px-3.5 py-2 rounded-ot-sm bg-surface border border-hairline text-[13px] font-bold">
                  Edit trades
                </button>
                <button type="button" onClick={() => openQuoteSheet()} className="inline-flex min-h-[44px] items-center justify-center gap-1 px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold">
                  <Plus className="w-4 h-4" />
                  Add a quote
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
          <div className="bg-surface border border-hairline rounded-ot p-[17px] shadow-whisper">
            <div className="text-[11.5px] text-slate-400 font-semibold">{planHasTrades(plan) ? 'Estimated' : 'Target cost'}</div>
            <div className="tabular font-extrabold text-[23px] tracking-tight my-2">
              {formatCents(plan.targetCents, { whole: true })}
            </div>
            <div className="text-xs text-slate-600">Baseline, {formatBaselineDate(plan.baselineDate)}</div>
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
              {planHasTrades(plan) ? 'Expected final' : (progress?.overTarget ? 'Over target' : 'Left before target')}
            </div>
            <div className={`tabular font-extrabold text-[23px] tracking-tight my-2 ${progress?.overTarget ? 'text-neg' : ''}`}>
              {formatCents(planHasTrades(plan) ? expected : leftAmount, { whole: true })}
            </div>
            <div className="text-xs text-slate-600">
              {plan.gstMode === 'exclusive' ? 'GST exclusive' : 'GST inclusive'}
            </div>
          </div>
        </div>

        {progress?.expensesCapped ? (
          <div className="bg-warn-tint border border-hairline border-l-2 border-l-warn rounded-ot-sm px-4 py-3 text-[13px] text-slate-600 mb-4">
            There are more than 1,000 expenses on this job, so spend and progress are not shown. A missing number is honest; a partial one is not.
          </div>
        ) : board ? (
          <div className="bg-surface border border-hairline rounded-ot px-5 py-[18px] shadow-whisper mb-4">
            <div className="flex items-center justify-between gap-3 text-[12.5px] mb-3">
              <span className="font-bold text-ink">Paid / quoted / still estimated</span>
              <span className="text-slate-500">{board.unquotedTradeCount} trades not quoted yet</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden bg-[#EEF0F2] border border-hairline flex">
              <span className="block h-full bg-pos" style={{ width: `${((board.paidCents || 0) / layerTotal) * 100}%` }} />
              <span className="block h-full bg-[#5E82A6]" style={{ width: `${((board.quotedUnpaidCents || 0) / layerTotal) * 100}%` }} />
              <span className="block h-full bg-[#C5C9CE]" style={{ width: `${((board.estimatedUnpaidCents || 0) / layerTotal) * 100}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-slate-500">
              <span>Paid {formatCents(board.paidCents, { whole: true })}</span>
              <span>Quoted, not yet paid {formatCents(board.quotedUnpaidCents, { whole: true })}</span>
              <span>Still only estimated {formatCents(board.estimatedUnpaidCents, { whole: true })}</span>
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-hairline rounded-ot px-5 py-[18px] shadow-whisper mb-4">
            <div className="flex items-center justify-between gap-3 text-[12.5px] mb-3">
              <span className="font-bold text-ink">Progress against target</span>
              <span className={`tabular font-bold ${progress?.overTarget ? 'text-neg' : 'text-slate-600'}`}>
                {progress?.percent == null ? '—' : `${progress.percent.toFixed(1)}%`}
              </span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden bg-[#EEF0F2] border border-hairline">
              <span className={`block h-full ${progress?.overTarget ? 'bg-neg' : 'bg-pos'}`} style={{ width: `${progress?.barPercent || 0}%` }} />
            </div>
          </div>
        )}

        {board ? (
          <div className="space-y-2.5">
            {board.trades.map((row) => {
              const max = Math.max(row.estimatedCents, row.quotedCents || 0, row.spentCents, 1);
              const open = expanded === row.tradeId;
              return (
                <div key={row.tradeId} className="bg-surface border border-hairline rounded-ot px-4 py-3 shadow-whisper">
                  <button type="button" className="w-full text-left" onClick={() => setExpanded(open ? null : row.tradeId)}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-[14.5px]">{row.name}</span>
                          <span className={`text-[10.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${statusClass(row.status)}`}>
                            {tradeStatusLabel(row.status)}
                          </span>
                        </div>
                        <div className="text-[12px] text-slate-500 mt-0.5">
                          {row.chosenParty ? `${row.chosenParty} · ` : ''}
                          {row.quoteCount ? `${row.quoteCount} quote${row.quoteCount === 1 ? '' : 's'}` : 'No quote on file'}
                          {row.expenseCount ? ` · ${row.expenseCount} expense${row.expenseCount === 1 ? '' : 's'}` : ''}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="tabular font-extrabold text-[15px]">{formatCents(row.expectedCents, { whole: true })}</div>
                        <div className="text-[11px] text-slate-500">expected</div>
                      </div>
                      <ChevronDown className={`w-4 h-4 mt-1 text-slate-400 ${open ? 'rotate-180' : ''}`} />
                    </div>
                    <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-[#EEF0F2] relative">
                      <span className="absolute inset-y-0 left-0 bg-[#C5C9CE]" style={{ width: `${(row.estimatedCents / max) * 100}%` }} />
                      {row.quotedCents != null ? (
                        <span className="absolute inset-y-0 left-0 bg-[#5E82A6]" style={{ width: `${(row.quotedCents / max) * 100}%` }} />
                      ) : null}
                      <span className="absolute inset-y-0 left-0 bg-pos" style={{ width: `${(row.spentCents / max) * 100}%` }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[11px] text-slate-500 tabular">
                      <span>Est. {formatCents(row.estimatedCents, { whole: true })}</span>
                      <span>{row.quotedCents == null ? 'No quote' : row.quoteRange ? `Quoted up to ${formatCents(row.quotedCents, { whole: true })}` : `Quoted ${formatCents(row.quotedCents, { whole: true })}`}</span>
                      <span>Paid {formatCents(row.spentCents, { whole: true })}</span>
                    </div>
                  </button>
                  {open ? (
                    <div className="mt-3 pt-3 border-t border-hairline">
                      {quotesForTrade(quotes, row.tradeId).map((quote) => {
                        const attachedCount = quoteFileIds(quote).length;
                        return (
                        <button
                          key={quote.id}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openQuoteSheet(row.tradeId, quote);
                          }}
                          className="w-full flex items-start justify-between gap-3 py-1.5 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block text-[13px] font-bold text-ink truncate">{quote.party}</span>
                            <span className="block text-[11.5px] text-slate-500">
                              {quoteStatusLabel(quote.status)}
                              {attachedCount ? ` · ${attachedCount} file${attachedCount === 1 ? '' : 's'} attached` : ''}
                              {quote.note ? ` · ${quote.note}` : ''}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            {attachedCount ? <Paperclip className="w-3.5 h-3.5 text-slate-400" aria-hidden /> : null}
                            <span className="tabular text-[13px] font-bold">{quoteAmountLabel(quote)}</span>
                          </span>
                        </button>
                        );
                      })}
                      <button type="button" onClick={() => openQuoteSheet(row.tradeId)} className="text-[12.5px] font-bold text-accent mt-1">
                        Add a quote on {row.name}
                      </button>
                      {row.lines.length > 0 ? (
                        <div className="mt-3 space-y-1">
                          <p className="text-[11px] text-slate-400">Read only. Here to check a quote against, not to tick off.</p>
                          {row.lines.map((line, index) => (
                            <div key={`${line.description}-${index}`} className="flex justify-between gap-3 text-[12.5px]">
                              <span className="text-slate-600 truncate">{line.code ? `${line.code} · ` : ''}{line.description}</span>
                              <span className="tabular shrink-0">{formatCents(line.totalCents)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {board.uncoded.count > 0 ? (
              <div className="border border-dashed border-[#D8A15A] rounded-ot px-4 py-3 bg-[#FBF6EE]">
                <div className="font-extrabold text-[14px]">Uncoded</div>
                <div className="text-[12px] text-slate-600 mt-0.5">
                  {board.uncoded.count} expense{board.uncoded.count === 1 ? '' : 's'} · {formatCents(board.uncoded.spentCents, { whole: true })}
                </div>
                <div className="mt-3 space-y-2">
                  {board.uncoded.expenses.map((expense) => (
                    <div key={String(expense.id)} className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink truncate">{expenseDisplayName(expense)}</div>
                        <div className="text-[12px] text-slate-500 tabular">
                          {formatCents(getExpenseTotalCents(expense))}
                          {formatExpenseDay(expense) ? ` · ${formatExpenseDay(expense)}` : ''}
                        </div>
                      </div>
                      {canCodeExpenses(plan) && codeExpenseTrade ? (
                        <div className="w-[180px] shrink-0">
                          <ExpenseTradePicker
                            expense={expense}
                            expenses={expenses || []}
                            trades={trades}
                            compact
                            onCode={(tradeId) => codeExpenseTrade(String(expense.id), tradeId)}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {board.investor.count > 0 ? (
              <div className="border border-dashed border-hairline rounded-ot px-4 py-3 bg-canvas">
                <div className="font-extrabold text-[14px]">Investor</div>
                <div className="text-[12px] text-slate-600 mt-0.5">
                  Land, legal and finance. Not construction, so it is not in spent, margin or the estimate.
                  {' '}{board.investor.count} expense{board.investor.count === 1 ? '' : 's'} · {formatCents(board.investor.spentCents, { whole: true })}
                </div>
                <div className="mt-3 space-y-2">
                  {board.investor.expenses.map((expense) => (
                    <div key={String(expense.id)} className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink truncate">{expenseDisplayName(expense)}</div>
                        <div className="text-[12px] text-slate-500 tabular">
                          {formatCents(getExpenseTotalCents(expense))}
                          {formatExpenseDay(expense) ? ` · ${formatExpenseDay(expense)}` : ''}
                        </div>
                      </div>
                      {canCodeExpenses(plan) && codeExpenseTrade ? (
                        <div className="w-[180px] shrink-0">
                          <ExpenseTradePicker
                            expense={expense}
                            expenses={expenses || []}
                            trades={trades}
                            compact
                            disabled={String(expense.category || '').toLowerCase() === 'investor'}
                            onCode={(tradeId) => codeExpenseTrade(String(expense.id), tradeId)}
                          />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {board.extras.count > 0 ? (
              <div className="border border-dashed border-hairline rounded-ot px-4 py-3 bg-canvas">
                <div className="font-extrabold text-[14px]">Not in the estimate</div>
                <div className="text-[12px] text-slate-600 mt-0.5">
                  {board.extras.count} expense{board.extras.count === 1 ? '' : 's'} · {formatCents(board.extras.spentCents, { whole: true })}
                </div>
                <div className="mt-2 space-y-1">
                  {board.extras.rows.map((row) => (
                    <div key={row.id} className="flex justify-between text-[13px]">
                      <span className="text-slate-600">{row.label}</span>
                      <span className="tabular font-bold">{formatCents(row.spentCents, { whole: true })}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
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
      <BreakIntoTradesSheet
        open={tradesSheetOpen}
        orgId={orgId || ''}
        jobId={jobId}
        plan={plan}
        trades={trades}
        onClose={() => setTradesSheetOpen(false)}
        onSaved={() => setTradesSheetOpen(false)}
        showToast={showToast}
      />
      <QuoteSheet
        open={quoteOpen}
        orgId={orgId || ''}
        jobId={jobId}
        userId={authUser?.uid || ''}
        trades={board?.trades.map((row) => ({
          id: row.tradeId,
          name: row.name,
          order: row.order,
          isAppDefault: false,
          status: 'active',
        })) || trades}
        files={jobFiles}
        quote={editingQuote}
        defaultTradeId={quoteTradeId}
        onClose={() => setQuoteOpen(false)}
        onSaved={() => setQuoteOpen(false)}
        onFilesChange={setJobFiles}
        showToast={showToast}
      />
      <ImportEstimateSheet
        open={importOpen}
        orgId={orgId || ''}
        jobId={jobId}
        userId={authUser?.uid || ''}
        plan={plan}
        trades={trades}
        onClose={() => setImportOpen(false)}
        onSaved={() => setImportOpen(false)}
        showToast={showToast}
      />
      <EditCategoriesSheet
        open={categoriesOpen}
        orgId={orgId || ''}
        trades={tradeQuery.data || []}
        onClose={() => setCategoriesOpen(false)}
        showToast={showToast}
      />
    </div>
  );
}
