import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from './config';

const GMAIL_TOKEN_KEY = 'risingAmp.gmailAccessToken';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function canonicalEmail(email) {
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

export function emailInviteVariants(email) {
  const lowered = normalizeEmail(email);
  const canonical = canonicalEmail(lowered);
  if (!lowered.includes('@')) return [];
  return Array.from(new Set([lowered, canonical].filter(Boolean)));
}

export function emailsMatch(a, b) {
  return canonicalEmail(a) === canonicalEmail(b);
}

export function isEmailOnList(invitedEmails, email) {
  const wanted = new Set(emailInviteVariants(email));
  return (invitedEmails || []).some((item) => wanted.has(normalizeEmail(item)) || wanted.has(canonicalEmail(item)));
}

function rememberGmailAccessToken(accessToken) {
  if (accessToken) {
    sessionStorage.setItem(GMAIL_TOKEN_KEY, accessToken);
  }
}

async function getGmailAccessToken() {
  const existing = sessionStorage.getItem(GMAIL_TOKEN_KEY);
  if (existing) return existing;

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in again to send the invite email.');
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/gmail.send');
  provider.setCustomParameters({
    prompt: 'consent',
    login_hint: user.email || '',
  });
  const result = await reauthenticateWithPopup(user, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential && credential.accessToken;
  if (!accessToken) {
    throw new Error('Google did not give permission to send the invite email.');
  }
  rememberGmailAccessToken(accessToken);
  return accessToken;
}

function toBase64Url(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildInviteMessage({ from, to, projectName, appUrl }) {
  const subject = `You're invited to ${projectName} on Opal Track`;
  const body = [
    'Hi,',
    '',
    `I've invited you to the job list "${projectName}" on Opal Track.`,
    '',
    'Open this link and sign in with Google using this same Gmail:',
    appUrl,
    '',
    'You will only see this job list, not the others.',
    '',
    "If you weren't expecting this, you can ignore it.",
  ].join('\n');

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ].join('\r\n');
}

export async function sendInviteFromSignedInGmail({ to, projectName }) {
  const user = auth.currentUser;
  const from = normalizeEmail(user && user.email);
  if (!from) {
    throw new Error('Sign in again to send the invite email.');
  }

  const appUrl = window.location.origin;
  const raw = toBase64Url(buildInviteMessage({
    from,
    to,
    projectName,
    appUrl,
  }));

  const sendOnce = async (accessToken) => {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });
    if (response.ok) return;
    const details = await response.text();
    const error = new Error(`Gmail send failed (${response.status})`);
    error.status = response.status;
    error.details = details;
    throw error;
  };

  try {
    await sendOnce(await getGmailAccessToken());
  } catch (error) {
    if (error && error.status === 401) {
      sessionStorage.removeItem(GMAIL_TOKEN_KEY);
      await sendOnce(await getGmailAccessToken());
      return;
    }
    throw error;
  }
}
