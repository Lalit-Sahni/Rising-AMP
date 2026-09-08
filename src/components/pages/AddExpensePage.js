import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useApp } from '../../context/AppContext';
import { Camera, ChevronRight } from 'lucide-react';
import ExpenseCategoryGrid from '../ExpenseCategoryGrid';
import ExpenseModal from '../ExpenseModal';
import OCRScanner from '../OCRScanner';
import ErrorBoundary from '../ui/ErrorBoundary';
import EmptyState from '../EmptyState';

export default function AddExpensePage() {
  const { showToast, jobId, projectName, orgId, allowedJobs } = useApp();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({});
  const [uncertainFields, setUncertainFields] = useState({});
  const [ocrScannerOpen, setOcrScannerOpen] = useState(false);
  const [queuedFile, setQueuedFile] = useState(null);
  const [filing, setFiling] = useState(false);

  const openProposeModal = (extractedData, announce = true) => {
    setSelectedCategory(extractedData.category);
    setModalData({
      ...extractedData.formData,
      imageFile: extractedData.imageFile,
    });
    setUncertainFields(extractedData.uncertainFields || {});
    setModalOpen(true);
    if (announce) {
      showToast('Receipt read. Check the details, then save.', 'success');
    }
  };

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

  const handleOCRComplete = async (extractedData) => {
    if (!jobId) {
      openProposeModal(extractedData);
      return;
    }
    setFiling(true);
    try {
      const { fileExpenseFromScan } = await import('../../actions/fileThis');
      const result = await fileExpenseFromScan({
        jobId,
        orgId,
        allowedJobs,
        ocr: extractedData,
      });
      if (result.kind === 'applied') {
        showToast(result.message, 'success', {
          action: { label: 'Undo', onClick: result.undo },
        });
        return;
      }
      if (result.kind === 'error') {
        showToast(result.message, 'error');
        openProposeModal(extractedData, false);
        return;
      }
      openProposeModal(extractedData);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Could not file that receipt automatically. Check the details, then save.',
        'warning',
      );
      openProposeModal(extractedData, false);
    } finally {
      setFiling(false);
    }
  };

  const handleDroppedFile = useCallback(async (file) => {
    if (!file || !jobId) return;
    const { isPdfFile, filePdfAsUnreadableInvoice } = await import('../../actions/fileThis');
    if (isPdfFile(file)) {
      const saved = await filePdfAsUnreadableInvoice({ jobId, file });
      if (!saved.ok) {
        showToast(saved.message, 'error');
        return;
      }
      showToast('I cannot read that as a receipt. It is on Files as an invoice received.', 'info');
      return;
    }
    if (!String(file.type || '').startsWith('image/')) {
      showToast('Drop a photo of the receipt. PDFs are filed, not read.', 'info');
      return;
    }
    setQueuedFile(file);
    setOcrScannerOpen(true);
  }, [jobId, showToast]);

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles && acceptedFiles[0];
    if (file) handleDroppedFile(file);
  }, [handleDroppedFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    multiple: false,
    disabled: !jobId || filing,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
    },
  });

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

        <div
          {...getRootProps({
            className: `mb-[22px] rounded-ot border ${isDragActive ? 'border-accent' : 'border-hairline'}`,
          })}
        >
          <input {...getInputProps()} />
          <button
            type="button"
            onClick={() => {
              setQueuedFile(null);
              setOcrScannerOpen(true);
            }}
            disabled={filing}
            className="pressable w-full flex items-center gap-4 text-left bg-surface text-ink rounded-ot p-4 md:p-5 shadow-whisper"
          >
            <span className="w-12 h-12 rounded-[11px] bg-accent grid place-items-center shrink-0">
              <Camera className="w-6 h-6 text-white" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-extrabold">{filing ? 'Filing…' : 'Scan a receipt'}</b>
              <small className="block text-[12.5px] text-slate-500 mt-0.5">
                Take a photo or drop one here. We read the supplier, amount and date, and flag anything to check.
              </small>
            </span>
            <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" strokeWidth={1.8} />
          </button>
        </div>

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
            initialFile={queuedFile}
            onClose={() => {
              setOcrScannerOpen(false);
              setQueuedFile(null);
            }}
            onScanComplete={handleOCRComplete}
          />
        </ErrorBoundary>
      </div>
    </div>
  );
}
