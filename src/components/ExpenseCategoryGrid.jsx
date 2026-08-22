import React, { useMemo } from 'react';
import { User, Wrench, HardHat, FileText, Package, Camera, Download, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { categoryIconWell, getCategoryStyle } from '../utils/categoryStyle';

const categories = [
  { key: 'labour', label: 'Labour', icon: User, description: 'Worker wages & hourly rates' },
  { key: 'trade', label: 'Trade', icon: Wrench, description: 'Contractor & specialist work' },
  { key: 'equipment', label: 'Equipment', icon: HardHat, description: 'Tools & machinery rental' },
  { key: 'service', label: 'Service', icon: FileText, description: 'Professional services' },
  { key: 'purchase', label: 'Materials', icon: Package, description: 'Supplies & raw materials' },
];

function isThisMonth(timestamp) {
  const expenseDate = new Date(timestamp);
  const now = new Date();
  return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
}

const ExpenseCategoryGrid = ({ onCategorySelect, onQuickAction, selectedCategory }) => {
  const { expenses } = useApp();

  const categoryStats = useMemo(() => {
    return categories.map((category) => {
      const categoryExpenses = expenses.filter((e) => e.category === category.key);
      const thisMonthExpenses = categoryExpenses.filter((e) => isThisMonth(e.timestamp));
      return {
        ...category,
        ...getCategoryStyle(category.key),
        totalEntries: categoryExpenses.length,
        thisMonthEntries: thisMonthExpenses.length,
      };
    });
  }, [expenses]);

  const quickActions = [
    { key: 'scan', label: 'Scan invoice', icon: Camera, description: 'Use camera to capture receipt', action: () => onQuickAction('scan') },
    { key: 'import', label: 'Import CSV', icon: Download, description: 'Bulk import from spreadsheet', action: () => onQuickAction('import') },
    { key: 'quick', label: 'Quick entry', icon: Zap, description: 'Fast expense entry form', action: () => onQuickAction('quick') },
  ];

  return (
    <div className="space-y-[22px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {categoryStats.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.key;
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => onCategorySelect(category.key)}
              className={`pressable text-left bg-surface border rounded-ot p-[17px] shadow-whisper ${
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
                  <p className="text-[11.5px] text-slate-400 truncate">{category.description}</p>
                </div>
              </div>
              <div className="flex justify-between mt-3.5 pt-3 border-t border-hairline">
                <div>
                  <div className="text-[11px] text-slate-400">Total</div>
                  <div className="tabular text-base font-bold text-ink">{category.totalEntries}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">This month</div>
                  <div className={`tabular text-base font-bold ${category.thisMonthEntries > 0 ? 'text-accent' : 'text-ink'}`}>
                    {category.thisMonthEntries}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-bold mb-3">Quick actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {quickActions.map((action) => {
            const ActionIcon = action.icon;
            return (
              <button
                key={action.key}
                type="button"
                onClick={action.action}
                className="pressable flex items-center gap-3 text-left border border-hairline rounded-ot p-[15px] bg-surface shadow-whisper"
              >
                <span className="w-9 h-9 rounded-[9px] bg-canvas border border-hairline grid place-items-center text-ink">
                  <ActionIcon className="w-[17px] h-[17px]" strokeWidth={1.6} />
                </span>
                <span>
                  <h4 className="text-[13.5px] font-bold text-ink">{action.label}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{action.description}</p>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExpenseCategoryGrid;
