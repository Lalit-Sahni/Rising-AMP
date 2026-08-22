import React, { useState } from 'react';
import { loginWithGoogle } from '../firebase/auth';
import { HardHat } from 'lucide-react';

const GoogleMark = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

function friendlyAuthError(code, message) {
  if (code === 'auth/operation-not-allowed') {
    return 'Google sign-in is not turned on for the copy yet. Enable it on Rising AMP Staging in Firebase Authentication.';
  }
  if (code === 'auth/popup-blocked') {
    return 'The sign-in window was blocked. Allow pop-ups for this page and try again.';
  }
  if (code === 'auth/unauthorized-domain') {
    return 'This site is not allowed to use Google sign-in yet.';
  }
  return message || 'Could not sign in with Google.';
}

const LoginScreen = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loginWithGoogle();
      if (result.cancelled) {
        return;
      }
      if (!result.success) {
        setError(friendlyAuthError(result.code, result.error));
      }
    } catch (err) {
      console.error('Login error details:', err);
      setError(friendlyAuthError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-2xl mb-4 shadow-lg">
            <HardHat className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Opal Track</h1>
          <p className="text-zinc-400">Sign in with your Google account</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-8 shadow-xl">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full bg-white hover:bg-zinc-50 text-zinc-800 font-semibold py-3 px-4 rounded-lg border border-zinc-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-zinc-700"></div>
                Opening Google…
              </>
            ) : (
              <>
                <GoogleMark />
                Continue with Google
              </>
            )}
          </button>

          <div className="mt-6 pt-6 border-t border-zinc-200">
            <p className="text-sm text-zinc-600 text-center">
              Only invited family Gmail addresses can open the jobs. A wrong account will not create a new empty folder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
