import React, { useMemo, useState } from 'react';
import {
  NOT_IN_ESTIMATE_TRADE_ID,
  activeTrades,
  expenseTradeId,
  suggestTradeForExpense,
  tradeNameById,
} from '../../domain/costPlan';
import type { TradeListItem } from '../../domain/schemas';

type ExpenseTradePickerProps = {
  expense: Record<string, unknown>;
  expenses?: Array<Record<string, unknown>>;
  trades?: TradeListItem[];
  disabled?: boolean;
  compact?: boolean;
  onCode: (tradeId: string | null) => Promise<void> | void;
};

export default function ExpenseTradePicker({
  expense,
  expenses = [],
  trades = [],
  disabled = false,
  compact = false,
  onCode,
}: ExpenseTradePickerProps) {
  const [busy, setBusy] = useState(false);
  const options = useMemo(() => activeTrades(trades), [trades]);
  const current = expenseTradeId(expense);
  const suggestion = useMemo(
    () => suggestTradeForExpense(expense, options, expenses),
    [expense, options, expenses],
  );

  const handleChange = async (value: string) => {
    const next = value === '' ? null : value;
    if (next === current) return;
    setBusy(true);
    try {
      await onCode(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? '' : 'space-y-1.5'} onClick={(event) => event.stopPropagation()}>
      <select
        value={current || ''}
        disabled={disabled || busy}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full min-h-[36px] px-2 py-1.5 rounded-ot-sm border border-hairline bg-surface text-[12.5px] text-ink"
        aria-label="Cost plan trade"
      >
        <option value="">Uncoded</option>
        {suggestion && suggestion.id !== current ? (
          <option value={suggestion.id}>
            {suggestion.name} (suggested)
          </option>
        ) : null}
        {options.map((trade) => (
          <option key={trade.id} value={trade.id}>{trade.name}</option>
        ))}
        <option value={NOT_IN_ESTIMATE_TRADE_ID}>Not in the estimate</option>
      </select>
      {compact && current ? (
        <div className="sr-only">{tradeNameById(options, current)}</div>
      ) : null}
    </div>
  );
}
