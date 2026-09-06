'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canonicalPartyName,
  namesMatch,
  isLiveDirectoryRow,
  apostropheNearMiss,
  dropSingleCharTokens,
  partyHintFromExpense,
  resolveBackfillTarget,
  planPartyBackfill,
  applyPlanToSnapshot,
  formatOwnerReport,
} = require('./partyBackfill');

function job(partial) {
  return {
    id: partial.id || 'job-1',
    name: partial.name || '72 Centenary Dr',
    directories: {
      clients: [],
      suppliers: [],
      labour: [],
      trades: [],
      serviceProviders: [],
      ...(partial.directories || {}),
    },
    expenses: partial.expenses || [],
    invoices: partial.invoices || [],
    quotes: partial.quotes || [],
  };
}

function snapshot(partial) {
  return {
    orgId: 'opal-ss-constructions',
    parties: partial.parties || [],
    jobs: partial.jobs || [],
  };
}

function stampedIds(plan, collection) {
  return plan.stamps
    .filter((row) => row.collection === collection)
    .map((row) => `${row.displayName}->${row.partyId}`)
    .sort();
}

function unlinkedNames(plan, collection) {
  return plan.unlinkedLedger
    .filter((row) => row.collection === collection)
    .map((row) => row.name || row.reason)
    .sort();
}

function reportHas(plan, snippet) {
  return formatOwnerReport(plan).includes(snippet);
}

test('linking bar: namesMatch over-merges Smith/Smithson and Lalit, canonicals do not', () => {
  assert.equal(namesMatch('Smith', 'Smithson Electrical'), true);
  assert.equal(canonicalPartyName('Smith'), 'smith');
  assert.equal(canonicalPartyName('Smithson Electrical'), 'smithson electrical');
  assert.equal(namesMatch('Lalit', 'Lalit Sahni'), true);
  assert.equal(canonicalPartyName('Lalit'), 'lalit');
  assert.equal(canonicalPartyName('Lalit Sahni'), 'lalit sahni');
  assert.equal(canonicalPartyName("Mark's Joinery"), 'mark s joinery');
  assert.equal(canonicalPartyName('Mark Joinery Pty Ltd'), 'mark joinery');
  assert.equal(namesMatch("Mark's Joinery", 'Mark Joinery Pty Ltd'), false);
  assert.equal(dropSingleCharTokens('mark s joinery'), 'mark joinery');
  assert.equal(apostropheNearMiss('mark s joinery', 'mark joinery'), true);
  assert.equal(canonicalPartyName('Bunnings Warehouse'), 'bunnings');
  assert.equal(canonicalPartyName('Bunnings'), 'bunnings');
});

test('Smith and Smithson stay two parties; expenses named Smith stay unlinked to Smithson', () => {
  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        suppliers: [
          { id: 's1', name: 'Smithson Electrical', status: 'active' },
        ],
      },
      expenses: [
        { id: 'e1', category: 'purchase', supplier: 'Smith' },
        { id: 'e2', category: 'purchase', supplier: 'Smithson Electrical' },
      ],
    })],
  }));

  assert.equal(plan.partiesToCreate.length, 1);
  assert.equal(plan.partiesToCreate[0].canonicalName, 'smithson electrical');
  assert.equal(plan.stamps.some((row) => row.collection === 'expenses' && row.displayName === 'Smith'), false);
  assert.equal(
    plan.stamps.some((row) => row.collection === 'expenses' && row.displayName === 'Smithson Electrical'),
    true,
  );
  assert.ok(unlinkedNames(plan, 'expenses').includes('Smith'));
  assert.ok(plan.candidateMergeGroups.some((group) => (
    group.canonicals.includes('smith') || group.members.some((row) => row.displayName === 'Smith')
  )));
  assert.ok(reportHas(plan, 'Smith'));
  assert.ok(reportHas(plan, 'Smithson Electrical'));
  assert.equal(plan.stamps.every((row) => !String(row.displayName).includes('Smith') || row.displayName === 'Smithson Electrical' || row.collection !== 'expenses'), true);
});

test('two directory Smith/Smithson rows become two parties and a candidate group, not one stamp', () => {
  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        suppliers: [
          { id: 'a', name: 'Smith' },
          { id: 'b', name: 'Smithson Electrical' },
        ],
      },
    })],
  }));
  const canonicals = plan.partiesToCreate.map((row) => row.canonicalName).sort();
  assert.deepEqual(canonicals, ['smith', 'smithson electrical']);
  const group = plan.candidateMergeGroups.find((row) => row.kind === 'supplier');
  assert.ok(group);
  assert.ok(group.canonicals.includes('smith'));
  assert.ok(group.canonicals.includes('smithson electrical'));
  assert.equal(plan.writeCount, 2 + 2);
});

test('Lalit and Lalit Sahni stay two parties; a Lalit expense does not take the Sahni id', () => {
  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        labour: [{ id: 'w1', name: 'Lalit Sahni' }],
      },
      expenses: [
        { id: 'e1', category: 'labour', workerName: 'Lalit' },
        { id: 'e2', category: 'labour', workerName: 'Lalit Sahni' },
      ],
    })],
  }));
  assert.equal(plan.partiesToCreate.length, 1);
  assert.equal(plan.partiesToCreate[0].canonicalName, 'lalit sahni');
  assert.ok(unlinkedNames(plan, 'expenses').includes('Lalit'));
  assert.equal(plan.stamps.filter((row) => row.collection === 'expenses').length, 1);
  assert.equal(plan.stamps.find((row) => row.collection === 'expenses').displayName, 'Lalit Sahni');
  assert.ok(plan.candidateMergeGroups.some((group) => group.members.some((row) => row.displayName === 'Lalit')));
});

test('Mark apostrophe miss: two parties, listed as candidates, never auto-linked', () => {
  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        trades: [
          { id: 't1', tradeName: "Mark's Joinery" },
          { id: 't2', tradeName: 'Mark Joinery Pty Ltd' },
        ],
      },
      expenses: [
        { id: 'e1', category: 'trade', tradeName: "Mark's Joinery" },
        { id: 'e2', category: 'trade', tradeName: 'Mark Joinery Pty Ltd' },
      ],
    })],
  }));
  const canonicals = plan.partiesToCreate.map((row) => row.canonicalName).sort();
  assert.deepEqual(canonicals, ['mark joinery', 'mark s joinery']);
  const group = plan.candidateMergeGroups.find((row) => row.kind === 'trade');
  assert.ok(group);
  assert.equal(group.reason.includes('apostrophe'), true);
  assert.equal(plan.stamps.filter((row) => row.collection === 'expenses').length, 2);
  const ids = new Set(plan.stamps.filter((row) => row.collection === 'expenses').map((row) => row.partyId));
  assert.equal(ids.size, 2);
});

test('Bunnings Warehouse collapses onto Bunnings and auto-links', () => {
  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        suppliers: [
          { id: 's1', name: 'Bunnings Warehouse' },
          { id: 's2', name: 'Bunnings' },
        ],
      },
      expenses: [
        { id: 'e1', category: 'purchase', supplier: 'Bunnings Warehouse' },
        { id: 'e2', category: 'materials', supplier: 'Bunnings' },
      ],
    })],
  }));
  assert.equal(plan.partiesToCreate.length, 1);
  assert.equal(plan.partiesToCreate[0].canonicalName, 'bunnings');
  const partyId = plan.partiesToCreate[0].plannedId;
  assert.equal(plan.stamps.filter((row) => row.collection === 'suppliers').length, 2);
  assert.ok(plan.stamps.every((row) => row.partyId === partyId));
  assert.equal(plan.candidateMergeGroups.length, 0);
  assert.equal(unlinkedNames(plan, 'expenses').length, 0);
});

test('two kinds with the same canonical stay separate; a quote with that name stays unlinked', () => {
  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        suppliers: [{ id: 's1', name: 'Metro' }],
        clients: [{ id: 'c1', name: 'Metro' }],
      },
      invoices: [{ id: 'i1', clientName: 'Metro' }],
      expenses: [{ id: 'e1', category: 'purchase', supplier: 'Metro' }],
      quotes: [{ id: 'q1', party: 'Metro' }],
    })],
  }));
  assert.equal(plan.partiesToCreate.length, 2);
  const kinds = plan.partiesToCreate.map((row) => row.kind).sort();
  assert.deepEqual(kinds, ['client', 'supplier']);
  assert.ok(plan.stamps.some((row) => row.collection === 'invoices' && row.kind === 'client'));
  assert.ok(plan.stamps.some((row) => row.collection === 'expenses' && row.kind === 'supplier'));
  assert.ok(unlinkedNames(plan, 'quotes').includes('Metro'));
  assert.equal(plan.stamps.some((row) => row.collection === 'quotes'), false);
});

test('a quote stamps only when exactly one active party has that canonical, any kind', () => {
  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        trades: [{ id: 't1', tradeName: 'Asif' }],
      },
      quotes: [{ id: 'q1', party: 'Asif' }],
    })],
  }));
  assert.equal(plan.stamps.filter((row) => row.collection === 'quotes').length, 1);
  assert.equal(plan.stamps.find((row) => row.collection === 'quotes').displayName, 'Asif');
});

test('live-only directory rows: moved, archived and duplicate are skipped', () => {
  assert.equal(isLiveDirectoryRow({ status: 'moved' }), false);
  assert.equal(isLiveDirectoryRow({ status: 'archived' }), false);
  assert.equal(isLiveDirectoryRow({ status: 'duplicate' }), false);
  assert.equal(isLiveDirectoryRow({ status: 'active' }), true);
  assert.equal(isLiveDirectoryRow({}), true);

  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        suppliers: [
          { id: 'live', name: 'Rodgers Revesby' },
          { id: 'moved', name: 'Ghost Co', status: 'moved' },
          { id: 'archived', name: 'Old Co', status: 'archived' },
          { id: 'dup', name: 'Copy Co', status: 'duplicate' },
        ],
      },
      expenses: [
        { id: 'e1', category: 'purchase', supplier: 'Ghost Co' },
        { id: 'e2', category: 'purchase', supplier: 'Rodgers Revesby' },
      ],
    })],
  }));
  assert.equal(plan.partiesToCreate.length, 1);
  assert.equal(plan.partiesToCreate[0].canonicalName, 'rodgers revesby');
  assert.equal(plan.stamps.filter((row) => row.collection === 'suppliers').length, 1);
  assert.equal(plan.stamps.find((row) => row.collection === 'suppliers').rowId, 'live');
  assert.ok(unlinkedNames(plan, 'expenses').includes('Ghost Co'));
});

test('expenses that do not exact-match stay unlinked', () => {
  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        suppliers: [{ id: 's1', name: 'Complete Lintels Pty Ltd' }],
      },
      expenses: [
        { id: 'e1', category: 'purchase', supplier: 'Complete' },
        { id: 'e2', category: 'equipment', equipmentName: 'Mixer' },
      ],
    })],
  }));
  assert.ok(unlinkedNames(plan, 'expenses').includes('Complete'));
  assert.ok(plan.unlinkedLedger.some((row) => row.reason.includes('no party hint')));
  assert.equal(plan.stamps.some((row) => row.collection === 'expenses' && row.displayName === 'Complete'), false);
});

test('reuses an existing org party with the exact pair and follows mergedInto', () => {
  const plan = planPartyBackfill(snapshot({
    parties: [
      {
        id: 'old',
        displayName: 'Bunnings Warehouse',
        canonicalName: 'bunnings',
        kind: 'supplier',
        status: 'merged',
        mergedInto: 'live',
      },
      {
        id: 'live',
        displayName: 'Bunnings',
        canonicalName: 'bunnings',
        kind: 'supplier',
        status: 'active',
        mergedInto: null,
      },
    ],
    jobs: [job({
      directories: {
        suppliers: [{ id: 's1', name: 'Bunnings Warehouse' }],
      },
      expenses: [{ id: 'e1', category: 'purchase', supplier: 'Bunnings' }],
    })],
  }));
  assert.equal(plan.partiesToCreate.length, 0);
  assert.ok(plan.stamps.every((row) => row.partyId === 'live'));
});

test('already-correct partyId is not a write; a second plan after apply is 0 writes', () => {
  const firstSnapshot = snapshot({
    jobs: [job({
      directories: {
        clients: [{ id: 'c1', name: 'Vaneet Khera' }],
      },
      invoices: [{ id: 'i1', clientName: 'Vaneet Khera' }],
    })],
  });
  const first = planPartyBackfill(firstSnapshot);
  assert.ok(first.writeCount > 0);
  const applied = applyPlanToSnapshot(firstSnapshot, first);
  const second = planPartyBackfill(applied);
  assert.equal(second.writeCount, 0);
  assert.equal(second.counts.partiesCreated, 0);
  assert.equal(second.counts.rowsStamped, 0);
  assert.ok(second.counts.rowsSkippedAlreadyStamped >= 2);
});

test('expense name mapping matches partyHintFromExpense', () => {
  assert.deepEqual(partyHintFromExpense({ category: 'labour', workerName: 'Sam' }), { name: 'Sam', kind: 'worker' });
  assert.deepEqual(partyHintFromExpense({ category: 'trade', trade: 'Asif' }), { name: 'Asif', kind: 'trade' });
  assert.deepEqual(partyHintFromExpense({ category: 'purchase', supplier: 'Bunnings' }), { name: 'Bunnings', kind: 'supplier' });
  assert.deepEqual(partyHintFromExpense({ category: 'materials', supplier: 'Rodgers' }), { name: 'Rodgers', kind: 'supplier' });
  assert.deepEqual(partyHintFromExpense({ category: 'service', provider: 'Optus' }), { name: 'Optus', kind: 'service provider' });
  assert.equal(partyHintFromExpense({ category: 'investor', supplier: 'Mum' }), null);
});

test('refuses production even when --apply is passed', () => {
  assert.throws(
    () => resolveBackfillTarget(['--apply', '--production'], {
      stagingProject: 'rising-amp-staging',
      productionProject: 'rising-amp-467702-b5',
    }),
    /refuses --production/i,
  );
  assert.throws(
    () => resolveBackfillTarget(['--apply', '--staging'], {
      stagingProject: 'same',
      productionProject: 'same',
    }),
    /match/i,
  );
  const ok = resolveBackfillTarget(['--dry-run', '--staging'], {
    stagingProject: 'rising-amp-staging',
    productionProject: 'rising-amp-467702-b5',
  });
  assert.equal(ok.destination, 'rising-amp-staging');
  assert.equal(ok.apply, false);
});

test('owner report lists candidate groups and unlinked names, not a Smith→Smithson stamp', () => {
  const plan = planPartyBackfill(snapshot({
    jobs: [job({
      directories: {
        suppliers: [{ id: 's1', name: 'Smithson Electrical' }],
        labour: [{ id: 'w1', name: 'Lalit Sahni' }],
        trades: [
          { id: 't1', tradeName: "Mark's Joinery" },
          { id: 't2', tradeName: 'Mark Joinery Pty Ltd' },
        ],
      },
      expenses: [
        { id: 'e1', category: 'purchase', supplier: 'Smith' },
        { id: 'e2', category: 'labour', workerName: 'Lalit' },
      ],
    })],
  }));
  const report = formatOwnerReport(plan);
  assert.match(report, /Candidate merge groups/);
  assert.match(report, /Smithson Electrical/);
  assert.match(report, /Lalit Sahni/);
  assert.match(report, /Mark's Joinery/);
  assert.match(report, /Unlinked ledger rows/);
  assert.equal(stampedIds(plan, 'expenses').some((row) => row.startsWith('Smith->')), false);
  assert.equal(stampedIds(plan, 'expenses').some((row) => row.startsWith('Lalit->')), false);
});
