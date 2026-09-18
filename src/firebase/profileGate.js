import { canonicalEmail, emailInviteVariants, emailsMatch, normalizeEmail } from './emailAddress';

export function profileIsComplete(profile) {
  if (!profile) return false;
  if (profile.setupComplete === true || profile.setupComplete === 'true') return true;
  return Boolean(String(profile.displayName || '').trim() && String(profile.businessName || '').trim());
}

export function profileNeedsSetup(profile) {
  return !profileIsComplete(profile);
}

export function toClientProfile(uid, data = {}) {
  const setupComplete = profileIsComplete({
    ...data,
    setupComplete: data.setupComplete,
  });
  return {
    uid,
    email: normalizeEmail(data.email),
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
    setupComplete,
  };
}

/** Name and photo only. Never include mobile, ABN, address, or business name. */
export function toPublicProfile(profile) {
  if (!profile || !profile.uid) return null;
  const email = normalizeEmail(profile.email);
  if (!email) return null;
  return {
    uid: profile.uid,
    email,
    displayName: String(profile.displayName || '').trim(),
    photoUrl: profile.photoUrl || '',
  };
}

export function pickFoundPublicProfile(found, email) {
  if (!found || typeof found.get !== 'function') return null;
  const canonical = canonicalEmail(email);
  if (canonical && found.has(canonical)) return found.get(canonical);
  const variants = emailInviteVariants(email);
  for (let i = 0; i < variants.length; i += 1) {
    if (found.has(variants[i])) return found.get(variants[i]);
  }
  return null;
}

export function pickProfileForEmail(rows, email, exceptUid) {
  const wanted = normalizeEmail(email);
  if (!wanted) return null;
  let fallback = null;
  let sameUidComplete = null;
  for (const candidate of rows || []) {
    if (!emailsMatch(candidate && candidate.email, email)) continue;
    if (!profileIsComplete(candidate)) {
      if (!fallback) fallback = candidate;
      continue;
    }
    if (exceptUid && candidate.uid === exceptUid) {
      sameUidComplete = candidate;
      continue;
    }
    return candidate;
  }
  return sameUidComplete || fallback;
}

export function resolveLoadedProfile({ uid, email, uidDoc, emailProfile, cached }) {
  const fromUid = uidDoc ? toClientProfile(uid, { uid, ...uidDoc }) : null;
  if (profileIsComplete(fromUid)) {
    return { profile: fromUid, write: false };
  }

  if (emailProfile && profileIsComplete(emailProfile)) {
    return {
      profile: toClientProfile(uid, {
        ...emailProfile,
        uid,
        email: normalizeEmail(email) || emailProfile.email,
        setupComplete: true,
      }),
      write: true,
    };
  }

  if (cached && profileIsComplete(cached)) {
    return { profile: toClientProfile(uid, cached), write: true };
  }

  return {
    profile: fromUid || (emailProfile ? toClientProfile(uid, emailProfile) : cached) || null,
    write: false,
  };
}
