import React, { useState } from 'react';
import { Target, Edit3, Save, X, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

const BudgetTrackerCard = () => {
  const { expenses, invoices } = useApp();
  
  // Calculate budget from paid invoices
  const totalPaidInvoices = invoices.filter(inv => inv.status === 'paid').reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);
  const budget = totalPaidInvoices;
  
  // Budget is now read-only since it's calculated from invoices
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(budget.toString());

  // Calculate budget statistics
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

  const totalExpenses = expenses.reduce((sum, expense) => sum + getExpenseTotal(expense), 0);
  const remainingBudget = budget - totalExpenses;
  const budgetUsed = budget > 0 ? (totalExpenses / budget) * 100 : 0;
  const isOverBudget = remainingBudget < 0;

  const handleBudgetSave = async () => {
    // Budget is read-only - calculated from paid invoices
    setBudgetInput(budget.toString());
    setIsEditingBudget(false);
  };

  const handleCancelEdit = () => {
    setIsEditingBudget(false);
    setBudgetInput(budget.toString());
  };

  const getProgressColor = () => {
    if (budgetUsed >= 90) return 'bg-red-500';
    if (budgetUsed >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = () => {
    if (isOverBudget) return <TrendingDown className="w-4 h-4 text-red-400" />;
    if (budgetUsed >= 75) return <TrendingUp className="w-4 h-4 text-yellow-400" />;
    return <TrendingUp className="w-4 h-4 text-green-400" />;
  };

  const getStatusText = () => {
    if (isOverBudget) return 'Over Budget';
    if (budgetUsed >= 90) return 'Critical';
    if (budgetUsed >= 75) return 'Warning';
    return 'On Track';
  };

  const getStatusColor = () => {
    if (isOverBudget) return 'text-red-400';
    if (budgetUsed >= 90) return 'text-red-400';
    if (budgetUsed >= 75) return 'text-yellow-400';
    return 'text-green-400';
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <div className="p-2 bg-green-500/20 rounded-lg">
            <Target className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Budget Tracker</h3>
            <p className="text-sm text-slate-400">From paid invoices</p>
          </div>
        </div>
      </div>

      {/* Budget Display */}
        <div className="space-y-4">
          {/* Budget Amount */}
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">
              ${budget.toLocaleString()}
            </p>
            <p className="text-sm text-slate-400">From Paid Invoices</p>
          </div>

          {/* Progress Bar */}
          {budget > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Used</span>
                <span className="text-slate-300 font-medium">
                  {budgetUsed.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor()}`}
                  style={{ width: `${Math.min(budgetUsed, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {getStatusText()}
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Remaining</p>
              <p className={`text-lg font-semibold ${isOverBudget ? 'text-red-400' : 'text-green-400'}`}>
                ${Math.abs(remainingBudget).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {!isEditingBudget && budget > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400">Spent</p>
              <p className="text-slate-200 font-semibold">
                ${totalExpenses.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Daily Avg</p>
              <p className="text-slate-200 font-semibold">
                ${(totalExpenses / 30).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetTrackerCard; 