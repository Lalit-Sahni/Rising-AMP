# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE12.md` — Front-end upgrade (live hosting 6 Sep 2026)
4. Open `design/risingamp-vision.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PHASE11.md` / `PHASE10.md` / `PHASE9.md` / `PHASE8.md` / `PHASE7.md` / `PHASE6.md` / `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

**Where we are (2026-09-06):** Phase 12 front-end is live on production hosting. Branch `phase-12-fables-upgrade`. Restore tag `pre-phase12-2026-09-05`. Phase 11 Parts A–E remain live (function `maintainLedgerRollup`, Firestore rules, `ledgerRollup/current`). Localhost still uses staging. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport`, `readQuoteFile` and `maintainLedgerRollup`; deploy by name, **no `--force`**. Next is his phone: force-close, reopen twice. 275 KB is the held ceiling. Never commit to `master` or `main`. Never accept a raw API key or secret pasted into chat.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE12.md. Phase 12 front-end is live on production hosting (6 Sep 2026). Branch phase-12-fables-upgrade. Restore tag: pre-phase12-2026-09-05. Phase 11 Parts A–E are live (5 Sep 2026). Localhost stays on staging. Next is his phone: force-close, reopen twice. 275 KB is the held ceiling. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named.
