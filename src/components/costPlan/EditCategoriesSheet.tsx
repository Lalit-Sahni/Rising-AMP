import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { activeTrades } from '../../domain/costPlan';
import { queryKeys } from '../../query/client';
import type { TradeListItem } from '../../domain/schemas';

type EditCategoriesSheetProps = {
  open: boolean;
  orgId: string;
  trades: TradeListItem[];
  onClose: () => void;
  showToast: (message: string, type?: string) => void;
};

export default function EditCategoriesSheet({
  open,
  orgId,
  trades,
  onClose,
  showToast,
}: EditCategoriesSheetProps) {
  const queryClient = useQueryClient();
  const list = useMemo(() => activeTrades(trades), [trades]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    list.forEach((trade) => {
      next[trade.id] = trade.name;
    });
    setNames(next);
    setError('');
  }, [open, list]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const changes = list.filter((trade) => {
      const next = String(names[trade.id] || '').trim();
      return next && next !== trade.name;
    });
    if (changes.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      const { ensureOrgTradeList, fetchTradeList, renameOrgTrade } = await import('../../firebase/tradeList');
      await ensureOrgTradeList();
      for (const trade of changes) {
        await renameOrgTrade(trade.id, String(names[trade.id] || '').trim());
      }
      queryClient.setQueryData(queryKeys.tradeList(orgId), await fetchTradeList());
      showToast(changes.length === 1 ? `Renamed to ${String(names[changes[0].id] || '').trim()}.` : 'Category names saved.', 'success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename those categories.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-surface w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-ot sm:rounded-ot border border-hairline shadow-whisper">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-hairline">
          <div>
            <h2 className="text-[16px] font-extrabold">Edit categories</h2>
            <p className="text-[12.5px] text-slate-600 mt-0.5">
              Rename a cost-plan category. This name is used on every job, including Other.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-ot-sm text-slate-500 hover:bg-canvas" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {list.map((trade) => (
            <label key={trade.id} className="block">
              <span className="sr-only">{trade.name}</span>
              <input
                type="text"
                value={names[trade.id] ?? trade.name}
                onChange={(event) => setNames((current) => ({ ...current, [trade.id]: event.target.value }))}
                maxLength={80}
                className="w-full px-3 py-2 rounded-ot-sm border border-hairline text-[13px]"
              />
            </label>
          ))}
          {error ? <p className="text-[12.5px] text-neg">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[13px] text-slate-600">Cancel</button>
            <button type="submit" disabled={busy} className="px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save names'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
