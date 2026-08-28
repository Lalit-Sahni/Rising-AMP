# Progress

## Current branch

`phase-8-technical-revamp` — Phase 8 Part A on the branch. Phases 1–7 are live on hosting. Localhost still uses `.env.local` → staging.

Restore tags: `pre-phase8-2026-08-28` (this phase), `pre-phase7-2026-08-28` (Phase 7 unwind), `pre-phase6-2026-08-27` (Phase 6 unwind), `pre-phase1-2026-08-22` (Phase 1 unwind)

Production: `rising-amp-467702-b5` — https://risingamp.com.au (same app as https://rising-amp-467702-b5.web.app)  
Staging: `rising-amp-staging` — localhost / `.env.local` (`REACT_APP_FIREBASE_PROJECT_ID=rising-amp-staging`)  
`.firebaserc` default is **staging**. Git push does not deploy. Live hosting changes only on `firebase deploy --project production --only hosting`. Phase 8 Part A production rules: `firebase deploy --project production --only firestore:rules` after he names it.

## Where we are (2026-08-28)

**Phases 1–7 are closed and live.** Phase 8 is **foundations**: security, build, money, routes. Brief: `PHASE8.md`.

**Phase 8 Part A (on the branch, not production):**
- Private `profiles/{uid}` — owner (or same email on another uid) only. A stranger who signs up cannot read mobile, ABN, business name or address.
- `publicProfiles/{email}` — display name and photo only. Signed-in get, no listing, no private fields.
- Login no longer scans the whole `profiles` collection.
- Unused Google Analytics removed (`getAnalytics` was called and never used).
- App Check client is wired for reCAPTCHA Enterprise but **does not run** until `REACT_APP_FIREBASE_APPCHECK_SITE_KEY` is set. **Do not enforce** until the console shows clean traffic.
- Production `console.log` / `debug` / `info` are muted.
- Prove with `npm run test:rules` (Firestore emulator).

**Phase 7 shipped (28 Aug 2026):** standalone portrait measured `t:0 r:0 b:34 l:0`. Top 0 because iOS reserves the status bar under `default`. Bottom 34 is the home indicator. Manifest / PNG icons skipped on purpose. Orientation not locked. No service worker.

**Phase 6 shipped (28 Aug 2026):** unreachable code cut, Tesseract gone, Quick Access box gone, `accessCode` renamed to `jobId` in code, leftover navy Receipt Viewer / Clients restyled. Hosting live on https://risingamp.com.au. Staging Storage bucket exists so localhost can upload receipts. Production Storage rules still not deployed. Integrity leftovers: `PHASE6-INTEGRITY.md`.

**Phase 5 shipped:** jobs as IDs, create/archive/invite/remove, clients vs suppliers, `DATABASE.md`, `readReceiptImage` on staging and production. Scanner is OpenAI only — if AI fails, show an error (no Tesseract).

**Phase 4 leftovers (not Phase 8 unless he asks):** Gmail invite fallback still in the client; `www.risingamp.com.au` has no matching SSL; leftover `generateWeeklyReport` on production.

**Owner already has:**
- Shopfront `https://risingamp.com.au`, DNS at Crazy Domains.
- Resend sending from `invites@risingamp.com.au`.
- **Do not paste API keys into chat.**

## Paste this to start the next chat

```
Read CLAUDE.md, then PROGRESS.md, then PHASE8.md. Branch is phase-8-technical-revamp. Phases 1–7 are live. Phase 8 Part A is on the branch; production profile rules are not deployed until named. Shopfront is https://risingamp.com.au. Localhost stays on staging. Restore tags: pre-phase8-2026-08-28, pre-phase7-2026-08-28, pre-phase6-2026-08-27, pre-phase1-2026-08-22. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named.
```

## Remaining work

1. **Phase 8 Part A close-out:** deploy Firestore rules to staging (localhost), then production when he names `--only firestore:rules`. Create the reCAPTCHA Enterprise site key, put it in gitignored env, watch App Check traffic, enforce later.
2. Phase 8 Part B — Vite + TypeScript for new files. Then C, D, E, … in `PHASE8.md`.
3. Optional leftovers (not unless he asks): `PHASE6-INTEGRITY.md`; live Resend invite proof then remove Gmail fallback; `www` SSL; forward `privacy@risingamp.com.au`; production Storage rules (owner yes).
4. Home-screen icon / `manifest.json` if he later wants a real installed-app icon.
5. Offline / service worker — still its own phase.

## Next

- [x] Phase 1 live
- [x] Phase 2 restyle live (Manrope, Palette 1)
- [x] Phase 3 vision live (Jobs home, verdict, capture, profiles)
- [x] Phase 4 — legal pages, Resend invites, shopfront `risingamp.com.au`, Google login on that domain
- [x] Phase 5 — jobs/members, directory split, `DATABASE.md`, OpenAI via function
- [x] Phase 6 — legacy cut live (`PHASE6.md`)
- [x] Phase 7 — app feel on a phone (`PHASE7.md`); hosting live; no new icon
- [ ] Phase 8 — Part A on the branch; production rules not deployed; Parts B–L still to do

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
- Profiles stored at `profiles/{uid}` (private). Job people chips read `publicProfiles/{email}` (name and photo only).
- Staging Firestore rules: owner-only private profile read; any signed-in get of a public card, no listing. Production still on the old open profile read until he names a rules deploy.
- Invite mail is the professional HTML from `design/risingamp-signin-email.html` (dark header, job card, orange CTA). The app tries Resend (`invites@risingamp.com.au` via `sendJobInviteEmail`) first; if that function is not deployed it falls back to the inviter’s Google send path. New-sign-in notices are skipped on staging; on live they send only if a Gmail token is already present (no popup on login).
- Widget stack on auth uses fictional jobs (Ridge Road Pavilion, Harbour Kitchen), not Opal site numbers.
- Boot screen is the RisingAMP mark on canvas. The old “Choose a job list” card does not flash before Jobs.

## What was skipped, and why

- **New job create** — shipped in Phase 5 Part B (owner-only).
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
- Add a working New job write without an explicit yes (create-job is live; do not invent extra writes)
- Commit `.env*`, `.phase1-local.json`, or `backups/`
- Billing, Stripe, a second product

## How to talk to Lalit

Civil engineer, not a full-time programmer. Everyday language. Show localhost / live. Propose, then do. Small steps.
