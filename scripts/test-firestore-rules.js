#!/usr/bin/env node
/**
 * Rules tests: profiles, ledger void/purge, org isolation, and job files.
 * Run with: npm run test:rules
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
    // Must match `firebase emulators:exec --project` so Storage rules
    // firestore.get() sees the same job documents.
    projectId: 'rising-amp-staging',
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8'),
    },
    storage: {
      rules: fs.readFileSync(path.join(__dirname, '../storage.rules'), 'utf8'),
    },
  });

  try {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`profiles/${OWNER.uid}`).set(PRIVATE_PROFILE);
      await db.doc(`publicProfiles/${OWNER.email}`).set(PUBLIC_CARD);
    });

    const owner = testEnv.authenticatedContext(OWNER.uid, {
      email: OWNER.email,
      email_verified: true,
    });
    const stranger = testEnv.authenticatedContext(STRANGER.uid, {
      email: STRANGER.email,
      email_verified: true,
    });
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

    const costPlanPath = `organizations/${ORG}/projects/${JOB}/costPlan/current`;
    const validCostPlan = {
      jobId: JOB,
      level: 'target',
      targetCents: 34000000,
      baselineDate: '2026-08-31',
      gstMode: 'inclusive',
      status: 'draft',
      sections: [],
      createdBy: OWNER.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    };
    await assertSucceeds(owner.firestore().doc(costPlanPath).set(validCostPlan));
    await assertSucceeds(owner.firestore().doc(costPlanPath).get());
    await assertFails(stranger.firestore().doc(costPlanPath).get());
    await assertFails(stranger.firestore().doc(costPlanPath).set(validCostPlan));
    await assertFails(owner.firestore().doc(costPlanPath).delete());
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/costPlan/other`).set(validCostPlan));
    await assertFails(owner.firestore().doc(costPlanPath).set({
      ...validCostPlan,
      targetCents: '34000000',
    }));
    await assertFails(owner.firestore().doc(costPlanPath).set({
      ...validCostPlan,
      targetCents: -1,
    }));
    await assertFails(owner.firestore().doc(costPlanPath).set({
      ...validCostPlan,
      unexpected: true,
    }));
    await assertFails(owner.firestore().doc(costPlanPath).set({
      ...validCostPlan,
      level: 'trades',
    }));
    await assertSucceeds(owner.firestore().doc(costPlanPath).update({
      targetCents: 35000000,
      updatedAt: new Date(),
    }));
    await assertSucceeds(owner.firestore().doc(costPlanPath).update({
      level: 'trades',
      sections: [{
        id: 'plumbing',
        tradeId: 'plumbing',
        name: 'Plumbing',
        order: 0,
        amountCents: 35000000,
      }],
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(costPlanPath).update({
      status: 'locked',
      targetCents: 36000000,
      updatedAt: new Date(),
    }));
    await assertSucceeds(owner.firestore().doc(costPlanPath).update({
      status: 'locked',
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(costPlanPath).update({
      targetCents: 36000000,
      updatedAt: new Date(),
    }));
    await assertSucceeds(owner.firestore().doc(costPlanPath).update({
      status: 'archived',
      archivedAt: new Date(),
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(costPlanPath).update({
      targetCents: 36000000,
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(costPlanPath).delete());
    await assertSucceeds(owner.firestore().doc(costPlanPath).update({
      status: 'draft',
      archivedAt: null,
      level: 'target',
      sections: [],
      sourceFileId: null,
      targetCents: 1000000,
      baselineDate: '2026-09-01',
      updatedAt: new Date(),
    }));
    await assertSucceeds(owner.firestore().doc(costPlanPath).update({
      targetCents: 2000000,
      updatedAt: new Date(),
    }));

    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-code`).set({
      category: 'purchase',
      total: 40,
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-code`).update({
      tradeId: 'plumbing',
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-code`).update({
      tradeId: 'not-in-estimate',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-code`).update({
      tradeId: '',
    }));

    const quotePath = `organizations/${ORG}/projects/${JOB}/quotes/q1`;
    const validQuote = {
      jobId: JOB,
      party: 'Asif',
      receivedDate: '2026-08-31',
      status: 'received',
      amountCents: 3000000,
      amountHighCents: null,
      gstMode: 'inclusive',
      allocations: [{ tradeId: 'concreting', amountCents: 3000000 }],
      createdBy: OWNER.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      voidedAt: null,
    };
    await assertSucceeds(owner.firestore().doc(quotePath).set(validQuote));
    await assertSucceeds(owner.firestore().doc(quotePath).update({
      status: 'chosen',
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(quotePath).delete());
    await assertFails(stranger.firestore().doc(quotePath).get());
    await assertSucceeds(owner.firestore().doc(quotePath).update({
      status: 'void',
      voidedAt: new Date(),
      updatedAt: new Date(),
    }));

    const tradeListPath = `organizations/${ORG}/tradeList/plumbing`;
    await assertSucceeds(owner.firestore().doc(tradeListPath).set({
      name: 'Plumbing',
      order: 0,
      isAppDefault: true,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await assertSucceeds(stranger.firestore().doc(tradeListPath).get());
    await assertFails(stranger.firestore().doc(tradeListPath).set({
      name: 'Hacked',
      order: 0,
      isAppDefault: true,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(tradeListPath).delete());

    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}`).update({
      kind: 'own',
      updatedAt: new Date(),
    }));

    const filePath = `organizations/${ORG}/projects/${JOB}/files/f1`;
    const validFile = {
      name: 'Slab engineer certificate',
      type: 'certificate',
      storagePath: `files/${ORG}/${JOB}/f1/slab.pdf`,
      thumbnailPath: null,
      contentType: 'application/pdf',
      sizeBytes: 412000,
      uploadedBy: OWNER.uid,
      uploadedAt: new Date(),
      documentDate: '2026-03-14',
      note: 'Engineer cert',
      linkedTo: null,
      status: 'active',
      archivedAt: null,
      jobId: JOB,
    };
    await assertSucceeds(owner.firestore().doc(filePath).set(validFile));
    await assertSucceeds(owner.firestore().doc(filePath).get());
    await assertFails(stranger.firestore().doc(filePath).get());
    await assertFails(stranger.firestore().doc(filePath).set(validFile));
    await assertFails(owner.firestore().doc(filePath).delete());
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/files/f-big`).set({
      ...validFile,
      storagePath: `files/${ORG}/${JOB}/f-big/huge.pdf`,
      sizeBytes: 26214401,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/files/f-video`).set({
      ...validFile,
      storagePath: `files/${ORG}/${JOB}/f-video/clip.mp4`,
      contentType: 'video/mp4',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/files/f-type`).set({
      ...validFile,
      storagePath: `files/${ORG}/${JOB}/f-type/docs.pdf`,
      type: 'folder',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/files/f-path`).set({
      ...validFile,
      storagePath: `files/${ORG_B}/${JOB_B}/f-path/stolen.pdf`,
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/files/f-estimate`).set({
      ...validFile,
      name: 'Kelly St estimate',
      type: 'estimate',
      storagePath: `files/${ORG}/${JOB}/f-estimate/kelly.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: 12000,
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/files/f-photo`).set({
      ...validFile,
      name: 'Site photo',
      type: 'photo',
      storagePath: `files/${ORG}/${JOB}/f-photo/site.jpg`,
      thumbnailPath: `files/${ORG}/${JOB}/f-photo/thumb.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 10240,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/files/f-thumb`).set({
      ...validFile,
      name: 'Stolen thumb',
      type: 'photo',
      storagePath: `files/${ORG}/${JOB}/f-thumb/site.jpg`,
      thumbnailPath: `files/${ORG}/${JOB}/f-photo/thumb.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 10240,
    }));
    await assertSucceeds(owner.firestore().doc(filePath).update({
      status: 'archived',
      archivedAt: new Date(),
    }));

    const storageRefPath = `files/${ORG}/${JOB}/f1/slab.pdf`;
    await assertSucceeds(
      owner.storage().ref(storageRefPath).put(Buffer.from('%PDF-1.4'), { contentType: 'application/pdf' }),
    );
    await assertSucceeds(owner.storage().ref(storageRefPath).getDownloadURL());
    await assertFails(stranger.storage().ref(storageRefPath).getDownloadURL());
    await assertFails(owner.storage().ref(storageRefPath).delete());
    await assertFails(
      owner.storage().ref(`files/${ORG}/${JOB}/f-video/clip.mp4`).put(
        Buffer.from('video'),
        { contentType: 'video/mp4' },
      ),
    );
    await assertFails(
      owner.storage().ref(`files/${ORG}/${JOB}/f-big/huge.pdf`).put(
        Buffer.alloc(26214401),
        { contentType: 'application/pdf' },
      ),
    );
    await assertFails(
      stranger.storage().ref(`files/${ORG}/${JOB}/f-stranger/x.pdf`).put(
        Buffer.from('%PDF-1.4'),
        { contentType: 'application/pdf' },
      ),
    );

    console.log('firestore.rules cost-plan and job-file tests passed; storage.rules job-file tests passed');
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
