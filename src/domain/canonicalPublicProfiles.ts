/**
 * Propose copying publicProfiles cards onto canonical Gmail ids.
 * Rules cannot strip dots (no String.replace), so writes stay on
 * token.email.lower(). Lookups try variants. This backfill only copies
 * name-and-photo cards; it never copies private profile fields.
 */
import { canonicalEmail, normalizeEmail } from '../firebase/emailAddress';
import { parsePhase18RoleArgs, type Phase18RoleFlags } from './proposeJobRoles';

export type CanonicalProfileFlags = Phase18RoleFlags;

export type PublicProfileCard = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
};

export type CanonicalProfilePlan = {
  action: 'keep' | 'copy' | 'skip-target-exists';
  fromId: string;
  toId: string;
  card: PublicProfileCard;
};

export function parseCanonicalProfileArgs(argv: string[]): CanonicalProfileFlags {
  return parsePhase18RoleArgs(argv);
}

function asPublicCard(row: {
  id?: string;
  uid?: unknown;
  email?: unknown;
  displayName?: unknown;
  photoUrl?: unknown;
  mobile?: unknown;
  abn?: unknown;
  street?: unknown;
  businessName?: unknown;
}): PublicProfileCard | null {
  const id = normalizeEmail(row.id || row.email);
  const email = normalizeEmail(row.email || row.id);
  const uid = String(row.uid || '').trim();
  if (!id.includes('@') || !email.includes('@') || !uid) return null;
  return {
    id,
    uid,
    email,
    displayName: String(row.displayName || '').trim(),
    photoUrl: String(row.photoUrl || ''),
  };
}

export function planCanonicalPublicProfileMoves(
  rows: Array<Parameters<typeof asPublicCard>[0]>,
): CanonicalProfilePlan[] {
  const cards = (rows || []).map(asPublicCard).filter((row): row is PublicProfileCard => Boolean(row));
  const byId = new Map(cards.map((card) => [card.id, card]));
  return cards.map((card) => {
    const toId = canonicalEmail(card.email || card.id);
    const nextCard: PublicProfileCard = {
      ...card,
      id: toId,
      email: toId,
    };
    if (card.id === toId) {
      return { action: 'keep', fromId: card.id, toId, card: nextCard };
    }
    if (byId.has(toId)) {
      return { action: 'skip-target-exists', fromId: card.id, toId, card: nextCard };
    }
    return { action: 'copy', fromId: card.id, toId, card: nextCard };
  });
}

export function formatCanonicalProfilePlan(plans: CanonicalProfilePlan[]): string {
  const copy = plans.filter((row) => row.action === 'copy');
  const keep = plans.filter((row) => row.action === 'keep');
  const skip = plans.filter((row) => row.action === 'skip-target-exists');
  const lines = [
    `publicProfiles ${plans.length}  copy ${copy.length}  already canonical ${keep.length}  target exists ${skip.length}`,
  ];
  copy.forEach((row) => {
    lines.push(`  copy ${row.fromId} → ${row.toId}  uid=${row.card.uid}  name=${row.card.displayName || '(blank)'}`);
  });
  skip.forEach((row) => {
    lines.push(`  skip ${row.fromId} (canonical ${row.toId} already exists)`);
  });
  return lines.join('\n');
}
