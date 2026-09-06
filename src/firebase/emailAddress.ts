/**
 * Pure email-address helpers. No Firebase, no templates. Everything on the
 * first-paint path (boot, tenancy, the Jobs list) imports from here so the
 * invite and sign-in mail templates stay out of the initial bundle.
 */

export function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

export function canonicalEmail(email: unknown): string {
  const lowered = normalizeEmail(email);
  const at = lowered.lastIndexOf('@');
  if (at < 1) return lowered;
  let local = lowered.slice(0, at);
  let domain = lowered.slice(at + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '').replace(/\+.*$/, '');
  }
  return `${local}@${domain}`;
}

export function emailInviteVariants(email: unknown): string[] {
  const lowered = normalizeEmail(email);
  const canonical = canonicalEmail(lowered);
  if (!lowered.includes('@')) return [];
  return Array.from(new Set([lowered, canonical].filter(Boolean)));
}

export function emailsMatch(a: unknown, b: unknown): boolean {
  return canonicalEmail(a) === canonicalEmail(b);
}

export function isEmailOnList(invitedEmails: unknown[] | null | undefined, email: unknown): boolean {
  const wanted = new Set(emailInviteVariants(email));
  return (invitedEmails || []).some((item) => wanted.has(normalizeEmail(item)) || wanted.has(canonicalEmail(item)));
}
