import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoadingSkeleton from './ui/LoadingSkeleton';
import RouteErrorBoundary from './ui/RouteErrorBoundary';
import JobsHomePage from './pages/JobsHomePage';
import NotFoundPage from './NotFoundPage';

const AddExpensePage = lazy(() => import('./pages/AddExpensePage'));
const InvoiceManagementPage = lazy(() => import('./pages/InvoiceManagementPage'));
const HIAContractPage = lazy(() => import('./pages/HIAContractPage'));
const ClientManagerPage = lazy(() => import('./pages/ClientManagerPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const FilesPage = lazy(() => import('./pages/FilesPage'));
const CostPlanPage = lazy(() => import('./pages/CostPlanPage'));
const BudgetTrackingPage = lazy(() => import('./pages/BudgetTrackingPage'));

function PageFallback() {
  return (
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-7xl mx-auto space-y-4">
        <LoadingSkeleton type="job" lines={4} />
      </div>
    </div>
  );
}

export default function MainContent() {
  return (
    <div className="content flex-1 overflow-y-auto bg-canvas text-ink">
      <RouteErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<JobsHomePage />} />
            <Route path="/jobs/:jobId" element={<DashboardPage />} />
            <Route path="/jobs/:jobId/expenses/new" element={<AddExpensePage />} />
            <Route path="/jobs/:jobId/invoices" element={<InvoiceManagementPage />} />
            <Route path="/jobs/:jobId/files" element={<FilesPage />} />
            <Route path="/jobs/:jobId/cost-plan" element={<CostPlanPage />} />
            <Route path="/jobs/:jobId/history" element={<HistoryPage />} />
            <Route path="/jobs/:jobId/budget" element={<BudgetTrackingPage />} />
            <Route path="/jobs/:jobId/contracts" element={<HIAContractPage />} />
            <Route path="/clients" element={<ClientManagerPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/privacy" element={<Navigate to="/privacy.html" replace />} />
            <Route path="/terms" element={<Navigate to="/terms.html" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fadeIn { animation: fadeIn 0.3s; }`}</style>
    </div>
  );
}
