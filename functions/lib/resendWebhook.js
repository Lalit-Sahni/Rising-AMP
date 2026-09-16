'use strict';

/**
 * Resend webhook receiver (standard webhooks spec, the svix scheme).
 *
 * Resend signs every delivery with the endpoint's signing secret:
 *   secret        "whsec_<base64>" — the base64 part is the HMAC key
 *   signed content  `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *   signature     base64(HMAC-SHA256(key, signed content))
 *   header        webhook-signature: "v1,<sig>" (space-separated pairs;
 *                 several can be present while a secret rotates)
 * An unsigned or wrongly signed request is rejected before Firestore is
 * touched. The timestamp must be within five minutes to block replays.
 */

const crypto = require('node:crypto');

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

const EVENT_STATUS = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

function decodeKey(secret) {
  const raw = String(secret || '');
  const base64 = raw.startsWith('whsec_') ? raw.slice('whsec_'.length) : raw;
  try {
    const key = Buffer.from(base64, 'base64');
    return key.length > 0 ? key : null;
  } catch (error) {
    return null;
  }
}

function candidateSignatures(header) {
  return String(header || '')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => part.startsWith('v1,'))
    .map((part) => part.slice(3))
    .map((value) => {
      try {
        return Buffer.from(value, 'base64');
      } catch (error) {
        return null;
      }
    })
    .filter((value) => value && value.length > 0);
}

function verifyResendSignature({ secret, id, timestamp, signature, rawBody, nowSeconds }) {
  const key = decodeKey(secret);
  if (!key) return false;
  const messageId = String(id || '');
  const ts = Number(timestamp);
  if (!messageId || !Number.isFinite(ts)) return false;
  const now = Number.isFinite(nowSeconds) ? nowSeconds : Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) return false;

  const expected = crypto
    .createHmac('sha256', key)
    .update(`${messageId}.${Math.floor(ts)}.${rawBody}`, 'utf8')
    .digest();

  return candidateSignatures(signature).some(
    (candidate) => candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
  );
}

/**
 * Apply one verified event. Unknown types and events for mail this app did
 * not send are acknowledged without writes, so Resend stops retrying them.
 */
async function handleResendWebhookEvent({ rawBody, db, FieldValue }) {
  let body;
  try {
    body = JSON.parse(String(rawBody || ''));
  } catch (error) {
    return { handled: false, reason: 'bad-json' };
  }

  const status = EVENT_STATUS[body && body.type];
  if (!status) {
    return { handled: false, reason: 'ignored-type' };
  }

  const providerId = body && body.data && typeof body.data.email_id === 'string'
    ? body.data.email_id.trim()
    : '';
  if (!providerId) {
    return { handled: false, reason: 'no-email-id' };
  }

  const snap = await db
    .collectionGroup('invites')
    .where('providerId', '==', providerId)
    .get();

  if (snap.empty) {
    return { handled: false, reason: 'no-matching-invite' };
  }

  const patch = { status, statusAt: FieldValue.serverTimestamp() };
  await Promise.all(snap.docs.map((docSnap) => docSnap.ref.update(patch)));
  return { handled: true, matched: snap.docs.length, status };
}

module.exports = {
  EVENT_STATUS,
  verifyResendSignature,
  handleResendWebhookEvent,
};
