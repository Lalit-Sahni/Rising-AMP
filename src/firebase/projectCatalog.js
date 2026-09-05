import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from './config';
import { canonicalEmail, emailInviteVariants, normalizeEmail } from './emailAddress';
import { canRemoveEmailFromJob, emailRemainsOnJobs, invitedJobsFingerprint, isJobArchived, newJobId } from './jobIdentity';
import { FAMILY_ORG_ID, getActiveOrgId } from './tenancy';
import { LEDGER_ROLLUP_COLLECTION, LEDGER_ROLLUP_DOC_ID } from '../domain/ledgerRollupMeta';

export { canRemoveEmailFromJob, emailRemainsOnJobs, invitedJobsFingerprint, isJobArchived, newJobId };

function mapProjectDoc(projectDoc) {
  const data = projectDoc.data() || {};
  return {
    id: projectDoc.id,
    projectId: projectDoc.id,
    workspaceId: data.legacyWorkspaceId || '',
    name: (data.name && String(data.name).trim()) || 'Untitled job',
    invitedEmails: (data.invitedEmails || []).map((value) => normalizeEmail(value)),
    formerEmails: (data.formerEmails || []).map((value) => normalizeEmail(value)),
    status: isJobArchived(data) ? 'archived' : 'active',
    kind: data.kind === 'own' ? 'own' : 'client',
  };
}

/**
 * One rollup read gives the Jobs list both the expense count and the cost to
 * date. Jobs without a rollup fall back to a count and no cost figure.
 */
async function expenseSummaryForJob(projectRef) {
  try {
    const snap = await getDoc(doc(projectRef, LEDGER_ROLLUP_COLLECTION, LEDGER_ROLLUP_DOC_ID));
    if (snap.exists()) {
      const data = snap.data() || {};
      const count = data.documentCount;
      const cost = data.costCents;
      if (Number.isInteger(count) && count >= 0) {
        return {
          expenseCount: count,
          costCents: Number.isInteger(cost) && cost >= 0 ? cost : null,
        };
      }
    }
  } catch (error) {
    console.warn('Could not read expense rollup:', error);
  }
  return { expenseCount: await countSubcollection(projectRef, 'expenses'), costCents: null };
}

async function countSubcollection(projectRef, name) {
  try {
    const snap = await getCountFromServer(collection(projectRef, name));
    return snap.data().count || 0;
  } catch (error) {
    console.warn(`Could not count ${name}:`, error);
    return 0;
  }
}

function orgId() {
  return getActiveOrgId() || FAMILY_ORG_ID;
}

function invitedProjectsQuery(email) {
  return query(
    collection(db, 'organizations', orgId(), 'projects'),
    where('invitedEmails', 'array-contains', email)
  );
}

async function queryProjectsForEmail(email) {
  const snap = await getDocs(invitedProjectsQuery(email));
  return snap.docs;
}

/**
 * Job lists this email is invited to (no subcollection counts).
 *
 * Firestore rules only allow `array-contains` when the value equals the
 * signed-in email. Extra Gmail spelling variants cannot be queried — they
 * used to log a permission error even when the real query had succeeded.
 */
export async function listInvitedProjects(email) {
  const tokenEmail = normalizeEmail(auth.currentUser && auth.currentUser.email);
  const queryEmail = tokenEmail || normalizeEmail(email);
  if (!queryEmail.includes('@')) return [];

  const docs = await queryProjectsForEmail(queryEmail);
  return docs.map(mapProjectDoc);
}

/**
 * Same query as listInvitedProjects, but from disk first then the server.
 * Keep the one-shot for invite/remove; this is the boot and Jobs-list path.
 */
export function listenInvitedProjects(email, onNext, onError) {
  const tokenEmail = normalizeEmail(auth.currentUser && auth.currentUser.email);
  const queryEmail = tokenEmail || normalizeEmail(email);
  if (!queryEmail.includes('@')) {
    onNext([], { fromCache: false });
    return () => {};
  }

  const next = (snap) => {
    onNext(snap.docs.map(mapProjectDoc), { fromCache: snap.metadata.fromCache });
  };

  if (onError) {
    return onSnapshot(invitedProjectsQuery(queryEmail), next, onError);
  }
  return onSnapshot(invitedProjectsQuery(queryEmail), next);
}

/**
 * Job lists this email is invited to (not every job in the company).
 */
/**
 * Counts for a list of jobs. Every count is an independent round trip, so they
 * go out together. A `for...of` with an await inside made this 2 sequential
 * round trips PER JOB: four in a row for two jobs, twenty for ten, each one a
 * full trip to Firestore before the next was even sent. That is the Jobs screen
 * spinner. Pass `projects` when the caller already listed them, so the same
 * query is not run twice on one page load.
 */
export async function listOrgProjects(email, projects = null) {
  const listed = projects || (await listInvitedProjects(email));
  const rows = await Promise.all(
    listed.map(async (project) => {
      const projectRef = doc(db, 'organizations', orgId(), 'projects', project.projectId);
      const [summary, invoices] = await Promise.all([
        expenseSummaryForJob(projectRef),
        countSubcollection(projectRef, 'invoices'),
      ]);
      return { ...project, expenseCount: summary.expenseCount, costCents: summary.costCents, invoiceCount: invoices };
    }),
  );

  return rows.sort((a, b) => b.expenseCount - a.expenseCount || b.invoiceCount - a.invoiceCount);
}

export async function renameOrgProject(projectId, name, legacyWorkspaceId) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('Please enter a name.');
  }
  await updateDoc(doc(db, 'organizations', orgId(), 'projects', projectId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
  if (legacyWorkspaceId) {
    await updateDoc(doc(db, 'organizations', orgId()), {
      [`legacyWorkspaceNames.${legacyWorkspaceId}`]: trimmed,
      updatedAt: serverTimestamp(),
    });
  }
  return trimmed;
}

export async function createOrgProject({ name, ownerEmail, kind }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('Please enter a name.');
  }
  const variants = emailInviteVariants(ownerEmail);
  if (variants.length === 0 || !variants[0].includes('@')) {
    throw new Error('Missing owner email.');
  }

  const projectId = newJobId();
  const jobKind = kind === 'own' ? 'own' : 'client';
  await setDoc(doc(db, 'organizations', orgId(), 'projects', projectId), {
    name: trimmed,
    orgId: orgId(),
    invitedEmails: variants,
    formerEmails: [],
    status: 'active',
    kind: jobKind,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return mapProjectDoc({
    id: projectId,
    data: () => ({
      name: trimmed,
      invitedEmails: variants,
      formerEmails: [],
      status: 'active',
      kind: jobKind,
    }),
  });
}

export async function setOrgProjectArchived(projectId, archived, actorEmail) {
  if (!projectId) {
    throw new Error('Missing job.');
  }
  const payload = {
    status: archived ? 'archived' : 'active',
    updatedAt: serverTimestamp(),
  };
  if (archived) {
    payload.archivedAt = serverTimestamp();
    payload.archivedBy = normalizeEmail(actorEmail);
  }
  await updateDoc(doc(db, 'organizations', orgId(), 'projects', projectId), payload);
  return archived ? 'archived' : 'active';
}

export async function setOrgProjectKind(projectId, kind) {
  if (!projectId) {
    throw new Error('Missing job.');
  }
  const next = kind === 'own' ? 'own' : 'client';
  await updateDoc(doc(db, 'organizations', orgId(), 'projects', projectId), {
    kind: next,
    updatedAt: serverTimestamp(),
  });
  return next;
}

export async function inviteEmailToProject(projectId, email) {
  const variants = emailInviteVariants(email);
  if (variants.length === 0 || !variants[0].includes('@')) {
    throw new Error('Enter an email address.');
  }
  if (!projectId) {
    throw new Error('Missing job list.');
  }

  await updateDoc(doc(db, 'organizations', orgId(), 'projects', projectId), {
    invitedEmails: arrayUnion(...variants),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'organizations', orgId()), {
    invitedEmails: arrayUnion(...variants),
    updatedAt: serverTimestamp(),
  });

  return variants[0];
}

export async function removeEmailFromProject(projectId, email, viewerEmail) {
  const variants = emailInviteVariants(email);
  if (variants.length === 0 || !variants[0].includes('@')) {
    throw new Error('Enter an email address.');
  }
  if (!projectId) {
    throw new Error('Missing job.');
  }

  const orgSnap = await getDoc(doc(db, 'organizations', orgId()));
  const ownerEmail = orgSnap.exists() ? orgSnap.data().ownerEmail : '';
  if (!canRemoveEmailFromJob({ email, ownerEmail })) {
    throw new Error('A job must keep its owner.');
  }

  await updateDoc(doc(db, 'organizations', orgId(), 'projects', projectId), {
    invitedEmails: arrayRemove(...variants),
    formerEmails: arrayUnion(...variants),
    updatedAt: serverTimestamp(),
  });

  // Rules only allow listing jobs *you* are on. Querying the removed
  // person's email is denied even for the owner.
  const visibleJobs = await listInvitedProjects(viewerEmail || ownerEmail);
  if (!emailRemainsOnJobs(visibleJobs, email)) {
    await updateDoc(doc(db, 'organizations', orgId()), {
      invitedEmails: arrayRemove(...variants),
      updatedAt: serverTimestamp(),
    });
  }

  return canonicalEmail(email);
}
