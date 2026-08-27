# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE6.md` — current phase brief (integrity and database follow-through)
4. Open `design/risingamp-vision.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

Phases 1–5 are **done** and live. Phase 6 is in progress on branch `phase-6-integrity` (from `phase-5-jobs-members`). Never commit to `master` or `main`. Hosting deploy is `firebase deploy --project production --only hosting`. Never `firebase deploy --only functions` to production (would delete leftover `generateWeeklyReport`). Never accept a raw API key or secret pasted into chat.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE6.md. Open design/risingamp-vision.html. Work is on branch phase-6-integrity (from phase-5-jobs-members). Shopfront is https://risingamp.com.au. Localhost stays on staging. Phases 1–5 are live. Never hard-delete user records. Never accept a pasted API key. Do not deploy a full functions set to production (that would delete generateWeeklyReport).
