import React, { useState, useMemo, useEffect } from 'react';
import { 
  PlusCircle, 
  FileText, 
  FileCheck,
  TrendingUp, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  Bug,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Target,
  Calendar,
  Building
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import CategoryChartCard from '../dashboard/CategoryChartCard';

// Helper functions
function isValidDate(date) {
  return date instanceof Date && !isNaN(date);
}

function isThisMonth(timestamp) {
  try {
    const now = new Date();
    const expenseDate = new Date(timestamp);
    
    if (!isValidDate(expenseDate)) {
      console.warn('Invalid date in isThisMonth:', timestamp);
      return false;
    }
    
    return expenseDate.getMonth() === now.getMonth() && 
           expenseDate.getFullYear() === now.getFullYear();
  } catch (error) {
    console.error('Error in isThisMonth:', error);
    return false;
  }
}

function getExpenseTotal(expense) {
  if (expense.total) return parseFloat(expense.total);
  if (expense.amount) return parseFloat(expense.amount);
  if (expense.cost) return parseFloat(expense.cost);
  if (expense.quantity && expense.unitCost) {
    return parseFloat(expense.quantity) * parseFloat(expense.unitCost);
  }
  return 0;
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    if (!isValidDate(date)) {
      console.warn('Invalid date in formatDate:', dateString);
      return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error in formatDate:', error);
    return 'Invalid Date';
  }
}

function getDateKey(dateString, groupBy = 'day') {
  try {
    const date = new Date(dateString);
    if (!isValidDate(date)) {
      console.warn('Invalid date in getDateKey:', dateString);
      return 'invalid';
    }
    
    if (groupBy === 'month') {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (groupBy === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return weekStart.toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error in getDateKey:', error);
    return 'invalid';
  }
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

export default function DashboardPage() {
  const { 
    expenses, 
    invoices, 
    setCurrentPage
  } = useApp();

  const [showDebug, setShowDebug] = useState(false);
  const [timeGrouping, setTimeGrouping] = useState('day');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [isLoading, setIsLoading] = useState(true);

  // Simulate loading state for better UX
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // Show loading for 800ms to prevent flash

    return () => clearTimeout(timer);
  }, [expenses, invoices]);

  // Calculate budget from paid invoices
  const budget = invoices.filter(inv => inv.status === 'paid').reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);

  // Process dashboard data
  const dashboardData = useMemo(() => {
    try {
      if (!expenses || expenses.length === 0) {
        return {
          totalExpenses: 0,
          thisMonthExpenses: 0,
          trades: [],
          categoryData: [],
          trendChartData: [],
          dateRange: { start: new Date(), end: new Date() },
          alerts: { unreviewedCount: 0, uncategorizedCount: 0 }
        };
      }

      const totalExpenses = expenses.reduce((sum, expense) => sum + getExpenseTotal(expense), 0);
      const thisMonthExpenses = expenses
        .filter(expense => isThisMonth(expense.timestamp || expense.date))
        .reduce((sum, expense) => sum + getExpenseTotal(expense), 0);

    // Group by trade/category
    const tradeMap = new Map();
    expenses.forEach(expense => {
      const trade = expense.tradeName || expense.category || 'Uncategorized';
      const amount = getExpenseTotal(expense);
      tradeMap.set(trade, (tradeMap.get(trade) || 0) + amount);
    });

    const trades = Array.from(tradeMap.entries()).map(([name, amount]) => ({
      name,
      amount,
      percentage: (amount / totalExpenses) * 100
    })).sort((a, b) => b.amount - a.amount);

    // Prepare category data for pie chart
    const categoryData = trades.slice(0, 6).map((trade, index) => ({
      name: trade.name,
      value: trade.amount,
      color: COLORS[index % COLORS.length]
    }));

    // Prepare trend data for bar chart
    const trendMap = new Map();
    expenses.forEach(expense => {
      const dateKey = getDateKey(expense.timestamp || expense.date, timeGrouping);
      const amount = getExpenseTotal(expense);
      trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + amount);
    });

    const trendChartData = Array.from(trendMap.entries())
      .map(([date, amount]) => ({
        date: formatDate(date),
        amount: parseFloat(amount.toFixed(2))
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate date range
    const dates = expenses.map(expense => new Date(expense.timestamp || expense.date));
    const dateRange = {
      start: new Date(Math.min(...dates)),
      end: new Date(Math.max(...dates))
    };

    // Count alerts
    const unreviewedCount = expenses.filter(expense => !expense.reviewed).length;
    const uncategorizedCount = expenses.filter(expense => !expense.category && !expense.tradeName).length;

    return {
      totalExpenses,
      thisMonthExpenses,
      trades,
      categoryData,
      trendChartData,
      dateRange,
      alerts: {
        unreviewedCount,
        uncategorizedCount
      }
    };
    } catch (error) {
      console.error('Error processing dashboard data:', error);
      return {
        totalExpenses: 0,
        thisMonthExpenses: 0,
        trades: [],
        categoryData: [],
        trendChartData: [],
        dateRange: { start: new Date(), end: new Date() },
        alerts: { unreviewedCount: 0, uncategorizedCount: 0 }
      };
    }
  }, [expenses, timeGrouping]);

  const budgetRemaining = budget > 0 ? ((budget - dashboardData.totalExpenses) / budget) * 100 : 0;

  // Navigation handlers
  const handleNavigate = (page) => {
    setCurrentPage(page);
  };

  const navigationCards = [
    {
      title: 'Add Expense',
      description: 'Record new expenses and track spending',
      icon: PlusCircle,
      gradient: 'from-blue-500 to-blue-600',
      hoverGradient: 'from-blue-400 to-blue-500',
      page: 'add-expense',
      accent: 'blue'
    },
    {
      title: 'Invoices',
      description: 'Manage & track invoices',
      icon: FileText,
      gradient: 'from-emerald-500 to-emerald-600',
      hoverGradient: 'from-emerald-400 to-emerald-500',
      page: 'new-invoice',
      accent: 'emerald'
    },
    {
      title: 'HIA Contracts',
      description: 'Process HIA contracts & generate progress payments',
      icon: FileCheck,
      gradient: 'from-purple-500 to-purple-600',
      hoverGradient: 'from-purple-400 to-purple-500',
      page: 'hia-contract',
      accent: 'purple'
    },
    {
      title: 'Budget Tracking',
      description: 'Monitor budget vs expenses',
      icon: TrendingUp,
      gradient: 'from-orange-500 to-orange-600',
      hoverGradient: 'from-orange-400 to-orange-500',
      page: 'budget-tracking',
      accent: 'orange'
    },
    {
      title: 'History',
      description: 'View all past transactions',
      icon: Clock,
      gradient: 'from-slate-500 to-slate-600',
      hoverGradient: 'from-slate-400 to-slate-500',
      page: 'history',
      accent: 'slate'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 md:p-6 lg:p-8 animate-fadeIn">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Dashboard</h1>
                <p className="text-slate-400 font-medium">Project overview & financial insights</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700 rounded-xl p-2">
              {['week', 'month', 'quarter'].map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    selectedPeriod === period
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl hover:bg-slate-700/50 transition-all duration-300"
            >
              <Bug className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Debug Section */}
        {showDebug && (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Bug className="w-5 h-5 text-blue-400" />
              Debug Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-slate-300">Data Overview</h4>
                <div className="space-y-2 text-sm text-slate-400">
                  <p>Expense Count: <span className="text-white font-medium">{expenses.length}</span></p>
                  <p>Total: <span className="text-white font-medium">${dashboardData.totalExpenses.toFixed(2)}</span></p>
                  <p>This Month: <span className="text-white font-medium">${dashboardData.thisMonthExpenses.toFixed(2)}</span></p>
                  <p>Budget: <span className="text-white font-medium">${budget.toFixed(2)}</span></p>
                  <p>Remaining: <span className="text-white font-medium">${(budget - dashboardData.totalExpenses).toFixed(2)}</span></p>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-medium text-slate-300">Chart Settings</h4>
                <select
                  value={timeGrouping}
                  onChange={(e) => setTimeGrouping(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                >
                  <option value="day">Group by Day</option>
                  <option value="week">Group by Week</option>
                  <option value="month">Group by Month</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingSkeleton key={index} type="card" lines={2} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="group relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm hover:border-slate-600 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-medium">Total Expenses</p>
                  <p className="text-2xl md:text-3xl font-bold text-white">${dashboardData.totalExpenses.toLocaleString()}</p>
                  <div className="flex items-center gap-1 text-sm">
                    <ArrowUpRight className="w-4 h-4 text-red-400" />
                    <span className="text-red-400 font-medium">+12.5%</span>
                    <span className="text-slate-500">vs last month</span>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-2xl border border-red-500/20">
                  <DollarSign className="w-6 h-6 text-red-400" />
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm hover:border-slate-600 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-medium">This Month</p>
                  <p className="text-2xl md:text-3xl font-bold text-white">${dashboardData.thisMonthExpenses.toLocaleString()}</p>
                  <div className="flex items-center gap-1 text-sm">
                    <ArrowUpRight className="w-4 h-4 text-blue-400" />
                    <span className="text-blue-400 font-medium">+8.2%</span>
                    <span className="text-slate-500">vs last month</span>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-2xl border border-blue-500/20">
                  <Calendar className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm hover:border-slate-600 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-medium">Budget</p>
                  <p className="text-2xl md:text-3xl font-bold text-emerald-400">${budget.toLocaleString()}</p>
                  <div className="flex items-center gap-1 text-sm">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Available</span>
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-2xl border border-emerald-500/20">
                  <TrendingUp className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm hover:border-slate-600 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-orange-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-slate-400 text-sm font-medium">Remaining</p>
                  <p className={`text-2xl md:text-3xl font-bold ${budgetRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${(budget - dashboardData.totalExpenses).toLocaleString()}
                  </p>
                  <div className="flex items-center gap-1 text-sm">
                    {budgetRemaining >= 0 ? (
                      <>
                        <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-400 font-medium">{budgetRemaining.toFixed(1)}%</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-4 h-4 text-red-400" />
                        <span className="text-red-400 font-medium">Over budget</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="p-4 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-2xl border border-orange-500/20">
                  <AlertTriangle className="w-6 h-6 text-orange-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <LoadingSkeleton key={index} type="card" lines={2} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {navigationCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <button
                  key={index}
                  onClick={() => handleNavigate(card.page)}
                  className="group relative overflow-hidden bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-700/20 to-slate-800/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-4">
                    <div className={`p-4 bg-gradient-to-br ${card.gradient} rounded-2xl shadow-lg shadow-${card.accent}-500/25 group-hover:shadow-xl group-hover:shadow-${card.accent}-500/40 transition-all duration-300`}>
                      <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">{card.title}</h3>
                    <p className="text-sm text-slate-400">{card.description}</p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors duration-300" />
                </div>
              </button>
            );
          })}
        </div>
        )}

        {/* Category Spending Chart Card */}
        <div className="mb-6">
          <CategoryChartCard expenses={expenses} />
        </div>

        {/* Alerts Section */}
        {(dashboardData.alerts.unreviewedCount > 0 || dashboardData.alerts.uncategorizedCount > 0) && (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl border border-orange-500/20">
                <AlertTriangle className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Action Required</h3>
                <p className="text-sm text-slate-400">Items that need your attention</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {dashboardData.alerts.unreviewedCount > 0 && (
                <div className="group flex items-center gap-4 p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/20 rounded-xl hover:bg-orange-500/20 transition-all duration-300 cursor-pointer">
                  <div className="p-3 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl border border-orange-500/20">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{dashboardData.alerts.unreviewedCount} expenses need review</p>
                    <p className="text-sm text-slate-400">Click to review and categorize</p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-orange-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </div>
              )}
              {dashboardData.alerts.uncategorizedCount > 0 && (
                <div className="group flex items-center gap-4 p-4 bg-gradient-to-br from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 rounded-xl hover:bg-yellow-500/20 transition-all duration-300 cursor-pointer">
                  <div className="p-3 bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 rounded-xl border border-yellow-500/20">
                    <Building className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">{dashboardData.alerts.uncategorizedCount} uncategorized expenses</p>
                    <p className="text-sm text-slate-400">Add categories for better tracking</p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-yellow-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {expenses.length > 0 && (
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-2xl p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl border border-purple-500/20">
                  <Clock className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                  <p className="text-sm text-slate-400">Latest expense transactions</p>
                </div>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-xl text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-all duration-300">
                <ArrowUpRight className="w-4 h-4" />
                View All
              </button>
            </div>
            <div className="space-y-3">
              {expenses.slice(0, 5).map((expense, index) => (
                <div key={index} className="group flex items-center justify-between p-4 bg-gradient-to-br from-slate-700/50 to-slate-800/50 border border-slate-600 rounded-xl hover:bg-slate-700/70 hover:border-slate-500 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-slate-600/50 to-slate-700/50 rounded-xl border border-slate-600">
                      <DollarSign className="w-4 h-4 text-slate-300" />
                    </div>
                    <div>
                      <p className="font-medium text-white">
                        {expense.description || expense.tradeName || 'Expense'}
                      </p>
                      <p className="text-sm text-slate-400">
                        {formatDate(expense.timestamp || expense.date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-white">${getExpenseTotal(expense).toFixed(2)}</p>
                    <p className="text-sm text-slate-400">
                      {expense.tradeName || expense.category || 'Uncategorized'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 