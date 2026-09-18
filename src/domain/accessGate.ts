/**
 * Sign-in gate. Membership is decided before profile setup so a stranger
 * is not asked for an ABN and then told no. A failed lookup is not a refusal.
 */

export type AccessScreen = 'boot' | 'lookup-failed' | 'ask-for-access' | 'profile-setup' | 'app';

export type AccessMembership = {
  invited?: boolean;
  reason?: string | null;
} | null;

export function invitationReasonFromOrgs(orgCount: number): 'not-on-list' | 'invited' {
  return orgCount === 0 ? 'not-on-list' : 'invited';
}

export function invitationReasonFromError(_error: unknown): 'lookup-failed' {
  return 'lookup-failed';
}

export function isRetryableMembershipError(error: unknown): boolean {
  const record = error && typeof error === 'object' ? error as { code?: unknown } : null;
  const code = String((record && record.code) || '');
  // permission-denied on the org array-contains query means the constraint
  // does not match the signed-in token. Retrying it never helps and floods
  // the console. unavailable is a network blip.
  return code === 'unavailable';
}

export function pickPreferredOrganisation<T extends { orgId: string }>(
  orgs: T[],
  sessionOrgId: string | null | undefined,
  familyOrgId: string,
): T | null {
  if (!orgs.length) return null;
  return orgs.find((org) => org.orgId === sessionOrgId)
    || orgs.find((org) => org.orgId === familyOrgId)
    || orgs[0];
}

export function accessScreen(input: {
  membershipLoading: boolean;
  membership: AccessMembership;
  profileLoading: boolean;
  profileIsComplete: boolean;
  profileNeedsSetup: boolean;
}): AccessScreen {
  if (input.membershipLoading || !input.membership) return 'boot';
  if (input.membership.reason === 'lookup-failed') return 'lookup-failed';
  if (!input.membership.invited) return 'ask-for-access';
  if (input.profileLoading && !input.profileIsComplete) return 'boot';
  if (input.profileNeedsSetup) return 'profile-setup';
  return 'app';
}
