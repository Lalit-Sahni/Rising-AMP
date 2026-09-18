/**
 * Last-open job, keyed by uid. Flat risingAmp.projectId keys leaked the
 * previous person's job onto the next sign-in on a shared browser.
 */

export type JobSession = {
  projectId: string | null;
  workspaceId: string | null;
  projectName: string | null;
  orgId: string | null;
  invitedEmails: string[];
  projectStatus: string;
};

const SESSION_PREFIX = 'risingAmp.session.';

export const LEGACY_FLAT_SESSION_KEYS = [
  'risingAmp.projectId',
  'risingAmp.workspaceId',
  'risingAmp.projectName',
  'risingAmp.orgId',
  'risingAmp.invitedEmails',
  'risingAmp.projectStatus',
] as const;

function sessionKey(uid: string): string {
  return `${SESSION_PREFIX}${uid}`;
}

export function emptySession(): JobSession {
  return {
    projectId: null,
    workspaceId: null,
    projectName: null,
    orgId: null,
    invitedEmails: [],
    projectStatus: 'active',
  };
}

export function clearLegacyFlatSessionKeys(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    LEGACY_FLAT_SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Private mode can block localStorage.
  }
}

export function readSession(uid?: string | null): JobSession {
  if (!uid || typeof localStorage === 'undefined') return emptySession();
  try {
    const parsed = JSON.parse(localStorage.getItem(sessionKey(uid)) || 'null');
    if (!parsed || parsed.uid !== uid) return emptySession();
    return {
      projectId: parsed.projectId || null,
      workspaceId: parsed.workspaceId || null,
      projectName: parsed.projectName || null,
      orgId: parsed.orgId || null,
      invitedEmails: Array.isArray(parsed.invitedEmails) ? parsed.invitedEmails : [],
      projectStatus: parsed.projectStatus || 'active',
    };
  } catch {
    return emptySession();
  }
}

export function writeSession(
  uid: string | null | undefined,
  data: {
    projectId?: string | null;
    workspaceId?: string | null;
    projectName?: string | null;
    orgId?: string | null;
    invitedEmails?: string[] | null;
    projectStatus?: string | null;
  },
): void {
  if (!uid || typeof localStorage === 'undefined') return;
  clearLegacyFlatSessionKeys();
  const current = readSession(uid);
  const next = {
    uid,
    projectId: data.projectId !== undefined ? (data.projectId || null) : current.projectId,
    workspaceId: data.workspaceId !== undefined ? (data.workspaceId || null) : current.workspaceId,
    projectName: data.projectName !== undefined ? (data.projectName || null) : current.projectName,
    orgId: data.orgId !== undefined ? (data.orgId || null) : current.orgId,
    invitedEmails: data.invitedEmails !== undefined
      ? (Array.isArray(data.invitedEmails) ? data.invitedEmails : [])
      : current.invitedEmails,
    projectStatus: data.projectStatus !== undefined
      ? (data.projectStatus || 'active')
      : current.projectStatus,
  };
  try {
    localStorage.setItem(sessionKey(uid), JSON.stringify(next));
    localStorage.removeItem('accessCode');
  } catch {
    // Private mode can block localStorage.
  }
}

export function clearSession(uid?: string | null): void {
  if (typeof localStorage === 'undefined') return;
  clearLegacyFlatSessionKeys();
  try {
    if (uid) localStorage.removeItem(sessionKey(uid));
    else {
      Object.keys(localStorage)
        .filter((key) => key.startsWith(SESSION_PREFIX))
        .forEach((key) => localStorage.removeItem(key));
    }
    localStorage.removeItem('accessCode');
  } catch {
    // Private mode can block localStorage.
  }
}
