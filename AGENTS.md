# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE15.md` — Ask does things (done on `phase-15-actions`; Parts A–E; not merged; not deployed)
4. `PHASE14.md` — Ask (done on `phase-14-ask`; Parts A–G; write ban lifted for Phase 15 reversible actions)
5. `PHASE13.md` — The tidy workplace (done on the branch; not on production)
6. `PHASE12.md` — Front-end upgrade (closed; live hosting 6 Sep 2026)
7. Open `design/risingamp-ask-vision.html` before Ask code; `design/risingamp-vision.html` before changing the shell
8. `ARCHITECTURE.md` — how the running app is actually built
9. `PHASE11.md` / `PHASE10.md` / `PHASE9.md` / `PHASE8.md` / `PHASE7.md` / `PHASE6.md` / `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

**Where we are (2026-09-08):** Latest branch is `phase-15-actions`. Restore tag `pre-phase15-2026-09-08` (SHA `176002f`, last Phase 14 commit). Phase 15 **Parts A–E are done** (receipted actions; dropped invoice → expense; sort uncoded to cost plan; activity view with undo; evals and kill switch). Do **not** start the next phase until this branch is merged / the owner names it. Phase 14 Parts A–G are done on `phase-14-ask`. Phase 15 lifts the read-only ban for reversible internal writes only; the model never calculates and never chooses the tier. Phase 13 blockers closed on staging: uncoded pool; Lalit + Sydney Excavation merges; re-extract. Metro Consulting and the cross-kind unlinked list remain the owner’s. Production is untouched (original six functions; no `askRisingAmp`). Phase 12 is closed and live on production hosting. Phase 11 Parts A–E remain live (function `maintainLedgerRollup`, Firestore rules, `ledgerRollup/current`). Localhost still uses staging. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport`, `readQuoteFile` and `maintainLedgerRollup`; staging also has `extractJobFileText` and `askRisingAmp`. Staging Firestore rules include askHistory `answerFromDocuments` + `refusalReason`. Phase 15 `assistantReceipts` rules are in the repo, **not deployed**. Deploy by name, **no `--force`**. 400 KB is the held ceiling; the build still fails on breach. Never commit to `master` or `main`. Never accept a raw API key or secret pasted into chat. Owner list: `scripts/party-backfill-unlinked-staging.md`.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE15.md, then PHASE14.md. Latest branch is phase-15-actions. Restore tag: pre-phase15-2026-09-08. Phase 15 Parts A–E are done (receipted actions; dropped invoice → expense; sort uncoded to cost plan; activity view with undo; evals and kill switch). Do not start the next phase until he names merge. Phase 14 Parts A–G are done on phase-14-ask. Phase 15 lifts the read-only ban for reversible internal writes only; the model never calculates and never chooses the tier. Kill switch ships off. Metro Consulting and the cross-kind unlinked list remain the owner’s. Production is untouched (six functions; no askRisingAmp). Localhost stays on staging. Never `--force`. 400 KB is the held ceiling; the build still fails on breach. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named. Look first: scripts/party-backfill-unlinked-staging.md.
