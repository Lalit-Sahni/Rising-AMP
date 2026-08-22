# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE2.md` — Phase 2 visual brief (if doing Phase 2)
4. Open `design/opal-track-reference.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PLAN.md` — Phase 1 record only (complete)

Do not rely on chat history. If chat and these files disagree, these files win.

Phase 1 and Phase 2 are **done** and live. Do not re-run cutover. Do not restyle unless Lalit asks. Work on a branch, never `master` or `main`. Never write to production Firebase (`rising-amp-467702-b5`) unless `PROGRESS.md` and the owner explicitly say so. Hosting deploy is `firebase deploy --project production --only hosting`.
