# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE14.md` — Ask (open on `phase-14-ask`; Part A not started)
4. `PHASE13.md` — The tidy workplace (done on the branch; not on production)
5. `PHASE12.md` — Front-end upgrade (closed; live hosting 6 Sep 2026)
6. Open `design/risingamp-ask-vision.html` before Ask code; `design/risingamp-vision.html` before changing the shell
7. `ARCHITECTURE.md` — how the running app is actually built
8. `PHASE11.md` / `PHASE10.md` / `PHASE9.md` / `PHASE8.md` / `PHASE7.md` / `PHASE6.md` / `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

**Where we are (2026-09-07):** Latest branch is `phase-14-ask`. Restore tag `pre-phase14-2026-09-07` (SHA `0dfcb51`, last Phase 13 blocker). Phase 14 Part A is **not started**. Phase 13 blockers closed on staging: uncoded pool; Lalit + Sydney Excavation merges; re-extract. Metro Consulting and the cross-kind unlinked list remain the owner’s. Production is untouched. Phase 12 is closed and live on production hosting. Phase 11 Parts A–E remain live (function `maintainLedgerRollup`, Firestore rules, `ledgerRollup/current`). Localhost still uses staging. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport`, `readQuoteFile` and `maintainLedgerRollup`; staging also has `extractJobFileText`. Deploy by name, **no `--force`**. The model never calculates. 400 KB is the held ceiling (270.1 KB); the build still fails on breach. Never commit to `master` or `main`. Never accept a raw API key or secret pasted into chat. Owner list: `scripts/party-backfill-unlinked-staging.md`.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE14.md. Latest branch is phase-14-ask. Restore tag: pre-phase14-2026-09-07. Phase 13 blockers closed on staging (uncoded pool; Lalit + Sydney Excavation merges; re-extract). Metro Consulting and the cross-kind unlinked list remain the owner’s. Phase 14 Part A is not started. Production is untouched. Localhost stays on staging. Never `--force`. Model never calculates. 400 KB is the held ceiling (270.1 KB); the build still fails on breach. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named. Look first: scripts/party-backfill-unlinked-staging.md.
