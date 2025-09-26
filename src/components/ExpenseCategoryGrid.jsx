import React, { useMemo } from 'react';
import { User, Wrench, HardHat, FileText, DollarSign, Camera, Download, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';

const categories = [
  { 
    key: 'labour', 
    label: 'Labour', 
    icon: User,
    description: 'Worker wages & hourly rates',
    color: 'text-blue-400',
    borderColor: 'border-slate-700',
    bgColor: 'bg-blue-500/20',
    cardBg: 'bg-slate-800',
    cardBorder: 'border-slate-700',
    hoverBg: 'hover:bg-slate-700',
    hoverBorder: 'hover:border-slate-600'
  },
  { 
    key: 'trade', 
    label: 'Trade', 
    icon: Wrench,
    description: 'Contractor & specialist work',
    color: 'text-purple-400',
    borderColor: 'border-slate-700',
    bgColor: 'bg-purple-500/20',
    cardBg: 'bg-slate-800',
    cardBorder: 'border-slate-700',
    hoverBg: 'hover:bg-slate-700',
    hoverBorder: 'hover:border-slate-600'
  },
  { 
    key: 'equipment', 
    label: 'Equipment', 
    icon: HardHat,
    description: 'Tools & machinery rental',
    color: 'text-green-400',
    borderColor: 'border-slate-700',
    bgColor: 'bg-green-500/20',
    cardBg: 'bg-slate-800',
    cardBorder: 'border-slate-700',
    hoverBg: 'hover:bg-slate-700',
    hoverBorder: 'hover:border-slate-600'
  },
  { 
    key: 'service', 
    label: 'Service', 
    icon: FileText,
    description: 'Professional services',
    color: 'text-orange-400',
    borderColor: 'border-slate-700',
    bgColor: 'bg-orange-500/20',
    cardBg: 'bg-slate-800',
    cardBorder: 'border-slate-700',
    hoverBg: 'hover:bg-slate-700',
    hoverBorder: 'hover:border-slate-600'
  },
  { 
    key: 'purchase', 
    label: 'Materials', 
    icon: DollarSign,
    description: 'Supplies & raw materials',
    color: 'text-red-400',
    borderColor: 'border-slate-700',
    bgColor: 'bg-red-500/20',
    cardBg: 'bg-slate-800',
    cardBorder: 'border-slate-700',
    hoverBg: 'hover:bg-slate-700',
    hoverBorder: 'hover:border-slate-600'
  }
];

// Helper function to check if expense is from this month
function isThisMonth(timestamp) {
  const expenseDate = new Date(timestamp);
  const now = new Date();
  return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
}

const ExpenseCategoryGrid = ({ onCategorySelect, onQuickAction, selectedCategory }) => {
  const { expenses } = useApp();

  // Calculate category stats
  const categoryStats = useMemo(() => {
    return categories.map(category => {
      const categoryExpenses = expenses.filter(e => e.category === category.key);
      const thisMonthExpenses = categoryExpenses.filter(e => isThisMonth(e.timestamp));
      
      return {
        ...category,
        totalEntries: categoryExpenses.length,
        thisMonthEntries: thisMonthExpenses.length
      };
    });
  }, [expenses]);

  const quickActions = [
    {
      key: 'scan',
      label: 'Scan Invoice',
      icon: Camera,
      description: 'Use camera to capture receipt',
      action: () => onQuickAction('scan'),
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      iconBg: 'bg-emerald-500/20',
      hoverBg: 'hover:bg-emerald-500/20',
      hoverBorder: 'hover:border-emerald-500/50'
    },
    {
      key: 'import',
      label: 'Import CSV',
      icon: Download,
      description: 'Bulk import from spreadsheet',
      action: () => onQuickAction('import'),
      color: 'text-indigo-400',
      bgColor: 'bg-slate-800',
      borderColor: 'border-slate-700',
      iconBg: 'bg-indigo-500/20',
      hoverBg: 'hover:bg-slate-700',
      hoverBorder: 'hover:border-slate-600'
    },
    {
      key: 'quick',
      label: 'Quick Entry',
      icon: Zap,
      description: 'Fast expense entry form',
      action: () => onQuickAction('quick'),
      color: 'text-yellow-400',
      bgColor: 'bg-slate-800',
      borderColor: 'border-slate-700',
      iconBg: 'bg-yellow-500/20',
      hoverBg: 'hover:bg-slate-700',
      hoverBorder: 'hover:border-slate-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Colorful Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categoryStats.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.key;
          
          return (
            <div
              key={category.key}
              onClick={() => onCategorySelect(category.key)}
              className={`
                cursor-pointer border rounded-lg p-4 transition-all duration-200
                ${category.cardBg} ${category.cardBorder}
                ${category.hoverBg} ${category.hoverBorder}
                ${isSelected ? 'ring-2 ring-blue-500 bg-slate-600/30' : ''}
              `}
              tabIndex={0}
              role="button"
              aria-label={`Select ${category.label} category`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onCategorySelect(category.key);
                }
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg ${category.bgColor} flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${category.color}`} />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">
                    {category.label}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {category.description}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Total</span>
                <span className={`text-sm font-medium ${category.color}`}>
                  {category.totalEntries}
                </span>
              </div>
              
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-slate-500">This Month</span>
                <span className="text-sm font-medium text-green-400">
                  {category.thisMonthEntries}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Colorful Quick Actions */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
            <Zap className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
            <p className="text-sm text-slate-400">Alternative expense entry methods</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const ActionIcon = action.icon;
            
            return (
              <button
                key={action.key}
                onClick={action.action}
                className={`
                  text-left border rounded-lg p-4 transition-all duration-200
                  ${action.bgColor} ${action.borderColor}
                  ${action.hoverBg} ${action.hoverBorder}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${action.iconBg} flex items-center justify-center`}>
                    <ActionIcon className={`w-5 h-5 ${action.color}`} />
                  </div>
                  
                  <div>
                    <h4 className="text-white font-medium text-sm">
                      {action.label}
                    </h4>
                    <p className="text-slate-400 text-xs mt-1">
                      {action.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ExpenseCategoryGrid; 