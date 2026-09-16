/**
 * Org-wide list of what the assistant did. Lazy route. Undo reads the
 * stored receipt from Firestore, so it still works after a reload.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import EmptyState from '../EmptyState';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import { parseCalendarDate } from '../../dates';
import {
  activityActionLabel,
  activityEvidenceSummary,
  activityReceiptsForView,
  activityStatusLabel,
  canUndoReceipt,
  type ActivityReceiptLike,
} from '../../domain/assistantActivity';
import type { ActionReceipt } from '../../actions/core';

const DAY = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatWhen(value: Date | string | number): string {
  const date = value instanceof Date ? value : parseCalendarDate(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return DAY.format(date);
}

function jobLabel(
  jobId: string,
  jobs: Array<{ projectId?: string; id?: string; name?: string }> | null | undefined,
): string {
  const row = (jobs || []).find((job) => String(job.projectId || job.id || '') === jobId);
  const name = String(row?.name || '').trim();
  return name || 'A job';
}

export default function AssistantActivityPage() {
  const { orgId, allowedJobs, showToast } = useApp();
  const [receipts, setReceipts] = useState<ActionReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) {
      setReceipts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { listAssistantReceipts } = await import('../../firebase/assistantReceipts');
      const rows = await listAssistantReceipts(orgId);
      setReceipts(rows);
    } catch {
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    load().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const rows = useMemo(
    () => activityReceiptsForView(receipts as ActivityReceiptLike[]),
    [receipts],
  );

  const handleUndo = async (receiptId: string) => {
    if (undoingId) return;
    setUndoingId(receiptId);
    try {
      const { undoStoredReceipt } = await import('../../actions/undoStored');
      const result = await undoStoredReceipt({
        orgId,
        allowedJobs,
        receiptId,
      });
      if (!result.ok) {
        showToast(result.message, 'error');
        return;
      }
      showToast('Undone.', 'success');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not undo that.', 'error');
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-3xl mx-auto">
        <div className="eyebrow">All jobs</div>
        <h1 className="text-[25px] font-extrabold tracking-tight mt-1">Activity</h1>
        <p className="text-[13.5px] text-slate-600 mt-2">
          What you and the assistant changed, newest first. Undo still works after a reload.
        </p>

        {loading ? (
          <div className="mt-5">
            <LoadingSkeleton type="job" lines={4} />
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title="Nothing yet"
              body="Accept rows in Sort to cost plan on the Cost plan page, or scan a receipt on Add expense, and it shows up here. Anything on this list can be undone."
            />
          </div>
        ) : (
          <ul className="mt-5 bg-surface border border-hairline rounded-ot shadow-whisper divide-y divide-hairline">
            {rows.map((row) => {
              const summary = activityEvidenceSummary(row);
              const showUndo = canUndoReceipt(row);
              return (
                <li key={row.id} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <b className="text-[13.5px] font-bold text-ink truncate">
                          {activityActionLabel(row.action, row)}
                        </b>
                        <span className="text-[11px] font-medium text-slate-400 shrink-0">
                          {activityStatusLabel(row.status)}
                        </span>
                      </div>
                      <div className="text-[12px] text-slate-500 mt-0.5 truncate">
                        {jobLabel(row.jobId, allowedJobs)}
                        {summary ? ` · ${summary}` : ''}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 tabular">
                        {formatWhen(row.createdAt)}
                      </div>
                    </div>
                    {showUndo ? (
                      <button
                        type="button"
                        disabled={undoingId === row.id}
                        onClick={() => handleUndo(row.id)}
                        className="shrink-0 inline-flex items-center px-3 py-1.5 rounded-ot-sm border border-hairline text-[12px] font-semibold text-ink hover:bg-canvas disabled:opacity-50"
                      >
                        {undoingId === row.id ? 'Undoing…' : 'Undo'}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
