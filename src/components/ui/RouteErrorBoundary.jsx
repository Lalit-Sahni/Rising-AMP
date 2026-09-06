import React from 'react';
import { Link } from 'react-router-dom';
import ErrorBoundary from './ErrorBoundary';

export default function RouteErrorBoundary({ children }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="px-4 py-10 md:px-[26px]">
          <div className="max-w-md mx-auto bg-surface border border-hairline rounded-ot p-8 text-center shadow-whisper">
            <h2 className="text-[18px] font-extrabold text-ink mb-2">This screen hit a problem</h2>
            <p className="text-[13.5px] text-slate-600 mb-4">
              The rest of the app is still there. Go back to Jobs and try this page again.
            </p>
            <Link
              to="/"
              className="inline-flex px-3.5 py-2 rounded-ot-sm bg-accent hover:bg-accent-600 text-white text-sm font-bold"
            >
              Go to Jobs
            </Link>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
