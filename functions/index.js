/**
 * Production functions are sendJobInviteEmail, readReceiptImage and
 * allocateInvoiceNumber. Deploy by name. checkEstimateImport is in this
 * file but is not live until Lalit names that function:
 *
 *   firebase deploy --project rising-amp-staging --only functions:sendJobInviteEmail
 *   firebase deploy --project production --only functions:sendJobInviteEmail
 *   firebase deploy --project rising-amp-staging --only functions:readReceiptImage
 *   firebase deploy --project production --only functions:readReceiptImage
 *   firebase deploy --project rising-amp-staging --only functions:allocateInvoiceNumber
 *   firebase deploy --project production --only functions:allocateInvoiceNumber
 *   firebase deploy --project rising-amp-staging --only functions:checkEstimateImport
 *   firebase deploy --project production --only functions:checkEstimateImport
 *
 * Secrets the owner sets at a masked prompt (never paste into chat):
 *   RESEND_API_KEY, OPENAI_API_KEY
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
const { RECEIPT_PROMPT } = require('./lib/receiptPrompt');
const {
  ESTIMATE_CHECK_PROMPT,
  parseEstimateCheckContent,
  sanitizeEstimateCheckInput,
} = require('./lib/estimateCheck');
const resendApiKey = defineSecret('RESEND_API_KEY');
const openaiApiKey = defineSecret('OPENAI_API_KEY');

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

exports.readReceiptImage = onCall(
  {
    region: 'us-central1',
    secrets: [openaiApiKey],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to read a receipt.');
    }
    const callerEmail = normalizeEmail(request.auth.token && request.auth.token.email);
    if (!callerEmail) {
      throw new HttpsError('unauthenticated', 'Sign in to read a receipt.');
    }

    const imageBase64 = String((request.data && request.data.imageBase64) || '').replace(/\s/g, '');
    const mimeType = String((request.data && request.data.mimeType) || 'image/jpeg');
    if (!imageBase64 || imageBase64.length < 100) {
      throw new HttpsError('invalid-argument', 'The photo was empty.');
    }
    if (imageBase64.length > 5 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'That photo is too large. Try a closer shot.');
    }
    if (!/^image\/(jpeg|jpg|png|webp|gif)$/i.test(mimeType)) {
      throw new HttpsError('invalid-argument', 'Use a JPG, PNG, or WebP photo.');
    }

    const db = admin.firestore();
    const orgSnap = await db.collection('organizations').doc(FAMILY_ORG_ID).get();
    if (!orgSnap.exists) {
      throw new HttpsError('not-found', 'Organisation is not set up.');
    }
    const org = orgSnap.data() || {};
    if (!isEmailOnList(org.invitedEmails || [], callerEmail)) {
      throw new HttpsError('permission-denied', 'You are not on this organisation.');
    }

    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'OpenAI is not configured.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: RECEIPT_PROMPT },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('OpenAI receipt read failed', response.status, details.slice(0, 500));
      throw new HttpsError('internal', 'Could not read that receipt.');
    }

    const payload = await response.json().catch(() => ({}));
    const content =
      payload &&
      payload.choices &&
      payload.choices[0] &&
      payload.choices[0].message &&
      payload.choices[0].message.content;
    if (!content) {
      throw new HttpsError('internal', 'OpenAI returned an empty read.');
    }

    return { content };
  }
);

exports.checkEstimateImport = onCall(
  {
    region: 'us-central1',
    secrets: [openaiApiKey],
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 45,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to check an estimate.');
    }
    const callerEmail = normalizeEmail(request.auth.token && request.auth.token.email);
    if (!callerEmail) {
      throw new HttpsError('unauthenticated', 'Sign in to check an estimate.');
    }

    const db = admin.firestore();
    const orgSnap = await db.collection('organizations').doc(FAMILY_ORG_ID).get();
    if (!orgSnap.exists) {
      throw new HttpsError('not-found', 'Organisation is not set up.');
    }
    const org = orgSnap.data() || {};
    if (!isEmailOnList(org.invitedEmails || [], callerEmail)) {
      throw new HttpsError('permission-denied', 'You are not on this organisation.');
    }

    const apiKey = openaiApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'OpenAI is not configured.');
    }

    const payload = sanitizeEstimateCheckInput(request.data);
    if (!payload.sections.length) {
      throw new HttpsError('invalid-argument', 'Map the sections before asking AI to check.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: ESTIMATE_CHECK_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
        max_tokens: 800,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('OpenAI estimate check failed', response.status, details.slice(0, 500));
      throw new HttpsError('internal', 'Could not run the AI check.');
    }

    const body = await response.json().catch(() => ({}));
    const content =
      body &&
      body.choices &&
      body.choices[0] &&
      body.choices[0].message &&
      body.choices[0].message.content;
    if (!content) {
      throw new HttpsError('internal', 'OpenAI returned an empty check.');
    }

    try {
      return parseEstimateCheckContent(content);
    } catch (error) {
      throw new HttpsError('internal', 'The AI check did not return a usable result.');
    }
  }
);

exports.allocateInvoiceNumber = onCall(
  {
    region: 'us-central1',
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 15,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth || !request.auth.token || !request.auth.token.email) {
      throw new HttpsError('unauthenticated', 'Sign in to raise an invoice.');
    }
    const orgId = String((request.data && request.data.orgId) || '').trim();
    if (!/^[a-z0-9-]{3,80}$/.test(orgId)) {
      throw new HttpsError('invalid-argument', 'Missing organisation.');
    }

    const callerEmail = request.auth.token.email;
    const db = admin.firestore();
    const orgRef = db.collection('organizations').doc(orgId);
    const orgSnap = await orgRef.get();
    if (!orgSnap.exists) {
      throw new HttpsError('not-found', 'Organisation is not set up.');
    }
    const org = orgSnap.data() || {};
    if (!isEmailOnList(org.invitedEmails || [], callerEmail)) {
      throw new HttpsError('permission-denied', 'You are not on this organisation.');
    }

    const year = Number(
      new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', year: 'numeric' })
    );
    const counterRef = orgRef.collection('counters').doc('invoices');
    const invoiceNumber = await db.runTransaction(async (tx) => {
      const snap = await tx.get(counterRef);
      const data = snap.exists ? snap.data() : {};
      const seq = data.year === year && typeof data.next === 'number' ? data.next : 1;
      tx.set(counterRef, {
        year,
        next: seq + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return `${year}-${String(seq).padStart(4, '0')}`;
    });

    return { invoiceNumber };
  }
);

