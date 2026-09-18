import React, { useMemo, useState } from 'react';
import { EXPENSE_CATEGORIES, normalizeExpenseCategory } from '../../domain/expenseCategory';
import { getCategoryStyle } from '../../utils/categoryStyle';
import QuietSelect, { type QuietSelectOption } from '../ui/QuietSelect';

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

  const options = useMemo<QuietSelectOption[]>(() => {
    const extras = current && !EXPENSE_CATEGORIES.includes(current as (typeof EXPENSE_CATEGORIES)[number])
      ? [current]
      : [];
    return [...extras, ...EXPENSE_CATEGORIES].map((key) => {
      const style = getCategoryStyle(key);
      return { value: key, label: style.label, color: style.hex };
    });
  }, [current]);

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
    <QuietSelect
      value={current || ''}
      options={options}
      disabled={disabled || busy}
      compact={compact}
      ariaLabel="Expense category"
      title="Category"
      placeholder="Choose a category"
      onChange={(value) => void handleChange(value)}
    />
  );
}
