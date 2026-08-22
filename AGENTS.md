# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE2.md` — Phase 2 visual brief (if doing Phase 2)
4. Open `design/opal-track-redesign.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PLAN.md` — Phase 1 record only (complete)

Do not rely on chat history. If chat and these files disagree, these files win.

Phase 1 is **done** and live. Do not re-run cutover. Phase 2 is a restyle on branch `phase-2-visual` from `phase-1-foundation`. Never commit to `master` or `main`. Never write to production Firebase (`rising-amp-467702-b5`) unless `PROGRESS.md` and the owner explicitly say so.
