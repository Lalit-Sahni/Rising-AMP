import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  JOB_FILE_TYPE_META,
  JOB_FILE_TYPES,
  filesDrawerMeta,
  formatJobFileDocumentDate,
  formatJobFileSize,
  type JobFileType,
} from '../../domain/jobFiles';
import type { FileBrowserItem } from '../../domain/jobFileBrowser';
import { fileAddedByLabel, fileLinkLabel } from '../../domain/jobFileBrowser';
import JobFilePreview from './JobFilePreview';

type JobFileViewerProps = {
  open: boolean;
  item: FileBrowserItem | null;
  currentUid: string;
  currentName: string;
  expenses: unknown[];
  invoices: unknown[];
  busy?: boolean;
  onClose: () => void;
  onSave: (patch: {
    name: string;
    type: JobFileType;
    documentDate: string;
    note: string;
  }) => Promise<void> | void;
  onArchive: () => Promise<void> | void;
  onOpenExpense: (expenseId: string) => void;
};

export default function JobFileViewer({
  open,
  item,
  currentUid,
  currentName,
  expenses,
  invoices,
  busy = false,
  onClose,
  onSave,
  onArchive,
  onOpenExpense,
}: JobFileViewerProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<JobFileType>('other');
  const [documentDate, setDocumentDate] = useState('');
  const [note, setNote] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open || !item) return undefined;
    setName(item.name);
    setType(item.type === 'receipt' ? 'other' : item.type);
    setDocumentDate(item.documentDate);
    setNote(item.note);
    setConfirmArchive(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, item, busy, onClose]);

  if (!open || !item) return null;

  const meta = filesDrawerMeta(item.type);
  const added = fileAddedByLabel(item, currentUid, currentName);
  const linked = fileLinkLabel(item.linkedTo, { expenses, invoices });
  const readOnly = item.readOnly;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-steel-900/50"
        aria-label="Close file"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-viewer-title"
        className="relative w-full md:max-w-lg max-h-[92vh] overflow-y-auto bg-surface rounded-t-ot md:rounded-ot border border-hairline shadow-whisper px-4 pt-4 pb-4 md:mx-4 safe-area-bottom"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-400">
              {meta.label}
            </div>
            <h2 id="file-viewer-title" className="text-[16px] font-extrabold text-ink truncate">
              {item.name}
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

        <JobFilePreview
          originalPath={item.originalPath}
          originalUrl={item.originalUrl}
          contentType={item.contentType}
          name={item.name}
        />

        <div className="text-[12.5px] text-slate-500 mt-3 flex flex-wrap gap-x-2 gap-y-1">
          {item.documentDate ? <span>{formatJobFileDocumentDate(item.documentDate)}</span> : null}
          {item.sizeBytes != null ? <span>· {formatJobFileSize(item.sizeBytes)}</span> : null}
          {added ? <span>· {added}</span> : null}
        </div>
        {linked ? <p className="text-[12.5px] text-slate-500 mt-1">{linked}</p> : null}

        {readOnly ? (
          <div className="mt-4 space-y-3">
            <p className="text-[13px] text-slate-600">
              This receipt lives on the expense. Files does not keep a second copy.
            </p>
            {item.expenseId ? (
              <button
                type="button"
                onClick={() => onOpenExpense(item.expenseId as string)}
                className="w-full min-h-[44px] rounded-ot-sm bg-accent hover:bg-accent-600 text-white text-[13px] font-bold"
              >
                Open expense
              </button>
            ) : null}
          </div>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              onSave({
                name: name.trim() || item.name,
                type,
                documentDate,
                note: note.trim(),
              });
            }}
          >
            <label className="block text-[12.5px] font-medium text-slate-600">
              Name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
                disabled={busy}
                className="mt-1 w-full min-h-[44px] px-3 rounded-ot-sm border border-hairline text-[14px] text-ink"
              />
            </label>
            <div>
              <div className="text-[12.5px] font-medium text-slate-600 mb-1.5">Type</div>
              <div className="flex flex-wrap gap-1.5">
                {JOB_FILE_TYPES.map((key) => {
                  const chip = JOB_FILE_TYPE_META[key];
                  const selected = type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setType(key)}
                      disabled={busy}
                      className={`inline-flex items-center gap-1.5 min-h-[44px] px-2.5 rounded-ot-sm text-[13px] border ${
                        selected
                          ? 'border-ink bg-canvas text-ink font-semibold'
                          : 'border-hairline text-slate-600'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: chip.color }} />
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="block text-[12.5px] font-medium text-slate-600">
              Date on the document
              <input
                type="date"
                value={documentDate}
                onChange={(event) => setDocumentDate(event.target.value)}
                disabled={busy}
                className="mt-1 w-full min-h-[44px] px-3 rounded-ot-sm border border-hairline text-[14px] text-ink"
              />
            </label>
            <label className="block text-[12.5px] font-medium text-slate-600">
              Note
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={2000}
                rows={3}
                disabled={busy}
                className="mt-1 w-full px-3 py-2 rounded-ot-sm border border-hairline text-[14px] text-ink"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] rounded-ot-sm bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-[13px] font-bold"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            {confirmArchive ? (
              <div className="border border-hairline rounded-ot-sm p-3">
                <p className="text-[13px] text-slate-600">
                  Archive this file? It stays on the job, just off the list. Nothing is deleted.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onArchive}
                    className="flex-1 min-h-[44px] rounded-ot-sm border border-ink text-ink text-[13px] font-bold"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmArchive(false)}
                    className="flex-1 min-h-[44px] rounded-ot-sm border border-hairline text-slate-600 text-[13px] font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmArchive(true)}
                className="w-full min-h-[44px] rounded-ot-sm text-slate-500 text-[13px] font-medium"
              >
                Archive
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
