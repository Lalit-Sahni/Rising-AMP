import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import ProfileSetupScreen from '../ProfileSetupScreen';

export default function ProfilePage() {
  const {
    authUser,
    profile,
    setProfile,
    showToast,
    onSignOut,
    setCurrentPage,
    membership,
    orgId,
  } = useApp();
  const isOwner = Boolean(membership && membership.role === 'owner' && orgId);
  // 'checking' until the org document answers. 'unknown' means the read failed,
  // which allows writes, so the box is ticked and the line says why.
  const [writesSetting, setWritesSetting] = useState('checking');
  const [writesBusy, setWritesBusy] = useState(false);
  const writesEnabled = writesSetting !== false;

  useEffect(() => {
    if (!isOwner) return undefined;
    let cancelled = false;
    import('../../firebase/assistantWrites').then(({ readAssistantWritesEnabled }) => (
      readAssistantWritesEnabled(orgId)
    )).then((setting) => {
      if (!cancelled) setWritesSetting(setting);
    }).catch(() => {
      if (!cancelled) setWritesSetting('unknown');
    });
    return () => {
      cancelled = true;
    };
  }, [isOwner, orgId]);

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
            <b className="block text-[13.5px] font-bold text-ink">Activity</b>
            <small className="block text-xs text-slate-400 mt-0.5">See every change, and undo it.</small>
          </button>
          {isOwner ? (
            <label className="mt-3 flex items-start gap-3 w-full bg-surface border border-hairline rounded-ot px-4 py-3.5 shadow-whisper">
              <input
                type="checkbox"
                className="mt-1"
                checked={writesEnabled}
                disabled={writesBusy || writesSetting === 'checking'}
                onChange={async (event) => {
                  const next = event.target.checked;
                  setWritesBusy(true);
                  try {
                    const { setAssistantWritesEnabled } = await import('../../firebase/assistantWrites');
                    await setAssistantWritesEnabled(orgId, next);
                    setWritesSetting(next);
                    showToast(
                      next
                        ? 'The assistant can write.'
                        : 'The assistant cannot write. You can still undo.',
                      'success',
                    );
                  } catch {
                    showToast('Could not save that setting.', 'error');
                  } finally {
                    setWritesBusy(false);
                  }
                }}
              />
              <span>
                <b className="block text-[13.5px] font-bold text-ink">Allow the assistant to write</b>
                <small className="block text-xs text-slate-400 mt-0.5">
                  {writesSetting === 'unknown'
                    ? 'Could not check this setting just now, so writes are allowed. Undo still works when this is off.'
                    : 'On unless you turn it off. Undo still works when this is off.'}
                </small>
              </span>
            </label>
          ) : null}
        </div>
      </div>
    </>
  );
}
