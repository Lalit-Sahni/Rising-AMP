# Progress

## Current branch

`phase-1-foundation` (from `master` @ `fc82e01`)

Restore tag: `pre-phase1-2026-08-22`

## This session (2026-08-22)

### Done

- Docs, restore tag, branch, empty staging project, localhost pointed at staging (earlier in session).
- Owner confirmed: Gmail `sahni.lalit18@gmail.com`; two real workspaces (recorded in gitignored `.phase1-local.json` only); other family emails later is fine; other codes are tests/typos and must not be deleted.
- Staging Auth Get started is done. Anonymous sign-in enabled on staging.
- Billing upgrade was not offered. Staging has **no Storage bucket** yet.
- Wrote production read-only backup + staging-only restore scripts (`scripts/backup-production.js`, `scripts/restore-to-staging.js`). Guards refuse to write production.
- Ran read-only production backup. 239 Firestore documents, 18 storage files, 5 workspace codes. Second database `cost-tracker` is empty.
- Restored Firestore into **staging only** (239/239). Verified both real workspaces exist on staging with their collections.
- Storage upload to staging failed (bucket does not exist). Receipt/site-log images remain in the local backup folder. Live Storage was not touched.

### In flight

- Staging copy is ready for localhost checks (numbers/jobs). Receipt thumbnails on staging will be missing until Storage is turned on.

### Next concrete step

Lalit runs `npm start`, opens http://localhost:3000, signs in with each real code, and says whether the jobs look right. Then we start Site Log / Weekly Report **code** removal on the branch (still no production writes).

### Waiting on Lalit

- Click around staging on localhost and confirm the two real cabinets look like production.
- Other family Gmails whenever convenient (not blocking).
- Optional later: if Google offers Blaze/billing on staging, attach the same account so receipt photos can be copied.

## Do not do next session until approved

- Any `firebase deploy` to production.
- Any Firestore/Storage write to `rising-amp-467702-b5`.
- Deleting Site Log / Weekly Report from the live database.
- Committing secrets or access codes.
- Deleting leftover test/typo workspaces.
