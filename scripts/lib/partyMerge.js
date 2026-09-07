'use strict';

const {
  OPAL_ORG_ID,
  canonicalPartyName,
  clip,
  followMergedParty,
  partyHintFromExpense,
  partyHintFromInvoice,
} = require('./partyBackfill');

/**
 * Owner-named staging merges (7 Sep 2026). Metro Consulting vs Metro
 * Consulting Group is not on this list. Cross-kind leftovers stay unlinked.
 */
const APPROVED_PAIRS = [
  {
    from: {
      displayName: 'Lalit',
      canonicalName: 'lalit',
      kind: 'worker',
    },
    into: {
      displayName: 'Lalit Sahni',
      canonicalName: 'lalit sahni',
      kind: 'worker',
    },
  },
  {
    from: {
      displayName: 'Sydney Excavation and Demo',
      canonicalName: 'sydney excavation and demo',
      kind: 'service provider',
    },
    into: {
      displayName: 'Sydney Excavation and Demolition',
      canonicalName: 'sydney excavation and demolition',
      kind: 'service provider',
    },
  },
];

function parseMergeTarget(argv, projects) {
  const args = Array.isArray(argv) ? argv : [];
  const stagingProject = projects.stagingProject;
  const productionProject = projects.productionProject;
  if (args.includes('--production')) {
    throw new Error('Party merge refuses --production. Staging only.');
  }
  if (stagingProject === productionProject) {
    throw new Error('Staging and production IDs match. Stop.');
  }
  if (!args.includes('--staging')) {
    throw new Error('Pass --staging. Party merge refuses --production.');
  }
  const apply = args.includes('--apply');
  return {
    apply,
    dryRun: !apply,
    destination: stagingProject,
  };
}

function pairLabel(pair) {
  return `${pair.from.displayName} → ${pair.into.displayName}`;
}

function matchesOf(parties, spec) {
  return (parties || []).filter((row) => (
    String(row.canonicalName || '').trim() === spec.canonicalName
    && row.kind === spec.kind
  ));
}

function uniqueSurvivors(parties, matches, kind) {
  const out = new Map();
  matches.forEach((row) => {
    const survivor = row.status === 'active' && !clip(row.mergedInto, 80)
      ? row
      : followMergedParty(parties, row.id);
    if (!survivor) return;
    if (kind && survivor.kind !== kind) return;
    out.set(survivor.id, survivor);
  });
  return [...out.values()];
}

function resolveSurvivor(parties, spec) {
  const matches = matchesOf(parties, spec);
  if (matches.length === 0) {
    return { action: 'missing' };
  }
  const survivors = uniqueSurvivors(parties, matches, spec.kind);
  if (survivors.length === 1) {
    return { action: 'use', party: survivors[0], matches };
  }
  if (survivors.length === 0) {
    return { action: 'broken', matches };
  }
  return { action: 'ambiguous', matches, survivors };
}

function ledgerRows(snapshot) {
  const out = [];
  for (const job of snapshot.jobs || []) {
    for (const row of job.expenses || []) {
      out.push({
        jobId: job.id,
        jobName: job.name || job.id,
        collection: 'expenses',
        rowId: row.id,
        partyId: clip(row.partyId, 80) || '',
        hint: partyHintFromExpense(row),
      });
    }
    for (const row of job.invoices || []) {
      out.push({
        jobId: job.id,
        jobName: job.name || job.id,
        collection: 'invoices',
        rowId: row.id,
        partyId: clip(row.partyId, 80) || '',
        hint: partyHintFromInvoice(row),
      });
    }
    for (const row of job.quotes || []) {
      const name = clip(row.party, 120);
      out.push({
        jobId: job.id,
        jobName: job.name || job.id,
        collection: 'quotes',
        rowId: row.id,
        partyId: clip(row.partyId, 80) || '',
        hint: name ? { name, kind: null } : null,
      });
    }
  }
  return out;
}

function directoryRows(snapshot) {
  const out = [];
  for (const job of snapshot.jobs || []) {
    const directories = job.directories || {};
    const specs = [
      { collection: 'labour', kind: 'worker', nameFields: ['name'] },
      { collection: 'serviceProviders', kind: 'service provider', nameFields: ['name'] },
      { collection: 'clients', kind: 'client', nameFields: ['name'] },
      { collection: 'suppliers', kind: 'supplier', nameFields: ['name'] },
      { collection: 'trades', kind: 'trade', nameFields: ['tradeName', 'name'] },
    ];
    for (const spec of specs) {
      for (const row of directories[spec.collection] || []) {
        let displayName = '';
        for (const field of spec.nameFields) {
          displayName = clip(row[field], 120);
          if (displayName) break;
        }
        if (!displayName) continue;
        out.push({
          jobId: job.id,
          jobName: job.name || job.id,
          collection: spec.collection,
          rowId: row.id,
          partyId: clip(row.partyId, 80) || '',
          hint: { name: displayName, kind: spec.kind },
        });
      }
    }
  }
  return out;
}

function rowMatchesFrom(row, pair) {
  if (!row.hint || !row.hint.kind) return false;
  if (row.hint.kind !== pair.from.kind) return false;
  return canonicalPartyName(row.hint.name) === pair.from.canonicalName;
}

function stampPath(orgId, row) {
  return `organizations/${orgId}/projects/${row.jobId}/${row.collection}/${row.rowId}`;
}

function planApprovedMerges(snapshot) {
  const orgId = snapshot.orgId || OPAL_ORG_ID;
  if (orgId !== OPAL_ORG_ID) {
    throw new Error(`Party merge is org ${OPAL_ORG_ID} only.`);
  }
  const parties = snapshot.parties || [];
  const creates = [];
  const merges = [];
  const stamps = [];
  const skipped = [];
  const survivors = [];

  for (const pair of APPROVED_PAIRS) {
    if (pair.from.kind !== pair.into.kind) {
      throw new Error(`Refusing cross-kind merge: ${pairLabel(pair)}`);
    }
    const intoResolved = resolveSurvivor(parties, pair.into);
    if (intoResolved.action !== 'use') {
      throw new Error(
        `Survivor ${pair.into.displayName} (${pair.into.canonicalName}, ${pair.into.kind}) was not a unique active party on staging.`,
      );
    }
    const survivor = intoResolved.party;
    survivors.push({
      pair: pairLabel(pair),
      id: survivor.id,
      displayName: survivor.displayName,
      canonicalName: survivor.canonicalName,
      kind: survivor.kind,
    });

    const fromMatches = matchesOf(parties, pair.from);
    if (fromMatches.length === 0) {
      creates.push({
        plannedId: `new:${pair.from.canonicalName}:${pair.from.kind}`,
        displayName: pair.from.displayName,
        canonicalName: pair.from.canonicalName,
        kind: pair.from.kind,
        status: 'merged',
        mergedInto: survivor.id,
        pair: pairLabel(pair),
      });
    } else {
      const fromSurvivors = uniqueSurvivors(parties, fromMatches, pair.from.kind);
      if (fromSurvivors.length > 1) {
        throw new Error(
          `Source ${pair.from.displayName} (${pair.from.kind}) matches more than one survivor. Will not guess.`,
        );
      }
      fromMatches.forEach((row) => {
        if (row.id === survivor.id) {
          skipped.push({ reason: 'source-is-survivor', partyId: row.id, pair: pairLabel(pair) });
          return;
        }
        const followed = row.status === 'active' && !clip(row.mergedInto, 80)
          ? row
          : followMergedParty(parties, row.id);
        if (row.status === 'merged' && clip(row.mergedInto, 80) === survivor.id) {
          skipped.push({ reason: 'already-merged', partyId: row.id, pair: pairLabel(pair) });
          return;
        }
        if (followed && followed.id === survivor.id && row.status === 'merged') {
          skipped.push({ reason: 'already-merged-chain', partyId: row.id, pair: pairLabel(pair) });
          return;
        }
        if (row.status === 'merged' && followed && followed.id !== survivor.id) {
          throw new Error(
            `${pair.from.displayName} is already merged into ${followed.displayName} (${followed.id}), not ${pair.into.displayName}.`,
          );
        }
        merges.push({
          fromId: row.id,
          intoId: survivor.id,
          fromDisplayName: row.displayName,
          pair: pairLabel(pair),
        });
      });
    }

    const rows = [...directoryRows(snapshot), ...ledgerRows(snapshot)];
    rows.forEach((row) => {
      if (!rowMatchesFrom(row, pair)) return;
      if (row.partyId === survivor.id) {
        skipped.push({
          reason: 'already-stamped',
          path: stampPath(orgId, row),
          pair: pairLabel(pair),
        });
        return;
      }
      stamps.push({
        jobId: row.jobId,
        jobName: row.jobName,
        collection: row.collection,
        rowId: row.rowId,
        path: stampPath(orgId, row),
        partyId: survivor.id,
        displayName: row.hint.name,
        canonicalName: pair.from.canonicalName,
        kind: pair.from.kind,
        pair: pairLabel(pair),
      });
    });
  }

  return {
    orgId,
    survivors,
    creates,
    merges,
    stamps,
    skipped,
    writeCount: creates.length + merges.length + stamps.length,
  };
}

module.exports = {
  APPROVED_PAIRS,
  OPAL_ORG_ID,
  parseMergeTarget,
  planApprovedMerges,
  pairLabel,
};
