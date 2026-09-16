'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { recordInviteSent, recordInviteFailed } = require('./inviteRecord');

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };

function memoryProject() {
  const added = [];
  return {
    added,
    ref: {
      collection(name) {
        assert.equal(name, 'invites');
        return {
          async add(row) {
            added.push(row);
            return { id: `inv-${added.length}` };
          },
        };
      },
    },
  };
}

test('a sent row carries the Resend id and normalised addresses', async () => {
  const { ref, added } = memoryProject();
  await recordInviteSent(ref, {
    to: '  Prabh@Example.COM ',
    invitedBy: 'Owner@Opal.Test',
    providerId: 're_123',
    FieldValue,
  });
  assert.equal(added.length, 1);
  assert.deepEqual(added[0], {
    to: 'prabh@example.com',
    invitedBy: 'owner@opal.test',
    sentAt: 'SERVER_TIME',
    statusAt: 'SERVER_TIME',
    via: 'resend',
    providerId: 're_123',
    status: 'sent',
  });
});

test('a sent row without a Resend id stores null, not undefined', async () => {
  const { ref, added } = memoryProject();
  await recordInviteSent(ref, { to: 'a@b.com', invitedBy: 'c@d.com', providerId: null, FieldValue });
  assert.equal(added[0].providerId, null);
});

test('a failed row carries the reason and no provider id', async () => {
  const { ref, added } = memoryProject();
  await recordInviteFailed(ref, {
    to: 'a@b.com',
    invitedBy: 'c@d.com',
    reason: 'resend-http-422',
    FieldValue,
  });
  assert.equal(added.length, 1);
  assert.equal(added[0].status, 'failed');
  assert.equal(added[0].via, 'resend');
  assert.equal(added[0].providerId, null);
  assert.equal(added[0].failureReason, 'resend-http-422');
});
