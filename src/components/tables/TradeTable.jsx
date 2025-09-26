import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Users, Calendar, DollarSign, Hash } from 'lucide-react';

const TradeTable = ({ trades = [] }) => {
  const [sortConfig, setSortConfig] = useState({
    key: 'total',
    direction: 'desc'
  });
  const [showAll, setShowAll] = useState(false);

  // Sort function
  const sortedTrades = useMemo(() => {
    if (trades.length === 0) return [];
    
    const sortedData = [...trades].sort((a, b) => {
      if (sortConfig.key === 'lastInvoiceDate') {
        const dateA = new Date(a[sortConfig.key]);
        const dateB = new Date(b[sortConfig.key]);
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (sortConfig.direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      }
      return aValue < bValue ? 1 : -1;
    });

    return showAll ? sortedData : sortedData.slice(0, 10);
  }, [trades, sortConfig, showAll]);

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

  return (
    <div className="bg-slate-800 rounded-xl p-4 shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-green-400" />
          <h2 className="text-xl font-semibold text-slate-100">Trade Spending</h2>
        </div>
        <div className="text-sm text-slate-400">
          {trades.length > 0 ? (
            `Showing ${sortedTrades.length} of ${trades.length} trades`
          ) : (
            'No trade data'
          )}
        </div>
      </div>

      {trades.length > 0 ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-300">
              {/* Sticky Header */}
              <thead className="bg-slate-700 text-slate-100 text-xs uppercase sticky top-0 z-10">
                <tr>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
                    onClick={() => handleSort('trade')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Trade</span>
                      <SortIcon column="trade" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
                    onClick={() => handleSort('total')}
                  >
                    <div className="flex items-center space-x-1">
                      <DollarSign className="w-3 h-3" />
                      <span>Total</span>
                      <SortIcon column="total" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
                    onClick={() => handleSort('entryCount')}
                  >
                    <div className="flex items-center space-x-1">
                      <Hash className="w-3 h-3" />
                      <span>Entries</span>
                      <SortIcon column="entryCount" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 cursor-pointer hover:bg-slate-600 transition-colors"
                    onClick={() => handleSort('lastInvoiceDate')}
                  >
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Last Invoice</span>
                      <SortIcon column="lastInvoiceDate" />
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedTrades.map((trade, index) => (
                  <tr 
                    key={`${trade.trade}-${index}`}
                    className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-4 font-medium text-slate-100">
                      {trade.trade}
                    </td>
                    <td className="px-4 py-4 font-semibold text-green-400">
                      ${trade.total.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {trade.entryCount}
                    </td>
                    <td className="px-4 py-4 text-slate-400">
                      {formatDate(trade.lastInvoiceDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {sortedTrades.map((trade, index) => (
              <div 
                key={`${trade.trade}-${index}`}
                className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-slate-100">{trade.trade}</h3>
                  <span className="text-lg font-bold text-green-400">
                    ${trade.total.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span>{trade.entryCount} entries</span>
                  <span>Last: {formatDate(trade.lastInvoiceDate)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* View All Toggle */}
          {trades.length > 10 && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAll(!showAll)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                {showAll ? 'Show Top 10' : 'View All'}
              </button>
            </div>
          )}

          {/* Summary Footer */}
          <div className="mt-6 pt-4 border-t border-slate-700 flex items-center justify-between text-sm text-slate-400">
            <span>
              Total Trades: {trades.length}
            </span>
            <span>
              Combined Total: ${trades.reduce((sum, trade) => sum + trade.total, 0).toLocaleString()}
            </span>
          </div>
        </>
      ) : (
        // Empty state when no trade data
        <div className="text-center py-12 text-slate-400">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Trade Expenses Yet</h3>
          <p className="text-sm">
            Add some trade expenses to see spending breakdown by trade type.
          </p>
          <p className="text-xs mt-2 text-slate-500">
            Trade expenses include work from electricians, plumbers, carpenters, etc.
          </p>
        </div>
      )}
    </div>
  );
};

export default TradeTable; 