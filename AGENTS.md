# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PLAN.md` — Phase 1 record (complete)
4. `ARCHITECTURE.md` — how the running app is actually built

Do not rely on chat history. If chat and these files disagree, these files win.

Phase 1 is **done** and live. Do not re-run cutover. Start Phase 2 on a new branch from `phase-1-foundation`, never on `master` or `main`. Never write to production Firebase (`rising-amp-467702-b5`) unless `PROGRESS.md` and the owner explicitly say so.
