import { 
  signInAnonymously, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from './config';

export const loginWithAccessCode = async (accessCode) => {
  try {
    // Sign in anonymously first
    const userCredential = await signInAnonymously(auth);
    const user = userCredential.user;
    
    // Store access code in localStorage for persistence
    localStorage.setItem('accessCode', accessCode);
    
    return { success: true, user, accessCode };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    localStorage.removeItem('accessCode');
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