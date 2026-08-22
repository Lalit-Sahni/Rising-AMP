import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Trash2, Pencil, Filter, Search, Download, Eye, Calendar, DollarSign, Hash } from 'lucide-react';
import ExportDialog from '../ExportDialog';
import ExpenseModal from '../ExpenseModal';
import CategoryChip from '../ui/CategoryChip';
import { exportExpensesToExcel } from '../../utils/excelExport';
import { CATEGORY_STYLE } from '../../utils/categoryStyle';

const categoryLabels = {
  labour: 'Labour',
  trade: 'Trade',
  equipment: 'Equipment',
  service: 'Service',
  purchase: 'Materials',
  installation: 'Installation'
};

export default function HistoryPage() {
  const { expenses, showToast, deleteExpenseFromFirebase } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [payerFilter, setPayerFilter] = useState('all');
  const [expandedExpense, setExpandedExpense] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [sortConfig, setSortConfig] = useState({
    key: 'date',
    direction: 'desc'
  });
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Safe date helper for sorting
  const safeDate = (expense) => {
    /**
     * Normalise any supported date-like value into a valid JS Date
     * Supports:
     * - Firestore Timestamp objects (value.toDate())
     * - Native Date instances
     * - ISO / string dates
     */
    const toValidDate = (value) => {
      if (!value) return null;

      // Firestore Timestamp (has .toDate())
      if (value.toDate && typeof value.toDate === 'function') {
        const dt = value.toDate();
        return isNaN(dt.getTime()) ? null : dt;
      }

      // Already a JS Date
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
      }

      // Fallback: treat as string/number
      const dt = new Date(value);
      return isNaN(dt.getTime()) ? null : dt;
    };

    // Prefer explicit form date, then fallback to created timestamp
    const formDate = toValidDate(expense.date);
    if (formDate) return formDate;

    const createdDate = toValidDate(expense.timestamp);
    if (createdDate) return createdDate;

    return null;
  };

  // Helper function to safely get expense total
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

  // Helper function to get expense display name
  const getExpenseDisplayName = (expense) => {
    switch (expense.category) {
      case 'labour':
        return expense.workerName || 'Labour';
      case 'trade':
        return expense.tradeName || expense.trade || 'Trade';
      case 'equipment':
        return expense.equipmentName || 'Equipment';
      case 'purchase':
        return expense.itemName || 'Purchase';
      case 'service':
        return expense.serviceName || 'Service';
      case 'installation':
        return expense.item || 'Installation';
      default:
        return expense.category || 'Unknown';
    }
  };

  // Unique payer names for filter dropdown
  const uniquePayers = useMemo(() => {
    const names = new Set(expenses.filter(e => e.paidBy).map(e => e.paidBy));
    return Array.from(names).sort();
  }, [expenses]);

  // Filter and sort expenses
  const filteredAndSortedExpenses = useMemo(() => {
    let filtered = expenses.filter(expense => {
      // Category filter
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) {
        return false;
      }

      // Payer filter
      if (payerFilter !== 'all' && expense.paidBy !== payerFilter) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const displayName = getExpenseDisplayName(expense).toLowerCase();
        const category = (categoryLabels[expense.category] || expense.category || '').toLowerCase();
        const notes = (expense.notes || '').toLowerCase();

        if (!displayName.includes(searchLower) &&
            !category.includes(searchLower) &&
            !notes.includes(searchLower)) {
          return false;
        }
      }

      return true;
    });

    // Sort expenses
    filtered.sort((a, b) => {
      if (sortConfig.key === 'date') {
        const dateA = safeDate(a);
        const dateB = safeDate(b);
        
        // Handle null dates
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;  // null dates go to end
        if (!dateB) return -1;
        
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      if (sortConfig.key === 'total') {
        const totalA = getExpenseTotal(a);
        const totalB = getExpenseTotal(b);
        return sortConfig.direction === 'asc' ? totalA - totalB : totalB - totalA;
      }
      
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    return filtered;
  }, [expenses, searchTerm, categoryFilter, payerFilter, sortConfig]);

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  // Sort icon component
  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) {
      return <Hash className="w-4 h-4 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <Hash className="w-4 h-4 text-accent" />
      : <Hash className="w-4 h-4 text-accent" />;
  };

  // Format date with proper validation
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '—';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return '—';
    }
  };

  // Get the correct date for display (form date first, then timestamp)
  const getExpenseDate = (expense) => {
    const safeDateObj = safeDate(expense);
    return safeDateObj ? safeDateObj.toISOString() : null;
  };

  const handleDelete = async (expenseId) => {
    if (!expenseId) {
      showToast('Cannot delete expense: No ID found', 'error');
      return;
    }

    // Add confirmation dialog
    if (!window.confirm('Are you sure you want to delete this expense? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('Starting deletion process for expense:', expenseId);
      const result = await deleteExpenseFromFirebase(expenseId);
      if (result.success) {
        console.log('Deletion completed successfully');
        showToast('Expense deleted successfully', 'success');
      } else {
        console.error('Deletion failed:', result.error);
        showToast(`Failed to delete expense: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      showToast(`Error deleting expense: ${error.message}`, 'error');
    }
  };

  const handleExport = async (filename) => {
    try {
      const result = await exportExpensesToExcel(filteredAndSortedExpenses, filename);
      if (result.success) {
        showToast('Excel file exported successfully!', 'success');
      } else {
        showToast(`Export failed: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('Export error:', error);
      showToast('Export failed. Please try again.', 'error');
    }
  };


  // Calculate totals
  const totalAmount = filteredAndSortedExpenses.reduce((sum, expense) => sum + getExpenseTotal(expense), 0);

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto space-y-4">
        
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Ledger</div>
            <h1 className="text-[26px] font-bold tracking-tight mt-1">History</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">Every recorded expense on this job.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowExportDialog(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-accent hover:bg-accent-600 text-white rounded-ot-sm text-[12.5px] font-medium"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3.5">
          <div className="relative bg-surface rounded-ot p-[18px] border border-hairline shadow-whisper">
            <span className="absolute left-[18px] right-[18px] top-0 h-0.5 bg-accent rounded-b" />
            <p className="text-slate-400 text-xs font-medium">Total expenses</p>
            <p className="tabular text-[25px] font-semibold text-ink mt-2.5">{filteredAndSortedExpenses.length}</p>
          </div>

          <div className="bg-surface rounded-ot p-[18px] border border-hairline shadow-whisper">
            <p className="text-slate-400 text-xs font-medium">Total amount</p>
            <p className="tabular text-[25px] font-semibold text-ink mt-2.5">${totalAmount.toLocaleString()}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-surface rounded-ot p-4 md:p-5 border border-hairline shadow-whisper">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink">Filters</h2>
            <Filter className="w-4 h-4 text-slate-400" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Payer Filter */}
            <select
              value={payerFilter}
              onChange={(e) => setPayerFilter(e.target.value)}
              className="px-4 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink focus:outline-none focus:border-accent"
            >
              <option value="all">All Payers</option>
              {uniquePayers.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setPayerFilter('all');
              }}
              className="pressable px-4 py-2 bg-surface border border-hairline text-ink rounded-ot-sm text-[13px] font-medium"
            >
              Clear Filters
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`pressable px-2.5 py-1 rounded-full text-xs font-medium border ${
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
                  onClick={() => setCategoryFilter(key)}
                  className={`pressable inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-surface ${
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

        {/* Expense Table */}
        <div className="bg-surface rounded-ot border border-hairline shadow-whisper overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-ink">
              <thead className="bg-canvas text-slate-600 text-[11px] uppercase tracking-wide">
                <tr>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:text-ink"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Date</span>
                      <SortIcon column="date" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:text-ink"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Category</span>
                      <SortIcon column="category" />
                    </div>
                  </th>
                  <th className="px-4 py-3">
                    <span>Description</span>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:text-ink"
                    onClick={() => handleSort('total')}
                  >
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-3 h-3" />
                      <span>Amount</span>
                      <SortIcon column="total" />
                    </div>
                  </th>
                  <th className="px-4 py-3">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedExpenses.length > 0 ? (
                  filteredAndSortedExpenses.map((expense, index) => (
                    <React.Fragment key={`${expense.id || index}-${getExpenseDate(expense)}`}>
                      <tr 
                        className="bg-surface border-b border-hairline hover:bg-canvas transition-colors cursor-pointer"
                        onClick={() => setExpandedExpense(expandedExpense === expense.id ? null : expense.id)}
                      >
                        <td className="px-4 py-4 text-slate-600 font-mono text-xs">
                          {formatDate(getExpenseDate(expense))}
                        </td>
                        <td className="px-4 py-4">
                          <CategoryChip category={expense.category} />
                        </td>
                        <td className="px-4 py-4 font-medium text-ink">
                          <div>
                            <div>{getExpenseDisplayName(expense)}</div>
                            {expense.paidBy && (
                              <div className="text-xs text-slate-400 mt-0.5">
                                Paid by: {expense.paidBy}
                              </div>
                            )}
                            {expense.notes && (
                              <div className="text-xs text-slate-400 mt-1 truncate max-w-xs">
                                {expense.notes}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 tabular font-medium text-ink">
                          ${getExpenseTotal(expense).toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              className="text-slate-400 hover:text-accent transition-colors"
                              title="Edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingExpense(expense);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              className="text-neg hover:opacity-80 transition-colors"
                              title="Delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(expense.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      {expandedExpense === expense.id && (
                        <tr className="bg-canvas border-b border-hairline">
                          <td colSpan="6" className="px-4 py-6">
                            <div className="bg-surface rounded-ot p-5 border border-hairline">
                              <h3 className="text-sm font-semibold text-ink mb-4 flex items-center gap-2">
                                <CategoryChip category={expense.category} />
                                {getExpenseDisplayName(expense)}
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="text-sm font-semibold text-ink mb-3">Expense Details</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-slate-600">Date:</span>
                                      <span className="text-ink">{formatDate(getExpenseDate(expense))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-600">Amount:</span>
                                      <span className="tabular text-ink font-medium">${getExpenseTotal(expense).toLocaleString()}</span>
                                    </div>
                                    {expense.paidBy && (
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">Paid by:</span>
                                        <span className="text-ink font-medium">{expense.paidBy}</span>
                                      </div>
                                    )}
                                    {expense.notes && (
                                      <div className="flex justify-between">
                                        <span className="text-slate-600">Notes:</span>
                                        <span className="text-ink text-right max-w-xs">{expense.notes}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-semibold text-ink mb-3">Category Specific Details</h4>
                                  <div className="space-y-2 text-sm">
                                    {expense.category === 'labour' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Worker:</span>
                                          <span className="text-ink">{expense.workerName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Role:</span>
                                          <span className="text-ink">{expense.role || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Hours:</span>
                                          <span className="text-ink">{expense.hours || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Rate:</span>
                                          <span className="text-ink">${expense.rate || 'N/A'}/hr</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    {expense.category === 'trade' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Trade:</span>
                                          <span className="text-ink">{expense.tradeName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Category:</span>
                                          <span className="text-ink">{expense.tradeCategory || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Task:</span>
                                          <span className="text-ink">{expense.task || 'N/A'}</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    {expense.category === 'purchase' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Item:</span>
                                          <span className="text-ink">{expense.itemName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Supplier:</span>
                                          <span className="text-ink">{expense.supplier || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Quantity:</span>
                                          <span className="text-ink">{expense.quantity || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Unit Cost:</span>
                                          <span className="text-ink">${expense.unitCost || 'N/A'}</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    {expense.category === 'equipment' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Equipment:</span>
                                          <span className="text-ink">{expense.equipmentName || 'N/A'}</span>
                                        </div>
                                        {expense.startDate && (
                                          <div className="flex justify-between">
                                            <span className="text-slate-600">Start Date:</span>
                                            <span className="text-ink">{formatDate(expense.startDate)}</span>
                                          </div>
                                        )}
                                        {expense.endDate && (
                                          <div className="flex justify-between">
                                            <span className="text-slate-600">End Date:</span>
                                            <span className="text-ink">{formatDate(expense.endDate)}</span>
                                          </div>
                                        )}
                                        {expense.totalPrice && (
                                          <div className="flex justify-between">
                                            <span className="text-slate-600">Total Price:</span>
                                            <span className="text-ink">${expense.totalPrice}</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    
                                    {expense.category === 'service' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Service:</span>
                                          <span className="text-ink">{expense.serviceName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Provider:</span>
                                          <span className="text-ink">{expense.provider || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">Cost:</span>
                                          <span className="text-ink">${expense.cost || 'N/A'}</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-600">
                      <div className="flex flex-col items-center">
                        <Eye className="w-12 h-12 mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Expenses Found</h3>
                        <p className="text-sm">
                          {searchTerm || categoryFilter !== 'all'
                            ? 'Try adjusting your filters to see more results.'
                            : 'Add some expenses to see them here.'
                          }
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        expenseCount={filteredAndSortedExpenses.length}
      />

      {/* Edit Expense Modal */}
      {editingExpense && (
        <ExpenseModal
          isOpen={true}
          onClose={() => setEditingExpense(null)}
          category={editingExpense.category}
          initialData={editingExpense}
          expenseId={editingExpense.id}
        />
      )}
    </div>
  );
} 