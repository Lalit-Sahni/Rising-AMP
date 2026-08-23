# Progress

## Current branch

`phase-3-vision` (from `phase-2-visual`). **Phase 2 hosting is still what is live** on production. **Phase 3 UI is on this branch, localhost → staging only.** Nothing was deployed to production. No production Firestore/Storage writes. Functions were not deployed.

Restore tag (Phase 1 unwind): `pre-phase1-2026-08-22`

Production: `rising-amp-467702-b5` — https://rising-amp-467702-b5.web.app  
Staging: `rising-amp-staging` — localhost / `.env.local` (`REACT_APP_FIREBASE_PROJECT_ID=rising-amp-staging`)  
`.firebaserc` default is **staging**. Git push does not deploy. Live hosting changes only on `firebase deploy --project production --only hosting`.

## Where we are (2026-08-23)

**Phase 1 and Phase 2 are closed and live.** Phase 3 vision from `design/risingamp-vision.html` is implemented in the React app on localhost/staging after an explicit GO from Lalit.

## Paste this to start the next chat

```
Read CLAUDE.md, then PROGRESS.md, then PHASE3.md. Open design/risingamp-vision.html. Phase 3 UI is on localhost/staging on phase-3-vision. Do not deploy production until Lalit asks.
```

## Next

- [x] Phase 1 live
- [x] Phase 2 restyle live (Manrope, Palette 1)
- [x] Phase 3 Step 0 — branch + mockup
- [x] Lalit GO to match the mockup on localhost/staging
- [x] Derived metrics module (read-only)
- [x] Job overview verdict, stats, what needs you, cash, categories, recent
- [x] Jobs home (all invited jobs, portfolio strip)
- [x] RisingAMP naming in the UI
- [x] Capture “Check this” when OCR did not actually read date/amount (and labour hours, which the pipeline invents as 8)
- [x] Sign in / sign up (Google + any email), profile setup, professional invite HTML
- [x] Stop the old “Choose a job list” card flashing before Jobs
- [ ] Production hosting deploy only when he asks after Phase 3 looks right
- [ ] Enable email/password on **production** Auth only when he asks (staging already on)
- [ ] Do not deploy Cloud Functions
- [ ] Do not write to production Firestore or Storage unless he asks after a backup

## What shipped (localhost / staging)

Honest numbers, display only, no new stored verdict field, no document rewrites.

**Margin**
- Paid figure = sum of invoice `total` where `status === 'paid'`
- Cost to date = sum of expense totals (`total` / `amount` / `cost` / labour `hours×rate` / `quantity×unitCost`)
- Margin $ = paid − cost
- Margin % = margin / paid, only when paid > 0
- If there are no paid invoices: verdict **Getting started**, margin shown as **—** (never $0 pretending to be a result)
- **Margin at risk** when paid > 0 and margin % < 8 (including losses)
- **On track** otherwise
- “Contract” on the overview is that same paid-invoice total, labelled honestly in the subtitle (not an HIA contract value)

**What needs you today** (read-only links; never edits data)
- Invoices with no usable `invoiceDate`
- Unpaid invoices with a real `dueDate` already past
- Expenses with no `receiptImageUrl` / `receiptImagePath`
- Expenses with no `category` and no `tradeName`
- Unreviewed expenses only if some expense already has `reviewed` true/false (otherwise the field is unused and would flag everything)
- Category spend up ≥ 15% vs last month only if that category has at least two **dated** expenses in each month (`expense.date` only; created-at timestamp is not used for this check)
- “This month / week / quarter” spend uses form `date` when valid, then `timestamp` (same rule as History). Rows with neither are left out, not guessed.

**Jobs home** lists every invited job, rolls those metrics up. Combined margin only includes jobs that have a paid-invoice figure.

**Nav:** Jobs, Add expense, Invoices, History. Budget tracking, HIA contracts, and Clients stay under **More**. Invite/rename still on each job row (person icon / pencil).

**Auth (localhost / staging)**
- Sign in and sign up match `design/risingamp-auth.html` (Google or email + password). Any email domain.
- Not invite-only for using the app. Family jobs still only appear if that email is on the job.
- First visit (and existing users without a profile) get **Set up your account**: name, role, mobile, business, ABN, address, optional photo.
- Profiles stored at `profiles/{uid}`. Staging Firestore rules allow a signed-in user to write their own profile.
- Job overview shows people on the job from those profiles.
- Invite mail is the professional HTML from `design/risingamp-signin-email.html` (dark header, job card, orange CTA). Staging can only send if the inviter allows Gmail send; there is no `security@risingamp.app` yet. Live job invites use that same HTML through the inviter’s Google send path. New-sign-in notices are skipped on staging; on live they send only if a Gmail token is already present (no popup on login).
- Widget stack on auth uses fictional jobs (Ridge Road Pavilion, Harbour Kitchen), not Opal site numbers.
- Boot screen is the RisingAMP mark on canvas. The old “Choose a job list” card does not flash before Jobs.

## What was skipped, and why

- **New job create** — would write org/project docs, invites, storage keys. Owner still creates lists by hand. The jobs list says so instead of a fake button that writes.
- **HIA `totalAmount` as the contract figure** — live budget already used paid invoice `total`s. HIA totals were not substituted.
- **Decorative margin sparkline** — would be made-up ink.
- **Schema / auto-fix of bad dates** — missing dates are listed for the user to fix.
- **Production hosting, functions, Firestore, Storage** — not asked.
- **Staging Storage** — still no bucket; missing receipt images on localhost are expected. Localhost was not pointed at the production bucket.

OCR “Check this” **was** implemented, but only from real signals: missing/invalid extracted date or amount, scanner warnings that mention those fields, and labour hours (the mapper always writes `8`). Overall model “confidence” is **not** used, and the old silent default of 85 was removed. Save behaviour is unchanged: the user still confirms in the existing expense form.

## Phase 1 leftovers (not unless he asks)

- Live OAuth consent for sending invite mail from Gmail
- Unused `users/{code}` PIN folders (do not delete)
- Unused live function `generateWeeklyReport` (do not deploy functions)
- Staging has no Storage bucket (receipts missing on localhost)

## Design files

- `design/risingamp-vision.html` — Phase 3 vision (look source)
- `design/opal-track-reference.html` — Phase 2 look (tokens)
- `design/opal-track-redesign.html` — earlier Geist concept, ignore

## Do not do

- `firebase deploy` without `--project production` and an explicit `--only`, and only when Lalit asks
- Point localhost at production to make receipts appear
- Add a working New job write
- Commit `.env*`, `.phase1-local.json`, or `backups/`
- Billing, Stripe, a second product

## How to talk to Lalit

Civil engineer, not a full-time programmer. Everyday language. Show localhost / live. Propose, then do. Small steps.
