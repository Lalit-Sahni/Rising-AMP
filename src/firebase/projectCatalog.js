import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './config';
import { canonicalEmail, emailInviteVariants, normalizeEmail } from './email';
import { canRemoveEmailFromJob, isJobArchived, newJobId } from './jobIdentity';
import { FAMILY_ORG_ID } from './tenancy';

export { canRemoveEmailFromJob, isJobArchived, newJobId };

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
  };
}

async function countSubcollection(projectRef, name) {
  try {
    const snap = await getDocs(query(collection(projectRef, name), limit(1000)));
    return snap.size;
  } catch (error) {
    console.warn(`Could not count ${name}:`, error);
    return 0;
  }
}

async function queryProjectsForEmail(email) {
  const snap = await getDocs(
    query(
      collection(db, 'organizations', FAMILY_ORG_ID, 'projects'),
      where('invitedEmails', 'array-contains', email)
    )
  );
  return snap.docs;
}

/**
 * Job lists this email is invited to (no subcollection counts).
 */
export async function listInvitedProjects(email) {
  const variants = emailInviteVariants(email);
  if (variants.length === 0) return [];

  const docsById = new Map();
  let lastError = null;
  for (const candidate of variants) {
    try {
      const docs = await queryProjectsForEmail(candidate);
      for (const projectDoc of docs) {
        docsById.set(projectDoc.id, projectDoc);
      }
    } catch (error) {
      lastError = error;
      console.error('Job list query failed:', error);
    }
  }

  if (docsById.size === 0 && lastError) {
    throw lastError;
  }

  return Array.from(docsById.values()).map(mapProjectDoc);
}

/**
 * Job lists this email is invited to (not every job in the company).
 */
export async function listOrgProjects(email) {
  const listed = await listInvitedProjects(email);
  const rows = [];
  for (const project of listed) {
    const projectRef = doc(db, 'organizations', FAMILY_ORG_ID, 'projects', project.projectId);
    const expenses = await countSubcollection(projectRef, 'expenses');
    const invoices = await countSubcollection(projectRef, 'invoices');
    rows.push({
      ...project,
      expenseCount: expenses,
      invoiceCount: invoices,
    });
  }

  return rows.sort((a, b) => b.expenseCount - a.expenseCount || b.invoiceCount - a.invoiceCount);
}

export async function renameOrgProject(projectId, name, legacyWorkspaceId) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('Please enter a name.');
  }
  await updateDoc(doc(db, 'organizations', FAMILY_ORG_ID, 'projects', projectId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
  if (legacyWorkspaceId) {
    await updateDoc(doc(db, 'organizations', FAMILY_ORG_ID), {
      [`legacyWorkspaceNames.${legacyWorkspaceId}`]: trimmed,
      updatedAt: serverTimestamp(),
    });
  }
  return trimmed;
}

export async function createOrgProject({ name, ownerEmail }) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('Please enter a name.');
  }
  const variants = emailInviteVariants(ownerEmail);
  if (variants.length === 0 || !variants[0].includes('@')) {
    throw new Error('Missing owner email.');
  }

  const projectId = newJobId();
  await setDoc(doc(db, 'organizations', FAMILY_ORG_ID, 'projects', projectId), {
    name: trimmed,
    orgId: FAMILY_ORG_ID,
    invitedEmails: variants,
    formerEmails: [],
    status: 'active',
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
  await updateDoc(doc(db, 'organizations', FAMILY_ORG_ID, 'projects', projectId), payload);
  return archived ? 'archived' : 'active';
}

export async function inviteEmailToProject(projectId, email) {
  const variants = emailInviteVariants(email);
  if (variants.length === 0 || !variants[0].includes('@')) {
    throw new Error('Enter an email address.');
  }
  if (!projectId) {
    throw new Error('Missing job list.');
  }

  await updateDoc(doc(db, 'organizations', FAMILY_ORG_ID, 'projects', projectId), {
    invitedEmails: arrayUnion(...variants),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'organizations', FAMILY_ORG_ID), {
    invitedEmails: arrayUnion(...variants),
    updatedAt: serverTimestamp(),
  });

  return variants[0];
}

export async function removeEmailFromProject(projectId, email) {
  const variants = emailInviteVariants(email);
  if (variants.length === 0 || !variants[0].includes('@')) {
    throw new Error('Enter an email address.');
  }
  if (!projectId) {
    throw new Error('Missing job.');
  }

  const orgSnap = await getDoc(doc(db, 'organizations', FAMILY_ORG_ID));
  const ownerEmail = orgSnap.exists() ? orgSnap.data().ownerEmail : '';
  if (!canRemoveEmailFromJob({ email, ownerEmail })) {
    throw new Error('A job must keep its owner.');
  }

  await updateDoc(doc(db, 'organizations', FAMILY_ORG_ID, 'projects', projectId), {
    invitedEmails: arrayRemove(...variants),
    formerEmails: arrayUnion(...variants),
    updatedAt: serverTimestamp(),
  });

  const stillOnAJob = (await listInvitedProjects(email)).length > 0;
  if (!stillOnAJob) {
    await updateDoc(doc(db, 'organizations', FAMILY_ORG_ID), {
      invitedEmails: arrayRemove(...variants),
      updatedAt: serverTimestamp(),
    });
  }

  return canonicalEmail(email);
}
