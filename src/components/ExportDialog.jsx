import React, { useState, useEffect } from 'react';
import { X, Download, FileText } from 'lucide-react';

const ExportDialog = ({ isOpen, onClose, onExport, expenseCount }) => {
  const [filename, setFilename] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Generate default filename with current date
  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      setFilename(`Expenses_Export_${dateStr}`);
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!filename.trim()) {
      return; // Don't export if filename is empty
    }

    try {
      setIsExporting(true);
      await onExport(filename.trim());
      onClose();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && filename.trim()) {
      handleExport();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 rounded-xl shadow-lg w-full max-w-md border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Download className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Export to Excel</h2>
              <p className="text-sm text-slate-400">Download expense data</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Preview Info */}
          <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-slate-300">Export Preview</span>
            </div>
            <p className="text-sm text-slate-400">
              {expenseCount} expense{expenseCount !== 1 ? 's' : ''} will be exported
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Includes summary statistics and detailed expense data
            </p>
          </div>

          {/* Filename Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Filename
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter filename..."
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-1">
              File will be saved as {filename || 'filename'}.xlsx
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!filename.trim() || isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDialog;
