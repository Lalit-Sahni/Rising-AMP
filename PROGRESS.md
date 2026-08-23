# Progress

## Current branch

`phase-4-domain-email` (from `phase-3-vision`). Phase 3 hosting is live on production (deployed 2026-08-23): hosting + Firestore `profiles/` rules + Storage avatar rules. Email/password is on for production Auth. Functions were **not** deployed yet. Localhost still uses `.env.local` → staging.

Restore tag (Phase 1 unwind): `pre-phase1-2026-08-22`

Production: `rising-amp-467702-b5` — https://rising-amp-467702-b5.web.app  
Staging: `rising-amp-staging` — localhost / `.env.local` (`REACT_APP_FIREBASE_PROJECT_ID=rising-amp-staging`)  
`.firebaserc` default is **staging**. Git push does not deploy. Live hosting changes only on `firebase deploy --project production --only hosting`.

## Where we are (2026-08-24)

**Phase 1, 2, 3 are closed.** Phase 4 is in progress on `phase-4-domain-email`.

**Done:**
- Task 1 — `/privacy` and `/terms` live on production hosting.
- Task 2 — `sendJobInviteEmail` is live on **staging and production** (named function only; leftover `generateWeeklyReport` is still there). Owner proved staging. Live invites try Resend first (`invites@risingamp.com.au`), Gmail only if that send fails. Task 3 (remove Gmail entirely) still waiting on a real live invite.
- Task 4 — `https://risingamp.com.au` is serving the app. Google sign-in authorized domains include `risingamp.com.au`. Login popup **authDomain** is `risingamp.com.au`. Owner added `https://risingamp.com.au/__/auth/handler` on the Google OAuth client; Google login on the shopfront works (2026-08-24). `.web.app` is the same locked app, not a back door.
- Profile setup loop — **live on production hosting 2026-08-24.**

**Profile patch (live hosting 2026-08-24):** do not create empty profile stubs on sign-in; copy a finished profile onto a new login uid for the same email; remember the finished profile on the device; do not send the person back through setup if that record exists.

**Owner already has:**
- Domain `risingamp.com.au`, DNS at Crazy Domains.
- Resend account + API key for that domain. Confirm “Verified” in Resend before the first send.
- **Do not paste the Resend API key into chat.** Set it at the masked prompt (commands below).

Chose a **hand-written callable Cloud Function**, not the Firebase Trigger Email extension: the invite already happens in the app after writing membership, we already have the HTML template, and Resend’s HTTP API needs no extra Firestore `mail` collection and no extra npm package.

## Paste this to start the next chat

```
Read CLAUDE.md, then PROGRESS.md, then PHASE4.md. Open design/risingamp-vision.html. Work is on branch phase-4-domain-email (from phase-3-vision). Domain is risingamp.com.au, DNS at Crazy Domains, Resend account already set up. Localhost stays on staging. Never accept a pasted API key — have the owner set Firebase secrets himself. Do not deploy Cloud Functions beyond what PHASE4.md explicitly asks for.

Staging invite is proven. Profile setup loop is live. `sendJobInviteEmail` is now on production too (named function only). Do not deploy a full functions set to production (that would delete generateWeeklyReport). Do not remove the Gmail fallback until a real live invite from Resend lands. Shopfront URL: https://risingamp.com.au (same app as .web.app).
```

## Remaining work

1. Owner sends one invite from the **live** site and confirms it arrived from `invites@risingamp.com.au` with no Gmail popup. Then Task 3 (remove Gmail send) only if he asks.
2. Optional: add `www.risingamp.com.au` as a Firebase Hosting custom domain if people type www (apex already works; Auth already allows www).
3. Optional: at Crazy Domains, forward `privacy@risingamp.com.au` to your inbox so legal-page contact mail is received.

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
- [x] Production hosting deploy (2026-08-23) plus `profiles/` Firestore rules and avatar Storage rules
- [x] Enable email/password on production Auth
- [x] Phase 4 Task 1 — `/privacy` and `/terms` pages, real links from sign-in/sign-up (live on production hosting 2026-08-23)
- [x] Phase 4 Task 4 — `risingamp.com.au` on Firebase Hosting (apex live; www SSL not added)
- [x] Phase 4 Task 2 — `RESEND_API_KEY` set; `sendJobInviteEmail` deployed to staging only
- [x] Phase 4 Task 2 — prove a real invite arrives from localhost (From: invites@risingamp.com.au, no Gmail popup)
- [x] Profile setup no longer repeats after close / new device (live hosting 2026-08-24)
- [x] Phase 4 Task 2b — deploy `sendJobInviteEmail` to production (named function only, 2026-08-24)
- [ ] Phase 4 Task 2c — prove a real invite from the live site (Resend, no Gmail popup)
- [ ] Phase 4 Task 3 — remove `gmail.send` OAuth popup from invites (only after a live Resend invite)
- [ ] Do not deploy Cloud Functions beyond the single Phase 4 invite-email function
- [ ] Do not write to production job data unless he asks after a backup

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
- Invite mail is the professional HTML from `design/risingamp-signin-email.html` (dark header, job card, orange CTA). The app tries Resend (`invites@risingamp.com.au` via `sendJobInviteEmail`) first; if that function is not deployed it falls back to the inviter’s Google send path. New-sign-in notices are skipped on staging; on live they send only if a Gmail token is already present (no popup on login).
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

- ~~Live OAuth consent for sending invite mail from Gmail~~ — **superseded by Phase 4.** Owner decided to move invite email off `gmail.send` entirely onto Resend instead of pursuing Google verification for that scope. Google sign-in itself needs no verification and is untouched.
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
