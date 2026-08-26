import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './config';
import { canonicalEmail, isEmailOnList, normalizeEmail } from './email';

// Stable org id on staging. Not a secret. Seeded by scripts/seed-staging-org.js.
export const FAMILY_ORG_ID = 'opal-ss-constructions';

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

  localStorage.removeItem('accessCode');
}

export function clearSession() {
  writeSession({ projectId: null, workspaceId: null, projectName: null, orgId: null, projectStatus: null });
}

export function isPermissionDenied(error) {
  const code = error && error.code;
  const message = String((error && error.message) || error || '');
  return code === 'permission-denied' || /permission-denied|insufficient permissions/i.test(message);
}

/**
 * Product-agnostic invite check. Does not create a workspace.
 * Permission-denied (not on the invite list) is treated as not invited.
 */
export async function resolveInvitation(user) {
  const email = normalizeEmail(user && user.email);
  if (!email) {
    return { invited: false, reason: 'no-email' };
  }

  try {
    const snap = await getDoc(doc(db, 'organizations', FAMILY_ORG_ID));
    if (!snap.exists()) {
      return { invited: false, reason: 'org-missing' };
    }

    const data = snap.data() || {};
    const invitedEmails = (data.invitedEmails || []).map(normalizeEmail);
    if (!isEmailOnList(invitedEmails, email)) {
      return { invited: false, reason: 'not-on-list', email };
    }

    const legacyWorkspaceIds = Array.isArray(data.legacyWorkspaceIds)
      ? data.legacyWorkspaceIds.filter((id) => typeof id === 'string' && id.trim())
      : [];
    const legacyWorkspaceNames = data.legacyWorkspaceNames && typeof data.legacyWorkspaceNames === 'object'
      ? data.legacyWorkspaceNames
      : {};

    return {
      invited: true,
      email,
      orgId: FAMILY_ORG_ID,
      orgName: data.name || 'Organisation',
      role: canonicalEmail(data.ownerEmail) === canonicalEmail(email) ? 'owner' : 'member',
      invitedEmails,
      ownerEmail: normalizeEmail(data.ownerEmail),
      legacyWorkspaceIds,
      legacyWorkspaceNames,
    };
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

  await updateDoc(doc(db, 'organizations', FAMILY_ORG_ID), {
    [`legacyWorkspaceNames.${workspaceId}`]: trimmed,
    updatedAt: serverTimestamp(),
  });

  return trimmed;
}
