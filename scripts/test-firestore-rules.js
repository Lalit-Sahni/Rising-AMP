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

    const rollupPath = `organizations/${ORG}/projects/${JOB}/ledgerRollup/current`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(rollupPath).set({
        schemaVersion: 1,
        documentCount: 5,
        liveCount: 5,
        costCents: 465600,
        investorCents: 0,
        byCategory: {},
        byMonth: {},
        byDay: {},
        revision: 1,
      });
    });
    await assertSucceeds(owner.firestore().doc(rollupPath).get());
    await assertFails(stranger.firestore().doc(rollupPath).get());
    await assertFails(owner.firestore().doc(rollupPath).set({
      schemaVersion: 1,
      documentCount: 0,
      liveCount: 0,
      costCents: 0,
      investorCents: 0,
      byCategory: {},
      byMonth: {},
      byDay: {},
      revision: 2,
    }));
    await assertFails(owner.firestore().doc(rollupPath).delete());
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/ledgerRollup/other`).get());

    const orgRollupPath = `organizations/${ORG}/ledgerRollup/current`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(orgRollupPath).set({
        schemaVersion: 1,
        documentCount: 5,
        liveCount: 5,
        costCents: 465600,
        investorCents: 0,
        byCategory: {},
        byMonth: {},
        byDay: {},
        byTrade: {},
        byParty: {},
        revision: 1,
      });
    });
    await assertSucceeds(owner.firestore().doc(orgRollupPath).get());
    await assertFails(stranger.firestore().doc(orgRollupPath).get());
    await assertFails(owner.firestore().doc(orgRollupPath).set({
      schemaVersion: 1,
      documentCount: 0,
      liveCount: 0,
      costCents: 0,
      investorCents: 0,
      byCategory: {},
      byMonth: {},
      byDay: {},
      byTrade: {},
      byParty: {},
      revision: 2,
    }));
    await assertFails(owner.firestore().doc(orgRollupPath).delete());
    await assertFails(owner.firestore().doc(`organizations/${ORG}/ledgerRollup/other`).get());
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
      fileIds: ['fileAbc123', 'fileDef456'],
      fileId: 'fileAbc123',
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(quotePath).update({
      fileId: 'x'.repeat(81),
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(quotePath).update({
      fileIds: Array.from({ length: 11 }, (_, index) => `file${index}`),
      updatedAt: new Date(),
    }));
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

    const partyPath = `organizations/${ORG}/parties/bunnings`;
    const validParty = {
      displayName: 'Bunnings',
      canonicalName: 'bunnings',
      kind: 'supplier',
      status: 'active',
      abn: null,
      email: null,
      phone: null,
      mergedInto: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await assertSucceeds(owner.firestore().doc(partyPath).set(validParty));
    await assertSucceeds(owner.firestore().doc(partyPath).get());
    await assertFails(stranger.firestore().doc(partyPath).get());
    await assertFails(stranger.firestore().doc(partyPath).set({
      ...validParty,
      displayName: 'Hacked',
    }));
    await assertFails(owner.firestore().doc(partyPath).set({
      ...validParty,
      kind: 'vendor',
    }));
    await assertFails(owner.firestore().doc(partyPath).set({
      ...validParty,
      status: 'merged',
      mergedInto: 'bunnings',
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/parties/old-bunnings`).set({
      ...validParty,
      displayName: 'Bunnings Warehouse',
      canonicalName: 'bunnings warehouse',
      status: 'merged',
      mergedInto: 'bunnings',
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/parties/old-bunnings`).update({
      status: 'active',
      mergedInto: null,
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(partyPath).delete());
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-party`).set({
      category: 'purchase',
      total: 12,
      partyId: 'bunnings',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-party-bad`).set({
      category: 'purchase',
      total: 12,
      partyId: 'x'.repeat(81),
    }));

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

    const textPath = `${filePath}/content/text`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(textPath).set({
        text: 'Retention is 5 percent',
        textStatus: 'ok',
        charCount: 23,
        truncated: false,
        contentType: 'application/pdf',
        updatedAt: new Date(),
      });
    });
    await assertSucceeds(owner.firestore().doc(textPath).get());
    await assertFails(stranger.firestore().doc(textPath).get());
    await assertFails(owner.firestore().doc(textPath).set({
      text: 'nope',
      textStatus: 'ok',
      charCount: 4,
      truncated: false,
      contentType: 'application/pdf',
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(textPath).update({ text: 'nope' }));
    await assertFails(owner.firestore().doc(textPath).delete());
    await assertFails(owner.firestore().doc(`${filePath}/content/other`).get());

    const COWORKER = {
      uid: 'coworker-1',
      email: 'coworker@opal.test',
    };
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`organizations/${ORG}`).update({
        invitedEmails: [OWNER.email, COWORKER.email],
      });
      await db.doc(`organizations/${ORG}/projects/${JOB}`).update({
        invitedEmails: [OWNER.email, COWORKER.email],
      });
    });
    const coworker = testEnv.authenticatedContext(COWORKER.uid, {
      email: COWORKER.email,
      email_verified: true,
    });

    const askPath = `organizations/${ORG}/askHistory/${OWNER.uid}/items/q1`;
    const validAsk = {
      uid: OWNER.uid,
      orgId: ORG,
      jobId: JOB,
      jobLabel: 'Test job',
      question: 'how much on concreting',
      askedAt: new Date(),
      choices: [{
        query: 'spendByTrade',
        params: { jobId: JOB, tradeId: 'concreting' },
        provenance: {
          query: 'spendByTrade',
          params: { jobId: JOB, tradeId: 'concreting' },
          source: 'ledger',
          rowCount: 1,
          capped: false,
        },
        snapshot: {
          cents: 4850,
          count: 1,
          capped: false,
        },
      }],
    };
    await assertSucceeds(owner.firestore().doc(askPath).set(validAsk));
    await assertSucceeds(owner.firestore().doc(askPath).get());
    await assertFails(coworker.firestore().doc(askPath).get());
    await assertFails(stranger.firestore().doc(askPath).get());
    await assertFails(coworker.firestore().collection(`organizations/${ORG}/askHistory/${OWNER.uid}/items`).get());
    await assertFails(coworker.firestore().doc(askPath).set(validAsk));
    await assertFails(coworker.firestore().doc(`organizations/${ORG}/askHistory/${COWORKER.uid}/items/stolen`).set({
      ...validAsk,
      uid: OWNER.uid,
    }));
    await assertSucceeds(coworker.firestore().doc(`organizations/${ORG}/askHistory/${COWORKER.uid}/items/q2`).set({
      ...validAsk,
      uid: COWORKER.uid,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG_B}/askHistory/${OWNER.uid}/items/q3`).set({
      ...validAsk,
      orgId: ORG_B,
      jobId: JOB_B,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-prose`).set({
      ...validAsk,
      sentence: 'You spent $99,999',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-chat`).set({
      ...validAsk,
      messages: [{ role: 'assistant', content: 'You spent $99,999' }],
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-reason`).set({
      ...validAsk,
      choices: [{
        ...validAsk.choices[0],
        reason: 'Because $99,999',
      }],
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-sentence`).set({
      ...validAsk,
      choices: [{
        ...validAsk.choices[0],
        sentence: 'You spent $99,999',
      }],
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-refusal`).set({
      ...validAsk,
      choices: [{
        ...validAsk.choices[0],
        refusalReason: 'nothing_coded',
      }],
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-refusal-bad`).set({
      ...validAsk,
      choices: [{
        ...validAsk.choices[0],
        refusalReason: 'guess',
      }],
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-docs`).set({
      ...validAsk,
      question: 'what does the contract say about retention',
      choices: [{
        query: 'answerFromDocuments',
        params: { jobId: JOB, type: 'contract', text: 'retention' },
        provenance: {
          query: 'answerFromDocuments',
          params: { jobId: JOB, type: 'contract', text: 'retention' },
          source: 'files',
          rowCount: 1,
          capped: false,
        },
        snapshot: { count: 1, capped: false },
      }],
    }));
    await assertFails(owner.firestore().doc(askPath).update({
      question: 'changed',
    }));
    await assertFails(coworker.firestore().doc(askPath).delete());
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-org`).set({
      ...validAsk,
      jobId: '',
      jobLabel: '',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-otherjob`).set({
      ...validAsk,
      jobId: JOB_B,
    }));
    await assertSucceeds(owner.firestore().doc(askPath).delete());
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-org`).delete());

    const receiptPath = `organizations/${ORG}/assistantReceipts/r1`;
    const validReceipt = {
      id: 'r1',
      orgId: ORG,
      jobId: JOB,
      action: 'codeExpense',
      source: 'assistant',
      clientKey: 'client-key-1',
      tier: 'do',
      status: 'applied',
      evidence: {
        tradeId: { source: 'user', value: 'concreting' },
      },
      documentIds: { expenseId: 'exp-1' },
      changed: { tradeId: { from: null, to: 'concreting' } },
      undo: {
        kind: 'restoreTradeId',
        expenseId: 'exp-1',
        previousTradeId: null,
      },
      createdAt: new Date(),
    };
    await assertSucceeds(owner.firestore().doc(receiptPath).set(validReceipt));
    await assertSucceeds(owner.firestore().doc(receiptPath).get());
    await assertSucceeds(coworker.firestore().doc(receiptPath).get());
    await assertFails(stranger.firestore().doc(receiptPath).get());
    await assertFails(stranger.firestore().doc(receiptPath).set(validReceipt));
    await assertFails(owner.firestore().doc(`organizations/${ORG_B}/assistantReceipts/r-b`).set({
      ...validReceipt,
      id: 'r-b',
      orgId: ORG_B,
      jobId: JOB_B,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/assistantReceipts/r-prose`).set({
      ...validReceipt,
      id: 'r-prose',
      sentence: 'Coded $99 to concreting.',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/assistantReceipts/r-chat`).set({
      ...validReceipt,
      id: 'r-chat',
      messages: [{ role: 'assistant', content: 'done' }],
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/assistantReceipts/r-email`).set({
      ...validReceipt,
      id: 'r-email',
      action: 'sendEmail',
    }));
    await assertFails(owner.firestore().doc(receiptPath).update({
      clientKey: 'changed-key-1',
    }));
    await assertFails(owner.firestore().doc(receiptPath).update({
      action: 'undoAction',
    }));
    await assertSucceeds(owner.firestore().doc(receiptPath).update({
      status: 'undone',
      undoneAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(receiptPath).delete());
    await assertFails(coworker.firestore().doc(receiptPath).delete());
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-assistant`).set({
      category: 'purchase',
      total: 12,
      tradeId: 'concreting',
      source: 'assistant',
      assistantReceiptId: 'r1',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-source-bad`).set({
      category: 'purchase',
      total: 12,
      source: 'model',
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-scan`).set({
      category: 'purchase',
      total: 124.5,
      supplier: 'Bunnings',
      source: 'assistant',
      assistantReceiptId: 'r-create',
      assistantConfirmed: false,
      gstCents: 1245,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-gst-bad`).set({
      category: 'purchase',
      total: 12,
      gstCents: 12.45,
    }));

    const createReceiptPath = `organizations/${ORG}/assistantReceipts/r-create`;
    await assertSucceeds(owner.firestore().doc(createReceiptPath).set({
      id: 'r-create',
      orgId: ORG,
      jobId: JOB,
      action: 'createExpense',
      source: 'assistant',
      clientKey: 'client-key-create-1',
      tier: 'do',
      status: 'applied',
      evidence: {
        date: { source: 'ocr', value: '2026-08-14' },
        amount: { source: 'ocr', value: '12450' },
        party: { source: 'record', value: 'party-1' },
        gst: { source: 'ocr', value: '1245' },
      },
      documentIds: { expenseId: 'e-scan' },
      undo: {
        kind: 'voidExpense',
        expenseId: 'e-scan',
      },
      createdAt: new Date(),
    }));
    await assertSucceeds(owner.firestore().doc(createReceiptPath).update({
      status: 'undone',
      undoneAt: new Date(),
    }));

    const batchPath = `organizations/${ORG}/assistantReceipts/r-batch`;
    await assertSucceeds(owner.firestore().doc(batchPath).set({
      id: 'r-batch',
      orgId: ORG,
      jobId: JOB,
      action: 'codeExpenseBatch',
      source: 'assistant',
      clientKey: 'client-key-batch-1',
      tier: 'do',
      status: 'applied',
      evidence: {
        batch: { source: 'record', value: '2' },
      },
      documentIds: {
        expenseIds: ['e1', 'e3'],
        receiptIds: ['r-child-1', 'r-child-2'],
      },
      undo: {
        kind: 'restoreTradeIdBatch',
        items: [
          { expenseId: 'e1', previousTradeId: null, receiptId: 'r-child-1' },
          { expenseId: 'e3', previousTradeId: null, receiptId: 'r-child-2' },
        ],
      },
      createdAt: new Date(),
    }));
    await assertSucceeds(owner.firestore().doc(batchPath).update({
      status: 'undone',
      undoneAt: new Date(),
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
