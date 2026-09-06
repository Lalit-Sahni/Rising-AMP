import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  EmailAuthProvider,
} from 'firebase/auth';
import { auth } from './config';
import { clearSession } from './tenancy';
export { isStagingProject, isProductionProject } from './env';
export { isValidEmail, isValidPassword } from '../utils/authValidation';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function asAuthResult(error) {
  return {
    success: false,
    cancelled: false,
    error: error && error.message,
    code: error && error.code,
  };
}

export const loginWithGoogle = async () => {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return { success: true, user: credential.user, isNew: credential.user.metadata.creationTime === credential.user.metadata.lastSignInTime };
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      return { success: false, cancelled: true };
    }
    console.error('Google login error:', error);
    return asAuthResult(error);
  }
};

export const signUpWithGoogle = loginWithGoogle;

export const signInWithEmail = async (email, password) => {
  try {
    const credential = await signInWithEmailAndPassword(auth, String(email).trim(), password);
    return { success: true, user: credential.user };
  } catch (error) {
    console.error('Email sign-in error:', error);
    return asAuthResult(error);
  }
};

export const signUpWithEmail = async (email, password) => {
  try {
    const credential = await createUserWithEmailAndPassword(auth, String(email).trim(), password);
    return { success: true, user: credential.user, isNew: true };
  } catch (error) {
    console.error('Email sign-up error:', error);
    return asAuthResult(error);
  }
};

export const sendResetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, String(email).trim(), {
      url: window.location.origin,
      handleCodeInApp: false,
    });
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return asAuthResult(error);
  }
};

export const linkPasswordToGoogleUser = async (password) => {
  const user = auth.currentUser;
  if (!user || !user.email) {
    return { success: false, error: 'Sign in again to add a password.' };
  }
  try {
    const credential = EmailAuthProvider.credential(user.email, password);
    await linkWithCredential(user, credential);
    return { success: true };
  } catch (error) {
    return asAuthResult(error);
  }
};

export const lookupSignInMethods = async (email) => {
  try {
    const methods = await fetchSignInMethodsForEmail(auth, String(email).trim());
    return { success: true, methods };
  } catch (error) {
    return { success: false, methods: [], code: error.code };
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    clearSession();
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
};

export const getCurrentUser = () => auth.currentUser;

export const onAuthChange = (callback) => onAuthStateChanged(auth, callback);

export function friendlyAuthError(code, message, mode = 'signin') {
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email and password sign-in is not turned on for this copy yet.';
    case 'auth/popup-blocked':
      return 'The sign-in window was blocked. Allow pop-ups for this page and try again.';
    case 'auth/unauthorized-domain':
      return 'This site is not allowed to sign in yet.';
    case 'auth/invalid-email':
      return 'That email does not look right.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return mode === 'signup'
        ? 'Could not create that account. Try signing in instead.'
        : 'Email or password is not correct.';
    case 'auth/email-already-in-use':
      return 'That email already has an account. Sign in, or continue with Google.';
    case 'auth/weak-password':
      return 'Use at least 8 characters, and include a number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute, then try again.';
    case 'auth/account-exists-with-different-credential':
      return 'That email is already used with a different sign-in method. Try Google, or the password you set.';
    case 'auth/requires-recent-login':
      return 'Sign in again to finish this.';
    default:
      return message || (mode === 'signup' ? 'Could not create the account.' : 'Could not sign in.');
  }
}
