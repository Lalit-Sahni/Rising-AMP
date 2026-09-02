import React, { useState } from 'react';
import { EXPENSE_CATEGORIES, normalizeExpenseCategory } from '../../domain/expenseCategory';
import { getCategoryStyle } from '../../utils/categoryStyle';

type ExpenseCategoryPickerProps = {
  expense: Record<string, unknown>;
  disabled?: boolean;
  compact?: boolean;
  onChange: (category: string) => Promise<void> | void;
};

export default function ExpenseCategoryPicker({
  expense,
  disabled = false,
  compact = false,
  onChange,
}: ExpenseCategoryPickerProps) {
  const [busy, setBusy] = useState(false);
  const current = normalizeExpenseCategory(expense.category) || String(expense.category || '').trim();
  const extras = current && !EXPENSE_CATEGORIES.includes(current as (typeof EXPENSE_CATEGORIES)[number])
    ? [current]
    : [];

  const handleChange = async (value: string) => {
    if (!value || value === current) return;
    setBusy(true);
    try {
      await onChange(value);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? '' : 'space-y-1.5'} onClick={(event) => event.stopPropagation()}>
      <select
        value={current || ''}
        disabled={disabled || busy}
        onChange={(event) => void handleChange(event.target.value)}
        className="w-full min-h-[36px] px-2 py-1.5 rounded-ot-sm border border-hairline bg-surface text-[12.5px] text-ink"
        aria-label="Expense category"
      >
        {!current ? <option value="">Choose a category</option> : null}
        {extras.map((key) => (
          <option key={key} value={key}>{getCategoryStyle(key).label}</option>
        ))}
        {EXPENSE_CATEGORIES.map((key) => (
          <option key={key} value={key}>{getCategoryStyle(key).label}</option>
        ))}
      </select>
    </div>
  );
}
