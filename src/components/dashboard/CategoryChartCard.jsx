import React, { useMemo } from 'react';
import { getCategoryStyle } from '../../utils/categoryStyle';

const groupByCategory = (expenses) => {
  const categoryMap = new Map();
  expenses.forEach((expense) => {
    const category = expense.category || expense.tradeName || 'Uncategorized';
    const amount = parseFloat(expense.total || expense.amount || expense.cost || 0);
    const current = categoryMap.get(category) || { value: 0, count: 0 };
    categoryMap.set(category, {
      value: current.value + (amount > 0 ? amount : 0),
      count: current.count + 1,
    });
  });
  return Array.from(categoryMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.value - a.value);
};

const CategoryChartCard = ({ expenses = [], onViewAll }) => {
  const categoryData = useMemo(() => {
    if (!expenses || expenses.length === 0) return [];
    const grouped = groupByCategory(expenses);
    const max = grouped[0]?.value || 1;
    return grouped.slice(0, 6).map((item) => {
      const style = getCategoryStyle(item.name);
      return {
        ...item,
        ...style,
        bar: Math.max(8, (item.value / max) * 100),
      };
    });
  }, [expenses]);

  return (
    <div className="bg-surface border border-hairline rounded-ot p-[18px] shadow-whisper">
      <h3 className="text-sm font-semibold flex items-center justify-between">
        Spending by category
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-[11px] text-accent font-bold uppercase tracking-[0.08em]"
          >
            View all
          </button>
        )}
      </h3>

      {categoryData.length === 0 ? (
        <p className="text-[13px] text-slate-400 mt-4">Add expenses to see a breakdown.</p>
      ) : (
        <div className="mt-1.5">
          {categoryData.map((row) => (
            <div key={row.name} className="flex items-center gap-3 mt-3.5">
              <span className="w-[78px] flex items-center gap-1.5 text-[12.5px] text-slate-600 truncate">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: row.hex }} />
                {row.label}
              </span>
              <span className="flex-1 h-[7px] bg-[#EEF0F2] rounded overflow-hidden">
                <span className="block h-full rounded" style={{ width: `${row.bar}%`, backgroundColor: row.hex }} />
              </span>
              <span className="w-[30px] text-right tabular text-xs text-slate-400">{row.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryChartCard;
