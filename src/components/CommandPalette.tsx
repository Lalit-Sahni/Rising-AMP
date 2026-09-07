import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  Clock,
  CornerDownLeft,
  FileCheck,
  FileText,
  Files,
  LayoutDashboard,
  PlusCircle,
  Receipt,
  Search,
  User,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { expenseDisplayName, formatExpenseDay } from '../domain/expenseDisplay';
import { jobFileToBrowserItem } from '../domain/jobFileBrowser';
import type { FileBrowserItem } from '../domain/jobFileBrowser';
import type { JobFileType } from '../domain/jobFiles';
import { useCostPlan, useTradeList } from '../hooks/useCostPlan';
import { useLedgerRollup } from '../hooks/useLedgerRollup';
import type { JobMoneySnapshot } from '../queries/core';
import { formatMoney, getExpenseFaceTotal, isVoidExpense, isVoidInvoice } from '../utils/jobMetrics';
import { getCategoryStyle } from '../utils/categoryStyle';
import {
  defaultPaletteScope,
  fileHitsFromResult,
  invoiceHitFromRecord,
  invoiceHitsFromStatusQuery,
  invoiceStatusesForQuery,
  membershipScope,
  norm,
  portfolioAnswerForQuery,
  spendAnswersForQuery,
  type FileHit,
  type InvoiceHit,
  type PaletteAnswer,
} from './palette/answers';
import { FileAnswerBody, InvoiceAnswerBody, SpendAnswerBody } from './palette/ResultRows';

const JobFileViewer = lazy(() => import('./files/JobFileViewer'));

type RowKind = 'default' | 'spend' | 'invoice' | 'file';

type Row = {
  id: string;
  section: 'Answers' | 'Jobs' | 'Go to' | 'Files' | 'Expenses' | 'Invoices';
  title: string;
  detail?: string;
  icon: typeof Clock;
  dot?: string;
  kind: RowKind;
  answer?: PaletteAnswer;
  invoice?: InvoiceHit;
  file?: FileHit;
  run: () => void;
};

type AnyRecord = Record<string, any>;

const PAGE_ROWS: Array<{ key: string; label: string; icon: typeof Clock; needsJob: boolean }> = [
  { key: 'dashboard', label: 'Overview', icon: LayoutDashboard, needsJob: true },
  { key: 'add-expense', label: 'Add expense', icon: PlusCircle, needsJob: true },
  { key: 'new-invoice', label: 'Invoices', icon: FileText, needsJob: true },
  { key: 'files', label: 'Files', icon: Files, needsJob: true },
  { key: 'history', label: 'History', icon: Clock, needsJob: true },
  { key: 'cost-plan', label: 'Cost plan', icon: BarChart3, needsJob: true },
  { key: 'client-manager', label: 'Clients', icon: Users, needsJob: true },
  { key: 'hia-contract', label: 'HIA contracts', icon: FileCheck, needsJob: true },
  { key: 'jobs', label: 'All jobs', icon: Briefcase, needsJob: false },
  { key: 'profile', label: 'Your profile', icon: User, needsJob: false },
];

function matches(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const words = needle.split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word));
}

/**
 * One box that finds a job, a screen, an expense or an invoice, and answers
 * spend / file / invoice-status questions from the query layer.
 */
export default function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setCurrentPage,
    allowedJobs,
    onOpenJob,
    jobId,
    orgId,
    projectName,
    expenses,
    expensesCapped,
    expensesLoaded,
    invoices,
    authUser,
    profile,
    showToast,
  } = useApp();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [scopedJobId, setScopedJobId] = useState<string | null>(jobId || null);
  const [fileHits, setFileHits] = useState<FileHit[]>([]);
  const [remoteJobs, setRemoteJobs] = useState<JobMoneySnapshot[] | null>(null);
  const [remoteInvoiceHits, setRemoteInvoiceHits] = useState<InvoiceHit[] | null>(null);
  const [viewing, setViewing] = useState<{ jobId: string; item: FileBrowserItem } | null>(null);
  const [viewerBusy, setViewerBusy] = useState(false);

  const tradeQuery = useTradeList(orgId);
  const planQuery = useCostPlan(orgId, scopedJobId);
  const rollupQuery = useLedgerRollup(orgId, scopedJobId || undefined);
  const scope = useMemo(() => membershipScope(orgId, allowedJobs), [orgId, allowedJobs]);
  const scopeChip = defaultPaletteScope({
    jobId: scopedJobId,
    projectName: scopedJobId && scopedJobId === jobId ? projectName : (
      (Array.isArray(allowedJobs) ? allowedJobs : []).find((job: AnyRecord) => job.projectId === scopedJobId)?.name
    ),
  });

  const close = () => {
    setViewing(null);
    setCommandPaletteOpen(false);
  };

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setCursor(0);
      setScopedJobId(jobId || null);
      setFileHits([]);
      setRemoteJobs(null);
      setRemoteInvoiceHits(null);
      setViewing(null);
      const id = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [commandPaletteOpen, jobId]);

  const localJobs = useMemo<JobMoneySnapshot[]>(() => {
    if (!jobId || scopedJobId !== jobId) return [];
    return [{
      jobId,
      rollup: rollupQuery.rollup,
      expenses: expenses || [],
      expensesCapped: Boolean(expensesCapped),
      expensesLoaded: expensesLoaded !== false,
    }];
  }, [jobId, scopedJobId, rollupQuery.rollup, expenses, expensesCapped, expensesLoaded]);

  const moneyJobs = scopedJobId ? localJobs : (remoteJobs || []);

  useEffect(() => {
    if (!commandPaletteOpen || !scope || scopedJobId) {
      setRemoteJobs(null);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      import('../queries/fetch').then(({ loadJobsMoney }) => {
        loadJobsMoney(scope, scope.allowedJobIds).then((jobs) => {
          if (!cancelled) setRemoteJobs(jobs);
        }).catch(() => {
          if (!cancelled) setRemoteJobs([]);
        });
      });
    }, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [commandPaletteOpen, scope, scopedJobId]);

  useEffect(() => {
    if (!commandPaletteOpen || !scope) {
      setFileHits([]);
      return undefined;
    }
    const q = query.trim();
    if (q.length < 2) {
      setFileHits([]);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      import('../queries/fetch').then(({ fetchFindFiles }) => {
        fetchFindFiles({
          scope,
          jobId: scopedJobId || undefined,
          text: q,
        }).then((result) => {
          if (!cancelled) setFileHits(fileHitsFromResult(result));
        }).catch(() => {
          if (!cancelled) setFileHits([]);
        });
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [commandPaletteOpen, scope, scopedJobId, query]);

  useEffect(() => {
    if (!commandPaletteOpen || !scope || scopedJobId) {
      setRemoteInvoiceHits(null);
      return undefined;
    }
    const statuses = invoiceStatusesForQuery(query);
    if (!statuses) {
      setRemoteInvoiceHits(null);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      import('../queries/fetch').then(async ({ fetchInvoicesByStatus }) => {
        const seen = new Set<string>();
        const hits: InvoiceHit[] = [];
        for (const status of statuses) {
          const result = await fetchInvoicesByStatus({
            scope,
            status,
          });
          if (!result.ok) continue;
          result.invoices.forEach((row) => {
            const key = `${row.jobId}:${row.id}`;
            if (!row.id || seen.has(key)) return;
            seen.add(key);
            hits.push(invoiceHitFromRecord({
              id: row.id,
              invoiceNumber: row.invoiceNumber,
              status: row.status,
              totalCents: row.totalCents,
              invoiceDate: row.invoiceDate,
              dueDate: row.dueDate,
            }, row.jobId));
          });
        }
        if (!cancelled) setRemoteInvoiceHits(hits.slice(0, 8));
      }).catch(() => {
        if (!cancelled) setRemoteInvoiceHits([]);
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [commandPaletteOpen, scope, scopedJobId, query]);

  const openFileHit = async (fileJobId: string, fileId: string) => {
    try {
      const { fetchJobFiles } = await import('../firebase/jobFiles');
      const result = await fetchJobFiles(fileJobId);
      const file = (result.files || []).find((row) => row.id === fileId);
      if (!file) {
        showToast('Could not open that file', 'error');
        return;
      }
      setViewing({ jobId: fileJobId, item: jobFileToBrowserItem(file) });
    } catch {
      showToast('Could not open that file', 'error');
    }
  };

  const rows = useMemo<Row[]>(() => {
    const q = norm(query);
    const out: Row[] = [];
    const jobs: AnyRecord[] = Array.isArray(allowedJobs) ? allowedJobs : [];

    if (scope && moneyJobs.length > 0) {
      const answers: PaletteAnswer[] = [];
      const portfolio = portfolioAnswerForQuery({
        query,
        scope,
        jobId: scopedJobId,
        jobs: moneyJobs,
      });
      if (portfolio) answers.push(portfolio);
      spendAnswersForQuery({
        query,
        tradeList: tradeQuery.data || [],
        scope,
        jobId: scopedJobId,
        jobs: moneyJobs,
        plan: scopedJobId ? planQuery.data : null,
      }).forEach((row) => answers.push(row));
      answers.forEach((answer) => {
        out.push({
          id: answer.id,
          section: 'Answers',
          title: answer.title,
          detail: answer.detail,
          icon: BarChart3,
          kind: 'spend',
          answer,
          run: () => {
            if (scopedJobId) setCurrentPage('cost-plan', scopedJobId);
            else setCurrentPage('jobs');
          },
        });
      });
    }

    jobs
      .filter((job) => job.status !== 'archived' || q)
      .filter((job) => matches(norm(job.name), q))
      .slice(0, q ? 6 : 4)
      .forEach((job) => {
        out.push({
          id: `job:${job.projectId}`,
          section: 'Jobs',
          title: job.name,
          detail: job.projectId === jobId ? 'Open now' : (job.status === 'archived' ? 'Archived' : 'Open this job'),
          icon: Briefcase,
          kind: 'default',
          run: () => onOpenJob && onOpenJob(job),
        });
      });

    PAGE_ROWS
      .filter((page) => (page.needsJob ? Boolean(jobId) : true))
      .filter((page) => matches(norm(page.label), q))
      .slice(0, q ? 5 : 6)
      .forEach((page) => {
        out.push({
          id: `page:${page.key}`,
          section: 'Go to',
          title: page.label,
          detail: page.needsJob ? projectName || undefined : undefined,
          icon: page.icon,
          kind: 'default',
          run: () => setCurrentPage(page.key),
        });
      });

    fileHits.forEach((hit) => {
      out.push({
        id: `file:${hit.jobId}:${hit.id}`,
        section: 'Files',
        title: hit.name,
        detail: hit.detail,
        icon: Files,
        kind: 'file',
        file: hit,
        run: () => {
          void openFileHit(hit.jobId, hit.id);
        },
      });
    });

    if (scopedJobId && scopedJobId === jobId && q.length >= 2) {
      const liveExpenses: AnyRecord[] = (expenses || []).filter((row: AnyRecord) => !isVoidExpense(row));
      liveExpenses
        .filter((row) => {
          const style = getCategoryStyle(row.category);
          const hay = [
            expenseDisplayName(row),
            row.supplier,
            row.provider,
            row.workerName,
            row.tradeName,
            row.notes,
            row.paidBy,
            style.label,
            String(getExpenseFaceTotal(row)),
          ].map(norm).join(' ');
          return matches(hay, q);
        })
        .slice(0, 6)
        .forEach((row) => {
          const style = getCategoryStyle(row.category);
          const day = formatExpenseDay(row);
          out.push({
            id: `expense:${row.id}`,
            section: 'Expenses',
            title: expenseDisplayName(row),
            detail: [formatMoney(getExpenseFaceTotal(row), { cents: true }), style.label, day]
              .filter(Boolean)
              .join(' · '),
            icon: Receipt,
            dot: style.hex,
            kind: 'default',
            run: () => navigate(`/jobs/${jobId}/history`, { state: { openExpenseId: row.id } }),
          });
        });
    }

    const statusQuery = Boolean(invoiceStatusesForQuery(query));
    const invoiceHits: InvoiceHit[] = statusQuery
      ? (
        scopedJobId && scopedJobId === jobId && scope
          ? invoiceHitsFromStatusQuery({
            query,
            scope,
            jobId: scopedJobId,
            jobs: [{ jobId: scopedJobId, invoices: invoices || [] }],
            clientNameById: Object.fromEntries(
              (invoices || []).map((row: AnyRecord) => [String(row.id), String(row.clientName || '')]),
            ),
          })
          : (remoteInvoiceHits || [])
      )
      : [];

    if (!statusQuery && scopedJobId && scopedJobId === jobId && q.length >= 2) {
      const liveInvoices: AnyRecord[] = (invoices || []).filter((row: AnyRecord) => !isVoidInvoice(row));
      liveInvoices
        .filter((row) => matches([row.invoiceNumber, row.clientName, row.status].map(norm).join(' '), q))
        .slice(0, 5)
        .forEach((row) => {
          invoiceHits.push(invoiceHitFromRecord(row, jobId));
        });
    }

    invoiceHits.forEach((hit) => {
      if (!hit.id) return;
      out.push({
        id: `invoice:${hit.jobId}:${hit.id}`,
        section: 'Invoices',
        title: hit.invoiceNumber || 'Draft',
        detail: [hit.clientName, hit.statusLabel, hit.amount].filter(Boolean).join(' · '),
        icon: FileText,
        kind: 'invoice',
        invoice: hit,
        run: () => setCurrentPage('new-invoice', hit.jobId),
      });
    });

    return out;
  }, [
    query,
    allowedJobs,
    jobId,
    projectName,
    expenses,
    invoices,
    onOpenJob,
    setCurrentPage,
    navigate,
    scope,
    scopedJobId,
    moneyJobs,
    tradeQuery.data,
    planQuery.data,
    fileHits,
    remoteInvoiceHits,
    openFileHit,
  ]);

  useEffect(() => {
    setCursor(0);
  }, [query, scopedJobId]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!commandPaletteOpen) return null;

  const pick = (row: Row) => {
    if (row.kind === 'file') {
      row.run();
      return;
    }
    close();
    row.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (viewing) {
        setViewing(null);
        return;
      }
      close();
      return;
    }
    if (viewing) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((value) => Math.min(rows.length - 1, value + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((value) => Math.max(0, value - 1));
      return;
    }
    if (event.key === 'Enter' && rows[cursor]) {
      event.preventDefault();
      pick(rows[cursor]);
    }
  };

  const saveViewingFile = async (patch: {
    name: string;
    type: JobFileType;
    documentDate: string;
    note: string;
    linkedTo: { kind: 'expense' | 'invoice' | 'hiaContract'; id: string } | null;
    assignedQuoteId: string | null;
  }) => {
    if (!viewing?.item.fileId) return;
    setViewerBusy(true);
    try {
      const { updateJobFileRecord } = await import('../firebase/jobFiles');
      const result = await updateJobFileRecord(viewing.jobId, viewing.item.fileId, {
        name: patch.name,
        type: patch.assignedQuoteId ? 'quote' : patch.type,
        documentDate: patch.documentDate,
        note: patch.note,
        linkedTo: patch.linkedTo,
      });
      if (!result.success) {
        showToast(result.error || 'Could not save that file', 'error');
        return;
      }
      showToast('File updated.', 'success');
      setViewing(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save that file', 'error');
    } finally {
      setViewerBusy(false);
    }
  };

  const archiveViewingFile = async () => {
    if (!viewing?.item.fileId) return;
    setViewerBusy(true);
    try {
      const { archiveJobFile } = await import('../firebase/jobFiles');
      const result = await archiveJobFile(viewing.jobId, viewing.item.fileId);
      if (!result.success) {
        showToast(result.error || 'Could not archive that file', 'error');
        return;
      }
      showToast('File archived.', 'success');
      setViewing(null);
      setFileHits((current) => current.filter((hit) => hit.id !== viewing.item.fileId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not archive that file', 'error');
    } finally {
      setViewerBusy(false);
    }
  };

  let lastSection: Row['section'] | null = null;
  const currentUid = (authUser && authUser.uid) || '';
  const currentName = (profile && profile.displayName) || (authUser && authUser.displayName) || '';

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-steel-900/45 px-3 pt-[max(12px,var(--safe-top))] md:pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !viewing) close();
      }}
    >
      {viewing ? (
        <Suspense fallback={null}>
          <JobFileViewer
            open
            item={viewing.item}
            currentUid={currentUid}
            currentName={currentName}
            expenses={viewing.jobId === jobId ? (expenses || []) : []}
            invoices={viewing.jobId === jobId ? (invoices || []) : []}
            busy={viewerBusy}
            onClose={() => setViewing(null)}
            onSave={saveViewingFile}
            onArchive={archiveViewingFile}
            onOpenExpense={(expenseId) => {
              const openOn = viewing.jobId;
              setViewing(null);
              close();
              navigate(`/jobs/${openOn}/history`, { state: { openExpenseId: expenseId } });
            }}
          />
        </Suspense>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search"
          className="w-full max-w-xl overflow-hidden rounded-ot border border-hairline bg-surface shadow-[0_24px_64px_rgba(23,24,28,0.28)]"
          onKeyDown={onKeyDown}
        >
          <label className="flex items-center gap-3 border-b border-hairline px-4 py-3">
            <Search className="h-[18px] w-[18px] shrink-0 text-slate-400" strokeWidth={1.8} />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={scopedJobId ? 'Search this job…' : 'Search all jobs…'}
              className="flex-1 border-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-slate-400"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <kbd className="hidden md:inline-block rounded-ot-sm border border-hairline px-1.5 py-0.5 text-[11px] font-semibold text-slate-400">Esc</kbd>
          </label>

          <div className="flex items-center gap-2 border-b border-hairline px-4 py-2">
            {scopedJobId ? (
              <button
                type="button"
                onClick={() => setScopedJobId(null)}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-hairline bg-canvas px-2.5 py-1 text-[12px] font-semibold text-ink"
                aria-label={`Searching ${scopeChip.label}. Clear to search all jobs.`}
              >
                <Briefcase className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                <span className="truncate">{scopeChip.label}</span>
                <X className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.8} />
              </button>
            ) : (
              <>
                <span className="inline-flex items-center rounded-full border border-hairline px-2.5 py-1 text-[12px] font-semibold text-slate-600">
                  All jobs
                </span>
                {jobId ? (
                  <button
                    type="button"
                    onClick={() => setScopedJobId(jobId)}
                    className="text-[12px] font-semibold text-accent"
                  >
                    Limit to {projectName || 'this job'}
                  </button>
                ) : null}
              </>
            )}
          </div>

          <div ref={listRef} className="max-h-[min(62vh,480px)] overflow-y-auto py-1.5">
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-slate-400">
                {query ? 'Nothing matches that.' : 'Type to search.'}
              </p>
            ) : (
              rows.map((row, index) => {
                const Icon = row.icon;
                const showHeader = row.section !== lastSection;
                lastSection = row.section;
                const active = index === cursor;
                return (
                  <React.Fragment key={row.id}>
                    {showHeader ? (
                      <div className="px-4 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        {row.section}
                      </div>
                    ) : null}
                    {row.kind === 'spend' && row.answer ? (
                      <div
                        data-index={index}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => pick(row)}
                        className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left ${
                          active ? 'bg-canvas' : ''
                        }`}
                      >
                        <SpendAnswerBody
                          row={row.answer}
                          onCodeThem={row.answer.kind === 'spend' && row.answer.affected
                            ? (event) => {
                              event.stopPropagation();
                              pick(row);
                            }
                            : undefined}
                        />
                        {active ? <CornerDownLeft className="hidden h-4 w-4 shrink-0 text-slate-400 md:block" strokeWidth={1.7} /> : null}
                      </div>
                    ) : (
                    <button
                      type="button"
                      data-index={index}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => pick(row)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                        active ? 'bg-canvas' : ''
                      }`}
                    >
                      {row.kind === 'invoice' && row.invoice ? (
                        <InvoiceAnswerBody hit={row.invoice} />
                      ) : row.kind === 'file' && row.file ? (
                        <FileAnswerBody hit={row.file} />
                      ) : (
                        <>
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-hairline bg-surface text-slate-600">
                            <Icon className="h-4 w-4" strokeWidth={1.7} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                              {row.dot ? <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: row.dot }} /> : null}
                              <span className="truncate">{row.title}</span>
                            </span>
                            {row.detail ? (
                              <span className="block truncate text-[12px] text-slate-400">{row.detail}</span>
                            ) : null}
                          </span>
                        </>
                      )}
                      {active ? <CornerDownLeft className="hidden h-4 w-4 shrink-0 text-slate-400 md:block" strokeWidth={1.7} /> : null}
                    </button>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
