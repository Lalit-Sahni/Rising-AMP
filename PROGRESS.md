# Progress

## Current branch

`phase-1-foundation` (from `master` @ `fc82e01`)

Restore tag: `pre-phase1-2026-08-22`

Production Firebase: `rising-amp-467702-b5` (do not write)  
Staging Firebase: `rising-amp-staging` (localhost points here)

## Where we are

Phase 1 **A is done** on the branch and on staging.  
Phase 1 **B is next** (Google login). Lalit said continue, then asked to lock handoff before context ran out. **Do not start C yet.**

## Done (2026-08-22)

- Safety: restore tag, feature branch, staging project, `.firebaserc` default = staging.
- Localhost talks to staging. Production keys saved as `.env.production.local` (gitignored).
- Read-only production backup + Firestore copy into staging. Receipt photos are in the local backup folder; staging has no Storage bucket (Google did not ask to attach billing).
- Lalit confirmed staging **numbers** match the live jobs. Login PIN colour differs (localhost vs hosted site; ignore unless he asks).
- Site Log + Weekly Report removed from the **app code**. Cold export on disk. Five site-log rows deleted on **staging only**. Production still has those five rows and the live site still shows the old features.
- Two real workspaces exist (recorded in `.phase1-local.json`, not git). Other codes are tests/typos — do not delete. Owner Gmail is in that file. Other family emails wait.

## Next concrete step (Phase 1 B)

On **staging only**:

1. Enable Google sign-in on Firebase project `rising-amp-staging` (Authentication → Sign-in method → Google). Authorized domain: `localhost`.
2. Replace the PIN/code login with “Continue with Google”.
3. After login: if the Gmail is invited (start with the owner), show a project list; if not, a calm “not invited” screen. Do not create a new empty workspace on a typo.
4. Project picker can be a first slice: list project names derived from expense/invoice `projectName` (there is no `projects` collection in the live data). Filtering the whole dashboard per project can land with Phase 1 C if that is too large for one session — but the login itself must be Google, not the PIN.
5. Do not deploy to production. Do not change production Auth.

## In flight / known gaps

- Staging receipt thumbnails missing (no Storage bucket).
- Live site still has Site Log / Weekly Report until cutover.
- `PLAN.md` session-order list is the source for remaining steps after B.

## Do not do

- `firebase deploy` to production (`--project production` / `rising-amp-467702-b5`).
- Any write to production Firestore or Storage.
- Delete Site Log data from production.
- Delete leftover test/typo workspaces.
- Commit `.env*`, `.phase1-local.json`, or `backups/`.
- Billing, Stripe, a second product, design rework, new npm packages unless Lalit asks.

## How the next agent should talk to Lalit

He is a civil engineer, not a full-time programmer. Explain what you will do in everyday language. Do not paste scripts at him unless he asks. Propose side-effect work, then do it in small commits on this branch.
