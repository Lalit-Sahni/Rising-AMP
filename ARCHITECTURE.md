# Rising AMP — Architecture (Phase 10 Part A, 2026-08-31)

This describes the **branch app**. Phase records: `PLAN.md` through `PHASE10.md`. Production remains Phase 9 until an explicit deploy.

Firebase project (production): `rising-amp-467702-b5`  
Live URL: https://risingamp.com.au (same app as https://rising-amp-467702-b5.web.app)  
Staging (localhost): `rising-amp-staging`  
Working branch: `phase-10-cost-plan`. Never commit to `master` / `main`.
App name in the sidebar: “RisingAMP”. Look: Manrope, Palette 1, category colour as data ink only.

---

## 1. Stack

| Layer | What it is |
|--------|------------|
| UI | React 18, Vite 6, Tailwind. TypeScript `allowJs` + `strict`. New files are TypeScript. |
| Routing | `react-router-dom`. Job id lives in the URL: `/jobs/:jobId`. |
| Money | Integer cents in `src/money.ts`. Parse at the Firestore / form boundary. Stored documents stay mixed until a later migration. |
| Server state | TanStack Query is provided. Most ledger fetches still run in `AppContext` on mount. |
| Backend | Firebase: Auth (Google or email/password), Firestore, Storage, Hosting, Cloud Functions. Analytics removed. App Check client is wired but **not enforced**. |
| Functions | Node 22. Live: `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`. Deploy functions **by name**. |
| OCR | OpenAI Vision via Cloud Function `readReceiptImage`. If that fails, show an error. |
| PWA | Standalone meta tags + safe-area CSS. No `manifest.json`. No service worker. |

Entry: `index.html` → `src/index.js` → `src/App.js`.

Localhost must load `.env.local` (staging). Production builds must load `.env.production.local`. Do not swap them.

**Initial JS budget:** 250 KB gzipped, enforced in `vite.config.js`. Phase 10 Part A branch: **246.1 KB** initial gzip (Phase 9 production baseline: 241.5 KB). `exceljs`, `jspdf`/`html2canvas` and `pdf-lib` load on click. Job-file helpers are imported from `src/firebase/jobFiles.ts`, not the `src/data` barrel, so they stay off the first load. Cost Plan loads its Firestore module dynamically. See `build/stats.html` after `npm run build`.

---

## 2. Routes

Wired in `src/components/MainContent.js`. Map: `src/navigation.ts`.

| Path | File |
|------|------|
| `/` | `JobsHomePage.js` |
| `/jobs/:jobId` | `DashboardPage.js` |
| `/jobs/:jobId/expenses/new` | `AddExpensePage.js` |
| `/jobs/:jobId/invoices` | `InvoiceManagementPage.jsx` |
| `/jobs/:jobId/history` | `HistoryPage.js` |
| `/jobs/:jobId/files` | `FilesPage.tsx` |
| `/jobs/:jobId/cost-plan` | `CostPlanPage.tsx` |
| `/jobs/:jobId/budget` | `BudgetTrackingPage.js` |
| `/jobs/:jobId/contracts` | `HIAContractPage.jsx` |
| `/clients` | `ClientManagerPage.jsx` |
| `/profile` | `ProfilePage.js` |
| `/privacy` `/terms` | static HTML via `firebase.json` rewrites |
| anything else | `NotFoundPage.jsx` |

The URL is the source of truth for the open job. `localStorage` is a cold-start fallback only.

Login (outside those routes): `LoginScreen.jsx`, `ProfileSetupScreen.jsx`, `AskForAccessScreen.jsx` when the signed-in email is on no organisation. While auth loads: `BootScreen.jsx`.

---

## 3. Access model

Google or email/password via Firebase Auth. After sign-in:

1. If the profile is incomplete, show **Set up your account**. Saved at `profiles/{uid}`.
2. Organisation is resolved from membership (`invitedEmails` query), not from a hardcoded constant. Opal (`opal-ss-constructions`) is preferred when the user is on it.
3. A signed-in person with no org sees **Ask us for access**.
4. Jobs home lists only projects where `invitedEmails` contains that email.
5. Tracker reads/writes `organizations/{orgId}/projects/{projectId}/…`. Receipt Storage still uses the legacy workspace id (`storageKey`) so live photos keep working.

Invite: owner taps the person icon on a job card. Invite mail is Resend from `invites@risingamp.com.au` via `sendJobInviteEmail`. Gmail fallback remains until the owner asks to remove it.

Old PIN trees `users/{accessCode}/…` still exist. The live app does not use them. Rules deny all reads/writes. Do not delete them unless asked.

---

## 4. Where auth is enforced

`firestore.rules`:

- `users/{accessCode}/**` — deny (legacy PIN copies kept, not world-open).
- `profiles/{uid}` — owner of that uid can read/write; same-email read for the dual-uid login case; delete denied. **Not** any-signed-in read.
- `publicProfiles/{email}` — signed-in get of display name + photo; list denied; owner write of those fields only.
- `organizations/{orgId}` — signed-in email must be in `invitedEmails`.
- `organizations/{orgId}/projects/{projectId}` — signed-in email must be in that project’s `invitedEmails`. List queries use `resource.data.invitedEmails` so they match `array-contains`. Owner-only: create job, archive, invite, remove person. Delete job is denied.
- Project subcollections use a `get()` of the parent project’s `invitedEmails`.
- `costPlan/current` — members can read and write a valid target plan; audit fields stay fixed and delete is denied. These Phase 10 rules are branch-only until a named deploy.

`storage.rules` in the repo: receipts require sign-in and job membership (or a known legacy PIN folder). Production Storage rules were **not** deployed on 27 Aug 2026 (hosting + Firestore only). See `DATABASE.md`.

---

## 5. How data is scoped

One organisation is live: Opal SS Constructions (`opal-ss-constructions`). A second org `phase8-isolation` exists on **staging only** so we can prove a member of org B cannot read org A. Production isolation org is not created unless named.

The dashboard is **one job at a time**. The job id is in the URL. `localStorage` restores it on a cold start if the URL has none.

---

## 6. Firestore layout (live)

```
organizations/{orgId}
  invitedEmails, ownerEmail, name
  counters/invoices            # year + next sequence; written by allocateInvoiceNumber
  projects/{projectId}
    expenses, invoices, files, costPlan, clients, labour, trades, …
profiles/{uid}              # private: name, mobile, ABN, address, photo
publicProfiles/{email}      # display name + photo only
users/{accessCode}          # leftover copies, unused by the app
```

Project document fields include `name`, `invitedEmails`, `legacyWorkspaceId`, `orgId`.

`costPlan/current` is optional. Part A stores one GST-inclusive target in integer cents with a baseline date and `draft | locked | archived` lifecycle. A job with no document has no Cost Plan nav item. The one plan read is shared through TanStack Query between Sidebar, Overview and the lazy Cost Plan route; it is not added to AppContext.

---

## 7. Storage layout

| Path | What |
|------|------|
| `receipts/{jobId}/{expenseId}/…` | Expense receipt images. `customMetadata.orgId` is set on new uploads so rules can resolve membership without hardcoding the org. Objects uploaded before Phase 9 have no metadata and fall back to Opal. |
| `files/{orgId}/{jobId}/{fileId}/…` | Job files. Org is in the path. Members only. Delete denied. 25 MB, images/PDFs/common documents, no video. Lists render `thumb.jpg`, never the original. |
| `siteLogs/{legacyWorkspaceId}/…` | Old Site Log photos (unused) |
| `reports/{legacyWorkspaceId}/…` | Old Weekly Report files (unused) |

Staging has a Storage bucket so localhost can upload receipts. Production Storage rules in the repo are tighter than what may still be live; they were **not** deployed unless the owner named Storage. Do not change the receipt path until Storage rules are deployed — a four-segment path would miss the live matcher.

---

## 8. Cloud Functions

Production functions are `sendJobInviteEmail`, `readReceiptImage` and `allocateInvoiceNumber` (us-central1, callable). Deploy **by name**:

```
firebase deploy --project rising-amp-staging --only functions:allocateInvoiceNumber
firebase deploy --project production --only functions:allocateInvoiceNumber
```

Deploying by name is the habit for this live app. Do not run a bare `firebase deploy --only functions` unless you intend to publish every exported function in `functions/index.js`.

Gmail invite fallback remains in the client until the owner asks to remove it. `sendNewSignInNotice` is still Gmail.

---

## 9–10. Site Log and Weekly Report

Removed from the UI. Cold export under gitignored `backups/cold-export-site-log-weekly-*`. Staging site-log documents deleted. Production rows and files left in place.

---

## 11. Backups

Usable production backups: gitignored `backups/production-*` (Firestore + Storage), taken with `scripts/backup-production.js`. Keep them. Do not commit them.

The old Oct 2025 `latest-backup.json` is not a usable restore.

---

## 12. Other Firebase projects on this Google account

Do not use these unless we confirm what they are:

- `construction-expense-tra-4adb0`
- `video-chat-test-28ae6`
- `watemelon-e586e`

Production is **`rising-amp-467702-b5`**. Staging is **`rising-amp-staging`**. Production also has an empty named Firestore database `cost-tracker`; the app uses `(default)`. Do not delete it.

---

## 13. Honest shape of the codebase

Working family tool after a foundations pass, not a greenfield platform.

Done in Phase 8:

- Vite + TypeScript for new files. `react-scripts` is gone.
- Real URLs. Refresh stays on the same screen.
- Money is integer cents in one module.
- Invoice numbers from a server counter. Invoices are voided, not deleted.
- One import path: `src/data` for the ledger. Job files are imported from `src/firebase/jobFiles.ts` so they stay off the first JS load. `firebaseService.js` is a thin re-export of `directories.js`.
- Auth / org / UI contexts exist; the ledger still sits in a large `AppContext` data provider (ADR 004).
- Org id from membership. Wildcard project writes are gone.
- Jobs list counts with `getCountFromServer`. Past 1,000 expenses the app hides cost and margin rather than showing a partial total.
- Vitest + GitHub Action on `phase-*` branches.

Done in Phase 9 Part A:

- Storage rules resolve org from receipt metadata (Opal fallback for old objects).
- Expenses and invoices void first; purge only from Recently deleted and only when already void. Clients, HIA, labour and trades void with no purge.
- `exceljs` is a dynamic import.

Done in Phase 9 Part B:

- Job files live at `organizations/{orgId}/projects/{jobId}/files/{fileId}` with a fixed type list (no folders). Archive, never delete.
- Storage path `files/{orgId}/{jobId}/{fileId}/…` is gated on job membership. 25 MB, no video.

Done in Phase 9 Part C:

- Job-file uploads reuse `src/firebase/storage.js`. Images compress to 1920px at 0.8 plus a 320px JPEG thumbnail. PDFs store as-is with a type icon. Lists render the thumbnail, never the original.
- Storage is written first, then Firestore. A failed Storage upload never gets a record. Retry can skip a completed Storage write.
- Firestore `thumbnailPath` must match `files/{org}/{job}/{fileId}/.+` — `matches()` is a full-string match, so a trailing slash with no `.+` rejects `thumb.jpg`. Staging Firestore + Storage rules are live; production is not.

Done in Phase 9 Part D:

- Route `/jobs/:jobId/files` with search, type counts (dots, not badges), list/grid, and a viewer. Receipts from expenses appear read-only and are not copied. Lists render `thumb.jpg` only.

Done in Phase 9 Part E:

- What needs you today reads job files: missing contract after other paperwork exists; $5,000+ invoices unlinked only after a quote/variation is on the job; Other files older than a week when `uploadedAt` is known. Certificate age is not treated as expiry.
- `linkedTo` is set from the file viewer. Expenses and invoices list attached files without copying them.

Done in Phase 9 Part F:

- Handover pack on Files. Default selection is contract, variation, plan, permit and certificate. Photos stay off until ticked. Cover page, contents (including missing types), then each document. Images are full-page plates. PDFs are appended with `pdf-lib`, loaded only when Generate is tapped. Word and other office files are named as not included. The pack is not stored.

Done in Phase 9 Part G:

- Files is a document register: one table with sortable columns, a summary bar, and multi-select (change type, archive, add to handover pack). Receipts stay in the list as “From an expense”, same hairline as everything else, and are not selectable. Type chips are mobile-only; desktop filters from the type column. List/grid is a two-segment control. Copy does not mention folders. Presentation only — no model or rule changes.

Phase 9 closed 31 Aug 2026: production hosting, Firestore rules and Storage rules. No new Cloud Functions. Localhost stays on staging.

Done on the Phase 10 Part A branch:

- Optional `costPlan/current` target per job. Target money is integer cents; spend is derived from active expenses.
- Lazy `/jobs/:jobId/cost-plan` route with target, spent, remaining and progress. No plan means no nav item and the direct route returns to Overview.
- A dismissible Overview suggestion starts Level 1. Jobs without a plan otherwise behave exactly as before.
- Cost Plan refuses to show spend when the 1,000-expense cap is reached.
- Twenty stable app trade ids exist in code for Part B; there is no org trade-list write yet.
- Firestore rules gate the fixed plan document on job membership, validate shape and deny delete. Emulator-tested, not deployed to staging or production.
- Expense fetch now derives `totalCents` from labour hours/rate and quantity/unit cost when no direct total field exists.

Left on purpose:

- Stored money fields are still mixed strings/numbers. Normalising them is a migration.
- Ledger rollups (Cloud Function summaries) were skipped. The list no longer reads the ledger; the dashboard still does.
- TanStack Query is mounted but most fetches are still AppContext.
- App Check enforcement is off until a site key exists and traffic is clean.
- Gmail invite fallback remains until the owner asks to remove it.
- Dismantling the remaining AppContext ledger/directory blob.

Decisions: `ADR/` (including `006-no-folders.md`).

---

## 14. Mobile and standalone

Phase 7. Layout and metadata only.

**Do not detect standalone in JavaScript to set margins.** `env(safe-area-inset-*)` is the operating system’s number for this device and this orientation. In a Safari tab the values are `0` because Safari’s chrome already occupies that space. The same CSS is therefore correct in a tab and on the home screen.

Variables in `src/index.css`:

- `--safe-top` / `--safe-right` / `--safe-bottom` / `--safe-left` → `env(safe-area-inset-*, 0px)`

Where they are applied:

- `.content` — bottom always; right always; left only under 768px (sidebar already sits on the left at `md`)
- `.app-main` / `.auth-frame` / `.boot-screen` — `padding-top: var(--safe-top)` so the header is below the clock
- Header menu button — in the header row on the left, not `position:fixed`
- `.sidebar-safe` — pad the drawer **contents**, not the steel panel
- `.auth-frame` — sign-in / sign-up shell
- `.app-shell` / `body` / `.mobile-modal` — `100dvh` with `100vh` as the fallback

Status bar: `apple-mobile-web-app-status-bar-style` is `default` (dark clock text on the light canvas). `.app-main`, `.auth-frame` and `.boot-screen` get `padding-top: var(--safe-top)` so the header sits below the clock.

**iOS 26 standalone reports `--safe-top: 0` while the page still draws under the clock** (WebKit 301994). Bottom env() is fine (`34px` measured). On a home-screen iPhone only, `--safe-top` is `max(env(safe-area-inset-top), 59px)` so the header sits below the Dynamic Island even when env() is lying. A Safari tab is not that media query, so it stays at `0`. This is not a per-device table and it is not a JavaScript standalone check.

**Measured (owner iPhone, standalone, 28 Aug 2026):**

| Mode | top | right | bottom | left |
|------|-----|-------|--------|------|
| Home screen, portrait | `0px` (env, buggy) | `0px` | `34px` | `0px` |

Do not treat that top `0` as “iOS reserved the strip”. The header was going under the clock. The 59px floor is the workaround until env() reports the real island height.

Part B (manifest + PNG icons) was skipped — owner did not want a new home-screen icon. Orientation was not locked. No service worker.
