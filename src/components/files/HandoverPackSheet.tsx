import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { JobFile } from '../../domain/schemas';
import {
  coverFromProfile,
  defaultHandoverSelectedIds,
  handoverCandidates,
  handoverPackFileName,
  handoverTypeCounts,
  jobAddressFromClients,
  missingHandoverTypes,
  sortHandoverFiles,
} from '../../domain/handoverPack';
import { filesDrawerMeta, formatJobFileDocumentDate, JOB_FILE_TYPES } from '../../domain/jobFiles';
import { getBytesForPath } from '../../firebase/storageBytes';

type HandoverPackSheetProps = {
  open: boolean;
  jobName?: string;
  files: JobFile[];
  clients?: unknown[];
  profile?: {
    businessName?: string;
    displayName?: string;
    abn?: string;
    street?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
    mobile?: string;
    email?: string;
  } | null;
  onClose: () => void;
  showToast: (message: string, type?: string) => void;
};

function downloadPdf(bytes: Uint8Array, fileName: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function HandoverPackSheet({
  open,
  jobName,
  files,
  clients = [],
  profile,
  onClose,
  showToast,
}: HandoverPackSheetProps) {
  const candidates = useMemo(() => handoverCandidates(files), [files]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    setSelectedIds(defaultHandoverSelectedIds(files));
    setProgress('');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, files, busy, onClose]);

  const selected = useMemo(
    () => sortHandoverFiles(candidates.filter((file) => selectedIds.includes(file.id as string))),
    [candidates, selectedIds],
  );
  const missing = missingHandoverTypes(selected);
  const counts = handoverTypeCounts(selected);
  const groups = JOB_FILE_TYPES
    .map((type) => ({
      type,
      files: candidates.filter((file) => file.type === type),
    }))
    .filter((group) => group.files.length > 0);

  const toggle = (id: string) => {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id]
    ));
  };

  const handleGenerate = async () => {
    setBusy(true);
    setProgress('Preparing…');
    try {
      const sources = new Map<string, Uint8Array>();
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        setProgress(`Fetching ${file.name} (${index + 1} of ${selected.length})`);
        const bytes = await getBytesForPath(file.storagePath);
        if (bytes && file.id) sources.set(file.id, bytes);
      }
      setProgress('Building PDF…');
      const { buildHandoverPackPdf } = await import('../../pdf/buildHandoverPack');
      const cover = coverFromProfile({
        jobName,
        jobAddress: jobAddressFromClients(clients),
        generatedAt: new Date(),
        profile,
      });
      const { bytes } = await buildHandoverPackPdf({
        cover,
        files: selected,
        sources,
      });
      downloadPdf(bytes, handoverPackFileName(jobName || 'job'));
      showToast('Handover pack downloaded.', 'success');
      onClose();
    } catch (error) {
      showToast(
        error instanceof Error && /memory|allocation|quota/i.test(error.message)
          ? 'That pack is too large for this browser. Select fewer files, or we can move this to a server later.'
          : 'Could not build the handover pack.',
        'error',
      );
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-steel-900/50"
        aria-label="Close handover pack"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="handover-pack-title"
        className="relative w-full md:max-w-md max-h-[92vh] overflow-y-auto bg-surface rounded-t-ot md:rounded-ot border border-hairline shadow-whisper px-4 pt-4 pb-4 md:mx-4 safe-area-bottom"
      >
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-400">Handover pack</div>
            <h2 id="handover-pack-title" className="text-[15px] font-extrabold text-ink">
              {jobName || 'This job'}
            </h2>
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
        <p className="text-[12.5px] text-slate-500 mb-3">
          Cover, contents, then the documents you tick. Missing types are named on the contents page.
        </p>

        {counts.length > 0 ? (
          <p className="text-[12.5px] text-slate-600 mb-2">
            {counts.map((row) => `${row.label} ${row.count}`).join(' · ')}
          </p>
        ) : (
          <p className="text-[12.5px] text-slate-500 mb-2">Nothing selected yet.</p>
        )}

        {missing.length > 0 ? (
          <div className="border border-hairline rounded-ot-sm p-3 mb-3 bg-warn-tint">
            <div className="text-[12.5px] font-semibold text-warn">Not in this pack</div>
            <ul className="mt-1 space-y-0.5">
              {missing.map((type) => (
                <li key={type} className="text-[12.5px] text-warn">
                  {filesDrawerMeta(type).label} — missing
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {candidates.length === 0 ? (
          <p className="text-[13px] text-slate-600 py-4">
            No documents on this job yet. Add files first, then generate the pack.
          </p>
        ) : (
          <div className="space-y-3 mb-3">
            {groups.map((group) => {
              const meta = filesDrawerMeta(group.type);
              return (
                <div key={group.type}>
                  <div className="text-[11px] font-bold tracking-[0.08em] uppercase text-slate-400 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                    {meta.label}
                  </div>
                  <ul className="space-y-1">
                    {group.files.map((file) => {
                      const checked = selectedIds.includes(file.id as string);
                      return (
                        <li key={file.id}>
                          <label className="flex items-center gap-2.5 min-h-[44px] px-2 rounded-ot-sm hover:bg-canvas">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={busy}
                              onChange={() => toggle(file.id as string)}
                              className="w-4 h-4 accent-[#E85D1A]"
                            />
                            <span className="min-w-0">
                              <span className="block text-[13px] font-semibold text-ink truncate">{file.name}</span>
                              {file.documentDate ? (
                                <span className="block text-[11.5px] text-slate-400">
                                  {formatJobFileDocumentDate(file.documentDate)}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={handleGenerate}
          className="w-full min-h-[44px] rounded-ot-sm bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-[13px] font-bold"
        >
          {busy ? (progress || 'Building…') : 'Generate pack'}
        </button>
      </div>
    </div>
  );
}
