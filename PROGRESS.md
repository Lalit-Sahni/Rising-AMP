# Progress

## Current branch

`phase-2-visual` (from `phase-1-foundation`). Visual restyle only. Localhost / staging. Do not deploy to production until Lalit asks.

Restore tag (Phase 1 unwind): `pre-phase1-2026-08-22`

Production: `rising-amp-467702-b5` — https://rising-amp-467702-b5.web.app  
Staging: `rising-amp-staging` — localhost / `.env.local`  
`.firebaserc` default is **staging**.

## Where we are (2026-08-23)

**Phase 1 is closed.** **Phase 2 visual restyle is on localhost**, waiting for Lalit to look at http://localhost:3000.

Look source: `design/opal-track-reference.html` (Manrope + Palette 1). Tokens, Manrope, steel chrome, category colour only as data ink (dots / icons / bars). Invalid dates show "—". Empty budget is an empty state, not a green remaining. Same buttons and numbers. No production deploy.

## Next

- [x] Create branch `phase-2-visual` from `phase-1-foundation`
- [x] Tokens + Manrope (everything; tabular figures for money)
- [x] Shell, sign-in, picker, dashboard, add expense, invoices, history, budget (localhost)
- [x] Strip tinted category cards / side bars / filled pills — colour on data only
- [ ] Lalit reviews localhost
- [ ] Production hosting deploy only when Lalit asks after the restyle looks right

## Phase 1 leftovers (not Phase 2 unless he asks)

- Live OAuth consent for sending invite mail from Gmail
- Unused `users/{code}` PIN folders (do not delete)
- Unused live function `generateWeeklyReport` (do not deploy functions)
- Staging has no Storage bucket (receipts missing on localhost)

## Do not do

- Change behaviour, data, auth, or calculations
- Add email/password login, “new job list”, or a Reports page because they appear in the mockup
- Paste `design/opal-track-reference.html` into the React app
- Tint card backgrounds or put category colour on chrome
- `firebase deploy` to production without `--project production` and an explicit `--only`
- Commit `.env*`, `.phase1-local.json`, or `backups/`
- Billing, Stripe, a second product

## How to talk to Lalit

Civil engineer, not a full-time programmer. Everyday language. Show localhost. Propose, then do. Small steps.
