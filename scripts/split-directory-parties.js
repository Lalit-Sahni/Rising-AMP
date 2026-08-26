#!/usr/bin/env node
/**
 * Split invoice clients from material suppliers, persist service providers,
 * and collapse duplicate labour / trade / supplier names.
 *
 * Soft only: extra client stubs are marked status=moved (not deleted).
 *
 * Usage:
 *   node scripts/split-directory-parties.js --dry-run --staging
 *   node scripts/split-directory-parties.js --apply --staging
 */

const {
  PRODUCTION_PROJECT,
  STAGING_PROJECT,
  getAccessToken,
  listCollectionIds,
  listDocuments,
  relativeDocPath,
  docResourceName,
  batchWrite,
} = require('./lib/phase1Firebase');
const { canonicalPartyName, namesMatch, isLiveDirectoryRow } = require('./lib/partyName');

const ORG_ID = 'opal-ss-constructions';

function parseArgs(argv) {
  const production = argv.includes('--production');
  const staging = argv.includes('--staging');
  const apply = argv.includes('--apply');
  if (production && staging) {
    throw new Error('Pick --staging or --production, not both.');
  }
  return {
    apply,
    production,
    destination: production ? PRODUCTION_PROJECT : STAGING_PROJECT,
  };
}

function decodeValue(value) {
  if (value == null || typeof value !== 'object') return value;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.nullValue !== undefined) return null;
  if (value.arrayValue) return (value.arrayValue.values || []).map(decodeValue);
  if (value.mapValue) {
    const out = {};
    Object.entries((value.mapValue && value.mapValue.fields) || {}).forEach(([key, nested]) => {
      out[key] = decodeValue(nested);
    });
    return out;
  }
  return value;
}

function decodeDoc(doc) {
  const row = { id: relativeDocPath(doc.name).split('/').pop(), path: relativeDocPath(doc.name) };
  Object.entries(doc.fields || {}).forEach(([key, value]) => {
    row[key] = decodeValue(value);
  });
  return row;
}

function slugId(prefix, nameKey) {
  const slug = String(nameKey || '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${prefix}-${slug || 'unnamed'}`;
}

function stringField(value) {
  return { stringValue: String(value) };
}

function timestampNow() {
  return { timestampValue: new Date().toISOString() };
}

function pickRicher(a, b, getName) {
  const score = (row) => {
    const name = String(getName(row) || '').trim();
    const email = String((row && row.email) || '');
    return name.length + (email.includes('@') ? 20 : 0) + (Number(row && row.rate) > 0 ? 5 : 0);
  };
  return score(b) > score(a) ? b : a;
}

function groupByName(rows, getName) {
  const groups = [];
  for (const row of rows) {
    const existing = groups.find((group) => namesMatch(getName(group[0]), getName(row)));
    if (existing) existing.push(row);
    else groups.push([row]);
  }
  return groups;
}

function hasRealEmail(row) {
  return String((row && row.email) || '').includes('@');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.apply && args.production && !process.argv.includes('--production')) {
    throw new Error('Refusing production apply without --production.');
  }
  if (args.apply && !args.production && !process.argv.includes('--staging')) {
    throw new Error('Refusing to write without --apply --staging (or --apply --production).');
  }
  if (STAGING_PROJECT === PRODUCTION_PROJECT) {
    throw new Error('Staging and production IDs match. Stop.');
  }

  const destination = args.destination;
  console.log(args.apply ? `SPLIT directories (writing ${destination})` : `SPLIT directories (dry run, ${destination})`);
  if (destination === PRODUCTION_PROJECT) {
    console.log('Destination is PRODUCTION. Staging first, then an explicit yes.');
  }

  const accessToken = await getAccessToken();
  const orgParent = `projects/${destination}/databases/(default)/documents/organizations/${ORG_ID}`;
  const jobs = await listDocuments(accessToken, orgParent, 'projects');
  const writes = [];
  const summary = [];

  for (const job of jobs) {
    const jobId = relativeDocPath(job.name).split('/')[3];
    const cols = await listCollectionIds(accessToken, job.name);
    const load = async (name) => (cols.includes(name) ? (await listDocuments(accessToken, job.name, name)).map(decodeDoc) : []);

    const clients = await load('clients');
    const expenses = await load('expenses');
    const invoices = await load('invoices');
    const labour = await load('labour');
    const trades = await load('trades');
    const suppliers = await load('suppliers');
    const providers = await load('serviceProviders');
    const savedCompanies = await load('savedCompanies');

    const invoiceNames = invoices.map((row) => row.clientName).filter(Boolean);
    const purchaseNames = expenses.filter((row) => row.category === 'purchase').map((row) => row.supplier).filter(Boolean);
    const serviceNames = expenses.filter((row) => row.category === 'service').map((row) => row.provider).filter(Boolean);
    const workerNames = expenses.filter((row) => row.category === 'labour').map((row) => ({
      name: row.workerName,
      role: row.role,
      rate: row.rate,
    })).filter((row) => row.name);

    const liveClients = clients.filter(isLiveDirectoryRow);
    const keepClient = (row) =>
      hasRealEmail(row) || invoiceNames.some((name) => namesMatch(name, row.name));

    const clientKeeps = [];
    const clientMoves = [];
    const clientJunk = [];
    for (const row of liveClients) {
      if (keepClient(row)) clientKeeps.push(row);
      else if (canonicalPartyName(row.name) === 'client') clientJunk.push(row);
      else clientMoves.push(row);
    }

    const supplierSeeds = [
      ...suppliers.filter(isLiveDirectoryRow),
      ...clientMoves,
      ...savedCompanies,
      ...purchaseNames.map((name) => ({ name })),
    ].filter((row) => canonicalPartyName(row.name) && canonicalPartyName(row.name) !== 'client');

    const supplierGroups = groupByName(supplierSeeds, (row) => row.name);
    const providerGroups = groupByName(
      [
        ...providers.filter(isLiveDirectoryRow),
        ...serviceNames.map((name) => ({ name })),
      ].filter((row) => canonicalPartyName(row.name)),
      (row) => row.name
    );
    const labourGroups = groupByName(
      [
        ...labour.filter(isLiveDirectoryRow),
        ...workerNames,
      ].filter((row) => canonicalPartyName(row.name)),
      (row) => row.name
    );
    const tradeGroups = groupByName(
      trades.filter((row) => isLiveDirectoryRow(row) && canonicalPartyName(row.tradeName)),
      (row) => row.tradeName
    );

    const jobWrites = [];
    const iso = timestampNow();

    for (const row of clientKeeps) {
      if (row.directoryKind === 'client' && row.nameKey) continue;
      jobWrites.push({
        kind: 'keep-client',
        path: row.path,
        updateMask: ['directoryKind', 'nameKey', 'status', 'updatedAt'],
        fields: {
          directoryKind: stringField('client'),
          nameKey: stringField(canonicalPartyName(row.name)),
          status: stringField('active'),
          updatedAt: iso,
        },
      });
    }

    for (const row of [...clientMoves, ...clientJunk]) {
      if (row.status === 'moved' || row.status === 'archived') continue;
      jobWrites.push({
        kind: row === clientJunk.find((junk) => junk.id === row.id) ? 'archive-junk' : 'move-client',
        path: row.path,
        updateMask: ['status', 'movedTo', 'directoryKind', 'nameKey', 'updatedAt'],
        fields: {
          status: stringField(clientJunk.includes(row) ? 'archived' : 'moved'),
          movedTo: stringField(clientJunk.includes(row) ? '' : 'suppliers'),
          directoryKind: stringField(clientJunk.includes(row) ? 'junk' : 'supplier'),
          nameKey: stringField(canonicalPartyName(row.name)),
          updatedAt: iso,
        },
      });
    }

    for (const group of supplierGroups) {
      const best = group.reduce((acc, row) => pickRicher(acc, row, (item) => item.name));
      const nameKey = canonicalPartyName(best.name);
      const already = suppliers.filter(isLiveDirectoryRow).find((row) => namesMatch(row.name, best.name));
      if (already && already.nameKey) continue;
      const docId = already ? already.id : slugId('sup', nameKey);
      jobWrites.push({
        kind: 'upsert-supplier',
        path: `organizations/${ORG_ID}/projects/${jobId}/suppliers/${docId}`,
        fields: {
          name: stringField(String(best.name).trim()),
          nameKey: stringField(nameKey),
          directoryKind: stringField('supplier'),
          status: stringField('active'),
          jobId: stringField(jobId),
          createdAt: iso,
          updatedAt: iso,
        },
      });
    }

    for (const group of providerGroups) {
      const best = group.reduce((acc, row) => pickRicher(acc, row, (item) => item.name));
      const nameKey = canonicalPartyName(best.name);
      const already = providers.filter(isLiveDirectoryRow).find((row) => namesMatch(row.name, best.name));
      if (already && already.nameKey) continue;
      const docId = already ? already.id : slugId('svc', nameKey);
      jobWrites.push({
        kind: 'upsert-provider',
        path: `organizations/${ORG_ID}/projects/${jobId}/serviceProviders/${docId}`,
        fields: {
          name: stringField(String(best.name).trim()),
          nameKey: stringField(nameKey),
          directoryKind: stringField('serviceProvider'),
          status: stringField('active'),
          jobId: stringField(jobId),
          createdAt: iso,
          updatedAt: iso,
        },
      });
    }

    for (const group of labourGroups) {
      const best = group.reduce((acc, row) => pickRicher(acc, row, (item) => item.name));
      const nameKey = canonicalPartyName(best.name);
      const already = labour.filter(isLiveDirectoryRow).find((row) => namesMatch(row.name, best.name));
      if (!already) {
        jobWrites.push({
          kind: 'upsert-labour',
          path: `organizations/${ORG_ID}/projects/${jobId}/labour/${slugId('lab', nameKey)}`,
          fields: {
            name: stringField(String(best.name).trim()),
            role: stringField(best.role || ''),
            rate: { doubleValue: Number(best.rate) || 0 },
            nameKey: stringField(nameKey),
            status: stringField('active'),
            jobId: stringField(jobId),
            createdAt: iso,
            updatedAt: iso,
          },
        });
      } else if (!already.nameKey) {
        jobWrites.push({
          kind: 'tag-labour',
          path: already.path,
          updateMask: ['nameKey', 'status', 'updatedAt'],
          fields: {
            nameKey: stringField(nameKey),
            status: stringField('active'),
            updatedAt: iso,
          },
        });
      }
      for (const extra of group) {
        if (!extra.path || extra.id === (already && already.id) || extra.id === best.id) continue;
        if (!labour.some((row) => row.id === extra.id)) continue;
        if (extra.status === 'duplicate') continue;
        jobWrites.push({
          kind: 'dup-labour',
          path: extra.path,
          updateMask: ['status', 'replacedBy', 'nameKey', 'updatedAt'],
          fields: {
            status: stringField('duplicate'),
            replacedBy: stringField((already && already.id) || slugId('lab', nameKey)),
            nameKey: stringField(nameKey),
            updatedAt: iso,
          },
        });
      }
    }

    for (const group of tradeGroups) {
      const best = group.reduce((acc, row) => pickRicher(acc, row, (item) => item.tradeName));
      const extras = group.filter((row) => row.id !== best.id);
      if (!best.nameKey) {
        jobWrites.push({
          kind: 'tag-trade',
          path: best.path,
          updateMask: ['nameKey', 'status', 'updatedAt'],
          fields: {
            nameKey: stringField(canonicalPartyName(best.tradeName)),
            status: stringField('active'),
            updatedAt: iso,
          },
        });
      }
      for (const extra of extras) {
        if (extra.status === 'duplicate') continue;
        jobWrites.push({
          kind: 'dup-trade',
          path: extra.path,
          updateMask: ['status', 'replacedBy', 'nameKey', 'updatedAt'],
          fields: {
            status: stringField('duplicate'),
            replacedBy: stringField(best.id),
            nameKey: stringField(canonicalPartyName(best.tradeName)),
            updatedAt: iso,
          },
        });
      }
    }

    summary.push({
      jobId,
      keepClients: clientKeeps.map((row) => row.name),
      moveClients: clientMoves.map((row) => row.name),
      junkClients: clientJunk.map((row) => row.name),
      suppliers: supplierGroups.length,
      serviceProviders: providerGroups.length,
      labourGroups: labourGroups.length,
      writes: jobWrites.length,
    });
    writes.push(...jobWrites);
  }

  summary.forEach((row) => {
    console.log(`\n${row.jobId}`);
    console.log(`  keep clients: ${row.keepClients.join(' | ') || '(none)'}`);
    console.log(`  move to suppliers: ${[...new Set(row.moveClients)].join(' | ') || '(none)'}`);
    console.log(`  archive junk: ${row.junkClients.join(' | ') || '(none)'}`);
    console.log(`  unique suppliers: ${row.suppliers}, service providers: ${row.serviceProviders}, labour: ${row.labourGroups}`);
    console.log(`  writes: ${row.writes}`);
  });
  console.log(`\nTotal writes: ${writes.length}`);

  if (!args.apply) {
    console.log('Dry run. No writes.');
    return;
  }

  let wrote = 0;
  for (let i = 0; i < writes.length; i += 400) {
    const group = writes.slice(i, i + 400);
    const batch = group.map((row) => {
      const write = {
        update: {
          name: docResourceName(destination, '(default)', row.path),
          fields: row.fields,
        },
      };
      if (row.updateMask) {
        write.updateMask = { fieldPaths: row.updateMask };
        write.currentDocument = { exists: true };
      }
      return write;
    });
    await batchWrite(accessToken, destination, '(default)', batch);
    wrote += group.length;
    console.log(`  wrote ${wrote}/${writes.length}`);
  }

  console.log('Split finished.', { wrote, destination });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
