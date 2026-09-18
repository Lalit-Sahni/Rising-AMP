#!/usr/bin/env node
/**
 * Rules tests: profiles, ledger void/purge, org isolation, job files,
 * invite send records (Phase 17 Part F), and Phase 18 Part B job roles.
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
    await assertSucceeds(stranger.firestore().doc(`profiles/${STRANGER.uid}`).get());
    await assertSucceeds(
      stranger.firestore().collection('profiles').where('email', '==', STRANGER.email).get(),
    );
    await assertSucceeds(
      stranger.firestore().collection('organizations').where('invitedEmails', 'array-contains', STRANGER.email).get(),
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
    await assertSucceeds(owner.firestore().doc(tradeListPath).get());
    await assertFails(stranger.firestore().doc(tradeListPath).get());
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

    const factsPath = `organizations/${ORG}/projects/${JOB}/facts/current`;
    const validFacts = {
      jobId: JOB,
      schemaVersion: 1,
      createdBy: OWNER.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const addressFact = {
      value: '72 Centenary Dr',
      source: 'owner',
      sourceRef: null,
      confirmedBy: OWNER.uid,
      confirmedAt: new Date(),
      updatedAt: new Date(),
    };
    const floorAreaFact = {
      value: 167.22,
      unit: 'sqm',
      source: 'import',
      sourceRef: 'file-boq',
      confirmedBy: null,
      confirmedAt: null,
      updatedAt: new Date(),
    };
    const contractFact = {
      value: 32191629,
      source: 'document',
      sourceRef: null,
      confirmedBy: null,
      confirmedAt: null,
      updatedAt: new Date(),
    };
    await assertSucceeds(owner.firestore().doc(factsPath).set(validFacts));
    await assertSucceeds(owner.firestore().doc(factsPath).get());
    await assertFails(stranger.firestore().doc(factsPath).get());
    await assertFails(stranger.firestore().doc(factsPath).set(validFacts));
    await assertSucceeds(coworker.firestore().doc(factsPath).get());
    await assertSucceeds(coworker.firestore().doc(factsPath).update({
      address: addressFact,
      floorArea: floorAreaFact,
      contractValueCents: contractFact,
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(factsPath).delete());
    await assertFails(coworker.firestore().doc(factsPath).delete());
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/facts/other`).set(validFacts));
    await assertFails(owner.firestore().doc(factsPath).set({
      ...validFacts,
      sentence: 'The house is 167 sqm',
    }));
    await assertFails(owner.firestore().doc(factsPath).set({
      ...validFacts,
      contractValueCents: { ...contractFact, value: '32191629' },
    }));
    await assertFails(owner.firestore().doc(factsPath).set({
      schemaVersion: 1,
      createdBy: OWNER.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(factsPath).set({
      ...validFacts,
      floorArea: { ...floorAreaFact, unit: 'm2' },
    }));
    await assertFails(owner.firestore().doc(factsPath).set({
      ...validFacts,
      siteStart: {
        value: '09/09/2026',
        source: 'owner',
        sourceRef: null,
        confirmedBy: null,
        confirmedAt: null,
        updatedAt: new Date(),
      },
    }));
    await assertSucceeds(owner.firestore().doc(factsPath).set({
      ...validFacts,
      address: addressFact,
      floorArea: floorAreaFact,
      contractValueCents: contractFact,
      siteStart: {
        value: '2026-09-09',
        source: 'owner',
        sourceRef: null,
        confirmedBy: null,
        confirmedAt: null,
        updatedAt: new Date(),
      },
    }));

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
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/askHistory/${OWNER.uid}/items/q-facts`).set({
      ...validAsk,
      question: 'what is the floor area',
      choices: [{
        query: 'jobFacts',
        params: { jobId: JOB, field: 'floorArea' },
        provenance: {
          query: 'jobFacts',
          params: { jobId: JOB, field: 'floorArea' },
          source: 'facts',
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
    await assertFails(owner.firestore().doc(`organizations/${ORG_B}/projects/${JOB_B}/expenses/e-assistant-cross`).set({
      category: 'purchase',
      total: 12,
      source: 'assistant',
      assistantReceiptId: 'r-cross',
      assistantConfirmed: false,
    }));
    await assertFails(coworker.firestore().doc(`organizations/${ORG_B}/projects/${JOB_B}/expenses/e-assistant-cross-2`).set({
      category: 'purchase',
      total: 12,
      source: 'assistant',
      assistantReceiptId: 'r-cross-2',
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
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/assistantReceipts/r-human`).set({
      ...validReceipt,
      id: 'r-human',
      clientKey: 'client-key-human-1',
      origin: 'human',
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/assistantReceipts/r-origin-assistant`).set({
      ...validReceipt,
      id: 'r-origin-assistant',
      clientKey: 'client-key-assistant-1',
      origin: 'assistant',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/assistantReceipts/r-robot`).set({
      ...validReceipt,
      id: 'r-robot',
      clientKey: 'client-key-robot-1',
      origin: 'robot',
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
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-scan`).update({
      tradeId: 'electrical',
      source: 'assistant',
      assistantReceiptId: 'r-code-human',
      assistantConfirmed: true,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/expenses/e-scan`).update({
      assistantConfirmed: 'yes',
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

    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}`).update({
      assistantWritesEnabled: true,
    }));
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}`).update({
      assistantWritesEnabled: false,
    }));
    await assertFails(coworker.firestore().doc(`organizations/${ORG}`).update({
      assistantWritesEnabled: true,
    }));
    await assertFails(stranger.firestore().doc(`organizations/${ORG}`).update({
      assistantWritesEnabled: true,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}`).update({
      assistantWritesEnabled: 'yes',
    }));
    await assertSucceeds(coworker.firestore().doc(`organizations/${ORG}`).update({
      legacyWorkspaceNames: { pin: 'Kelly St' },
      updatedAt: new Date(),
    }));

    // Phase 17 Part F: invite send records.
    const seededInvitePath = `organizations/${ORG}/projects/${JOB}/invites/inv-seeded`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc(seededInvitePath).set({
        to: COWORKER.email,
        invitedBy: OWNER.email,
        sentAt: new Date(),
        via: 'resend',
        providerId: 're_seeded',
        status: 'sent',
        statusAt: new Date(),
      });
    });
    const gmailInvite = {
      to: COWORKER.email,
      invitedBy: OWNER.email,
      sentAt: new Date(),
      via: 'gmail',
      providerId: null,
      status: 'sent',
      statusAt: new Date(),
    };
    await assertSucceeds(owner.firestore().doc(seededInvitePath).get());
    await assertSucceeds(coworker.firestore().doc(seededInvitePath).get());
    await assertSucceeds(owner.firestore().collection(`organizations/${ORG}/projects/${JOB}/invites`).get());
    await assertFails(stranger.firestore().doc(seededInvitePath).get());
    await assertFails(stranger.firestore().collection(`organizations/${ORG}/projects/${JOB}/invites`).get());

    // The Gmail fallback row is the only client write allowed.
    await assertSucceeds(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-gmail`).set(gmailInvite));
    await assertSucceeds(coworker.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-gmail-2`).set({
      ...gmailInvite,
      invitedBy: COWORKER.email,
    }));

    // Nobody writes a 'resend' row from the client.
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-resend`).set({
      ...gmailInvite,
      via: 'resend',
      providerId: 're_abc',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-resend-2`).set({
      ...gmailInvite,
      via: 'resend',
      providerId: null,
    }));

    // Shape checks on the fallback row.
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-bad-provider`).set({
      ...gmailInvite,
      providerId: 're_abc',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-bad-status`).set({
      ...gmailInvite,
      status: 'delivered',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-bad-by`).set({
      ...gmailInvite,
      invitedBy: COWORKER.email,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-bad-to`).set({
      ...gmailInvite,
      to: STRANGER.email,
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-bad-case`).set({
      ...gmailInvite,
      to: 'Coworker@Opal.Test',
    }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-extra`).set({
      ...gmailInvite,
      failureReason: 'sneaky',
    }));
    await assertFails(stranger.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-stranger`).set(gmailInvite));

    // No client updates or deletes, even for the sender.
    await assertFails(owner.firestore().doc(seededInvitePath).update({ status: 'bounced' }));
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-gmail`).update({ status: 'bounced' }));
    await assertFails(owner.firestore().doc(seededInvitePath).delete());
    await assertFails(owner.firestore().doc(`organizations/${ORG}/projects/${JOB}/invites/inv-gmail`).delete());

    // Phase 18 Part B. Roles on the job document.
    const SITE = { uid: 'site-1', email: 'site@opal.test' };
    const VIEWER = { uid: 'viewer-1', email: 'viewer@opal.test' };
    const MANAGER = { uid: 'manager-1', email: 'manager@opal.test' };
    const JOB_ROLES = 'job-roles';
    const JOB_SITE = 'job-site-only';
    const rolesExpense = `organizations/${ORG}/projects/${JOB_ROLES}/expenses/e-roles`;
    const rolesInvoice = `organizations/${ORG}/projects/${JOB_ROLES}/invoices/inv-roles`;
    const rolesPlan = `organizations/${ORG}/projects/${JOB_ROLES}/costPlan/current`;
    const rolesJob = `organizations/${ORG}/projects/${JOB_ROLES}`;
    const siteOnlyJob = `organizations/${ORG}/projects/${JOB_SITE}`;
    const draftPlan = (jobId, uid) => ({
      jobId,
      level: 'target',
      targetCents: 1000000,
      baselineDate: '2026-08-31',
      gstMode: 'inclusive',
      status: 'draft',
      sections: [],
      createdBy: uid,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null,
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc(`organizations/${ORG}`).update({
        invitedEmails: [
          OWNER.email, COWORKER.email, SITE.email, VIEWER.email, MANAGER.email,
        ],
      });
      await db.doc(rolesJob).set({
        name: 'Roles job',
        orgId: ORG,
        invitedEmails: [OWNER.email, SITE.email, VIEWER.email, MANAGER.email],
        managers: [MANAGER.email],
        viewers: [VIEWER.email],
        status: 'active',
      });
      await db.doc(siteOnlyJob).set({
        name: 'Site-only job',
        orgId: ORG,
        invitedEmails: [OWNER.email, MANAGER.email],
        status: 'active',
      });
      await db.doc(rolesExpense).set({ category: 'purchase', total: 4 });
      await db.doc(rolesInvoice).set({
        invoiceNumber: '2026-0100',
        status: 'draft',
        total: 9,
      });
      await db.doc(rolesPlan).set(draftPlan(JOB_ROLES, OWNER.uid));
    });

    const site = testEnv.authenticatedContext(SITE.uid, {
      email: SITE.email,
      email_verified: true,
    });
    const viewer = testEnv.authenticatedContext(VIEWER.uid, {
      email: VIEWER.email,
      email_verified: true,
    });
    const manager = testEnv.authenticatedContext(MANAGER.uid, {
      email: MANAGER.email,
      email_verified: true,
    });

    // Missing managers/viewers = Site. Invited coworker writes expenses,
    // cannot write invoices or lock the cost plan. Owner can.
    await assertSucceeds(coworker.firestore().doc(
      `organizations/${ORG}/projects/${JOB}/expenses/e-site-default`,
    ).set({ category: 'purchase', total: 2 }));
    await assertFails(coworker.firestore().doc(
      `organizations/${ORG}/projects/${JOB}/invoices/inv-site-default`,
    ).set({ invoiceNumber: '2026-0101', status: 'draft', total: 5 }));
    await assertFails(coworker.firestore().doc(
      `organizations/${ORG}/projects/${JOB}`,
    ).update({
      name: 'Renamed by default site',
      updatedAt: new Date(),
    }));
    await assertSucceeds(coworker.firestore().doc(costPlanPath).update({
      targetCents: 2500000,
      updatedAt: new Date(),
    }));
    await assertFails(coworker.firestore().doc(costPlanPath).update({
      status: 'locked',
      updatedAt: new Date(),
    }));
    await assertSucceeds(owner.firestore().doc(
      `organizations/${ORG}/projects/${JOB}/invoices/inv-owner-roles`,
    ).set({ invoiceNumber: '2026-0102', status: 'draft', total: 8 }));
    await assertSucceeds(owner.firestore().doc(costPlanPath).update({
      status: 'locked',
      updatedAt: new Date(),
    }));

    // Viewer reads, writes nothing. Rename is manage-only (Part D).
    await assertSucceeds(viewer.firestore().doc(rolesExpense).get());
    await assertSucceeds(viewer.firestore().doc(rolesInvoice).get());
    await assertSucceeds(viewer.firestore().doc(rolesPlan).get());
    await assertFails(viewer.firestore().doc(rolesExpense).set({
      category: 'purchase',
      total: 3,
    }));
    await assertFails(viewer.firestore().doc(
      `organizations/${ORG}/projects/${JOB_ROLES}/invoices/inv-viewer`,
    ).set({ invoiceNumber: '2026-0103', status: 'draft', total: 1 }));
    await assertFails(viewer.firestore().doc(rolesJob).update({
      name: 'Renamed by viewer',
      updatedAt: new Date(),
    }));
    await assertFails(site.firestore().doc(rolesJob).update({
      name: 'Renamed by site',
      updatedAt: new Date(),
    }));

    // Manager: invoice, lock, people below them. Not managers[], not owner.
    await assertSucceeds(manager.firestore().doc(rolesJob).update({
      name: 'Renamed by manager',
      updatedAt: new Date(),
    }));
    await assertSucceeds(manager.firestore().doc(
      `organizations/${ORG}/projects/${JOB_ROLES}/invoices/inv-manager`,
    ).set({ invoiceNumber: '2026-0104', status: 'draft', total: 11 }));
    await assertSucceeds(manager.firestore().doc(rolesPlan).update({
      status: 'locked',
      updatedAt: new Date(),
    }));
    await assertSucceeds(manager.firestore().doc(rolesJob).update({
      invitedEmails: [OWNER.email, SITE.email, VIEWER.email, MANAGER.email, 'book@opal.test'],
      viewers: [VIEWER.email],
      updatedAt: new Date(),
    }));
    await assertFails(manager.firestore().doc(rolesJob).update({
      invitedEmails: [SITE.email, VIEWER.email, MANAGER.email, 'book@opal.test'],
      updatedAt: new Date(),
    }));
    await assertFails(manager.firestore().doc(rolesJob).update({
      viewers: [VIEWER.email, OWNER.email],
      updatedAt: new Date(),
    }));
    await assertFails(manager.firestore().doc(rolesJob).update({
      managers: [MANAGER.email, SITE.email],
      updatedAt: new Date(),
    }));
    await assertFails(manager.firestore().doc(siteOnlyJob).update({
      managers: [MANAGER.email],
      updatedAt: new Date(),
    }));
    await assertFails(manager.firestore().doc(
      `organizations/${ORG}/projects/job-manager-create`,
    ).set({
      name: 'Manager create',
      orgId: ORG,
      invitedEmails: [OWNER.email, MANAGER.email],
      status: 'active',
      kind: 'client',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // Site cannot invite. Disjoint / subset fail. Stranger fails. Owner create works.
    await assertFails(coworker.firestore().doc(
      `organizations/${ORG}/projects/${JOB}`,
    ).update({
      invitedEmails: [OWNER.email, COWORKER.email, SITE.email],
      updatedAt: new Date(),
    }));
    await assertFails(site.firestore().doc(rolesJob).update({
      invitedEmails: [OWNER.email, SITE.email, VIEWER.email, MANAGER.email, 'book@opal.test', 'extra@opal.test'],
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(rolesJob).update({
      managers: [MANAGER.email, VIEWER.email],
      viewers: [VIEWER.email],
      updatedAt: new Date(),
    }));
    await assertFails(owner.firestore().doc(rolesJob).update({
      managers: [MANAGER.email, 'ghost@opal.test'],
      updatedAt: new Date(),
    }));
    await assertFails(stranger.firestore().doc(rolesExpense).get());
    await assertFails(stranger.firestore().doc(rolesJob).update({
      name: 'Hacked',
      updatedAt: new Date(),
    }));
    await assertSucceeds(owner.firestore().doc(
      `organizations/${ORG}/projects/job-owner-create`,
    ).set({
      name: 'Owner create',
      orgId: ORG,
      invitedEmails: [OWNER.email],
      formerEmails: [],
      status: 'active',
      kind: 'client',
      createdAt: new Date(),
      updatedAt: new Date(),
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

    const avatarPath = `avatars/${OWNER.uid}/avatar.jpg`;
    await assertSucceeds(
      owner.storage().ref(avatarPath).put(Buffer.from('jpeg'), { contentType: 'image/jpeg' }),
    );
    await assertSucceeds(owner.storage().ref(avatarPath).getDownloadURL());
    await assertSucceeds(site.storage().ref(avatarPath).getDownloadURL());
    await assertFails(stranger.storage().ref(avatarPath).getDownloadURL());
    await assertFails(
      stranger.storage().ref(avatarPath).put(Buffer.from('jpeg'), { contentType: 'image/jpeg' }),
    );

    console.log('firestore.rules cost-plan, job-file and role tests passed; storage.rules job-file tests passed');
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
