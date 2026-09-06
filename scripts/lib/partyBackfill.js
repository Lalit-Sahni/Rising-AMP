'use strict';

const {
  canonicalPartyName,
  namesMatch,
  isLiveDirectoryRow,
} = require('./partyName');

const OPAL_ORG_ID = 'opal-ss-constructions';

const DIRECTORY_SPECS = [
  { collection: 'clients', kind: 'client', nameFields: ['name'] },
  { collection: 'suppliers', kind: 'supplier', nameFields: ['name'] },
  { collection: 'labour', kind: 'worker', nameFields: ['name'] },
  { collection: 'trades', kind: 'trade', nameFields: ['tradeName', 'name'] },
  { collection: 'serviceProviders', kind: 'service provider', nameFields: ['name'] },
];

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function partyKey(canonicalName, kind) {
  return `${kind}::${canonicalName}`;
}

function directoryDisplayName(collection, row) {
  const spec = DIRECTORY_SPECS.find((item) => item.collection === collection);
  const fields = (spec && spec.nameFields) || ['name'];
  for (const field of fields) {
    const name = clip(row && row[field], 120);
    if (name) return name;
  }
  return '';
}

function partyHintFromExpense(expense) {
  if (!expense) return null;
  const category = String(expense.category || '').toLowerCase().trim();
  if (category === 'labour') {
    const name = clip(expense.workerName, 120);
    return name ? { name, kind: 'worker' } : null;
  }
  if (category === 'trade') {
    const name = clip(expense.tradeName || expense.trade, 120);
    return name ? { name, kind: 'trade' } : null;
  }
  if (category === 'purchase' || category === 'materials') {
    const name = clip(expense.supplier, 120);
    return name ? { name, kind: 'supplier' } : null;
  }
  if (category === 'service') {
    const name = clip(expense.provider, 120);
    return name ? { name, kind: 'service provider' } : null;
  }
  return null;
}

function partyHintFromInvoice(invoice) {
  const name = clip(invoice && invoice.clientName, 120);
  return name ? { name, kind: 'client' } : null;
}

function dropSingleCharTokens(canonical) {
  return String(canonical || '')
    .split(' ')
    .filter((token) => token && token.length > 1)
    .join(' ');
}

function apostropheNearMiss(leftCanonical, rightCanonical) {
  if (!leftCanonical || !rightCanonical) return false;
  if (leftCanonical === rightCanonical) return false;
  const left = dropSingleCharTokens(leftCanonical);
  const right = dropSingleCharTokens(rightCanonical);
  return Boolean(left) && left === right;
}

function followMergedParty(parties, startId) {
  const byId = new Map(parties.map((row) => [row.id, row]));
  const seen = new Set();
  let current = byId.get(startId) || null;
  while (current && current.status === 'merged') {
    const nextId = clip(current.mergedInto, 80);
    if (!nextId || seen.has(current.id)) return null;
    seen.add(current.id);
    current = byId.get(nextId) || null;
  }
  if (!current || current.status !== 'active') return null;
  return current;
}

function survivorsOf(parties, matches, kind) {
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

/** Exact canonical equality only. Never uses namesMatch. */
function resolvePartyFromList(parties, input) {
  const canonical = String(input.canonicalName || '').trim();
  if (!canonical) return { action: 'unset' };
  const matches = parties.filter((row) => row.canonicalName === canonical);
  if (input.kind) {
    const ofKind = matches.filter((row) => row.kind === input.kind);
    const survivors = survivorsOf(parties, ofKind, input.kind);
    if (survivors.length === 1) return { action: 'use', partyId: survivors[0].id };
    if (survivors.length === 0) return { action: 'create' };
    return { action: 'unset' };
  }
  const survivors = survivorsOf(parties, matches);
  const kinds = new Set(survivors.map((row) => row.kind));
  if (survivors.length === 1 && kinds.size === 1) {
    return { action: 'use', partyId: survivors[0].id };
  }
  return { action: 'unset' };
}

function richness(row, displayName) {
  const email = String((row && row.email) || '').trim();
  const phone = String((row && (row.phone || row.mobile)) || '').trim();
  const abn = String((row && row.abn) || '').trim();
  return (
    String(displayName || '').length
    + (email.includes('@') ? 20 : 0)
    + (phone ? 10 : 0)
    + (abn ? 10 : 0)
  );
}

function resolveBackfillTarget(argv, projects) {
  const args = Array.isArray(argv) ? argv : [];
  const stagingProject = projects.stagingProject;
  const productionProject = projects.productionProject;
  if (args.includes('--production')) {
    throw new Error('Part A2 refuses --production. Staging only.');
  }
  if (stagingProject === productionProject) {
    throw new Error('Staging and production IDs match. Stop.');
  }
  if (!args.includes('--staging')) {
    throw new Error('Pass --staging.');
  }
  const apply = args.includes('--apply');
  return {
    apply,
    dryRun: !apply,
    destination: stagingProject,
  };
}

function collectLiveDirectoryMembers(snapshot) {
  const members = [];
  for (const job of snapshot.jobs || []) {
    const directories = job.directories || {};
    for (const spec of DIRECTORY_SPECS) {
      const rows = directories[spec.collection] || [];
      for (const row of rows) {
        if (!isLiveDirectoryRow(row)) continue;
        const displayName = directoryDisplayName(spec.collection, row);
        const canonicalName = canonicalPartyName(displayName);
        if (!canonicalName) continue;
        members.push({
          jobId: job.id,
          jobName: job.name || job.id,
          collection: spec.collection,
          rowId: row.id,
          displayName,
          canonicalName,
          kind: spec.kind,
          email: clip(row.email, 120) || null,
          phone: clip(row.phone || row.mobile, 40) || null,
          abn: clip(row.abn, 20) || null,
          partyId: clip(row.partyId, 80) || '',
          row,
        });
      }
    }
  }
  return members;
}

function pickSourceRow(rows) {
  return rows.slice().sort((a, b) => richness(b.row, b.displayName) - richness(a.row, a.displayName))[0];
}

function plannedPartyList(existingParties, creates) {
  return [
    ...(existingParties || []).map((row) => ({
      id: row.id,
      displayName: row.displayName,
      canonicalName: row.canonicalName,
      kind: row.kind,
      status: row.status || 'active',
      mergedInto: row.mergedInto || null,
    })),
    ...creates.map((row) => ({
      id: row.plannedId,
      displayName: row.displayName,
      canonicalName: row.canonicalName,
      kind: row.kind,
      status: 'active',
      mergedInto: null,
    })),
  ];
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
        category: String(row.category || '').toLowerCase().trim(),
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
        category: '',
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
        category: '',
      });
    }
  }
  return out;
}

function addClusterMember(nodes, row) {
  const canonicalName = row.canonicalName;
  const kind = row.kind;
  const displayName = row.displayName;
  if (!canonicalName || !kind || !displayName) return;
  const key = partyKey(canonicalName, kind);
  if (!nodes.has(key)) {
    nodes.set(key, {
      key,
      canonicalName,
      kind,
      displayNames: new Set(),
      members: [],
    });
  }
  const node = nodes.get(key);
  node.displayNames.add(displayName);
  if (!node.members.some((member) => (
    member.collection === row.collection && member.rowId === row.rowId && member.jobId === (row.jobId || '')
  ))) {
    node.members.push({
      displayName,
      canonicalName,
      jobId: row.jobId || '',
      jobName: row.jobName || '',
      collection: row.collection,
      rowId: row.rowId,
    });
  }
}

function clusterCandidateGroups(directoryMembers, existingParties, unlinkedLedger) {
  const nodes = new Map();

  directoryMembers.forEach((row) => {
    addClusterMember(nodes, {
      canonicalName: row.canonicalName,
      kind: row.kind,
      displayName: row.displayName,
      jobId: row.jobId,
      jobName: row.jobName,
      collection: row.collection,
      rowId: row.rowId,
    });
  });

  (existingParties || []).forEach((party) => {
    addClusterMember(nodes, {
      canonicalName: String(party.canonicalName || '').trim(),
      kind: party.kind,
      displayName: party.displayName || party.canonicalName,
      jobId: '',
      jobName: '(org)',
      collection: 'parties',
      rowId: party.id,
    });
  });

  (unlinkedLedger || []).forEach((row) => {
    if (!row.name || !row.canonicalName || !row.kind) return;
    addClusterMember(nodes, {
      canonicalName: row.canonicalName,
      kind: row.kind,
      displayName: row.name,
      jobId: row.jobId,
      jobName: row.jobName,
      collection: row.collection,
      rowId: row.rowId,
    });
  });

  const list = [...nodes.values()];
  const parent = list.map((_, index) => index);

  function find(index) {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  }

  function namesConnect(left, right) {
    const leftNames = [...left.displayNames];
    const rightNames = [...right.displayNames];
    for (const a of leftNames) {
      for (const b of rightNames) {
        if (namesMatch(a, b)) return true;
      }
    }
    return apostropheNearMiss(left.canonicalName, right.canonicalName);
  }

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const left = list[i];
      const right = list[j];
      if (left.kind !== right.kind) continue;
      if (left.canonicalName === right.canonicalName) continue;
      if (namesConnect(left, right)) union(i, j);
    }
  }

  const grouped = new Map();
  list.forEach((node, index) => {
    const root = find(index);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root).push(node);
  });

  const groups = [];
  grouped.forEach((cluster) => {
    const canonicals = new Set(cluster.map((node) => node.canonicalName));
    if (canonicals.size < 2) return;
    const members = [];
    cluster.forEach((node) => {
      node.members.forEach((member) => {
        if (member.collection === 'parties') return;
        members.push(member);
      });
    });
    if (members.length === 0) {
      cluster.forEach((node) => {
        node.members.forEach((member) => members.push(member));
      });
    }
    const reasons = [];
    for (let i = 0; i < cluster.length; i += 1) {
      for (let j = i + 1; j < cluster.length; j += 1) {
        if (namesConnect(cluster[i], cluster[j]) && namesMatch(
          [...cluster[i].displayNames][0],
          [...cluster[j].displayNames][0],
        )) {
          reasons.push('namesMatch');
        }
        if (apostropheNearMiss(cluster[i].canonicalName, cluster[j].canonicalName)) {
          reasons.push('apostrophe-token');
        }
      }
    }
    groups.push({
      kind: cluster[0].kind,
      reason: reasons.includes('apostrophe-token') && !reasons.includes('namesMatch')
        ? 'apostrophe-token'
        : (reasons.includes('apostrophe-token') ? 'namesMatch+apostrophe-token' : 'namesMatch'),
      canonicals: [...canonicals].sort(),
      members: members.sort((a, b) => {
        const byName = a.displayName.localeCompare(b.displayName);
        if (byName) return byName;
        return `${a.jobName}:${a.collection}`.localeCompare(`${b.jobName}:${b.collection}`);
      }),
    });
  });

  groups.sort((a, b) => a.kind.localeCompare(b.kind) || a.canonicals[0].localeCompare(b.canonicals[0]));
  return groups;
}

function attachLedgerMembersToGroups(groups, unlinkedLedger) {
  groups.forEach((group) => {
    const canonicalSet = new Set(group.canonicals);
    const displays = group.members.map((row) => row.displayName);
    unlinkedLedger.forEach((row) => {
      if (!row.name) return;
      if (row.kind && row.kind !== group.kind) return;
      const sameKindOrQuote = !row.kind || row.kind === group.kind;
      if (!sameKindOrQuote) return;
      const inCanonical = canonicalSet.has(row.canonicalName);
      const fuzzy = displays.some((name) => namesMatch(name, row.name))
        || canonicalSet.has(dropSingleCharTokens(row.canonicalName))
        || [...canonicalSet].some((canonical) => apostropheNearMiss(canonical, row.canonicalName));
      if (!inCanonical && !fuzzy) return;
      if (group.members.some((member) => (
        member.collection === row.collection && member.rowId === row.rowId && member.jobId === row.jobId
      ))) return;
      group.members.push({
        displayName: row.name,
        canonicalName: row.canonicalName,
        jobId: row.jobId,
        jobName: row.jobName,
        collection: row.collection,
        rowId: row.rowId,
      });
    });
  });
}

function groupUnlinked(unlinkedLedger) {
  const buckets = new Map();
  unlinkedLedger.forEach((row) => {
    const name = row.name || '(no name)';
    const key = `${row.collection}::${row.kind || '(no kind)'}::${name}::${row.reason}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        name,
        kind: row.kind || null,
        collection: row.collection,
        reason: row.reason,
        count: 0,
        jobs: new Set(),
      });
    }
    const bucket = buckets.get(key);
    bucket.count += 1;
    bucket.jobs.add(row.jobName);
  });
  return [...buckets.values()]
    .map((row) => ({
      name: row.name,
      kind: row.kind,
      collection: row.collection,
      reason: row.reason,
      count: row.count,
      jobs: [...row.jobs].sort(),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function planPartyBackfill(snapshot) {
  const existingParties = (snapshot.parties || []).map((row) => ({
    id: row.id,
    displayName: row.displayName,
    canonicalName: row.canonicalName,
    kind: row.kind,
    status: row.status || 'active',
    mergedInto: row.mergedInto || null,
  }));

  const directoryMembers = collectLiveDirectoryMembers(snapshot);
  const byPair = new Map();
  directoryMembers.forEach((row) => {
    const key = partyKey(row.canonicalName, row.kind);
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(row);
  });

  const partiesToCreate = [];
  const pairResolution = new Map();

  byPair.forEach((rows, key) => {
    const canonicalName = rows[0].canonicalName;
    const kind = rows[0].kind;
    const resolved = resolvePartyFromList(existingParties, { canonicalName, kind });
    if (resolved.action === 'use') {
      pairResolution.set(key, { action: 'use', partyId: resolved.partyId, plannedId: resolved.partyId });
      return;
    }
    if (resolved.action === 'unset') {
      pairResolution.set(key, { action: 'unset' });
      return;
    }
    const source = pickSourceRow(rows);
    const plannedId = `new:${key}`;
    partiesToCreate.push({
      key,
      plannedId,
      displayName: source.displayName,
      canonicalName,
      kind,
      abn: source.abn,
      email: source.email,
      phone: source.phone,
    });
    pairResolution.set(key, { action: 'create', partyId: plannedId, plannedId });
  });

  const plannedParties = plannedPartyList(existingParties, partiesToCreate);
  const stamps = [];
  const alreadyStamped = [];

  directoryMembers.forEach((row) => {
    const key = partyKey(row.canonicalName, row.kind);
    const resolved = pairResolution.get(key);
    if (!resolved || resolved.action === 'unset' || !resolved.partyId) return;
    const entry = {
      jobId: row.jobId,
      jobName: row.jobName,
      collection: row.collection,
      rowId: row.rowId,
      path: `organizations/${snapshot.orgId}/projects/${row.jobId}/${row.collection}/${row.rowId}`,
      partyId: resolved.partyId,
      partyKey: key,
      displayName: row.displayName,
      canonicalName: row.canonicalName,
      kind: row.kind,
    };
    if (row.partyId && row.partyId === resolved.partyId) {
      alreadyStamped.push(entry);
      return;
    }
    stamps.push(entry);
  });

  const unlinkedLedger = [];
  ledgerRows(snapshot).forEach((row) => {
    if (!row.hint) {
      unlinkedLedger.push({
        jobId: row.jobId,
        jobName: row.jobName,
        collection: row.collection,
        rowId: row.rowId,
        name: '',
        canonicalName: '',
        kind: null,
        reason: row.collection === 'expenses'
          ? `no party hint (${row.category || 'uncategorised'})`
          : 'no typed name',
      });
      return;
    }
    const canonicalName = canonicalPartyName(row.hint.name);
    if (!canonicalName) {
      unlinkedLedger.push({
        jobId: row.jobId,
        jobName: row.jobName,
        collection: row.collection,
        rowId: row.rowId,
        name: row.hint.name,
        canonicalName: '',
        kind: row.hint.kind,
        reason: 'empty canonical name',
      });
      return;
    }
    const resolved = resolvePartyFromList(plannedParties, {
      canonicalName,
      kind: row.hint.kind || null,
    });
    if (resolved.action !== 'use') {
      unlinkedLedger.push({
        jobId: row.jobId,
        jobName: row.jobName,
        collection: row.collection,
        rowId: row.rowId,
        name: row.hint.name,
        canonicalName,
        kind: row.hint.kind,
        reason: resolved.action === 'unset' ? 'no unique exact canonical match' : 'no exact canonical match',
      });
      return;
    }
    const entry = {
      jobId: row.jobId,
      jobName: row.jobName,
      collection: row.collection,
      rowId: row.rowId,
      path: `organizations/${snapshot.orgId}/projects/${row.jobId}/${row.collection}/${row.rowId}`,
      partyId: resolved.partyId,
      partyKey: row.hint.kind ? partyKey(canonicalName, row.hint.kind) : `any::${canonicalName}`,
      displayName: row.hint.name,
      canonicalName,
      kind: row.hint.kind,
    };
    if (row.partyId && row.partyId === resolved.partyId) {
      alreadyStamped.push(entry);
      return;
    }
    stamps.push(entry);
  });

  const candidateMergeGroups = clusterCandidateGroups(
    directoryMembers,
    existingParties.concat(
      partiesToCreate.map((row) => ({
        id: row.plannedId,
        displayName: row.displayName,
        canonicalName: row.canonicalName,
        kind: row.kind,
        status: 'active',
        mergedInto: null,
      })),
    ),
    unlinkedLedger,
  );
  attachLedgerMembersToGroups(candidateMergeGroups, unlinkedLedger);

  const unlinkedGrouped = groupUnlinked(unlinkedLedger);
  const writeCount = partiesToCreate.length + stamps.length;

  return {
    orgId: snapshot.orgId,
    partiesToCreate,
    stamps,
    alreadyStamped,
    unlinkedLedger,
    unlinkedGrouped,
    candidateMergeGroups,
    counts: {
      partiesCreated: partiesToCreate.length,
      rowsStamped: stamps.length,
      rowsSkippedAlreadyStamped: alreadyStamped.length,
      unlinkedLedger: unlinkedLedger.length,
    },
    writeCount,
  };
}

function applyPlanToSnapshot(snapshot, plan, idMap) {
  const mapped = idMap || {};
  const parties = (snapshot.parties || []).map((row) => ({ ...row }));
  plan.partiesToCreate.forEach((row) => {
    const id = mapped[row.plannedId] || row.plannedId;
    parties.push({
      id,
      displayName: row.displayName,
      canonicalName: row.canonicalName,
      kind: row.kind,
      status: 'active',
      mergedInto: null,
      abn: row.abn,
      email: row.email,
      phone: row.phone,
    });
  });

  function remap(partyId) {
    return mapped[partyId] || partyId;
  }

  const jobs = (snapshot.jobs || []).map((job) => {
    const next = {
      ...job,
      directories: {},
      expenses: (job.expenses || []).map((row) => ({ ...row })),
      invoices: (job.invoices || []).map((row) => ({ ...row })),
      quotes: (job.quotes || []).map((row) => ({ ...row })),
    };
    DIRECTORY_SPECS.forEach((spec) => {
      next.directories[spec.collection] = ((job.directories || {})[spec.collection] || []).map((row) => ({ ...row }));
    });
    return next;
  });
  const jobsById = new Map(jobs.map((job) => [job.id, job]));

  plan.stamps.forEach((stamp) => {
    const job = jobsById.get(stamp.jobId);
    if (!job) return;
    const partyId = remap(stamp.partyId);
    if (DIRECTORY_SPECS.some((spec) => spec.collection === stamp.collection)) {
      const rows = job.directories[stamp.collection] || [];
      const row = rows.find((item) => item.id === stamp.rowId);
      if (row) row.partyId = partyId;
      return;
    }
    const list = job[stamp.collection];
    if (!Array.isArray(list)) return;
    const row = list.find((item) => item.id === stamp.rowId);
    if (row) row.partyId = partyId;
  });

  return { orgId: snapshot.orgId, parties, jobs };
}

function formatOwnerReport(plan) {
  const lines = [];
  lines.push('# Party backfill — owner list (staging)');
  lines.push('');
  lines.push('Auto-link is **exact `canonicalPartyName` equality only**, plus kind. Fuzzy `namesMatch` is listed here and is never written as a `partyId`.');
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- Parties to create: ${plan.counts.partiesCreated}`);
  lines.push(`- Rows to stamp: ${plan.counts.rowsStamped}`);
  lines.push(`- Rows already stamped (skipped): ${plan.counts.rowsSkippedAlreadyStamped}`);
  lines.push(`- Unlinked ledger rows: ${plan.counts.unlinkedLedger}`);
  lines.push(`- Writes planned: ${plan.writeCount}`);
  lines.push('');
  lines.push('## Candidate merge groups');
  lines.push('');
  lines.push('These look similar (`namesMatch`, or the Mark apostrophe case where dropping single-character tokens makes the canonicals equal) but their canonical names differ. **Do not merge them automatically.**');
  lines.push('');
  if (!plan.candidateMergeGroups.length) {
    lines.push('_None._');
    lines.push('');
  } else {
    plan.candidateMergeGroups.forEach((group, index) => {
      lines.push(`### Group ${index + 1} — ${group.kind} (${group.reason})`);
      lines.push('');
      lines.push(`Canonical forms: ${group.canonicals.map((name) => `\`${name}\``).join(', ')}`);
      lines.push('');
      lines.push('| Display name | Canonical | Job | Collection |');
      lines.push('| --- | --- | --- | --- |');
      group.members.forEach((member) => {
        lines.push(`| ${member.displayName} | \`${member.canonicalName}\` | ${member.jobName || '—'} | ${member.collection} |`);
      });
      lines.push('');
    });
  }
  lines.push('## Unlinked ledger rows');
  lines.push('');
  lines.push('Expenses, invoices and quotes whose typed name did not exact-match one party of the right kind. Grouped by name.');
  lines.push('');
  if (!plan.unlinkedGrouped.length) {
    lines.push('_None._');
    lines.push('');
  } else {
    lines.push('| Name | Kind | Collection | Count | Jobs | Why |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    plan.unlinkedGrouped.forEach((row) => {
      lines.push(`| ${row.name} | ${row.kind || '—'} | ${row.collection} | ${row.count} | ${row.jobs.join(', ')} | ${row.reason} |`);
    });
    lines.push('');
  }
  lines.push('## Created / linked');
  lines.push('');
  if (plan.partiesToCreate.length) {
    lines.push('Parties to create:');
    lines.push('');
    plan.partiesToCreate.forEach((row) => {
      lines.push(`- ${row.displayName} — \`${row.canonicalName}\` (${row.kind})`);
    });
    lines.push('');
  } else {
    lines.push('No new parties.');
    lines.push('');
  }
  lines.push(`Stamps: ${plan.counts.rowsStamped}. Already correct: ${plan.counts.rowsSkippedAlreadyStamped}.`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

module.exports = {
  OPAL_ORG_ID,
  DIRECTORY_SPECS,
  canonicalPartyName,
  namesMatch,
  isLiveDirectoryRow,
  clip,
  partyKey,
  directoryDisplayName,
  partyHintFromExpense,
  partyHintFromInvoice,
  dropSingleCharTokens,
  apostropheNearMiss,
  followMergedParty,
  resolvePartyFromList,
  resolveBackfillTarget,
  planPartyBackfill,
  applyPlanToSnapshot,
  formatOwnerReport,
};
