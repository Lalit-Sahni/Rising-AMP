import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useJobClients, useJobHiaContracts } from '../../hooks/useJobDirectories';
import { formatCents, fromCents } from '../../money';
import {
  FACT_PROPOSAL_LABELS,
  collectJobFactProposals,
  jobFactsPatchFromProposals,
  reviewEditedProposal,
  type BoqCoverInput,
  type JobFactProposal,
  type ReviewedJobFactProposal,
} from '../../domain/proposeJobFacts';
import type { JobFacts } from '../../domain/jobFacts';

type DraftRow = ReviewedJobFactProposal & {
  draftValue: string;
  edited: boolean;
  dismissed: boolean;
};

type ProposeJobFactsSheetProps = {
  open: boolean;
  jobId: string;
  userId: string;
  boq?: BoqCoverInput | null;
  onClose: () => void;
  showToast: (message: string, type?: string) => void;
};

function draftFromProposal(proposal: JobFactProposal): string {
  if (proposal.field === 'contractValueCents' || proposal.field === 'depositCents') {
    return fromCents(Number(proposal.value)).toFixed(2);
  }
  return String(proposal.value);
}

function toDraft(row: ReviewedJobFactProposal): DraftRow {
  return {
    ...row,
    draftValue: draftFromProposal(row),
    edited: false,
    dismissed: false,
  };
}

function displayValue(proposal: JobFactProposal): string {
  if (proposal.field === 'floorArea' || proposal.field === 'siteArea') {
    return `${proposal.value} sqm`;
  }
  if (proposal.field === 'contractValueCents' || proposal.field === 'depositCents') {
    return formatCents(Number(proposal.value));
  }
  return String(proposal.value);
}

function currentValueLabel(
  field: JobFactProposal['field'],
  facts: JobFacts | null,
  fallback: JobFactProposal,
): string {
  const existing = facts?.[field];
  if (!existing) return displayValue(fallback);
  if ('unit' in existing && existing.unit === 'sqm') return `${existing.value} sqm`;
  if (field === 'contractValueCents' || field === 'depositCents') {
    return formatCents(Number(existing.value));
  }
  return String(existing.value);
}

export default function ProposeJobFactsSheet({
  open,
  jobId,
  userId,
  boq = null,
  onClose,
  showToast,
}: ProposeJobFactsSheetProps) {
  const { orgId, projectName, invoices } = useApp();
  const hiaQuery = useJobHiaContracts(orgId, jobId, open);
  const clientsQuery = useJobClients(orgId, jobId, open);
  const [current, setCurrent] = useState<JobFacts | null>(null);
  const [documents, setDocuments] = useState<Array<{
    id: string;
    type?: string;
    text?: string;
    textStatus?: string;
    status?: string;
  }>>([]);
  const [loaded, setLoaded] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setLoaded(false);
      setDrafts([]);
      setDocuments([]);
      setCurrent(null);
      setError('');
      return undefined;
    }
    let cancelled = false;
    setLoaded(false);
    void (async () => {
      try {
        const { fetchJobFacts } = await import('../../firebase/jobFacts');
        const { fetchJobFiles, fetchJobFileTextContent } = await import('../../firebase/jobFiles');
        const [facts, filesResult] = await Promise.all([
          fetchJobFacts(jobId).catch(() => null),
          fetchJobFiles(jobId),
        ]);
        const candidates = (filesResult.files || []).filter((file) => (
          file.status === 'active'
          && (file.type === 'permit' || file.type === 'certificate' || file.type === 'contract')
        ));
        const texts = await Promise.all(candidates.map(async (file) => {
          const body = await fetchJobFileTextContent(jobId, String(file.id || ''));
          return {
            id: String(file.id || ''),
            type: file.type,
            status: file.status,
            text: body?.text,
            textStatus: body?.textStatus,
          };
        }));
        if (cancelled) return;
        setCurrent(facts);
        setDocuments(texts);
      } catch {
        if (!cancelled) {
          setCurrent(null);
          setDocuments([]);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, jobId]);

  const directoriesReady = !hiaQuery.isLoading && !clientsQuery.isLoading;
  const ready = open && loaded && directoriesReady;

  const collected = useMemo(() => {
    if (!ready) return [];
    return collectJobFactProposals({
      boq,
      hiaContracts: hiaQuery.data || [],
      clients: clientsQuery.data || [],
      invoices: invoices || [],
      documents,
      jobName: projectName,
      current,
    });
  }, [
    ready,
    boq,
    hiaQuery.data,
    clientsQuery.data,
    invoices,
    documents,
    projectName,
    current,
  ]);

  useEffect(() => {
    if (!open || !ready) return;
    setDrafts(collected.map(toDraft));
  }, [open, ready, collected]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  const visible = drafts.filter((row) => !row.dismissed);
  const writableCount = visible.filter((row) => {
    if (row.edited) {
      const reviewed = reviewEditedProposal(row, current, row.draftValue);
      return reviewed?.decision === 'write';
    }
    return row.decision === 'write';
  }).length;
  const hasBoq = Boolean(boq);
  const hasFloorArea = visible.some((row) => row.field === 'floorArea');

  const updateRow = (field: DraftRow['field'], patch: Partial<DraftRow>) => {
    setDrafts((currentRows) => currentRows.map((row) => (
      row.field === field ? { ...row, ...patch } : row
    )));
  };

  const saveRows = async (rows: JobFactProposal[]) => {
    if (!userId) {
      setError('Sign in to confirm these details.');
      return;
    }
    if (rows.length === 0) {
      setError('Nothing ready to accept.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { saveJobFacts } = await import('../../firebase/jobFacts');
      const now = new Date();
      const patch = jobFactsPatchFromProposals(rows, {
        confirmedBy: userId,
        confirmedAt: now,
        updatedAt: now,
      });
      const result = await saveJobFacts(jobId, patch, { createdBy: userId });
      if (result.written.length > 0) {
        const n = result.written.length;
        showToast(n === 1 ? 'Saved that job detail.' : `Saved ${n} job details.`, 'success');
      }
      if (result.proposed.length > 0 && result.written.length === 0) {
        showToast('Those details are already confirmed.', 'success');
      }
      const written = new Set(result.written);
      setDrafts((currentRows) => currentRows.map((row) => (
        written.has(row.field) ? { ...row, dismissed: true } : row
      )));
      const leftoverWritable = visible.some((row) => {
        if (written.has(row.field)) return false;
        if (row.edited) {
          const reviewed = reviewEditedProposal(row, current, row.draftValue);
          return reviewed?.decision === 'write';
        }
        return row.decision === 'write';
      });
      if (result.written.length > 0 && !leftoverWritable) onClose();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Could not save those details.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const acceptRow = (row: DraftRow) => {
    const reviewed = reviewEditedProposal(row, current, row.edited ? row.draftValue : null);
    if (!reviewed || reviewed.decision !== 'write') {
      setError(row.decision === 'propose' && !row.edited
        ? 'Already confirmed. Edit it to replace, or skip.'
        : 'That value is not valid.');
      return;
    }
    void saveRows([reviewed.incoming]);
  };

  const acceptAllWritable = () => {
    const rows = visible.flatMap((row) => {
      const reviewed = reviewEditedProposal(row, current, row.edited ? row.draftValue : null);
      if (!reviewed || reviewed.decision !== 'write') return [];
      if (!row.edited && row.decision !== 'write') return [];
      return [reviewed.incoming];
    });
    void saveRows(rows);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-steel-900/50"
        aria-label="Close job details"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="propose-facts-title"
        className="relative w-full md:max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-t-ot md:rounded-ot border border-hairline shadow-whisper px-4 pt-4 pb-4 md:mx-4 safe-area-bottom"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="propose-facts-title" className="text-[15px] font-extrabold text-ink">
              Check these job details
            </h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              Nothing is written until you accept. Accept all is only the rows that can be saved.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-11 h-11 grid place-items-center rounded-ot-sm text-slate-500 hover:bg-canvas disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!ready ? (
          <p className="text-[13px] text-slate-600 mt-4">Checking what the job already has…</p>
        ) : null}

        {ready && visible.map((row) => {
          const blocked = row.decision === 'propose' && !row.edited;
          const label = FACT_PROPOSAL_LABELS[row.field] || row.field;
          return (
            <div key={row.field} className="py-2.5 border-b border-hairline last:border-b-0">
              <div className="text-[13px] font-semibold text-ink">{label}</div>
              <p className="text-[12px] text-slate-600 mt-1">
                {row.reason} Correct?
              </p>
              {blocked ? (
                <p className="text-[12px] text-slate-500 mt-1">
                  Already confirmed as {currentValueLabel(row.field, current, row)}. Skip, or edit to replace.
                </p>
              ) : null}
              <label className="block mt-2">
                <span className="sr-only">Edit {label}</span>
                <input
                  type="text"
                  value={row.draftValue}
                  onChange={(event) => updateRow(row.field, {
                    draftValue: event.target.value,
                    edited: event.target.value !== draftFromProposal(row),
                  })}
                  className="w-full min-h-[36px] px-2 py-1.5 rounded-ot-sm border border-hairline bg-surface text-[13px] text-ink"
                />
              </label>
              <div className="flex flex-wrap gap-2 mt-2">
                <button
                  type="button"
                  disabled={busy || blocked}
                  onClick={() => acceptRow(row)}
                  className="inline-flex min-h-[36px] items-center justify-center px-3 py-1.5 rounded-ot-sm bg-accent text-white text-[12.5px] font-bold disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => updateRow(row.field, { dismissed: true })}
                  className="inline-flex min-h-[36px] items-center justify-center px-3 py-1.5 rounded-ot-sm bg-surface border border-hairline text-[12.5px] font-bold disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}

        {ready && visible.length === 0 ? (
          <p className="text-[13px] text-slate-600 mt-4">Nothing to review on this job.</p>
        ) : null}

        {ready && !hasBoq && !hasFloorArea ? (
          <p className="text-[12px] text-slate-500 mt-3">
            Floor area from an already imported plan cannot be recovered here. Re-import the bill of quantities to pick up a Built Area figure.
          </p>
        ) : null}

        {error ? <p className="text-[12.5px] text-neg mt-3" role="alert">{error}</p> : null}

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            disabled={busy || !ready || writableCount === 0}
            onClick={acceptAllWritable}
            className="inline-flex min-h-[44px] items-center justify-center px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold disabled:opacity-50"
          >
            {busy ? 'Saving…' : `Accept all${writableCount ? ` (${writableCount})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
