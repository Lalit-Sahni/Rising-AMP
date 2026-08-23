'use strict';

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

function emailInviteVariants(email) {
  const lowered = normalizeEmail(email);
  const canonical = canonicalEmail(lowered);
  if (!lowered.includes('@')) return [];
  return Array.from(new Set([lowered, canonical].filter(Boolean)));
}

function isEmailOnList(invitedEmails, email) {
  const wanted = new Set(emailInviteVariants(email));
  return (invitedEmails || []).some(
    (item) => wanted.has(normalizeEmail(item)) || wanted.has(canonicalEmail(item))
  );
}

function isSafeProjectId(projectId) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(String(projectId || ''));
}

module.exports = {
  normalizeEmail,
  canonicalEmail,
  emailInviteVariants,
  isEmailOnList,
  isSafeProjectId,
};
