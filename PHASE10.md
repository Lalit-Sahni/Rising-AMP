# Phase 10 — Cost Plan

Read `CLAUDE.md`, then `PROGRESS.md`, then this file. Open `design/risingamp-costplan-vision.html` before changing Cost Plan.

Working branch: **`phase-10-cost-plan`**, created from the closed Phase 9 branch. Never commit to `master` or `main`. Restore tags: `pre-phase10-2026-09-02` (before staging rules), `pre-phase10-2026-08-31` (this phase).

## Status

- [x] Part A — target cost and Level 1 screen
- [x] Part B — trade amounts and expense coding
- [x] Part C — quotes
- [x] Part D — spreadsheet import
- [x] Part E — own build/client build and attention signals
- [x] Staging Firestore rules — `firebase deploy --project staging --only firestore:rules` on 2 Sep 2026, then again with quote `fileIds` the same day. Localhost can save trades, quotes and an import.
- [x] Staging hosting — `firebase deploy --project staging --only hosting` on 2 Sep 2026
- [x] Production hosting — `firebase deploy --project production --only hosting` on 2 Sep 2026
- [x] Production Firestore rules — `firebase deploy --project production --only firestore:rules` on 2 Sep 2026
- [x] `checkEstimateImport` — `firebase deploy --project staging --only functions:checkEstimateImport` then `--project production` on 2 Sep 2026
- [x] `readQuoteFile` — quote photo/PDF fill; deploy by name (staging then production)

Cost Plan is live on production hosting and Firestore rules. Localhost remains on staging. Storage rules were not redeployed because they did not change: quote files use the Phase 9 Files path, already live since 31 Aug 2026. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport` and `readQuoteFile`.

## The call

The estimate and the ledger currently live in different worlds. Cost Plan joins them without turning RisingAMP into a takeoff or scheduling tool.

The section is the unit of an imported estimate. The trade is the durable category shared across jobs. Expenses will eventually code to trades, never to estimate sections, because sections can change when a revised estimate arrives.

Three numbers matter:

1. What was estimated.
2. What was quoted.
3. What has actually been spent.

All forecast, variance and progress figures are derived on read. Do not store a verdict.

## Rules that do not move

- A job with no cost plan behaves exactly as it did before Phase 10, except Cost Plan is in the job nav with an empty state. No trade field on expenses until the job has a trades or imported plan.
- Level 1 is useful by itself: one target cost measured against active expenses.
- “Spent” means money out through expenses. It never means paid invoices.
- If the 1,000-expense cap is reached, spend and progress are hidden. A partial total is not presented as fact.
- Stored money is integer cents on every new Cost Plan record.
- The baseline is GST inclusive by default.
- No hard delete. Cost plans are draft, locked or archived; Firestore delete is denied. Lock and archive are status-only writes. An archived plan can be replaced with a new draft on the same `current` document.
- No new npm packages in this phase. BOQ import is Excel or CSV in the browser. An AI check of the mapping is the named function `checkEstimateImport` (live on staging and production 2 Sep 2026).
- No production data write or deploy without the existing backup, staging and explicit-approval process.

## Data model

Part A uses one fixed document:

```text
organizations/{orgId}/projects/{jobId}/costPlan/current
  level: target | trades | imported
  targetCents
  baselineDate
  gstMode: inclusive | exclusive
  status: draft | locked | archived
  sections: []
  jobId, createdBy, createdAt, updatedAt, archivedAt
```

The fixed `current` id makes Level 1 one direct read with no query or index. Imported section lines remain inside this document later; roughly 120 estimate lines are comfortably below Firestore's 1 MB document limit.

Twenty stable app trade ids ship in `src/domain/costPlan.ts`. They stay in code during Part A because Level 1 does not write or display trade rows. Part B adds the organisation-level trade list before any expense receives a `tradeId`. Do not use the existing job `trades` collection; that collection holds saved trade contacts and means something different.

## Part A — target cost and screen

Shipped on the branch:

- `/jobs/:jobId/cost-plan`, lazy loaded. The Cost Plan nav item is on every job; with no plan the page offers a target or a BOQ import.
- A dismissible Overview prompt for a job with no plan, including an import path.
- Target, spent so far, left before target and progress.
- Target input parses through `src/money.ts` and stores integer cents.
- Spend comes from the existing active-expense total and excludes void rows.
- Capped ledgers show no spend or percentage.
- TanStack Query shares the one plan read between Sidebar, Overview and Cost Plan without adding to the AppContext ledger blob.
- Rules validate the shape, membership and immutable audit fields. Delete is denied.
- The expense read boundary now preserves labour `hours × rate` and `quantity × unitCost` totals instead of attaching a false zero `totalCents`.

Part A does not add trade rows, expense coding, quotes, imports, job kind, attention signals, archive controls or locking controls.

## Part B — trade amounts and expense coding

Shipped on the branch:

- Organisation trade list at `organizations/{orgId}/tradeList/{tradeId}`, seeded from the twenty app defaults. Organisation additions are allowed. Names can be renamed from Cost Plan **Edit categories**. The job `trades` directory is still saved trade contacts.
- A draft Level 1 plan can be upgraded to `trades` with integer-cent amounts that add up to the target (or the target is updated in the same save).
- Optional expense `tradeId`, including the explicit `not-in-estimate` bucket and **Investor**. Investor is land, legal and finance: it is not Uncoded, not construction spend, and not in Overview margin. Existing expenses stay valid and appear as Uncoded until touched.
- History one-tap coding, and the category tag (labour, trade, materials, investor, …) can be changed on History or in Edit. Retagging to Investor codes it off construction; leaving Investor uncodes it. Supplier suggestions are shown for confirmation and never saved silently.
- The expense form only asks for a cost-plan trade when the job already has a trades or imported plan.

## Part C — quotes

Shipped on the branch:

- `quotes/{quoteId}` under the job. Received, chosen or passed; voided, never hard-deleted.
- Allocations across one or more trades must sum to the quote total. A range uses the high figure in the forecast.
- GST inclusive/exclusive is stored on the quote and converted into the plan’s GST mode on read.
- Optional `fileIds` (max 10) pointing at job files, with `fileId` kept as the first pointer for older rows. The quote sheet can attach several files at once. Files can also assign a document to a live quote. Upload uses Files (`type: quote`, 25 MB, membership Storage path `files/{orgId}/{jobId}/{fileId}/…`) and stores only those ids — not a second copy of the bytes. A file sits on one live quote. Unlinking does not delete the file. Chosen quotes on overlapping trades demote the previous chosen quote to received. Quotes on a trade are listed on the Cost Plan row; tap to edit or void. Void stays on file.
- Quote form can fill from a photo or PDF via `readQuoteFile` (same OpenAI secret as receipts). Attachments sit at the top. A new file is uploaded in parallel with the read. Ticking a quote already on the job also reads it. Empty fields fill; **Read with AI** overwrites. Uncertain fields get the same Check this tint as expenses. Word/Excel and large PDFs are not read — photograph the total page. `readReceiptImage` stays receipt-only.

## Part D — spreadsheet import

Shipped on the branch:

- Column mapper for `.xlsx` / `.csv` using the existing `exceljs` package, loaded on click. A Bill of Quantities is read by row shape (`boqLayout.ts`), not as a flat table. Section vs line is the code shape `/^\d+(\.0+)?$/`. Excel formula cells go through `cellToText`. Save is allowed when the figures being saved match a **positive** figure the file itself states, when the heading amounts have been edited, or when **Save these figures anyway** is ticked. After that read is trusted, each heading amount is editable. **Add GST (10%)** is a checkbox; it is suggested when the file states both construction cost and that figure plus GST. Trade names use `TRADE_SYNONYMS`, not a model. Photos and PDFs are not parsed; export to Excel first. An AI **check** (`checkEstimateImport`) reviews the mapping only. Live on staging and production 2 Sep 2026.
- Cost is not price. The imported total is construction cost. GST or a builder's margin on top is the final price and is not the thing being matched.
- Source sections are mapped to stable trades before save. Duplicate source codes are warnings, not identifiers.
- Totals must match the target, or the imported total becomes the new target in the same save.
- The source file is kept on the job as Files type `estimate`.

## Part E — job kind and attention

Shipped on the branch:

- `job.kind: client | own`. Missing kind is treated as client. Own builds lead with estimate against actual and do not show missing invoices as a broken margin.
- Overview can switch kind. New jobs pick client or own at create.
- Attention only after the facts exist: a trade quoted well over plan, spend past a chosen quote, uncoded expenses older than two weeks once some coding has started, and spend on a trade with no quote once the job has quotes.

## Out of scope

- Schedule dates, dependencies or Gantt charts
- Quantity takeoff
- Purchase orders
- Per-line expense reconciliation
- PDF estimate parsing (photograph the pages or export to Excel)
- Automatic silent expense coding
- Billing, Stripe, offline work or a second product
- Any deployment not explicitly named by Lalit

## Definition of done for the phase

- A target-only job is useful without trade setup or a file.
- Trade-level plans work without an imported estimate.
- Imported sections map to stable trades and reconcile before save.
- Expenses never depend on an estimate section id.
- Quotes can span trades without invented line splits.
- Cost Plan numbers exclude void records and refuse partial ledgers.
- Members can use their job's plan; non-members cannot; delete remains denied.
- Jobs with no plan remain unchanged.
- Typecheck, unit tests, rules tests and build pass after every part.
- `PROGRESS.md`, `CLAUDE.md`, `ARCHITECTURE.md` and `DATABASE.md` stay current.
