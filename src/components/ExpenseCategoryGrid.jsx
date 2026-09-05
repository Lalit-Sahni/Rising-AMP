import React, { useMemo } from 'react';
import { User, Wrench, HardHat, FileText, Package, Landmark } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { categoryIconWell, getCategoryStyle } from '../utils/categoryStyle';
import { expenseDate, inCalendarPeriod, isVoidExpense } from '../utils/jobMetrics';

const categories = [
  { key: 'purchase', label: 'Materials', icon: Package, description: 'Supplies and raw materials' },
  { key: 'trade', label: 'Trade', icon: Wrench, description: 'Contractor and specialist work' },
  { key: 'labour', label: 'Labour', icon: User, description: 'Worker wages and hourly rates' },
  { key: 'equipment', label: 'Equipment', icon: HardHat, description: 'Tools and machinery hire' },
  { key: 'service', label: 'Service', icon: FileText, description: 'Professional services' },
  { key: 'investor', label: 'Investor', icon: Landmark, description: 'Land, legal and finance. Not construction.' },
];

const ExpenseCategoryGrid = ({ onCategorySelect, selectedCategory }) => {
  const { expenses } = useApp();

  const categoryStats = useMemo(() => {
    const now = new Date();
    const live = (expenses || []).filter((row) => !isVoidExpense(row));
    return categories.map((category) => {
      const rows = live.filter((row) => row.category === category.key);
      const thisMonth = rows.filter((row) => {
        const dated = expenseDate(row);
        return dated && inCalendarPeriod(dated, 'month', now);
      });
      return {
        ...category,
        ...getCategoryStyle(category.key),
        totalEntries: rows.length,
        thisMonthEntries: thisMonth.length,
      };
    });
  }, [expenses]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-3.5">
      {categoryStats.map((category) => {
        const Icon = category.icon;
        const isSelected = selectedCategory === category.key;
        return (
          <button
            key={category.key}
            type="button"
            onClick={() => onCategorySelect(category.key)}
            className={`pressable text-left bg-surface border rounded-ot p-3.5 md:p-[17px] shadow-whisper ${
              isSelected ? 'border-accent' : 'border-hairline'
            }`}
          >
            <div className="flex items-center gap-[11px]">
              <span
                className="w-[38px] h-[38px] rounded-[9px] grid place-items-center shrink-0"
                style={{ backgroundColor: categoryIconWell(category.hex), color: category.hex }}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: category.hex }} />
                  {category.label}
                </h3>
                <p className="hidden md:block text-[11.5px] text-slate-400 truncate">{category.description}</p>
              </div>
            </div>
            <div className="flex justify-between mt-3 pt-2.5 border-t border-hairline">
              <div>
                <div className="text-[11px] text-slate-400">On this job</div>
                <div className="tabular text-[15px] font-bold text-ink">{category.totalEntries}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-slate-400">This month</div>
                <div className={`tabular text-[15px] font-bold ${category.thisMonthEntries > 0 ? 'text-accent' : 'text-ink'}`}>
                  {category.thisMonthEntries}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ExpenseCategoryGrid;
