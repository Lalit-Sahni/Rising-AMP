import React, { useMemo, useState } from 'react';
import {
  INVESTOR_TRADE_ID,
  NOT_IN_ESTIMATE_TRADE_ID,
  activeTrades,
  expenseTradeId,
  suggestTradeForExpense,
  tradeNameById,
} from '../../domain/costPlan';
import type { TradeListItem } from '../../domain/schemas';
import QuietSelect, { type QuietSelectOption } from '../ui/QuietSelect';

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

  const selectOptions = useMemo<QuietSelectOption[]>(() => {
    const rows: QuietSelectOption[] = [{ value: '', label: 'Uncoded' }];
    if (suggestion && suggestion.id !== current) {
      rows.push({ value: suggestion.id, label: `${suggestion.name} (suggested)` });
    }
    if (current && current !== NOT_IN_ESTIMATE_TRADE_ID && current !== INVESTOR_TRADE_ID) {
      rows.push({ value: current, label: tradeNameById(trades, current) });
    }
    options.forEach((trade) => {
      rows.push({ value: trade.id, label: trade.name });
    });
    rows.push({ value: NOT_IN_ESTIMATE_TRADE_ID, label: 'Not in the estimate' });
    rows.push({ value: INVESTOR_TRADE_ID, label: 'Investor' });
    return rows;
  }, [suggestion, current, options, trades]);

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
    <QuietSelect
      value={current || ''}
      options={selectOptions}
      disabled={disabled || busy}
      compact={compact}
      ariaLabel="Cost plan trade"
      title="Cost plan"
      placeholder="Uncoded"
      onChange={(value) => void handleChange(value)}
    />
  );
}
