# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE11.md` — Cold start (active phase)
4. Open `design/risingamp-vision.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PHASE10.md` / `PHASE9.md` / `PHASE8.md` / `PHASE7.md` / `PHASE6.md` / `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

**Where we are (2026-09-05):** Phase 11 Part A (app-shell service worker) is on `phase-11-cold-start`, not deployed. Restore tag `pre-phase11-2026-09-05`. Next is Part B: Firestore `persistentLocalCache` plus `onSnapshot`. Localhost still uses staging. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport` and `readQuoteFile`; deploy by name. Never commit to `master` or `main`. Never accept a raw API key or secret pasted into chat.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE11.md. Phase 11 Part A is on `phase-11-cold-start`, not deployed. Next is Part B. Restore tag: pre-phase11-2026-09-05. Localhost stays on staging. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named.
