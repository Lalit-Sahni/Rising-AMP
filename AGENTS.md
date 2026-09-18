# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE18.md` — People (roles, page, identity bugs; staging and production live 19 Sep 2026 from `phase-18-people`)
4. `PHASE17.md` — Make coding work (on the same trunk; Part E numbers in `PROGRESS.md`)
5. `PHASE16.md` — The job knows itself (live on production 11 Sep 2026 from `phase-16-job-facts`; Parts A–D; not merged to master)
6. `PHASE15.md` — Ask does things (UI + `assistantReceipts` rules live with that ship)
7. `PHASE14.md` — Ask (done on `phase-14-ask`; Parts A–G; write ban lifted for Phase 15 reversible actions)
8. `PHASE13.md` — The tidy workplace (done on the branch; `extractJobFileText` and Phase 13 rollups live on production 11 Sep 2026)
9. Open `design/risingamp-people-vision.html` before People code; `design/risingamp-ask-vision.html` before Ask code; `design/risingamp-vision.html` before changing the shell
10. `ARCHITECTURE.md` — how the running app is actually built
11. `PHASE12.md` / `PHASE11.md` / `PHASE10.md` / `PHASE9.md` / `PHASE8.md` / `PHASE7.md` / `PHASE6.md` / `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

**Where we are (2026-09-19):** Latest branch is `phase-18-people` (**not merged to `master`/`main`**). Restore tag `pre-phase18-2026-09-18`. **Staging and production are live.** Staging hosting `index-BD5jfyNY.js`. Production hosting `index-C-Zkfj8K.js`. Missing `assistantWritesEnabled` means **on**. `resendWebhook` is not deployed. Party backfill and file re-extract still refuse `--production`. The model never calculates and never chooses the tier. Metro Consulting and the cross-kind unlinked list remain the owner's. Localhost still uses staging. Functions are the original eight with `sendJobInviteEmail` updated. Deploy by name, **no `--force`**. 400 KB is the held ceiling; the build still fails on breach. Never commit to `master` or `main`. Never accept a raw API key or secret pasted into chat. Owner list: `scripts/party-backfill-unlinked-staging.md`.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE18.md, then PHASE17.md. Latest branch is phase-18-people. Restore tag: pre-phase18-2026-09-18. Staging and production walked 19 Sep 2026. Production hosting index-C-Zkfj8K.js. Not merged to master. Missing assistantWritesEnabled means on. resendWebhook is not deployed. Party backfill and file re-extract still refuse `--production`. The model never calculates and never chooses the tier. GST is the stated figure only. Metro Consulting and the cross-kind unlinked list remain the owner's. Localhost stays on staging. Never `--force`. 400 KB is the held ceiling; the build still fails on breach. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named. Look first: scripts/party-backfill-unlinked-staging.md.
