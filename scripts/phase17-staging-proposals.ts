/**
 * Phase 17 Part E — READ-ONLY proof over the real staging data.
 *
 * Runs the real `proposeTrades` (bundled from src/) over every live uncoded
 * expense on staging, once as the code behaved before Part C (text fields
 * only, no name fields, no single-prior-coding path) and once as it behaves
 * now. Reports the before/after proposal counts and lists every row where
 * who-he-paid produced a proposal the description did not.
 *
 * Also reports whether the org document carries `assistantWritesEnabled`
 * (missing now means ON after Part A) and asserts no coded expense appears
 * in any proposal set — nothing already coded may be written by this path.
 *
 * No writes. No --apply mode. Refuses --production outright.
 *
 *   node_modules/.bin/esbuild scripts/phase17-staging-proposals.ts --bundle \
 *     --platform=node --format=cjs --target=node22 --outfile=/tmp/phase17-audit.cjs
 *   node /tmp/phase17-audit.cjs --staging
 */
import {
  activeTrades,
  listUncodedExpenses,
  mergeTradeList,
} from '../src/domain/costPlan';
import { expenseTradeId } from '../src/domain/costPlan';
import { getExpenseTotalCents } from '../src/utils/jobMetrics';
import { proposeTrades, type TradeProposal } from '../src/actions/proposeTrades';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fb = require('./lib/phase1Firebase');

const STAGING_PROJECT = 'rising-amp-staging';
const ORG = 'opal-ss-constructions';
const NAME_FIELD_REASON = /^(Supplier|Worker|Service|Equipment|Party) name (matches|also matches)/;
const SINGLE_CODING_REASON = /^Coded to .+ once for this supplier\.$/;

function decodeValue(value: any): any {
  if (!value || typeof value !== 'object') return null;
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return new Date(value.timestampValue);
  if (value.mapValue) {
    const out: Record<string, unknown> = {};
    Object.entries(value.mapValue.fields || {}).forEach(([key, nested]) => {
      out[key] = decodeValue(nested);
    });
    return out;
  }
  if (value.arrayValue && Array.isArray(value.arrayValue.values)) {
    return value.arrayValue.values.map(decodeValue);
  }
  return null;
}

function decodeDoc(doc: any): Record<string, unknown> {
  const out: Record<string, unknown> = { id: String(doc.name || '').split('/').pop() };
  Object.entries(doc.fields || {}).forEach(([key, value]) => {
    out[key] = decodeValue(value);
  });
  return out;
}

function dollars(cents: number | null): string {
  if (cents === null) return '—';
  return `$${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function listDecoded(
  accessToken: string,
  parentName: string,
  collectionId: string,
): Promise<Array<Record<string, unknown>>> {
  const docs = await fb.listDocuments(accessToken, parentName, collectionId);
  return (docs || []).map(decodeDoc);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--production')) {
    throw new Error('Refusing --production. This audit is staging-only, read-only.');
  }
  if (!argv.includes('--staging')) {
    throw new Error('Pass --staging. There is no other mode.');
  }

  const accessToken = await fb.getAccessToken();
  // listDocuments/googleFetch prepend the v1 prefix themselves, so parents
  // are bare resource names, not URLs.
  const parent = (path: string) => fb.docResourceName(STAGING_PROJECT, '(default)', path);
  const orgParent = parent(`organizations/${ORG}`);
  const projectsParent = parent(`organizations/${ORG}/projects`);

  // 0. The switch field on the org document.
  const orgRes = await fb.googleFetch(
    `https://firestore.googleapis.com/v1/${fb.docResourceName(STAGING_PROJECT, '(default)', `organizations/${ORG}`)}`,
    { accessToken },
  );
  if (!orgRes.ok) throw new Error(`org doc read failed: ${orgRes.status}`);
  const orgDoc = decodeDoc(orgRes.json);
  const switchValue = (orgDoc as any).assistantWritesEnabled;
  console.log(`Org ${ORG}`);
  console.log(
    `  assistantWritesEnabled: ${
      switchValue === undefined ? '(missing — Part A reads this as ON)' : JSON.stringify(switchValue)
    }`,
  );

  // 1. Party directory → names by id (merged parties resolve to the survivor).
  const parties = await listDecoded(accessToken, orgParent, 'parties');
  const byId = new Map(parties.map((p) => [String(p.id), p]));
  const partyNamesById = new Map<string, string>();
  parties.forEach((party) => {
    let survivor = party;
    const seen = new Set<string>();
    while (survivor && survivor.status !== 'active' && survivor.mergedInto && !seen.has(String(survivor.id))) {
      seen.add(String(survivor.id));
      survivor = byId.get(String(survivor.mergedInto)) || survivor;
    }
    const name = String((survivor && survivor.displayName) || '').trim();
    if (name) partyNamesById.set(String(party.id), name);
  });
  console.log(`  parties: ${parties.length} (${partyNamesById.size} with a resolvable name)`);

  // 2. Org trade list → merged active trades.
  const tradeRows = await listDecoded(accessToken, orgParent, 'tradeList');
  const trades = activeTrades(mergeTradeList(tradeRows as any)).map((t) => ({ id: t.id, name: t.name }));
  console.log(`  trade sections after merge: ${trades.length} (app defaults backfill any the org is missing)`);
  const has17 = ['waste-removal', 'cleaning', 'fixtures-fittings'].every((id) =>
    trades.some((t) => t.id === id),
  );
  console.log(`  Part D sections present after mergeTradeList: ${has17 ? 'yes' : 'NO'}`);

  // 3. Every project, its expenses, its plan sections.
  const projects = await listDecoded(accessToken, orgParent, 'projects');
  const liveProjects = projects.filter((p) => !p.archivedAt);

  // Pass one: gather everything. orgCoded is org-wide, like the sheet's load.
  const jobs: Array<{
    jobId: string;
    jobName: string;
    live: Array<Record<string, unknown>>;
    coded: Array<Record<string, unknown>>;
    uncoded: Array<Record<string, unknown>>;
    sections: Array<{ id: string; name: string }>;
  }> = [];
  const orgCoded: Array<Record<string, unknown>> = [];

  for (const project of liveProjects) {
    const jobId = String(project.id);
    const jobName = String(project.name || jobId);
    const expenses = await listDecoded(accessToken, `${projectsParent}/${jobId}`, 'expenses');
    const live = expenses.filter((e) => !e.voided && !e.void && e.status !== 'void');
    const coded = live.filter((e) => expenseTradeId(e));
    const uncoded = listUncodedExpenses(live) as Array<Record<string, unknown>>;
    orgCoded.push(...coded);

    let sections: Array<{ id: string; name: string }> = [];
    let planNote = 'no plan document';
    const planRes = await fb.googleFetch(
      `https://firestore.googleapis.com/v1/${fb.docResourceName(STAGING_PROJECT, '(default)', `organizations/${ORG}/projects/${jobId}/costPlan/current`)}`,
      { accessToken },
    );
    if (planRes.ok) {
      const plan = decodeDoc(planRes.json);
      sections = (((plan as any).sections || []) as any[]).map((s) => ({ id: s.tradeId, name: s.name }));
      planNote = `plan level ${(plan as any).level || '?'}, ${sections.length} sections, target ${dollars((plan as any).targetCents ?? null)}`;
    }
    console.log(`\n${jobName} (${jobId}) — ${planNote}`);
    console.log(`  live ${live.length} · coded ${coded.length} · uncoded ${uncoded.length}`);
    const sample = uncoded.slice(0, 3).map((e) => {
      const fields = ['description', 'supplier', 'partyId', 'itemName', 'tradeName', 'notes', 'workerName']
        .filter((f) => e[f])
        .map((f) => `${f}=${JSON.stringify(String(e[f]).slice(0, 40))}`)
        .join(' ');
      return `    sample ${e.id}: ${fields || '(no text fields at all)'}`;
    });
    sample.forEach((line) => console.log(line));
    jobs.push({ jobId, jobName, live, coded, uncoded, sections });
  }
  console.log(`\nOrg-wide coded history feeding proposals: ${orgCoded.length} rows`);

  let totalLive = 0;
  let totalCoded = 0;
  let totalUncoded = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  const nameOnlyWins: Array<{
    job: string;
    expenseId: string;
    who: string;
    amount: string;
    reason: string;
    trade: string;
  }> = [];
  const multiHitLosses: Array<{
    job: string;
    expenseId: string;
    who: string;
    amount: string;
    beforeReason: string;
    afterHits: string;
  }> = [];
  let codedTargeted = 0;

  for (const job of jobs) {
    const { jobId, jobName, live, coded, uncoded, sections } = job;

    const baseInput = {
      uncoded,
      orgCoded,
      trades,
      sections,
    };

    const after = proposeTrades({ ...baseInput, partyNamesById });

    // BEFORE: the code as it behaved before Part C — no name fields in the
    // haystack, no resolved party names, and no single-prior-coding path.
    const stripped = uncoded.map((e) => {
      const copy: Record<string, unknown> = { ...e };
      delete copy.supplier;
      delete copy.workerName;
      delete copy.serviceName;
      delete copy.equipmentName;
      delete copy.partyName;
      return copy;
    });
    const before = proposeTrades({ ...baseInput, uncoded: stripped }).filter(
      (row) => !(row.status !== 'none' && SINGLE_CODING_REASON.test(row.reason)),
    );

    const beforeById = new Map(before.map((row) => [row.expenseId, row]));
    const codedIds = new Set(coded.map((e) => String(e.id)));
    after.forEach((row) => {
      if (row.status === 'none') return;
      if (codedIds.has(row.expenseId)) codedTargeted += 1;
      const beforeRow = beforeById.get(row.expenseId);
      const beforeHadProposal = beforeRow && beforeRow.status !== 'none';
      if (NAME_FIELD_REASON.test(row.reason) && !beforeHadProposal) {
        const expense = uncoded.find((e) => String(e.id) === row.expenseId) as any;
        const fieldKey = row.reason.startsWith('Supplier') ? 'supplier'
          : row.reason.startsWith('Worker') ? 'workerName'
          : row.reason.startsWith('Service') ? 'serviceName'
          : row.reason.startsWith('Equipment') ? 'equipmentName'
          : 'partyName';
        const won = fieldKey === 'partyName'
          ? (String(expense?.partyName || '').trim() || partyNamesById.get(String(expense?.partyId || '')) || '')
          : String(expense?.[fieldKey] || '').trim();
        nameOnlyWins.push({
          job: jobName,
          expenseId: row.expenseId,
          who: won || '(unnamed)',
          amount: dollars(getExpenseTotalCents(expense)),
          reason: row.reason,
          trade: String(row.proposedTradeName || row.proposedTradeId || ''),
        });
      }
    });
    after.forEach((row) => {
      const beforeRow = beforeById.get(row.expenseId);
      const lostProposal = Boolean(beforeRow && beforeRow.status !== 'none' && row.status === 'none');
      const multiHit = (row.alternatives || []).length >= 2;
      if (!lostProposal || !multiHit) return;
      const expense = uncoded.find((e) => String(e.id) === row.expenseId) as any;
      multiHitLosses.push({
        job: jobName,
        expenseId: row.expenseId,
        who: String(expense?.supplier || expense?.description || expense?.id || '(unnamed)'),
        amount: dollars(getExpenseTotalCents(expense)),
        beforeReason: String(beforeRow?.reason || ''),
        afterHits: (row.alternatives || []).map((alt) => alt.reason).join(' | '),
      });
    });

    const beforeCount = before.filter((r) => r.status !== 'none').length;
    const afterRows = after.filter((r) => r.status !== 'none');
    totalLive += live.length;
    totalCoded += coded.length;
    totalUncoded += uncoded.length;
    totalBefore += beforeCount;
    totalAfter += afterRows.length;

    console.log(
      `  proposals before Part C: ${beforeCount} · after: ${afterRows.length} ` +
        `(${afterRows.filter((r) => r.status === 'confident').length} confident, ` +
        `${afterRows.filter((r) => r.status === 'uncertain').length} uncertain)`,
    );
  }

  console.log('\n- Org-wide -');
  console.log(`  live ${totalLive} · coded ${totalCoded} · uncoded ${totalUncoded}`);
  console.log(`  proposals before ${totalBefore} → after ${totalAfter} (${totalAfter - totalBefore >= 0 ? '+' : ''}${totalAfter - totalBefore})`);
  console.log(`  proposals pointing at an already-coded expense: ${codedTargeted} (must be 0)`);
  console.log(`  lost a proposal by going multi-hit: ${multiHitLosses.length}`);

  console.log('\n- Proposed from who he paid, where the description said nothing -');
  if (nameOnlyWins.length === 0) {
    console.log('  (none)');
  }
  nameOnlyWins.forEach((row) => {
    console.log(`  ${row.job} · ${row.who} · ${row.amount} · ${row.expenseId}`);
    console.log(`    ${row.reason}`);
  });

  console.log('\n- Lost a proposal because two sections now match -');
  if (multiHitLosses.length === 0) {
    console.log('  (none)');
  }
  multiHitLosses.forEach((row) => {
    console.log(`  ${row.job} · ${row.who} · ${row.amount} · ${row.expenseId}`);
    console.log(`    before: ${row.beforeReason}`);
    console.log(`    after: ${row.afterHits}`);
  });

  if (codedTargeted > 0) {
    throw new Error('FAIL: a proposal targeted an already-coded expense.');
  }
  console.log('\nOK — read-only audit complete. No writes were made.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
