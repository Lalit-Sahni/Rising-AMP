import React, { useEffect, useRef, useState } from 'react';
import { Camera, Plus } from 'lucide-react';
import BrandMark from './BrandMark';
import { AuthField, AuthInput } from './AuthShell';
import { emptyProfile, ROLES, STATES, saveProfile, uploadProfilePhoto } from '../firebase/profiles';
import { friendlyAuthError, isValidPassword, linkPasswordToGoogleUser } from '../firebase/auth';

function AddPasswordCard({ user }) {
  const providers = (user && user.providerData) || [];
  const hasPassword = providers.some((row) => row.providerId === 'password');
  const hasGoogle = providers.some((row) => row.providerId === 'google.com');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(hasPassword);

  if (!hasGoogle) return null;
  if (done) {
    if (hasPassword) return null;
    return (
      <section className="bg-surface border border-hairline rounded-ot p-5 shadow-whisper mt-4">
        <p className="text-pos text-sm">Password added. You can sign in with email next time.</p>
      </section>
    );
  }

  const save = async () => {
    setError('');
    if (!isValidPassword(password)) {
      setError('Use at least 8 characters, and include a number.');
      return;
    }
    setSaving(true);
    try {
      const result = await linkPasswordToGoogleUser(password);
      if (!result.success) {
        setError(friendlyAuthError(result.code, result.error, 'signup'));
        return;
      }
      setDone(true);
      setPassword('');
    } catch (err) {
      setError(friendlyAuthError(err.code, err.message, 'signup'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-surface border border-hairline rounded-ot p-5 shadow-whisper mb-4">
      <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-400 mb-1">Sign-in</div>
      <p className="text-sm text-slate-600 mb-4">
        You signed in with Google. Add a password if you also want to use email and password next time.
      </p>
      {error && <p className="text-neg text-sm mb-3">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
        <div className="flex-1">
          <AuthField label="Password">
            <AuthInput
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </AuthField>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="bg-accent hover:bg-accent-600 text-white font-bold text-sm px-[22px] py-3 rounded-[10px] disabled:opacity-50 mb-3.5"
        >
          {saving ? 'Saving…' : 'Add password'}
        </button>
      </div>
    </section>
  );
}

export default function ProfileSetupScreen({ user, initialProfile, onComplete, onSignOut, editing = false }) {
  const [form, setForm] = useState(() => ({ ...emptyProfile(user), ...(initialProfile || {}) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoNote, setPhotoNote] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    setForm({ ...emptyProfile(user), ...(initialProfile || {}) });
  }, [user, initialProfile]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handlePhoto = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file || !user) return;
    const preview = URL.createObjectURL(file);
    setForm((current) => ({ ...current, photoUrl: preview }));
    const uploaded = await uploadProfilePhoto(user.uid, file);
    if (uploaded.success) {
      setForm((current) => ({ ...current, photoUrl: uploaded.url }));
      setPhotoNote('');
    } else {
      setPhotoNote(uploaded.error);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!String(form.displayName || '').trim()) {
      setError('Add your name so people on a job know who you are.');
      return;
    }
    if (!String(form.businessName || '').trim()) {
      setError('Add a business name. You can change it later.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveProfile(user.uid, {
        ...form,
        email: user.email,
        setupComplete: true,
      });
      onComplete(saved);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={editing ? 'text-ink px-4 py-6 md:px-[26px] md:py-[26px]' : 'auth-frame min-h-screen bg-canvas text-ink px-4 py-8 md:px-10 md:py-10'}>
      <div className="max-w-[600px] mx-auto">
        <div className="flex items-center justify-between">
          {editing ? (
            <div>
              <div className="eyebrow">Account</div>
              <h1 className="text-[25px] font-extrabold tracking-tight mt-1">Your profile</h1>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 font-extrabold text-[15px]">
              <BrandMark size={28} icon={16} />
              RisingAMP
            </div>
          )}
          {!editing && (
            <span className="text-[11px] font-bold text-slate-500 bg-surface border border-hairline px-2.5 py-1 rounded-full">
              Step 2 of 2
            </span>
          )}
        </div>

        {!editing && (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight mt-6">Set up your account</h1>
            <p className="text-slate-600 text-sm mt-1.5 mb-6">
              A few details so your invoices and reports are ready to go. You can change any of it later.
            </p>
          </>
        )}
        {editing && (
          <p className="text-slate-600 text-[13.5px] mt-1.5 mb-6">
            This is what people see when they look at a job you are on.
          </p>
        )}

        {error && (
          <div className="bg-accent-tint border border-hairline rounded-[10px] p-3 mb-4">
            <p className="text-neg text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-4 mb-6">
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              className="relative w-[76px] h-[76px] rounded-full bg-canvas border border-hairline grid place-items-center overflow-hidden shrink-0"
            >
              {form.photoUrl ? (
                <img src={form.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-[26px] h-[26px] text-slate-400" strokeWidth={1.6} />
              )}
              <span className="absolute right-[-2px] bottom-[-2px] w-[26px] h-[26px] rounded-full bg-accent border-2 border-white grid place-items-center text-white">
                <Plus className="w-[13px] h-[13px]" strokeWidth={2} />
              </span>
            </button>
            <div>
              <b className="block text-sm font-bold">Add a photo</b>
              <small className="block text-xs text-slate-400">JPG or PNG, optional</small>
              {photoNote && <small className="block text-xs text-warn mt-1">{photoNote}</small>}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto} />
          </div>

          <section className="bg-surface border border-hairline rounded-ot p-5 shadow-whisper mb-4">
            <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-400 mb-4">Your details</div>
            <AuthField label="Full name">
              <AuthInput
                placeholder="Your name"
                value={form.displayName}
                onChange={(event) => setField('displayName', event.target.value)}
              />
            </AuthField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <AuthField label="Role">
                <div className="relative">
                  <select
                    value={form.role}
                    onChange={(event) => setField('role', event.target.value)}
                    className="w-full appearance-none border border-hairline rounded-[10px] py-3 px-3 pr-8 text-sm bg-white focus:outline-none focus:border-accent"
                  >
                    {ROLES.map((role) => (
                      <option key={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </AuthField>
              <AuthField label="Mobile">
                <AuthInput
                  lead={<span className="text-[13px] text-slate-500 font-semibold">+61</span>}
                  placeholder="4XX XXX XXX"
                  value={form.mobile}
                  onChange={(event) => setField('mobile', event.target.value)}
                />
              </AuthField>
            </div>
          </section>

          <section className="bg-surface border border-hairline rounded-ot p-5 shadow-whisper mb-4">
            <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-slate-400 mb-4">Your business</div>
            <AuthField label="Business name">
              <AuthInput
                placeholder="Your company"
                value={form.businessName}
                onChange={(event) => setField('businessName', event.target.value)}
              />
            </AuthField>
            <AuthField label="ABN" hint="Shows on the invoices you send.">
              <AuthInput
                placeholder="12 345 678 901"
                value={form.abn}
                onChange={(event) => setField('abn', event.target.value)}
              />
            </AuthField>
            <AuthField label="Street address">
              <AuthInput
                placeholder="Unit / Street"
                value={form.street}
                onChange={(event) => setField('street', event.target.value)}
              />
            </AuthField>
            <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_.8fr_.8fr] gap-3.5">
              <AuthField label="Suburb">
                <AuthInput
                  placeholder="Suburb"
                  value={form.suburb}
                  onChange={(event) => setField('suburb', event.target.value)}
                />
              </AuthField>
              <AuthField label="State">
                <select
                  value={form.state}
                  onChange={(event) => setField('state', event.target.value)}
                  className="w-full appearance-none border border-hairline rounded-[10px] py-3 px-3 text-sm bg-white focus:outline-none focus:border-accent"
                >
                  {STATES.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </AuthField>
              <AuthField label="Postcode">
                <AuthInput
                  placeholder="2000"
                  value={form.postcode}
                  onChange={(event) => setField('postcode', event.target.value)}
                />
              </AuthField>
            </div>
          </section>

          <div className="flex items-center justify-between gap-3 mt-2">
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className={editing
                  ? 'inline-flex items-center px-3.5 py-2 rounded-[10px] border border-hairline bg-surface text-[13px] font-semibold text-slate-600 hover:text-neg hover:border-[#D6D9DD]'
                  : 'text-xs text-slate-400'}
              >
                Sign out
              </button>
            ) : (
              <small className="text-xs text-slate-400">You can change these later in Profile.</small>
            )}
            <button
              type="submit"
              disabled={saving}
              className="bg-accent hover:bg-accent-600 text-white font-bold text-sm px-[22px] py-3 rounded-[10px] disabled:opacity-50"
            >
              {saving ? 'Saving…' : editing ? 'Save profile' : 'Finish setup'}
            </button>
          </div>
        </form>
        {editing && <AddPasswordCard user={user} />}
      </div>
    </div>
  );
}
