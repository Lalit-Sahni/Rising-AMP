import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from './config';
import { canonicalEmail, normalizeEmail } from './emailAddress';
import {
  invitationReasonFromError,
  invitationReasonFromOrgs,
  pickPreferredOrganisation,
} from '../domain/accessGate';
import { readSession } from './sessionStore';

export { clearSession, readSession, writeSession, clearLegacyFlatSessionKeys, emptySession } from './sessionStore';

// Opal's live org id. Kept as a fallback so the family app cannot lose its home.
export const FAMILY_ORG_ID = 'opal-ss-constructions';

let activeOrgId = FAMILY_ORG_ID;

export function setActiveOrgId(orgId) {
  if (orgId && typeof orgId === 'string') {
    activeOrgId = orgId;
  }
}

export function getActiveOrgId() {
  return activeOrgId || FAMILY_ORG_ID;
}

/**
 * Cold start used to hold the boot logo through the JS parse, the auth restore,
 * resolveInvitation AND listInvitedProjects before rendering anything. Firestore
 * is not in Australia, so each of those waves costs roughly 200 ms of pure
 * distance and the user watched a logo for seconds.
 *
 * The profile already paints optimistically from localStorage (readProfileCache).
 * This is the same trick for the two other things the shell waits on: who you
 * are in the org, and which jobs you can open. Both are revalidated over the
 * network immediately; this only decides what is on screen while that happens.
 *
 * Keyed by uid and cleared on sign out. Cached membership and jobRole are first
 * paint only and are never authorisation — Firestore rules decide every write.
 * Session keys are uid-scoped (`risingAmp.session.{uid}`) the same way. Do not
 * treat either cache as a grant.
 */
function bootCacheKey(uid) {
  return `risingAmp.boot.${uid}`;
}

export function readBootCache(uid) {
  // First paint only. Never authorisation.
  if (!uid || typeof localStorage === 'undefined') return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(bootCacheKey(uid)) || 'null');
    if (!parsed || parsed.uid !== uid) return null;
    if (!parsed.membership || !Array.isArray(parsed.jobs)) return null;
    return { membership: parsed.membership, jobs: parsed.jobs };
  } catch (error) {
    return null;
  }
}

export function writeBootCache(uid, membership, jobs) {
  // Paint cache. The role inside membership is not a grant.
  if (!uid || typeof localStorage === 'undefined') return;
  if (!membership || !Array.isArray(jobs)) return;
  try {
    localStorage.setItem(bootCacheKey(uid), JSON.stringify({ uid, membership, jobs }));
  } catch (error) {
    // Private mode can block localStorage.
  }
}

export function clearBootCache(uid) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (uid) localStorage.removeItem(bootCacheKey(uid));
    else {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('risingAmp.boot.'))
        .forEach((key) => localStorage.removeItem(key));
    }
  } catch (error) {
    // Private mode can block localStorage.
  }
}

export { isPermissionDenied } from './permissionMessage';

function mapOrgSnap(orgDoc, email) {
  const data = orgDoc.data() || {};
  const invitedEmails = (data.invitedEmails || []).map(normalizeEmail);
  const legacyWorkspaceIds = Array.isArray(data.legacyWorkspaceIds)
    ? data.legacyWorkspaceIds.filter((id) => typeof id === 'string' && id.trim())
    : [];
  const legacyWorkspaceNames = data.legacyWorkspaceNames && typeof data.legacyWorkspaceNames === 'object'
    ? data.legacyWorkspaceNames
    : {};
  return {
    invited: true,
    email,
    orgId: orgDoc.id,
    orgName: data.name || 'Organisation',
    role: canonicalEmail(data.ownerEmail) === canonicalEmail(email) ? 'owner' : 'member',
    invitedEmails,
    ownerEmail: normalizeEmail(data.ownerEmail),
    legacyWorkspaceIds,
    legacyWorkspaceNames,
  };
}

function invitedOrgsQuery(email) {
  return query(collection(db, 'organizations'), where('invitedEmails', 'array-contains', email));
}

function orgQueryEmail(email) {
  const tokenEmail = normalizeEmail(auth.currentUser && auth.currentUser.email);
  return tokenEmail || normalizeEmail(email);
}

export async function listOrganisationsForEmail(email) {
  const queryEmail = orgQueryEmail(email);
  if (!queryEmail.includes('@')) return [];
  const snap = await getDocs(invitedOrgsQuery(queryEmail));
  return snap.docs.map((orgDoc) => mapOrgSnap(orgDoc, queryEmail));
}

/**
 * Same array-contains query as listOrganisationsForEmail. The constraint must
 * equal the signed-in token email or Firestore returns permission-denied.
 * Uninvited users get an empty snapshot (not-on-list), not an error. Keep this
 * listener attached so an invite lands without a reload.
 */
export function listenOrganisationsForEmail(email, onNext, onError) {
  const queryEmail = orgQueryEmail(email);
  if (!queryEmail.includes('@')) {
    onNext([], { fromCache: false });
    return () => {};
  }
  const next = (snap) => {
    onNext(
      snap.docs.map((orgDoc) => mapOrgSnap(orgDoc, queryEmail)),
      { fromCache: snap.metadata.fromCache },
    );
  };
  if (onError) return onSnapshot(invitedOrgsQuery(queryEmail), next, onError);
  return onSnapshot(invitedOrgsQuery(queryEmail), next);
}

/**
 * Resolve the signed-in user's organisation from membership, not from a
 * hardcoded constant. Prefer a stored org, then Opal if they are on it.
 * Permission-denied is a failed lookup, not a stranger.
 */
export async function resolveInvitation(user) {
  const email = normalizeEmail(user && user.email);
  if (!email) {
    return { invited: false, reason: 'no-email' };
  }

  try {
    const orgs = await listOrganisationsForEmail(email);
    if (invitationReasonFromOrgs(orgs.length) === 'not-on-list') {
      return { invited: false, reason: 'not-on-list', email };
    }

    const session = readSession(user && user.uid);
    const preferred = pickPreferredOrganisation(orgs, session.orgId, FAMILY_ORG_ID) || orgs[0];
    setActiveOrgId(preferred.orgId);
    return { ...preferred, organisations: orgs };
  } catch (error) {
    console.error('Invitation lookup failed:', error);
    return {
      invited: false,
      reason: invitationReasonFromError(error),
      error: error && error.message,
      email,
    };
  }
}

export async function renameLegacyWorkspace(workspaceId, name, allowedWorkspaceIds) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('Please enter a name.');
  }
  if (!allowedWorkspaceIds || !allowedWorkspaceIds.includes(workspaceId)) {
    throw new Error('That job list is not part of this organisation.');
  }

  await updateDoc(doc(db, 'organizations', getActiveOrgId()), {
    [`legacyWorkspaceNames.${workspaceId}`]: trimmed,
    updatedAt: serverTimestamp(),
  });

  return trimmed;
}
