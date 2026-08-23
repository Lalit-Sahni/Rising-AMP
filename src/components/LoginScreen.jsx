import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import {
  friendlyAuthError,
  isValidEmail,
  isValidPassword,
  loginWithGoogle,
  sendResetPassword,
  signInWithEmail,
  signUpWithEmail,
} from '../firebase/auth';
import { GoogleMark } from './BrandMark';
import AuthShell, { AuthField, AuthInput } from './AuthShell';

function modeFromLocation(fallback = 'signin') {
  if (typeof window === 'undefined') return fallback;
  const params = new URLSearchParams(window.location.search);
  if (params.has('reset')) return 'forgot';
  if (params.get('mode') === 'signup' || params.has('signup')) return 'signup';
  return fallback;
}

export default function LoginScreen({ initialMode = 'signin' }) {
  const [mode, setMode] = useState(() => modeFromLocation(initialMode));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setInfo('');
    setPassword('');
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const result = await loginWithGoogle();
      if (result.cancelled) return;
      if (!result.success) {
        setError(friendlyAuthError(result.code, result.error, mode));
      }
    } catch (err) {
      setError(friendlyAuthError(err.code, err.message, mode));
    } finally {
      setLoading(false);
    }
  };

  const handleEmail = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    if (!isValidEmail(email)) {
      setError('Enter a real email address — any domain is fine.');
      return;
    }
    if (mode !== 'forgot' && !isValidPassword(password)) {
      setError('Use at least 8 characters, and include a number.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'forgot') {
        const result = await sendResetPassword(email);
        if (!result.success) {
          setError(friendlyAuthError(result.code, result.error, 'signin'));
        } else {
          setInfo('If that email has an account, we sent a reset link. Check your inbox.');
        }
        return;
      }
      const result = mode === 'signup'
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      if (!result.success) {
        setError(friendlyAuthError(result.code, result.error, mode));
      }
    } catch (err) {
      setError(friendlyAuthError(err.code, err.message, mode));
    } finally {
      setLoading(false);
    }
  };

  const isForgot = mode === 'forgot';
  const isSignup = mode === 'signup';
  const panelMode = isSignup ? 'signup' : 'signin';

  return (
    <AuthShell mode={panelMode}>
      <h1 className="text-[25px] font-extrabold tracking-tight max-[859px]:text-center">
        {isForgot ? 'Reset your password' : isSignup ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="text-slate-600 text-sm mt-1.5 mb-[26px] max-[859px]:text-center">
        {isForgot
          ? 'We’ll send a reset link to any email you signed up with.'
          : isSignup
            ? 'Start tracking your jobs in a couple of minutes.'
            : 'Sign in to keep your jobs in the black.'}
      </p>

      {error && (
        <div className="bg-accent-tint border border-hairline rounded-[10px] p-3 mb-4">
          <p className="text-neg text-sm">{error}</p>
        </div>
      )}
      {info && (
        <div className="bg-pos-tint border border-hairline rounded-[10px] p-3 mb-4">
          <p className="text-pos text-sm">{info}</p>
        </div>
      )}

      {!isForgot && (
        <>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-[10px] border border-hairline bg-white text-sm font-semibold text-ink hover:bg-[#FCFCFD] hover:border-[#D6D9DD] disabled:opacity-50"
          >
            {loading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-ink" />
            ) : (
              <GoogleMark />
            )}
            {isSignup ? 'Sign up with Google' : 'Continue with Google'}
          </button>
          <div className="flex items-center gap-3 text-[11.5px] text-slate-400 font-semibold my-5">
            <span className="flex-1 h-px bg-hairline" />
            or
            <span className="flex-1 h-px bg-hairline" />
          </div>
        </>
      )}

      <form onSubmit={handleEmail}>
        <AuthField label="Email">
          <AuthInput
            lead={<Mail className="w-[17px] h-[17px]" strokeWidth={1.7} />}
            type="email"
            autoComplete="email"
            placeholder="you@company.com.au"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </AuthField>

        {!isForgot && (
          <AuthField
            label="Password"
            extra={
              !isSignup && (
                <button
                  type="button"
                  className="text-xs text-accent font-semibold"
                  onClick={() => switchMode('forgot')}
                >
                  Forgot password?
                </button>
              )
            }
            hint={isSignup ? 'At least 8 characters, with a number.' : undefined}
          >
            <AuthInput
              lead={<Lock className="w-[17px] h-[17px]" strokeWidth={1.7} />}
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder={isSignup ? 'Create a password' : 'Your password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              trail={(
                <button
                  type="button"
                  className="ml-2.5 text-slate-400 grid place-items-center"
                  onClick={() => setShowPassword((open) => !open)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff className="w-[17px] h-[17px]" strokeWidth={1.7} />
                    : <Eye className="w-[17px] h-[17px]" strokeWidth={1.7} />}
                </button>
              )}
            />
          </AuthField>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-accent hover:bg-accent-600 text-white font-bold text-sm py-[13px] rounded-[10px] disabled:opacity-50"
        >
          {loading
            ? 'Please wait…'
            : isForgot
              ? 'Send reset link'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-[13px] text-slate-600 mt-5 max-[859px]:mt-auto max-[859px]:pt-[18px]">
        {isForgot ? (
          <>
            Remembered it?{' '}
            <button type="button" className="text-accent font-bold" onClick={() => switchMode('signin')}>
              Sign in
            </button>
          </>
        ) : isSignup ? (
          <>
            Already have an account?{' '}
            <button type="button" className="text-accent font-bold" onClick={() => switchMode('signin')}>
              Sign in
            </button>
          </>
        ) : (
          <>
            New to RisingAMP?{' '}
            <button type="button" className="text-accent font-bold" onClick={() => switchMode('signup')}>
              Create an account
            </button>
          </>
        )}
      </p>

      {!isForgot && (
        <p className="text-[11px] text-slate-400 mt-[26px] leading-relaxed">
          {isSignup
            ? 'By creating an account you agree to the '
            : 'By continuing you agree to the '}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-slate-600 underline">
            Terms
          </a>
          {' '}and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-slate-600 underline">
            Privacy Policy
          </a>
          {isSignup ? '. You can add jobs when you are ready — billing comes later.' : '.'}
        </p>
      )}
    </AuthShell>
  );
}
