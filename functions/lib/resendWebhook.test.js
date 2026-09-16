'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  verifyResendSignature,
  handleResendWebhookEvent,
} = require('./resendWebhook');

const KEY_BYTES = Buffer.from('a-test-signing-key-for-resend-webhooks');
const SECRET = `whsec_${KEY_BYTES.toString('base64')}`;

function sign({ id, timestamp, rawBody }) {
  const sig = crypto
    .createHmac('sha256', KEY_BYTES)
    .update(`${id}.${timestamp}.${rawBody}`, 'utf8')
    .digest('base64');
  return `v1,${sig}`;
}

function headersFor(rawBody, { id = 'msg_123', timestamp = Math.floor(Date.now() / 1000) } = {}) {
  return { id, timestamp, signature: sign({ id, timestamp, rawBody }) };
}

test('a correctly signed request verifies', () => {
  const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
  const { id, timestamp, signature } = headersFor(rawBody);
  assert.equal(
    verifyResendSignature({ secret: SECRET, id, timestamp, signature, rawBody }),
    true
  );
});

test('a tampered body is rejected', () => {
  const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
  const { id, timestamp, signature } = headersFor(rawBody);
  const tampered = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_other' } });
  assert.equal(
    verifyResendSignature({ secret: SECRET, id, timestamp, signature, rawBody: tampered }),
    false
  );
});

test('a signature made with a different secret is rejected', () => {
  const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
  const timestamp = Math.floor(Date.now() / 1000);
  const badSig = crypto
    .createHmac('sha256', Buffer.from('the-wrong-key'))
    .update(`msg_123.${timestamp}.${rawBody}`, 'utf8')
    .digest('base64');
  assert.equal(
    verifyResendSignature({
      secret: SECRET,
      id: 'msg_123',
      timestamp,
      signature: `v1,${badSig}`,
      rawBody,
    }),
    false
  );
});

test('an old timestamp is rejected as a replay', () => {
  const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
  const timestamp = Math.floor(Date.now() / 1000) - 10 * 60;
  const { id, signature } = headersFor(rawBody, { timestamp });
  assert.equal(
    verifyResendSignature({ secret: SECRET, id, timestamp, signature, rawBody }),
    false
  );
});

test('missing headers are rejected', () => {
  const rawBody = '{}';
  assert.equal(verifyResendSignature({ secret: SECRET, rawBody }), false);
  assert.equal(
    verifyResendSignature({ secret: SECRET, id: 'msg_1', timestamp: 1, signature: '', rawBody }),
    false
  );
});

test('a malformed or empty secret verifies nothing', () => {
  const rawBody = JSON.stringify({ type: 'email.delivered' });
  const { id, timestamp, signature } = headersFor(rawBody);
  assert.equal(verifyResendSignature({ secret: '', id, timestamp, signature, rawBody }), false);
});

test('one valid signature among several during rotation verifies', () => {
  const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_1' } });
  const { id, timestamp, signature } = headersFor(rawBody);
  const stale = 'v1,c3RhbGUtc2lnbmF0dXJl';
  assert.equal(
    verifyResendSignature({ secret: SECRET, id, timestamp, signature: `${stale} ${signature}`, rawBody }),
    true
  );
});

function memoryDb(rows) {
  const writes = [];
  const db = {
    writes,
    collectionGroup(name) {
      assert.equal(name, 'invites');
      return {
        where(field, op, value) {
          assert.equal(field, 'providerId');
          assert.equal(op, '==');
          const matched = rows.filter((row) => row.providerId === value);
          return {
            async get() {
              return {
                empty: matched.length === 0,
                docs: matched.map((row) => ({
                  data: () => row,
                  ref: {
                    async update(patch) {
                      writes.push({ id: row.id, patch });
                    },
                  },
                })),
              };
            },
          };
        },
      };
    },
  };
  return db;
}

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };

test('email.delivered patches the matching invite row', async () => {
  const db = memoryDb([
    { id: 'inv-1', providerId: 're_abc', status: 'sent' },
    { id: 'inv-2', providerId: 're_other', status: 'sent' },
  ]);
  const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_abc' } });
  const result = await handleResendWebhookEvent({ rawBody, db, FieldValue });
  assert.deepEqual(result, { handled: true, matched: 1, status: 'delivered' });
  assert.equal(db.writes.length, 1);
  assert.equal(db.writes[0].id, 'inv-1');
  assert.equal(db.writes[0].patch.status, 'delivered');
  assert.equal(db.writes[0].patch.statusAt, 'SERVER_TIME');
});

test('email.bounced and email.complained map to their statuses', async () => {
  for (const [type, status] of [['email.bounced', 'bounced'], ['email.complained', 'complained']]) {
    const db = memoryDb([{ id: 'inv-1', providerId: 're_abc', status: 'sent' }]);
    const rawBody = JSON.stringify({ type, data: { email_id: 're_abc' } });
    const result = await handleResendWebhookEvent({ rawBody, db, FieldValue });
    assert.equal(result.status, status);
    assert.equal(db.writes[0].patch.status, status);
  }
});

test('unknown event types are acknowledged without writes', async () => {
  const db = memoryDb([{ id: 'inv-1', providerId: 're_abc' }]);
  const rawBody = JSON.stringify({ type: 'email.sent', data: { email_id: 're_abc' } });
  const result = await handleResendWebhookEvent({ rawBody, db, FieldValue });
  assert.deepEqual(result, { handled: false, reason: 'ignored-type' });
  assert.equal(db.writes.length, 0);
});

test('an event for mail we did not send writes nothing', async () => {
  const db = memoryDb([{ id: 'inv-1', providerId: 're_abc' }]);
  const rawBody = JSON.stringify({ type: 'email.delivered', data: { email_id: 're_stranger' } });
  const result = await handleResendWebhookEvent({ rawBody, db, FieldValue });
  assert.deepEqual(result, { handled: false, reason: 'no-matching-invite' });
  assert.equal(db.writes.length, 0);
});

test('a payload without an email id writes nothing', async () => {
  const db = memoryDb([{ id: 'inv-1', providerId: 're_abc' }]);
  const result = await handleResendWebhookEvent({
    rawBody: JSON.stringify({ type: 'email.delivered', data: {} }),
    db,
    FieldValue,
  });
  assert.deepEqual(result, { handled: false, reason: 'no-email-id' });
  assert.equal(db.writes.length, 0);
});

test('a non-JSON body is acknowledged without writes', async () => {
  const db = memoryDb([]);
  const result = await handleResendWebhookEvent({ rawBody: 'not json', db, FieldValue });
  assert.deepEqual(result, { handled: false, reason: 'bad-json' });
  assert.equal(db.writes.length, 0);
});
