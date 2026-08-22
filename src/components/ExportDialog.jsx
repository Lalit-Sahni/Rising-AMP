import React, { useState, useEffect } from 'react';
import { X, Download, FileText } from 'lucide-react';

const ExportDialog = ({ isOpen, onClose, onExport, expenseCount }) => {
  const [filename, setFilename] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      setFilename(`Expenses_Export_${dateStr}`);
    }
  }, [isOpen]);

  const handleExport = async () => {
    if (!filename.trim()) return;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-steel-900/40">
      <div className="bg-surface rounded-ot shadow-whisper w-full max-w-md border border-hairline">
        <div className="flex items-center justify-between p-5 border-b border-hairline">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Export to Excel</h2>
            <p className="text-sm text-slate-600 mt-0.5">Download expense data</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 grid place-items-center border border-hairline rounded-ot-sm text-slate-600 hover:text-ink"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-canvas rounded-ot-sm p-4 border border-hairline">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-ink">Export preview</span>
            </div>
            <p className="text-sm text-slate-600">
              {expenseCount} expense{expenseCount !== 1 ? 's' : ''} will be exported
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-2">Filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter filename..."
              className="w-full px-3 py-2 bg-canvas border border-hairline rounded-ot-sm text-ink placeholder-slate-400 focus:outline-none focus:border-accent"
              autoFocus
            />
            <p className="font-mono text-xs text-slate-400 mt-1">
              {filename || 'filename'}.xlsx
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-hairline">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-slate-600 hover:text-ink"
            disabled={isExporting}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={!filename.trim() || isExporting}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-accent hover:bg-accent-600 disabled:opacity-50 text-white text-[12.5px] font-medium rounded-ot-sm"
          >
            {isExporting ? 'Exporting…' : (
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
