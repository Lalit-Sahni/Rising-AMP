'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  APPROVED_PAIRS,
  parseMergeTarget,
  planApprovedMerges,
} = require('./partyMerge');

const PROJECTS = {
  stagingProject: 'rising-amp-staging',
  productionProject: 'rising-amp-467702-b5',
};

function party(partial) {
  return {
    id: partial.id,
    displayName: partial.displayName || partial.canonicalName,
    canonicalName: partial.canonicalName,
    kind: partial.kind,
    status: partial.status || 'active',
    mergedInto: partial.mergedInto || null,
  };
}

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

function baseParties(extra) {
  return [
    party({ id: 'ls', displayName: 'Lalit Sahni', canonicalName: 'lalit sahni', kind: 'worker' }),
    party({
      id: 'sed',
      displayName: 'Sydney Excavation and Demolition',
      canonicalName: 'sydney excavation and demolition',
      kind: 'service provider',
    }),
    ...(extra || []),
  ];
}

test('owner-named pairs are only Lalit and Sydney Excavation; Metro is refused', () => {
  assert.equal(APPROVED_PAIRS.length, 2);
  assert.deepEqual(
    APPROVED_PAIRS.map((pair) => `${pair.from.canonicalName}->${pair.into.canonicalName}`),
    [
      'lalit->lalit sahni',
      'sydney excavation and demo->sydney excavation and demolition',
    ],
  );
  assert.equal(APPROVED_PAIRS.every((pair) => pair.from.kind === pair.into.kind), true);
  const blob = JSON.stringify(APPROVED_PAIRS).toLowerCase();
  assert.equal(blob.includes('metro'), false);
  assert.equal(blob.includes('consulting'), false);
  assert.equal(blob.includes('acme'), false);
  assert.equal(blob.includes('client'), false);
});

test('parseMergeTarget refuses --production even with --apply --staging', () => {
  assert.throws(() => parseMergeTarget(['--production'], PROJECTS), /production/);
  assert.throws(() => parseMergeTarget(['--apply', '--production'], PROJECTS), /production/);
  assert.throws(
    () => parseMergeTarget(['--apply', '--staging', '--production'], PROJECTS),
    /production/,
  );
  assert.throws(() => parseMergeTarget(['--apply'], PROJECTS), /--staging/);
  const dry = parseMergeTarget(['--staging'], PROJECTS);
  assert.equal(dry.apply, false);
  assert.equal(dry.destination, 'rising-amp-staging');
  const write = parseMergeTarget(['--apply', '--staging'], PROJECTS);
  assert.equal(write.apply, true);
  assert.equal(write.destination, 'rising-amp-staging');
});

test('plan does not merge Metro Consulting or stamp leftover cross-kind rows', () => {
  const plan = planApprovedMerges(snapshot({
    parties: baseParties([
      party({
        id: 'm1',
        displayName: 'Metro Consulting',
        canonicalName: 'metro consulting',
        kind: 'service provider',
      }),
      party({
        id: 'm2',
        displayName: 'Metro Consulting Group',
        canonicalName: 'metro consulting group',
        kind: 'service provider',
      }),
    ]),
    jobs: [job({
      expenses: [
        { id: 'e-metro', category: 'service', provider: 'Metro Consulting' },
        { id: 'e-lalit', category: 'labour', workerName: 'Lalit' },
        { id: 'e-sydney', category: 'service', provider: 'Sydney Excavation and Demo' },
        { id: 'e-client', category: 'purchase', supplier: 'Client' },
        { id: 'e-none', category: 'equipment' },
      ],
      quotes: [
        { id: 'q-acme', party: 'ACME SCREW PILES' },
      ],
    })],
  }));
  assert.equal(plan.merges.some((row) => row.fromId === 'm1' || row.intoId === 'm2'), false);
  assert.equal(plan.stamps.some((row) => row.rowId === 'e-metro'), false);
  assert.equal(plan.stamps.some((row) => row.rowId === 'e-client'), false);
  assert.equal(plan.stamps.some((row) => row.rowId === 'e-none'), false);
  assert.equal(plan.stamps.some((row) => row.rowId === 'q-acme'), false);
  assert.deepEqual(plan.survivors.map((row) => row.id).sort(), ['ls', 'sed']);
  assert.equal(plan.creates.length, 2);
  assert.equal(plan.stamps.some((row) => row.rowId === 'e-lalit' && row.partyId === 'ls'), true);
  assert.equal(plan.stamps.some((row) => row.rowId === 'e-sydney' && row.partyId === 'sed'), true);
});

test('does not merge a same-canonical party of another kind', () => {
  const plan = planApprovedMerges(snapshot({
    parties: baseParties([
      party({ id: 'lalit-sup', displayName: 'Lalit', canonicalName: 'lalit', kind: 'supplier' }),
    ]),
    jobs: [job({
      expenses: [{ id: 'e-lalit', category: 'labour', workerName: 'Lalit' }],
    })],
  }));
  assert.equal(plan.merges.some((row) => row.fromId === 'lalit-sup'), false);
  assert.equal(plan.creates.some((row) => (
    row.canonicalName === 'lalit' && row.kind === 'worker' && row.mergedInto === 'ls'
  )), true);
});

test('merges an existing source party and is idempotent after apply', () => {
  const first = planApprovedMerges(snapshot({
    parties: baseParties([
      party({ id: 'lalit-exp', displayName: 'Lalit', canonicalName: 'lalit', kind: 'worker' }),
      party({
        id: 'syd-exp',
        displayName: 'Sydney Excavation and Demo',
        canonicalName: 'sydney excavation and demo',
        kind: 'service provider',
      }),
    ]),
    jobs: [job({
      expenses: [
        { id: 'e-lalit', category: 'labour', workerName: 'Lalit', partyId: 'lalit-exp' },
        { id: 'e-sydney', category: 'service', provider: 'Sydney Excavation and Demo' },
      ],
    })],
  }));
  assert.equal(first.creates.length, 0);
  assert.equal(first.merges.length, 2);
  assert.equal(first.merges.every((row) => row.intoId === 'ls' || row.intoId === 'sed'), true);
  assert.equal(first.stamps.length, 2);

  const second = planApprovedMerges(snapshot({
    parties: baseParties([
      party({
        id: 'lalit-exp',
        displayName: 'Lalit',
        canonicalName: 'lalit',
        kind: 'worker',
        status: 'merged',
        mergedInto: 'ls',
      }),
      party({
        id: 'syd-exp',
        displayName: 'Sydney Excavation and Demo',
        canonicalName: 'sydney excavation and demo',
        kind: 'service provider',
        status: 'merged',
        mergedInto: 'sed',
      }),
    ]),
    jobs: [job({
      expenses: [
        { id: 'e-lalit', category: 'labour', workerName: 'Lalit', partyId: 'ls' },
        { id: 'e-sydney', category: 'service', provider: 'Sydney Excavation and Demo', partyId: 'sed' },
      ],
    })],
  }));
  assert.equal(second.writeCount, 0);
  assert.equal(second.merges.length, 0);
  assert.equal(second.creates.length, 0);
  assert.equal(second.stamps.length, 0);
});

test('follows mergedInto on the survivor', () => {
  const plan = planApprovedMerges(snapshot({
    parties: [
      party({
        id: 'ls-old',
        displayName: 'Lalit Sahni',
        canonicalName: 'lalit sahni',
        kind: 'worker',
        status: 'merged',
        mergedInto: 'ls-live',
      }),
      party({ id: 'ls-live', displayName: 'Lalit Sahni', canonicalName: 'lalit sahni', kind: 'worker' }),
      party({
        id: 'sed',
        displayName: 'Sydney Excavation and Demolition',
        canonicalName: 'sydney excavation and demolition',
        kind: 'service provider',
      }),
    ],
    jobs: [],
  }));
  assert.equal(plan.survivors.find((row) => row.canonicalName === 'lalit sahni').id, 'ls-live');
  assert.equal(plan.creates.find((row) => row.canonicalName === 'lalit').mergedInto, 'ls-live');
});

test('throws when the named survivor is missing', () => {
  assert.throws(
    () => planApprovedMerges(snapshot({ parties: [], jobs: [] })),
    /Lalit Sahni/,
  );
});
