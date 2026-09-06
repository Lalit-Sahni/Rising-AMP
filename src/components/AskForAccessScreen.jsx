import React from 'react';
import BrandMark from './BrandMark';

export default function AskForAccessScreen({ email, onSignOut }) {
  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-surface border border-hairline rounded-ot p-8 shadow-whisper text-center">
        <div className="flex justify-center mb-4">
          <BrandMark size={40} icon={20} />
        </div>
        <h1 className="text-[20px] font-extrabold tracking-tight">Ask us for access</h1>
        <p className="text-[13.5px] text-slate-600 mt-3">
          You are signed in{email ? ` as ${email}` : ''}, but you are not on a company yet.
          Ask the owner to invite this email onto a job. Nothing here is shared until that happens.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3.5 py-2 rounded-ot-sm border border-hairline text-sm font-semibold"
          >
            Check again
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="px-3.5 py-2 rounded-ot-sm bg-accent hover:bg-accent-600 text-white text-sm font-bold"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
