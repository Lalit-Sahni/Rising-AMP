import React, { Suspense, lazy } from 'react';
import { useApp } from '../context/AppContext';
import LoadingSkeleton from './ui/LoadingSkeleton';
import JobsHomePage from './pages/JobsHomePage';

// Lazy load components for better performance
const AddExpensePage = lazy(() => import('./pages/AddExpensePage'));
const InvoiceManagementPage = lazy(() => import('./pages/InvoiceManagementPage'));
const HIAContractPage = lazy(() => import('./pages/HIAContractPage'));
const ClientManagerPage = lazy(() => import('./pages/ClientManagerPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const BudgetTrackingPage = lazy(() => import('./pages/BudgetTrackingPage'));

export default function MainContent() {
  const { currentPage } = useApp();
  
  const renderPage = () => {
    switch (currentPage) {
      case 'jobs':
        return <JobsHomePage />;
      case 'profile':
        return <ProfilePage />;
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
      default:
        return <JobsHomePage />;
    }
  };

  return (
    <div className="content flex-1 overflow-y-auto bg-canvas text-ink">
      <Suspense fallback={
        <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
          <div className="max-w-7xl mx-auto space-y-4">
            <LoadingSkeleton type="job" lines={4} />
          </div>
        </div>
      }>
        {renderPage()}
      </Suspense>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fadeIn { animation: fadeIn 0.3s; }`}</style>
    </div>
  );
}