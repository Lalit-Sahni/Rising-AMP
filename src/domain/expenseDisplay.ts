import { expenseDate } from '../utils/jobMetrics';

function firstText(expense: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = String(expense[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

/** Human label for an expense row. Uses the same fields History does, with a real fallback. */
export function expenseDisplayName(expense: Record<string, unknown> | null | undefined): string {
  if (!expense) return 'Expense';
  const category = String(expense.category || '').toLowerCase().trim();
  switch (category) {
    case 'labour':
      return firstText(expense, ['workerName']) || 'Labour';
    case 'trade':
      return firstText(expense, ['tradeName', 'trade', 'task']) || 'Trade';
    case 'equipment':
      return firstText(expense, ['equipmentName']) || 'Equipment';
    case 'purchase':
      return firstText(expense, ['itemName', 'description']) || 'Purchase';
    case 'service':
      return firstText(expense, ['serviceName', 'itemName']) || 'Service';
    case 'installation':
      return firstText(expense, ['item', 'itemName']) || 'Installation';
    case 'investor':
      return firstText(expense, ['itemName', 'serviceName', 'description', 'notes']) || 'Investor';
    default:
      return firstText(expense, [
        'itemName',
        'description',
        'tradeName',
        'supplier',
        'workerName',
        'serviceName',
        'equipmentName',
        'notes',
      ]) || (category ? category : 'Expense');
  }
}

export function formatExpenseDay(expense: Record<string, unknown> | null | undefined): string {
  const dated = expenseDate(expense);
  if (!dated) return '';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(dated);
}
