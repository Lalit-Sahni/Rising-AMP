import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, DollarSign } from 'lucide-react';

const ExpenseBarChart = ({ expenses = [], timeGrouping = 'week' }) => {
  // Helper function to get expense total
  const getExpenseTotal = (expense) => {
    if (expense.total !== undefined) return expense.total;
    if (expense.amount !== undefined) return expense.amount;
    if (expense.cost !== undefined) return expense.cost;
    
    // For labour expenses, calculate from hours and rate
    if (expense.category === 'labour' && expense.hours && expense.rate) {
      return parseFloat(expense.hours) * parseFloat(expense.rate);
    }
    
    // For equipment expenses, calculate from daily cost and dates
    if (expense.category === 'equipment' && expense.dailyCost && expense.startDate && expense.endDate) {
      const start = new Date(expense.startDate);
      const end = new Date(expense.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return days * parseFloat(expense.dailyCost);
    }
    
    return 0;
  };

  // Helper function to validate date
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };

  // Helper function to get date key based on grouping
  const getDateKey = (dateString, groupBy = 'week') => {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date in ExpenseBarChart:', dateString);
      return null;
    }
    
    try {
      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          return weekStart.toISOString().split('T')[0];
        case 'month':
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        case 'day':
          return date.toISOString().split('T')[0];
        default:
          return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error processing date in ExpenseBarChart:', dateString, error);
      return null;
    }
  };

  // Process data for chart
  const processChartData = () => {
    if (!expenses || expenses.length === 0) return [];

    let skippedExpenses = 0;
    const groupedData = expenses.reduce((acc, expense) => {
      // Skip expenses with missing or invalid timestamps
      if (!expense.timestamp || !isValidDate(expense.timestamp)) {
        console.warn('Skipping expense with invalid timestamp:', expense);
        skippedExpenses++;
        return acc;
      }

      const dateKey = getDateKey(expense.timestamp, timeGrouping);
      
      // Skip if dateKey is null (invalid date)
      if (!dateKey) {
        console.warn('Skipping expense with invalid date key:', expense);
        skippedExpenses++;
        return acc;
      }

      const total = getExpenseTotal(expense);
      
      if (!acc[dateKey]) {
        acc[dateKey] = { 
          date: dateKey, 
          amount: 0,
          count: 0
        };
      }
      
      acc[dateKey].amount += isNaN(total) ? 0 : total;
      acc[dateKey].count += 1;
      
      return acc;
    }, {});

    // Log summary of skipped expenses
    if (skippedExpenses > 0) {
      console.warn(`ExpenseBarChart: Skipped ${skippedExpenses} expenses with invalid timestamps out of ${expenses.length} total`);
    }

    // Convert to array and sort by date
    const chartData = Object.values(groupedData)
      .sort((a, b) => {
        try {
          return new Date(a.date) - new Date(b.date);
        } catch (error) {
          console.error('Error sorting chart data:', error);
          return 0;
        }
      })
      .slice(-8); // Show last 8 periods

    return chartData;
  };

  const chartData = processChartData();

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date for formatting in ExpenseBarChart:', dateString);
        return 'Invalid Date';
      }
      
      switch (timeGrouping) {
        case 'week':
          return `Week ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        case 'month':
          return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        case 'day':
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        default:
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      console.error('Error formatting date in ExpenseBarChart:', dateString, error);
      return 'Invalid Date';
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      try {
        return (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
            <p className="text-gray-300 font-medium">{formatDate(label)}</p>
            <p className="text-green-400 font-semibold">
              ${payload[0].value.toLocaleString()}
            </p>
            <p className="text-gray-400 text-sm">
              {payload[0].payload.count} expense{payload[0].payload.count !== 1 ? 's' : ''}
            </p>
          </div>
        );
      } catch (error) {
        console.error('Error rendering tooltip in ExpenseBarChart:', error);
        return (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
            <p className="text-gray-300 font-medium">Error</p>
            <p className="text-red-400 font-semibold">Unable to display data</p>
          </div>
        );
      }
    }
    return null;
  };

  try {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Expense Trends</h3>
              <p className="text-sm text-slate-400">
                {timeGrouping === 'week' ? 'Weekly' : timeGrouping === 'month' ? 'Monthly' : 'Daily'} spending
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <Calendar className="w-4 h-4" />
            <span className="text-sm capitalize">{timeGrouping}</span>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="amount" 
                  fill="#3B82F6" 
                  radius={[4, 4, 0, 0]}
                  stroke="#1D4ED8"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No Expense Data Available</p>
              <p className="text-sm">
                {expenses && expenses.length > 0 
                  ? "All expenses have invalid timestamps or no valid data to display."
                  : "Add some expenses to see spending trends"
                }
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        {chartData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                Total: ${chartData.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}
              </span>
              <span className="text-slate-400">
                Avg: ${(chartData.reduce((sum, item) => sum + (item.amount || 0), 0) / chartData.length).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error('Error rendering ExpenseBarChart:', error);
    return (
      <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Expense Trends</h3>
              <p className="text-sm text-red-400">Chart Error</p>
            </div>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold mb-2 text-red-400">Chart Error</p>
            <p className="text-sm">Unable to display expense trends due to data issues</p>
          </div>
        </div>
      </div>
    );
  }
};

export default ExpenseBarChart; 
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, DollarSign } from 'lucide-react';

const ExpenseBarChart = ({ expenses = [], timeGrouping = 'week' }) => {
  // Helper function to get expense total
  const getExpenseTotal = (expense) => {
    if (expense.total !== undefined) return expense.total;
    if (expense.amount !== undefined) return expense.amount;
    if (expense.cost !== undefined) return expense.cost;
    
    // For labour expenses, calculate from hours and rate
    if (expense.category === 'labour' && expense.hours && expense.rate) {
      return parseFloat(expense.hours) * parseFloat(expense.rate);
    }
    
    // For equipment expenses, calculate from daily cost and dates
    if (expense.category === 'equipment' && expense.dailyCost && expense.startDate && expense.endDate) {
      const start = new Date(expense.startDate);
      const end = new Date(expense.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return days * parseFloat(expense.dailyCost);
    }
    
    return 0;
  };

  // Helper function to validate date
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };

  // Helper function to get date key based on grouping
  const getDateKey = (dateString, groupBy = 'week') => {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date in ExpenseBarChart:', dateString);
      return null;
    }
    
    try {
      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          return weekStart.toISOString().split('T')[0];
        case 'month':
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        case 'day':
          return date.toISOString().split('T')[0];
        default:
          return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error processing date in ExpenseBarChart:', dateString, error);
      return null;
    }
  };

  // Process data for chart
  const processChartData = () => {
    if (!expenses || expenses.length === 0) return [];

    let skippedExpenses = 0;
    const groupedData = expenses.reduce((acc, expense) => {
      // Skip expenses with missing or invalid timestamps
      if (!expense.timestamp || !isValidDate(expense.timestamp)) {
        console.warn('Skipping expense with invalid timestamp:', expense);
        skippedExpenses++;
        return acc;
      }

      const dateKey = getDateKey(expense.timestamp, timeGrouping);
      
      // Skip if dateKey is null (invalid date)
      if (!dateKey) {
        console.warn('Skipping expense with invalid date key:', expense);
        skippedExpenses++;
        return acc;
      }

      const total = getExpenseTotal(expense);
      
      if (!acc[dateKey]) {
        acc[dateKey] = { 
          date: dateKey, 
          amount: 0,
          count: 0
        };
      }
      
      acc[dateKey].amount += isNaN(total) ? 0 : total;
      acc[dateKey].count += 1;
      
      return acc;
    }, {});

    // Log summary of skipped expenses
    if (skippedExpenses > 0) {
      console.warn(`ExpenseBarChart: Skipped ${skippedExpenses} expenses with invalid timestamps out of ${expenses.length} total`);
    }

    // Convert to array and sort by date
    const chartData = Object.values(groupedData)
      .sort((a, b) => {
        try {
          return new Date(a.date) - new Date(b.date);
        } catch (error) {
          console.error('Error sorting chart data:', error);
          return 0;
        }
      })
      .slice(-8); // Show last 8 periods

    return chartData;
  };

  const chartData = processChartData();

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date for formatting in ExpenseBarChart:', dateString);
        return 'Invalid Date';
      }
      
      switch (timeGrouping) {
        case 'week':
          return `Week ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        case 'month':
          return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        case 'day':
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        default:
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      console.error('Error formatting date in ExpenseBarChart:', dateString, error);
      return 'Invalid Date';
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      try {
        return (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
            <p className="text-gray-300 font-medium">{formatDate(label)}</p>
            <p className="text-green-400 font-semibold">
              ${payload[0].value.toLocaleString()}
            </p>
            <p className="text-gray-400 text-sm">
              {payload[0].payload.count} expense{payload[0].payload.count !== 1 ? 's' : ''}
            </p>
          </div>
        );
      } catch (error) {
        console.error('Error rendering tooltip in ExpenseBarChart:', error);
        return (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
            <p className="text-gray-300 font-medium">Error</p>
            <p className="text-red-400 font-semibold">Unable to display data</p>
          </div>
        );
      }
    }
    return null;
  };

  try {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Expense Trends</h3>
              <p className="text-sm text-slate-400">
                {timeGrouping === 'week' ? 'Weekly' : timeGrouping === 'month' ? 'Monthly' : 'Daily'} spending
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <Calendar className="w-4 h-4" />
            <span className="text-sm capitalize">{timeGrouping}</span>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="amount" 
                  fill="#3B82F6" 
                  radius={[4, 4, 0, 0]}
                  stroke="#1D4ED8"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No Expense Data Available</p>
              <p className="text-sm">
                {expenses && expenses.length > 0 
                  ? "All expenses have invalid timestamps or no valid data to display."
                  : "Add some expenses to see spending trends"
                }
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        {chartData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                Total: ${chartData.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}
              </span>
              <span className="text-slate-400">
                Avg: ${(chartData.reduce((sum, item) => sum + (item.amount || 0), 0) / chartData.length).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error('Error rendering ExpenseBarChart:', error);
    return (
      <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Expense Trends</h3>
              <p className="text-sm text-red-400">Chart Error</p>
            </div>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold mb-2 text-red-400">Chart Error</p>
            <p className="text-sm">Unable to display expense trends due to data issues</p>
          </div>
        </div>
      </div>
    );
  }
};

export default ExpenseBarChart; 
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Calendar, DollarSign } from 'lucide-react';

const ExpenseBarChart = ({ expenses = [], timeGrouping = 'week' }) => {
  // Helper function to get expense total
  const getExpenseTotal = (expense) => {
    if (expense.total !== undefined) return expense.total;
    if (expense.amount !== undefined) return expense.amount;
    if (expense.cost !== undefined) return expense.cost;
    
    // For labour expenses, calculate from hours and rate
    if (expense.category === 'labour' && expense.hours && expense.rate) {
      return parseFloat(expense.hours) * parseFloat(expense.rate);
    }
    
    // For equipment expenses, calculate from daily cost and dates
    if (expense.category === 'equipment' && expense.dailyCost && expense.startDate && expense.endDate) {
      const start = new Date(expense.startDate);
      const end = new Date(expense.endDate);
      const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      return days * parseFloat(expense.dailyCost);
    }
    
    return 0;
  };

  // Helper function to validate date
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };

  // Helper function to get date key based on grouping
  const getDateKey = (dateString, groupBy = 'week') => {
    const date = new Date(dateString);
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date in ExpenseBarChart:', dateString);
      return null;
    }
    
    try {
      switch (groupBy) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          return weekStart.toISOString().split('T')[0];
        case 'month':
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        case 'day':
          return date.toISOString().split('T')[0];
        default:
          return date.toISOString().split('T')[0];
      }
    } catch (error) {
      console.error('Error processing date in ExpenseBarChart:', dateString, error);
      return null;
    }
  };

  // Process data for chart
  const processChartData = () => {
    if (!expenses || expenses.length === 0) return [];

    let skippedExpenses = 0;
    const groupedData = expenses.reduce((acc, expense) => {
      // Skip expenses with missing or invalid timestamps
      if (!expense.timestamp || !isValidDate(expense.timestamp)) {
        console.warn('Skipping expense with invalid timestamp:', expense);
        skippedExpenses++;
        return acc;
      }

      const dateKey = getDateKey(expense.timestamp, timeGrouping);
      
      // Skip if dateKey is null (invalid date)
      if (!dateKey) {
        console.warn('Skipping expense with invalid date key:', expense);
        skippedExpenses++;
        return acc;
      }

      const total = getExpenseTotal(expense);
      
      if (!acc[dateKey]) {
        acc[dateKey] = { 
          date: dateKey, 
          amount: 0,
          count: 0
        };
      }
      
      acc[dateKey].amount += isNaN(total) ? 0 : total;
      acc[dateKey].count += 1;
      
      return acc;
    }, {});

    // Log summary of skipped expenses
    if (skippedExpenses > 0) {
      console.warn(`ExpenseBarChart: Skipped ${skippedExpenses} expenses with invalid timestamps out of ${expenses.length} total`);
    }

    // Convert to array and sort by date
    const chartData = Object.values(groupedData)
      .sort((a, b) => {
        try {
          return new Date(a.date) - new Date(b.date);
        } catch (error) {
          console.error('Error sorting chart data:', error);
          return 0;
        }
      })
      .slice(-8); // Show last 8 periods

    return chartData;
  };

  const chartData = processChartData();

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date for formatting in ExpenseBarChart:', dateString);
        return 'Invalid Date';
      }
      
      switch (timeGrouping) {
        case 'week':
          return `Week ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        case 'month':
          return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        case 'day':
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        default:
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      console.error('Error formatting date in ExpenseBarChart:', dateString, error);
      return 'Invalid Date';
    }
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      try {
        return (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
            <p className="text-gray-300 font-medium">{formatDate(label)}</p>
            <p className="text-green-400 font-semibold">
              ${payload[0].value.toLocaleString()}
            </p>
            <p className="text-gray-400 text-sm">
              {payload[0].payload.count} expense{payload[0].payload.count !== 1 ? 's' : ''}
            </p>
          </div>
        );
      } catch (error) {
        console.error('Error rendering tooltip in ExpenseBarChart:', error);
        return (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
            <p className="text-gray-300 font-medium">Error</p>
            <p className="text-red-400 font-semibold">Unable to display data</p>
          </div>
        );
      }
    }
    return null;
  };

  try {
    return (
      <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Expense Trends</h3>
              <p className="text-sm text-slate-400">
                {timeGrouping === 'week' ? 'Weekly' : timeGrouping === 'month' ? 'Monthly' : 'Daily'} spending
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-slate-400">
            <Calendar className="w-4 h-4" />
            <span className="text-sm capitalize">{timeGrouping}</span>
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="amount" 
                  fill="#3B82F6" 
                  radius={[4, 4, 0, 0]}
                  stroke="#1D4ED8"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-semibold mb-2">No Expense Data Available</p>
              <p className="text-sm">
                {expenses && expenses.length > 0 
                  ? "All expenses have invalid timestamps or no valid data to display."
                  : "Add some expenses to see spending trends"
                }
              </p>
            </div>
          </div>
        )}

        {/* Summary */}
        {chartData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">
                Total: ${chartData.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString()}
              </span>
              <span className="text-slate-400">
                Avg: ${(chartData.reduce((sum, item) => sum + (item.amount || 0), 0) / chartData.length).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error('Error rendering ExpenseBarChart:', error);
    return (
      <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-100">Expense Trends</h3>
              <p className="text-sm text-red-400">Chart Error</p>
            </div>
          </div>
        </div>
        <div className="h-64 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold mb-2 text-red-400">Chart Error</p>
            <p className="text-sm">Unable to display expense trends due to data issues</p>
          </div>
        </div>
      </div>
    );
  }
};

export default ExpenseBarChart; 