# Phase 10 — Cost Plan

Read `CLAUDE.md`, then `PROGRESS.md`, then this file. Open `design/risingamp-costplan-vision.html` before changing Cost Plan.

Working branch: **`phase-10-cost-plan`**, created from the closed Phase 9 branch. Never commit to `master` or `main`. Restore tag: `pre-phase10-2026-08-31`.

## Status

- [x] Part A — target cost and Level 1 screen — implemented on the branch, not deployed
- [ ] Part B — trade amounts and expense coding
- [ ] Part C — quotes
- [ ] Part D — spreadsheet import
- [ ] Part E — own build/client build and attention signals

Production remains Phase 9. Localhost remains on staging. The new Firestore rules have passed the emulator tests but have not been deployed to staging or production. Do not deploy unless Lalit names the project and surface.

## The call

The estimate and the ledger currently live in different worlds. Cost Plan joins them without turning RisingAMP into a takeoff or scheduling tool.

The section is the unit of an imported estimate. The trade is the durable category shared across jobs. Expenses will eventually code to trades, never to estimate sections, because sections can change when a revised estimate arrives.

Three numbers matter:

1. What was estimated.
2. What was quoted.
3. What has actually been spent.

All forecast, variance and progress figures are derived on read. Do not store a verdict.

## Rules that do not move

- A job with no cost plan behaves exactly as it did before Phase 10. No Cost Plan tab and no trade field on expenses.
- Level 1 is useful by itself: one target cost measured against active expenses.
- “Spent” means money out through expenses. It never means paid invoices.
- If the 1,000-expense cap is reached, spend and progress are hidden. A partial total is not presented as fact.
- Stored money is integer cents on every new Cost Plan record.
- The baseline is GST inclusive by default.
- No hard delete. Cost plans are draft, locked or archived; Firestore delete is denied.
- No Cloud Functions and no new packages in this phase unless a later part proves they are necessary and Lalit approves them.
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

- `/jobs/:jobId/cost-plan`, lazy loaded.
- A dismissible Overview prompt for a job with no plan.
- The Cost Plan navigation item appears only after a non-archived plan exists.
- Target, spent so far, left before target and progress.
- Target input parses through `src/money.ts` and stores integer cents.
- Spend comes from the existing active-expense total and excludes void rows.
- Capped ledgers show no spend or percentage.
- TanStack Query shares the one plan read between Sidebar, Overview and Cost Plan without adding to the AppContext ledger blob.
- Rules validate the shape, membership and immutable audit fields. Delete is denied.
- The expense read boundary now preserves labour `hours × rate` and `quantity × unitCost` totals instead of attaching a false zero `totalCents`.

Part A does not add trade rows, expense coding, quotes, imports, job kind, attention signals, archive controls or locking controls.

## Part B — trade amounts and expense coding

When Lalit asks:

- Persist the organisation trade list from the stable app defaults and allow organisation additions.
- Upgrade a plan from `target` to `trades`.
- Add optional `tradeId` to expenses plus the explicit `not-in-estimate` bucket.
- Code from History with one tap. Supplier-based suggestions are shown for confirmation and never saved silently.
- Existing expenses remain valid and appear as Uncoded until touched.

## Part C — quotes

Add `quotes/{quoteId}` documents under the job. A quote can allocate to one or more trades, carry a low/high range, record GST mode, link to a file and be received/chosen/passed. Quotes are voided or archived, never hard-deleted.

## Part D — spreadsheet import

Import spreadsheets through a column mapper, then map source sections to stable trades before saving. Duplicate or missing source codes are warnings, never identifiers. Totals must reconcile before a document is written. Keep the source spreadsheet in Files as an estimate.

PDF estimates are not parsed. Add them to Files and type trade totals.

## Part E — job kind and attention

Decide and add `job.kind: client | own`. Client builds continue to lead with margin. Own builds lead with estimate against actual and do not pretend missing invoices are a margin problem.

Only then add factual attention signals: materially over-plan quotes, spend past a chosen quote, old uncoded expenses and spend on a trade with no quote. If the data is not sufficient, say nothing.

## Out of scope

- Schedule dates, dependencies or Gantt charts
- Quantity takeoff
- Purchase orders
- Per-line expense reconciliation
- AI/PDF estimate reading
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
