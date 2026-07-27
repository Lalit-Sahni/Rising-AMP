import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieChartIcon, Eye, ChevronUp } from 'lucide-react';

// Beautiful gradient colors for the pie chart
const COLORS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Purple gradient
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', // Pink gradient
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Blue gradient
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', // Green gradient
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', // Orange gradient
  'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', // Mint gradient
  'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', // Rose gradient
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', // Peach gradient
];

// Solid colors for fallback and other elements
const SOLID_COLORS = [
  '#667eea', // Purple
  '#f093fb', // Pink
  '#4facfe', // Blue
  '#43e97b', // Green
  '#fa709a', // Orange
  '#a8edea', // Mint
  '#ff9a9e', // Rose
  '#ffecd2', // Peach
];

// Helper function to group expenses by category
const groupByCategory = (expenses) => {
  const categoryMap = new Map();
  
  expenses.forEach(expense => {
    const category = expense.category || expense.tradeName || 'Uncategorized';
    const amount = parseFloat(expense.total || expense.amount || expense.cost || 0);
    
    if (amount > 0) {
      categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
    }
  });
  
  return Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

const CategoryChartCard = ({ expenses = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const categoryData = useMemo(() => {
    if (!expenses || expenses.length === 0) return [];
    
    const grouped = groupByCategory(expenses);
    const total = grouped.reduce((sum, item) => sum + item.value, 0);
    
    return grouped.map((item, index) => ({
      ...item,
      color: COLORS[index % COLORS.length],
      solidColor: SOLID_COLORS[index % SOLID_COLORS.length],
      percentage: total > 0 ? (item.value / total) * 100 : 0
    }));
  }, [expenses]);
  
  const totalExpenses = categoryData.reduce((sum, item) => sum + item.value, 0);
  
  if (expenses.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
              <PieChartIcon className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900">Spending by Category</h3>
              <p className="text-sm text-zinc-500">No expenses found - add some expenses to see the chart!</p>
            </div>
          </div>
          <div className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded-lg">
            <span className="text-xs text-zinc-600 font-medium">0 categories</span>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-zinc-500 mb-4">Start tracking your expenses to see charts here!</p>
          <button 
            onClick={() => window.location.href = '#add-expense'}
            className="px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg transition-colors"
          >
            Add First Expense
          </button>
        </div>
      </div>
    );
  }
  
     return (
     <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm hover:border-zinc-300 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
            <PieChartIcon className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">Spending by Category</h3>
            <p className="text-sm text-zinc-500">
              {isExpanded ? 'Category breakdown' : 'Click to expand'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2 py-1 bg-zinc-100 border border-zinc-200 rounded-lg">
            <span className="text-xs text-zinc-600 font-medium">
              {categoryData.length} categories
            </span>
          </div>
        </div>
      </div>
      
             {/* Chart Container */}
       <div className={`transition-all duration-500 ease-in-out ${
         isExpanded ? 'h-80 mb-6' : 'h-64'
       }`}>
         <ResponsiveContainer width="100%" height="100%">
           <PieChart>
             <defs>
               {categoryData.map((entry, index) => (
                 <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                   <stop offset="0%" stopColor={entry.solidColor} stopOpacity={0.8} />
                   <stop offset="100%" stopColor={entry.solidColor} stopOpacity={1} />
                 </linearGradient>
               ))}
             </defs>
             <Pie
               data={categoryData}
               cx="50%"
               cy="50%"
               labelLine={false}
               label={({ name, percentage, value }) => 
                 isExpanded 
                   ? `${name}\n$${value.toLocaleString()}\n${percentage.toFixed(1)}%`
                   : `${name} ${percentage.toFixed(0)}%`
               }
               outerRadius={isExpanded ? 120 : 80}
               innerRadius={isExpanded ? 40 : 20}
               fill="#8884d8"
               dataKey="value"
               onClick={() => setIsExpanded(!isExpanded)}
               style={{ cursor: 'pointer' }}
               stroke="#e4e4e7"
               strokeWidth={2}
             >
               {categoryData.map((entry, index) => (
                 <Cell 
                   key={`cell-${index}`} 
                   fill={`url(#gradient-${index})`}
                   className="hover:opacity-80 transition-all duration-300 hover:scale-105"
                   style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' }}
                 />
               ))}
             </Pie>
             <Tooltip 
               contentStyle={{ 
                 backgroundColor: '#fff', 
                 border: '1px solid #e4e4e7',
                 borderRadius: '12px',
                 boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                 fontSize: '14px',
                 padding: '12px 16px',
                 color: '#18181b'
               }}
               formatter={(value, name) => [`$${value.toLocaleString()}`, name]}
               labelFormatter={(label) => `${label}`}
             />
           </PieChart>
         </ResponsiveContainer>
       </div>
      
      {/* Category Breakdown Cards */}
      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
        isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {categoryData.map((category, index) => (
                         <div 
               key={index}
               className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 hover:bg-zinc-100 transition-all duration-200 hover:shadow-md"
             >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                                   <div 
                   className="w-3 h-3 rounded-full shadow-sm" 
                   style={{ backgroundColor: category.solidColor }}
                 />
                  <span className="text-zinc-900 font-medium text-sm">{category.name}</span>
                </div>
                <span className="text-zinc-500 text-xs font-medium">
                  {category.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="text-xl font-bold text-zinc-900 mb-2">
                ${category.value.toLocaleString()}
              </div>
              <div className="w-full bg-zinc-200 rounded-full h-1.5">
                                 <div 
                   className="h-1.5 rounded-full transition-all duration-300 shadow-sm"
                   style={{ 
                     width: `${category.percentage}%`,
                     background: category.color
                   }}
                 />
              </div>
            </div>
          ))}
        </div>
        
        {/* Total Summary */}
        <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-zinc-600 font-medium">Total Expenses</span>
            <span className="text-zinc-900 font-bold text-lg">
              ${totalExpenses.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      
      {/* Expand/Collapse Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-lg text-zinc-800 transition-all duration-200 font-medium"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span>Collapse Details</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              <span>Expand Details</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default CategoryChartCard; 