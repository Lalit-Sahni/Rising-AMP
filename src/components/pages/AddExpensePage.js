import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { DollarSign, FileText, Zap } from 'lucide-react';
import ExpenseCategoryGrid from '../ExpenseCategoryGrid';
import ExpenseModal from '../ExpenseModal';
import OCRScanner from '../OCRScanner';
import ErrorBoundary from '../ui/ErrorBoundary';

export default function AddExpensePage() {
  const { showToast } = useApp();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState({});
  const [ocrScannerOpen, setOcrScannerOpen] = useState(false);

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    setModalData({});
    setModalOpen(true);
  };

  const handleQuickAction = (action) => {
    switch (action) {
      case 'scan':
        setOcrScannerOpen(true);
        break;
      case 'import':
        showToast('📥 CSV Import feature coming soon!', 'info');
        // Future: Open file picker for CSV import
        break;
      case 'quick':
        showToast('⚡ Quick Entry mode activated!', 'info');
        // Future: Open simplified quick entry form
        break;
      default:
        break;
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedCategory(null);
    setModalData({});
  };

  const handleOCRComplete = (extractedData) => {
    // Auto-select the detected category
    setSelectedCategory(extractedData.category);
    
    // Pre-fill the modal with extracted data and include the image file
    setModalData({
      ...extractedData.formData,
      imageFile: extractedData.imageFile // Pass the image file for storage
    });
    
    // Open the expense modal
    setModalOpen(true);
    
    showToast('✅ Invoice data extracted successfully!', 'success');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Ambient Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-green-500/5 blur-3xl"></div>
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      
      <div className="relative max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        {/* Enhanced Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent tracking-tight">
                  Add New Expense
                </h1>
                <p className="text-slate-400 text-lg font-medium mt-1">
                  Track construction expenses with intelligent categorization
                </p>
              </div>
            </div>
          </div>
          
          {/* Status Indicator */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="glass-card px-6 py-3 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 shadow-xl">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-30"></div>
                </div>
                <span className="text-white font-semibold text-sm tracking-wide">READY TO ADD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Container - Fixed hover effect */}
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-6 lg:p-8 shadow-2xl shadow-black/20 transition-all duration-700 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
          {/* Primary Action Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Primary Actions</h2>
                <p className="text-slate-400 font-medium">Choose your preferred expense entry method</p>
              </div>
            </div>
            
            {/* Floating Action Button */}
            <button 
              className="hidden lg:flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-2xl shadow-xl shadow-blue-500/25 hover:shadow-2xl hover:shadow-blue-500/40 hover:scale-105 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
              onClick={() => handleQuickAction('quick')}
            >
              <Zap className="w-5 h-5" />
              <span className="tracking-wide">Quick Add</span>
            </button>
          </div>
          
          {/* Category Grid */}
          <ExpenseCategoryGrid
            onCategorySelect={handleCategorySelect}
            onQuickAction={handleQuickAction}
            selectedCategory={selectedCategory}
          />
        </div>

        {/* Expense Modal */}
        <ErrorBoundary>
          <ExpenseModal
            isOpen={modalOpen}
            onClose={handleModalClose}
            category={selectedCategory}
            initialData={modalData}
          />
        </ErrorBoundary>
        
        {/* OCR Scanner */}
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