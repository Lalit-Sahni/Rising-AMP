import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from './config';
import { clearSession } from './tenancy';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const loginWithGoogle = async () => {
  try {
    const credential = await signInWithPopup(auth, googleProvider);
    return { success: true, user: credential.user };
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      return { success: false, cancelled: true };
    }
    console.error('Google login error:', error);
    return { success: false, error: error.message, code: error.code };
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

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};
