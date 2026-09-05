import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Image,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import ExportDialog from '../ExportDialog';
import ExpenseModal from '../ExpenseModal';
import ReceiptViewer from '../ReceiptViewer';
import CategoryChip from '../ui/CategoryChip';
import EmptyState from '../EmptyState';
import ExpenseTradePicker from '../costPlan/ExpenseTradePicker';
import ExpenseCategoryPicker from '../costPlan/ExpenseCategoryPicker';
import { CATEGORY_STYLE, getCategoryStyle } from '../../utils/categoryStyle';
import {
  expenseDate,
  expenseHasReceipt,
  formatMoney,
  getExpenseFaceTotal,
  getExpenseTotal,
  isVoidExpense,
} from '../../utils/jobMetrics';
import { expenseDisplayName } from '../../domain/expenseDisplay';
import { useCostPlan, useTradeList } from '../../hooks/useCostPlan';
import { activeTrades, canCodeExpenses } from '../../domain/costPlan';
import { parseCalendarDate } from '../../dates';

const DAY = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

function formatDay(value) {
  const date = value instanceof Date ? value : parseCalendarDate(value);
  if (!date || Number.isNaN(date.getTime())) return '—';
  return DAY.format(date);
}

function money(value) {
  return formatMoney(value, { cents: true });
}

const DETAIL_FIELDS = {
  labour: [
    ['Worker', 'workerName'],
    ['Role', 'role'],
    ['Hours', 'hours'],
    ['Rate', 'rate', (v) => `${money(Number(v))}/hr`],
  ],
  trade: [
    ['Trade', 'tradeName'],
    ['Trade type', 'tradeCategory'],
    ['Task', 'task'],
  ],
  purchase: [
    ['Item', 'itemName'],
    ['Supplier', 'supplier'],
    ['Quantity', 'quantity'],
    ['Unit cost', 'unitCost', (v) => money(Number(v))],
  ],
  equipment: [
    ['Equipment', 'equipmentName'],
    ['Start', 'startDate', formatDay],
    ['End', 'endDate', formatDay],
    ['Total price', 'totalPrice', (v) => money(Number(v))],
  ],
  service: [
    ['Service', 'serviceName'],
    ['Provider', 'provider'],
    ['Cost', 'cost', (v) => money(Number(v))],
  ],
  investor: [
    ['What it is', 'itemName'],
  ],
  installation: [
    ['Item', 'item'],
  ],
};

function detailRows(expense) {
  const rows = [];
  rows.push(['Date', formatDay(expenseDate(expense))]);
  rows.push(['Amount', money(getExpenseFaceTotal(expense))]);
  if (expense.paidBy) rows.push(['Paid by', expense.paidBy]);
  (DETAIL_FIELDS[expense.category] || []).forEach(([label, key, format]) => {
    const value = expense[key];
    if (value == null || value === '') return;
    rows.push([label, format ? format(value) : String(value)]);
  });
  if (expense.notes) rows.push(['Notes', expense.notes]);
  return rows;
}

export default function HistoryPage() {
  const {
    expenses,
    showToast,
    deleteExpenseFromFirebase,
    restoreExpenseFromFirebase,
    purgeExpenseFromFirebase,
    orgId,
    jobId,
    codeExpenseTrade,
    codeExpenseCategory,
    setCurrentPage,
  } = useApp();
  const planQuery = useCostPlan(orgId, jobId);
  const tradeQuery = useTradeList(orgId);
  const showTradeCoding = canCodeExpenses(planQuery.data);
  const trades = activeTrades(tradeQuery.data || []);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState('all');
  const [expandedExpense, setExpandedExpense] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showRecentlyDeleted, setShowRecentlyDeleted] = useState(false);
  const [receiptView, setReceiptView] = useState(null);

  useEffect(() => {
    const expenseId = location.state && location.state.openExpenseId;
    if (!expenseId) return;
    const match = (expenses || []).find((row) => row && row.id === expenseId);
    if (!match) return;
    setEditingExpense(match);
    setExpandedExpense(match.id);
    navigate('.', { replace: true, state: {} });
  }, [location.state, expenses, navigate]);

  const openHistoryReceipt = async (expense) => {
    const { resolveExpenseReceiptUrl } = await import('../../firebase/resolveReceiptUrl');
    const url = await resolveExpenseReceiptUrl(expense, {
      jobId,
      expenseId: expense && expense.id,
    });
    if (!url) {
      showToast('Could not open that receipt', 'error');
      return;
    }
    setReceiptView({ url, name: expenseDisplayName(expense) });
  };

  const uniquePayers = useMemo(() => {
    const names = new Set(expenses.filter((e) => e.paidBy && !isVoidExpense(e)).map((e) => e.paidBy));
    return Array.from(names).sort();
  }, [expenses]);

  const filteredAndSortedExpenses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = expenses.filter((expense) => {
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false;
      if (payerFilter !== 'all' && expense.paidBy !== payerFilter) return false;
      if (q) {
        const hay = [
          expenseDisplayName(expense),
          getCategoryStyle(expense.category).label,
          expense.notes,
          expense.supplier,
          expense.provider,
          expense.paidBy,
          String(getExpenseFaceTotal(expense)),
        ].map((v) => String(v || '').toLowerCase()).join(' ');
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sortConfig.key === 'date') {
        const dateA = expenseDate(a);
        const dateB = expenseDate(b);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortConfig.key === 'total') {
        const totalA = getExpenseFaceTotal(a);
        const totalB = getExpenseFaceTotal(b);
        return sortConfig.direction === 'asc' ? totalA - totalB : totalB - totalA;
      }
      const aValue = String(a[sortConfig.key] || '');
      const bValue = String(b[sortConfig.key] || '');
      return sortConfig.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });

    return filtered;
  }, [expenses, searchTerm, categoryFilter, payerFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-accent" />
      : <ArrowDown className="w-3.5 h-3.5 text-accent" />;
  };

  const handleDelete = async (expenseId) => {
    if (!expenseId) return;
    if (!window.confirm('Move this expense to Recently deleted? It leaves this list and totals ignore it. You can restore it later.')) return;
    await deleteExpenseFromFirebase(expenseId);
  };

  const handleRestore = async (expenseId) => {
    await restoreExpenseFromFirebase(expenseId);
  };

  const handlePurge = async (expenseId) => {
    if (!expenseId) return;
    if (!window.confirm('Remove this expense for good? This cannot be undone.')) return;
    await purgeExpenseFromFirebase(expenseId);
  };

  const handleExport = async (filename) => {
    try {
      const { exportExpensesToExcel } = await import('../../utils/excelExport');
      const result = await exportExpensesToExcel(
        filteredAndSortedExpenses.filter((expense) => !isVoidExpense(expense)),
        filename,
      );
      if (result.success) {
        showToast('Excel file downloaded', 'success');
      } else {
        showToast(`Export failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Export error:', error);
      showToast('Export failed. Please try again.', 'error');
    }
  };

  const hasFilters = Boolean(searchTerm) || categoryFilter !== 'all' || payerFilter !== 'all';
  const clearFilters = () => {
    setSearchTerm('');
    setCategoryFilter('all');
    setPayerFilter('all');
  };

  const liveRows = filteredAndSortedExpenses.filter((expense) => !isVoidExpense(expense));
  const deletedRows = filteredAndSortedExpenses.filter((expense) => isVoidExpense(expense));
  const rows = showRecentlyDeleted ? deletedRows : liveRows;
  const totalAmount = liveRows.reduce((sum, expense) => sum + getExpenseTotal(expense), 0);
  const nothingOnJob = expenses.length === 0;

  const rowActions = (expense) => (
    showRecentlyDeleted ? (
      <>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-ot-sm border border-hairline text-[12px] font-semibold text-ink hover:bg-canvas"
          onClick={(e) => { e.stopPropagation(); handleRestore(expense.id); }}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restore
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-ot-sm border border-hairline text-[12px] font-semibold text-neg hover:bg-canvas"
          onClick={(e) => { e.stopPropagation(); handlePurge(expense.id); }}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove for good
        </button>
      </>
    ) : (
      <>
        {expenseHasReceipt(expense) ? (
          <button
            type="button"
            className="w-8 h-8 grid place-items-center rounded-ot-sm border border-hairline text-slate-600 hover:text-ink hover:bg-canvas"
            title="View receipt"
            aria-label="View receipt"
            onClick={(e) => { e.stopPropagation(); openHistoryReceipt(expense); }}
          >
            <Eye className="w-4 h-4" />
          </button>
        ) : null}
        <button
          type="button"
          className="w-8 h-8 grid place-items-center rounded-ot-sm border border-hairline text-slate-600 hover:text-ink hover:bg-canvas"
          title="Edit"
          aria-label="Edit"
          onClick={(e) => { e.stopPropagation(); setEditingExpense(expense); }}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="w-8 h-8 grid place-items-center rounded-ot-sm border border-hairline text-slate-600 hover:text-neg hover:bg-canvas"
          title="Move to Recently deleted"
          aria-label="Move to Recently deleted"
          onClick={(e) => { e.stopPropagation(); handleDelete(expense.id); }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </>
    )
  );

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto space-y-4">

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Ledger</div>
            <h1 className="text-[25px] font-extrabold tracking-tight mt-1">History</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">Every recorded expense on this job.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowExportDialog(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-surface border border-hairline hover:border-[#D6D9DD] text-ink rounded-ot-sm text-[12.5px] font-semibold"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export to Excel</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          <div className="bg-surface rounded-ot p-[15px] md:p-[18px] border border-hairline shadow-whisper">
            <p className="text-slate-400 text-[11.5px] font-semibold">{hasFilters ? 'Matching expenses' : 'Expenses'}</p>
            <p className="tabular text-[22px] md:text-[25px] font-extrabold tracking-tight text-ink mt-1.5">{liveRows.length}</p>
          </div>
          <div className="relative bg-surface rounded-ot p-[15px] md:p-[18px] border border-hairline shadow-whisper">
            <span className="absolute left-[15px] right-[15px] md:left-[18px] md:right-[18px] top-0 h-0.5 bg-accent rounded-b" />
            <p className="text-slate-400 text-[11.5px] font-semibold">{hasFilters ? 'Matching total' : 'Total'}</p>
            <p className="tabular text-[22px] md:text-[25px] font-extrabold tracking-tight text-ink mt-1.5">{formatMoney(totalAmount)}</p>
          </div>
        </div>

        <div className="bg-surface rounded-ot p-3.5 md:p-5 border border-hairline shadow-whisper">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="search"
                placeholder="Search by name, supplier, note or amount"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder:text-slate-400 focus:outline-none focus:border-accent"
              />
            </label>
            {uniquePayers.length > 0 ? (
              <select
                value={payerFilter}
                onChange={(e) => setPayerFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent sm:max-w-[200px]"
                aria-label="Paid by"
              >
                <option value="all">Anyone paid</option>
                {uniquePayers.map((name) => (
                  <option key={name} value={name}>Paid by {name}</option>
                ))}
              </select>
            ) : null}
            {hasFilters ? (
              <button
                type="button"
                onClick={clearFilters}
                className="pressable px-3.5 py-2.5 bg-surface border border-hairline text-ink rounded-ot-sm text-[13px] font-semibold"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3 -mx-3.5 px-3.5 md:mx-0 md:px-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`pressable px-2.5 py-1 rounded-full text-xs font-semibold border ${
                categoryFilter === 'all'
                  ? 'border-accent bg-accent-tint text-accent'
                  : 'border-hairline bg-surface text-slate-600'
              }`}
            >
              All
            </button>
            {Object.entries(CATEGORY_STYLE).filter(([key]) => key !== 'materials').map(([key, style]) => {
              const active = categoryFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategoryFilter(active ? 'all' : key)}
                  className={`pressable inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-surface whitespace-nowrap ${
                    active ? 'border-accent text-ink' : 'border-hairline text-slate-600'
                  }`}
                >
                  <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: style.hex }} />
                  {style.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-surface rounded-ot border border-hairline shadow-whisper overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-hairline">
            <p className="text-[13px] text-slate-600">
              {showRecentlyDeleted
                ? 'Off the job until you restore them or remove them for good.'
                : `${rows.length} ${rows.length === 1 ? 'expense' : 'expenses'}${hasFilters ? ' match' : ''}.`}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowRecentlyDeleted((open) => !open);
                setExpandedExpense(null);
              }}
              className="shrink-0 text-[12.5px] font-semibold text-accent hover:text-accent-600"
            >
              {showRecentlyDeleted
                ? 'Back to expenses'
                : `Recently deleted${deletedRows.length ? ` (${deletedRows.length})` : ''}`}
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="p-4">
              {nothingOnJob && !showRecentlyDeleted ? (
                <EmptyState
                  title="No expenses yet"
                  body="The first receipt or labour row you add will show up here."
                  actionLabel="Add expense"
                  onAction={() => setCurrentPage('add-expense')}
                />
              ) : (
                <EmptyState
                  title={showRecentlyDeleted ? 'Recently deleted is empty' : 'Nothing matches'}
                  body={showRecentlyDeleted
                    ? 'Expenses you move here can be restored or removed for good.'
                    : 'Try a different search, or clear the filters.'}
                  actionLabel={!showRecentlyDeleted && hasFilters ? 'Clear filters' : undefined}
                  onAction={!showRecentlyDeleted && hasFilters ? clearFilters : undefined}
                />
              )}
            </div>
          ) : (
            <>
              {/* Phone: cards */}
              <ul className="md:hidden divide-y divide-hairline">
                {rows.map((expense) => {
                  const style = getCategoryStyle(expense.category);
                  const name = expenseDisplayName(expense);
                  return (
                    <li key={expense.id} className="px-4 py-3">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => (showRecentlyDeleted ? null : setEditingExpense(expense))}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: style.hex }} />
                              <span className="text-[14px] font-bold text-ink truncate">{name}</span>
                              {expenseHasReceipt(expense) ? <Image className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : null}
                            </div>
                            <div className="text-[12px] text-slate-400 mt-0.5 truncate">
                              {style.label} · {formatDay(expenseDate(expense))}
                              {expense.paidBy ? ` · ${expense.paidBy}` : ''}
                            </div>
                            {expense.notes ? (
                              <div className="text-[12px] text-slate-500 mt-0.5 line-clamp-2">{expense.notes}</div>
                            ) : null}
                          </div>
                          <span className={`tabular text-[15px] font-extrabold shrink-0 ${showRecentlyDeleted ? 'text-slate-400 line-through' : 'text-ink'}`}>
                            {money(getExpenseFaceTotal(expense))}
                          </span>
                        </div>
                      </button>
                      <div className="flex items-center justify-between gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 min-w-0">
                          {!showRecentlyDeleted ? (
                            <ExpenseCategoryPicker
                              expense={expense}
                              compact
                              onChange={(category) => codeExpenseCategory(expense.id, category)}
                            />
                          ) : <CategoryChip category={expense.category} />}
                          {showTradeCoding && !showRecentlyDeleted ? (
                            <ExpenseTradePicker
                              expense={expense}
                              expenses={expenses}
                              trades={trades}
                              compact
                              disabled={String(expense.category || '').toLowerCase() === 'investor'}
                              onCode={(tradeId) => codeExpenseTrade(expense.id, tradeId)}
                            />
                          ) : null}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">{rowActions(expense)}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left text-ink">
                  <thead className="bg-canvas text-slate-600 text-[11px] uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 cursor-pointer hover:text-ink select-none" onClick={() => handleSort('date')}>
                        <span className="inline-flex items-center gap-1.5">Date <SortIcon column="date" /></span>
                      </th>
                      <th className="px-4 py-3 cursor-pointer hover:text-ink select-none" onClick={() => handleSort('category')}>
                        <span className="inline-flex items-center gap-1.5">Category <SortIcon column="category" /></span>
                      </th>
                      <th className="px-4 py-3">Description</th>
                      {showTradeCoding && !showRecentlyDeleted ? <th className="px-4 py-3">Cost plan</th> : null}
                      <th className="px-4 py-3 text-right cursor-pointer hover:text-ink select-none" onClick={() => handleSort('total')}>
                        <span className="inline-flex items-center gap-1.5">Amount <SortIcon column="total" /></span>
                      </th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((expense) => {
                      const open = expandedExpense === expense.id;
                      const colSpan = showTradeCoding && !showRecentlyDeleted ? 6 : 5;
                      return (
                        <React.Fragment key={expense.id}>
                          <tr
                            className="bg-surface border-b border-hairline hover:bg-canvas transition-colors cursor-pointer"
                            onClick={() => setExpandedExpense(open ? null : expense.id)}
                          >
                            <td className="px-4 py-3.5 text-slate-600 tabular text-[13px] whitespace-nowrap">
                              {formatDay(expenseDate(expense))}
                            </td>
                            <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                              {showRecentlyDeleted ? (
                                <CategoryChip category={expense.category} />
                              ) : (
                                <ExpenseCategoryPicker
                                  expense={expense}
                                  compact
                                  onChange={(category) => codeExpenseCategory(expense.id, category)}
                                />
                              )}
                            </td>
                            <td className="px-4 py-3.5 font-medium text-ink">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{expenseDisplayName(expense)}</span>
                                {expenseHasReceipt(expense) ? (
                                  <button
                                    type="button"
                                    className="shrink-0 p-1 rounded text-slate-400 hover:text-accent"
                                    aria-label="View receipt"
                                    title="View receipt"
                                    onClick={(event) => { event.stopPropagation(); openHistoryReceipt(expense); }}
                                  >
                                    <Image className="w-3.5 h-3.5" />
                                  </button>
                                ) : null}
                              </div>
                              {expense.paidBy ? <div className="text-xs text-slate-400 mt-0.5">Paid by {expense.paidBy}</div> : null}
                              {expense.notes ? <div className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{expense.notes}</div> : null}
                            </td>
                            {showTradeCoding && !showRecentlyDeleted ? (
                              <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                                <ExpenseTradePicker
                                  expense={expense}
                                  expenses={expenses}
                                  trades={trades}
                                  compact
                                  disabled={String(expense.category || '').toLowerCase() === 'investor'}
                                  onCode={(tradeId) => codeExpenseTrade(expense.id, tradeId)}
                                />
                              </td>
                            ) : null}
                            <td className={`px-4 py-3.5 tabular font-bold text-right whitespace-nowrap ${showRecentlyDeleted ? 'text-slate-400 line-through' : 'text-ink'}`}>
                              {money(getExpenseFaceTotal(expense))}
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center justify-end gap-1.5">{rowActions(expense)}</div>
                            </td>
                          </tr>
                          {open ? (
                            <tr className="bg-canvas border-b border-hairline">
                              <td colSpan={colSpan} className="px-4 py-4">
                                <div className="bg-surface rounded-ot p-4 border border-hairline">
                                  <div className="flex items-center gap-2 mb-3">
                                    <CategoryChip category={expense.category} />
                                    <b className="text-[13.5px] font-bold">{expenseDisplayName(expense)}</b>
                                  </div>
                                  <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2.5 text-[13px]">
                                    {detailRows(expense).map(([label, value]) => (
                                      <div key={label} className={label === 'Notes' ? 'col-span-2 lg:col-span-4' : ''}>
                                        <dt className="text-[11px] font-semibold text-slate-400">{label}</dt>
                                        <dd className="text-ink mt-0.5 break-words">{value}</dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        expenseCount={liveRows.length}
      />

      {editingExpense ? (
        <ExpenseModal
          key={editingExpense.id}
          isOpen
          onClose={() => setEditingExpense(null)}
          category={editingExpense.category === 'materials' ? 'purchase' : editingExpense.category}
          initialData={editingExpense}
          expenseId={editingExpense.id}
        />
      ) : null}

      <ReceiptViewer
        isOpen={Boolean(receiptView)}
        onClose={() => setReceiptView(null)}
        receiptUrl={receiptView ? receiptView.url : null}
        receiptMetadata={receiptView ? { fileName: receiptView.name } : null}
      />
    </div>
  );
}
