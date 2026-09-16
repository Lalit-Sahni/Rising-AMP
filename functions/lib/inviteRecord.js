'use strict';

/**
 * One row per invite send attempt:
 * organizations/{orgId}/projects/{jobId}/invites/{inviteId}.
 *
 * 'sent' only means Resend accepted the handoff. Delivery, bounces and
 * complaints arrive later through resendWebhook and patch status/statusAt.
 * A client may only ever write the via 'gmail' fallback row (rules enforce
 * that shape); these helpers run as admin.
 */

function baseRow({ to, invitedBy, FieldValue }) {
  return {
    to: String(to || '').trim().toLowerCase(),
    invitedBy: String(invitedBy || '').trim().toLowerCase(),
    sentAt: FieldValue.serverTimestamp(),
    statusAt: FieldValue.serverTimestamp(),
  };
}

async function recordInviteSent(projectRef, { to, invitedBy, providerId, FieldValue }) {
  await projectRef.collection('invites').add({
    ...baseRow({ to, invitedBy, FieldValue }),
    via: 'resend',
    providerId: providerId || null,
    status: 'sent',
  });
}

async function recordInviteFailed(projectRef, { to, invitedBy, reason, FieldValue }) {
  await projectRef.collection('invites').add({
    ...baseRow({ to, invitedBy, FieldValue }),
    via: 'resend',
    providerId: null,
    status: 'failed',
    failureReason: String(reason || 'unknown').slice(0, 200),
  });
}

module.exports = {
  recordInviteSent,
  recordInviteFailed,
};
