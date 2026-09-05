import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './config';
import { normalizeEmail } from './emailAddress';
import logger from '../utils/logger';
import { profileIsComplete, profileNeedsSetup, resolveLoadedProfile, toClientProfile, toPublicProfile, pickProfileForEmail } from './profileGate';

export { profileIsComplete, profileNeedsSetup, toClientProfile, toPublicProfile };
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

function profileCacheKey(uid) {
  return `risingAmp.profile.${uid}`;
}

export function readProfileCache(uid) {
  if (!uid || typeof localStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(profileCacheKey(uid)) || 'null');
    if (!parsed || parsed.uid !== uid) return null;
    return toClientProfile(uid, parsed);
  } catch (error) {
    return null;
  }
}

export function writeProfileCache(profile) {
  if (!profile || !profile.uid || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(profileCacheKey(profile.uid), JSON.stringify(toClientProfile(profile.uid, profile)));
  } catch (error) {
    // Private mode can block localStorage.
  }
}

function asPublicPerson(email, data = {}) {
  return {
    uid: data.uid || '',
    email: normalizeEmail(data.email || email),
    displayName: String(data.displayName || '').trim(),
    photoUrl: data.photoUrl || '',
    setupComplete: Boolean(data.setupComplete),
  };
}

async function syncPublicProfile(profile) {
  const publicProfile = toPublicProfile(profile);
  if (!publicProfile) return;
  try {
    await setDoc(doc(db, 'publicProfiles', publicProfile.email), {
      ...publicProfile,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    logger.warn('Public profile sync failed', error && error.code);
  }
}

async function findProfileByEmail(email, exceptUid) {
  if (!email) return null;
  try {
    const snap = await getDocs(query(
      collection(db, 'profiles'),
      where('email', '==', normalizeEmail(email)),
    ));
    const rows = snap.docs.map((row) => ({ uid: row.id, ...row.data() }));
    return pickProfileForEmail(rows, email, exceptUid);
  } catch (error) {
    logger.warn('Profile email lookup failed', error && error.code);
    return null;
  }
}

export async function loadProfile(uid, email) {
  if (!uid) return null;

  const snap = await getDoc(doc(db, 'profiles', uid));
  const uidDoc = snap.exists() ? snap.data() : null;
  const emailProfile = email ? await findProfileByEmail(email, uid) : null;
  const resolved = resolveLoadedProfile({
    uid,
    email,
    uidDoc,
    emailProfile,
    cached: readProfileCache(uid),
  });

  if (resolved.profile && profileIsComplete(resolved.profile)) {
    if (resolved.write) {
      await setDoc(doc(db, 'profiles', uid), {
        ...resolved.profile,
        createdAt: uidDoc && uidDoc.createdAt ? uidDoc.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    writeProfileCache(resolved.profile);
    await syncPublicProfile(resolved.profile);
  }

  return resolved.profile;
}

export async function saveProfile(uid, data) {
  if (!uid) throw new Error('Missing account.');
  const saved = toClientProfile(uid, data);
  const payload = {
    ...saved,
    updatedAt: serverTimestamp(),
  };
  const existing = await getDoc(doc(db, 'profiles', uid));
  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
  }
  await setDoc(doc(db, 'profiles', uid), payload, { merge: true });
  writeProfileCache(saved);
  await syncPublicProfile(saved);
  return saved;
}

export async function recordSignIn(uid, extra = {}) {
  if (!uid) return;
  try {
    await updateDoc(doc(db, 'profiles', uid), {
      lastSignInAt: serverTimestamp(),
      lastSignInUserAgent: String(extra.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '')).slice(0, 240),
      lastSignInPlatform: String(extra.platform || (typeof navigator !== 'undefined' ? navigator.platform : '')).slice(0, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (error && error.code === 'not-found') return;
    logger.error('Sign-in stamp failed', error);
  }
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
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { getFirebaseStorage } = await import('./callable');
    const storage = await getFirebaseStorage();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `avatars/${uid}/avatar.${ext}`;
    const snapshot = await uploadBytes(ref(storage, path), file);
    const url = await getDownloadURL(snapshot.ref);
    return { success: true, url, path };
  } catch (error) {
    logger.error('Profile photo upload failed', error);
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

  await Promise.all(wanted.map(async (email) => {
    try {
      const snap = await getDoc(doc(db, 'publicProfiles', email));
      if (snap.exists()) {
        found.set(email, asPublicPerson(email, snap.data()));
      }
    } catch (error) {
      logger.warn('Public profile lookup failed', error && error.code);
    }
  }));

  return wanted.map((email) => found.get(email) || { email, displayName: '', photoUrl: '', setupComplete: false });
}
