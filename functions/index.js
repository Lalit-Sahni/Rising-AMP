/**
 * Invite email only. Do not export or redeploy generateWeeklyReport.
 *
 * Production still has leftover generateWeeklyReport. A full
 * `firebase deploy --only functions` would delete it. Deploy this
 * function by name:
 *
 *   firebase deploy --project rising-amp-staging --only functions:sendJobInviteEmail
 *   firebase deploy --project production --only functions:sendJobInviteEmail
 *
 * RESEND_API_KEY must already exist in Secret Manager. The owner sets it
 * themselves (masked prompt). Never put the key in this repo or in REACT_APP_*.
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const {
  canonicalEmail,
  isEmailOnList,
  isSafeProjectId,
  normalizeEmail,
} = require('./lib/emailMatch');

const FAMILY_ORG_ID = 'opal-ss-constructions';
const FROM = 'RisingAMP <invites@risingamp.com.au>';
const resendApiKey = defineSecret('RESEND_API_KEY');

const ALLOWED_APP_ORIGINS = new Set([
  'https://rising-amp-467702-b5.web.app',
  'https://rising-amp-467702-b5.firebaseapp.com',
  'https://rising-amp-staging.web.app',
  'https://rising-amp-staging.firebaseapp.com',
  'https://risingamp.com.au',
  'https://www.risingamp.com.au',
  'http://localhost:3000',
  'http://localhost:3001',
]);

if (!admin.apps.length) {
  admin.initializeApp();
}

function defaultAppOrigin() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '';
  if (projectId === 'rising-amp-staging') {
    return 'https://rising-amp-staging.web.app';
  }
  return 'https://risingamp.com.au';
}

function safeAppUrl(value) {
  try {
    const origin = new URL(String(value || '')).origin;
    if (ALLOWED_APP_ORIGINS.has(origin)) return origin;
  } catch (error) {
    // fall through
  }
  return defaultAppOrigin();
}

async function loadMailBuilder() {
  const mail = await import('./emails/risingAmpMail.mjs');
  return mail.buildJobInviteEmail;
}

exports.sendJobInviteEmail = onCall(
  {
    region: 'us-central1',
    secrets: [resendApiKey],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to send an invite.');
    }

    const to = normalizeEmail(request.data && request.data.to);
    const projectId = String((request.data && request.data.projectId) || '').trim();
    const projectNameHint = String((request.data && request.data.projectName) || '').trim();
    if (!to || !to.includes('@')) {
      throw new HttpsError('invalid-argument', 'Enter an email address.');
    }
    if (!isSafeProjectId(projectId)) {
      throw new HttpsError('invalid-argument', 'Missing job.');
    }

    const callerEmail = normalizeEmail(request.auth.token && request.auth.token.email);
    if (!callerEmail) {
      throw new HttpsError('unauthenticated', 'Sign in to send an invite.');
    }

    const db = admin.firestore();
    const orgRef = db.collection('organizations').doc(FAMILY_ORG_ID);
    const projectRef = orgRef.collection('projects').doc(projectId);
    const [orgSnap, projectSnap] = await Promise.all([orgRef.get(), projectRef.get()]);

    if (!orgSnap.exists) {
      throw new HttpsError('not-found', 'Organisation is not set up.');
    }
    if (!projectSnap.exists) {
      throw new HttpsError('not-found', 'That job was not found.');
    }

    const org = orgSnap.data() || {};
    const project = projectSnap.data() || {};
    const invitedEmails = project.invitedEmails || [];
    const ownerEmail = org.ownerEmail;

    if (canonicalEmail(callerEmail) !== canonicalEmail(ownerEmail)) {
      throw new HttpsError('permission-denied', 'Only the account owner can send invites.');
    }
    if (!isEmailOnList(invitedEmails, callerEmail)) {
      throw new HttpsError('permission-denied', 'You are not on this job.');
    }
    if (!isEmailOnList(invitedEmails, to)) {
      throw new HttpsError(
        'failed-precondition',
        'Add that email to the job before sending the invite.'
      );
    }

    const buildJobInviteEmail = await loadMailBuilder();
    const mail = buildJobInviteEmail({
      inviterName: (request.auth.token && request.auth.token.name) || '',
      inviterEmail: callerEmail,
      projectName: (project.name && String(project.name).trim()) || projectNameHint || 'a job',
      appUrl: safeAppUrl(request.data && request.data.appUrl),
      to,
    });

    const apiKey = resendApiKey.value();
    if (!apiKey) {
      throw new HttpsError('internal', 'Invite email is not configured yet.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('Resend invite send failed', response.status, details.slice(0, 500));
      throw new HttpsError('internal', 'Could not send the invite email.');
    }

    const payload = await response.json().catch(() => ({}));
    return { ok: true, id: payload.id || null, via: 'resend' };
  }
);
