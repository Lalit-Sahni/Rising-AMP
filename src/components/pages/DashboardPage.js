import React, { useState, useMemo, useEffect } from 'react';
import {
  PlusCircle,
  FileText,
  FileCheck,
  Clock,
  AlertTriangle,
  Bug,
  ArrowUpRight,
  Target,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import LoadingSkeleton from '../ui/LoadingSkeleton';
import CategoryChartCard from '../dashboard/CategoryChartCard';
import CategoryChip from '../ui/CategoryChip';

function isValidDate(date) {
  return date instanceof Date && !isNaN(date);
}

function isThisMonth(timestamp) {
  try {
    const now = new Date();
    const expenseDate = new Date(timestamp);
    if (!isValidDate(expenseDate)) return false;
    return expenseDate.getMonth() === now.getMonth() &&
      expenseDate.getFullYear() === now.getFullYear();
  } catch (error) {
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
    if (!isValidDate(date)) return '—';
    return date.toLocaleDateString('en-AU', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (error) {
    return '—';
  }
}

function getDateKey(dateString, groupBy = 'day') {
  try {
    const date = new Date(dateString);
    if (!isValidDate(date)) return 'invalid';
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
    return 'invalid';
  }
}

function money(n) {
  return `$${Number(n || 0).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function expenseLabel(expense) {
  return expense.description || expense.tradeName || expense.itemName || expense.category || 'Expense';
}

export default function DashboardPage() {
  const { expenses, invoices, setCurrentPage } = useApp();
  const [showDebug, setShowDebug] = useState(false);
  const [timeGrouping, setTimeGrouping] = useState('day');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, [expenses, invoices]);

  const budget = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);

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
          alerts: { unreviewedCount: 0, uncategorizedCount: 0 },
        };
      }

      const totalExpenses = expenses.reduce((sum, expense) => sum + getExpenseTotal(expense), 0);
      const thisMonthExpenses = expenses
        .filter((expense) => isThisMonth(expense.timestamp || expense.date))
        .reduce((sum, expense) => sum + getExpenseTotal(expense), 0);

      const tradeMap = new Map();
      expenses.forEach((expense) => {
        const trade = expense.tradeName || expense.category || 'Uncategorized';
        const amount = getExpenseTotal(expense);
        tradeMap.set(trade, (tradeMap.get(trade) || 0) + amount);
      });

      const trades = Array.from(tradeMap.entries())
        .map(([name, amount]) => ({
          name,
          amount,
          percentage: totalExpenses ? (amount / totalExpenses) * 100 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const categoryData = trades.slice(0, 6).map((trade) => ({
        name: trade.name,
        value: trade.amount,
      }));

      const trendMap = new Map();
      expenses.forEach((expense) => {
        const dateKey = getDateKey(expense.timestamp || expense.date, timeGrouping);
        const amount = getExpenseTotal(expense);
        trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + amount);
      });

      const trendChartData = Array.from(trendMap.entries())
        .map(([date, amount]) => ({
          date: formatDate(date),
          amount: parseFloat(amount.toFixed(2)),
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const dates = expenses.map((expense) => new Date(expense.timestamp || expense.date));
      const dateRange = {
        start: new Date(Math.min(...dates)),
        end: new Date(Math.max(...dates)),
      };

      const unreviewedCount = expenses.filter((expense) => !expense.reviewed).length;
      const uncategorizedCount = expenses.filter((expense) => !expense.category && !expense.tradeName).length;

      return {
        totalExpenses,
        thisMonthExpenses,
        trades,
        categoryData,
        trendChartData,
        dateRange,
        alerts: { unreviewedCount, uncategorizedCount },
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
        alerts: { unreviewedCount: 0, uncategorizedCount: 0 },
      };
    }
  }, [expenses, timeGrouping]);

  const totalInvoiced = invoices.reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);
  const totalPaid = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);
  const outstanding = totalInvoiced - totalPaid;
  const budgetUnset = !budget;

  const handleNavigate = (page) => setCurrentPage(page);

  const quickActions = [
    { title: 'Add expense', description: 'Record new spend', icon: PlusCircle, page: 'add-expense' },
    { title: 'Invoices', description: 'Manage & track', icon: FileText, page: 'new-invoice' },
    { title: 'HIA contracts', description: 'Progress payments', icon: FileCheck, page: 'hia-contract' },
    { title: 'Budget tracking', description: 'Target vs actual', icon: Target, page: 'budget-tracking' },
    { title: 'History', description: 'Past transactions', icon: Clock, page: 'history' },
  ];

  const recent = (expenses || []).slice(0, 3);

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 mb-[22px]">
          <div>
            <div className="eyebrow">Project overview</div>
            <h1 className="text-[26px] font-bold tracking-tight mt-1">Dashboard</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">Where this job stands this month.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-surface border border-hairline rounded-[9px] p-[3px]">
              {['week', 'month', 'quarter'].map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`px-3.5 py-1.5 rounded-md text-[12.5px] font-medium capitalize ${
                    selectedPeriod === period ? 'bg-accent text-white' : 'text-slate-600 hover:text-ink'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm bg-surface text-slate-600 hover:text-ink"
              title="Debug"
            >
              <Bug className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showDebug && (
          <div className="bg-surface border border-hairline rounded-ot shadow-whisper p-5 mb-4">
            <h3 className="text-sm font-semibold mb-3">Debug</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600">
              <div className="space-y-1">
                <p>Expense count: <span className="tabular text-ink">{expenses.length}</span></p>
                <p>Total: <span className="tabular text-ink">{money(dashboardData.totalExpenses)}</span></p>
                <p>This month: <span className="tabular text-ink">{money(dashboardData.thisMonthExpenses)}</span></p>
                <p>Budget: <span className="tabular text-ink">{money(budget)}</span></p>
              </div>
              <select
                value={timeGrouping}
                onChange={(e) => setTimeGrouping(e.target.value)}
                className="h-10 px-3 bg-canvas border border-hairline rounded-ot-sm text-ink focus:border-accent outline-none"
              >
                <option value="day">Group by Day</option>
                <option value="week">Group by Week</option>
                <option value="month">Group by Month</option>
              </select>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <LoadingSkeleton key={index} type="card" lines={2} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
            <div className="relative bg-surface border border-hairline rounded-ot p-[18px] shadow-whisper">
              <span className="absolute left-[18px] right-[18px] top-0 h-0.5 bg-accent rounded-b" />
              <div className="text-xs text-slate-400 font-medium">Total expenses</div>
              <div className="tabular font-semibold text-[25px] tracking-tight my-2.5">{money(dashboardData.totalExpenses)}</div>
              <div className="text-xs text-slate-600">
                <span className="tabular">{expenses.length}</span> recorded
              </div>
            </div>
            <div className="bg-surface border border-hairline rounded-ot p-[18px] shadow-whisper">
              <div className="text-xs text-slate-400 font-medium">This month</div>
              <div className="tabular font-semibold text-[25px] tracking-tight my-2.5">{money(dashboardData.thisMonthExpenses)}</div>
              <div className="text-xs text-slate-600">Spend in the current month</div>
            </div>
            <div className="bg-surface border border-hairline rounded-ot p-[18px] shadow-whisper">
              <div className="text-xs text-slate-400 font-medium">Invoiced</div>
              <div className="tabular font-semibold text-[25px] tracking-tight my-2.5">{money(totalInvoiced)}</div>
              <div className="text-xs text-slate-600">
                <span className="tabular text-pos">{money(totalPaid)}</span> paid
              </div>
            </div>
            <div className="bg-surface border border-hairline rounded-ot p-[18px] shadow-whisper">
              <div className="text-xs text-slate-400 font-medium">Outstanding</div>
              <div className="tabular font-semibold text-[25px] tracking-tight my-2.5">{money(outstanding)}</div>
              <div className="text-xs text-slate-400">
                {outstanding === 0 ? '• nothing overdue' : 'unpaid invoices'}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-3.5 mb-4">
          <CategoryChartCard expenses={expenses} onViewAll={() => handleNavigate('history')} />
          <div className="bg-surface border border-hairline rounded-ot p-[18px] shadow-whisper">
            <h3 className="text-sm font-semibold">Budget</h3>
            {budgetUnset ? (
              <div className="flex items-center justify-between gap-4 mt-3.5 p-4 border border-dashed border-[#D7DADF] rounded-ot-sm bg-[#FBFBFC]">
                <div>
                  <b className="block text-[13.5px] font-semibold">No budget set</b>
                  <p className="text-[13px] text-slate-600 mt-0.5">Set one to track spend against a target.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleNavigate('budget-tracking')}
                  className="shrink-0 inline-flex items-center bg-accent hover:bg-accent-600 text-white text-[12.5px] font-medium px-3.5 py-2 rounded-ot-sm"
                >
                  Set budget
                </button>
              </div>
            ) : (
              <div className="mt-3.5 p-4 border border-hairline rounded-ot-sm">
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-600">From paid invoices</span>
                  <span className="tabular font-medium">{money(budget)}</span>
                </div>
                <div className="flex justify-between text-[13px] mt-2">
                  <span className="text-slate-600">Spent</span>
                  <span className="tabular">{money(dashboardData.totalExpenses)}</span>
                </div>
                <div className="flex justify-between text-[13px] mt-2">
                  <span className="text-slate-600">Remaining</span>
                  <span className={`tabular ${budget - dashboardData.totalExpenses < 0 ? 'text-neg' : 'text-pos'}`}>
                    {money(budget - dashboardData.totalExpenses)}
                  </span>
                </div>
              </div>
            )}

            <h3 className="text-sm font-semibold mt-5">Recent</h3>
            {recent.length === 0 ? (
              <p className="text-[13px] text-slate-400 mt-3">No expenses yet.</p>
            ) : (
              <div className="mt-1.5">
                {recent.map((expense, index) => (
                  <div key={expense.id || index} className="flex items-center gap-3 mt-3">
                    <span className="flex-1 text-[12.5px] text-slate-600 truncate">
                      {expenseLabel(expense)}
                    </span>
                    {expense.category && <CategoryChip category={expense.category} />}
                    <span className="tabular text-xs text-slate-400">{money(getExpenseTotal(expense))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-sm font-semibold mt-1.5 mb-3">Quick actions</div>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <LoadingSkeleton key={index} type="card" lines={1} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {quickActions.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.page}
                  onClick={() => handleNavigate(card.page)}
                  className="pressable flex items-center gap-3.5 text-left bg-surface border border-hairline rounded-ot p-4"
                >
                  <span className="w-[38px] h-[38px] rounded-[9px] bg-canvas border border-hairline grid place-items-center text-ink shrink-0">
                    <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
                  </span>
                  <span className="min-w-0">
                    <b className="block text-[13.5px] font-semibold text-ink">{card.title}</b>
                    <small className="block text-xs text-slate-400">{card.description}</small>
                  </span>
                  <ArrowUpRight className="w-[15px] h-[15px] text-slate-400 ml-auto shrink-0" strokeWidth={1.6} />
                </button>
              );
            })}
          </div>
        )}

        {(dashboardData.alerts.unreviewedCount > 0 || dashboardData.alerts.uncategorizedCount > 0) && (
          <div className="bg-surface border border-hairline rounded-ot p-[18px] shadow-whisper mt-4">
            <h3 className="text-sm font-semibold mb-3">Needs attention</h3>
            <div className="space-y-2">
              {dashboardData.alerts.unreviewedCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleNavigate('history')}
                  className="pressable w-full flex items-center gap-3 p-3 rounded-ot-sm border border-hairline text-left"
                >
                  <AlertTriangle className="w-4 h-4 text-accent shrink-0" />
                  <span className="flex-1 text-[13px] text-ink">
                    {dashboardData.alerts.unreviewedCount} expenses need review
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400" />
                </button>
              )}
              {dashboardData.alerts.uncategorizedCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleNavigate('history')}
                  className="pressable w-full flex items-center gap-3 p-3 rounded-ot-sm border border-hairline text-left"
                >
                  <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="flex-1 text-[13px] text-ink">
                    {dashboardData.alerts.uncategorizedCount} uncategorized expenses
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-slate-400" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
