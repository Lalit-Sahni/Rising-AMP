/** Original job-file bytes. Handover pack only — never for a list. */

import { getBytes, ref } from 'firebase/storage';
import { getFirebaseStorage } from './callable';

const MAX_BYTES = 26 * 1024 * 1024;

export async function getBytesForPath(path: string, maxBytes = MAX_BYTES): Promise<Uint8Array | null> {
  if (!path) return null;
  try {
    const storage = await getFirebaseStorage();
    const buffer = await getBytes(ref(storage, path), maxBytes);
    return new Uint8Array(buffer);
  } catch (error) {
    return null;
  }
}
