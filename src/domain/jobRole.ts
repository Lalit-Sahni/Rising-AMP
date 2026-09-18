/**
 * Per-job roles. Firestore rules are the real authorisation.
 * These helpers are the client model for display and for shaping writes.
 *
 * Cached membership / jobRole is first paint only and is never authorisation.
 */
import {
  canonicalEmail,
  emailInviteVariants,
  emailsMatch,
  isEmailOnList,
  normalizeEmail,
} from '../firebase/emailAddress';

export const JOB_ROLES = ['owner', 'manager', 'site', 'viewer'] as const;
export type JobRole = (typeof JOB_ROLES)[number];

/** Boot cache may paint this. It must never decide a write. */
export const BOOT_CACHE_IS_PAINT_ONLY = true;

export type JobRoleLists = {
  email: unknown;
  ownerEmail?: unknown;
  invitedEmails?: unknown[] | null;
  managers?: unknown[] | null;
  viewers?: unknown[] | null;
};

/**
 * Who this email is on this job.
 * Returns null when they are not on invitedEmails (not a member).
 *
 * Owner wins even if they are also listed in managers.
 * If they appear in both managers and viewers the write is illegal;
 * display falls back to Site so the UI does not grant extra power or
 * lock them out of daily work. Never send that state to Firestore.
 */
export function resolveJobRole(input: JobRoleLists): JobRole | null {
  const email = normalizeEmail(input.email);
  if (!email.includes('@')) return null;

  if (input.ownerEmail && emailsMatch(email, input.ownerEmail)) {
    return 'owner';
  }

  const onInvited = isEmailOnList(input.invitedEmails, email);
  const onManagers = isEmailOnList(input.managers, email);
  const onViewers = isEmailOnList(input.viewers, email);

  if (onManagers && onViewers) return onInvited ? 'site' : null;
  if (onManagers) return 'manager';
  if (onViewers) return 'viewer';
  if (onInvited) return 'site';
  return null;
}

export function canReadJob(input: JobRoleLists): boolean {
  return resolveJobRole(input) != null;
}

/** Not a viewer. Owner, manager and site may write daily work. */
export function canWriteJob(input: JobRoleLists): boolean {
  const role = resolveJobRole(input);
  return role === 'owner' || role === 'manager' || role === 'site';
}

export function canManageJob(input: JobRoleLists): boolean {
  const role = resolveJobRole(input);
  return role === 'owner' || role === 'manager';
}

export function expandRoleEmails(email: unknown): string[] {
  return emailInviteVariants(email);
}

export function uniqueExpandedEmails(emails: unknown[] | null | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  (emails || []).forEach((email) => {
    expandRoleEmails(email).forEach((variant) => {
      if (!seen.has(variant)) {
        seen.add(variant);
        out.push(variant);
      }
    });
  });
  return out;
}

function inBothRoleLists(email: unknown, managers: unknown[] | null | undefined, viewers: unknown[] | null | undefined): boolean {
  return isEmailOnList(managers, email) && isEmailOnList(viewers, email);
}

/**
 * Shape managers/viewers for a write: both spellings, disjoint subsets of
 * invitedEmails, owner never in viewers. People in both role arrays become Site
 * (dropped from both). Do not send overlapping lists to Firestore.
 */
export function roleArraysForChange(input: {
  invitedEmails?: unknown[] | null;
  managers?: unknown[] | null;
  viewers?: unknown[] | null;
  ownerEmail: unknown;
}): { invitedEmails: string[]; managers: string[]; viewers: string[] } {
  const invitedEmails = uniqueExpandedEmails([
    ...(input.invitedEmails || []),
    input.ownerEmail,
  ]);

  const managers = uniqueExpandedEmails(input.managers).filter((email) => (
    isEmailOnList(invitedEmails, email)
    && !inBothRoleLists(email, input.managers, input.viewers)
  ));

  const viewers = uniqueExpandedEmails(input.viewers).filter((email) => (
    isEmailOnList(invitedEmails, email)
    && !inBothRoleLists(email, input.managers, input.viewers)
    && !emailsMatch(email, input.ownerEmail)
  ));

  return { invitedEmails, managers, viewers };
}

/** Drop a person from every job array. Owner cannot be removed. */
export function arraysAfterRemovingEmail(input: {
  invitedEmails?: unknown[] | null;
  managers?: unknown[] | null;
  viewers?: unknown[] | null;
  email: unknown;
  ownerEmail: unknown;
}): { invitedEmails: string[]; managers: string[]; viewers: string[]; removed: string[] } {
  const removed = expandRoleEmails(input.email);
  if (emailsMatch(input.email, input.ownerEmail) || removed.length === 0) {
    return { ...roleArraysForChange(input), removed: [] };
  }
  const drop = new Set(removed.map((value) => canonicalEmail(value)));
  const keep = (list: unknown[] | null | undefined) => (
    (list || []).filter((item) => !drop.has(canonicalEmail(item)))
  );
  return {
    ...roleArraysForChange({
      invitedEmails: keep(input.invitedEmails),
      managers: keep(input.managers),
      viewers: keep(input.viewers),
      ownerEmail: input.ownerEmail,
    }),
    removed,
  };
}
