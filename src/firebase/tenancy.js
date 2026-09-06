import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from './config';
import { canonicalEmail, isEmailOnList, normalizeEmail } from './emailAddress';

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

const SESSION_KEYS = {
  projectId: 'risingAmp.projectId',
  workspaceId: 'risingAmp.workspaceId',
  projectName: 'risingAmp.projectName',
  orgId: 'risingAmp.orgId',
  invitedEmails: 'risingAmp.invitedEmails',
  projectStatus: 'risingAmp.projectStatus',
};

export function readSession() {
  let invitedEmails = [];
  try {
    invitedEmails = JSON.parse(localStorage.getItem(SESSION_KEYS.invitedEmails) || '[]');
  } catch (error) {
    invitedEmails = [];
  }
  return {
    projectId: localStorage.getItem(SESSION_KEYS.projectId),
    workspaceId: localStorage.getItem(SESSION_KEYS.workspaceId),
    projectName: localStorage.getItem(SESSION_KEYS.projectName),
    orgId: localStorage.getItem(SESSION_KEYS.orgId),
    invitedEmails: Array.isArray(invitedEmails) ? invitedEmails : [],
    projectStatus: localStorage.getItem(SESSION_KEYS.projectStatus) || 'active',
  };
}

export function writeSession({ projectId, workspaceId, projectName, orgId, invitedEmails, projectStatus }) {
  if (projectId) localStorage.setItem(SESSION_KEYS.projectId, projectId);
  else localStorage.removeItem(SESSION_KEYS.projectId);

  if (workspaceId) localStorage.setItem(SESSION_KEYS.workspaceId, workspaceId);
  else localStorage.removeItem(SESSION_KEYS.workspaceId);

  if (projectName) localStorage.setItem(SESSION_KEYS.projectName, projectName);
  else localStorage.removeItem(SESSION_KEYS.projectName);

  if (orgId) localStorage.setItem(SESSION_KEYS.orgId, orgId);
  else localStorage.removeItem(SESSION_KEYS.orgId);

  if (invitedEmails) localStorage.setItem(SESSION_KEYS.invitedEmails, JSON.stringify(invitedEmails));
  else localStorage.removeItem(SESSION_KEYS.invitedEmails);

  if (projectStatus) localStorage.setItem(SESSION_KEYS.projectStatus, projectStatus);
  else localStorage.removeItem(SESSION_KEYS.projectStatus);

  // Legacy PIN-era key. The string must stay; do not rename it to jobId.
  localStorage.removeItem('accessCode');
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
 * Keyed by uid and cleared on sign out, so a shared machine cannot show one
 * person another's jobs.
 */
function bootCacheKey(uid) {
  return `risingAmp.boot.${uid}`;
}

export function readBootCache(uid) {
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

export function clearSession() {
  writeSession({ projectId: null, workspaceId: null, projectName: null, orgId: null, projectStatus: null });
}

export function isPermissionDenied(error) {
  const code = error && error.code;
  const message = String((error && error.message) || error || '');
  return code === 'permission-denied' || /permission-denied|insufficient permissions/i.test(message);
}

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

export async function listOrganisationsForEmail(email) {
  const snap = await getDocs(
    query(collection(db, 'organizations'), where('invitedEmails', 'array-contains', email))
  );
  return snap.docs.map((orgDoc) => mapOrgSnap(orgDoc, email));
}

/**
 * Resolve the signed-in user's organisation from membership, not from a
 * hardcoded constant. Prefer a stored org, then Opal if they are on it.
 */
export async function resolveInvitation(user) {
  const email = normalizeEmail(user && user.email);
  if (!email) {
    return { invited: false, reason: 'no-email' };
  }

  try {
    const orgs = await listOrganisationsForEmail(email);
    if (orgs.length === 0) {
      return { invited: false, reason: 'not-on-list', email };
    }

    const session = readSession();
    const preferred =
      orgs.find((org) => org.orgId === session.orgId)
      || orgs.find((org) => org.orgId === FAMILY_ORG_ID)
      || orgs[0];

    setActiveOrgId(preferred.orgId);
    return { ...preferred, organisations: orgs };
  } catch (error) {
    const code = error && error.code;
    if (code === 'permission-denied') {
      return { invited: false, reason: 'not-on-list', email };
    }
    console.error('Invitation lookup failed:', error);
    return { invited: false, reason: 'lookup-failed', error: error.message, email };
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
