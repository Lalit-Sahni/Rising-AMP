import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { parseToCents, formatCents, fromCents } from '../../money';
import {
  activeTrades,
  sectionsFromTradeAmounts,
  sumSectionAmounts,
} from '../../domain/costPlan';
import { queryKeys } from '../../query/client';
import type { CostPlan, TradeListItem } from '../../domain/schemas';

type BreakIntoTradesSheetProps = {
  open: boolean;
  orgId: string;
  jobId: string;
  plan: CostPlan;
  trades: TradeListItem[];
  onClose: () => void;
  onSaved: (plan: CostPlan) => void;
  showToast: (message: string, type?: string) => void;
};

export default function BreakIntoTradesSheet({
  open,
  orgId,
  jobId,
  plan,
  trades,
  onClose,
  onSaved,
  showToast,
}: BreakIntoTradesSheetProps) {
  const queryClient = useQueryClient();
  const list = useMemo(() => activeTrades(trades), [trades]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [newTrade, setNewTrade] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [updateTarget, setUpdateTarget] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, string> = {};
    (plan.sections || []).forEach((section) => {
      next[section.tradeId] = fromCents(section.amountCents).toFixed(2);
    });
    setAmounts(next);
    setNewTrade('');
    setError('');
    setUpdateTarget(false);
  }, [open, plan]);

  const filled = useMemo(
    () => list
      .map((trade) => {
        try {
          const amountCents = amounts[trade.id] ? parseToCents(amounts[trade.id]) : 0;
          return { tradeId: trade.id, name: trade.name, amountCents };
        } catch {
          return { tradeId: trade.id, name: trade.name, amountCents: 0 };
        }
      })
      .filter((row) => row.amountCents > 0),
    [list, amounts],
  );
  const sum = sumSectionAmounts(sectionsFromTradeAmounts(filled));
  const difference = sum - plan.targetCents;

  if (!open) return null;

  const handleAddTrade = async () => {
    const name = newTrade.trim();
    if (!name) return;
    setBusy(true);
    try {
      const { addOrgTrade, ensureOrgTradeList } = await import('../../firebase/tradeList');
      await ensureOrgTradeList();
      const created = await addOrgTrade(name);
      queryClient.setQueryData(queryKeys.tradeList(orgId), (current: TradeListItem[] | undefined) => {
        const list = current || [];
        if (list.some((row) => row.id === created.id)) return list;
        return [...list, created];
      });
      setNewTrade('');
      showToast(`Added ${created.name}.`, 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that trade.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (filled.length === 0) {
      setError('Put an amount on at least one trade.');
      return;
    }
    const targetCents = updateTarget ? sum : plan.targetCents;
    if (sum !== targetCents) {
      setError('Trade amounts must add up to the target, or tick to use this sum as the new target.');
      return;
    }
    setBusy(true);
    try {
      const { ensureOrgTradeList } = await import('../../firebase/tradeList');
      const { saveCostPlanTrades } = await import('../../firebase/costPlan');
      await ensureOrgTradeList();
      const saved = await saveCostPlanTrades(jobId, {
        sections: sectionsFromTradeAmounts(filled),
        targetCents,
        level: 'trades',
      });
      queryClient.setQueryData(queryKeys.costPlan(orgId, jobId), saved);
      showToast('Trades saved on the cost plan.', 'success');
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save those trades.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="bg-surface w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-ot sm:rounded-ot border border-hairline shadow-whisper">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-hairline">
          <div>
            <h2 className="text-[16px] font-extrabold">Break it into trades</h2>
            <p className="text-[12.5px] text-slate-600 mt-0.5">
              Type an amount against the trades you care about. Empty rows stay off the plan.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-11 h-11 grid place-items-center rounded-ot-sm text-slate-500 hover:bg-canvas" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {list.map((trade) => (
            <label key={trade.id} className="flex items-center gap-3">
              <span className="flex-1 text-[13px] font-medium text-ink">{trade.name}</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="—"
                value={amounts[trade.id] || ''}
                onChange={(event) => setAmounts((current) => ({ ...current, [trade.id]: event.target.value }))}
                className="w-[120px] px-2 py-1.5 rounded-ot-sm border border-hairline text-right tabular text-[13px]"
              />
            </label>
          ))}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              value={newTrade}
              onChange={(event) => setNewTrade(event.target.value)}
              placeholder="Add another trade"
              className="flex-1 px-2 py-1.5 rounded-ot-sm border border-hairline text-[13px]"
            />
            <button type="button" onClick={handleAddTrade} disabled={busy} className="text-[13px] font-bold text-accent">
              Add
            </button>
          </div>
          <div className="flex items-center justify-between text-[13px] pt-1">
            <span className="text-slate-600">These trades</span>
            <span className="tabular font-bold">{formatCents(sum, { whole: false })}</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-slate-600">Target</span>
            <span className="tabular font-bold">{formatCents(plan.targetCents, { whole: false })}</span>
          </div>
          {difference !== 0 ? (
            <label className="flex items-start gap-2 text-[12.5px] text-slate-600">
              <input
                type="checkbox"
                checked={updateTarget}
                onChange={(event) => setUpdateTarget(event.target.checked)}
                className="mt-0.5"
              />
              Use {formatCents(sum, { whole: false })} as the new target
              ({formatCents(Math.abs(difference), { whole: false })} {difference > 0 ? 'over' : 'under'} the current one).
            </label>
          ) : null}
          {error ? <p className="text-[12.5px] text-neg">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 text-[13px] text-slate-600">Cancel</button>
            <button type="submit" disabled={busy} className="px-3.5 py-2 rounded-ot-sm bg-accent text-white text-[13px] font-bold disabled:opacity-50">
              {busy ? 'Saving…' : 'Save trades'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
