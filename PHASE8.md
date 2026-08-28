# Phase 8 — Make it a product an engineer would recognise (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything.

Working branch: **`phase-8-technical-revamp`** (owner-named; this brief originally said `phase-8-foundations`). Created from `phase-7-app-feel`. Never commit to `master` or `main`. Restore tag: `pre-phase8-2026-08-28`.

**Part A status (28 Aug 2026):** implemented on the branch. Emulator test in `npm run test:rules`. Production rules **not** deployed. App Check client is present but does nothing until `REACT_APP_FIREBASE_APPCHECK_SITE_KEY` is set, and enforcement stays off. Next: staging rules deploy if localhost should match, then production rules on a named yes, then Part B.

Phases 1 to 7 fixed what the app *does*. Phase 8 fixes what the app *is*. The test for every decision here is not "does it work" but "would a software engineer picking this up cold understand it, trust it, and be able to add to it without breaking something".

## Sources

This brief merges two audits:

1. **A source-code audit** of `phase-7-app-feel` (15,658 lines) against the production build, done 28 Aug 2026.
2. **An external live-site teardown** dated 23 Aug 2026, black-box only, scoring the product 68/100.

They are complementary and neither is sufficient alone. The teardown could see behaviour but not rules or source, so it **missed the one critical security hole** and inferred a security model that turned out to be wrong. The source audit could see everything except the app running, so it **missed four real defects** the teardown caught by using the product. Where they disagree, this brief follows the code.

### Teardown items already closed, or wrong

Do not spend a session on these. Recorded here so nobody re-opens them.

| ID | Claim | Status |
|---|---|---|
| SEC-02 | Access is keyed off shareable "access codes" | **Wrong.** The console printed a variable named `accessCode` whose value was always a job ID. The real gate has been Firestore rules on `invitedEmails` since Phase 1. Phase 6 renamed the variable to `jobId`. There is no capability-based access model to dismantle. |
| SEC-01 | Permission error on every page load | **Fixed** in commit `23765c1`. |
| DAT-01 | Invoices store free-text project names | **Mostly fixed.** Phase 5 Part B backfilled `jobId` onto production invoices. The remaining piece is display only and already tracked in `PHASE6-INTEGRITY.md`. |
| DAT-04 | Jobs are created by hand outside the app | **Fixed.** Create, archive, add person and remove person shipped in Phase 5 Part B. |
| ARC-03 | Realtime listeners on whole collections drive cost | **Overstated.** There are only two `onSnapshot` calls in the entire app; nearly everything refetches on mount. The real cost bug is different and worse, see Part D. |
| ARC-01 / ARC-02 | CRA, no routing | **Valid.** Already Parts B and E below. |

### The finding the teardown could not see

`firestore.rules` makes every user profile readable by any signed-in user, and `profiles.js` reads the entire collection. With open sign-up, that exposes every user's name, mobile, business name and ABN to any stranger who registers. The teardown graded backend security as "Verify now" and was right to, but a black-box pass cannot read rules. **This is Part A and it is the most serious item in either audit.**

## The consolidated audit

| # | Finding | Source | Severity |
|---|---|---|---|
| 1 | Any person who signs up can read **every** user's name, mobile, business name and ABN | code | **Critical** |
| 2 | Invoice numbers are `Math.random() * 999`, so two invoices will share a number | teardown, confirmed | **High** |
| 3 | Invoices are hard-deleted with `deleteDoc`, destroying financial records | teardown, confirmed | **High** |
| 4 | Job counts are produced by **reading every document**, not by counting | code | **High** |
| 5 | Money is floating point parsed out of strings | code | **High** |
| 6 | 416 KB gzipped of PDF and spreadsheet libraries load before a user sees History | code | **High** |
| 7 | Expenses silently cap at 1,000, which can make margin quietly wrong | code | **High** |
| 8 | No write anywhere is validated for shape; rules allow a member to write anything | code | **High** |
| 9 | The app is hardcoded to one organisation, but the sales page sells to strangers | code | **High** |
| 10 | Google Analytics loads unconditionally, without consent, and is never used | teardown, confirmed | Medium |
| 11 | Firebase App Check is not enabled | teardown, confirmed | Medium |
| 12 | `AppContext` exports 62 values to 17 consumers, with zero `React.memo` | code | Medium |
| 13 | No router. One URL, no deep links, no back button, no shareable job | both | Medium |
| 14 | Two parallel data layers, `data.js` (879 lines) and `firebaseService.js` | code | Medium |
| 15 | Some invoices have a due date equal to the issue date, so "overdue" fires on day one | teardown | Medium |
| 16 | Date handling mixes local `Date` objects with UTC `toISOString()`, risking off-by-one | teardown, mechanism confirmed | Medium |
| 17 | 502 lines of test against 15,658 lines of source, no component tests, no CI | code | Medium |
| 18 | No types, no runtime contracts | code | Medium |
| 19 | Build runs on unmaintained `react-scripts`; `craco` is configured, broken and unused | code | Medium |
| 20 | `ErrorBoundary` is used on one page; anywhere else a crash is a white screen | code | Medium |
| 21 | Empty and low-data states unverified, and every new customer starts empty | teardown | Medium |
| 22 | Team chips mix display names with raw email addresses | teardown | Low |
| 23 | 5 `aria-` attributes across the whole app; modal focus trap and Escape unverified | both | Low |

Findings 1, 2, 3, 5, 7, 8 and 16 are the same underlying problem in different clothes: **the app trusts itself.** It trusts that whatever is in the database is the right shape, that whoever is signed in should see it, that a random number will not collide, and that a number parsed from a string is the number. For a tool people put their money records into, that is the thing to fix.

---

## Part A — Security and privacy

**Do this first, this week, before anything else in this brief.**

### A1. The profile leak (Critical)

Three things line up badly:

1. `firestore.rules`: `match /profiles/{uid} { allow read: if request.auth != null; }`. Any signed-in user can read any profile.
2. `src/firebase/profiles.js` line 57: `getDocs(collection(db, 'profiles'))`. It pulls the **entire** collection.
3. Phase 3 opened sign-up to any email on any domain.

A profile holds `name`, `role`, `mobile`, `businessName`, `abn` and a photo. So anybody can sign up at `risingamp.com.au` and read the name, mobile number, business name and ABN of every person who has ever used the app. Today that is four family members. The moment a scaffolder and his crew are on it, it is their details, readable by the next stranger who signs up.

The published Privacy Policy and the sales page both promise the data is private. Right now that is not true.

**Fix:**

- Replace the unbounded scan at `profiles.js:57`. The app needs profiles for *people on a job*, so read them by the emails on that job's invite list. The batched `where('email', 'in', chunk)` query already in that file at line 167 is the right shape.
- Tighten the rule so a profile is readable by its owner and by people who share a job with them. If expressing "shares a job with me" needs a `get()` per read and proves too expensive, the correct fallback is a small deliberately-public `publicProfiles/{uid}` document holding display name and photo only, with mobile, ABN and business name private to the owner. **Do not leave the current rule in place while designing the perfect one.**
- Prove it with an emulator test before deploying: a signed-in user sharing no job cannot read another profile.
- Deploy with an explicit owner yes: `firebase deploy --project production --only firestore:rules`.

### A2. Delete Google Analytics

`src/firebase/config.js` line 41 calls `getAnalytics(app)` at module load, so GA4 initialises and sets cookies for every visitor before any consent. The teardown flagged the consent problem. The code shows something worse: **`analytics` is exported and used nowhere else in the app.** Not one event is logged.

So the project is carrying a privacy exposure, a legal question under the Australian Privacy Act, a third-party connection on the critical path, and roughly 50 KB of script, in exchange for nothing at all.

**Fix: remove it.** Delete the import, the call and the export. Do not add a consent banner to keep a feature nobody uses. When product analytics is actually wanted, add it deliberately, with consent, and with events worth collecting. This is the boring, safe, correct call.

### A3. Turn on Firebase App Check

The Firebase web API key being visible is normal and not a risk; it is a public identifier. The real gap is that without App Check, anything can call the Firebase backend directly and the rules are the only defence. Given that Part H has not yet tightened the wildcard write rule, that defence is thinner than it should be.

Enable App Check with reCAPTCHA Enterprise for web, on staging first, then production. Watch for the usual trap: enforcement turned on before the client is registered locks the app out. Register, monitor in the console until traffic is clean, then enforce.

### A4. Strip production console output

Phase 6 cut logging from 60 calls to 12, which was good. Finish it: confirm the production build ships no `console.log`. Either route the remainder through `src/utils/logger.js` with a level that is silent in production, or strip them at build time. The teardown saw data volumes and identifiers printed in the live console, which both leaks information and looks unfinished to anyone who opens dev tools.

Commit: `Lock down profile reads, remove unused analytics, and enable App Check.`

---

## Part B — Move the build to Vite, and lay the TypeScript foundation

Second, because every part after it becomes easier and measurable, and doing bundle work on the old toolchain means doing it twice.

`react-scripts` 5.0.1 is the last release of Create React App, which is no longer the recommended way to build or maintain a React app. Its dependency tree carries unmaintained packages and its output is worse than a modern tool's for no benefit.

There is also a live bug proving nobody can use the configured tooling: `craco.config.js` line 1 does `require('webpack-bundle-analyzer')`, which is not installed, so anything invoking craco crashes immediately. Nothing invokes it, because every script calls `react-scripts` directly. Configured, broken and dead is exactly the sort of thing that tells a new engineer a project is not looked after.

**What to do:**

1. Migrate to **Vite** with `@vitejs/plugin-react`. Well-trodden for a never-ejected CRA app: move `index.html` to the project root, replace `%PUBLIC_URL%`, rename `REACT_APP_*` to `VITE_*` and `process.env` to `import.meta.env`, and carry the PostCSS and Tailwind configs across unchanged.
2. **Delete `craco.config.js`** and `@craco/craco`. Do not port the broken analyzer require. Use `rollup-plugin-visualizer` instead.
3. Make `.nvmrc` honest. It says `18.17.0`. Set it to the Node version actually in use and say so in the README.
4. Set up **TypeScript with `allowJs: true` and `strict: true`**. Convert nothing yet.
5. Adopt this rule and write it into `CLAUDE.md`: **all new files are TypeScript; existing files convert only when a part of this brief says so, or when they are being substantially rewritten anyway.** A big-bang conversion of 15,000 lines is not a phase, it is a way to lose a month and introduce bugs in code that currently works.

**Env var care.** Renaming the variables is the highest-risk step here, because getting it wrong points localhost at production. Change the names in one commit, verify localhost still reports the **staging** project ID on boot, and only then continue.

Commit: `Move the build from Create React App to Vite and enable TypeScript for new code.`

---

## Part C — Load time

### The numbers today

Total JavaScript is **2.78 MB raw, 0.78 MB gzipped**:

| Chunk | Gzipped | What is in it |
|---|---|---|
| `9.*.chunk.js` | **249 KB** | `exceljs` |
| `main.*.js` | **204 KB** | Firebase and Firestore |
| `936.*.chunk.js` | **167 KB** | `jspdf` and `html2canvas` |
| everything else | ~160 KB | the actual application |

**The application is the smallest part of the download.**

**C1. `exceljs` (249 KB gz) loads when somebody opens History or Overview.** `HistoryPage.js:7` and `DashboardPage.js:14` statically import the export helper, and `excelExport.js:1` statically imports `exceljs`. Exporting a spreadsheet is a rare, deliberate action. Load the library from the click handler, not from the page.

**C2. `jspdf` and `html2canvas` (167 KB gz) are dynamically imported in two places and statically imported in two others, so the dynamic imports achieve nothing.** `NewInvoicePage.jsx:222` and `InvoiceManagementPage.jsx:82` do it correctly. But `InvoicePreview.jsx` lines 3 to 4 and `HIAContractPage.jsx` lines 4 to 5 import both at the top, and `InvoicePreview` is imported statically by both invoice pages, so the bundler puts them in a shared chunk anyway. Remove the static imports and load them inside the PDF function. One code path everywhere.

**C3. Trim the Firebase surface.** Check that Storage and Functions are imported lazily rather than at boot in `config.js`; neither is needed to render the Jobs list. Removing Analytics in Part A helps here too.

**C4. Set a budget and enforce it.** Add `rollup-plugin-visualizer`, record the numbers in `ARCHITECTURE.md`, then fail the build when initial JavaScript exceeds **250 KB gzipped**. A budget nobody checks is not a budget.

Target: **initial load under 250 KB gzipped, down from roughly 620 KB.**

Commit: `Load the PDF and spreadsheet libraries on demand and set a bundle budget.`

---

## Part D — Firestore read cost

The teardown flagged that aggregation happens in the browser. The source shows a sharper version of the same problem, and it is the clearest cost bug in the app.

### D1. Counts are produced by reading every document

`src/firebase/projectCatalog.js` line 35:

```js
async function countSubcollection(projectRef, name) {
  const snap = await getDocs(query(collection(projectRef, name), limit(1000)));
  return snap.size;
}
```

And `listOrgProjects` calls it in a loop, for expenses **and** invoices, for **every job**.

So rendering the Jobs home screen, which shows a count on each card, reads every expense and every invoice document in every job. Today that is 129 expenses and 10 invoices. At ten jobs averaging 500 expenses, it is 5,000-plus document reads to draw a list of cards.

Firestore has `getCountFromServer`, which costs **one read per thousand documents counted**. Nothing in the codebase uses it. The app is paying roughly a thousand times more than it needs to for a number on a card.

**Fix:** use `getCountFromServer` for every count. This is a small change with an enormous ratio, and it should be the first thing done in this part.

### D2. The 1,000 cap can make margin wrong

`data.js` line 67 caps expenses at 1,000 with the comment "Limit to prevent excessive data loading". A job that passes 1,000 expenses will compute margin from a subset and present it as fact.

**Fix:** paginate the ledger properly. Until that lands, detect the cap and refuse to show a margin figure, saying plainly that there are more expenses than can be totalled. **A missing number is honest. A wrong one is not**, and that is the founding promise of this product.

### D3. Move aggregation off the client

Margin, cost to date, category splits and month-over-month are all computed in the browser over the full expense set. Maintain rollup documents per job, per category and per month, written by a Cloud Function on expense create, update and delete. The dashboard then reads a handful of summary documents instead of the whole ledger.

**Ordering note:** rollups are a real data-model addition and they must not become a second source of truth that can drift from the ledger. Build them to be **recomputable from scratch by a script**, and add a check that recomputes and compares before this ships. If a rollup and the ledger ever disagree, the ledger wins and the app says so.

### D4. Cache what does not change

Reference data (clients, suppliers, saved workers and trades) is refetched on mount and changes rarely. This is what TanStack Query in Part H is for.

Commit: `Count with aggregation queries and stop reading the ledger to draw a list.`

---

## Part E — Real routes

`MainContent.js` switches on a `currentPage` string held in state. There is no router and the app lives at one URL. Consequences:

- No link can be sent to a job, a customer, or yourself.
- Back button and phone back gesture do nothing. In the Phase 7 home-screen app there is no address bar to escape with, so a user has only in-app controls.
- Refresh always lands on Jobs, losing the user's place.
- Nothing can be split by URL, because there are no URLs.
- A new engineer has no map. Routes are how you read an app you have never seen.

Add `react-router-dom`:

```
/                     jobs list
/jobs/:jobId          job overview
/jobs/:jobId/expenses/new
/jobs/:jobId/invoices
/jobs/:jobId/history
/jobs/:jobId/budget
/jobs/:jobId/contracts
/clients
/profile
/privacy  /terms      already static via firebase.json rewrites, keep working
```

The job ID belongs in the URL, not in context. Lazy-load each route. Keep a catch-all that renders a plain "page not found, go to Jobs" rather than a blank screen.

**Watch for:** `tenancy.js` persists the open job in `localStorage`. Once the job is in the URL, the URL is the source of truth and the stored copy is a cold-start fallback only. Two sources of truth for which job is open is how you get a header showing one job and a total from another.

Commit: `Give every screen a real URL.`

---

## Part F — Money that cannot be quietly wrong

There are **51 `parseFloat` calls and 32 `toFixed` calls**, and the database stores money as a mix of strings and numbers. The Phase 5 audit recorded it: `hours` all strings, `amount`, `cost` and `quantity` mostly strings, `rate` mostly numbers.

So a total is string-parsed into IEEE 754 floats, added, and rounded at display time. That is the arrangement where `0.1 + 0.2` is not `0.3`, where a margin can be a cent out, and where two screens adding the same expenses in a different order can disagree. It has not bitten yet because the amounts are small and the rounding forgiving. That is luck, not design.

1. **One money module.** All money is **integer cents**. One place to parse user input into cents, one to format cents for display, one to add, subtract and take a percentage. Written in TypeScript with a `Money` type so a raw number cannot be passed where money is expected. No money arithmetic anywhere else.
2. **Parse at the boundary.** Convert to cents once when a document is read, back once when written. The rest of the app never sees a string that might be a number.
3. **Leave stored documents alone in this phase.** Handle mixed types on read. Normalising the database is a migration needing a backup and an approval, and it belongs in its own phase after the read path is proved correct.
4. **Test it exhaustively.** `"1,234.56"`, `"$40"`, `" 40 "`, `""`, `null`, negatives, and a thousand values added without drift.

Commit: `Handle money as integer cents through one typed module.`

---

## Part G — Financial records that hold up

Three defects the teardown found by using the product, all confirmed in source, all in the same area: the records a client or an accountant will actually see.

### G1. Invoice numbers will collide (High)

`NewInvoicePage.jsx` lines 29 and 325:

```js
useState(`INV-${Math.floor(Math.random() * 999) + 1}`)
```

Every invoice number is a random integer from 1 to 999, generated in the browser, with no uniqueness check anywhere.

That is not merely untidy. With 999 possible values, the probability of a duplicate passes **50% at about 37 invoices**. There are already 10. So on the current trajectory two different invoices, to two different clients, will carry the same number, and nothing in the system will notice.

For an Australian tax invoice that is a compliance failure, and for a product being sold to businesses it is the kind of defect that ends the relationship.

**Fix:** generate the number **server-side** from a per-organisation counter in a Firestore transaction or a Cloud Function, so it is unique and monotonic. A format like `2026-0007` reads properly and sorts. Never generate an identifier that must be unique on the client.

**Do not renumber existing invoices.** They have been sent. Check the existing ten for a collision, report what you find, and let Lalit decide.

The same pattern appears at `ExpenseModal.jsx:372`, where expense IDs are `expense_${Date.now()}_${Math.random()...}`. Far larger space so far less urgent, but note it and prefer Firestore's own document IDs for new records.

### G2. Invoices are hard-deleted (High)

`data.js:629` `deleteInvoiceFromFirestore` calls `deleteDoc`, and `InvoiceManagementPage.jsx:56` wires it to a trash button on every invoice row.

A financial record vanishes, its number is freed, and the job's invoiced history silently changes. An accountant expects an unbroken trail.

**This also directly violates the project's own prime directive.** `CLAUDE.md` says "No hard deletes of user-created data" and "Soft deletes only". Phase 5 honoured that for jobs and people and this was missed.

**Fix:** replace delete with **void**. Set a status, keep the document and its number, exclude voided invoices from totals, keep them visible in history with a clear marker. Then change the rule so `invoices` cannot be deleted at all, the same way jobs already cannot.

### G3. Dates

**Due date equals issue date on some invoices**, so "overdue" can fire the day an invoice is raised. That feeds the "What needs you today" panel, which is a trust feature, so a false overdue is worse than no overdue. Default the due date to issue date plus a standard term of 14 or 30 days, editable per invoice, and decide with Lalit which term is standard for Opal.

**Date handling mixes local and UTC.** `ExpenseModal.jsx:377` writes `new Date().toISOString()` while the picker holds a local `Date`. The teardown observed a new expense defaulting to tomorrow's date. The mechanism for off-by-one drift is present, and an expense landing in the wrong month corrupts the month-over-month comparisons the dashboard depends on.

**Do not guess at a fix.** Write a test that runs at several times of day across timezone boundaries, confirm which direction it drifts and when, then fix it. Then settle one rule for the whole app: **store a calendar date as a plain `YYYY-MM-DD` string in the user's timezone, and store an instant as a Firestore Timestamp.** A day and a moment are different things and mixing them is the whole bug.

Commit: `Number invoices server-side, void instead of delete, and settle date handling.`

---

## Part H — One data layer, typed and validated

`data.js` (879 lines) and `firebaseService.js` both talk to Firestore with overlapping jobs. `saveProjectInfo` exists in both. `updateClient` and `updateClientInfo` do the same thing in different files. A new engineer cannot know which to use, and neither can the agents.

Underneath that, **nothing validates anything.** No `zod` or equivalent, and `firestore.rules` ends the projects block with:

```
match /{allPaths=**} {
  allow read, write: if canUseProject();
}
```

Any member of a job can write a document of any shape into any subcollection. Combined with a client that validates nothing either, there is no point in the system where a malformed expense is stopped. That is how the "Invalid Date" invoices got in, and nothing prevents the next batch.

1. **Define the domain types once** in TypeScript: `Job`, `Expense`, `Invoice`, `Client`, `Supplier`, `Profile`, `Organisation`. These are the vocabulary of the product and should read as documentation.
2. **Add `zod` schemas** and parse **at the boundary in both directions**. Every read validated in, every write validated out. A document failing validation on read surfaces as a flagged row in "What needs you today", never silently dropped and never silently used.
3. **Merge the two layers into one**, organised by domain (`jobs.ts`, `expenses.ts`, `invoices.ts`, `directories.ts`). Delete `firebaseService.js`. Every function takes and returns typed domain objects, not raw documents.
4. **Replace the wildcard rule** with per-collection rules checking the fields that matter: an expense has a category and a numeric total, an invoice has a status from a known set and cannot be deleted. Rules cannot validate everything and should not try, but "this document has the right shape" is exactly what they are for.
5. **Add TanStack Query for server state.** It earns its place: caching, deduplication and background refresh in one place, which directly cuts the Firestore reads Part D is attacking, and removes a large amount of hand-rolled loading state from components.

Commit: `Collapse the two data layers into one typed, validated module.`

---

## Part I — Break up the context

`AppContext.js` is 939 lines, holds 16 pieces of state, and exports **62 values** to 17 consumers. There is not one `React.memo` in the application.

React re-renders every consumer of a context when any value in it changes. So a toast, a filter keystroke, or the supplier list loading re-renders every subscribed screen and everything beneath it. Invisible today because the data is small. It will not stay invisible. It is also the main reason the app is hard to read: a 62-key object tells a new engineer nothing about what depends on what.

Split along what actually changes together:

- **`AuthContext`** — signed-in user and profile. Changes on login and logout.
- **`OrgContext`** — organisation and open job. Shrinks a lot once Part E puts the job in the URL.
- **`DirectoryContext`** — saved workers, trades, suppliers, clients. Changes rarely; a strong candidate to become TanStack Query and stop being context at all.
- **`UIContext`** — toasts, command palette, sidebar. Changes constantly, which is exactly why it must not sit beside the data.

Then add `React.memo` to list and table components, and `useMemo` to the derived totals in `jobMetrics.js`.

Commit: `Split the application context along its real seams.`

---

## Part J — Make it multi-tenant for real

The rules already model organisations properly. The client does not. `FAMILY_ORG_ID` and the literal `opal-ss-constructions` are hardcoded through the data layer, so there is exactly one organisation the app can talk to. Meanwhile the sales page invites strangers to sign up at $50 a month.

Today a second customer is impossible. Closing this needs no data migration, only client work: **resolve the user's organisation from their membership at sign-in and carry it through the data layer** instead of reading a constant.

While doing this:

- A new sign-up with no organisation needs somewhere to land. Decide what: create an org for them, or an "ask us for access" screen. A new user hitting a blank Jobs list with no explanation is not an option.
- Prove isolation. Create a second organisation on staging and try to read the first one's data. The rules look correct; demonstrate it rather than reading them.
- Keep Opal SS Constructions working exactly as it does throughout. It is the live business.

Commit: `Resolve the organisation from membership instead of a hardcoded constant.`

---

## Part K — Tests and CI

8 test files, 502 lines, against 15,658 lines of source, all covering utilities and Firebase helpers. No component tests. Nothing runs automatically.

Do not chase a coverage percentage. Cover what costs real money when it breaks:

1. **Money** (Part F), exhaustively. Non-negotiable.
2. **`jobMetrics.js`**, which computes margin and the verdict line. The number the whole product is judged on.
3. **Invoice numbering** (Part G): generate a thousand in parallel and assert zero duplicates. This is the test that would have caught G1 years ago.
4. **Date handling** (Part G): across timezone boundaries and times of day.
5. **The zod schemas**, including malformed documents mirroring the real bad data the Phase 5 audit found.
6. **Firestore rules**, on the emulator: a stranger cannot read a profile, org A cannot read org B, a non-member cannot read a job, an invoice cannot be deleted. Parts A, G and J all make claims that should be enforced by a test rather than by careful reading.
7. **One end-to-end path**: sign in, open a job, add an expense, see the total change.

Move to **Vitest** with the Part B migration. Add a GitHub Action running typecheck, lint, test and build on every push to a phase branch.

Commit: `Add tests for money, numbering, schemas and rules, and run them in CI.`

---

## Part L — Failure, empty states, access and handover

**L1. Errors.** `ErrorBoundary` wraps two spots on one page. Everywhere else a render error is a white screen with no way out, which on a home-screen phone app with no address bar is a dead end. Put a boundary at the route level so one broken screen leaves the rest usable, give it a real message and a way back to Jobs, and report errors somewhere visible. A product with paying customers needs to learn it is broken without waiting for a phone call.

**L2. Empty states, and this matters more than it looks.** The teardown noted the second job showing a "—" margin on 5 expenses and could not check its dashboard. Dashboards built against a job with 129 expenses routinely look broken on a job with two: blank charts, `NaN%`, divide-by-zero margins.

**Every new customer starts empty.** The first thing Manpreet ever sees will be an empty state on every screen. Walk a brand-new job through every screen and make each one deliberate and encouraging rather than a gap. Phase 3 already established the right instinct here by showing "Getting started" and a dash instead of a fake `$0`. Extend it everywhere.

**L3. Access.** 5 `aria-` attributes in the whole application. Not about compliance, about a 55-year-old builder using a phone in the sun with reading glasses. Label the icon-only buttons, give every input a real label, check focus order through the expense form, verify contrast on the muted grey text, and specifically confirm the expense modal **traps focus and closes on Escape**. Restoring pinch zoom in Phase 7 was the first step of this.

**L4. Small dignity fix.** Team chips mix display names with raw email addresses, which reads as unfinished and puts client emails on screen during a demo. Resolve everyone to a display name with a role label, and show the email on hover or in detail.

**L5. Handover.** The last act of Phase 8 is to make the repo legible to someone who has never spoken to Lalit:

- Rewrite `README.md` (currently 55 lines) so a competent engineer can clone, install, point at staging and run the app in under fifteen minutes with no verbal explanation.
- Update `ARCHITECTURE.md` to describe what the app became: routes, data layer, context split, money module, rollups, bundle budget and the measured numbers.
- Update `DATABASE.md` to match the typed schemas.
- Rewrite `CLAUDE.md` for the new shape, including the TypeScript rule from Part B.
- Add an `ADR/` folder with one short note per irreversible decision: why Vite, why integer cents, why invoice numbers moved server-side, why the context was split, why organisations are resolved rather than hardcoded. **When the next engineer asks "why is it like this", the answer should be in the repo, not in a chat log.**

Commit: `Document the architecture and record the decisions behind it.`

---

## New dependencies, and why each is justified

`CLAUDE.md` bans new packages by default. Phase 8 is the exception and this is the complete list. Nothing else without asking.

| Package | Replaces | Why it earns its place |
|---|---|---|
| `vite`, `@vitejs/plugin-react` | `react-scripts`, `@craco/craco` | Current build tool is unmaintained, current config is broken |
| `typescript` | nothing | The single largest improvement to how readable this codebase is |
| `react-router-dom` | the `currentPage` switch | URLs, deep links, back button, route-level splitting |
| `zod` | nothing | Nothing validates any data anywhere today |
| `@tanstack/react-query` | hand-rolled fetch state | Cuts Firestore reads and cost, removes a lot of state code |
| `vitest` | `react-scripts test` | Comes with the Vite migration |
| `rollup-plugin-visualizer` | the broken analyzer require | Makes the bundle budget enforceable |

Removed: `@craco/craco`, `firebase/analytics` usage, and `web-vitals` if unused.

---

## Order, and what to do if time runs out

Each part is one agent session. They are ordered by risk-adjusted value.

**A** is urgent and independent. Do it this week whether or not the rest of Phase 8 happens.

**G** is close behind and can be done at any point after A. Invoice numbers colliding is a customer-facing failure with a hard deadline set by usage, not by choice, and it gets worse every invoice raised.

**B, C, D, E** are the modernisation spine. Low risk, none of them touch stored data, and each makes the next easier. **D1 alone** (counting with `getCountFromServer`) is perhaps twenty minutes for the largest cost reduction in the whole brief, so pull it forward if nothing else in D can be done.

**F, H, I, J** are the real engineering, where the app stops being a family tool.

**K, L** make it handover-ready.

**If Manpreet says yes and scaffold jumps the queue**, the parts that must still happen first are **A** (you cannot put another company's people on a platform that leaks profiles), **G1 and G2** (you cannot send a paying customer invoices that share numbers and can be deleted), and **J** (you cannot put a second company on a single-tenant app). D1 is cheap enough to take anyway. The rest can follow the scaffold work.

## Out of scope

- Offline and service worker. Still deserves its own phase, still the largest gap between the product's promise and its behaviour, still worse done badly than not at all.
- Normalising money fields already stored in Firestore. Part F handles them on read; migrating them is a separate approved job.
- Renumbering invoices already sent.
- Deleting the leftover PIN trees.
- Billing and Stripe.
- The scaffold product.
- Any production deploy beyond Part A's rules and App Check, unless Lalit names it.

## Definition of done

- A stranger who signs up can read nothing but their own profile, and a test proves it.
- Invoice numbers are server-generated, unique and monotonic, and a test generates a thousand with zero duplicates.
- No financial record can be hard-deleted, enforced in the rules.
- Job counts use aggregation queries; drawing the Jobs list does not read the ledger.
- Initial JavaScript under 250 KB gzipped, enforced by the build.
- Every screen has a URL, and a refresh lands where the user was.
- No money arithmetic outside the money module, and no `parseFloat` on a currency value anywhere.
- One data layer, typed, every read and write validated.
- A second organisation can be created on staging and cannot see the first one's data.
- Every screen has a deliberate empty state, checked on a brand-new job.
- `npm run typecheck`, `test` and `build` all pass in CI.
- A competent engineer can clone the repo and run it against staging in fifteen minutes using only the README.
