# Progress

## Current branch

`phase-1-foundation` (from `master` @ `fc82e01`)

Restore tag: `pre-phase1-2026-08-22`

## This session (2026-08-22)

### Done

- Lalit confirmed staging numbers look real. Login PIN screen is a different colour than the hosted site (localhost vs live build; not a data problem).
- Cold-exported Site Log / Weekly Report from the existing production backup (5 records, 9 files) into a gitignored folder. Not re-imported.
- Removed Site Log and Weekly Report from the app (sidebar, pages, helpers, Cloud Function source).
- Deleted 5 site log documents on **staging only**. Checked production still has those 5 records and expenses still load.
- Live family app was not deployed to and was not written to.

### Next concrete step

Lalit refreshes http://localhost:3000, confirms Site Log and Weekly Report are gone from the menu, and that jobs/expenses are still there. Then: Google / Gmail login on staging (Phase 1 B).

### Waiting on Lalit

- Refresh localhost and say the two menu items are gone and the numbers are still right.
- Other family Gmails whenever convenient (not blocking).

## Do not do next session until approved

- Any `firebase deploy` to production.
- Any Firestore/Storage write to `rising-amp-467702-b5`.
- Deleting Site Log data from production (still there on purpose).
- Committing secrets or access codes.
- Deleting leftover test/typo workspaces.
