import React from 'react';
import BrandMark from './BrandMark';

const NotInvitedScreen = ({ email, reason, onSignOut }) => {
  const setupIssue = reason === 'org-missing' || reason === 'lookup-failed';

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
      <div className="w-full max-w-[400px] bg-surface border border-hairline rounded-2xl shadow-whisper px-10 py-12">
        <div className="text-center mb-7">
          <BrandMark size={44} icon={22} className="mx-auto mb-6" />
          <h1 className="text-[21px] font-semibold tracking-tight text-ink">
            {setupIssue ? 'Sign-in is not ready yet' : 'This account is not invited'}
          </h1>
        </div>

        <p className="text-[13.5px] text-slate-600 leading-relaxed">
          {setupIssue
            ? 'The copy does not have the family organisation set up, so nobody can open the jobs from Google yet. Nothing was created for this sign-in.'
            : 'That Google account is not on the family list, so the jobs were not opened. A mistyped login will not create a new empty folder.'}
        </p>
        {email && (
          <p className="mt-4 text-sm text-slate-400">
            Signed in as <span className="font-mono text-ink">{email}</span>
          </p>
        )}

        <button
          type="button"
          onClick={onSignOut}
          className="mt-7 w-full bg-accent hover:bg-accent-600 text-white font-medium text-[13px] py-2.5 px-4 rounded-ot-sm transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default NotInvitedScreen;
