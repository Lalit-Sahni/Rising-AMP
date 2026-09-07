import React from 'react';
import { Clock, X } from 'lucide-react';
import type { AskHistoryRow } from '../../domain/askHistory';
import { historySubtitle } from './historyDisplay';

export function HistoryList({
  rows,
  onOpen,
  onDelete,
  onClearAll,
}: {
  rows: AskHistoryRow[];
  onOpen: (row: AskHistoryRow) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-1 pt-2.5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
          Recent questions
        </p>
        <button
          type="button"
          onClick={onClearAll}
          className="text-[11px] font-semibold text-slate-400 hover:text-ink"
        >
          Clear all
        </button>
      </div>
      {rows.map((row) => (
        <div
          key={row.id || row.question}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas"
        >
          <button
            type="button"
            onClick={() => onOpen(row)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] border border-hairline bg-surface text-slate-600">
              <Clock className="h-4 w-4" strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-ink">{row.question}</span>
              <span className="block truncate text-[12px] text-slate-400">{historySubtitle(row)}</span>
            </span>
          </button>
          {row.id ? (
            <button
              type="button"
              aria-label="Remove question"
              onClick={() => onDelete(row.id as string)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-slate-400 hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={1.7} />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
