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
