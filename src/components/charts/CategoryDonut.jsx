import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PieChart as PieIcon } from 'lucide-react';

const COLORS = {
  Labour: '#3b82f6',
  Trade: '#8b5cf6', 
  Equipment: '#10b981',
  Service: '#f59e0b',
  Materials: '#ef4444'
};

const CategoryDonut = ({ categoryData = [], onSelectCategory }) => {
  const [activeIndex, setActiveIndex] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Process data and add colors
  const processedData = React.useMemo(() => {
    if (!categoryData.length) {
      // Dummy data for testing
      return [
        { category: 'Labour', amount: 15000, percentage: 30 },
        { category: 'Trade', amount: 20000, percentage: 40 },
        { category: 'Equipment', amount: 7500, percentage: 15 },
        { category: 'Service', amount: 5000, percentage: 10 },
        { category: 'Materials', amount: 2500, percentage: 5 }
      ];
    }

    const total = categoryData.reduce((sum, item) => sum + item.amount, 0);
    return categoryData.map(item => ({
      ...item,
      percentage: total > 0 ? ((item.amount / total) * 100) : 0
    }));
  }, [categoryData]);

  const totalAmount = processedData.reduce((sum, item) => sum + item.amount, 0);

  // Handle pie slice click
  const onPieClick = (data, index) => {
    const category = data.category;
    setSelectedCategory(selectedCategory === category ? null : category);
    if (onSelectCategory) {
      onSelectCategory(selectedCategory === category ? null : category);
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 shadow-xl">
          <p className="text-slate-100 font-semibold">{data.category}</p>
          <p className="text-blue-400 text-lg font-bold">
            ${data.amount.toLocaleString()}
          </p>
          <p className="text-slate-300 text-sm">
            {data.percentage.toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom legend component
  const CustomLegend = () => (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-100 mb-4">Categories</h3>
      {processedData.map((entry, index) => (
        <div
          key={entry.category}
          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all duration-200 ${
            selectedCategory === entry.category
              ? 'bg-slate-600 ring-2 ring-blue-500'
              : 'hover:bg-slate-700'
          }`}
          onClick={() => onPieClick(entry, index)}
        >
          <div className="flex items-center space-x-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: COLORS[entry.category] }}
            />
            <span className="text-slate-300 font-medium">{entry.category}</span>
          </div>
          <div className="text-right">
            <div className="text-slate-100 font-semibold">
              ${entry.amount.toLocaleString()}
            </div>
            <div className="text-slate-400 text-sm">
              {entry.percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-slate-800 rounded-xl p-4 shadow">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-6">
        <PieIcon className="w-5 h-5 text-purple-400" />
        <h2 className="text-xl font-semibold text-slate-100">Category Breakdown</h2>
      </div>

      {processedData.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Donut Chart */}
          <div className="relative">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={processedData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    dataKey="amount"
                    animationDuration={800}
                    animationEasing="ease-out"
                    onClick={onPieClick}
                    onMouseEnter={(_, index) => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    {processedData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[entry.category]}
                        stroke={selectedCategory === entry.category ? '#ffffff' : 'none'}
                        strokeWidth={selectedCategory === entry.category ? 3 : 0}
                        style={{
                          filter: activeIndex === index ? 'brightness(1.1)' : 'brightness(1)',
                          transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                          transformOrigin: 'center',
                          transition: 'all 0.2s ease-in-out',
                          cursor: 'pointer'
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-bold text-slate-100">
                ${(totalAmount / 1000).toFixed(0)}k
              </div>
              <div className="text-slate-400 text-sm">Total Spent</div>
            </div>
          </div>

          {/* Custom Legend */}
          <div className="lg:pl-4">
            <CustomLegend />
            
            {selectedCategory && (
              <div className="mt-4 p-3 bg-slate-700 rounded-lg border border-blue-500">
                <p className="text-blue-400 text-sm font-medium">
                  📌 Filtered by: {selectedCategory}
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    onSelectCategory && onSelectCategory(null);
                  }}
                  className="text-slate-300 hover:text-white text-xs mt-1 underline"
                >
                  Clear filter
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400">
          <PieIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No category data available</p>
        </div>
      )}
    </div>
  );
};

export default CategoryDonut; 