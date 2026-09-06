# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE13.md` — The tidy workplace (open; Part A1 in progress)
4. `PHASE12.md` — Front-end upgrade (closed; live hosting 6 Sep 2026)
5. Open `design/risingamp-vision.html` in a browser
6. `ARCHITECTURE.md` — how the running app is actually built
7. `PHASE11.md` / `PHASE10.md` / `PHASE9.md` / `PHASE8.md` / `PHASE7.md` / `PHASE6.md` / `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

**Where we are (2026-09-06):** Phase 13 is named and underway on `phase-13-query-layer`. Part A1 (party model + forward writes) is in progress. Restore tag `pre-phase13-2026-09-06`. Phase 12 is closed and live on production hosting. Phase 11 Parts A–E remain live (function `maintainLedgerRollup`, Firestore rules, `ledgerRollup/current`). Localhost still uses staging. Production is untouched this phase. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport`, `readQuoteFile` and `maintainLedgerRollup`; deploy by name, **no `--force`**. Do not start Phase 14 until he names it. 275 KB is the held ceiling. Never commit to `master` or `main`. Never accept a raw API key or secret pasted into chat.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE13.md. Phase 13 is named and underway on phase-13-query-layer (Part A1 in progress). Phase 12 is closed and live on production hosting (6 Sep 2026). Restore tag: pre-phase13-2026-09-06. Phase 11 Parts A–E are live (5 Sep 2026). Localhost stays on staging. Do not start Phase 14 until he names it. 275 KB is the held ceiling. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named.
