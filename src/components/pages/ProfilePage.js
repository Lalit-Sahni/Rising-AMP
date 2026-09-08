import React from 'react';
import { useApp } from '../../context/AppContext';
import ProfileSetupScreen from '../ProfileSetupScreen';

export default function ProfilePage() {
  const { authUser, profile, setProfile, showToast, onSignOut, setCurrentPage } = useApp();

  if (!authUser) return null;

  return (
    <>
      <ProfileSetupScreen
        user={authUser}
        initialProfile={profile}
        editing
        onSignOut={onSignOut}
        onComplete={(saved) => {
          setProfile(saved);
          showToast('Profile saved.', 'success');
        }}
      />
      <div className="px-4 md:px-[26px] pb-6">
        <div className="max-w-[600px] mx-auto">
          <button
            type="button"
            onClick={() => setCurrentPage('assistant-activity')}
            className="w-full text-left bg-surface border border-hairline rounded-ot px-4 py-3.5 shadow-whisper hover:border-[#D6D9DD]"
          >
            <b className="block text-[13.5px] font-bold text-ink">What the assistant did</b>
            <small className="block text-xs text-slate-400 mt-0.5">See every write, and undo it.</small>
          </button>
        </div>
      </div>
    </>
  );
}
