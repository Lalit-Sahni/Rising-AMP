# Progress

## Current branch

`phase-1-foundation` (Phase 1, live). **Start Phase 2 on a new branch:** `git checkout -b phase-2-visual` from `phase-1-foundation`.

Restore tag (Phase 1 unwind): `pre-phase1-2026-08-22`

Production: `rising-amp-467702-b5` — https://rising-amp-467702-b5.web.app  
Staging: `rising-amp-staging` — localhost / `.env.local`  
`.firebaserc` default is **staging**.

## Where we are (2026-08-23 night)

**Phase 1 is closed** (Google login, two job lists, per-job invites). Lalit confirmed live works.

**Phase 2 is briefed, not started.** Visual overhaul only. Source of truth: `PHASE2.md` + `design/opal-track-redesign.html`.

Localhost still talks to staging. Do not swap env files. Do not deploy Phase 2 to production until Lalit asks.

## Next (Phase 2, one step)

- [ ] Create branch `phase-2-visual` from `phase-1-foundation`
- [ ] **Step 0:** tokens in Tailwind + CSS `:root`, load Geist + Geist Mono. No screen restyle yet. Show Lalit, wait for yes
- [ ] Shell (sidebar + header)
- [ ] Sign-in + job picker + not-invited (restyle only; Google already works)
- [ ] Dashboard (kill rainbow tiles; empty budget state; money in mono)
- [ ] Add Expense
- [ ] Invoices (no “Invalid Date” string)
- [ ] History
- [ ] Budget
- [ ] Production hosting deploy only when Lalit asks after the restyle looks right

## Phase 1 leftovers (not Phase 2 unless he asks)

- Live OAuth consent for sending invite mail from Gmail
- Unused `users/{code}` PIN folders (do not delete)
- Unused live function `generateWeeklyReport` (do not deploy functions)
- Staging has no Storage bucket (receipts missing on localhost)

## Do not do

- Change behaviour, data, auth, or calculations
- Add email/password login, “new job list”, or a Reports page because they appear in the mockup
- Paste `design/opal-track-redesign.html` into the React app
- `firebase deploy` to production without `--project production` and an explicit `--only`
- Commit `.env*`, `.phase1-local.json`, or `backups/`
- Billing, Stripe, a second product

## How to talk to Lalit

Civil engineer, not a full-time programmer. Everyday language. Show localhost. Propose, then do. Small steps.
