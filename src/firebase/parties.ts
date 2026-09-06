import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  parseAtBoundary,
  partySchema,
  type Party,
  type PartyKind,
} from '../domain/schemas';
import { db } from './config';
import { canonicalPartyName } from './partyName';
import { getActiveOrgId, isPermissionDenied } from './tenancy';

export type PartyRecord = {
  id: string;
  displayName: string;
  canonicalName: string;
  kind: PartyKind;
  status: 'active' | 'merged';
  mergedInto?: string | null;
  abn?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type PartyWriteHint = {
  name: string;
  kind?: PartyKind | null;
  abn?: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ResolvePartyResult =
  | { action: 'use'; partyId: string }
  | { action: 'create' }
  | { action: 'unset' };

const DIRECTORY_KIND: Record<string, PartyKind> = {
  clients: 'client',
  suppliers: 'supplier',
  labour: 'worker',
  trades: 'trade',
  serviceProviders: 'service provider',
};

function clip(value: unknown, max: number): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function optionalClip(value: unknown, max: number): string | undefined {
  const next = clip(value, max);
  return next || undefined;
}

function definedFields(data: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) out[key] = value;
  });
  return out;
}

function partiesCol() {
  return collection(db, 'organizations', getActiveOrgId(), 'parties');
}

function partyRef(partyId: string) {
  return doc(db, 'organizations', getActiveOrgId(), 'parties', partyId);
}

export function partyKindFromDirectory(collectionName: string): PartyKind | null {
  return DIRECTORY_KIND[collectionName] || null;
}

export function partyHintFromExpense(expense: Record<string, unknown> | null | undefined): PartyWriteHint | null {
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

export function partyHintFromInvoice(invoice: Record<string, unknown> | null | undefined): PartyWriteHint | null {
  const name = clip(invoice?.clientName, 120);
  return name ? { name, kind: 'client' } : null;
}

export function followMergedParty(
  parties: ReadonlyArray<PartyRecord>,
  startId: string,
): PartyRecord | null {
  const byId = new Map(parties.map((row) => [row.id, row]));
  const seen = new Set<string>();
  let current = byId.get(startId) ?? null;
  while (current && current.status === 'merged') {
    const nextId = clip(current.mergedInto, 80);
    if (!nextId || seen.has(current.id)) return null;
    seen.add(current.id);
    current = byId.get(nextId) ?? null;
  }
  if (!current || current.status !== 'active') return null;
  return current;
}

function survivorsOf(
  parties: ReadonlyArray<PartyRecord>,
  matches: ReadonlyArray<PartyRecord>,
  kind?: PartyKind | null,
): PartyRecord[] {
  const out = new Map<string, PartyRecord>();
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
export function resolvePartyFromList(
  parties: ReadonlyArray<PartyRecord>,
  input: { canonicalName: string; kind?: PartyKind | null },
): ResolvePartyResult {
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

function asPartyRecord(id: string, data: Record<string, unknown>): PartyRecord | null {
  const parsed = parseAtBoundary(partySchema, { id, ...data });
  if (!parsed.ok) return null;
  const row = parsed.data;
  if (!row.id) return null;
  return {
    id: row.id,
    displayName: row.displayName,
    canonicalName: row.canonicalName,
    kind: row.kind,
    status: row.status,
    mergedInto: row.mergedInto ?? null,
    abn: row.abn ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
  };
}

async function listParties(): Promise<PartyRecord[]> {
  const snap = await getDocs(partiesCol());
  return snap.docs
    .map((row) => asPartyRecord(row.id, row.data() as Record<string, unknown>))
    .filter((row): row is PartyRecord => Boolean(row));
}

async function createParty(hint: PartyWriteHint, canonicalName: string, kind: PartyKind): Promise<string> {
  const created = await addDoc(partiesCol(), definedFields({
    displayName: clip(hint.name, 120),
    canonicalName,
    kind,
    status: 'active',
    abn: optionalClip(hint.abn, 20) || null,
    email: optionalClip(hint.email, 120) || null,
    phone: optionalClip(hint.phone, 40) || null,
    mergedInto: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  return created.id;
}

export async function resolvePartyIdForWrite(hint: PartyWriteHint | null | undefined): Promise<string | undefined> {
  if (!hint) return undefined;
  const name = clip(hint.name, 120);
  const canonicalName = canonicalPartyName(name);
  if (!canonicalName) return undefined;
  const kind = hint.kind || null;
  try {
    const parties = await listParties();
    const result = resolvePartyFromList(parties, { canonicalName, kind });
    if (result.action === 'use') return result.partyId;
    if (result.action === 'create' && kind) {
      return await createParty(hint, canonicalName, kind);
    }
    return undefined;
  } catch (error) {
    if (isPermissionDenied(error)) return undefined;
    throw error;
  }
}

export async function mergeParty(fromId: string, intoId: string): Promise<void> {
  const from = clip(fromId, 80);
  let into = clip(intoId, 80);
  if (!from || !into) throw new Error('Choose two parties.');
  if (from === into) throw new Error('A party cannot merge into itself.');
  const [fromSnap, intoSnap] = await Promise.all([
    getDoc(partyRef(from)),
    getDoc(partyRef(into)),
  ]);
  if (!fromSnap.exists() || !intoSnap.exists()) {
    throw new Error('That party is not on the list.');
  }
  const intoData = intoSnap.data() as Record<string, unknown>;
  if (intoData.status === 'merged') {
    const survivor = clip(intoData.mergedInto, 80);
    if (!survivor || survivor === from) {
      throw new Error('A party cannot merge into itself.');
    }
    const survivorSnap = await getDoc(partyRef(survivor));
    if (!survivorSnap.exists()) throw new Error('That party is not on the list.');
    into = survivor;
  }
  await updateDoc(partyRef(from), {
    status: 'merged',
    mergedInto: into,
    updatedAt: serverTimestamp(),
  });
}

export async function unmergeParty(partyId: string): Promise<void> {
  const id = clip(partyId, 80);
  if (!id) throw new Error('Choose a party.');
  await updateDoc(partyRef(id), {
    status: 'active',
    mergedInto: null,
    updatedAt: serverTimestamp(),
  });
}

export type { Party, PartyKind };
