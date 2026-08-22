# Progress

## Current branch

`phase-2-visual` (from `phase-1-foundation`). **Phase 2 hosting is live** on production (`rising-amp-467702-b5`). Localhost / `.env.local` still points at **staging**.

Restore tag (Phase 1 unwind): `pre-phase1-2026-08-22`

Production: `rising-amp-467702-b5` — https://rising-amp-467702-b5.web.app  
Staging: `rising-amp-staging` — localhost / `.env.local`  
`.firebaserc` default is **staging**. Git push does not deploy. Live hosting changes only on `firebase deploy --project production --only hosting`.

## Where we are (2026-08-23)

**Phase 1 is closed.** **Phase 2 visual restyle is live** (Manrope, Palette 1, colour as data ink only). Same login, jobs, numbers, and invites as before. No Firestore / Storage / functions deploy with this restyle.

Look source: `design/opal-track-reference.html`. Invalid dates show "—". Empty budget is an empty state, not a green remaining.

## Next

- [x] Create branch `phase-2-visual` from `phase-1-foundation`
- [x] Tokens + Manrope
- [x] Family screens restyled (localhost)
- [x] Strip tinted category furniture — colour on dots / icons / bars only
- [x] Production **hosting** deploy (2026-08-23)
- [ ] Wait for Lalit. Do not invent the next phase.
- [ ] Do not deploy Cloud Functions (`generateWeeklyReport` is unused on live)
- [ ] Do not write to production Firestore or Storage unless he asks after a backup

## Phase 1 leftovers (not unless he asks)

- Live OAuth consent for sending invite mail from Gmail
- Unused `users/{code}` PIN folders (do not delete)
- Unused live function `generateWeeklyReport` (do not deploy functions)
- Staging has no Storage bucket (receipts missing on localhost)

## Local files that are not the live app

- `risingamp-vision.html` (repo root, untracked) — a later concept. Do not paste it into React. Do not treat it as the current look.
- `design/opal-track-redesign.html` — earlier Geist concept. Phase 2 look is `design/opal-track-reference.html`.

## Do not do

- Change behaviour, data, auth, or calculations
- Add email/password login, “new job list”, or a Reports page because they appear in a mockup
- Paste any design HTML into the React app
- Tint card backgrounds or put category colour on chrome
- `firebase deploy` without `--project production` and an explicit `--only`
- Commit `.env*`, `.phase1-local.json`, or `backups/`
- Billing, Stripe, a second product

## How to talk to Lalit

Civil engineer, not a full-time programmer. Everyday language. Show localhost / live. Propose, then do. Small steps.
