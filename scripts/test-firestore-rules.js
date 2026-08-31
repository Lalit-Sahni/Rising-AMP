#!/usr/bin/env node
/**
 * Phase 8 A1: a signed-in stranger who shares no job cannot read another
 * person's private profile. Run with:
 *   npm run test:rules
 */
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

const OWNER = {
  uid: 'owner-1',
  email: 'owner@opal.test',
};
const STRANGER = {
  uid: 'stranger-1',
  email: 'stranger@example.com',
};

const PRIVATE_PROFILE = {
  email: OWNER.email,
  displayName: 'Lalit Sahni',
  mobile: '0400000000',
  businessName: 'Opal SS Constructions',
  abn: '32162378190',
  street: '1 Example St',
};

const PUBLIC_CARD = {
  uid: OWNER.uid,
  email: OWNER.email,
  displayName: 'Lalit Sahni',
  photoUrl: '',
};

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-rising-amp-rules',
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8'),
    },
  });

  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`profiles/${OWNER.uid}`).set(PRIVATE_PROFILE);
      await db.doc(`publicProfiles/${OWNER.email}`).set(PUBLIC_CARD);
    });

    const owner = testEnv.authenticatedContext(OWNER.uid, { email: OWNER.email });
    const stranger = testEnv.authenticatedContext(STRANGER.uid, { email: STRANGER.email });
    const anon = testEnv.unauthenticatedContext();

    await assertSucceeds(owner.firestore().doc(`profiles/${OWNER.uid}`).get());
    await assertFails(stranger.firestore().doc(`profiles/${OWNER.uid}`).get());
    await assertFails(anon.firestore().doc(`profiles/${OWNER.uid}`).get());
    await assertFails(stranger.firestore().collection('profiles').get());
    await assertSucceeds(
      owner.firestore().collection('profiles').where('email', '==', OWNER.email).get(),
    );
    await assertFails(
      stranger.firestore().collection('profiles').where('email', '==', OWNER.email).get(),
    );

    await assertSucceeds(stranger.firestore().doc(`publicProfiles/${OWNER.email}`).get());
    await assertFails(stranger.firestore().collection('publicProfiles').get());
    await assertFails(anon.firestore().doc(`publicProfiles/${OWNER.email}`).get());

    await assertFails(stranger.firestore().doc(`publicProfiles/${OWNER.email}`).set({
      uid: STRANGER.uid,
      email: OWNER.email,
      displayName: 'Hacked',
      photoUrl: '',
    }));

    await assertSucceeds(owner.firestore().doc(`publicProfiles/${OWNER.email}`).set({
      uid: OWNER.uid,
      email: OWNER.email,
      displayName: 'Lalit Sahni',
      photoUrl: 'https://example.com/p.jpg',
      updatedAt: new Date(),
    }, { merge: true }));

    await assertFails(owner.firestore().doc(`publicProfiles/${OWNER.email}`).set({
      uid: OWNER.uid,
      email: OWNER.email,
      displayName: 'Lalit Sahni',
      photoUrl: '',
      mobile: '0400000000',
      updatedAt: new Date(),
    }));

    const ORG = 'opal-ss-constructions';
    const JOB = 'job-1';
    const ORG_B = 'phase8-isolation';
    const JOB_B = 'job-b';

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`organizations/${ORG}`).set({
        name: 'Opal',
        ownerEmail: OWNER.email,
        invitedEmails: [OWNER.email],
      });
      await db.doc(`organizations/${ORG}/projects/${JOB}`).set({
        name: 'Test job',
        orgId: ORG,
        invitedEmails: [OWNER.email],
        status: 'active',
      });
      await db.doc(`organizations/${ORG}/projects/${JOB}/invoices/inv-1`).set({
        invoiceNumber: '2026-0001',
        status: 'draft',
        total: 10,
      });
      await db.doc(`organizations/${ORG_B}`).set({
        name: 'Other Co',
        ownerEmail: STRANGER.email,
        invitedEmails: [STRANGER.email],
      });
      await db.doc(`organizations/${ORG_B}/projects/${JOB_B}`).set({
        name: 'B job',
        orgId: ORG_B,
        invitedEmails: [STRANGER.email],
        status: 'active',
      });
    });

    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}`).get());
    await assertFails(stranger.firestore().doc(`organizations/${ORG}/projects/${JOB}`).get());
    await assertFails(stranger.firestore().doc(`organizations/${ORG}/projects/${JOB}/invoices/inv-1`).get());
    await assertFails(stranger.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e1`).set({
      category: 'purchase',
      total: 1,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invoices/inv-1`).delete());
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invoices/inv-1`).update({
      status: 'void',
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invoices/inv-1`).delete());
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invoices/inv-2`).set({
      status: 'draft',
      total: 5,
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invoices/inv-2`).set({
      invoiceNumber: '2026-0002',
      status: 'draft',
      total: 5,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-bad`).set({
      category: 12,
      total: 1,
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e1`).set({
      category: 'purchase',
      total: 40,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e1`).delete());
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e1`).update({
      status: 'void',
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e1`).delete());
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/clients/c1`).set({
      name: 'Test client',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/clients/c1`).delete());
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/clients/c1`).update({
      status: 'void',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/clients/c1`).delete());
    await assertSucceeds(stranger.firestore().doc(`organizations/${ORG_B}/projects/${JOB_B}`).get());
    await assertFails(owner.firestore().doc(`organizations/${ORG_B}/projects/${JOB_B}`).get());

    console.log('firestore.rules profile, invoice, org and expense tests passed');
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
