import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Zap } from 'lucide-react';
import ExpenseCategoryGrid from '../ExpenseCategoryGrid';
import ExpenseModal from '../ExpenseModal';
import OCRScanner from '../OCRScanner';
import ErrorBoundary from '../ui/ErrorBoundary';

export default function AddExpensePage() {
  const { showToast, projectId, setCurrentPage } = useApp();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({});
  const [uncertainFields, setUncertainFields] = useState({});
  const [ocrScannerOpen, setOcrScannerOpen] = useState(false);

  if (!projectId) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <div className="eyebrow">Record spend</div>
        <h1 className="text-[25px] font-extrabold tracking-tight mt-1">Add expense</h1>
        <p className="text-[13.5px] text-slate-600 mt-2">Open a job first so the expense is saved on the right list.</p>
        <button
          type="button"
          onClick={() => setCurrentPage('jobs')}
          className="mt-4 inline-flex items-center bg-accent hover:bg-accent-600 text-white text-[13px] font-bold px-[15px] py-[9px] rounded-[9px]"
        >
          Jobs
        </button>
      </div>
    );
  }

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setModalData({});
    setUncertainFields({});
    setModalOpen(true);
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'scan':
        setOcrScannerOpen(true);
        break;
      case 'import':
        showToast('📥 CSV Import feature coming soon!', 'info');
        break;
      case 'quick':
        showToast('⚡ Quick Entry mode activated!', 'info');
        break;
      default:
        break;
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedCategory(null);
    setModalData({});
    setUncertainFields({});
  };

  const handleOCRComplete = (extractedData) => {
    setSelectedCategory(extractedData.category);
    setModalData({
      ...extractedData.formData,
      imageFile: extractedData.imageFile,
    });
    setUncertainFields(extractedData.uncertainFields || {});
    setModalOpen(true);
    showToast('✅ Invoice data extracted successfully!', 'success');
  };

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-[22px]">
          <div>
            <div className="eyebrow">Record spend</div>
            <h1 className="text-[26px] font-bold tracking-tight mt-1">Add expense</h1>
            <p className="text-[13.5px] text-slate-600 mt-0.5">Pick a category or scan a receipt.</p>
          </div>
          <button
            className="hidden lg:inline-flex items-center gap-2 px-3.5 py-2 bg-accent hover:bg-accent-600 text-white text-[12.5px] font-medium rounded-ot-sm"
            onClick={() => handleQuickAction('quick')}
          >
            <Zap className="w-4 h-4" />
            Quick add
          </button>
        </div>

        <div>
          <ExpenseCategoryGrid
            onCategorySelect={handleCategorySelect}
            onQuickAction={handleQuickAction}
            selectedCategory={selectedCategory}
          />
        </div>

        <ErrorBoundary>
          <ExpenseModal
            isOpen={modalOpen}
            onClose={handleModalClose}
            category={selectedCategory}
            initialData={modalData}
            uncertainFields={uncertainFields}
          />
        </ErrorBoundary>

        <ErrorBoundary>
          <OCRScanner
            isOpen={ocrScannerOpen}
            onClose={() => setOcrScannerOpen(false)}
            onScanComplete={handleOCRComplete}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
