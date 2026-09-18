/**
 * People-page writes. Role and job membership go on the job document.
 * Org-level invitedEmails is never touched from here (Part E.6).
 */
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './config';
import { emailInviteVariants, emailsMatch, normalizeEmail } from './emailAddress';
import { getActiveOrgId } from './tenancy';
import {
  arraysAfterAssigningRole,
  asDate,
  mapPersonPublicCard,
  sameEmailSet,
  type PersonProfileLoad,
  type RoleAssign,
} from '../domain/peoplePage';

function orgId() {
  return getActiveOrgId();
}

function jobRef(projectId: string) {
  return doc(db, 'organizations', orgId(), 'projects', projectId);
}

export async function loadPeopleProfileCards(emails: string[]): Promise<PersonProfileLoad[]> {
  const wanted = Array.from(new Set((emails || []).map((email) => normalizeEmail(email)).filter(Boolean)));
  return Promise.all(wanted.map(async (email) => {
    try {
      const snap = await getDoc(doc(db, 'publicProfiles', email));
      if (!snap.exists()) {
        return { email, signedIn: false, card: null, updatedAt: null };
      }
      const data = snap.data() || {};
      const card = mapPersonPublicCard({
        uid: data.uid,
        email: data.email || email,
        displayName: data.displayName,
        photoUrl: data.photoUrl,
        mobile: data.mobile,
        abn: data.abn,
        street: data.street,
        businessName: data.businessName,
      }) || {
        uid: String(data.uid || ''),
        email: normalizeEmail(data.email || email),
        displayName: String(data.displayName || '').trim(),
        photoUrl: String(data.photoUrl || ''),
      };
      return {
        email,
        signedIn: true,
        card,
        updatedAt: asDate(data.updatedAt),
      };
    } catch {
      return { email, signedIn: false, card: null, updatedAt: null };
    }
  }));
}

export async function setPersonRoleOnJobs(input: {
  projectIds: string[];
  email: string;
  ownerEmail: string;
  nextRole: RoleAssign;
}): Promise<void> {
  const variants = emailInviteVariants(input.email);
  if (variants.length === 0) throw new Error('Enter an email address.');
  if (emailsMatch(input.email, input.ownerEmail)) {
    throw new Error('The owner’s role cannot be changed.');
  }
  await Promise.all((input.projectIds || []).map(async (projectId) => {
    if (!projectId) return;
    const ref = jobRef(projectId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    const next = arraysAfterAssigningRole({
      managers: data.managers,
      viewers: data.viewers,
      email: input.email,
      ownerEmail: input.ownerEmail,
      nextRole: input.nextRole,
    });
    const payload: {
      updatedAt: ReturnType<typeof serverTimestamp>;
      managers?: unknown[];
      viewers?: unknown[];
    } = { updatedAt: serverTimestamp() };
    if (!sameEmailSet(data.managers, next.managers) || (next.managers.length > 0 && !Array.isArray(data.managers))) {
      payload.managers = next.managers;
    }
    if (!sameEmailSet(data.viewers, next.viewers) || (next.viewers.length > 0 && !Array.isArray(data.viewers))) {
      payload.viewers = next.viewers;
    }
    if (Object.keys(payload).length === 1) return;
    await updateDoc(ref, payload);
  }));
}

/**
 * Take a person off jobs the actor can already see. Never writes the
 * organisation document — they stay on org invitedEmails on purpose.
 */
export async function removePersonFromVisibleJobs(input: {
  projectIds: string[];
  email: string;
  ownerEmail: string;
}): Promise<void> {
  const variants = emailInviteVariants(input.email);
  if (variants.length === 0) throw new Error('Enter an email address.');
  if (emailsMatch(input.email, input.ownerEmail)) {
    throw new Error('A job must keep its owner.');
  }
  await Promise.all((input.projectIds || []).map(async (projectId) => {
    if (!projectId) return;
    const ref = jobRef(projectId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? (snap.data() || {}) : {};
    const payload: {
      invitedEmails: ReturnType<typeof arrayRemove>;
      formerEmails: ReturnType<typeof arrayUnion>;
      updatedAt: ReturnType<typeof serverTimestamp>;
      managers?: ReturnType<typeof arrayRemove>;
      viewers?: ReturnType<typeof arrayRemove>;
    } = {
      invitedEmails: arrayRemove(...variants),
      formerEmails: arrayUnion(...variants),
      updatedAt: serverTimestamp(),
    };
    if (Array.isArray(data.managers)) payload.managers = arrayRemove(...variants);
    if (Array.isArray(data.viewers)) payload.viewers = arrayRemove(...variants);
    await updateDoc(ref, payload);
  }));
}
