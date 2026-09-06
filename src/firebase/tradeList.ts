import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { APP_TRADES } from '../domain/costPlan';
import { parseAtBoundary, tradeListItemSchema, type TradeListItem } from '../domain/schemas';
import { db } from './config';
import { getActiveOrgId, isPermissionDenied } from './tenancy';

function tradeListCol() {
  return collection(db, 'organizations', getActiveOrgId(), 'tradeList');
}

function tradeRef(tradeId: string) {
  return doc(db, 'organizations', getActiveOrgId(), 'tradeList', tradeId);
}

export async function fetchTradeList(): Promise<TradeListItem[]> {
  const snap = await getDocs(tradeListCol());
  return snap.docs.map((row) => {
    const parsed = parseAtBoundary(tradeListItemSchema, { id: row.id, ...row.data() });
    if (parsed.ok) return parsed.data;
    return {
      id: row.id,
      name: String(row.data().name || row.id),
      order: Number(row.data().order) || 0,
      isAppDefault: Boolean(row.data().isAppDefault),
      status: row.data().status === 'archived' ? 'archived' : 'active',
    } satisfies TradeListItem;
  });
}

export async function ensureOrgTradeList(): Promise<TradeListItem[]> {
  const existing = await fetchTradeList();
  const have = new Set(existing.map((trade) => trade.id));
  const missing = APP_TRADES.filter((trade) => !have.has(trade.id));
  if (missing.length === 0) return existing;
  try {
    await Promise.all(missing.map((trade, index) => setDoc(tradeRef(trade.id), {
      name: trade.name,
      order: existing.length + index,
      isAppDefault: true,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })));
    return fetchTradeList();
  } catch (error) {
    if (isPermissionDenied(error)) return existing;
    throw error;
  }
}

export async function addOrgTrade(name: string): Promise<TradeListItem> {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Enter a trade name.');
  const existing = await ensureOrgTradeList();
  const duplicate = existing.find((trade) => (
    trade.status !== 'archived' && trade.name.toLowerCase() === trimmed.toLowerCase()
  ));
  if (duplicate) return duplicate;
  const ref = doc(tradeListCol());
  const order = existing.reduce((max, trade) => Math.max(max, trade.order), -1) + 1;
  await setDoc(ref, {
    name: trimmed,
    order,
    isAppDefault: false,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return {
    id: ref.id,
    name: trimmed,
    order,
    isAppDefault: false,
    status: 'active',
  };
}

export async function archiveOrgTrade(tradeId: string): Promise<void> {
  await updateDoc(tradeRef(tradeId), {
    status: 'archived',
    updatedAt: serverTimestamp(),
  });
}

export async function renameOrgTrade(tradeId: string, name: string): Promise<TradeListItem> {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('Enter a name.');
  if (trimmed.length > 80) throw new Error('Keep the name under 80 characters.');
  const existing = await ensureOrgTradeList();
  const current = existing.find((trade) => trade.id === tradeId);
  if (!current) throw new Error('That category is not on the list yet.');
  const duplicate = existing.find((trade) => (
    trade.id !== tradeId
    && trade.status !== 'archived'
    && trade.name.toLowerCase() === trimmed.toLowerCase()
  ));
  if (duplicate) throw new Error(`${trimmed} is already on the list.`);
  await updateDoc(tradeRef(tradeId), {
    name: trimmed,
    updatedAt: serverTimestamp(),
  });
  return { ...current, name: trimmed };
}
