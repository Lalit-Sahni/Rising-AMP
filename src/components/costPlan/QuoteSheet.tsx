import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { todayYmd } from '../../dates';
import { parseToCents } from '../../money';
import { allocationsCoverTotal } from '../../domain/costPlan';
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
  showToast: (message: string, type?: string) => void;
};

type AllocationDraft = { tradeId: string; amount: string };

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
  const [fileId, setFileId] = useState('');
  const [allocations, setAllocations] = useState<AllocationDraft[]>([{ tradeId: '', amount: '' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [voiding, setVoiding] = useState(false);

  const quoteFiles = useMemo(
    () => (files || []).filter((file) => file.status !== 'archived' && file.type === 'quote'),
    [files],
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
    setFileId(quote?.fileId || '');
    setAllocations(
      quote?.allocations?.length
        ? quote.allocations.map((row) => ({ tradeId: row.tradeId, amount: String(row.amountCents / 100) }))
        : [{ tradeId: defaultTradeId || (trades[0]?.id || ''), amount: '' }],
    );
    setError('');
  }, [open, quote, defaultTradeId, trades]);

  if (!open) return null;

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
        fileId: fileId || null,
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
              One quote can cover one trade, or split across two if it really has to.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-ot-sm text-slate-500 hover:bg-canvas" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <label className="block text-[12.5px] font-semibold">
            Who quoted
            <input value={party} onChange={(event) => setParty(event.target.value)} className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12.5px] font-semibold">
              Date
              <input type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]" />
            </label>
            <label className="block text-[12.5px] font-semibold">
              GST
              <select value={gstMode} onChange={(event) => setGstMode(event.target.value as 'inclusive' | 'exclusive')} className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]">
                <option value="inclusive">Inclusive</option>
                <option value="exclusive">Exclusive</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12.5px] font-semibold">
              Amount
              <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px] tabular" />
            </label>
            <label className="block text-[12.5px] font-semibold">
              High (optional)
              <input value={amountHigh} onChange={(event) => setAmountHigh(event.target.value)} inputMode="decimal" className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px] tabular" />
            </label>
          </div>
          <div>
            <div className="text-[12.5px] font-semibold mb-1.5">Allocate to trades</div>
            {allocations.map((row, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <select
                  value={row.tradeId}
                  onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => (
                    itemIndex === index ? { ...item, tradeId: event.target.value } : item
                  )))}
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
          {quoteFiles.length > 0 ? (
            <label className="block text-[12.5px] font-semibold">
              Linked file
              <select value={fileId} onChange={(event) => setFileId(event.target.value)} className="mt-1 w-full px-2 py-2 rounded-ot-sm border border-hairline text-[13px]">
                <option value="">None</option>
                {quoteFiles.map((file) => (
                  <option key={file.id} value={file.id}>{file.name}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="text-[12px] text-slate-500">Add the PDF in Files as a Quote if you want it on this record.</p>
          )}
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
                disabled={busy || voiding}
                className="px-3 py-2 text-[13px] font-bold text-neg disabled:opacity-50"
              >
                {voiding ? 'Voiding…' : 'Void this quote'}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 text-[13px] text-slate-600">Cancel</button>
              <button type="submit" disabled={busy || voiding} className="px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold disabled:opacity-50">
                {busy ? 'Saving…' : 'Save quote'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
