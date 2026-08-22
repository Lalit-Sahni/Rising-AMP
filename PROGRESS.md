# Progress

## Current branch

`phase-1-foundation` (from `master` @ `fc82e01`)

Restore tag: `pre-phase1-2026-08-22`

Production Firebase: `rising-amp-467702-b5` (display name **My First Project**)  
Staging Firebase: `rising-amp-staging` (localhost / `.env.local`)

`.firebaserc` default is **staging**. Accidental `firebase deploy` with no `--project` hits staging, not live.

Live URL: https://rising-amp-467702-b5.web.app

## Where we are (2026-08-23)

**Phase 1 is closed.** Lalit confirmed the live site works.

Live app: Google / Gmail login → job-list chooser → dashboard. Two jobs: **72 Centenary Dr** and **Gurner St**. Invite is per job. Org `organizations/opal-ss-constructions`. Old PIN folders were copied, not deleted. Site Log / Weekly Report are gone from the UI. Functions were not deployed.

Localhost (`npm start`) still talks to **staging**. Do not swap env files.

## Next

Phase 2. Wait for Lalit’s brief. New git branch from `phase-1-foundation`. Do not invent the work.

Known leftovers (not Phase 2 unless he asks):

- Live OAuth consent screen for sending invite mail from Gmail
- Unused `users/{code}` PIN folders on production (do not delete)
- Unused live Cloud Function `generateWeeklyReport` (do not deploy functions)
- Staging has no Storage bucket (receipts missing on localhost)

## Phase 1 checklist (all done)

- [x] Staging project, localhost → staging, restore tag
- [x] Production read-only backups
- [x] Site Log / Weekly Report removed from the app
- [x] Google sign-in on staging and production
- [x] One org, two named job lists, per-job invites
- [x] Live cutover: copy org + jobs, hosting + rules only
- [x] Lalit confirmed live works
- [x] Docs closed; commit on `phase-1-foundation`

## Cutover record (do not repeat)

1. Backup: `backups/production-2026-08-22T14-12-13-241Z` (gitignored).
2. `scripts/cutover-production-org.js --apply --production` — 216 docs copied. Leftover PIN folders untouched.
3. Build with `.env.production.local`. Gmail API enabled on production.
4. `firebase deploy --project production --only hosting,firestore:rules`. Did **not** deploy functions.

## Do not do

- `firebase deploy` to production without `--project production` and an explicit `--only`
- Any delete of leftover PIN folders or production Site Log rows
- Commit `.env*`, `.phase1-local.json`, or `backups/`
- Deploy functions unless Lalit asks (would risk removing live `generateWeeklyReport`)
- Billing, Stripe, or a new product unless Lalit asks

## How to talk to Lalit

Civil engineer, not a full-time programmer. Everyday language. Propose live writes, then do them. Small steps on a branch.
