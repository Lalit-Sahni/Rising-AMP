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
    // Try form date first (the actual date from the form)
    if (expense.date) {
      const dt = new Date(expense.date);
      return isNaN(dt.getTime()) ? null : dt;
    }
    // Fallback to timestamp (when expense was added to database)
    if (expense.timestamp) {
      const dt = new Date(expense.timestamp);
      return isNaN(dt.getTime()) ? null : dt;
    }
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
      return <Hash className="w-4 h-4 text-slate-500" />;
    }
    return sortConfig.direction === 'asc' 
      ? <Hash className="w-4 h-4 text-blue-400" />
      : <Hash className="w-4 h-4 text-blue-400" />;
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
    <div className="min-h-screen bg-slate-900 text-slate-100 p-1 sm:p-2 md:p-4 animate-fadeIn portrait-mobile">
      <div className="max-w-screen-xl mx-auto px-1 sm:px-2 md:px-4 space-y-2 sm:space-y-4 md:space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Expense History <span className="text-green-400 text-sm">[FIXED v2.1]</span></h1>
            <p className="text-slate-400 mt-1">Complete overview of all expenses - Deletion issue resolved</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowExportDialog(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 md:gap-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-white">{filteredAndSortedExpenses.length}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Hash className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Total Amount</p>
                <p className="text-2xl font-bold text-green-400">${totalAmount.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-500/20 rounded-lg">
                <DollarSign className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Reviewed</p>
                <p className="text-2xl font-bold text-blue-400">{reviewedCount}</p>
              </div>
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Eye className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm font-medium">Pending</p>
                <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
              </div>
              <div className="p-3 bg-yellow-500/20 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 rounded-lg p-3 sm:p-4 md:p-6 border border-slate-700 mobile-compact">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <Filter className="w-5 h-5 text-slate-400" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-medium transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Expense Table */}
        <div className="bg-slate-800 rounded-lg p-3 sm:p-4 md:p-6 border border-slate-700 mobile-compact">
          <div className="overflow-x-auto mobile-table-container">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="bg-slate-700 text-slate-100 text-xs uppercase">
                <tr>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Date</span>
                      <SortIcon column="date" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
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
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
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
                        className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                        onClick={() => setExpandedExpense(expandedExpense === expense.id ? null : expense.id)}
                      >
                        <td className="px-4 py-4 text-slate-400">
                          {formatDate(getExpenseDate(expense))}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryColors[expense.category] || 'bg-gray-100 text-gray-800'}`}>
                            {categoryLabels[expense.category] || expense.category}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-medium text-slate-100">
                          <div>
                            <div>{getExpenseDisplayName(expense)}</div>
                            {expense.notes && (
                              <div className="text-xs text-slate-400 mt-1 truncate max-w-xs">
                                {expense.notes}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-green-400">
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
                            className="text-red-400 hover:text-red-600 transition-colors" 
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
                        <tr className="bg-slate-700 border-b border-slate-600">
                          <td colSpan="6" className="px-4 py-6">
                            <div className="bg-slate-800 rounded-lg p-6 border border-slate-600">
                              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${categoryColors[expense.category] || 'bg-gray-100 text-gray-800'}`}>
                                  {categoryLabels[expense.category] || expense.category}
                                </span>
                                {getExpenseDisplayName(expense)}
                              </h3>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Expense Details</h4>
                                  <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Date:</span>
                                      <span className="text-white">{formatDate(getExpenseDate(expense))}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Amount:</span>
                                      <span className="text-green-400 font-semibold">${getExpenseTotal(expense).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Status:</span>
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        expense.reviewed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {expense.reviewed ? 'Reviewed' : 'Pending'}
                                      </span>
                                    </div>
                                    {expense.notes && (
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Notes:</span>
                                        <span className="text-white text-right max-w-xs">{expense.notes}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Category Specific Details</h4>
                                  <div className="space-y-2 text-sm">
                                    {expense.category === 'labour' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Worker:</span>
                                          <span className="text-white">{expense.workerName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Role:</span>
                                          <span className="text-white">{expense.role || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Hours:</span>
                                          <span className="text-white">{expense.hours || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Rate:</span>
                                          <span className="text-white">${expense.rate || 'N/A'}/hr</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    {expense.category === 'trade' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Trade:</span>
                                          <span className="text-white">{expense.tradeName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Category:</span>
                                          <span className="text-white">{expense.tradeCategory || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Task:</span>
                                          <span className="text-white">{expense.task || 'N/A'}</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    {expense.category === 'purchase' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Item:</span>
                                          <span className="text-white">{expense.itemName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Supplier:</span>
                                          <span className="text-white">{expense.supplier || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Quantity:</span>
                                          <span className="text-white">{expense.quantity || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Unit Cost:</span>
                                          <span className="text-white">${expense.unitCost || 'N/A'}</span>
                                        </div>
                                      </>
                                    )}
                                    
                                    {expense.category === 'equipment' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Equipment:</span>
                                          <span className="text-white">{expense.equipmentName || 'N/A'}</span>
                                        </div>
                                        {expense.startDate && (
                                          <div className="flex justify-between">
                                            <span className="text-slate-400">Start Date:</span>
                                            <span className="text-white">{formatDate(expense.startDate)}</span>
                                          </div>
                                        )}
                                        {expense.endDate && (
                                          <div className="flex justify-between">
                                            <span className="text-slate-400">End Date:</span>
                                            <span className="text-white">{formatDate(expense.endDate)}</span>
                                          </div>
                                        )}
                                        {expense.totalPrice && (
                                          <div className="flex justify-between">
                                            <span className="text-slate-400">Total Price:</span>
                                            <span className="text-white">${expense.totalPrice}</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                    
                                    {expense.category === 'service' && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Service:</span>
                                          <span className="text-white">{expense.serviceName || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Provider:</span>
                                          <span className="text-white">{expense.provider || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-slate-400">Cost:</span>
                                          <span className="text-white">${expense.cost || 'N/A'}</span>
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
                    <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
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