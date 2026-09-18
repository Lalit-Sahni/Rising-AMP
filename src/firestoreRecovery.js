/**
 * Firestore poisons its own AsyncQueue when an internal assertion fires
 * (assertion ca9, pendingResponses below zero, then b815 on every later
 * enqueue). Once that happens the client is dead for the life of the page:
 * every listener, read and write throws, hundreds of times a second, and
 * terminate() throws too because it enqueues.
 *
 * The failure is in memory only. Nothing is written to IndexedDB, so a
 * reload gives the page a fresh queue and the user is fine. Reload once,
 * and only once, so a repeatable fault cannot become a reload loop.
 *
 * The SDK bug itself is fixed in firebase 12.13.0 and hardened in 12.14.0.
 * This stays as the net for anyone still holding an older cached bundle.
 * Imported first in src/index.js, before Firebase initialises.
 */
const FLAG = 'risingAmp.firestoreRecovered';
const FATAL = /INTERNAL ASSERTION FAILED/;

function alreadyRecovered() {
  try {
    return sessionStorage.getItem(FLAG) === '1';
  } catch (error) {
    // Private mode or blocked storage. Treat as recovered so we never loop.
    return true;
  }
}

function markRecovered() {
  try {
    sessionStorage.setItem(FLAG, '1');
    return true;
  } catch (error) {
    return false;
  }
}

function isFatalFirestoreError(value) {
  if (!value) return false;
  const text = typeof value === 'string' ? value : String(value.message || '');
  return FATAL.test(text);
}

function handle(value) {
  if (!isFatalFirestoreError(value)) return;
  if (alreadyRecovered()) return;
  if (!markRecovered()) return;
  console.error('Firestore client failed. Reloading once to recover.', value);
  window.location.reload();
}

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => handle(event && event.reason));
  window.addEventListener('error', (event) => handle(event && event.error));
}

export { isFatalFirestoreError };
