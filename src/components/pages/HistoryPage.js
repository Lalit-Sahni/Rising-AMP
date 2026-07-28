import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Trash2, Filter, Search, Download, Eye, Calendar, DollarSign, Hash } from 'lucide-react';
import ExportDialog from '../ExportDialog';
import { exportExpensesToExcel } from '../../utils/excelExport';

const categoryLabels = {
  labour: 'Labour',
  trade: 'Trade',
  equipment: 'Equipment',
  service: 'Service',
  purchase: 'Materials',
  installation: 'Installation'
};

const categoryColors = {
  labour: 'bg-blue-100 text-blue-800',
  trade: 'bg-purple-100 text-purple-800',
  equipment: 'bg-green-100 text-green-800',
  service: 'bg-indigo-100 text-indigo-800',
  purchase: 'bg-orange-100 text-orange-800',
  installation: 'bg-red-100 text-red-800'
};

export default function HistoryPage() {
  const { expenses, showToast, deleteExpenseFromFirebase } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedExpense, setExpandedExpense] = useState(null);
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

  // Filter and sort expenses
  const filteredAndSortedExpenses = useMemo(() => {
    let filtered = expenses.filter(expense => {
      // Category filter
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) {
        return false;
      }
      
      // Status filter
      if (statusFilter !== 'all') {
        const isReviewed = expense.reviewed === true;
        if (statusFilter === 'reviewed' && !isReviewed) return false;
        if (statusFilter === 'pending' && isReviewed) return false;
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
  }, [expenses, searchTerm, categoryFilter, statusFilter, sortConfig]);

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
      return <Hash className="w-4 h-4 text-zinc-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <Hash className="w-4 h-4 text-accent" />
      : <Hash className="w-4 h-4 text-accent" />;
  };

  // Format date with proper validation
  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid date';
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
  const reviewedCount = filteredAndSortedExpenses.filter(e => e.reviewed).length;
  const pendingCount = filteredAndSortedExpenses.filter(e => !e.reviewed).length;

  return (
    <div className="min-h-screen text-zinc-900 p-1 sm:p-2 md:p-4 animate-fadeIn portrait-mobile">
      <div className="max-w-screen-xl mx-auto px-1 sm:px-2 md:px-4 space-y-2 sm:space-y-4 md:space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Expense History</h1>
            <p className="text-zinc-500 mt-1">Complete overview of all expenses</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowExportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-lg font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-6">
          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-sm font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-zinc-900">{filteredAndSortedExpenses.length}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <Hash className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-sm font-medium">Total Amount</p>
                <p className="text-2xl font-bold text-emerald-600">${totalAmount.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-sm font-medium">Reviewed</p>
                <p className="text-2xl font-bold text-accent">{reviewedCount}</p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <Eye className="w-6 h-6 text-accent" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-500 text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg p-3 sm:p-4 md:p-6 border border-zinc-200 shadow-sm mobile-compact">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900">Filters</h2>
            <Filter className="w-5 h-5 text-zinc-500" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Categories</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Status</option>
              <option value="reviewed">Reviewed</option>
              <option value="pending">Pending</option>
            </select>

            {/* Clear Filters */}
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setStatusFilter('all');
              }}
              className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-800 rounded-lg font-medium transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Expense Table */}
        <div className="bg-white rounded-lg p-3 sm:p-4 md:p-6 border border-zinc-200 shadow-sm mobile-compact">
          <div className="overflow-x-auto mobile-table-container">
            <table className="w-full text-sm text-left text-zinc-700">
              <thead className="bg-zinc-100 text-zinc-700 text-xs uppercase">
                <tr>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-zinc-200 transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Date</span>
                      <SortIcon column="date" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-zinc-200 transition-colors"
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
                    className="px-4 py-3 cursor-pointer hover:bg-zinc-200 transition-colors"
                    onClick={() => handleSort('total')}
                  >
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-3 h-3" />
                      <span>Amount</span>
                      <SortIcon column="total" />
                    </div>
                  </th>
                  <th className="px-4 py-3">
                    <span>Status</span>
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
                        className="bg-white border-b border-zinc-200 hover:bg-zinc-50 transition-colors cursor-pointer"
                        onClick={() => setExpandedExpense(expandedExpense === expense.id ? null : expense.id)}
                      >
                        <td className="px-4 py-4 text-zinc-500">
                          {formatDate(getExpenseDate(expense))}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryColors[expense.category] || 'bg-zinc-100 text-zinc-800'}`}>
                            {categoryLabels[expense.category] || expense.category}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-zinc-900">
                          <div>
                            <div>{getExpenseDisplayName(expense)}</div>
                            {expense.notes && (
                              <div className="text-xs text-zinc-500 mt-1 truncate max-w-xs">
                                {expense.notes}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-emerald-600">
                          ${getExpenseTotal(expense).toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            expense.reviewed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {expense.reviewed ? 'Reviewed' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button 
                            className="text-red-500 hover:text-red-700 transition-colors" 
                            title="Delete" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(expense.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      
                      {/* Expanded Details Row */}
                      {expandedExpense === expense.id && (
                        <tr className="bg-zinc-50 border-b border-zinc-200">
                          <td colSpan="6" className="px-4 py-6">
                            <div className="bg-white rounded-lg p-6 border border-zinc-200">
                              <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryColors[expense.category] || 'bg-zinc-100 text-zinc-800'}`}>
                                  {categoryLabels[expense.category] || expense.category}
                                </span>
                                {getExpenseDisplayName(expense)}
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="text-sm font-semibold text-zinc-700 mb-3">Expense Details</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Date:</span>
                                      <span className="text-zinc-900">{formatDate(getExpenseDate(expense))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Amount:</span>
                                      <span className="text-emerald-600 font-semibold">${getExpenseTotal(expense).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-zinc-500">Status:</span>
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        expense.reviewed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {expense.reviewed ? 'Reviewed' : 'Pending'}
                                      </span>
                                    </div>
                                    {expense.notes && (
                                      <div className="flex justify-between">
                                        <span className="text-zinc-500">Notes:</span>
                                        <span className="text-zinc-700 text-right max-w-xs">{expense.notes}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-semibold text-zinc-700 mb-3">Category Specific Details</h4>
                                  <div className="space-y-2 text-sm">
                                    {expense.category === 'labour' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Worker:</span>
                                          <span className="text-zinc-900">{expense.workerName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Role:</span>
                                          <span className="text-zinc-900">{expense.role || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Hours:</span>
                                          <span className="text-zinc-900">{expense.hours || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Rate:</span>
                                          <span className="text-zinc-900">${expense.rate || 'N/A'}/hr</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    {expense.category === 'trade' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Trade:</span>
                                          <span className="text-zinc-900">{expense.tradeName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Category:</span>
                                          <span className="text-zinc-900">{expense.tradeCategory || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Task:</span>
                                          <span className="text-zinc-900">{expense.task || 'N/A'}</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    {expense.category === 'purchase' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Item:</span>
                                          <span className="text-zinc-900">{expense.itemName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Supplier:</span>
                                          <span className="text-zinc-900">{expense.supplier || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Quantity:</span>
                                          <span className="text-zinc-900">{expense.quantity || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Unit Cost:</span>
                                          <span className="text-zinc-900">${expense.unitCost || 'N/A'}</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    {expense.category === 'equipment' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Equipment:</span>
                                          <span className="text-zinc-900">{expense.equipmentName || 'N/A'}</span>
                                        </div>
                                        {expense.startDate && (
                                          <div className="flex justify-between">
                                            <span className="text-zinc-500">Start Date:</span>
                                            <span className="text-zinc-900">{formatDate(expense.startDate)}</span>
                                          </div>
                                        )}
                                        {expense.endDate && (
                                          <div className="flex justify-between">
                                            <span className="text-zinc-500">End Date:</span>
                                            <span className="text-zinc-900">{formatDate(expense.endDate)}</span>
                                          </div>
                                        )}
                                        {expense.totalPrice && (
                                          <div className="flex justify-between">
                                            <span className="text-zinc-500">Total Price:</span>
                                            <span className="text-zinc-900">${expense.totalPrice}</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    
                                    {expense.category === 'service' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Service:</span>
                                          <span className="text-zinc-900">{expense.serviceName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Provider:</span>
                                          <span className="text-zinc-900">{expense.provider || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-zinc-500">Cost:</span>
                                          <span className="text-zinc-900">${expense.cost || 'N/A'}</span>
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
                    <td colSpan="6" className="px-4 py-8 text-center text-zinc-500">
                      <div className="flex flex-col items-center">
                        <Eye className="w-12 h-12 mb-4 opacity-50" />
                        <h3 className="text-lg font-semibold mb-2">No Expenses Found</h3>
                        <p className="text-sm">
                          {searchTerm || categoryFilter !== 'all' || statusFilter !== 'all' 
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
    </div>
  );
} 