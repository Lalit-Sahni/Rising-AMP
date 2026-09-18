import {
  accessScreen,
  invitationReasonFromError,
  invitationReasonFromOrgs,
  isRetryableMembershipError,
  pickPreferredOrganisation,
} from './accessGate';

describe('invitation reasons', () => {
  test('empty org query is not-on-list; Firestore errors are lookup-failed', () => {
    expect(invitationReasonFromOrgs(0)).toBe('not-on-list');
    expect(invitationReasonFromOrgs(1)).toBe('invited');
    expect(invitationReasonFromError({ code: 'permission-denied' })).toBe('lookup-failed');
    expect(invitationReasonFromError({ code: 'unavailable' })).toBe('lookup-failed');
    expect(invitationReasonFromError({ code: 'deadline-exceeded' })).toBe('lookup-failed');
    expect(isRetryableMembershipError({ code: 'permission-denied' })).toBe(true);
    expect(isRetryableMembershipError({ code: 'unavailable' })).toBe(true);
    expect(isRetryableMembershipError({ code: 'not-found' })).toBe(false);
  });

  test('prefers the stored org, then the family org', () => {
    const orgs = [
      { orgId: 'other' },
      { orgId: 'opal-ss-constructions' },
      { orgId: 'stored' },
    ];
    expect(pickPreferredOrganisation(orgs, 'stored', 'opal-ss-constructions')?.orgId).toBe('stored');
    expect(pickPreferredOrganisation(orgs, 'missing', 'opal-ss-constructions')?.orgId)
      .toBe('opal-ss-constructions');
    expect(pickPreferredOrganisation([], 'stored', 'opal-ss-constructions')).toBeNull();
  });
});

describe('access screen order', () => {
  test('Ask-for-access is decided before ProfileSetup for invited: false', () => {
    expect(accessScreen({
      membershipLoading: false,
      membership: { invited: false, reason: 'not-on-list' },
      profileLoading: false,
      profileIsComplete: false,
      profileNeedsSetup: true,
    })).toBe('ask-for-access');
  });

  test('lookup-failed is a retry, not a stranger', () => {
    expect(accessScreen({
      membershipLoading: false,
      membership: { invited: false, reason: 'lookup-failed' },
      profileLoading: false,
      profileIsComplete: false,
      profileNeedsSetup: true,
    })).toBe('lookup-failed');
  });

  test('invited and incomplete profile still reaches setup', () => {
    expect(accessScreen({
      membershipLoading: false,
      membership: { invited: true },
      profileLoading: false,
      profileIsComplete: false,
      profileNeedsSetup: true,
    })).toBe('profile-setup');
  });

  test('boot while membership is loading', () => {
    expect(accessScreen({
      membershipLoading: true,
      membership: null,
      profileLoading: true,
      profileIsComplete: false,
      profileNeedsSetup: true,
    })).toBe('boot');
  });
});
