/**
 * Read-only invite status lines for the job people row.
 * "invited 3 days ago · delivered" — the send record from
 * organizations/{orgId}/projects/{jobId}/invites, latest row per address.
 */
import type { JobInvite } from './schemas';

export type InviteLine = {
  id: string;
  to: string;
  ageLabel: string;
  status: string;
  statusLabel: string;
  attention: boolean;
};

function sentAtDate(sentAt: unknown): Date | null {
  if (!sentAt) return null;
  if (sentAt instanceof Date) return sentAt;
  const maybe = sentAt as { toDate?: () => Date };
  if (typeof maybe.toDate === 'function') return maybe.toDate();
  return null;
}

export function inviteAgeLabel(sentAt: unknown, now: Date = new Date()): string {
  const date = sentAtDate(sentAt);
  if (!date) return 'just now';
  const days = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export function inviteStatusLabel(status: string): string {
  switch (status) {
    case 'delivered':
      return 'delivered';
    case 'bounced':
      return 'bounced';
    case 'complained':
      return 'marked as spam';
    case 'failed':
      return 'did not send';
    default:
      return 'sent';
  }
}

/** Latest row per address, newest first. Bounces and failures get attention. */
export function latestInviteLines(invites: JobInvite[] | undefined, now: Date = new Date()): InviteLine[] {
  const seen = new Set<string>();
  const lines: InviteLine[] = [];
  (invites || []).forEach((invite) => {
    const to = String(invite.to || '');
    if (!to || seen.has(to)) return;
    seen.add(to);
    lines.push({
      id: String(invite.id || to),
      to,
      ageLabel: inviteAgeLabel(invite.sentAt, now),
      status: String(invite.status || 'sent'),
      statusLabel: inviteStatusLabel(String(invite.status || 'sent')),
      attention: ['bounced', 'complained', 'failed'].includes(String(invite.status)),
    });
  });
  return lines;
}
