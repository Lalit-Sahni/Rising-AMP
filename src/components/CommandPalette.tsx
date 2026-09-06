import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { expenseDisplayName, formatExpenseDay } from '../domain/expenseDisplay';
import { formatMoney, getExpenseFaceTotal, isVoidExpense, isVoidInvoice } from '../utils/jobMetrics';
import { getCategoryStyle } from '../utils/categoryStyle';

type Row = {
  id: string;
  section: 'Jobs' | 'Go to' | 'Expenses' | 'Invoices';
  title: string;
  detail?: string;
  icon: typeof Clock;
  dot?: string;
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

function norm(value: unknown): string {
  return String(value ?? '').toLowerCase().trim();
}

function matches(haystack: string, needle: string): boolean {
  if (!needle) return true;
  const words = needle.split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word));
}

/**
 * One box that finds a job, a screen, an expense or an invoice.
 * Ctrl/Cmd+K on a keyboard, the search button in the header on a phone.
 */
export default function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setCurrentPage,
    allowedJobs,
    onOpenJob,
    jobId,
    projectName,
    expenses,
    invoices,
  } = useApp();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);

  const close = () => setCommandPaletteOpen(false);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setCursor(0);
      const id = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [commandPaletteOpen]);

  const rows = useMemo<Row[]>(() => {
    const q = norm(query);
    const out: Row[] = [];

    const jobs: AnyRecord[] = Array.isArray(allowedJobs) ? allowedJobs : [];
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
          run: () => setCurrentPage(page.key),
        });
      });

    if (jobId && q.length >= 2) {
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
            detail: [formatMoney(getExpenseFaceTotal(row), { cents: true }), style.label, day].filter(Boolean).join(' · '),
            icon: Receipt,
            dot: style.hex,
            run: () => navigate(`/jobs/${jobId}/history`, { state: { openExpenseId: row.id } }),
          });
        });

      const liveInvoices: AnyRecord[] = (invoices || []).filter((row: AnyRecord) => !isVoidInvoice(row));
      liveInvoices
        .filter((row) => matches([row.invoiceNumber, row.clientName, row.status].map(norm).join(' '), q))
        .slice(0, 5)
        .forEach((row) => {
          out.push({
            id: `invoice:${row.id}`,
            section: 'Invoices',
            title: `Invoice ${row.invoiceNumber || ''}`.trim(),
            detail: [row.clientName, row.status].filter(Boolean).join(' · '),
            icon: FileText,
            run: () => navigate(`/jobs/${jobId}/invoices`),
          });
        });
    }

    return out;
  }, [query, allowedJobs, jobId, projectName, expenses, invoices, onOpenJob, setCurrentPage, navigate]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!commandPaletteOpen) return null;

  const pick = (row: Row) => {
    close();
    row.run();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
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

  let lastSection: Row['section'] | null = null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-steel-900/45 px-3 pt-[max(12px,var(--safe-top))] md:pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
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
            placeholder={jobId ? 'Search jobs, expenses, invoices…' : 'Search jobs…'}
            className="flex-1 border-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-slate-400"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <kbd className="hidden md:inline-block rounded-ot-sm border border-hairline px-1.5 py-0.5 text-[11px] font-semibold text-slate-400">Esc</kbd>
        </label>

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
                  <button
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => pick(row)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                      active ? 'bg-canvas' : ''
                    }`}
                  >
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
                    {active ? <CornerDownLeft className="hidden h-4 w-4 shrink-0 text-slate-400 md:block" strokeWidth={1.7} /> : null}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
