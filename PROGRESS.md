# Progress

## Current branch

`phase-3-vision` (from `phase-2-visual`). **Phase 2 hosting is live** on production. **Phase 3 Step 0 is parked** — mockup and brief are on this branch; no `src/` changes. Waiting for a yes on the mockup-vs-live table.

Restore tag (Phase 1 unwind): `pre-phase1-2026-08-22`

Production: `rising-amp-467702-b5` — https://rising-amp-467702-b5.web.app  
Staging: `rising-amp-staging` — localhost / `.env.local`  
`.firebaserc` default is **staging**. Git push does not deploy. Live hosting changes only on `firebase deploy --project production --only hosting`.

## Where we are (2026-08-23)

**Phase 1 and Phase 2 are closed and live.** Phase 3 is the vision in `design/risingamp-vision.html`: same data, lead with whether the job is making money, then what needs you today.

## Paste this to start the next chat

```
Read CLAUDE.md, then PROGRESS.md, then PHASE3.md. Open design/risingamp-vision.html. Step 0 is done on phase-3-vision. Wait for a yes on the mockup-vs-live table. Do not change src/ until then.
```

## Next

- [x] Phase 1 live
- [x] Phase 2 restyle live (Manrope, Palette 1)
- [x] Phase 3 Step 0 — branch `phase-3-vision`, mockup parked, no `src/` changes, show mockup-vs-live, wait
- [ ] Wait for Lalit to approve the mockup-vs-live table (what is in, what is out)
- [ ] After yes: job overview verdict + “what needs you” (display only)
- [ ] After yes: capture “check this” on existing OCR
- [ ] Jobs portfolio / New job / rename to RisingAMP only if Lalit says so in so many words
- [ ] Do not deploy Cloud Functions
- [ ] Do not write to production Firestore or Storage unless he asks after a backup
- [ ] Production hosting deploy only when he asks after Phase 3 looks right

## Phase 1 leftovers (not unless he asks)

- Live OAuth consent for sending invite mail from Gmail
- Unused `users/{code}` PIN folders (do not delete)
- Unused live function `generateWeeklyReport` (do not deploy functions)
- Staging has no Storage bucket (receipts missing on localhost)

## Design files

- `design/risingamp-vision.html` — Phase 3 vision (current brief)
- `design/opal-track-reference.html` — Phase 2 look (what is live now)
- `design/opal-track-redesign.html` — earlier Geist concept, ignore

## Do not do

- Change behaviour, data, auth, or calculations unless `PHASE3.md` and Lalit both say yes
- Add “New job” or rename the live app to RisingAMP because the mockup shows it
- Paste any design HTML into the React app
- Tint card backgrounds or put category colour on chrome
- `firebase deploy` without `--project production` and an explicit `--only`
- Commit `.env*`, `.phase1-local.json`, or `backups/`
- Billing, Stripe, a second product

## How to talk to Lalit

Civil engineer, not a full-time programmer. Everyday language. Show localhost / live. Propose, then do. Small steps.
