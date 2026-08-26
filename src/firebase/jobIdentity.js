function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function canonicalEmail(email) {
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

export function isJobArchived(data) {
  return String((data && data.status) || '').toLowerCase() === 'archived';
}

export function canRemoveEmailFromJob({ email, ownerEmail }) {
  if (!email || !String(email).includes('@')) return false;
  if (!ownerEmail) return false;
  return canonicalEmail(email) !== canonicalEmail(ownerEmail);
}

/**
 * Whether this email is still on any of the jobs the viewer can read.
 * Firestore will not let you query another person's invite list.
 */
export function emailRemainsOnJobs(jobs, email) {
  const wanted = canonicalEmail(email);
  if (!wanted.includes('@')) return false;
  return (jobs || []).some((job) =>
    (job.invitedEmails || []).some((item) => canonicalEmail(item) === wanted)
  );
}

export function newJobId() {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return `job-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
