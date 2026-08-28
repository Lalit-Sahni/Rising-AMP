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

    console.log('firestore.rules profile tests passed');
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
