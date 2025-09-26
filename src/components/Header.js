import React from 'react';
import { useApp } from '../context/AppContext';
import { Download, Search, LogOut } from 'lucide-react';

const Header = ({ onLogout }) => {
  const { currentPage, setCommandPaletteOpen } = useApp();

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'Dashboard';
      case 'add-expense':
        return 'Add Expense';
      case 'history':
        return 'Expense History';
      case 'purchase-orders':
        return 'Purchase Orders';
      default:
        return 'Construction Expense Tracker';
    }
  };

  const exportToExcel = () => {
    // Excel export functionality
    console.log('Exporting to Excel...');
  };

  return (
    <header className="bg-gradient-to-r from-slate-800 to-slate-700 border-b border-slate-600 px-4 md:px-6 py-3 md:py-4 shadow-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-lg md:text-xl font-semibold text-white md:ml-0 ml-12">{getPageTitle()}</h1>
        
        <div className="flex items-center space-x-2 md:space-x-3">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Search (Ctrl+K)"
          >
            <Search className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          
          <button
            onClick={exportToExcel}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Export to Excel"
          >
            <Download className="w-4 h-4 md:w-5 md:h-5" />
          </button>
          
          <button
            onClick={onLogout}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded-lg transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header; 