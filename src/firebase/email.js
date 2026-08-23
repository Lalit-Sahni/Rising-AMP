import { GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { auth } from './config';
import { isProductionProject } from './env';
import {
  buildJobInviteEmail,
  buildNewSignInEmail,
  describeDevice,
  formatSignInTime,
  inferLocationLabel,
} from '../emails/risingAmpMail';

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

async function getGmailAccessToken({ interactive = true } = {}) {
  const existing = sessionStorage.getItem(GMAIL_TOKEN_KEY);
  if (existing) return existing;

  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sign in again to send the email.');
  }
  const isGoogle = (user.providerData || []).some((row) => row.providerId === 'google.com');
  if (!isGoogle) {
    const error = new Error('HTML mail from RisingAMP is sent through Google on live. Email-only accounts skip this for now.');
    error.code = 'mail/needs-google';
    throw error;
  }
  if (!interactive) {
    const error = new Error('No Gmail send token yet.');
    error.code = 'mail/no-token';
    throw error;
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
    throw new Error('Google did not give permission to send the email.');
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

function buildMimeMessage({ from, fromName, to, subject, text, html }) {
  const boundary = `risingamp_${Date.now()}`;
  const display = String(fromName || 'RisingAMP').replace(/[\r\n<>]/g, '');
  return [
    `From: ${display} <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    html,
    '',
    `--${boundary}--`,
  ].join('\r\n');
}

async function sendHtmlViaGmail({ to, subject, text, html, interactive = true, fromName = 'RisingAMP' }) {
  const user = auth.currentUser;
  const from = normalizeEmail(user && user.email);
  if (!from) {
    throw new Error('Sign in again to send the email.');
  }

  const raw = toBase64Url(buildMimeMessage({ from, fromName, to, subject, text, html }));
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
    await sendOnce(await getGmailAccessToken({ interactive }));
  } catch (error) {
    if (error && error.status === 401) {
      sessionStorage.removeItem(GMAIL_TOKEN_KEY);
      await sendOnce(await getGmailAccessToken({ interactive }));
      return;
    }
    throw error;
  }
}

export async function sendInviteFromSignedInGmail({ to, projectName }) {
  const user = auth.currentUser;
  const inviterName = (user && user.displayName) || '';
  const mail = buildJobInviteEmail({
    inviterName,
    inviterEmail: normalizeEmail(user && user.email),
    projectName,
    appUrl: window.location.origin,
    to,
  });
  await sendHtmlViaGmail({
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    interactive: true,
    fromName: inviterName ? `${inviterName} via RisingAMP` : 'RisingAMP',
  });
}

/**
 * Branded new-sign-in notice. Staging is a no-op (no branded sender).
 * Live: send if a Gmail token is already available; never prompt a popup on login.
 */
export async function sendNewSignInNotice({ profile, to }) {
  if (!isProductionProject()) {
    return { skipped: true, reason: 'staging' };
  }
  const device = describeDevice(
    typeof navigator !== 'undefined' ? navigator.userAgent : '',
    typeof navigator !== 'undefined' ? navigator.platform : ''
  );
  let timeZone = '';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch (error) {
    timeZone = '';
  }
  const mail = buildNewSignInEmail({
    displayName: profile && profile.displayName,
    businessName: profile && profile.businessName,
    to,
    deviceTitle: device.title,
    deviceSubtitle: device.subtitle,
    whenLabel: formatSignInTime(new Date()),
    locationLabel: inferLocationLabel(timeZone),
    ipLabel: 'Not available from this sign-in',
    appUrl: typeof window !== 'undefined' ? window.location.origin : '',
  });
  try {
    await sendHtmlViaGmail({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      interactive: false,
      fromName: 'RisingAMP',
    });
    return { skipped: false };
  } catch (error) {
    if (error && (error.code === 'mail/no-token' || error.code === 'mail/needs-google')) {
      return { skipped: true, reason: error.code };
    }
    console.error('New sign-in email failed:', error);
    return { skipped: true, reason: 'send-failed' };
  }
}
