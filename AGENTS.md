# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE5.md` — current phase brief (database audit, then jobs and membership)
4. Open `design/risingamp-vision.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

Phases 1–4 are **done** and live. Phase 5 is in progress on branch `phase-5-jobs-members` (from `phase-4-domain-email`). Never commit to `master` or `main`. Part A is read-only (`DATABASE-AUDIT.md`). Do not write to production job data unless `PROGRESS.md` and the owner explicitly say so after a backup. Hosting deploy is `firebase deploy --project production --only hosting`. Never `firebase deploy --only functions` to production (would delete leftover `generateWeeklyReport`). Never accept a raw API key or secret pasted into chat.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE5.md. Open design/risingamp-vision.html. Work is on branch phase-5-jobs-members (from phase-4-domain-email). Shopfront is https://risingamp.com.au. Localhost stays on staging. Part A is a written audit only — DATABASE-AUDIT.md — change no data. Do not run production schema or data writes without a backup, a staging run, and an explicit yes. Never hard-delete user records. Never accept a pasted API key. Do not deploy a full functions set to production (that would delete generateWeeklyReport).
