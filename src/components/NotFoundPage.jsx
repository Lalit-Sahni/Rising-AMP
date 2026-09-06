import React from 'react';
import { Link } from 'react-router-dom';
import EmptyState from './EmptyState';

export default function NotFoundPage() {
  return (
    <div className="px-4 py-10 md:px-[26px]">
      <div className="max-w-xl mx-auto">
        <EmptyState
          title="Page not found"
          body="That link does not match a screen in RisingAMP. Jobs is a safe place to start."
          actionLabel="Go to Jobs"
          to="/"
        />
        <p className="text-center text-[12.5px] text-slate-400 mt-4">
          <Link to="/" className="underline">Jobs</Link>
        </p>
      </div>
    </div>
  );
}
