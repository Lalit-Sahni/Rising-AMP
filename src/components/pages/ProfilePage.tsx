/**
 * Your profile. Lazy route — keep this off first paint.
 * Private fields here are yours (profiles/{uid}). Nobody else’s.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { permissionDeniedMessage } from '../../firebase/permissionMessage';
import { normalizeEmail } from '../../firebase/emailAddress';
import {
  avatarColor,
  ownProfileModel,
  personInitials,
  signInMethodLabel,
  type PeopleJob,
  type PersonRow,
} from '../../domain/peoplePage';
import ProfileSetupScreen from '../ProfileSetupScreen';

function RolePill({ role, label }: { role: PersonRow['role']; label: string }) {
  const cls = {
    owner: 'bg-accent-tint text-accent-600',
    manager: 'bg-[#EDEFF2] text-ink',
    site: 'border border-hairline bg-transparent text-slate-600',
    viewer: 'border border-dashed border-[#D5D9DE] bg-transparent text-slate-400',
    none: 'bg-warn-tint text-[#8A6418]',
  }[role];
  return (
    <span className={`inline-block text-[9.5px] font-extrabold tracking-[0.1em] uppercase px-2 py-1 rounded-[5px] whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

type AuthUser = {
  email?: string | null;
  displayName?: string | null;
  providerData?: Array<{ providerId?: string | null } | null> | null;
};

type OwnProfile = {
  displayName?: string;
  photoUrl?: string;
  email?: string;
} | null;

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
    allowedJobs,
  } = useApp() as {
    authUser: AuthUser | null;
    profile: OwnProfile;
    setProfile: (saved: unknown) => void;
    showToast: (message: string, type?: string) => void;
    onSignOut: () => void;
    setCurrentPage: (page: string) => void;
    membership: {
      role?: string;
      email?: string;
      ownerEmail?: string;
    } | null;
    orgId: string | null;
    allowedJobs: PeopleJob[];
  };
  const isOwner = Boolean(membership && membership.role === 'owner' && orgId);
  // 'checking' until the org document answers. 'unknown' means the read failed,
  // which allows writes, so the box is ticked and the line says why.
  const [writesSetting, setWritesSetting] = useState<boolean | 'checking' | 'unknown'>('checking');
  const [writesBusy, setWritesBusy] = useState(false);
  const writesEnabled = writesSetting !== false;

  const email = normalizeEmail(authUser?.email || membership?.email || profile?.email);
  const displayName = String(profile?.displayName || authUser?.displayName || '').trim() || email;
  const photoUrl = String(profile?.photoUrl || '').trim();
  const own = useMemo(
    () => ownProfileModel({
      jobs: Array.isArray(allowedJobs) ? allowedJobs : [],
      email,
      ownerEmail: membership?.ownerEmail,
      membershipRole: membership?.role,
    }),
    [allowedJobs, email, membership?.ownerEmail, membership?.role],
  );
  const signInLabel = signInMethodLabel(authUser?.providerData);

  useEffect(() => {
    if (!isOwner) return undefined;
    let cancelled = false;
    import('../../firebase/assistantWrites').then(({ readAssistantWritesEnabled }) => (
      readAssistantWritesEnabled(String(orgId || ''))
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
    <div className="text-ink px-4 py-6 md:px-[26px] md:py-[26px]">
      <div className="max-w-[600px] mx-auto">
        <div className="eyebrow">You</div>
        <header className="flex items-start gap-3 mt-2">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="w-[42px] h-[42px] rounded-full object-cover shrink-0" />
          ) : (
            <span
              className="w-[42px] h-[42px] rounded-full shrink-0 grid place-items-center font-bold text-white tracking-wide text-[14px]"
              style={{ background: avatarColor(email) }}
            >
              {personInitials(displayName, email)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-extrabold tracking-tight text-ink">{displayName}</h1>
            {email ? (
              <small className="block text-[12px] text-slate-400 mt-0.5 truncate">{email}</small>
            ) : null}
            <div className="mt-2">
              <RolePill role={own.role} label={own.roleLabel} />
            </div>
          </div>
        </header>
        <p className="text-[12.5px] text-slate-500 mt-3 leading-snug">{own.jobsLabel}</p>
        {signInLabel ? (
          <p className="text-[13px] text-slate-600 mt-3">You sign in with {signInLabel}.</p>
        ) : null}
        <p className="mt-3">
          <Link
            to={own.peopleHref}
            className="text-[13px] font-bold text-accent-600 hover:text-accent"
          >
            View in People
          </Link>
        </p>

        <ProfileSetupScreen
          user={authUser}
          initialProfile={profile}
          editing
          embedded
          onSignOut={onSignOut}
          onComplete={(saved: unknown) => {
            setProfile(saved);
            showToast('Profile saved.', 'success');
          }}
        />

        <div className="mt-4">
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
                    await setAssistantWritesEnabled(String(orgId || ''), next);
                    setWritesSetting(next);
                    showToast(
                      next
                        ? 'The assistant can write.'
                        : 'The assistant cannot write. You can still undo.',
                      'success',
                    );
                  } catch (err) {
                    showToast(permissionDeniedMessage(err), 'error');
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
    </div>
  );
}
