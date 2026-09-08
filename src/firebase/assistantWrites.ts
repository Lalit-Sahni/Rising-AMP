/**
 * Org-level assistant write kill switch.
 * Path: organizations/{orgId}.assistantWritesEnabled
 * Missing or not true is off. Profile (lazy) only. Do not import from App.js.
 */
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './config';

function isOn(value: unknown): boolean {
  return value === true;
}

export async function readAssistantWritesEnabled(orgId: string): Promise<boolean> {
  const id = String(orgId || '').trim();
  if (!id) return false;
  try {
    const snap = await getDoc(doc(db, 'organizations', id));
    if (!snap.exists()) return false;
    return isOn(snap.data()?.assistantWritesEnabled);
  } catch {
    return false;
  }
}

export async function setAssistantWritesEnabled(orgId: string, enabled: boolean): Promise<void> {
  const id = String(orgId || '').trim();
  if (!id) throw new Error('An organisation is required.');
  await updateDoc(doc(db, 'organizations', id), {
    assistantWritesEnabled: Boolean(enabled),
    updatedAt: serverTimestamp(),
  });
}
