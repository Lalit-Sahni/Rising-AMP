import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './config';
import { emailsMatch, normalizeEmail } from './email';
import { profileIsComplete, profileNeedsSetup, resolveLoadedProfile, toClientProfile } from './profileGate';

export { profileIsComplete, profileNeedsSetup, toClientProfile };
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

async function findProfileByEmail(email, exceptUid) {
  if (!email) return null;
  const snap = await getDocs(collection(db, 'profiles'));
  let fallback = null;
  let sameUidComplete = null;
  for (const row of snap.docs) {
    const candidate = { uid: row.id, ...row.data() };
    if (!emailsMatch(candidate.email, email)) continue;
    if (!profileIsComplete(candidate)) {
      if (!fallback) fallback = candidate;
      continue;
    }
    if (exceptUid && row.id === exceptUid) {
      sameUidComplete = candidate;
      continue;
    }
    return candidate;
  }
  return sameUidComplete || fallback;
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
    console.error('Sign-in stamp failed:', error);
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
