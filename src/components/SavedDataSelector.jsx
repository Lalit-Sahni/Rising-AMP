import React, { useState } from 'react';
import { ChevronDown, Search, User, Building, Briefcase, Wrench, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

const SavedDataSelector = ({ 
  type, // 'company', 'project', 'labour', 'trade'
  onSelect, 
  placeholder = "Select saved data...",
  className = "",
  showDelete = false
}) => {
  const { 
    savedCompanies, 
    savedProjects, 
    savedLabour, 
    savedTrades,
    deleteLabourFromFirebase,
    deleteTradeFromFirebase,
    deleteProjectFromFirebase,
    deleteClientFromFirebase,
    showToast
  } = useApp();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Get the appropriate data based on type
  const getData = () => {
    switch (type) {
      case 'company':
        return savedCompanies || [];
      case 'project':
        return savedProjects || [];
      case 'labour':
        return savedLabour || [];
      case 'trade':
        return savedTrades || [];
      default:
        return [];
    }
  };

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'company':
        return Building;
      case 'project':
        return Briefcase;
      case 'labour':
        return User;
      case 'trade':
        return Wrench;
      default:
        return Search;
    }
  };

  // Get display label for item
  const getDisplayLabel = (item) => {
    switch (type) {
      case 'company':
        return item.name;
      case 'project':
        return item.name;
      case 'labour':
        return `${item.name} (${item.role}) - $${item.rate}/hr`;
      case 'trade':
        return `${item.tradeName} (${item.tradeCategory})`;
      default:
        return item.name || item.tradeName || 'Unknown';
    }
  };

  // Filter data based on search term
  const filteredData = (getData() || []).filter(item => {
    if (!item) return false;
    const label = getDisplayLabel(item).toLowerCase();
    return label.includes(searchTerm.toLowerCase());
  });

  const Icon = getIcon();

  const handleSelect = (item) => {
    onSelect(item);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleDelete = async (item, e) => {
    e.stopPropagation(); // Prevent triggering the select
    
    if (!window.confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) {
      return;
    }

    try {
      let result;
      switch (type) {
        case 'labour':
          result = await deleteLabourFromFirebase(item.id);
          break;
        case 'trade':
          result = await deleteTradeFromFirebase(item.id);
          break;
        case 'project':
          result = await deleteProjectFromFirebase(item.id);
          break;
        case 'company':
          result = await deleteClientFromFirebase(item.id);
          break;
        default:
          showToast('Delete not supported for this type', 'error');
          return;
      }

      if (result.success) {
        // The state will be updated automatically by the delete functions
        setIsOpen(false);
        setSearchTerm('');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      showToast('Error deleting item', 'error');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white hover:bg-slate-600 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-sm">{placeholder}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-50 max-h-60 overflow-hidden">
          {/* Search input */}
          <div className="p-3 border-b border-slate-600">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${type}s...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* Data list */}
          <div className="max-h-48 overflow-y-auto">
            {filteredData.length > 0 ? (
              filteredData.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors border-b border-slate-600 last:border-b-0"
                >
                  <button
                    onClick={() => handleSelect(item)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{getDisplayLabel(item)}</span>
                  </button>
                  {showDelete && (
                    <button
                      onClick={(e) => handleDelete(item, e)}
                      className="ml-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-900/20 rounded transition-colors"
                      title={`Delete ${type}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">
                {searchTerm ? 'No results found' : `No saved ${type}s`}
              </div>
            )}
          </div>

          {/* Close button */}
          <div className="p-2 border-t border-slate-600">
            <button
              onClick={handleClose}
              className="w-full px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={handleClose}
        />
      )}
    </div>
  );
};

export default SavedDataSelector; 