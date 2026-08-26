# Rising AMP — Architecture (after Phase 2, 2026-08-23)

This describes the **running live app**. Phase 1 record is `PLAN.md`. Phase 2 visual record is `PHASE2.md`.

Firebase project (production): `rising-amp-467702-b5`  
Live URL: https://risingamp.com.au (same app as https://rising-amp-467702-b5.web.app)  
Staging (localhost): `rising-amp-staging`  
Default git branch in use was `master`; Phase 1 landed on `phase-1-foundation`; Phase 2 (live look) is `phase-2-visual`; Phase 3 vision is `phase-3-vision`; Phase 4 is `phase-4-domain-email`; Phase 5 is `phase-5-jobs-members`.  
App name in the sidebar: “RisingAMP”. Look: Manrope, Palette 1, category colour as data ink only.

---

## 1. Stack

| Layer | What it is |
|--------|------------|
| UI | React 18, Create React App (`react-scripts`), Tailwind |
| Routing | **No react-router.** A string `currentPage` in `AppContext` switches which page component is shown. |
| Backend | Firebase: Auth (Google), Firestore, Storage, Hosting, Cloud Functions (unused leftover), Analytics |
| Functions | Node 22. App source no longer exports Weekly Report. Production still has unused `generateWeeklyReport`. Do not deploy functions unless asked. |
| OCR | Client-side: OpenAI Vision (`gpt-4o-mini`) → Google Cloud Vision → Tesseract.js |
| PWA | Mobile web-app meta tags only. No `manifest.json`, no service worker. |

Entry: `src/index.js` → `src/App.js`.

Localhost must load `.env.local` (staging). Production builds must load `.env.production.local`. Do not swap them.

---

## 2. Pages (“routes”)

Wired in `src/components/MainContent.js`:

| `currentPage` key | In sidebar? | File |
|-------------------|-------------|------|
| `jobs` | Yes | `src/components/pages/JobsHomePage.js` |
| `dashboard` | Yes (“Overview” when a job is open) | `src/components/pages/DashboardPage.js` |
| `add-expense` | Yes | `src/components/pages/AddExpensePage.js` |
| `new-invoice` | Yes (“Invoices”) | `src/components/pages/InvoiceManagementPage.jsx` |
| `history` | Yes | `src/components/pages/HistoryPage.js` |
| `budget-tracking` | More | `src/components/pages/BudgetTrackingPage.js` |
| `hia-contract` | More | `src/components/pages/HIAContractPage.jsx` |
| `client-manager` | More | `src/components/pages/ClientManagerPage.jsx` |
| `profile` | Sidebar chip | `src/components/pages/ProfilePage.js` |
| `ocr-test` | Hidden | `src/components/OCRTest.jsx` |
| `enhanced-ocr-test` | Hidden | `src/components/EnhancedOCRTest.jsx` |

Removed: Site Log, Weekly Report.

Present but **not wired**: `PurchaseOrdersPage.js`, `ConstructionExpenseTracker.js` (legacy monolith), `Fab.js`.

Login (not `currentPage`): `LoginScreen.jsx` (Google or email/password), `ProfileSetupScreen.jsx`. Public static pages: `/privacy`, `/terms`. While auth/membership loads, `BootScreen.jsx` (RisingAMP mark). After setup, **Jobs** is home. `NotInvitedScreen.jsx` is unused. Invite/rename live on each job row.

---

## 3. Access model

Google or email/password via Firebase Auth (email/password enabled on **staging**). After sign-in:

1. If the profile is incomplete, show **Set up your account**. Saved at `profiles/{uid}`.
2. Anyone signed in can use the app. Jobs home lists only projects where `invitedEmails` contains that email. A new signup sees an empty list until they are added to a job.
3. Family jobs are still protected by rules: you cannot read Opal data unless your email is on that job.
4. Tracker reads/writes `organizations/{orgId}/projects/{projectId}/…`. Receipt Storage still uses the legacy workspace id (`storageKey`) so live photos keep working.

Invite: owner taps the person icon on a job card. That email (any domain) is added to that project (and to the org door list). Invite mail is the professional HTML from `design/risingamp-signin-email.html`, sent from `invites@risingamp.com.au` via Resend once `sendJobInviteEmail` is deployed. Until then the app falls back to the inviter’s Gmail send path. New-sign-in notices are still Gmail-only (no popup on login).

Old PIN trees `users/{accessCode}/…` still exist. The live app does not use them. Do not delete them unless asked. `users/` rules are still `if true` for those leftover trees.

---

## 4. Where auth is enforced

`firestore.rules`:

- `users/{accessCode}/**` — still `if true` (legacy PIN copies).
- `profiles/{uid}` — signed-in users can read; only the owner of that uid can write.
- `organizations/{orgId}` — signed-in email must be in `invitedEmails`.
- `organizations/{orgId}/projects/{projectId}` — signed-in Gmail must be in that project’s `invitedEmails`. List queries use `resource.data.invitedEmails` so they match `array-contains`.
- Project subcollections use a `get()` of the parent project’s `invitedEmails`.

`storage.rules`: receipts still keyed by legacy access code, `if true`. Same as before Phase 1.

---

## 5. How data is scoped

One organisation: Opal SS Constructions.

Two projects (job lists): **72 Centenary Dr**, **Gurner St**. Each is a Firestore document under `organizations/opal-ss-constructions/projects/{projectId}` with tracker subcollections copied from the old PIN folders.

The dashboard is **one job list at a time**, opened from the Jobs home (or restored from `localStorage` so Add expense still has a job).

---

## 6. Firestore layout (live)

```
organizations/opal-ss-constructions
  projects/{projectId}
    expenses, invoices, clients, labour, trades, …
profiles/{uid}         # name, company, photo
users/{accessCode}     # leftover copies, unused by the app
```

Project document fields include `name`, `invitedEmails`, `legacyWorkspaceId`, `orgId`.

---

## 7. Storage layout

| Path | What |
|------|------|
| `receipts/{legacyWorkspaceId}/{expenseId}/…` | Expense receipt images (live bucket exists) |
| `siteLogs/{legacyWorkspaceId}/…` | Old Site Log photos (unused) |
| `reports/{legacyWorkspaceId}/…` | Old Weekly Report files (unused) |

Staging has **no** Storage bucket; localhost receipts may be missing. Live receipts work.

---

## 8. Cloud Functions

Production still has leftover `generateWeeklyReport`. The app UI does not call it.

This branch adds **one** new callable: `sendJobInviteEmail` (us-central1). It sends job invites from `invites@risingamp.com.au` via Resend. The Resend API key lives in Secret Manager (`RESEND_API_KEY`), never in the client bundle.

Deploy **only** that function by name, after the owner has set the secret:

```
firebase deploy --project rising-amp-staging --only functions:sendJobInviteEmail
firebase deploy --project production --only functions:sendJobInviteEmail
```

Do **not** run `firebase deploy --only functions` against production — that would delete `generateWeeklyReport`.

Until the new function is deployed, the app falls back to the existing Gmail send path. `sendNewSignInNotice` is still Gmail and was not moved.

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

Working family tool, not a tidy platform. Phase 1 was not a rewrite.

Fine for now:

- Folder layout (`pages`, `firebase`, `hooks`, `utils`).
- Live data path: `organizations/…/projects/…`.
- Staging + branch + restore tag.

Still messy, and not a side quest unless it blocks the next asked piece of work:

- Two overlapping Firestore helpers (`data.js` and `firebaseService.js`).
- `AppContext.js` loads a lot for every screen.
- Leftover unwired files.
- No react-router; almost no tests.
- Legacy `users/` and Storage rules still open.
