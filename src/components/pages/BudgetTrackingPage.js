import React from 'react';
import { Target, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';

function money(n) {
  return `$${Number(n || 0).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatInvoiceDate(value) {
  if (!value) return '—';
  try {
    const date = value.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (error) {
    return '—';
  }
}

const BudgetTrackingPage = () => {
  const { expenses, invoices, setCurrentPage } = useApp();

  const totalPaidInvoices = invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, invoice) => sum + (parseFloat(invoice.total) || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => {
    const amount = expense.total || expense.amount || expense.cost || 0;
    return sum + parseFloat(amount);
  }, 0);
  const remainingBudget = totalPaidInvoices - totalExpenses;
  const budgetUsedPercentage = totalPaidInvoices > 0 ? (totalExpenses / totalPaidInvoices) * 100 : 0;
  const budgetUnset = totalPaidInvoices <= 0;

  const getBurnRate = () => {
    if (expenses.length === 0) return 0;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentExpenses = expenses.filter((expense) => {
      const expenseDate = new Date(expense.timestamp || expense.date);
      return expenseDate >= thirtyDaysAgo;
    });
    const recentTotal = recentExpenses.reduce((sum, expense) => {
      const amount = expense.total || expense.amount || expense.cost || 0;
      return sum + parseFloat(amount);
    }, 0);
    return recentTotal / 30;
  };

  const burnRate = getBurnRate();

  const getBudgetStatus = () => {
    if (budgetUnset) return { color: 'text-slate-400', icon: Target, text: 'No budget set' };
    if (remainingBudget < 0) return { color: 'text-neg', icon: AlertTriangle, text: 'Over budget' };
    if (budgetUsedPercentage >= 90) return { color: 'text-accent', icon: AlertTriangle, text: 'Critical' };
    if (budgetUsedPercentage >= 75) return { color: 'text-accent', icon: Clock, text: 'Warning' };
    return { color: 'text-pos', icon: CheckCircle, text: 'Healthy' };
  };

  const budgetStatus = getBudgetStatus();
  const StatusIcon = budgetStatus.icon;
  const paid = invoices.filter((inv) => inv.status === 'paid');

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px] space-y-4">
      <div>
        <div className="eyebrow">Target vs actual</div>
        <h1 className="text-[26px] font-bold tracking-tight mt-1">Budget tracking</h1>
        <p className="text-[13.5px] text-slate-600 mt-0.5">Budget from paid invoices vs expenses.</p>
      </div>

      {budgetUnset && (
        <div className="flex items-center justify-between gap-4 p-4 border border-dashed border-[#D7DADF] rounded-ot bg-surface">
          <div>
            <b className="block text-[13.5px] font-semibold">No budget set</b>
            <p className="text-[13px] text-slate-600 mt-0.5">Mark an invoice as paid to track spend against a target.</p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage && setCurrentPage('new-invoice')}
            className="shrink-0 inline-flex items-center bg-accent hover:bg-accent-600 text-white text-[12.5px] font-medium px-3.5 py-2 rounded-ot-sm"
          >
            Set budget
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="relative bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
          <span className="absolute left-[18px] right-[18px] top-0 h-0.5 bg-accent rounded-b" />
          <p className="text-slate-400 text-xs font-medium">Total budget</p>
          <p className="tabular text-[25px] font-semibold mt-2.5">{money(totalPaidInvoices)}</p>
        </div>
        <div className="bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
          <p className="text-slate-400 text-xs font-medium">Total expenses</p>
          <p className="tabular text-[25px] font-semibold mt-2.5">{money(totalExpenses)}</p>
        </div>
        <div className="bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
          <p className="text-slate-400 text-xs font-medium">Remaining</p>
          <p className={`tabular text-[25px] font-semibold mt-2.5 ${budgetUnset ? 'text-slate-400' : remainingBudget >= 0 ? 'text-pos' : 'text-neg'}`}>
            {budgetUnset ? '—' : money(Math.abs(remainingBudget))}
          </p>
        </div>
        <div className="bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
          <p className="text-slate-400 text-xs font-medium">Status</p>
          <div className="flex items-center gap-2 mt-3">
            <StatusIcon className={`w-4 h-4 ${budgetStatus.color}`} />
            <p className={`text-sm font-semibold ${budgetStatus.color}`}>{budgetStatus.text}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
          <h3 className="text-sm font-semibold mb-4">Budget</h3>
          <p className="tabular text-[25px] font-semibold mb-1">{money(totalPaidInvoices)}</p>
          <p className="text-xs text-slate-400 mb-4">From paid invoices</p>
          <div className="h-[7px] bg-[#EEF0F2] rounded overflow-hidden">
            <div
              className="h-full rounded bg-accent"
              style={{ width: `${budgetUnset ? 0 : Math.min(100, budgetUsedPercentage)}%` }}
            />
          </div>
          <p className="font-mono text-xs text-slate-400 mt-2">
            {budgetUnset ? '—' : `${budgetUsedPercentage.toFixed(0)}% utilised`}
          </p>
        </div>
        <div className="bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
          <h3 className="text-sm font-semibold mb-4">Expenses</h3>
          <p className="tabular text-[25px] font-semibold mb-1">{money(totalExpenses)}</p>
          <p className="text-xs text-slate-400 mb-4">Total spent</p>
          <div className="h-[7px] bg-[#EEF0F2] rounded overflow-hidden">
            <div
              className="h-full rounded bg-steel-700"
              style={{ width: `${budgetUnset ? 0 : Math.min(100, budgetUsedPercentage)}%` }}
            />
          </div>
          <p className="font-mono text-xs text-slate-400 mt-2">
            {budgetUnset ? 'No target yet' : `${budgetUsedPercentage.toFixed(0)}% of budget used`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
          <h4 className="text-xs text-slate-400 font-medium mb-2">Budget used</h4>
          <p className="tabular text-xl font-semibold">{budgetUnset ? '—' : `${budgetUsedPercentage.toFixed(1)}%`}</p>
        </div>
        <div className="bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
          <h4 className="text-xs text-slate-400 font-medium mb-2">Burn rate</h4>
          <p className="tabular text-xl font-semibold">{money(burnRate)}</p>
          <p className="text-xs text-slate-400 mt-1">per day (30-day avg)</p>
        </div>
        <div className="bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
          <h4 className="text-xs text-slate-400 font-medium mb-2">Days remaining</h4>
          <p className="tabular text-xl font-semibold">
            {budgetUnset || burnRate <= 0 ? '—' : Math.floor(remainingBudget / burnRate)}
          </p>
          <p className="text-xs text-slate-400 mt-1">at current rate</p>
        </div>
      </div>

      <div className="bg-surface rounded-ot p-[18px] shadow-whisper border border-hairline">
        <h3 className="text-sm font-semibold mb-4">Paid invoices (budget source)</h3>
        {paid.length === 0 ? (
          <p className="text-slate-400 text-sm">No paid invoices yet. Paid invoices will appear here and contribute to your budget.</p>
        ) : (
          <div className="space-y-1.5">
            {paid.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between py-3 border-b border-hairline last:border-0">
                <div>
                  <p className="tabular font-medium">{money(parseFloat(invoice.total) || 0)}</p>
                  <p className="font-mono text-xs text-slate-400 mt-0.5">
                    {invoice.invoiceNumber} · {formatInvoiceDate(invoice.invoiceDate)}
                    {invoice.clientName ? ` · ${invoice.clientName}` : ''}
                  </p>
                </div>
                <span className="text-xs text-pos">paid</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetTrackingPage;
