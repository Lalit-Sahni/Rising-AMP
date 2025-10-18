import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, DollarSign, Calendar, Hash, Eye, ExternalLink, Paperclip, Image } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import ReceiptViewer from '../ReceiptViewer';

const ExpenseSummaryTable = ({ expenses = [] }) => {
  const { setCurrentPage } = useApp();
  const [sortConfig, setSortConfig] = useState({
    key: 'timestamp',
    direction: 'desc'
  });
  const [showAll, setShowAll] = useState(false);
  const [receiptViewerOpen, setReceiptViewerOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

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

  // Helper function to get category label
  const getCategoryLabel = (category) => {
    const labels = {
      labour: 'Labour',
      trade: 'Trade',
      equipment: 'Equipment',
      service: 'Service',
      purchase: 'Materials',
      installation: 'Installation'
    };
    return labels[category] || category;
  };

  // Sort function
  const sortedExpenses = useMemo(() => {
    if (expenses.length === 0) return [];
    
    const sortedData = [...expenses].sort((a, b) => {
      if (sortConfig.key === 'timestamp') {
        const dateA = new Date(a[sortConfig.key]);
        const dateB = new Date(b[sortConfig.key]);
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

    return showAll ? sortedData : sortedData.slice(0, 10);
  }, [expenses, sortConfig, showAll]);

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
      return <ChevronUp className="w-4 h-4 text-slate-500" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-4 h-4 text-blue-400" />
      : <ChevronDown className="w-4 h-4 text-blue-400" />;
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Handle "Show All" button click
  const handleShowAll = () => {
    setCurrentPage('history');
  };

  // Handle receipt viewing
  const handleViewReceipt = (expense) => {
    if (expense.receiptImageUrl) {
      setSelectedReceipt({
        url: expense.receiptImageUrl,
        metadata: {
          fileName: `receipt_${expense.id}`,
          size: expense.receiptSize,
          contentType: expense.receiptContentType,
          uploadedAt: expense.receiptUploadedAt
        }
      });
      setReceiptViewerOpen(true);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-2 sm:p-3 md:p-4 shadow mobile-compact">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <DollarSign className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-slate-100">Expense Summary</h2>
        </div>
        <div className="text-sm text-slate-400">
          {expenses.length > 0 ? (
            `Showing ${sortedExpenses.length} of ${expenses.length} expenses`
          ) : (
            'No expenses'
          )}
        </div>
      </div>

      {expenses.length > 0 ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto mobile-table-container">
            <table className="w-full text-sm text-left text-slate-300">
              {/* Sticky Header */}
              <thead className="bg-slate-700 text-slate-100 text-xs uppercase sticky top-0 z-10">
                <tr>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
                    onClick={() => handleSort('timestamp')}
                  >
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Date</span>
                      <SortIcon column="timestamp" />
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
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Description</span>
                    </div>
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
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>Status</span>
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <Paperclip className="w-3 h-3" />
                      <span>Receipt</span>
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedExpenses.map((expense, index) => (
                  <tr 
                    key={`${expense.id || index}-${expense.timestamp}`}
                    className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-4 text-slate-400">
                      {formatDate(expense.timestamp)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        expense.category === 'labour' ? 'bg-blue-100 text-blue-800' :
                        expense.category === 'trade' ? 'bg-purple-100 text-purple-800' :
                        expense.category === 'equipment' ? 'bg-green-100 text-green-800' :
                        expense.category === 'purchase' ? 'bg-orange-100 text-orange-800' :
                        expense.category === 'service' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {getCategoryLabel(expense.category)}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-100">
                      {getExpenseDisplayName(expense)}
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
                      {expense.receiptImageUrl ? (
                        <button
                          onClick={() => handleViewReceipt(expense)}
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                          title="View Receipt"
                        >
                          <Image className="w-4 h-4" />
                          <span className="text-xs">View</span>
                        </button>
                      ) : (
                        <span className="text-slate-500 text-xs">No receipt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-1 sm:space-y-2 md:space-y-3">
            {sortedExpenses.map((expense, index) => (
                              <div 
                  key={`${expense.id || index}-${expense.timestamp}`}
                  className="bg-slate-700 rounded-lg p-2 sm:p-3 md:p-4 hover:bg-slate-600 transition-colors touch-active mobile-compact"
                >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-400">
                    {formatDate(expense.timestamp)}
                  </span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    expense.category === 'labour' ? 'bg-blue-100 text-blue-800' :
                    expense.category === 'trade' ? 'bg-purple-100 text-purple-800' :
                    expense.category === 'equipment' ? 'bg-green-100 text-green-800' :
                    expense.category === 'purchase' ? 'bg-orange-100 text-orange-800' :
                    expense.category === 'service' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {getCategoryLabel(expense.category)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-100">{getExpenseDisplayName(expense)}</h3>
                  <span className="text-lg font-bold text-green-400">
                    ${getExpenseTotal(expense).toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    expense.reviewed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {expense.reviewed ? 'Reviewed' : 'Pending'}
                  </span>
                  {expense.receiptImageUrl && (
                    <button
                      onClick={() => handleViewReceipt(expense)}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-xs"
                      title="View Receipt"
                    >
                      <Image className="w-3 h-3" />
                      <span>Receipt</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Show All Button */}
          <div className="mt-4 sm:mt-6 text-center">
            <button
              onClick={handleShowAll}
              className="px-4 sm:px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto mobile-button touch-active"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Show All Expenses</span>
              <span className="sm:hidden">View All</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          {/* Summary Footer */}
          <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between text-sm text-slate-400">
            <span>
              Total Expenses: {expenses.length}
            </span>
            <span>
              Combined Total: ${expenses.reduce((sum, expense) => sum + getExpenseTotal(expense), 0).toLocaleString()}
            </span>
          </div>
        </>
      ) : (
        // Empty state when no expenses
        <div className="text-center py-12 text-slate-400">
          <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Expenses Yet</h3>
          <p className="text-sm">
            Add some expenses to see your expense summary.
          </p>
        </div>
      )}
      
      {/* Receipt Viewer Modal */}
      <ReceiptViewer
        isOpen={receiptViewerOpen}
        onClose={() => setReceiptViewerOpen(false)}
        receiptUrl={selectedReceipt?.url}
        receiptMetadata={selectedReceipt?.metadata}
      />
    </div>
  );
};

export default ExpenseSummaryTable; 