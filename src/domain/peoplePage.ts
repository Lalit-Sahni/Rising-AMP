/**
 * People page model. One row per person, one role, no private profile fields.
 * Firestore rules remain authorisation; this only shapes display and writes.
 */
import { toPublicProfile } from '../firebase/profileGate';
import {
  canonicalEmail,
  emailInviteVariants,
  emailsMatch,
  isEmailOnList,
  normalizeEmail,
} from '../firebase/emailAddress';
import {
  canManageJob,
  expandRoleEmails,
  resolveJobRole,
  type JobRole,
} from './jobRole';
import {
  latestInviteLines,
  type InviteLine,
} from './inviteStatus';
import type { JobInvite } from './schemas';

export const PEOPLE_PATH = '/people';
export const JOB_ROLES_ON_CONTROL = ['owner', 'manager', 'site', 'viewer'] as const;

const ROLE_RANK: Record<JobRole, number> = {
  owner: 4,
  manager: 3,
  site: 2,
  viewer: 1,
};

const AVATAR_COLORS = ['#B5654A', '#4E8C82', '#C64E12', '#7E9B63', '#5E82A6', '#C08A3E'];

export type PeopleJob = {
  projectId?: string;
  id?: string;
  name?: string;
  status?: string;
  invitedEmails?: unknown[] | null;
  managers?: unknown[] | null;
  viewers?: unknown[] | null;
  ownerEmail?: unknown;
};

export type PublicPersonCard = {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
};

export type PersonProfileLoad = {
  email: string;
  signedIn: boolean;
  card: PublicPersonCard | null;
  updatedAt: Date | null;
};

export type PersonJobLink = {
  projectId: string;
  name: string;
  role: JobRole;
};

export type PersonRow = {
  key: string;
  email: string;
  displayName: string;
  photoUrl: string;
  uid: string;
  signedIn: boolean;
  isOwner: boolean;
  role: JobRole | 'none';
  roleLabel: string;
  roleDiffers: boolean;
  jobs: PersonJobLink[];
  lastActiveLabel: string;
  lastActiveWarn: boolean;
  attentionRank: number;
  inviteLine: InviteLine | null;
  flagLabel: string;
  flagLabelShort: string;
  jobsLabel: string;
  jobsLabelShort: string;
};

export type PersonPanelModel = {
  displayName: string;
  email: string;
  photoUrl: string;
  uid: string;
  role: JobRole | 'none';
  roleLabel: string;
  roleDiffers: boolean;
  jobs: PersonJobLink[];
  lastActiveLabel: string;
  inviteStatus: string;
  invitedLabel: string;
  activitySummary: string;
  contactNote: string;
};

export type RoleAssign = 'manager' | 'site' | 'viewer';

export function jobKey(job: PeopleJob): string {
  return String(job.projectId || job.id || '');
}

export function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const maybe = value as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') {
    const date = maybe.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof maybe.seconds === 'number') {
    const date = new Date(maybe.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/** Name, photo, email only. Fat profiles are stripped through toPublicProfile. */
export function mapPersonPublicCard(profile: unknown): PublicPersonCard | null {
  const card = toPublicProfile(profile);
  if (!card) return null;
  return {
    uid: String(card.uid || ''),
    email: normalizeEmail(card.email),
    displayName: String(card.displayName || '').trim(),
    photoUrl: String(card.photoUrl || ''),
  };
}

export function personInitials(name: string, email: string): string {
  const source = (name || email || '?').trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 1).toUpperCase();
}

export function avatarColor(email: unknown): string {
  const key = canonicalEmail(email);
  let n = 0;
  for (let i = 0; i < key.length; i += 1) n += key.charCodeAt(i) * (i + 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export function roleLabel(role: JobRole | 'none'): string {
  if (role === 'none') return 'No role';
  if (role === 'owner') return 'Owner';
  if (role === 'manager') return 'Manager';
  if (role === 'viewer') return 'Viewer';
  return 'Site';
}

export function strongestJobRole(roles: Array<JobRole | null | undefined>): JobRole | null {
  let best: JobRole | null = null;
  roles.forEach((role) => {
    if (!role) return;
    if (!best || ROLE_RANK[role] > ROLE_RANK[best]) best = role;
  });
  return best;
}

export function formatLastActive(
  input: { signedIn: boolean; at: Date | null },
  now: Date = new Date(),
): { label: string; warn: boolean } {
  if (!input.signedIn) return { label: 'Never', warn: true };
  if (!input.at) return { label: '—', warn: false };
  const ms = now.getTime() - input.at.getTime();
  if (ms < 2 * 60 * 1000) return { label: 'Now', warn: false };
  if (ms < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.floor(ms / 60000));
    return { label: `${minutes}m ago`, warn: false };
  }
  if (ms < 24 * 60 * 60 * 1000) {
    const hours = Math.max(1, Math.floor(ms / 3600000));
    return { label: `${hours}h ago`, warn: false };
  }
  const days = Math.floor(ms / 86400000);
  if (days === 1) return { label: 'Yesterday', warn: false };
  if (days < 7) return { label: `${days} days ago`, warn: false };
  return {
    label: input.at.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    warn: false,
  };
}

export function peopleSearchFromString(search: string): {
  jobId: string | null;
  add: boolean;
  email: string | null;
} {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const job = String(params.get('job') || '').trim();
  const email = String(params.get('email') || '').trim();
  return { jobId: job || null, add: params.get('add') === '1', email: email || null };
}

/** Open this person’s panel on People. Same key as the list row. */
export function personKeyForEmail(rows: PersonRow[], email: unknown): string | null {
  const wanted = canonicalEmail(email);
  if (!wanted.includes('@')) return null;
  const row = (rows || []).find((item) => item.key === wanted || emailsMatch(item.email, email));
  return row ? row.key : null;
}

/**
 * Sign-in method from Firebase providerData. Google, email and password, or both.
 * Empty when the auth record has neither.
 */
export function signInMethodLabel(
  providerData: Array<{ providerId?: string | null } | null | undefined> | null | undefined,
): string {
  const ids = new Set((providerData || []).map((row) => String((row && row.providerId) || '')));
  const google = ids.has('google.com');
  const password = ids.has('password');
  if (google && password) return 'Google and email and password';
  if (google) return 'Google';
  if (password) return 'email and password';
  return '';
}

export type OwnProfileModel = {
  role: JobRole | 'none';
  roleLabel: string;
  jobs: PersonJobLink[];
  jobsLabel: string;
  peopleHref: string;
};

function ownJobsQuietLabel(jobs: PersonJobLink[]): string {
  if (jobs.length === 0) return 'Not on a job you can see.';
  if (jobs.length === 1) return `On ${jobs[0].name}.`;
  if (jobs.length === 2) return `On ${jobs[0].name} and ${jobs[1].name}.`;
  const head = jobs.slice(0, -1).map((job) => job.name).join(', ');
  return `On ${head} and ${jobs[jobs.length - 1].name}.`;
}

/**
 * Your role on Profile. Same strongest-role rule as the People list, for a
 * signed-in person. Org owner is Owner. Never a client role.
 */
export function ownProfileModel(input: {
  jobs: PeopleJob[];
  email: unknown;
  ownerEmail: unknown;
  membershipRole?: string | null;
}): OwnProfileModel {
  const isOwner = input.membershipRole === 'owner' || emailsMatch(input.email, input.ownerEmail);
  const visibleJobs = (input.jobs || []).filter((job) => jobKey(job));
  const jobLinks: PersonJobLink[] = [];
  visibleJobs.forEach((job) => {
    const onJob = isOwner || isEmailOnList(job.invitedEmails, input.email);
    if (!onJob) return;
    const role = isOwner
      ? 'owner'
      : (resolveJobRole({
        email: input.email,
        ownerEmail: input.ownerEmail,
        invitedEmails: job.invitedEmails,
        managers: job.managers,
        viewers: job.viewers,
      }) || 'site');
    jobLinks.push({
      projectId: jobKey(job),
      name: String(job.name || 'Untitled job').trim() || 'Untitled job',
      role,
    });
  });
  let role: JobRole | 'none' = 'none';
  if (isOwner) role = 'owner';
  else {
    const strongest = strongestJobRole(jobLinks.map((job) => job.role));
    role = strongest || 'none';
  }
  const displayEmail = normalizeEmail(input.email);
  const peopleHref = jobLinks.length > 0 && displayEmail.includes('@')
    ? `${PEOPLE_PATH}?email=${encodeURIComponent(displayEmail)}`
    : PEOPLE_PATH;
  return {
    role,
    roleLabel: roleLabel(role),
    jobs: jobLinks,
    jobsLabel: ownJobsQuietLabel(jobLinks),
    peopleHref,
  };
}

export function collectDisplayEmails(jobs: PeopleJob[], ownerEmail: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (email: unknown) => {
    const display = normalizeEmail(email);
    const key = canonicalEmail(display);
    if (!key.includes('@') || seen.has(key)) return;
    seen.add(key);
    out.push(display);
  };
  (jobs || []).forEach((job) => {
    (job.invitedEmails || []).forEach(push);
  });
  push(ownerEmail);
  return out;
}

export function actorCanManageJob(
  job: PeopleJob,
  actorEmail: unknown,
  ownerEmail: unknown,
  actorIsOwner: boolean,
): boolean {
  if (actorIsOwner) return true;
  return canManageJob({
    email: actorEmail,
    ownerEmail,
    invitedEmails: job.invitedEmails,
    managers: job.managers,
    viewers: job.viewers,
  });
}

export function canActorSetRole(input: {
  actorIsOwner: boolean;
  actorCanManageJob: boolean;
  targetIsOwner: boolean;
  targetRoleOnJob: JobRole | null;
  nextRole: JobRole | 'none';
}): boolean {
  if (input.targetIsOwner) return false;
  if (input.nextRole === 'owner' || input.nextRole === 'none') return false;
  if (!input.actorCanManageJob) return false;
  if (input.actorIsOwner) return true;
  if (input.targetRoleOnJob === 'manager') return false;
  if (input.nextRole === 'manager') return false;
  return true;
}

function listWithoutPerson(list: unknown[] | null | undefined, email: unknown): unknown[] {
  const drop = new Set(expandRoleEmails(email).map((value) => canonicalEmail(value)));
  return (list || []).filter((item) => !drop.has(canonicalEmail(item)));
}

function listWithPerson(list: unknown[] | null | undefined, email: unknown): string[] {
  const kept = listWithoutPerson(list, email);
  const merged: unknown[] = [...kept, ...emailInviteVariants(email)];
  const out: string[] = [];
  const seen = new Set<string>();
  merged.forEach((item) => {
    const key = canonicalEmail(item);
    const value = normalizeEmail(item);
    if (!key.includes('@') || seen.has(key)) return;
    seen.add(key);
    emailInviteVariants(value).forEach((variant) => {
      if (!out.includes(variant)) out.push(variant);
    });
  });
  return out;
}

export function arraysAfterAssigningRole(input: {
  managers?: unknown[] | null;
  viewers?: unknown[] | null;
  email: unknown;
  ownerEmail: unknown;
  nextRole: RoleAssign;
}): { managers: unknown[]; viewers: unknown[] } {
  if (emailsMatch(input.email, input.ownerEmail)) {
    return {
      managers: listWithoutPerson(input.managers, input.email),
      viewers: listWithoutPerson(input.viewers, input.email),
    };
  }
  if (input.nextRole === 'manager') {
    return {
      managers: listWithPerson(input.managers, input.email),
      viewers: listWithoutPerson(input.viewers, input.email),
    };
  }
  if (input.nextRole === 'viewer') {
    return {
      managers: listWithoutPerson(input.managers, input.email),
      viewers: emailsMatch(input.email, input.ownerEmail)
        ? listWithoutPerson(input.viewers, input.email)
        : listWithPerson(input.viewers, input.email),
    };
  }
  return {
    managers: listWithoutPerson(input.managers, input.email),
    viewers: listWithoutPerson(input.viewers, input.email),
  };
}

export function sameEmailSet(a: unknown[] | null | undefined, b: unknown[] | null | undefined): boolean {
  const keys = (list: unknown[] | null | undefined) => (
    Array.from(new Set((list || []).map((item) => canonicalEmail(item)).filter((item) => item.includes('@')))).sort()
  );
  const left = keys(a);
  const right = keys(b);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function planRoleChange(input: {
  jobs: PeopleJob[];
  email: unknown;
  ownerEmail: unknown;
  actorEmail: unknown;
  actorIsOwner: boolean;
  nextRole: RoleAssign;
  filterJobId: string | null;
}): { jobIds: string[]; jobNames: string[]; blockedReason: string | null } {
  if (emailsMatch(input.email, input.ownerEmail)) {
    return { jobIds: [], jobNames: [], blockedReason: 'The owner’s role cannot be changed.' };
  }
  if (!input.actorIsOwner && input.nextRole === 'manager') {
    return { jobIds: [], jobNames: [], blockedReason: 'Only the owner can assign Manager.' };
  }
  const jobIds: string[] = [];
  const jobNames: string[] = [];
  (input.jobs || []).forEach((job) => {
    const id = jobKey(job);
    if (!id) return;
    if (input.filterJobId && id !== input.filterJobId) return;
    if (!isEmailOnList(job.invitedEmails, input.email) && !emailsMatch(input.email, input.ownerEmail)) return;
    const actorCanManage = actorCanManageJob(job, input.actorEmail, input.ownerEmail, input.actorIsOwner);
    const targetRole = resolveJobRole({
      email: input.email,
      ownerEmail: input.ownerEmail,
      invitedEmails: job.invitedEmails,
      managers: job.managers,
      viewers: job.viewers,
    });
    if (!canActorSetRole({
      actorIsOwner: input.actorIsOwner,
      actorCanManageJob: actorCanManage,
      targetIsOwner: false,
      targetRoleOnJob: targetRole,
      nextRole: input.nextRole,
    })) return;
    jobIds.push(id);
    jobNames.push(String(job.name || 'Untitled job').trim() || 'Untitled job');
  });
  if (jobIds.length === 0) {
    return { jobIds: [], jobNames: [], blockedReason: 'You cannot change that role on the jobs you can manage.' };
  }
  return { jobIds, jobNames, blockedReason: null };
}

export function planOrgRemove(input: {
  jobs: PeopleJob[];
  email: unknown;
  ownerEmail: unknown;
  actorEmail: unknown;
  actorIsOwner: boolean;
}): {
  orgTouched: false;
  jobIds: string[];
  jobNames: string[];
  fields: Array<'invitedEmails' | 'managers' | 'viewers'>;
  blockedReason: string | null;
} {
  const fields: Array<'invitedEmails' | 'managers' | 'viewers'> = ['invitedEmails', 'managers', 'viewers'];
  if (emailsMatch(input.email, input.ownerEmail)) {
    return {
      orgTouched: false,
      jobIds: [],
      jobNames: [],
      fields,
      blockedReason: 'A job must keep its owner.',
    };
  }
  const jobIds: string[] = [];
  const jobNames: string[] = [];
  (input.jobs || []).forEach((job) => {
    const id = jobKey(job);
    if (!id) return;
    if (!isEmailOnList(job.invitedEmails, input.email)) return;
    if (!actorCanManageJob(job, input.actorEmail, input.ownerEmail, input.actorIsOwner)) return;
    jobIds.push(id);
    jobNames.push(String(job.name || 'Untitled job').trim() || 'Untitled job');
  });
  if (jobIds.length === 0) {
    return {
      orgTouched: false,
      jobIds: [],
      jobNames: [],
      fields,
      blockedReason: 'There is no job you can take them off.',
    };
  }
  return { orgTouched: false, jobIds, jobNames, fields, blockedReason: null };
}

export function jobsActorCanAddPersonTo(input: {
  jobs: PeopleJob[];
  email: unknown;
  actorEmail: unknown;
  ownerEmail: unknown;
  actorIsOwner: boolean;
}): Array<{ projectId: string; name: string }> {
  return (input.jobs || [])
    .filter((job) => {
      const id = jobKey(job);
      if (!id) return false;
      if (isEmailOnList(job.invitedEmails, input.email)) return false;
      return actorCanManageJob(job, input.actorEmail, input.ownerEmail, input.actorIsOwner);
    })
    .map((job) => ({
      projectId: jobKey(job),
      name: String(job.name || 'Untitled job').trim() || 'Untitled job',
    }));
}

export function jobsActorCanRemovePersonFrom(input: {
  jobs: PeopleJob[];
  email: unknown;
  ownerEmail: unknown;
  actorEmail: unknown;
  actorIsOwner: boolean;
}): Array<{ projectId: string; name: string }> {
  if (emailsMatch(input.email, input.ownerEmail)) return [];
  return (input.jobs || [])
    .filter((job) => (
      Boolean(jobKey(job))
      && isEmailOnList(job.invitedEmails, input.email)
      && actorCanManageJob(job, input.actorEmail, input.ownerEmail, input.actorIsOwner)
    ))
    .map((job) => ({
      projectId: jobKey(job),
      name: String(job.name || 'Untitled job').trim() || 'Untitled job',
    }));
}

function inviteForEmail(invites: JobInvite[] | undefined, email: unknown, now: Date): InviteLine | null {
  const mine = (invites || []).filter((invite) => emailsMatch(invite.to, email));
  mine.sort((a, b) => (asDate(b.sentAt)?.getTime() || 0) - (asDate(a.sentAt)?.getTime() || 0));
  return latestInviteLines(mine, now)[0] || null;
}

function jobsLabel(jobs: PersonJobLink[], visibleCount: number, role: JobRole | 'none'): string {
  if (jobs.length === 0) return '—';
  const names = jobs.map((job) => job.name);
  const all = visibleCount > 1 && jobs.length === visibleCount
    ? `All ${visibleCount} jobs`
    : names.join(', ');
  if (role === 'viewer') return `${all} · read only`;
  return all;
}

export function filterPeopleByJob(rows: PersonRow[], jobId: string | null | undefined): PersonRow[] {
  if (!jobId) return rows;
  return rows.filter((row) => row.jobs.some((job) => job.projectId === jobId));
}

export function peopleListSummary(rows: PersonRow[]): string {
  const count = rows.length;
  const people = `${count} ${count === 1 ? 'person' : 'people'}`;
  const never = rows.filter((row) => !row.signedIn).length;
  const bounced = rows.filter((row) => row.signedIn && row.inviteLine && row.inviteLine.attention).length;
  const bits = [people];
  if (never) bits.push(`${never} invite not accepted`);
  if (bounced) bits.push(`${bounced} invite bounced`);
  return bits.join(' · ');
}

export function peopleListSummaryShort(rows: PersonRow[]): string {
  const count = rows.length;
  const people = `${count} ${count === 1 ? 'person' : 'people'}`;
  const attention = rows.filter((row) => row.attentionRank < 2).length;
  if (!attention) return people;
  return `${people} · ${attention} needs attention`;
}

function comparePeople(a: PersonRow, b: PersonRow): number {
  if (a.attentionRank !== b.attentionRank) return a.attentionRank - b.attentionRank;
  return a.displayName.localeCompare(b.displayName, 'en', { sensitivity: 'base' });
}

export function buildPeopleRows(input: {
  jobs: PeopleJob[];
  ownerEmail: unknown;
  profiles: PersonProfileLoad[];
  invites: JobInvite[];
  now?: Date;
}): PersonRow[] {
  const now = input.now || new Date();
  const visibleJobs = (input.jobs || []).filter((job) => jobKey(job));
  const visibleCount = visibleJobs.length;
  const profileByKey = new Map<string, PersonProfileLoad>();
  (input.profiles || []).forEach((row) => {
    profileByKey.set(canonicalEmail(row.email), row);
  });
  const emails = collectDisplayEmails(visibleJobs, input.ownerEmail);

  const rows: PersonRow[] = emails.map((email) => {
    const isOwner = emailsMatch(email, input.ownerEmail);
    const profile = profileByKey.get(canonicalEmail(email));
    const card = (profile && profile.card) || null;
    const signedIn = Boolean(profile && profile.signedIn);
    const jobLinks: PersonJobLink[] = [];
    visibleJobs.forEach((job) => {
      const onJob = isOwner || isEmailOnList(job.invitedEmails, email);
      if (!onJob) return;
      const role = isOwner
        ? 'owner'
        : (resolveJobRole({
          email,
          ownerEmail: input.ownerEmail,
          invitedEmails: job.invitedEmails,
          managers: job.managers,
          viewers: job.viewers,
        }) || 'site');
      jobLinks.push({
        projectId: jobKey(job),
        name: String(job.name || 'Untitled job').trim() || 'Untitled job',
        role,
      });
    });
    const roles = jobLinks.map((job) => job.role);
    const uniqueRoles = Array.from(new Set(roles));
    const strongest = strongestJobRole(roles);
    let role: JobRole | 'none' = 'none';
    if (isOwner) role = 'owner';
    else if (!signedIn) role = 'none';
    else role = strongest || 'site';
    const personInvites = (input.invites || []).filter((invite) => emailsMatch(invite.to, email));
    personInvites.sort((a, b) => (asDate(b.sentAt)?.getTime() || 0) - (asDate(a.sentAt)?.getTime() || 0));
    const inviteLine = inviteForEmail(personInvites, email, now);
    const lastActiveAt = signedIn
      ? (profile && profile.updatedAt) || asDate(personInvites[0] && personInvites[0].sentAt)
      : null;
    const lastActive = formatLastActive({ signedIn, at: lastActiveAt }, now);
    let attentionRank = 2;
    if (!signedIn) attentionRank = 0;
    else if (inviteLine && inviteLine.attention) attentionRank = 1;
    let flagLabel = '';
    let flagLabelShort = '';
    if (!signedIn) {
      flagLabel = inviteLine
        ? `Invited ${inviteLine.ageLabel}, never signed in`
        : 'Never signed in';
      flagLabelShort = 'Never signed in';
    } else if (inviteLine && inviteLine.attention) {
      flagLabel = `Invite ${inviteLine.statusLabel}`;
      flagLabelShort = flagLabel;
    }
    const displayName = (card && card.displayName) || email;
    return {
      key: canonicalEmail(email),
      email,
      displayName,
      photoUrl: (card && card.photoUrl) || '',
      uid: (card && card.uid) || '',
      signedIn,
      isOwner,
      role,
      roleLabel: roleLabel(role),
      roleDiffers: !isOwner && uniqueRoles.length > 1,
      jobs: jobLinks,
      lastActiveLabel: lastActive.label,
      lastActiveWarn: lastActive.warn,
      attentionRank,
      inviteLine,
      flagLabel,
      flagLabelShort,
      jobsLabel: jobsLabel(jobLinks, visibleCount, role),
      jobsLabelShort: jobLinks.length === 1
        ? jobLinks[0].name
        : `${jobLinks.length} jobs`,
    };
  });

  return rows.sort(comparePeople);
}

export const CONTACT_NOTE = 'Phone numbers and addresses are not shown here, to anyone. They live on the person’s own profile and only they can read it. For a worker’s contact number, use the directory.';

export function personPanelModel(input: {
  profile?: unknown;
  row: PersonRow;
}): PersonPanelModel {
  const fromFat = mapPersonPublicCard(input.profile);
  const card = fromFat || {
    uid: input.row.uid,
    email: input.row.email,
    displayName: input.row.displayName,
    photoUrl: input.row.photoUrl,
  };
  const jobNames = input.row.jobs.map((job) => job.name);
  let activity = '';
  if (jobNames.length === 1) activity = `On ${jobNames[0]}.`;
  else if (jobNames.length > 1) activity = `On ${jobNames.join(' and ')}.`;
  else activity = 'Not on a job you can see.';
  if (input.row.inviteLine) {
    activity += ` Invite ${input.row.inviteLine.statusLabel}, ${input.row.inviteLine.ageLabel}.`;
  }
  activity += ' Spend and files live on History and Cost plan — this page does not count them.';
  let invitedLabel = '';
  if (input.row.inviteLine) {
    invitedLabel = `Invited ${input.row.inviteLine.ageLabel}`;
  }
  let inviteStatus = '';
  if (input.row.inviteLine) {
    inviteStatus = `${input.row.inviteLine.statusLabel} · ${input.row.inviteLine.ageLabel}`;
  } else if (!input.row.signedIn) {
    inviteStatus = 'Invite not accepted';
  }
  return {
    displayName: card.displayName || card.email,
    email: card.email,
    photoUrl: card.photoUrl,
    uid: card.uid,
    role: input.row.role,
    roleLabel: input.row.roleLabel,
    roleDiffers: input.row.roleDiffers,
    jobs: input.row.jobs,
    lastActiveLabel: input.row.lastActiveLabel,
    inviteStatus,
    invitedLabel,
    activitySummary: activity,
    contactNote: CONTACT_NOTE,
  };
}

export function confirmChangeRole(name: string, nextRole: RoleAssign, jobNames: string[]): string {
  const jobs = jobNames.length === 1 ? jobNames[0] : jobNames.join(' and ');
  const label = roleLabel(nextRole);
  return `Change ${name} to ${label} on ${jobs}? ${label} is what they will be able to do on ${jobNames.length === 1 ? 'that job' : 'those jobs'}.`;
}

export function confirmAddToJob(email: string, jobName: string): string {
  return `Add ${email} to ${jobName}? They will see this job as a Site person and can add expenses and files.`;
}

export function confirmRemoveFromJob(email: string, jobName: string): string {
  return `Remove ${email} from ${jobName}? They lose access to this job. Records they entered stay.`;
}

export function confirmOrgRemove(name: string, jobNames: string[]): string {
  const jobs = jobNames.length === 1 ? jobNames[0] : jobNames.join(' and ');
  return `Take ${name} off ${jobs}? They are taken off the jobs you can see, and they stay on the organisation so we cannot lock them out of a job you cannot see. Records they entered stay.`;
}

export function confirmResendInvite(email: string, jobName: string): string {
  return `Send the invite email to ${email} again for ${jobName}?`;
}

export function roleControlDisabled(input: {
  actorIsOwner: boolean;
  targetIsOwner: boolean;
  targetRole: JobRole | 'none';
}): { all: boolean; owner: true; manager: boolean } {
  return {
    all: input.targetIsOwner || (!input.actorIsOwner && input.targetRole === 'manager'),
    owner: true,
    manager: !input.actorIsOwner,
  };
}
