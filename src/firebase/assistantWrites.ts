/**
 * Org-level assistant write kill switch.
 * Path: organizations/{orgId}.assistantWritesEnabled
 * Only a deliberate boolean false is off. A read that fails is 'unknown',
 * never someone's choice. Profile (lazy) only. Do not import from App.js.
 */
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './config';

export type AssistantWritesSetting = true | false | 'unknown';

/** Only setAssistantWritesEnabled writes this field, and it writes a boolean. */
function isOff(value: unknown): boolean {
  return value === false;
}

export async function readAssistantWritesEnabled(orgId: string): Promise<AssistantWritesSetting> {
  const id = String(orgId || '').trim();
  if (!id) return 'unknown';
  try {
    const snap = await getDoc(doc(db, 'organizations', id));
    if (!snap.exists()) return 'unknown';
    return isOff(snap.data()?.assistantWritesEnabled) ? false : true;
  } catch (error) {
    console.warn('Could not read assistantWritesEnabled:', error instanceof Error ? error.message : error);
    return 'unknown';
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
