# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE3.md` — Phase 3 vision brief (if doing Phase 3)
4. Open `design/risingamp-vision.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

Phase 1 and Phase 2 are **done** and live. Phase 3 is live on hosting from `phase-3-vision`. Never commit to `master` or `main`. Never write to production job data unless `PROGRESS.md` and the owner explicitly say so. Hosting deploy is `firebase deploy --project production --only hosting`. Do not deploy Cloud Functions.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE3.md. Open design/risingamp-vision.html. Phase 3 is live on hosting from phase-3-vision. Localhost stays on staging. Do not deploy Cloud Functions.
