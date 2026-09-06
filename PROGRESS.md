# Progress

## Current branch

`phase-12-fables-upgrade` — Phase 12 front-end upgrade, **closed**, **live on production hosting** (6 Sep 2026). Record: `PHASE12.md`. Phase 11 Parts A–E remain **live on production** (5 Sep 2026). Localhost still uses `.env.local` → staging (`VITE_FIREBASE_PROJECT_ID=rising-amp-staging`).

Restore tags: `pre-phase12-2026-09-05` (this phase), `pre-phase11-2026-09-05`, `pre-phase10-2026-09-02` (before staging rules), `pre-phase10-2026-08-31`, `pre-phase9-2026-08-31`, `pre-phase8-2026-08-28`, `pre-phase7-2026-08-28`, `pre-phase6-2026-08-27`, `pre-phase1-2026-08-22`

Production: `rising-amp-467702-b5` — https://risingamp.com.au (same app as https://rising-amp-467702-b5.web.app)  
Staging: `rising-amp-staging` — localhost / `.env.local`  
`.firebaserc` default is **staging**. Git push does not deploy.

## Where we are (2026-09-06)

**Phase 12 is closed and live on production hosting (6 Sep 2026).** `firebase deploy --project production --only hosting`. No functions, Firestore rules or Storage. Branch `phase-12-fables-upgrade`. Scan a receipt on Add expense is a white `--surface` card (was `steel-900`); verified on localhost as Lalit, 72 Centenary Dr, `rgb(255, 255, 255)`. Typecheck, 254 tests, build **267.9 KB** gzip (ceiling 275). Front-end only: no rules, functions, schema or data writes. Full detail: `PHASE12.md`. Ultrareview PRs #1–#4 were closed unused; the empty-base branches are gone.

**Next:** wait for the owner to name the next phase. Cut it from `phase-12-fables-upgrade`, never from `master` or `main`. Optional leftover: force-close the home-screen app twice so the Phase 12 worker is in.

**Phase 11 Parts A–E are live on production (5 Sep 2026).** Function `maintainLedgerRollup`, Part E Firestore rules, `ledgerRollup/current` for both production jobs, and hosting (`index-BTUZ3uws.js` on https://risingamp.com.au). Brief: `PHASE11.md`. Part A: service worker cache-firsts hashed JS/CSS and network-firsts HTML. Firestore, functions and Storage are never cached in the worker. `/clear-sw` unregisters it. Part B: Firestore `persistentLocalCache` plus `onSnapshot` on the job list, expenses and invoices. IndexedDB holds the last ledger; listeners paint from disk then revalidate. Empty disk snapshots cannot wipe a boot-cached job list. Invoice numbers stay server-allocated; a manual invoice reload uses `getDocsFromServer`. Cost Plan saves stay transactions. Part C: opening a job only listens to expenses and invoices. Labour, trades, clients, suppliers, service providers, payers, progress payments, HIA contracts and bank details load on the screen that uses them. Clients are one query, not two. Part D: a write invalidates only its own TanStack Query keys (`invalidateKeys`). Saving an expense does not refetch Cost Plan, quotes or directories. Part E: `maintainLedgerRollup` rebuilds `ledgerRollup/current` from every expense, then writes that complete document in one set. Overview, Cost Plan headline spend, Budget and Jobs home counts read the rollup. History, “what needs you,” and the Cost Plan trade board still read expense rows. If they disagree, the ledger wins on Overview.

**Phone header gap fix shipped to production hosting (5 Sep 2026).** The home-screen top bar sat below the notch because a 59px standalone floor stacked on iOS `default`. Hosting only (`index-BTUZ3uws.js` / `index-KkFsMgb2.css` on https://risingamp.com.au). Force-close and reopen twice so the new worker takes over.

**Phone header colour shipped to production hosting (5 Sep 2026).** The phone top bar is `--canvas` `#F5F6F8`, the same token as `theme-color` and the status strip, so it is not a separate white slab; desktop from `md` stays `--surface`. Hosting only (`index-CRibAGMP.js` / `index-DWt6CaPQ.css` on https://risingamp.com.au). Force-close and reopen twice so the new worker takes over.

**Next is the owner’s phone:** force-close, reopen, Overview totals vs History on a known job. Production backup taken 5 Sep 2026 (`backups/production-2026-09-05T10-02-16-995Z`, 521 Firestore documents, 34 Storage files). In-agent browser was not signed in as the owner, so Overview vs History was not click-through on production. Localhost stays on staging.

Boot-cache and Jobs-list work from 2 Sep 2026 stays:

- `86e2451` — boot paints from a localStorage cache. `readBootCache` / `writeBootCache` / `clearBootCache` in `tenancy.js`, same pattern the profile already used. `App.js` now paints membership, the job list and the last open job before the first request leaves the device, then revalidates behind. Keyed by uid, cleared on sign out and on a revoked invite. Previously `<BootScreen />` was held until `listInvitedProjects` returned, which is three network waves to a US database.
- `57e12db` — `listOrgProjects` ran two counts per job sequentially inside a `for...of`; they now go out together. It also accepts an already-fetched list, killing a duplicate `listInvitedProjects` that ran every page load. `allowedJobs` flows through `OrgContext` so Jobs home paints at once and counts fill in after.
- `713e971`, `abec093` — BOQ import read the estimator's "Actual Total" column instead of "Total" (whole file imported as $0.00), and a note containing "GST" beside a real line item turned that line into a phantom grand total. Both verified against a real 22-section BOQ: $321,916.29 exactly.

Serial round trips from sign-in to a painted Jobs list: nine down to three on two jobs.

**Tested 5 Sep 2026 on localhost:3000 against staging** (`npm start`, signed in as the owner): Jobs list (72 Centenary Dr, Kelly Street), Kelly Street overview ($4,656 cost to date, 5 expenses), Cost Plan ($348,608 estimated / $4,656 spent), History (5 expenses). IndexedDB held `firestore/[DEFAULT]/rising-amp-staging/main`. Reload still showed the same spend. Part A worker test (`npm run preview:staging`) still stands: `/clear-sw` unregisters it. `npm start` is the day-to-day server and does **not** install a worker.

Part E initial JS gzip **272.7 KB**. **275 KB is the held ceiling** (moved 250 → 275 in Part B because IndexedDB persistence cannot be split out of `firebase/firestore`). Hold 275. Do not raise it because a build exceeds it. Part D was **272.6 KB**. Part C was **272.5 KB**. Part B was **270.0 KB**.

**Not done, and next:** A new phase, when the owner names it. 275 KB remains the held ceiling. Optional: phone force-close twice for the Phase 12 worker; Overview vs History on a known job.

**Geography, for context:** Firestore and Cloud Functions are `us-central1`. Production has six functions, including `maintainLedgerRollup`. Sydney to Iowa is ~200 ms per round trip against ~10 ms for `australia-southeast1`. A Firestore location is permanent, so moving it is a new project plus a live-data migration and is out of scope. Moving the functions alone would make the database-heavy ones slower. The only lever is fewer round trips and better caching.

**Run on the Mac before deploying:** `npm run typecheck`, `npm test`, `npm run test:rules`, `npm run build`. The cloud session can only run `tsc` (its `node_modules` is macOS, vitest needs the Linux rollup binary).

**Housekeeping:** `backups/boq-rows.json`, `backups/__boqRealFile.test.ts.removed`, and stale `.git/HEAD.lock.stale*` files can be deleted.

**Phase 10 Cost Plan is live on production.** Brief: `PHASE10.md`. Vision: `design/risingamp-costplan-vision.html`.

**Parts A–E are on production hosting and Firestore rules (2 Sep 2026).** A job can carry a GST-inclusive target, then optional trade amounts, quotes and an imported spreadsheet. Cost Plan is in the job sidebar even before a plan exists. Spend comes from active expenses, not paid invoices. Jobs with no plan remain unchanged except for Overview and Cost Plan empty states. Own builds (`job.kind: own`) lead with estimate against actual instead of a missing-invoice margin. TanStack Query shares the plan, quotes and org trade list. The 1,000-expense cap hides spend and progress rather than showing a partial total.

History can change an expense’s category tag (labour, trade, materials, investor, …) without rewriting the rest of the row. Cost Plan quotes can attach several files: upload goes through the existing Files path (`type: quote`, 25 MB, membership Storage), and the quote stores `fileIds`. Files can assign documents onto a live quote. A file sits on one live quote.

The rules validate membership, integer cents, quote allocations, the org trade list, job kind and estimate files. Delete of plans and quotes is denied. Archiving a cost plan can be followed by a new draft on the same `current` document. **Production hosting then Firestore rules were deployed 2 Sep 2026** after a read-only backup (`backups/production-2026-09-02T02-56-29-049Z`, 505 Firestore documents, 24 Storage files; restore dry-run parsed, not applied). Staging hosting and quote `fileIds` rules went out the same day. Storage rules were not redeployed: they did not change, and quote files already use the Phase 9 Files path. `checkEstimateImport` is live on staging and production (2 Sep 2026, deployed by name). Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport` and `readQuoteFile`. Initial JS gzip is **245.5 KB** (budget 250).

The expense read boundary now preserves labour `hours × rate` and `quantity × unitCost` totals instead of attaching a false zero `totalCents`. This keeps Cost Plan and the existing Overview cost honest.

**History receipts (2 Sep 2026):** An expense with a stored photo now has View receipt on the History row (eye and the small image icon). Edit shows Receipt on file and View receipt in the header. The photo is the stored file, not only a newly picked upload. Verified on Kelly Street staging. **Production hosting deployed 2 Sep 2026** (`firebase deploy --project production --only hosting`). No functions, Firestore rules, or Storage. Live shopfront: https://risingamp.com.au.

**File names on upload (2 Sep 2026):** Add files has a Name field per queued file before **Add to job**. Firestore stores that name. The Storage path still uses the original filename so the extension stays. **Production hosting deployed 2 Sep 2026.**

**Quote AI fill (2 Sep 2026):** Cost Plan quote sheet puts the file first. Take a photo or choose files, or tick a quote already on the job. `readQuoteFile` fills empty party/amount/date/GST/trade from a photo or PDF (same `OPENAI_API_KEY` as receipts). **Read with AI** overwrites. Uncertain fields get Check this. Word/Excel and large PDFs are not read. `readReceiptImage` stays receipt-only. Staging function first, then production function by name, then production hosting. Live shopfront: https://risingamp.com.au. Initial JS gzip **245.5 KB** (budget 250).

**Phase 9 is closed and live (31 Aug 2026).** Brief: `PHASE9.md` (closed record). Mockup: `design/risingamp-files-vision.html`.

**Production (31 Aug 2026):** `firebase deploy --project production --only hosting`, then `firestore:rules`, then `storage`. No functions. Backup first: `backups/production-2026-08-31T11-25-12-856Z` (503 Firestore documents, 22 Storage files; restore dry-run parsed, not applied). Storage rules IAM on production matches staging (`roles/datastore.viewer` and `roles/firebaserules.firestoreServiceAgent` on the Firebase Rules / Storage service accounts, project number `446685609209`). Receipts are no longer world-open. Live shopfront: https://risingamp.com.au.

**Part G shipped:** Files is a document register. One table with sortable columns (name, type, date, size), a summary bar, and multi-select to change type, archive, or add to the handover pack. Receipts are labelled “From an expense”, not dashed. Type chips are small and mobile-only; desktop filters from the type column. List/grid is a two-segment control. Copy no longer mentions folders.

**Part F shipped:** Handover pack on Files. Tick the documents (contract, variation, plan, permit and certificate on by default). Generate downloads one PDF: cover (job, address, date, builder details from the profile), contents that names missing types, then each document. Images are full-page plates. PDFs are appended with `pdf-lib`, which loads only on Generate. Word files are listed as not included. The pack is not stored. Initial JS gzip is 241.5 KB (budget 250).

**Part E shipped:** What needs you today can name a missing contract (only after other paperwork is filed), large invoices with no linked quote/variation (only after that drawer is in use, $5,000+), and Other files older than a week when upload date is known. An old certificate date is not treated as expiry. From a file you can link an expense, invoice or HIA contract; those records show the attached files. Jobs home still does not load files, so it stays quiet.

**Part D shipped:** Files is search first, then type counts with dots not filled badges, list by default and a grid toggle. Tapping a row opens the original in a viewer (rename, type, note, archive). Receipts from expenses show as a dashed Receipt row, read-only, and open the expense on History. Lists still render `thumb.jpg` only; receipts use a type icon so the original is never pulled into the list. No folders. Part G later replaced the dashed receipt border with the words “From an expense”.

**Part C shipped:** Job files upload through the existing Storage helper. Images compress to 1920px at 0.8 and get a 320px thumbnail; lists never render the original. PDFs store as-is. 25 MB, no video, real progress, retry without re-picking. Storage first, then Firestore. Files sits in the job sidebar at `/jobs/:jobId/files`.

**Staging (31 Aug 2026):** `firebase deploy --project staging --only firestore:rules,storage` so localhost Files worked first. Storage membership uses `firestore.get()`, so IAM must include `roles/firebaserules.firestoreServiceAgent` and `roles/datastore.viewer` on the Firebase Rules / Storage service accounts (staging project number `59005813044`; production `446685609209`). `thumbnailPath` rules use a full-string `matches()`, so the regex has to end in `.+` the same way `storagePath` does — without that, photos fail Firestore after Storage succeeds. Tiny probe objects under `files/…/risingamp-probe*` may still exist on staging; nobody can delete job-file objects.

**Part B shipped:** Job files are a subcollection on the job (`files/{fileId}`) with a fixed type list — no folders. Storage path is `files/{orgId}/{jobId}/{fileId}/…`. Members can read and write a valid shape; nobody can delete. 25 MB and no video, in Firestore and in Storage.

**Part A shipped:** Storage rules take org id from upload metadata instead of hardcoding Opal (old receipts without metadata still fall back to Opal). Past 1,000 expenses the app hides cost and margin rather than showing a partial total. Expenses and invoices void first (Recently deleted); permanent delete is only from that view, and only after the row is already voided. Clients, HIA contracts, progress payments, labour and trades are voided, not hard-deleted. `exceljs` loads on click, not with History.

**Phases 1–8 are closed and live.** Brief: `PHASE8.md`.

**Phase 8 shipped:** Vite + TypeScript for new files, real URLs, integer cents, server invoice numbers (`YYYY-0001`), void not delete, named collection rules (no wildcard write), org from membership, Vitest + GitHub Action. Profile leak closed on production and verified from a second account that is not on a family job. App Check client is wired; **do not enforce**. Jobs list uses `getCountFromServer`. `generateWeeklyReport` was deleted from production by name (it was a callable, unused, no log entries). Production functions are `sendJobInviteEmail`, `readReceiptImage` and `allocateInvoiceNumber`; deploy **by name**. History edit of an expense no longer resets the form on each keystroke (a default `uncertainFields={}` was a new object every render). Production hosting and Firestore rules were deployed 29 Aug 2026 (expense edit fix).

**Left on purpose:** App Check enforcement, normalising stored money fields, TanStack Query on the ledger, dismantling the remaining AppContext ledger blob, Gmail invite fallback.

**Phase 7 shipped (28 Aug 2026):** standalone portrait measured `t:0 r:0 b:34 l:0`. Top 0 because iOS reserves the status bar under `default`. Bottom 34 is the home indicator. Manifest / PNG icons skipped on purpose. Orientation not locked. No service worker.

**Phase 6 shipped (28 Aug 2026):** unreachable code cut, Tesseract gone, Quick Access box gone, `accessCode` renamed to `jobId` in code, leftover navy Receipt Viewer / Clients restyled. Hosting live on https://risingamp.com.au. Staging Storage bucket exists so localhost can upload receipts. Production Storage rules shipped with Phase 9 (31 Aug 2026). Integrity leftovers: `PHASE6-INTEGRITY.md`.

**Phase 5 shipped:** jobs as IDs, create/archive/invite/remove, clients vs suppliers, `DATABASE.md`, `readReceiptImage` on staging and production. Scanner is OpenAI only — if AI fails, show an error (no Tesseract).

**Phase 4 leftovers (not unless he asks):** Gmail invite fallback still in the client; `www.risingamp.com.au` has no matching SSL.

**Owner already has:**
- Shopfront `https://risingamp.com.au`, DNS at Crazy Domains.
- Resend sending from `invites@risingamp.com.au`.
- **Do not paste API keys into chat.**

## Paste this to start the next chat

```
Read CLAUDE.md, then PROGRESS.md, then PHASE12.md.

Phase 12 is the front-end upgrade: eleven commits on branch
phase-12-fables-upgrade, verified on localhost against staging,
NOT deployed. Restore tag pre-phase12-2026-09-05. Phase 11 Parts
A–E are live on production (5 Sep 2026). Localhost stays on
staging. Deploy nothing unless he names it; Phase 12 needs
hosting only.

Do not redo the toasts, the search palette, the tab bar, the
invoice document, the HIA rebuild, or the dead-code removal.
275 KB is the held ceiling (now 267.9 KB).

Never cache Firestore, Cloud Function or Storage responses in
the service worker. Never hard-delete user records. Never accept
a pasted API key.
```

## Remaining work

0. **Phase 12 review and hosting deploy** — owner reviews localhost and `PHASE12.md`, then names `firebase deploy --project production --only hosting`.
1. **Phone check on production** — force-close, reopen, Overview totals vs History on a known job. Hosting, function, rules and recompute are already live (5 Sep 2026).
2. Click through Cost Plan on the live shopfront (sidebar **Cost plan**, then a target, trades or an import). Localhost stays on staging. In-agent browser click-through of Overview vs History is still not done.
3. Optional leftovers (not unless he asks): App Check **enforcement**; `PHASE6-INTEGRITY.md`; live Resend invite proof then remove Gmail fallback; `www` SSL; forward `privacy@risingamp.com.au`; money-field migration; dismantle remaining AppContext ledger/directory blob.
4. Home-screen icon / `manifest.json` if he later wants a real installed-app icon.
5. Offline queue / queued writes — still its own phase. The Part A worker caches the shell only.

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
- [x] Phase 9 Part B — model + membership rules
- [x] Phase 9 Part C — upload, compress, thumbnails
- [x] Phase 9 Part D — Files screen
- [x] Phase 9 Part E — What needs you / linking
- [x] Phase 9 Part F — handover pack
- [x] Phase 9 Part G — Files as a document register
- [x] Phase 9 live — hosting, Firestore rules, Storage rules
- [x] Phase 10 Part A — target cost and Level 1 screen
- [x] Phase 10 Part B — trade amounts and expense coding
- [x] Phase 10 Part C — quotes
- [x] Phase 10 Part D — spreadsheet import
- [x] Phase 10 Part E — job kind and attention
- [x] Phase 10 staging Firestore rules (2 Sep 2026) — localhost can save a plan
- [x] Phase 10 live — production hosting and Firestore rules (2 Sep 2026)
- [x] Phase 10 `checkEstimateImport` live on staging and production (2 Sep 2026)
- [x] History receipts live on production hosting (2 Sep 2026)
- [x] File names on Add files before upload — production hosting 2 Sep 2026
- [x] Quote AI fill (`readQuoteFile`) live on staging and production 2 Sep 2026
- [x] Phase 11 Part A — app-shell service worker (production hosting 5 Sep 2026)
- [x] Phase 11 Part B — Firestore disk cache and hot-path listeners (production hosting 5 Sep 2026)
- [x] Phase 11 Part C — directories load on the screen that uses them (production hosting 5 Sep 2026)
- [x] Phase 11 Part D — invalidate only the keys a write changes (production hosting 5 Sep 2026)
- [x] Phase 11 Part E — ledger rollups (`maintainLedgerRollup`) live on production 5 Sep 2026
- [ ] Phase 11 phone — Overview totals vs History after force-close / reopen
- [x] Phase 12 — front-end upgrade on the branch (dead code, toasts, search, tab bar, Add expense, History, Invoices, Jobs home, HIA)
- [ ] Phase 12 — owner review, then production hosting

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

**Nav:** Jobs, Overview, Cost plan, Add expense, Invoices, Files, History. Clients and HIA contracts under **More**. Budget tracking retired in Phase 12. Invite/rename still on each job row (person icon / pencil). Phones get a tab bar inside a job.

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
- Staging Storage bucket exists; production Storage rules shipped with Phase 9 (31 Aug 2026)

## Design files

- `design/risingamp-costplan-vision.html` — Phase 10 Cost Plan vision
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
