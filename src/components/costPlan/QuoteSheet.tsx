import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, Paperclip, Sparkles, Upload, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { todayYmd } from '../../dates';
import { parseToCents } from '../../money';
import { allocationsCoverTotal } from '../../domain/costPlan';
import { JOB_FILE_ACCEPT, validateJobFileForUpload } from '../../domain/jobFiles';
import {
  applyQuoteAutofill,
  isQuoteReadableFile,
  quoteCheckFields,
  type QuoteFormDraft,
  type QuoteReadResult,
  type QuoteReadUncertain,
} from '../../domain/quoteRead';
import {
  QUOTE_FILE_MAX,
  addQuoteFileIds,
  quoteFileIds,
  removeQuoteFileId,
} from '../../domain/quoteFiles';
import { friendlyQuoteReadError } from '../../firebase/readQuote';
import { queryKeys } from '../../query/client';
import type { CostPlanQuote, JobFile, TradeListItem } from '../../domain/schemas';

type QuoteSheetProps = {
  open: boolean;
  orgId: string;
  jobId: string;
  userId: string;
  trades: TradeListItem[];
  files?: JobFile[];
  quote?: CostPlanQuote | null;
  defaultTradeId?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onFilesChange?: (files: JobFile[]) => void;
  showToast: (message: string, type?: string) => void;
};

type AllocationDraft = { tradeId: string; amount: string };

function mergeJobFiles(incoming: JobFile[], current: JobFile[]): JobFile[] {
  const byId = new Map<string, JobFile>();
  incoming.forEach((row) => {
    if (row.id) byId.set(row.id, row);
  });
  current.forEach((row) => {
    if (row.id && !byId.has(row.id)) byId.set(row.id, row);
  });
  return [...byId.values()];
}

function emptyField(value: string | null | undefined): boolean {
  return !String(value || '').trim();
}

function CheckField({
  label,
  flagged,
  children,
}: {
  label: string;
  flagged?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-[12.5px] font-semibold ${flagged ? 'rounded-[9px] border border-warn bg-warn-tint p-3' : ''}`}>
      <span className="inline-flex items-center gap-1.5">
        {label}
        {flagged ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warn">
            <AlertTriangle className="w-3 h-3" strokeWidth={2} />
            Check this
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export default function QuoteSheet({
  open,
  orgId,
  jobId,
  userId,
  trades,
  files = [],
  quote,
  defaultTradeId,
  onClose,
  onSaved,
  onFilesChange,
  showToast,
}: QuoteSheetProps) {
  const queryClient = useQueryClient();
  const [party, setParty] = useState('');
  const [receivedDate, setReceivedDate] = useState(todayYmd());
  const [amount, setAmount] = useState('');
  const [amountHigh, setAmountHigh] = useState('');
  const [gstMode, setGstMode] = useState<'inclusive' | 'exclusive'>('inclusive');
  const [status, setStatus] = useState<'received' | 'chosen' | 'passed'>('received');
  const [note, setNote] = useState('');
  const [attachedIds, setAttachedIds] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<AllocationDraft[]>([{ tradeId: '', amount: '' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [localFiles, setLocalFiles] = useState<JobFile[]>(files);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [readingKey, setReadingKey] = useState<string | null>(null);
  const [checkFields, setCheckFields] = useState<QuoteReadUncertain>({});
  const [aiNotice, setAiNotice] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const dateDirtyRef = useRef(false);
  const readGenRef = useRef(0);
  const draft: QuoteFormDraft = {
    party,
    receivedDate,
    amount,
    amountHigh,
    gstMode,
    allocations,
    note,
  };
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const attachableFiles = useMemo(
    () => (localFiles || []).filter((file) => file.status !== 'archived' && Boolean(file.id)),
    [localFiles],
  );
  const quoteTypeFiles = useMemo(
    () => attachableFiles.filter((file) => file.type === 'quote' || attachedIds.includes(file.id || '')),
    [attachableFiles, attachedIds],
  );

  useEffect(() => {
    if (!open) return;
    setParty(quote?.party || '');
    setReceivedDate(quote?.receivedDate || todayYmd());
    setAmount(quote ? String(quote.amountCents / 100) : '');
    setAmountHigh(quote?.amountHighCents ? String(quote.amountHighCents / 100) : '');
    setGstMode(quote?.gstMode || 'inclusive');
    setStatus(quote && quote.status !== 'void' ? quote.status : 'received');
    setNote(quote?.note || '');
    setAttachedIds(quoteFileIds(quote));
    setAllocations(
      quote?.allocations?.length
        ? quote.allocations.map((row) => ({ tradeId: row.tradeId, amount: String(row.amountCents / 100) }))
        : [{ tradeId: defaultTradeId || (trades[0]?.id || ''), amount: '' }],
    );
    setError('');
    setUploadProgress(null);
    setAttaching(false);
    setReadingKey(null);
    setCheckFields({});
    setAiNotice('');
    dateDirtyRef.current = Boolean(quote?.receivedDate);
    readGenRef.current += 1;
  }, [open, quote, defaultTradeId, trades]);

  useEffect(() => {
    setLocalFiles([]);
  }, [jobId]);

  useEffect(() => {
    if (!open) return;
    setLocalFiles((current) => mergeJobFiles(files, current));
  }, [open, files]);

  useEffect(() => {
    if (!open || !jobId) return undefined;
    let cancelled = false;
    (async () => {
      const { fetchJobFiles } = await import('../../firebase/jobFiles');
      const result = await fetchJobFiles(jobId);
      if (cancelled || !result.success) return;
      setLocalFiles((current) => mergeJobFiles(result.files || [], current));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, jobId]);

  if (!open) return null;

  const locked = busy || voiding || attaching;
  const reading = Boolean(readingKey);

  const applyRead = (read: QuoteReadResult, overwrite: boolean) => {
    const current = { ...draftRef.current };
    if (!overwrite && !dateDirtyRef.current) current.receivedDate = '';
    const next = applyQuoteAutofill(current, read, { overwrite, fallbackTradeId: defaultTradeId });
    if (!next.receivedDate) next.receivedDate = draftRef.current.receivedDate;
    setParty(next.party);
    setReceivedDate(next.receivedDate);
    setAmount(next.amount);
    setAmountHigh(next.amountHigh);
    setGstMode(next.gstMode);
    setAllocations(next.allocations);
    setNote(next.note);
    setCheckFields(quoteCheckFields(current, next, read, overwrite));
    setAiNotice(read.warnings.join(' '));
    const changed = overwrite
      || current.party !== next.party
      || current.amount !== next.amount
      || current.amountHigh !== next.amountHigh
      || current.receivedDate !== next.receivedDate
      || current.gstMode !== next.gstMode
      || current.note !== next.note
      || (current.allocations[0]?.tradeId || '') !== (next.allocations[0]?.tradeId || '');
    if (!read.party && !read.amount) {
      showToast('Could not read that quote. Check the fields, or photograph the total page.', 'info');
      return;
    }
    if (!changed) {
      showToast('Those fields are already filled. Use Read with AI to replace them.', 'info');
      return;
    }
    showToast('Filled from the quote. Check anything highlighted.', 'success');
  };

  const readLocalFile = async (file: File, key: string, overwrite: boolean) => {
    const gen = readGenRef.current + 1;
    readGenRef.current = gen;
    setReadingKey(key);
    try {
      const { readQuoteFromFile } = await import('../../firebase/readQuote');
      const read = await readQuoteFromFile(file, trades);
      if (gen !== readGenRef.current) return;
      applyRead(read, overwrite);
    } catch (err) {
      if (gen !== readGenRef.current) return;
      showToast(friendlyQuoteReadError(err), 'error');
    } finally {
      if (gen === readGenRef.current) setReadingKey(null);
    }
  };

  const readStoredFile = async (file: JobFile, overwrite: boolean) => {
    if (!file.storagePath) return;
    const gen = readGenRef.current + 1;
    readGenRef.current = gen;
    setReadingKey(file.id || file.storagePath);
    try {
      const { readQuoteFromStorage } = await import('../../firebase/readQuote');
      const read = await readQuoteFromStorage({
        storagePath: file.storagePath,
        contentType: file.contentType,
        name: file.name,
        sizeBytes: file.sizeBytes,
        trades,
      });
      if (gen !== readGenRef.current) return;
      applyRead(read, overwrite);
    } catch (err) {
      if (gen !== readGenRef.current) return;
      showToast(friendlyQuoteReadError(err), 'error');
    } finally {
      if (gen === readGenRef.current) setReadingKey(null);
    }
  };

  const handleVoid = async () => {
    if (!quote?.id || voiding || busy) return;
    setError('');
    setVoiding(true);
    try {
      const { voidQuote } = await import('../../firebase/quotes');
      await voidQuote(jobId, quote.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.costPlanQuotes(orgId, jobId) });
      showToast('Quote voided. It stays on file.', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not void that quote.');
    } finally {
      setVoiding(false);
    }
  };

  const handleAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = '';
    if (picked.length === 0 || attaching || busy || voiding) return;
    const room = QUOTE_FILE_MAX - attachedIds.length;
    if (room <= 0) {
      setError(`A quote can hold ${QUOTE_FILE_MAX} files.`);
      return;
    }
    const queued = picked.slice(0, room);
    setError(queued.length < picked.length ? `Only ${room} more file${room === 1 ? '' : 's'} fit on this quote.` : '');
    const readable = queued.find((file) => isQuoteReadableFile(file));
    if (readable) {
      void readLocalFile(readable, readable.name || 'new', false);
    } else if (queued.length > 0) {
      showToast('AI can read a photo or a PDF. Photograph the quote, or attach a PDF.', 'info');
    }
    setAttaching(true);
    const uploadedIds: string[] = [];
    let nextFiles = localFiles;
    try {
      const { uploadJobFile } = await import('../../firebase/uploadJobFile');
      for (let index = 0; index < queued.length; index += 1) {
        const file = queued[index];
        const checked = validateJobFileForUpload(file);
        if (!checked.ok) {
          throw new Error(checked.error);
        }
        setUploadProgress(0);
        const result = await uploadJobFile({
          jobId,
          file,
          type: 'quote',
          uploadedBy: userId,
          documentDate: receivedDate,
          note: party.trim() ? `Quote from ${party.trim()}` : 'Cost plan quote',
          onProgress: setUploadProgress,
        });
        if (!result.success || !result.file?.id) {
          throw new Error(result.error || 'Could not store that file.');
        }
        uploadedIds.push(result.file.id);
        nextFiles = mergeJobFiles([result.file], nextFiles);
        setLocalFiles(nextFiles);
      }
      onFilesChange?.(nextFiles);
      const added = addQuoteFileIds(attachedIds, uploadedIds);
      if (!added.ok) throw new Error(added.error);
      setAttachedIds(added.ids);
    } catch (err) {
      if (uploadedIds.length > 0) {
        const added = addQuoteFileIds(attachedIds, uploadedIds);
        if (added.ok) setAttachedIds(added.ids);
      }
      setError(err instanceof Error ? err.message : 'Could not attach that file.');
    } finally {
      setAttaching(false);
      setUploadProgress(null);
    }
  };

  const toggleExistingFile = (file: JobFile, checked: boolean) => {
    if (!file.id) return;
    if (checked) {
      const added = addQuoteFileIds(attachedIds, [file.id]);
      if (!added.ok) {
        setError(added.error);
        return;
      }
      setError('');
      setAttachedIds(added.ids);
      const current = draftRef.current;
      if (emptyField(current.party) || emptyField(current.amount)) {
        if (isQuoteReadableFile({ name: file.name, type: file.contentType })) {
          void readStoredFile(file, false);
        } else {
          showToast('AI can read a photo or a PDF. Photograph the quote, or attach a PDF.', 'info');
        }
      }
      return;
    }
    setAttachedIds(removeQuoteFileId(attachedIds, file.id));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    let amountCents: number;
    try {
      amountCents = parseToCents(amount);
    } catch {
      setError('Enter the quote total.');
      return;
    }
    let amountHighCents: number | null = null;
    if (amountHigh.trim()) {
      try {
        amountHighCents = parseToCents(amountHigh);
      } catch {
        setError('Enter a valid high figure, or leave it blank.');
        return;
      }
    }
    const parsedAllocations = allocations
      .map((row) => {
        let centsValue = 0;
        try {
          centsValue = row.amount ? parseToCents(row.amount) : 0;
        } catch {
          centsValue = 0;
        }
        return { tradeId: row.tradeId, amountCents: centsValue };
      })
      .filter((row) => row.tradeId && row.amountCents > 0);
    if (!party.trim()) {
      setError('Who quoted?');
      return;
    }
    if (parsedAllocations.length === 0) {
      setError('Allocate the quote to at least one trade.');
      return;
    }
    if (!allocationsCoverTotal({ amountCents, allocations: parsedAllocations })) {
      setError('The parts must add up to the quote total.');
      return;
    }

    setBusy(true);
    readGenRef.current += 1;
    setReadingKey(null);
    try {
      const { saveQuote } = await import('../../firebase/quotes');
      await saveQuote(jobId, {
        party: party.trim(),
        receivedDate,
        status,
        amountCents,
        amountHighCents,
        gstMode,
        note: note.trim() || undefined,
        fileIds: attachedIds,
        allocations: parsedAllocations,
        createdBy: userId,
      }, quote?.id);
      queryClient.invalidateQueries({ queryKey: queryKeys.costPlanQuotes(orgId, jobId) });
      showToast(status === 'chosen' ? 'Chosen quote saved.' : 'Quote saved.', 'success');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that quote.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-surface w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-ot sm:rounded-ot border border-hairline shadow-whisper">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-hairline">
          <div>
            <h2 className="text-[16px] font-extrabold">{quote ? 'Edit quote' : 'Add a quote'}</h2>
            <p className="text-[12.5px] text-slate-600 mt-0.5">
              Attach the quote first. AI fills the details. Check anything highlighted before you save.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-ot-sm text-slate-500 hover:bg-canvas" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div>
            <div className="text-[12.5px] font-semibold mb-1.5">Quote file</div>
            <p className="text-[12px] text-slate-500 mb-2">
              Take a photo or attach a PDF. It is stored in Files. You can also tick a quote already on this job.
            </p>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleAttach}
            />
            <input
              ref={filesInputRef}
              type="file"
              accept={JOB_FILE_ACCEPT}
              multiple
              className="sr-only"
              onChange={handleAttach}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={locked || attachedIds.length >= QUOTE_FILE_MAX}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-ot-sm border border-hairline text-[13px] font-bold text-ink disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Take a photo
              </button>
              <button
                type="button"
                onClick={() => filesInputRef.current?.click()}
                disabled={locked || attachedIds.length >= QUOTE_FILE_MAX}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-ot-sm border border-hairline text-[13px] font-bold text-ink disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Choose files
              </button>
            </div>
            {attaching ? (
              <p className="mt-2 text-[12.5px] text-slate-500">
                {uploadProgress != null ? `Uploading ${uploadProgress}%` : 'Uploading…'}
              </p>
            ) : null}
            {reading ? (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent">
                <Sparkles className="w-3.5 h-3.5" />
                Reading quote…
              </p>
            ) : null}
            {attachedIds.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {attachedIds.map((id) => {
                  const file = attachableFiles.find((row) => row.id === id);
                  const readable = isQuoteReadableFile({ name: file?.name, type: file?.contentType });
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="truncate min-w-0">
                        <Paperclip className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                        {file?.name || 'File attached'}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        {file && readable ? (
                          <button
                            type="button"
                            onClick={() => void readStoredFile(file, true)}
                            disabled={locked || reading}
                            className="text-[12.5px] font-bold text-accent disabled:opacity-50"
                          >
                            Read with AI
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setAttachedIds(removeQuoteFileId(attachedIds, id))}
                          className="text-[12.5px] font-bold text-slate-500"
                        >
                          Unlink
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {quoteTypeFiles.length > 0 ? (
              <div className="mt-3 space-y-1.5">
                <div className="text-[12.5px] font-semibold">On this job already</div>
                {quoteTypeFiles.map((file) => {
                  if (!file.id) return null;
                  const checked = attachedIds.includes(file.id);
                  return (
                    <label key={file.id} className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleExistingFile(file, event.target.checked)}
                        disabled={locked || reading}
                        className="accent-[#E85D1A]"
                      />
                      <span className="truncate flex-1">{file.name}</span>
                      {checked && isQuoteReadableFile({ name: file.name, type: file.contentType }) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            void readStoredFile(file, true);
                          }}
                          disabled={locked || reading}
                          className="text-[12.5px] font-bold text-accent disabled:opacity-50"
                        >
                          Read with AI
                        </button>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>
          {aiNotice ? <p className="text-[12.5px] text-slate-600">{aiNotice}</p> : null}
          <CheckField label="Who quoted" flagged={checkFields.party}>
            <input
              value={party}
              onChange={(event) => {
                setParty(event.target.value);
                if (checkFields.party) setCheckFields((current) => ({ ...current, party: false }));
              }}
              className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]"
            />
          </CheckField>
          <div className="grid grid-cols-2 gap-3">
            <CheckField label="Date" flagged={checkFields.receivedDate}>
              <input
                type="date"
                value={receivedDate}
                onChange={(event) => {
                  dateDirtyRef.current = true;
                  setReceivedDate(event.target.value);
                  if (checkFields.receivedDate) setCheckFields((current) => ({ ...current, receivedDate: false }));
                }}
                className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]"
              />
            </CheckField>
            <CheckField label="GST" flagged={checkFields.gstMode}>
              <select
                value={gstMode}
                onChange={(event) => {
                  setGstMode(event.target.value as 'inclusive' | 'exclusive');
                  if (checkFields.gstMode) setCheckFields((current) => ({ ...current, gstMode: false }));
                }}
                className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]"
              >
                <option value="inclusive">Inclusive</option>
                <option value="exclusive">Exclusive</option>
              </select>
            </CheckField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CheckField label="Amount" flagged={checkFields.amount}>
              <input
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  if (checkFields.amount) setCheckFields((current) => ({ ...current, amount: false }));
                }}
                inputMode="decimal"
                className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px] tabular"
              />
            </CheckField>
            <label className="block text-[12.5px] font-semibold">
              High (optional)
              <input value={amountHigh} onChange={(event) => setAmountHigh(event.target.value)} inputMode="decimal" className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px] tabular" />
            </label>
          </div>
          <div className={checkFields.tradeId ? 'rounded-[9px] border border-warn bg-warn-tint p-3' : ''}>
            <div className="text-[12.5px] font-semibold mb-1.5 inline-flex items-center gap-1.5">
              Allocate to trades
              {checkFields.tradeId ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-warn">
                  <AlertTriangle className="w-3 h-3" strokeWidth={2} />
                  Check this
                </span>
              ) : null}
            </div>
            {allocations.map((row, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <select
                  value={row.tradeId}
                  onChange={(event) => {
                    setAllocations((current) => current.map((item, itemIndex) => (
                      itemIndex === index ? { ...item, tradeId: event.target.value } : item
                    )));
                    if (index === 0 && checkFields.tradeId) {
                      setCheckFields((current) => ({ ...current, tradeId: false }));
                    }
                  }}
                  className="flex-1 px-2 py-2 rounded-ot-sm border border-hairline text-[13px]"
                >
                  <option value="">Trade</option>
                  {trades.map((trade) => (
                    <option key={trade.id} value={trade.id}>{trade.name}</option>
                  ))}
                </select>
                <input
                  value={row.amount}
                  onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, amount: event.target.value } : item
                  )))}
                  inputMode="decimal"
                  placeholder="Amount"
                  className="w-[110px] px-2 py-2 rounded-ot-sm border border-hairline text-[13px] tabular"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAllocations((current) => [...current, { tradeId: '', amount: '' }])}
              className="text-[12.5px] font-bold text-accent"
            >
              Split across another trade
            </button>
          </div>
          <label className="block text-[12.5px] font-semibold">
            Status
            <select value={status} onChange={(event) => setStatus(event.target.value as 'received' | 'chosen' | 'passed')} className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]">
              <option value="received">Received</option>
              <option value="chosen">Chosen — drives the forecast</option>
              <option value="passed">Passed</option>
            </select>
          </label>
          <label className="block text-[12.5px] font-semibold">
            Note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]" />
          </label>
          {error ? <p className="text-[12.5px] text-neg">{error}</p> : null}
          <div className="flex items-center justify-between gap-2 pt-2">
            {quote?.id ? (
              <button
                type="button"
                onClick={handleVoid}
                disabled={locked}
                className="px-3 py-2 text-[13px] font-bold text-neg disabled:opacity-50"
              >
                {voiding ? 'Voiding…' : 'Void this quote'}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 text-[13px] text-slate-600">Cancel</button>
              <button type="submit" disabled={locked || reading} className="px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold disabled:opacity-50">
                {busy ? 'Saving…' : 'Save quote'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
