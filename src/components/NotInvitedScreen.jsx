import React from 'react';
import { HardHat } from 'lucide-react';

const NotInvitedScreen = ({ email, reason, onSignOut }) => {
  const setupIssue = reason === 'org-missing' || reason === 'lookup-failed';

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-2xl mb-4 shadow-lg">
            <HardHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Opal Track</h1>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-xl">
          <h2 className="text-xl font-semibold text-zinc-900 mb-3">
            {setupIssue ? 'Sign-in is not ready yet' : 'This account is not invited'}
          </h2>
          <p className="text-zinc-600 text-sm leading-relaxed">
            {setupIssue
              ? 'The copy does not have the family organisation set up, so nobody can open the jobs from Google yet. Nothing was created for this sign-in.'
              : 'That Google account is not on the family list, so the jobs were not opened. A mistyped login will not create a new empty folder.'}
          </p>
          {email && (
            <p className="mt-4 text-sm text-zinc-500">
              Signed in as <span className="font-medium text-zinc-800">{email}</span>
            </p>
          )}

          <button
            type="button"
            onClick={onSignOut}
            className="mt-6 w-full bg-accent hover:bg-accent-dark text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotInvitedScreen;
