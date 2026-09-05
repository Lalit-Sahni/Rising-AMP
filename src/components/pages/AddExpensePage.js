import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Camera, ChevronRight } from 'lucide-react';
import ExpenseCategoryGrid from '../ExpenseCategoryGrid';
import ExpenseModal from '../ExpenseModal';
import OCRScanner from '../OCRScanner';
import ErrorBoundary from '../ui/ErrorBoundary';
import EmptyState from '../EmptyState';

export default function AddExpensePage() {
  const { showToast, jobId, projectName } = useApp();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({});
  const [uncertainFields, setUncertainFields] = useState({});
  const [ocrScannerOpen, setOcrScannerOpen] = useState(false);

  if (!jobId) {
    return (
      <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
        <EmptyState
          title="Open a job first"
          body="An expense is saved on one job. Pick the job, then add the expense."
          actionLabel="Jobs"
          to="/"
        />
      </div>
    );
  }

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setModalData({});
    setUncertainFields({});
    setModalOpen(true);
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
    showToast('Receipt read. Check the details, then save.', 'success');
  };

  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-[18px]">
          <div className="eyebrow">Record spend</div>
          <h1 className="text-[25px] font-extrabold tracking-tight mt-1">Add expense</h1>
          <p className="text-[13.5px] text-slate-600 mt-0.5">
            Saved on <span className="font-semibold text-ink">{projectName || 'this job'}</span>. Scan the receipt, or pick a category and type it in.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOcrScannerOpen(true)}
          className="pressable w-full flex items-center gap-4 text-left bg-steel-900 text-white rounded-ot p-4 md:p-5 mb-[22px] border border-steel-900"
        >
          <span className="w-12 h-12 rounded-[11px] bg-accent grid place-items-center shrink-0">
            <Camera className="w-6 h-6" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[15px] font-extrabold">Scan a receipt</b>
            <small className="block text-[12.5px] text-[#B4B9C1] mt-0.5">
              Take a photo. We read the supplier, amount and date, and flag anything to check.
            </small>
          </span>
          <ChevronRight className="w-5 h-5 text-[#767B84] shrink-0" strokeWidth={1.8} />
        </button>

        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-400 mb-3">Or pick a category</div>
        <ExpenseCategoryGrid onCategorySelect={handleCategorySelect} selectedCategory={selectedCategory} />

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
