/**
 * Invite send records: organizations/{orgId}/projects/{jobId}/invites/{id}.
 *
 * The Resend path is recorded by the sendJobInviteEmail Cloud Function.
 * The only row a client may write is the Gmail fallback (rules enforce
 * via 'gmail', status 'sent', providerId null). Delivery status arrives
 * later through the resendWebhook function.
 */
import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import { auth } from './config';
import { normalizeEmail } from './emailAddress';
import { getActiveOrgId } from './tenancy';
import { jobInviteSchema, type JobInvite } from '../domain/schemas';

function invitesCollection(jobId: string) {
  return collection(db, 'organizations', getActiveOrgId(), 'projects', jobId, 'invites');
}

/**
 * Record an invite that legitimately went out through the owner's Gmail
 * because the Cloud Function is not deployed. Never call this for the
 * Resend path — the function writes that row server-side.
 */
export async function recordGmailInvite({
  projectId,
  to,
}: {
  projectId: string;
  to: string;
}): Promise<void> {
  const invitedBy = normalizeEmail(auth.currentUser && auth.currentUser.email);
  const row = {
    to: normalizeEmail(to),
    invitedBy,
    sentAt: serverTimestamp(),
    via: 'gmail' as const,
    providerId: null,
    status: 'sent' as const,
    statusAt: serverTimestamp(),
  };
  const parsed = jobInviteSchema.safeParse(row);
  if (!parsed.success) {
    console.warn('Invite record did not match the schema; not writing it.', parsed.error.issues);
    return;
  }
  await addDoc(invitesCollection(projectId), row);
}

/** Every invite row for a job, newest first. Members can read these. */
export async function listJobInvites(jobId: string): Promise<JobInvite[]> {
  const snap = await getDocs(query(invitesCollection(jobId), orderBy('sentAt', 'desc')));
  const rows: JobInvite[] = [];
  snap.docs.forEach((docSnap) => {
    const parsed = jobInviteSchema.safeParse({ id: docSnap.id, ...docSnap.data() });
    if (parsed.success) rows.push(parsed.data);
  });
  return rows;
}
