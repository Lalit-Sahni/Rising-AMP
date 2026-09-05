import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { firebaseEnv, missingFirebaseEnv } from "../env";
import logger from "../utils/logger";

const firebaseConfig = {
  apiKey: firebaseEnv.apiKey,
  authDomain: firebaseEnv.authDomain,
  projectId: firebaseEnv.projectId,
  storageBucket: firebaseEnv.storageBucket,
  messagingSenderId: firebaseEnv.messagingSenderId,
  appId: firebaseEnv.appId,
};

const missingVars = missingFirebaseEnv();
if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  console.error('Create a .env.local file with the staging Firebase config. See .env.example.');
}

const app = initializeApp(firebaseConfig);

logger.info('Firebase project', firebaseEnv.projectId);

const appCheckSiteKey = firebaseEnv.appCheckSiteKey;
if (appCheckSiteKey) {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // Localhost debug tokens. Do not turn on enforcement until traffic is clean.
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

function createFirestore() {
  const canUseDisk =
    typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

  if (canUseDisk) {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch (error) {
      logger.warn('Firestore disk cache unavailable, using memory', error);
    }
  }

  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  } catch (error) {
    return getFirestore(app);
  }
}

const db = createFirestore();
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

export { app, db, auth };
