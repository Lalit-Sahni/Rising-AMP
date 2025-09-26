import React from 'react';
import { 
  Target, 
  DollarSign, 
  TrendingDown, 
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const BudgetTrackingPage = () => {
  const { 
    expenses, 
    invoices
  } = useApp();

  // Budget is now calculated from paid invoices, so no form state needed

  // Calculate budget statistics from paid invoices
  const totalPaidInvoices = invoices.filter(inv => inv.status === 'paid').reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => {
    const amount = expense.total || expense.amount || expense.cost || 0;
    return sum + parseFloat(amount);
  }, 0);
  const remainingBudget = totalPaidInvoices - totalExpenses;
  const budgetUsedPercentage = totalPaidInvoices > 0 ? (totalExpenses / totalPaidInvoices) * 100 : 0;

  // Calculate burn rate (daily spending)
  const getBurnRate = () => {
    if (expenses.length === 0) return 0;
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    const recentExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.timestamp || expense.date);
      return expenseDate >= thirtyDaysAgo;
    });
    
    const recentTotal = recentExpenses.reduce((sum, expense) => {
      const amount = expense.total || expense.amount || expense.cost || 0;
      return sum + parseFloat(amount);
    }, 0);
    
    return recentTotal / 30; // Daily average over last 30 days
  };

  const burnRate = getBurnRate();

  // Get status indicators
  const getBudgetStatus = () => {
    if (remainingBudget < 0) return { color: 'text-red-400', icon: AlertTriangle, text: 'Over Budget' };
    if (budgetUsedPercentage >= 90) return { color: 'text-yellow-400', icon: AlertTriangle, text: 'Critical' };
    if (budgetUsedPercentage >= 75) return { color: 'text-yellow-400', icon: Clock, text: 'Warning' };
    return { color: 'text-green-400', icon: CheckCircle, text: 'Healthy' };
  };

  const budgetStatus = getBudgetStatus();

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Budget Tracking</h1>
          <p className="text-gray-400">Budget from paid invoices vs expenses</p>
        </div>
      </div>

      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Budget</p>
              <p className="text-2xl font-bold text-green-400">${totalPaidInvoices.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Expenses</p>
              <p className="text-2xl font-bold text-red-400">${totalExpenses.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Remaining</p>
              <p className={`text-2xl font-bold ${remainingBudget >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${Math.abs(remainingBudget).toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Target className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Status</p>
              <div className="flex items-center gap-2">
                <budgetStatus.icon className={`w-5 h-5 ${budgetStatus.color}`} />
                <p className={`text-lg font-semibold ${budgetStatus.color}`}>{budgetStatus.text}</p>
              </div>
            </div>
            <div className="p-3 bg-slate-600/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Visual Budget Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Budget Bucket */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <DollarSign className="w-4 h-4 text-green-400" />
            </div>
            Budget Bucket
          </h3>
          <div className="relative h-64 bg-slate-700 rounded-lg overflow-hidden">
            <div 
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-600 to-green-400 transition-all duration-1000"
              style={{ height: `${Math.min(100, budgetUsedPercentage)}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">
                  ${totalPaidInvoices.toLocaleString()}
                </p>
                <p className="text-sm text-slate-300">From Paid Invoices</p>
              </div>
            </div>
          </div>
        </div>

        {/* Expense Bucket */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
            Expense Bucket
          </h3>
          <div className="relative h-64 bg-slate-700 rounded-lg overflow-hidden">
            <div 
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-red-600 to-red-400 transition-all duration-1000"
              style={{ height: `${Math.min(100, budgetUsedPercentage)}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">
                  ${totalExpenses.toLocaleString()}
                </p>
                <p className="text-sm text-slate-300">Total Expenses</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Budget Used</h4>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-700 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  budgetUsedPercentage >= 90 ? 'bg-red-500' : 
                  budgetUsedPercentage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, budgetUsedPercentage)}%` }}
              />
            </div>
            <span className="text-sm font-medium text-white">
              {budgetUsedPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Burn Rate</h4>
          <p className="text-2xl font-bold text-white">${burnRate.toFixed(0)}</p>
          <p className="text-xs text-slate-400">per day (30-day avg)</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
          <h4 className="text-sm font-medium text-slate-300 mb-2">Days Remaining</h4>
          <p className="text-2xl font-bold text-white">
            {burnRate > 0 ? Math.floor(remainingBudget / burnRate) : '∞'}
          </p>
          <p className="text-xs text-slate-400">at current rate</p>
        </div>
      </div>

      {/* Paid Invoices List */}
      <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Paid Invoices (Budget Source)</h3>
        <div className="space-y-3">
          {invoices.filter(inv => inv.status === 'paid').length === 0 ? (
            <p className="text-slate-400 text-center py-8">No paid invoices yet. Paid invoices will appear here and contribute to your budget.</p>
          ) : (
            invoices.filter(inv => inv.status === 'paid').map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <DollarSign className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">${parseFloat(invoice.total).toLocaleString()}</p>
                    <p className="text-sm text-slate-400">
                      {invoice.invoiceNumber} • {new Date(invoice.invoiceDate).toLocaleDateString()}
                      {invoice.clientName && ` • ${invoice.clientName}`}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>


    </div>
  );
};

export default BudgetTrackingPage; 