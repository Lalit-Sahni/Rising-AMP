import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { todayYmd } from '../../dates';
import { parseToCents, fromCents, formatCents } from '../../money';
import { convertGstCents } from '../../domain/costPlan';
import { saveCostPlanTarget } from '../../firebase/costPlan';
import { queryKeys } from '../../query/client';
import type { CostPlan } from '../../domain/schemas';

type SetTargetCostSheetProps = {
  open: boolean;
  orgId: string;
  jobId: string;
  jobName?: string;
  userId: string;
  plan?: CostPlan | null;
  onClose: () => void;
  onSaved: (plan: CostPlan) => void;
  showToast: (message: string, type?: string) => void;
};

export default function SetTargetCostSheet({
  open,
  orgId,
  jobId,
  jobName,
  userId,
  plan,
  onClose,
  onSaved,
  showToast,
}: SetTargetCostSheetProps) {
  const queryClient = useQueryClient();
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState('');
  const [addGst, setAddGst] = useState(false);
  const [baselineDate, setBaselineDate] = useState(todayYmd());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount(plan ? fromCents(plan.targetCents).toFixed(2) : '');
    setAddGst(false);
    setBaselineDate(plan?.baselineDate || todayYmd());
    setError('');
    window.setTimeout(() => amountRef.current?.focus(), 0);
  }, [open, plan]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  let withGstLabel = '';
  if (addGst) {
    try {
      const parsed = parseToCents(amount);
      if (parsed > 0) withGstLabel = formatCents(convertGstCents(parsed, 'exclusive', 'inclusive'));
    } catch {
      withGstLabel = '';
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    let targetCents: number;
    try {
      targetCents = parseToCents(amount);
    } catch {
      setError('Enter a valid target cost.');
      return;
    }
    if (addGst) {
      targetCents = convertGstCents(targetCents, 'exclusive', 'inclusive');
    }
    if (targetCents <= 0) {
      setError('Target cost must be more than zero.');
      return;
    }
    if (!baselineDate) {
      setError('Choose the date this target starts from.');
      return;
    }

    setBusy(true);
    try {
      const saved = await saveCostPlanTarget(jobId, {
        targetCents,
        baselineDate,
        createdBy: userId,
        gstMode: 'inclusive',
      });
      queryClient.setQueryData(queryKeys.costPlan(orgId, jobId), saved);
      showToast(plan ? 'Target cost updated.' : 'Cost plan started.', 'success');
      onSaved(saved);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Could not save the target cost';
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-steel-900/50"
        aria-label="Close target cost"
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="target-cost-title"
        onSubmit={handleSubmit}
        className="relative w-full md:max-w-md bg-surface rounded-t-ot md:rounded-ot border border-hairline shadow-whisper px-4 pt-4 pb-4 md:mx-4 safe-area-bottom"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="target-cost-title" className="text-[15px] font-extrabold text-ink">
              {plan ? 'Edit target cost' : 'Set a target cost'}
            </h2>
            <p className="text-[12.5px] text-slate-400 mt-0.5">{jobName || 'This job'}</p>
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

        <p className="text-[13px] text-slate-600 mt-3">
          Use the rough total you expect this job to cost. You can break it into trades later.
        </p>

        <label className="block text-[12.5px] font-semibold text-slate-600 mt-4">
          Target cost{addGst ? ', before GST' : ', including GST'}
          <span className="relative block mt-1">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">$</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={busy}
              placeholder="340,000"
              className="w-full min-h-[44px] pl-7 pr-3 rounded-ot-sm border border-hairline text-[15px] tabular text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </span>
        </label>

        <label className="flex items-start gap-2 text-[12.5px] font-medium text-slate-600 mt-3">
          <input
            type="checkbox"
            checked={addGst}
            onChange={(event) => setAddGst(event.target.checked)}
            disabled={busy}
            className="mt-0.5"
          />
          Add GST (10%). Tick this when the number you typed is ex GST.
        </label>
        {withGstLabel ? (
          <p className="text-[12.5px] text-slate-600 mt-1">This will save {withGstLabel} including GST.</p>
        ) : null}

        <label className="block text-[12.5px] font-semibold text-slate-600 mt-3">
          Baseline date
          <input
            type="date"
            value={baselineDate}
            onChange={(event) => setBaselineDate(event.target.value)}
            disabled={busy}
            className="mt-1 w-full min-h-[44px] px-3 rounded-ot-sm border border-hairline text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          />
        </label>

        {error ? <p className="text-[12.5px] text-neg mt-3" role="alert">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[44px] mt-4 inline-flex items-center justify-center rounded-ot-sm bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-[13px] font-bold"
        >
          {busy ? 'Saving…' : plan ? 'Save target' : 'Start cost plan'}
        </button>
      </form>
    </div>
  );
}
