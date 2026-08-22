import React, { Suspense, lazy } from 'react';
import { useApp } from '../context/AppContext';
import LoadingSkeleton from './ui/LoadingSkeleton';

// Lazy load components for better performance
const AddExpensePage = lazy(() => import('./pages/AddExpensePage'));
const InvoiceManagementPage = lazy(() => import('./pages/InvoiceManagementPage'));
const HIAContractPage = lazy(() => import('./pages/HIAContractPage'));
const ClientManagerPage = lazy(() => import('./pages/ClientManagerPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const BudgetTrackingPage = lazy(() => import('./pages/BudgetTrackingPage'));
const OCRTest = lazy(() => import('./OCRTest'));
const EnhancedOCRTest = lazy(() => import('./EnhancedOCRTest'));

export default function MainContent() {
  const { currentPage } = useApp();
  
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'add-expense':
        return <AddExpensePage />;
      case 'history':
        return <HistoryPage />;
      case 'budget-tracking':
        return <BudgetTrackingPage />;
      case 'new-invoice':
        return <InvoiceManagementPage />;
      case 'hia-contract':
        return <HIAContractPage />;
      case 'client-manager':
        return <ClientManagerPage />;
      case 'ocr-test':
        return <OCRTest />;
      case 'enhanced-ocr-test':
        return <EnhancedOCRTest />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="content flex-1 overflow-y-auto p-4 md:p-8 bg-white text-zinc-900 animate-fadeIn">
      <Suspense fallback={
        <div className="space-y-6">
          <LoadingSkeleton type="card" lines={4} />
          <LoadingSkeleton type="card" lines={3} />
          <LoadingSkeleton type="card" lines={2} />
        </div>
      }>
        {renderPage()}
      </Suspense>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fadeIn { animation: fadeIn 0.3s; }`}</style>
    </div>
  );
}