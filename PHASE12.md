# Phase 12 — Front-end upgrade (agent brief and record)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything.

Branch: **`phase-12-fables-upgrade`**. Restore tag: `pre-phase12-2026-09-05` (the last Phase 11 commit, `0af543e`). Ten commits, one concern each, plus a docs commit (eleven in all). **Not deployed.** Localhost stays on staging.

## What this phase is

The owner asked for an upgrade with executive control: find code that is truly obsolete and remove it, fix the buttons and screens that were weird or fake, make the flow better for the job the app does, and make it feel different, while treating production as live. This phase is **front-end only**:

- No change to Firestore rules, Storage rules, Cloud Functions, the data model, or any stored document.
- No new npm packages. One removed (`recharts`, zero imports).
- Every screen still writes exactly the fields it wrote before, except where a write was already failing (noted below).
- Every commit passes `npm run typecheck`, `npm test` and `npm run build` under the 275 KB ceiling.

## Why each thing changed

### 1. Code nothing runs (`060a728`)

Confirmed by grep of every import path across `src`, `functions`, `scripts` and `index.html` before deleting.

| Removed | Evidence it was dead |
|---|---|
| `src/firebase/firebaseService.js` | Marked `@deprecated`; zero importers. |
| `src/firebase/jobSummaries.js` | The Phase 5 per-job ledger download. Zero importers since Phase 8. `DATABASE.md` updated. |
| `src/invoiceNumber.ts` + test | Client-side invoice numbering; production uses `allocateInvoiceNumber` (ADR 003). Only its own test imported it. |
| `src/styles/premium-animations.css` | Imported by `App.js`; not one of its classes (`glass-card`, `animate-shimmer`, `hover-lift`, …) appears in any component. Its global reduced-motion rule moved into `index.css` so behaviour is unchanged. |
| `index.css` blocks | glass/neumorphic, `card-enhanced`, every `mobile-*`/`portrait-*`/`landscape-*` utility, `focus-ring`, `.loading`, react-quill overrides (react-quill is not a dependency), and the same number-input rule repeated four times. react-select and react-datepicker overrides stay: both are used. |
| `data.js` exports | `syncExpensesToFirestore` (array-to-subcollection migration), `updateBudgetInFirestore`, `batchDeleteExpenses`, a second copy of `saveLabourInfo`/`saveTradeInfo`/`saveClientInfo`, `fetchLabour`/`fetchTrades`/`fetchClients` and their `fetchSaved*` aliases, `updateClientInfo`/`deleteClientInfo`, and the deprecated `delete*` aliases that only wrapped `void*`. `fetchExpensesFromFirestore` went too: its last caller was `jobSummaries.js`. |
| `directories.js` exports | `updateLabour`, `deleteLabour`, `updateTrade`, `deleteTrade`: only re-exported by the deleted `firebaseService.js`. |
| `AppContext` members | `loadCompanies`, `loadClientDetails`, `loadSavedLabour`, `loadSavedTrades`, `loadProgressPayments`, `loadInvoices`, `loadHIAContracts`, `loadUserBankDetails`, `updateBudgetInFirebase`, `updateProgressPaymentInFirebase`, `deleteProgressPaymentFromFirebase`, `updateHIAContractInFirebase`, `deleteHIAContractFromFirebase`, `deleteClientFromFirebase`, `updateInvoiceInFirebase`, and the PIN-era `budget` state. None was called from a screen. 967 lines to 642. |
| `ledgerListen.ts` budget read | The expense listener did a `getDoc` of the job document to read a `budget` field that `DATABASE.md` lists as a leftover PIN copy and nothing displays. One fewer round trip on every job open. |
| `recharts` | In `package.json`, zero imports. Lockfile change is deletions only. |
| `.DS_Store` | Tracked in git although `.gitignore` excludes it. Untracked with `git rm --cached`. |

`firestoreCache.test.ts` lost one assertion (`fromServer: true` in AppContext) because the only function that used it, `loadInvoices`, had no caller. Everything else in that test still holds.

### 2. Toasts that exist (`7e1deee`)

`showToast` in `UIContext` was `logger.info(...)`: a console line in dev, nothing in production. 163 call sites (`Expense added`, `Could not open that receipt`, `Invoice restored`, …) were invisible to the person using the app. `components/ui/Toaster.tsx` renders them: success / info / warning / error tones from the tokens, auto-dismiss (errors stay six seconds), at most three stacked, duplicate messages collapsed, `aria-live`. Bottom-centre on a phone (above the new tab bar), bottom-right on a desktop.

### 3. Shell (`2fe529a`)

- **Search.** The header search button and Ctrl/Cmd+K opened a palette whose input filtered nothing and whose "Scan invoice" and "Export to Excel" rows only showed a toast (which was invisible). `CommandPalette.tsx` now searches jobs by name, screens on the open job, and from two letters the open job's expenses (name, supplier, payer, note, category, amount) and invoices (number, client). Picking an expense opens it on History. Keyboard up/down/enter/escape. It is loaded on first open (`PaletteHost.tsx`), not on boot.
- **Sign out** left the header, where it sat one tap from Search on a phone. It is in the sidebar footer and on Profile. `onSignOut` flows through `AuthContext`.
- **Phone tab bar.** `BottomNav.tsx` shows inside a job on screens under 768 px: Overview · Invoices · Add · Files · History. `showsJobTabBar` in `navigation.ts` decides when; `html.has-tabbar` pads `.content` and lifts toasts. Desktop keeps the sidebar. Cost plan, Clients and HIA contracts stay in the drawer.
- **Budget tracking retired.** It defined "budget" as the sum of paid invoices and reported burn rate and days remaining against that. Cost plan is the budget, and Overview already shows invoiced / paid / spent honestly. `/jobs/:id/budget` redirects to Cost plan; the sidebar item is gone; `BudgetTrackingPage.js` deleted. Nothing stored referred to it.
- **Clients under the job.** `/clients` was a global route that needed a job from context. It is `/jobs/:id/clients`; `/clients` redirects onto the open job. `navigation.test.ts` covers both.
- **Boot bundle.** The pure address helpers (`normalizeEmail`, `canonicalEmail`, `emailInviteVariants`, `emailsMatch`, `isEmailOnList`) moved to `firebase/emailAddress.ts`; `email.js` re-exports them. Boot, tenancy, the Jobs list and people chips import the pure module, and the sign-in notice and invite mail are dynamic imports, so the 330-line mail template file leaves the first paint. Initial JS gzip went 272.7 KB (production) → 267.7 KB.

### 4. Add expense (`5d60b95`)

- Removed: "Import CSV" (toast: coming soon), "Quick entry" (toast: mode activated, no mode), and the header "Quick add" button (same). Scan a receipt is the lead card; the category grid sits under it and counts live rows only.
- `ExpenseModal.jsx` is a full-height sheet on a phone with the total and Save / Cancel pinned at the bottom, and a centred dialog on a desktop. It used raw Tailwind zinc/red/green defaults (the total was light green on white); it is on the tokens now. Dates read dd/MM/yyyy. Optional dates no longer default to today. Number fields open the decimal keypad. **Logic, field names and the saved shape are unchanged.**
- `OCRScanner.jsx` is titled Scan a receipt, explains what it found in plain words, and sits on the tokens.

### 5. History (`4c2522e`)

Phone card list (name, category dot, date, payer, notes, amount, pickers and actions under each card; tap to edit). Desktop table with a detail row built from the fields the category actually has. Australian dates (was `en-US`: "Sep 5, 2026"). Money through `formatMoney` with cents (was `$` + `toLocaleString()`). Real sort arrows. Category chips toggle off. Search also matches supplier, provider, payer and amount. Empty states say what to do next.

### 6. Invoices (`5e77bf4`)

- Three invoice layouts existed: the preview, a second hidden copy inside New invoice, and a 150-line HTML string in the list's Download button that still printed an "OT" blue logo, "Construction Management", and the subtotal as the total. They are one `components/invoices/InvoiceDocument.tsx`. The preview shows it; `pdf/invoicePdf.tsx` renders the same component off-screen for the PDF. The header is the **builder's business from the profile** (name, ABN, street, suburb/state/postcode, mobile, email), not "RisingAMP". "Tax invoice" when GST is charged. Bank details under "How to pay".
- New invoice opened **two preview modals at once** (its own and the shared one). Fixed. It also wrote a `progressPayments` document on every save with `invoiceId: savedInvoice.invoiceId`, which was always `undefined` because the context returns `{ success, invoice }`; Firestore rejects `undefined`, so the write failed every time and the toast that said so was invisible. Nothing reads that collection. The write is removed. Saved bank details prefill the bank fields and are remembered (quietly) when changed. The form resets every field. Labels were `text-slate-300` on white.
- The list has phone cards, a status pill, money with cents, Outstanding in red when anything is past due, search by amount, and the shared PDF.

### 7. Jobs home (`bc30409`)

The Jobs list already read `ledgerRollup/current` for the expense count. The same document has `costCents`. It is now the Spent column on a desktop and the row subtitle on a phone, plus "Spent across jobs" in the strip. Jobs with no rollup show a dash. No extra reads.

### 8. HIA contracts (`887e955`)

The old page "processed" any uploaded image with a two-second timer and eight hard-coded stages totalling $1,250,000, then let that be saved as the job's contract. Its progress-payment PDF printed "Construction Company, 123 Construction St". Both are gone. Now: contract sum, client (saved or typed), stages as a table where percent and amount work each other out, a running "still to allocate" that must reach zero before saving, the six standard HIA stage names one tap away with no amounts invented, bank details prefilled and remembered. Saved contracts expand to their stages; each stage prints as a **progress claim** on the shared invoice document with the builder's details. The saved shape (`projectName`, `totalAmount`, `stages[]`, `clientDetails`, `bankDetails`) is the one the Files screen already links to. The blob URL the old page stored in `imageUrl` is no longer written.

### 9. After the click-through (`a72289f`, `96e3ec5`)

Jobs home puts Archived and New job on one row on a phone with the search under them; Overview's header Add expense is desktop-only now the tab bar carries Add; the HIA form opens only after the query has answered. Invoice PDFs are JPEG-rastered (6.8 MB → email-sized); "NA" / "N/A" typed into old client fields prints as nothing; expense form labels are sentence case (label text only, stored keys unchanged).

## What was deliberately not done

- No change to rules, functions, Storage, schema, or any migration. `progressPayments` documents that exist are untouched; the collection and its hook remain.
- No deploy. Hosting only, when the owner names it: `firebase deploy --project production --only hosting`.
- The Gmail invite fallback, App Check enforcement, money-field normalisation and the remaining AppContext ledger blob stay parked (CLAUDE.md "Out of scope").
- `design/risingamp-scaffold-vision.html` (untracked, 24 Aug) was left alone; it is not referenced anywhere.
- `logger.js` keeps its unused methods; it is small and touching it buys nothing.
- `npm run test:rules` needs Java for the emulator and this Mac has none on PATH; rules did not change in this phase.

## What was verified (5 Sep 2026, localhost against staging)

Every commit: `npm run typecheck` clean, `npm test` 236 Vitest + 18 Node tests passing, `npm run build` under the ceiling (final: **267.9 KB** initial JS gzip; production is 272.7 KB).

Click-through with a real browser (installed Google Chrome driven by playwright-core from a scratch folder, nothing added to the repo), signed in as the owner's staging test login, iPhone 13 viewport and a 1360 px desktop:

- Jobs home paints both jobs with spend figures from the rollup ($755,591 · 125 expenses; $4,656 · 5 expenses) and a "Spent across jobs" strip.
- 72 Centenary Dr: Overview, Add expense, History (cards on the phone, table on the desktop, Australian dates), Invoices (cards / table, status pills, money with cents), Files, Cost plan, Clients, HIA contracts all render. `/budget` redirects to `/cost-plan`.
- Search palette on "in": the Invoices screen plus matching expenses with amount, category and date.
- The phone drawer and tab bar show; sign out sits in the drawer footer.
- **Real write on staging (desktop):** Materials expense "Phase 12 check (delete me)", 2 × $1.50 → toast "Expense added" → row on History dated 5 Sept 2026 at $3.00 → Move to Recently deleted → toast "Moved to Recently deleted" → Remove for good → toast "Expense removed for good". Staging was left as it was found.
- Invoice preview renders the shared document; Download PDF produces a file; a saved HIA contract expands and prints a progress claim PDF.

Not exercised in-agent: the receipt scanner's camera path (needs a device), Google sign-in, and the service worker (`npm start` never registers one; that is Phase 11's `npm run preview:staging`).

One environment note: a Vite dev server that predates the lockfile change serves 504 "Outdated Optimize Dep" for react-select and react-datepicker until it is restarted. That was the only "error" the first click-through found, and it was not the app.

## How to check it

```
npm run typecheck && npm test && npm run build
npm start   # localhost:3000 against staging
```

Then on a phone-sized window: sign in, Jobs (spent figures), open a job, tab bar, Add → Materials (sheet, sticky Save), History (cards, Australian dates), Invoices (cards, preview, PDF with your business details), Cost plan, drawer → Clients / HIA contracts, Search (top right), Profile → Sign out.

## Deploy, when named

Hosting only. Force-close and reopen the home-screen app twice so the new worker takes over.
