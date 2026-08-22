# Progress

## Current branch

`phase-1-foundation` (from `master` @ `fc82e01`)

Restore tag: `pre-phase1-2026-08-22`

## This session (2026-08-22)

### Done

- Agreed preview model: localhost → staging Firebase; never `firebase deploy` to production during this work.
- Investigated the repo (read-only). Wrote `ARCHITECTURE.md`, `PLAN.md`, `CLAUDE.md`.
- Git: tagged restore point `pre-phase1-2026-08-22`, created branch `phase-1-foundation`. Did not change app behaviour. Did not deploy to production. Did not write to production Firestore/Storage.
- Created empty Firebase project **`rising-amp-staging`**. Created its default Firestore database (`nam5`). Deployed current Firestore rules/indexes **to staging only**.
- Pointed local env at staging: `.env.local` and `.env.staging` → `rising-amp-staging`. Saved previous live keys as `.env.production.local` (gitignored).
- `.firebaserc` aliases: `default`/`staging` = `rising-amp-staging`, `production` = `rising-amp-467702-b5`. Accidental `firebase deploy` now hits staging, not live.
- Existing backup (`backups/latest-backup.json`, Oct 2025) is empty (`totalUsers: 0`) and is not a restore.

### In flight / blocked on two Google clicks

Staging exists but is not fully usable until Lalit:

1. **Authentication → Get started** on the staging project (so the current code-login can sign in anonymously while we test).
2. **Attach the same billing account the live app already uses** (Google now requires this for Storage and for Identity Platform-style Auth APIs). Needed before we can copy receipt images.

No family data has been copied yet.

### Next concrete step

1. Lalit does the two Console clicks (instructions in the session notes / PLAN).
2. Then: propose a proper **read-only** backup script. Do not run it until he says yes.
3. After that: copy backup into staging only; he checks localhost with the family code.

### Waiting on Lalit

- Two Console clicks (Auth Get started + billing on staging).
- Confirm owner Gmail (`sahni.lalit18@gmail.com`?).
- The other three family Gmails.
- The real family access code (chat only, never commit).

## Do not do next session until approved

- Any `firebase deploy` to production (`--project production` / `rising-amp-467702-b5`).
- Any Firestore/Storage write to `rising-amp-467702-b5`.
- Copying production data (needs reviewed backup script first).
- Deleting Site Log / Weekly Report from the live database.
- Committing secrets or the access code.
