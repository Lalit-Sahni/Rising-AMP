import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './config';
import { normalizeEmail } from './email';

export const ROLES = ['Owner', 'Director', 'Site manager', 'Estimator', 'Bookkeeper', 'Other'];
export const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

export function emptyProfile(user) {
  const email = normalizeEmail(user && user.email);
  const displayName = (user && user.displayName) || '';
  return {
    uid: user && user.uid,
    email,
    displayName,
    role: 'Owner',
    mobile: '',
    businessName: '',
    abn: '',
    street: '',
    suburb: '',
    state: 'NSW',
    postcode: '',
    photoUrl: (user && user.photoURL) || '',
    setupComplete: false,
  };
}

export function profileNeedsSetup(profile) {
  if (!profile) return true;
  if (profile.setupComplete === true) return false;
  return !String(profile.displayName || '').trim() || !String(profile.businessName || '').trim();
}

export async function loadProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'profiles', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() };
}

export async function saveProfile(uid, data) {
  if (!uid) throw new Error('Missing account.');
  const email = normalizeEmail(data.email);
  const payload = {
    uid,
    email,
    displayName: String(data.displayName || '').trim(),
    role: String(data.role || 'Owner').trim(),
    mobile: String(data.mobile || '').trim(),
    businessName: String(data.businessName || '').trim(),
    abn: String(data.abn || '').trim(),
    street: String(data.street || '').trim(),
    suburb: String(data.suburb || '').trim(),
    state: String(data.state || 'NSW').trim(),
    postcode: String(data.postcode || '').trim(),
    photoUrl: data.photoUrl || '',
    setupComplete: Boolean(data.setupComplete),
    updatedAt: serverTimestamp(),
  };
  const existing = await getDoc(doc(db, 'profiles', uid));
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
  }
  await setDoc(doc(db, 'profiles', uid), payload, { merge: true });
  return { ...payload, uid };
}

export async function recordSignIn(uid, extra = {}) {
  if (!uid) return;
  await setDoc(
    doc(db, 'profiles', uid),
    {
      lastSignInAt: serverTimestamp(),
      lastSignInUserAgent: String(extra.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).slice(0, 240),
      lastSignInPlatform: String(extra.platform || (typeof navigator !== 'undefined' ? navigator.platform : '')).slice(0, 80),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function uploadProfilePhoto(uid, file) {
  if (!uid || !file) return { success: false, error: 'No photo selected.' };
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return { success: false, error: 'Use a JPG or PNG.' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { success: false, error: 'Keep the photo under 5 MB.' };
  }
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `avatars/${uid}/avatar.${ext}`;
    const snapshot = await uploadBytes(ref(storage, path), file);
    const url = await getDownloadURL(snapshot.ref);
    return { success: true, url, path };
  } catch (error) {
    console.error('Profile photo upload failed:', error);
    return {
      success: false,
      error: 'Photo could not be stored on this copy yet. You can finish without one.',
    };
  }
}

export async function loadProfilesForEmails(emails) {
  const wanted = Array.from(new Set((emails || []).map(normalizeEmail).filter(Boolean)));
  if (wanted.length === 0) return [];

  const found = new Map();
  for (let i = 0; i < wanted.length; i += 10) {
    const chunk = wanted.slice(i, i + 10);
    try {
      const snap = await getDocs(query(collection(db, 'profiles'), where('email', 'in', chunk)));
      snap.forEach((row) => {
        const data = { uid: row.id, ...row.data() };
        found.set(normalizeEmail(data.email), data);
      });
    } catch (error) {
      console.error('Profile lookup failed:', error);
    }
  }

  return wanted.map((email) => found.get(email) || { email, displayName: '', setupComplete: false });
}
