import { inviteAgeLabel, inviteStatusLabel, latestInviteLines } from './inviteStatus';
import type { JobInvite } from './schemas';

const NOW = new Date('2026-09-16T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86400000);

function inviteRow(over: Partial<JobInvite>): JobInvite {
  return {
    to: 'a@b.com',
    invitedBy: 'owner@opal.test',
    via: 'resend',
    status: 'sent',
    ...over,
  };
}

describe('inviteStatus', () => {
  test('ages read like a person talks', () => {
    expect(inviteAgeLabel(daysAgo(0), NOW)).toBe('today');
    expect(inviteAgeLabel(daysAgo(1), NOW)).toBe('yesterday');
    expect(inviteAgeLabel(daysAgo(3), NOW)).toBe('3 days ago');
    expect(inviteAgeLabel(null, NOW)).toBe('just now');
  });

  test('firestore timestamps are accepted', () => {
    const ts = { toDate: () => daysAgo(2) };
    expect(inviteAgeLabel(ts, NOW)).toBe('2 days ago');
  });

  test('status labels are honest about what sent means', () => {
    expect(inviteStatusLabel('sent')).toBe('sent');
    expect(inviteStatusLabel('delivered')).toBe('delivered');
    expect(inviteStatusLabel('bounced')).toBe('bounced');
    expect(inviteStatusLabel('complained')).toBe('marked as spam');
    expect(inviteStatusLabel('failed')).toBe('did not send');
  });

  test('latest row per address wins and failures get attention', () => {
    const lines = latestInviteLines([
      inviteRow({ id: 'newer', to: 'a@b.com', sentAt: daysAgo(1), status: 'delivered' }),
      inviteRow({ id: 'older', to: 'a@b.com', sentAt: daysAgo(5), status: 'sent' }),
      inviteRow({ id: 'bounced', to: 'c@d.com', sentAt: daysAgo(2), status: 'bounced' }),
    ], NOW);
    expect(lines.map((line) => line.id)).toEqual(['newer', 'bounced']);
    expect(lines[0].statusLabel).toBe('delivered');
    expect(lines[0].attention).toBe(false);
    expect(lines[1].attention).toBe(true);
  });

  test('an empty list renders nothing', () => {
    expect(latestInviteLines([], NOW)).toEqual([]);
    expect(latestInviteLines(undefined, NOW)).toEqual([]);
  });
});
