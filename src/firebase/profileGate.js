function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

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
