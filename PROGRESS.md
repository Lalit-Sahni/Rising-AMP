# Progress

## Current branch

`phase-9-job-files` — Phase 9 **Part D done**. Localhost still uses `.env.local` → staging (`VITE_FIREBASE_PROJECT_ID=rising-amp-staging`).

Restore tags: `pre-phase9-2026-08-31` (this phase), `pre-phase8-2026-08-28`, `pre-phase7-2026-08-28`, `pre-phase6-2026-08-27`, `pre-phase1-2026-08-22`

Production: `rising-amp-467702-b5` — https://risingamp.com.au (same app as https://rising-amp-467702-b5.web.app)  
Staging: `rising-amp-staging` — localhost / `.env.local`  
`.firebaserc` default is **staging**. Git push does not deploy.

## Where we are (2026-08-31)

**Phase 9 Part D is on this branch.** Brief: `PHASE9.md`. Mockup: `design/risingamp-files-vision.html`. One part per session.

**Part D shipped (not hosted):** Files is search first, then type counts with dots not filled badges, list by default and a grid toggle. Tapping a row opens the original in a viewer (rename, type, note, archive). Receipts from expenses show as a dashed Receipt row, read-only, and open the expense on History. Lists still render `thumb.jpg` only; receipts use a type icon so the original is never pulled into the list. No folders.

**Part C shipped (staging rules live, hosting not):** Job files upload through the existing Storage helper. Images compress to 1920px at 0.8 and get a 320px thumbnail; lists never render the original. PDFs store as-is. 25 MB, no video, real progress, retry without re-picking. Storage first, then Firestore. Files sits in the job sidebar at `/jobs/:jobId/files`.

**Staging so localhost Files works (31 Aug 2026, not production):** `firebase deploy --project staging --only firestore:rules,storage`. Storage membership uses `firestore.get()`, so staging IAM must include `roles/firebaserules.firestoreServiceAgent` and `roles/datastore.viewer` on the Firebase Rules / Storage service accounts (project number `59005813044`). `thumbnailPath` rules use a full-string `matches()`, so the regex has to end in `.+` the same way `storagePath` does — without that, photos fail Firestore after Storage succeeds. Tiny probe objects under `files/…/risingamp-probe*` may still exist; nobody can delete job-file objects.

**Part B shipped (staging rules live, production not):** Job files are a subcollection on the job (`files/{fileId}`) with a fixed type list — no folders. Storage path is `files/{orgId}/{jobId}/{fileId}/…`. Members can read and write a valid shape; nobody can delete. 25 MB and no video, in Firestore and in Storage.

**Part A shipped (not deployed):** Storage rules take org id from upload metadata instead of hardcoding Opal (old receipts without metadata still fall back to Opal). Past 1,000 expenses the app hides cost and margin rather than showing a partial total. Expenses and invoices void first (Recently deleted); permanent delete is only from that view, and only after the row is already voided. Clients, HIA contracts, progress payments, labour and trades are voided, not hard-deleted. `exceljs` loads on click, not with History.

**Phases 1–8 are closed and live.** Brief: `PHASE8.md`.

**Phase 8 shipped:** Vite + TypeScript for new files, real URLs, integer cents, server invoice numbers (`YYYY-0001`), void not delete, named collection rules (no wildcard write), org from membership, Vitest + GitHub Action. Profile leak closed on production and verified from a second account that is not on a family job. App Check client is wired; **do not enforce**. Jobs list uses `getCountFromServer`. `generateWeeklyReport` was deleted from production by name (it was a callable, unused, no log entries). Production functions are `sendJobInviteEmail`, `readReceiptImage` and `allocateInvoiceNumber`; deploy **by name**. History edit of an expense no longer resets the form on each keystroke (a default `uncertainFields={}` was a new object every render). Production hosting and Firestore rules were deployed 29 Aug 2026 (expense edit fix).

**Left on purpose:** App Check enforcement, ledger rollup documents, normalising stored money fields, TanStack Query on the ledger, dismantling the remaining AppContext ledger blob, Gmail invite fallback, production Storage rules.

**Phase 7 shipped (28 Aug 2026):** standalone portrait measured `t:0 r:0 b:34 l:0`. Top 0 because iOS reserves the status bar under `default`. Bottom 34 is the home indicator. Manifest / PNG icons skipped on purpose. Orientation not locked. No service worker.

**Phase 6 shipped (28 Aug 2026):** unreachable code cut, Tesseract gone, Quick Access box gone, `accessCode` renamed to `jobId` in code, leftover navy Receipt Viewer / Clients restyled. Hosting live on https://risingamp.com.au. Staging Storage bucket exists so localhost can upload receipts. Production Storage rules still not deployed. Integrity leftovers: `PHASE6-INTEGRITY.md`.

**Phase 5 shipped:** jobs as IDs, create/archive/invite/remove, clients vs suppliers, `DATABASE.md`, `readReceiptImage` on staging and production. Scanner is OpenAI only — if AI fails, show an error (no Tesseract).

**Phase 4 leftovers (not unless he asks):** Gmail invite fallback still in the client; `www.risingamp.com.au` has no matching SSL.

**Owner already has:**
- Shopfront `https://risingamp.com.au`, DNS at Crazy Domains.
- Resend sending from `invites@risingamp.com.au`.
- **Do not paste API keys into chat.**

## Paste this to start the next chat

```
Read CLAUDE.md, then PROGRESS.md, then PHASE9.md. Open design/risingamp-files-vision.html. Phase 9 Part D is on phase-9-job-files. Phases 1–8 are live. Shopfront is https://risingamp.com.au. Localhost stays on staging. Restore tags: pre-phase9-2026-08-31, pre-phase8-2026-08-28, pre-phase7-2026-08-28, pre-phase6-2026-08-27, pre-phase1-2026-08-22. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named.
```

## Remaining work

1. Phase 9 **Part E** — file gaps in What needs you today, and linking files to expenses/invoices. Then F (handover pack) later. Brief: `PHASE9.md`.
2. Optional leftovers (not unless he asks): App Check **enforcement**; `PHASE6-INTEGRITY.md`; live Resend invite proof then remove Gmail fallback; `www` SSL; forward `privacy@risingamp.com.au`; production Storage rules (owner yes); ledger rollups; money-field migration; dismantle remaining AppContext ledger/directory blob.
3. Home-screen icon / `manifest.json` if he later wants a real installed-app icon.
4. Offline / service worker — still its own phase.

## Next

- [x] Phase 1 live
- [x] Phase 2 restyle live (Manrope, Palette 1)
- [x] Phase 3 vision live (Jobs home, verdict, capture, profiles)
- [x] Phase 4 — legal pages, Resend invites, shopfront `risingamp.com.au`, Google login on that domain
- [x] Phase 5 — jobs/members, directory split, `DATABASE.md`, OpenAI via function
- [x] Phase 6 — legacy cut live (`PHASE6.md`)
- [x] Phase 7 — app feel on a phone (`PHASE7.md`); hosting live; no new icon
- [x] Phase 8 — foundations live (`PHASE8.md`); leak closed; Vite; routes; cents; server invoice numbers
- [x] Phase 9 Part A — Phase 8 leftovers (storage org, expense cap, void not delete, lazy exceljs)
- [x] Phase 9 Part C — upload, compress, thumbnails
- [x] Phase 9 Part D — Files screen
- [ ] Phase 9 Part E — What needs you / linking
- [ ] Phase 9 Part F — handover pack

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

**Nav:** Jobs, Add expense, Invoices, Files, History. Budget tracking, HIA contracts, and Clients stay under **More**. Invite/rename still on each job row (person icon / pencil).

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
- Staging Storage bucket exists; production Storage rules still not deployed

## Design files

- `design/risingamp-files-vision.html` — Phase 9 Job Files vision
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
