import { app } from './config';

export async function callFunction(name, data, options) {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  const functions = getFunctions(app, 'us-central1');
  const callable = httpsCallable(functions, name, options);
  const result = await callable(data);
  return result.data;
}

export async function getFirebaseStorage() {
  const { getStorage } = await import('firebase/storage');
  return getStorage(app);
}
