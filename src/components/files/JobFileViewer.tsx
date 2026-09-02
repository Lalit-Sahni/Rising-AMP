import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  JOB_FILE_TYPE_META,
  JOB_FILE_TYPES,
  filesDrawerMeta,
  formatJobFileDocumentDate,
  formatJobFileSize,
  type JobFileLinkKind,
  type JobFileLinkedTo,
  type JobFileType,
} from '../../domain/jobFiles';
import type { FileBrowserItem } from '../../domain/jobFileBrowser';
import { expenseDisplayName, fileAddedByLabel, fileLinkLabel, fileRegisterLinkLabel } from '../../domain/jobFileBrowser';
import { liveQuoteFileTargets, quoteForFileId, type QuoteFileFields } from '../../domain/quoteFiles';
import JobFilePreview from './JobFilePreview';

type JobFileViewerProps = {
  open: boolean;
  item: FileBrowserItem | null;
  currentUid: string;
  currentName: string;
  expenses: unknown[];
  invoices: unknown[];
  hiaContracts?: unknown[];
  quotes?: QuoteFileFields[];
  busy?: boolean;
  onClose: () => void;
  onSave: (patch: {
    name: string;
    type: JobFileType;
    documentDate: string;
    note: string;
    linkedTo: JobFileLinkedTo | null;
    assignedQuoteId: string | null;
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
  hiaContracts = [],
  quotes = [],
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
  const [linkKind, setLinkKind] = useState<'none' | JobFileLinkKind>('none');
  const [linkId, setLinkId] = useState('');
  const [assignedQuoteId, setAssignedQuoteId] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open || !item) return undefined;
    setName(item.name);
    setType(item.type === 'receipt' ? 'other' : item.type);
    setDocumentDate(item.documentDate);
    setNote(item.note);
    setLinkKind(item.linkedTo?.kind || 'none');
    setLinkId(item.linkedTo?.id || '');
    setAssignedQuoteId(quoteForFileId(quotes, item.fileId)?.id || '');
    setConfirmArchive(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, item, busy, onClose, quotes]);

  if (!open || !item) return null;

  const meta = filesDrawerMeta(item.type);
  const added = fileAddedByLabel(item, currentUid, currentName);
  const liveQuotes = liveQuoteFileTargets(quotes);
  const linked = fileRegisterLinkLabel(item, { expenses, invoices, quotes }) || fileLinkLabel(item.linkedTo, { expenses, invoices });
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
        className="relative w-full md:max-w-lg max-h-[100dvh] md:max-h-[88vh] overflow-y-auto bg-surface rounded-t-ot md:rounded-ot border border-hairline shadow-whisper px-4 pt-4 pb-4 md:mx-4 safe-area-bottom"
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
                linkedTo: linkKind === 'none' || !linkId
                  ? null
                  : { kind: linkKind, id: linkId },
                assignedQuoteId: assignedQuoteId || null,
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
            <div>
              <div className="text-[12.5px] font-medium text-slate-600 mb-1.5">Linked to</div>
              <select
                value={linkKind}
                disabled={busy}
                onChange={(event) => {
                  const next = event.target.value as 'none' | JobFileLinkKind;
                  setLinkKind(next);
                  setLinkId('');
                }}
                className="w-full min-h-[44px] px-3 rounded-ot-sm border border-hairline text-[14px] text-ink mb-2"
              >
                <option value="none">Nothing</option>
                <option value="expense">An expense</option>
                <option value="invoice">An invoice</option>
                <option value="hiaContract">The HIA contract</option>
              </select>
              {linkKind === 'expense' ? (
                <select
                  value={linkId}
                  disabled={busy}
                  onChange={(event) => setLinkId(event.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-ot-sm border border-hairline text-[14px] text-ink"
                >
                  <option value="">Choose an expense</option>
                  {(expenses || []).map((expense) => {
                    const row = expense as { id?: string; status?: string };
                    if (!row?.id || String(row.status || '').toLowerCase() === 'void') return null;
                    return (
                      <option key={row.id} value={row.id}>
                        {expenseDisplayName(expense)}
                      </option>
                    );
                  })}
                </select>
              ) : null}
              {linkKind === 'invoice' ? (
                <select
                  value={linkId}
                  disabled={busy}
                  onChange={(event) => setLinkId(event.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-ot-sm border border-hairline text-[14px] text-ink"
                >
                  <option value="">Choose an invoice</option>
                  {(invoices || []).map((invoice) => {
                    const row = invoice as { id?: string; invoiceNumber?: string; status?: string };
                    if (!row?.id || String(row.status || '').toLowerCase() === 'void') return null;
                    return (
                      <option key={row.id} value={row.id}>
                        {row.invoiceNumber || row.id}
                      </option>
                    );
                  })}
                </select>
              ) : null}
              {linkKind === 'hiaContract' ? (
                <select
                  value={linkId}
                  disabled={busy}
                  onChange={(event) => setLinkId(event.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-ot-sm border border-hairline text-[14px] text-ink"
                >
                  <option value="">Choose a contract</option>
                  {(hiaContracts || []).map((contract) => {
                    const row = contract as { id?: string; projectName?: string; status?: string };
                    if (!row?.id || String(row.status || '').toLowerCase() === 'void') return null;
                    return (
                      <option key={row.id} value={row.id}>
                        {row.projectName || 'HIA contract'}
                      </option>
                    );
                  })}
                </select>
              ) : null}
            </div>
            <div>
              <div className="text-[12.5px] font-medium text-slate-600 mb-1.5">Cost plan quote</div>
              {liveQuotes.length === 0 ? (
                <p className="text-[12.5px] text-slate-500">
                  Add a quote on Cost Plan first, then assign this file to it here. The PDF stays in Files; the quote only stores a pointer.
                </p>
              ) : (
                <select
                  value={assignedQuoteId}
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value;
                    setAssignedQuoteId(next);
                    if (next) setType('quote');
                  }}
                  className="w-full min-h-[44px] px-3 rounded-ot-sm border border-hairline text-[14px] text-ink"
                >
                  <option value="">Not assigned</option>
                  {liveQuotes.map((quote) => (
                    <option key={quote.id} value={quote.id}>
                      {quote.party || 'Quote'}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] rounded-ot-sm bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-[13px] font-bold sticky bottom-0"
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
