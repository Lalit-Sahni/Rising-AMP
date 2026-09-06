const keys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export function viteString(name: string): string {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  return typeof value === 'string' ? value : '';
}

export const firebaseEnv = {
  apiKey: viteString('VITE_FIREBASE_API_KEY'),
  authDomain: viteString('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: viteString('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: viteString('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: viteString('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: viteString('VITE_FIREBASE_APP_ID'),
  appCheckSiteKey: viteString('VITE_FIREBASE_APPCHECK_SITE_KEY'),
};

export function missingFirebaseEnv(): string[] {
  return keys.filter((key) => !viteString(key));
}

export function firebaseProjectId(): string {
  return firebaseEnv.projectId;
}
