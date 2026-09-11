# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE16.md` — The job knows itself (live on production 11 Sep 2026 from `phase-16-job-facts`; Parts A–D; not merged to master)
4. `PHASE15.md` — Ask does things (UI + `assistantReceipts` rules live with that ship; kill switch still off)
5. `PHASE14.md` — Ask (done on `phase-14-ask`; Parts A–G; write ban lifted for Phase 15 reversible actions)
6. `PHASE13.md` — The tidy workplace (done on the branch; `extractJobFileText` live on production 11 Sep 2026; production rollups still Phase 11 shape)
7. `PHASE12.md` — Front-end upgrade (closed; live hosting 6 Sep 2026)
8. Open `design/risingamp-ask-vision.html` before Ask code; `design/risingamp-vision.html` before changing the shell
9. `ARCHITECTURE.md` — how the running app is actually built
10. `PHASE11.md` / `PHASE10.md` / `PHASE9.md` / `PHASE8.md` / `PHASE7.md` / `PHASE6.md` / `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

**Where we are (2026-09-11):** Latest branch is `phase-16-job-facts` (pushed; **not merged to `master`/`main`**). Restore tag `pre-phase16-2026-09-09` (SHA `a3fba94`, last Phase 15 commit). Phase 16 **Parts A–D are live on production** (hosting `index-DhMkWQ3T.js`, Firestore rules, `extractJobFileText`, `askRisingAmp`; backup `backups/production-2026-09-11T12-03-06-245Z`). Phase 15 UI and `assistantReceipts` rules went with that ship; kill switch `assistantWritesEnabled` stays **off**. Phase 14 Parts A–G are done on `phase-14-ask`. Phase 15 lifts the read-only ban for reversible internal writes only; the model never calculates and never chooses the tier. Phase 13 blockers closed on staging: uncoded pool; Lalit + Sydney Excavation merges; re-extract. Metro Consulting and the cross-kind unlinked list remain the owner’s. Phase 12 is closed and live on production hosting. Phase 11 Parts A–E remain live (`maintainLedgerRollup` was **not** redeployed; production rollups stay the Phase 11 shape). Localhost still uses staging. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport`, `readQuoteFile`, `maintainLedgerRollup`, `extractJobFileText` and `askRisingAmp`. Staging has the same eight. Deploy by name, **no `--force`**. Do not recompute production rollups unless named. 400 KB is the held ceiling; the build still fails on breach. Never commit to `master` or `main`. Never accept a raw API key or secret pasted into chat. Owner list: `scripts/party-backfill-unlinked-staging.md`. Force-close and reopen the home-screen app twice.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE16.md, then PHASE15.md. Latest branch is phase-16-job-facts. Restore tag: pre-phase16-2026-09-09. Phase 16 Parts A–D are live on production (11 Sep 2026): hosting, Firestore rules, extractJobFileText, askRisingAmp. Not merged to master. Phase 15 UI and assistantReceipts rules went with that ship; kill switch stays off. The model never calculates and never chooses the tier. Metro Consulting and the cross-kind unlinked list remain the owner’s. Localhost stays on staging. Never `--force`. 400 KB is the held ceiling; the build still fails on breach. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named. Do not recompute production rollups unless named. Look first: scripts/party-backfill-unlinked-staging.md.
