# Progress

## Phase 18 — in flight (18 Sep 2026)

Branch **`phase-18-people`**. Brief: `PHASE18.md`. Nothing deployed. Production is untouched and still runs the Phase 16/17 shopfront.

Part A is recorded (`6bd23a3`, People design). Part B is on this branch (`682b662`). **Part C is this commit:** `/people` is a real lazy org page (sidebar Main, no phone job tab). One row per person on jobs the viewer can already read. Role is one strongest pill, not a matrix. Org-remove writes only visible job documents (`invitedEmails` / `managers` / `viewers`) and leaves the org `invitedEmails` alone. Nothing deployed. Parts D–G have not started.

| Part | SHA | Initial JS gzip | State |
| --- | --- | --- | --- |
| A People design | `6bd23a3` | — | recorded |
| B Roles model + rules | `682b662` | — | on `phase-18-people` only |
| C People page | this commit | **271.5 KB** | on `phase-18-people` only |

## Phase 17 — in flight (14 Sep 2026)

Branch **`phase-17-coding-fixes`**, cut from `phase-16-job-facts` at `ac1239c`. Restore tag **`pre-phase17-2026-09-14`**. Brief: `PHASE17.md`. Nothing deployed. Production is untouched and still runs the Phase 16 build.

**Read this before trusting the older notes below.** On this branch a missing `assistantWritesEnabled` field means writes are **on**. Only an explicit `false` is off. **Production still runs the old code, where missing means off**, so every older line in this file, `CLAUDE.md`, `AGENTS.md` and `DATABASE.md` that says "missing = off" is still true of production and will be corrected when this phase ships.

| Part | SHA | Initial JS gzip | State |
| --- | --- | --- | --- |
| A switch defaults on, gate on tier and origin | this commit | **271.2 KB** | done |

Baseline at the branch point: typecheck clean, 54 files / 568 vitest tests, 168 node tests, rules pass, **271.2 KB** gzip (ceiling 400 KB).

## Fleet (11 Sep 2026)

Latest branch **`phase-16-job-facts`** (pushed; **not merged to `master`/`main`**). Restore tag **`pre-phase16-2026-09-09`** (`a3fba94`, last Phase 15 commit). Production walked **12 → 13 → 14 → 15 → 16** (hosting `index-DhMkWQ3T.js`, Firestore rules, `extractJobFileText`, `askRisingAmp`, `maintainLedgerRollup` + recompute). Kill switch stays **off**. Phase 14 Parts A–G remain on `phase-14-ask`. The model never calculates and never chooses the tier. Production backup: `backups/production-2026-09-11T12-03-06-245Z` (528 documents, 36 Storage files). Localhost stays on staging. Never `--force`. Gzip ceiling **400 KB**.

Phase 13 blockers **closed on staging**: uncoded pool; Lalit + Sydney Excavation merges; re-extract. Still the owner’s: **Metro Consulting** and the cross-kind unlinked list (`scripts/party-backfill-unlinked-staging.md`). Party backfill and file re-extract still refuse `--production`.

## Morning report (11 Sep 2026)

Phase 16 is **live** from `phase-16-job-facts` after a stepped production walk. Parts A–D are **done**. Restore tag `pre-phase16-2026-09-09` (before Phase 16). Older: `pre-phase15-2026-09-08`.

**Go-live (named, then corrected 11 Sep 2026):** first jump 12 → 16 hosting was rolled back. Then in order: Phase 12 hosting (`index-Cg6g5vL4.js`); Phase 13 `maintainLedgerRollup` update + recompute (72 Centenary Dr `costCents=79758713` / 131 live; Kelly St `costCents=1198372` investor `5574194` / 8 live; org create; second dry-run `0 write(s)`); Phase 13 hosting (`index--sURiOoC.js`); Phase 14 hosting (`index-D7s_sRBh.js`); Phase 15 hosting (`index-D5ISWnFb.js`, kill switch off); Phase 16 hosting (`index-DhMkWQ3T.js`). Firestore rules, `extractJobFileText` and `askRisingAmp` were already created on the first pass. No `--force`. Storage rules not redeployed. Shopfront https://risingamp.com.au serves `index-DhMkWQ3T.js`. **Phone:** force-close and reopen the home-screen app twice.

### Parts committed, and gzip

| Part | SHA | Initial JS gzip |
| --- | --- | --- |
| A1 party model + forward writes | `5e78dd7` | **268.3 KB** |
| A2 staging backfill | `cabc330` (+ docs `b031ee3`) | **268.3 KB** |
| B rollup byTrade / byParty + org | `649a518` | **268.3 KB** |
| C extract file text | `e3ce605` | **268.3 KB** |
| C1 staging function without `--force` | `cc5c07a` | **268.3 KB** |
| D typed query layer (Overview on `jobSummary`) | `250508c` | **270.0 KB** |
| E palette answers spend / files / invoices | `68e1a64` | **270.1 KB** |
| D amendment uncoded pool on trade answers | this commit | **270.1 KB** |
| 14A Ask router | `d675a45` | **270.1 KB** |
| 14B palette answers from the router | this commit | **270.1 KB** |
| 14C working line, uncoded, honest refusal | this commit | **270.1 KB** |
| 14D question history | this commit | **270.1 KB** |
| 14E evals, injection, scope | this commit | **270.1 KB** |
| 14F answer from documents | `b8da998` | **270.1 KB** |
| 14G teaching refusals | this commit | **270.1 KB** |
| 15A action layer | `a766751` | **270.1 KB** |
| 15B file invoice → expense | `9727a59` | **270.5 KB** |
| 15C sort uncoded to cost plan | `699220c` | **271.0 KB** |
| 15D activity view with undo | `a2ce51b` | **271.2 KB** |
| 15E evals and kill switch | `a3fba94` | **271.2 KB** |
| 16A job facts record | this commit | **271.2 KB** |
| 16B propose facts from records | this commit | **271.2 KB** |
| 16C details on Overview | this commit | **271.2 KB** |
| 16D Ask jobFacts | this commit | **271.2 KB** |

Ceiling **400 KB** (owner, 7 Sep 2026), held. Current **271.2 KB**. The build still fails on breach. Prefer smaller when free. Independent typecheck / test / test:rules / build on every accepted part.

**Staging (named):** party backfill 60 created / 183 stamped / 19 unlinked, second dry-run `0 write(s) planned`; job+org rollups recomputed (`0 write(s)` after); Firestore rules for parties, org rollup, `files/.../content/text`, askHistory `answerFromDocuments` + `refusalReason` + `jobFacts`, `facts/current`, `assistantReceipts`; `extractJobFileText` created with `retry: false`. `askRisingAmp` updated 11 Sep 2026 (jobFacts routing). Production functions are the original six plus `extractJobFileText` and `askRisingAmp` (11 Sep 2026). Production hosting and Firestore rules live the same day.

### Rejected from a worker

Nothing committed was rejected for scope. Closed and replaced, not resumed:

- First A2 worker stalled after reading; wrote no files. Fresh worker shipped A2.
- First B audit stalled on a full diff dump and never ran tests. Tight audit accepted B.

Process nits, not rejects: A2’s extra docs commit (`b031ee3`); C’s header/DATABASE claimed staging already had `extractJobFileText` before the create (fixed in C1). **Part E matcher was too weakly tested** — every case checked that a real query finds the right trade; none checked that a nonsense query returns nothing, so 279 tests still shipped an over-eager matcher.

### Decided on your behalf

- One functions-only PDF library, `unpdf@1.8.1`, not in the Vite app, so extraction does not call a model.
- `retry: false` on `extractJobFileText` only, so staging could create the function without `--force`. `maintainLedgerRollup` still `retry: true`.
- Org rollup was also written for `phase8-isolation` (empty).

### Look at this first

`scripts/party-backfill-unlinked-staging.md` — owner-named staging merges (7 Sep 2026): **Lalit → Lalit Sahni**, **Sydney Excavation and Demo → Sydney Excavation and Demolition**. Still back to the owner: **Metro Consulting / Metro Consulting Group**, plus nameless expenses, ACME SCREW PILES, and expense named Client.

## Fleet state

- **Phase 16:** live on production 11 Sep 2026 from `phase-16-job-facts`. Restore tag `pre-phase16-2026-09-09` (`a3fba94`). **Parts A–D done.** Not merged to master. Hosting `index-DhMkWQ3T.js`, Firestore rules (`facts/current`, askHistory `jobFacts`, `assistantReceipts`), `extractJobFileText`, `askRisingAmp`. Kill switch still off.
- **Phase 15:** done on `phase-15-actions`. Restore tag `pre-phase15-2026-09-08` (`176002f`). **Parts A–E done.** Palette does not execute writes. Kill switch ships off. UI and `assistantReceipts` rules live with the 11 Sep 2026 ship.
- **Phase 14:** done on `phase-14-ask`. Restore tag `pre-phase14-2026-09-07` (`0dfcb51`). **Parts A–G done.** Router callable `askRisingAmp` (`retry: false`; `gpt-4o-mini`; ADR `docs/adr-ask-model.md`) returns a route only. The palette calls it, runs `src/queries/` with membership scope, paints existing rows from `formatCents`, and shows a working line from provenance. A `none` route refuses honestly and may still show `planVsActual` / `jobSummary` figures the code already knows. Question history is `organizations/{orgId}/askHistory/{uid}/items/{id}` (question, routed choice, provenance, snapshot cents, code-assigned `refusalReason`; no model prose). CI evals: 68 cases, 21 `none`, no live OpenAI key. `answerFromDocuments` quotes a verbatim slice of `files/{id}/content/text` (scan/`none` and `error` are unreadable; weak match offers the file). Teaching refusals: `nothing_coded` / `unreadable_file` / `fact_missing` / `out_of_scope` assigned in code after the query. `askRisingAmp` is live on staging and production (11 Sep 2026).
- **Part A1:** committed `5e78dd7`. Initial JS gzip **268.3 KB**.
- **Part A2:** accepted. `cabc330` + docs-only apply record `b031ee3`. Independent proof: typecheck/test/test:rules/build, gzip **268.3 KB**, staging dry-run `0 write(s) planned`. Two-commit nit noted, not a reject.
- **Part B:** accepted `649a518`. Independent proof: typecheck, 255+40 tests, rules, build, gzip **268.3 KB**. Staging: function `maintainLedgerRollup` updated, Firestore rules released, recompute **5** writes (3 job repairs + 2 org creates). Second dry-run: `0 write(s) planned`. Schema v1. Production untouched; the recompute script refuses `--production`.
- **Part C:** done `e3ce605`. `extractJobFileText` writes `files/{fileId}/content/text` after upload (embedded PDF text / text/plain; images `none`; Word/Excel `unsupported`; 80_000 cap). No OCR. No OpenAI. No `src/` changes. Functions-only PDF lib: `unpdf@1.8.1`. Initial JS gzip **268.3 KB**. Staging Firestore rules released (nested `files/{id}/content/text` read for members, client writes denied). First create was blocked: CLI required `--force` for a new function with `retry: true`; we did not pass `--force`. Follow-up: `retry: false` on **`extractJobFileText` only** (`maintainLedgerRollup` still `retry: true`) at `cc5c07a`. Staging create succeeded without `--force`. Staging list is the original six plus `extractJobFileText`. Production still the original six. No backfill.
- **Part D:** done `250508c`. Typed read-only query layer in `src/queries/` (no barrel). Overview totals rebuilt on `jobSummary` / `useJobSummary` (same `resolveExpenseTotals` helper; ledger still wins a disagreement). `findFiles` stays off the first-paint chunk. Typecheck, 276+40 tests, rules, build. Initial JS gzip **270.0 KB** (ceiling 275). Production untouched. No deploy.
- **Part E:** done `68e1a64`. Command palette answers spend (tradeList → `spendByTrade`, rollup-first), file text (`findFiles` / Part C `content/text`), and invoice status (`invoicesByStatus`) with a visible job-scope chip (current job by default; clear for org-wide). No AI. `PaletteHost` still lazy-loads `CommandPalette`. `App.js` and `PaletteHost` have no query imports. JobFileViewer is lazy inside the palette. Typecheck, 279+40 tests, rules, build. Initial JS gzip **270.1 KB** (ceiling 275). Production untouched. No deploy. Matcher tests were positive-only; junk queries could still hit a trade via alias prefixes.
- **Part D amendment:** uncoded pool on this commit. `planVsActual` / `spendByTrade` / `spendByCategory` return `uncoded: { count, cents }` and `affected`. Uncoded = live expenses with no stored `tradeId` (`expenseTradeId` only). Trade lines stay coded-only and carry the pool; job totals stay inclusive. Palette states a non-zero pool with Code them → Cost plan. Matcher negatives: `zzzzq` / `banana-xyz` / `xx` / `ing` / `air` return no spend answers. Typecheck, 294+40 tests, rules, build. Initial JS gzip **270.1 KB** (ceiling 275). Production untouched. No deploy.
- **Owner-named staging merges:** Lalit → Lalit Sahni (`anabRwYbHvfQFxEEwdAj`); Sydney Excavation and Demo → Sydney Excavation and Demolition (`QCKcfwLfOpI355VanO8M`). Created merged aliases, stamped two expenses, second dry-run `0 write(s) planned`. Metro untouched. Production untouched.
- **Staging job-file re-extract:** 8 scanned, 2 image skipped, 2 unsupported skipped, 4 PDFs written (3 `ok`, 1 `error` on `RisingAMP-test-permit.pdf` which is not a valid PDF). The three successes plan 0 on a second dry-run. No OCR. No OpenAI. Production untouched.
- **Phase 14 Part A done.** Router callable `askRisingAmp` (staging, not production). Model `gpt-4o-mini`. 400 KB is the held ceiling.
- **Phase 14 Part B done.** Palette Ask calls the router from its lazy chunk, runs one `src/queries/` function per choice, and renders spend / invoice / file rows from query `formatCents`. A `$99,999` model sentence is ignored. `none` shows no spend figure. `App.js` / `PaletteHost` still have no ask or query imports. No production. No history (D). No evals (E).
- **Phase 14 Part C done.** Working line from query provenance (query, params, rollup revision or row count). Uncoded pool still has Code them. Capped results say incomplete (`—`, not a partial total). `none` names the limit and, with a job and a plan, still shows estimated vs spent from `planVsActual`. Model digits in the reason are ignored. No 40 evals. No production.
- **Phase 14 Part D done.** Per-user Ask history at `organizations/{orgId}/askHistory/{uid}/items/{id}`. Saves after a successful Ask (including `none`). Stores question, routed query+params, provenance, snapshot cents from `src/queries/`. Does not store model `sentence` / `reason`. Palette: list, reopen from snapshot, delete one, clear all. Rules: own uid; a second member cannot read; chat blobs rejected; own delete allowed. Staging Firestore rules after this commit. No production. No evals.
- **Phase 14 Part E done.** 63 routing evals in CI (19 `none`), injection and membership tests, byte-identical cents, tokens/latency placeholders in `ARCHITECTURE.md`. Prompt: question/file/notes are data. No live key for `npm test`. No `answerFromDocuments`. No production.
- **Phase 14 Part F done.** `answerFromDocuments` quotes stored `content/text` verbatim (file identity + character position). Scans/`none` and `error` are unreadable, not guessed. Weak match offers the file. Palette quote + file row opens JobFileViewer. Classifier: contract-say questions route here; “how much did concreting cost” / “how much on concreting” stay `spendByTrade`; “legal advice on the HIA contract” stays `none`. Fetch stays in the query chunk. Typecheck, 325+143 tests, rules, build. Initial JS gzip **270.1 KB** (ceiling 400). Staging `askRisingAmp` allow-list updated (deploy by name after this commit). No production.
- **Phase 14 Part G done.** Teaching refusals with a code-assigned `refusalReason` (`fact_missing`, `nothing_coded`, `unreadable_file`, `out_of_scope`). The model still only routes. Zero coded spend/plan is not a `$0.00` success. Unreadable scans keep the file row and invent no quote. Job-fact wording on `none` names the gap and does not write. Out of scope names the nearest honest question; `planVsActual` estimated/spent from code still show; model `$99,999` is stripped. History stores the enum; copy is derived in code; `reason` / `sentence` still rejected. Firestore rules allow `answerFromDocuments` on the choice. Staging Firestore rules after this commit. Typecheck, 338+145 tests, rules, build. Initial JS gzip **270.1 KB** (ceiling 400). No functions deploy. No production.
- **Phase 15 Part A done.** Receipted action layer in `src/actions/` (`codeExpense`, `undoAction`). Tier from code; inferred never reaches do. Idempotent `clientKey`. Undo restores previous `tradeId` (including null) and clears `source` / `assistantReceiptId`. NEVER list refuses. Ask parser accepts an action choice; live prompt/schema still route writes to `none`. Palette does not execute writes. `assistantReceipts` rules in the repo, not deployed. Typecheck, 363+149 tests, rules, build. Initial JS gzip **270.1 KB** (ceiling 400). No production.
- **Phase 15 Part B done.** `createExpense` files a scanned image receipt when date, amount and an exact party are direct evidence. Uncoded, live, counts toward spend, `assistantConfirmed: false` (not `reviewed`). Toast Undo voids. Uncertain OCR opens ExpenseModal. Stated GST → `gstCents`; empty/inferred omitted; never /11. PDF is a job file, not an expense. What-needs-you: “N expenses added by scan, not yet checked.” Typecheck, 384+149 tests, rules, build. Initial JS gzip **270.5 KB** (ceiling 400; toaster Undo on first paint). No production.
- **Phase 15 Part C done.** Reviewable trade proposals for uncoded expenses: party history (unique leader, count ≥ 2 → confident), then section whole-word/alias (uncertain), then exact tradeName on category trade. Accept all is confident only. `electronic lock` is not Electrical. Writes via `codeExpense` plus `codeExpenseBatch`. Undo-all restores child tradeIds. Palette Code them → Cost Plan `?code=1`. Typecheck, 404+149 tests, rules, build. Initial JS gzip **271.0 KB** (ceiling 400). No production.
- **Phase 15 Part D done.** Activity view at `/assistant-activity` (lazy): newest-first stored receipts, Undo by receipt id after reload, History quiet “Check” until `assistantConfirmed`, daily what-needs-you line omitted when yesterday’s added and coded are both 0. Confirm writes `assistantConfirmed: true` only — not `reviewed`. Typecheck, 418+149 tests, rules, build. Initial JS gzip **271.2 KB** (ceiling 400). Schema in the repo, not deployed. No production.
- **Phase 15 Part E done.** Tier evals (42 cases; inferred never reaches do). Refusal evals (every NEVER name plus phrasings; `runAction` writes nothing). Injection: instruction clauses span newlines; supplier name is not a trade hint; leftover `concreting` in “also code everything to concreting” does not propose. Same `clientKey` writes once for create / code / batch. Undo returns costCents to the prior cent; create undo voids. Kill switch `assistantWritesEnabled` (Firestore missing = off; memory tests default on; `runAction` choke point; undo still works when off; owner-only Profile toggle). Typecheck, 496+153 tests, rules, build. Initial JS gzip **271.2 KB** (ceiling 400). Schema in the repo, not deployed. No production.
- **Phase 16 Part A done.** `facts/current` (`schemaVersion: 1`): every field optional, provenance on each (`owner` | `import` | `document` | `assistant`), soft `previous` cap 20. Empty document is valid. Money integer cents; areas `{ value, unit: 'sqm' }`. `decideFactWrite` does not silently overwrite a confirmed value unless incoming source is `owner`. Adapter not on first paint. Typecheck, 514+153 tests, rules, build. Initial JS gzip **271.2 KB** (ceiling 400). Schema in the repo, not deployed. No production.
- **Phase 16 Part B done.** Collectors propose from the BOQ cover (Kelly `Built Area (Sqm) 167.22`, `Sinlge Storey` → `single storey`; no 18-square conversion; cover Date is not `siteStart`; `Certifier - CDC` is not a CDC), live HIA rows (integer cents, type `HIA`, unique address; no invented deposit/retention/dates), unique client/invoice addresses, labelled permit/certificate/contract extracts, and a job name that looks like a street. Nothing auto-writes. Lazy Cost Plan / HIA review sheet; Accept → `saveJobFacts`. Re-import is how floor area appears on an already imported plan. Typecheck, 541+153 tests, rules, build. Initial JS gzip **271.2 KB** (ceiling 400). Schema in the repo, not deployed. No production.
- **Phase 16 Part C done.** Details live on Overview (no new route). Lead: address / floor area / contract value only when stored; job-name address is not repeated; Contract KPI stays paid invoices. Lazy `JobFactsPanel`: grouped, in-place edit, quiet source (not a pill), unconfirmed reads Not confirmed. One what-needs-you line when existing unconfirmed count > 0; Review scrolls to Details. Handover prefers facts address; invoices may show site under Job (Bill to unchanged; HIA claims omit the prop). Export may carry job identity. Typecheck, 556+153 tests, rules, build. Initial JS gzip **271.2 KB** (ceiling 400). Schema in the repo, not deployed. No production.
- **Phase 16 Part D done.** Read-only `jobFacts` query. Ask answers stored facts (Kelly 167.22 sqm from import, unconfirmed names the cost sheet). Missing is `fact_missing` and opens Overview — Ask does not write. Spend-on-council/CDC/bedrooms and cost-per-sqm stay `none`. Function source and askHistory rules in the repo, **not deployed**. Typecheck, 568+168 tests, rules, build. Initial JS gzip **271.2 KB** (ceiling 400). No production.
- **Dependency rule:** root Vite `package.json` takes **no new packages**. Functions may add **one** PDF-text library (`unpdf@1.8.1`). It is not imported from `src/`. It does not change initial JS gzip. No OpenAI SDK.

## Current branch

`phase-16-job-facts` — Phase 16 the job knows itself, **Parts A–D live on production 11 Sep 2026**, **not merged to `master`/`main`**. Parent: `phase-15-actions` (Parts A–E). Record: `PHASE16.md`. Parent: `phase-14-ask` (Parts A–G). Phase 12 is **closed** and **live on production hosting** (6 Sep 2026). Record: `PHASE15.md`. Phase 11 Parts A–E remain **live on production** (5 Sep 2026); `maintainLedgerRollup` was not redeployed this go-live. Localhost still uses `.env.local` → staging (`VITE_FIREBASE_PROJECT_ID=rising-amp-staging`).

Restore tags: `pre-phase16-2026-09-09` (this phase, before code; SHA `a3fba94`), `pre-phase15-2026-09-08` (SHA `176002f`), `pre-phase14-2026-09-07`, `pre-phase13-2026-09-06`, `pre-phase12-2026-09-05`, `pre-phase11-2026-09-05`, `pre-phase10-2026-09-02` (before staging rules), `pre-phase10-2026-08-31`, `pre-phase9-2026-08-31`, `pre-phase8-2026-08-28`, `pre-phase7-2026-08-28`, `pre-phase6-2026-08-27`, `pre-phase1-2026-08-22`

Production: `rising-amp-467702-b5` — https://risingamp.com.au (same app as https://rising-amp-467702-b5.web.app)  
Staging: `rising-amp-staging` — localhost / `.env.local`  
`.firebaserc` default is **staging**. Git push does not deploy.

## Where we are (2026-09-06)

**Phase 12 is closed and live on production hosting (6 Sep 2026).** `firebase deploy --project production --only hosting`. No functions, Firestore rules or Storage. Branch `phase-12-fables-upgrade`. Scan a receipt on Add expense is a white `--surface` card (was `steel-900`); verified on localhost as Lalit, 72 Centenary Dr, `rgb(255, 255, 255)`. Typecheck, 254 tests, build **267.9 KB** gzip (ceiling 275). Front-end only: no rules, functions, schema or data writes. Full detail: `PHASE12.md`. Ultrareview PRs #1–#4 were closed unused; the empty-base branches are gone.

**Next:** Phase 16 is **done on `phase-16-job-facts`**. Do not merge. Do not deploy Phase 13–16 until he names the project and surface (`askRisingAmp`, Firestore rules for `facts/current` + askHistory, hosting).

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

Part E initial JS gzip **272.7 KB**. That phase held **275 KB** (moved 250 → 275 in Part B because IndexedDB persistence cannot be split out of `firebase/firestore`). Owner raised the held ceiling to **400 KB** on 7 Sep 2026; the build still fails on breach. Part D was **272.6 KB**. Part C was **272.5 KB**. Part B was **270.0 KB**.

**Not done, and next:** Phase 16 Part B (propose job facts from estimate, contract, invoices). Part A is done. 400 KB remains the held ceiling.

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
Read CLAUDE.md, then PROGRESS.md, then PHASE16.md, then PHASE15.md.

Latest branch is phase-16-job-facts. Restore tag pre-phase16-2026-09-09.
Phase 16 Parts A–D are live on production (11 Sep 2026): hosting,
Firestore rules, extractJobFileText, askRisingAmp. Not merged to master.
Phase 15 UI and assistantReceipts rules went with that ship; kill switch
stays off. The model never calculates and never chooses the tier.
Localhost stays on staging. Deploy nothing unless named. Do not
recompute production rollups unless named.

400 KB is the held ceiling (now 271.2 KB). The build still fails on breach.
Look first: scripts/party-backfill-unlinked-staging.md.

Never cache Firestore, Cloud Function or Storage responses in
the service worker. Never hard-delete user records. Never accept
a pasted API key.
```

## Remaining work

0. **Phase 12 review and hosting deploy** — **done** 6 Sep 2026. Production hosting live. See `PHASE12.md`.
1. **Phone check on production** — force-close, reopen, Overview totals vs History on a known job. Hosting, function, rules and recompute are already live (5 Sep 2026).
2. Click through Cost Plan on the live shopfront (sidebar **Cost plan**, then a target, trades or an import). Localhost stays on staging. In-agent browser click-through of Overview vs History is still not done.
3. Optional leftovers (not unless he asks): App Check **enforcement**; `PHASE6-INTEGRITY.md`; live Resend invite proof then remove Gmail fallback; `www` SSL; forward `privacy@risingamp.com.au`; money-field migration; dismantle remaining AppContext ledger/directory blob.
4. Home-screen icon / `manifest.json` if he later wants a real installed-app icon.
5. Offline queue / queued writes — still its own phase. The Part A worker caches the shell only.
6. **Phase 16 Parts B–D** — done and live on production 11 Sep 2026. Force-close and reopen the home-screen app twice.

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
- [x] Phase 12 — owner review, then production hosting
- [x] Phase 13 Part A1 — party model + forward writes
- [x] Phase 13 Part A2 — backfill on staging
- [x] Phase 13 Part B — rollup byTrade / byParty and org rollup
- [x] Phase 13 Part C — extract document text at upload
- [x] Phase 13 Part D — typed read-only query layer (Overview on `jobSummary`)
- [x] Phase 13 Part E — command palette answers real questions
- [x] Phase 13 Part D amendment — uncoded pool on trade/plan answers; matcher negatives
- [x] Phase 13 `extractJobFileText` live on production (11 Sep 2026)
- [x] Phase 13 production rollup byTrade / byParty (`maintainLedgerRollup` + recompute, 11 Sep 2026)
- [ ] Phase 13 owner list — merge or leave unlinked parties on staging
- [ ] Phase 13 production party backfill — script still refuses `--production`
- [x] Phase 14 Part A — Ask router callable (`askRisingAmp`, staging after this commit)
- [x] Phase 14 Part B — palette answers from the router
- [x] Phase 14 Part C — working line, uncoded pool, honest refusal
- [x] Phase 14 Part D — question history
- [x] Phase 14 Part E — evals and guardrails
- [x] Phase 14 Part F — answer from a document
- [x] Phase 14 Part G — a refusal that names what is missing
- [x] Phase 15 Part A — receipted, undoable action layer
- [x] Phase 15 Part B — dropped invoice → expense
- [x] Phase 15 Part C — propose trades for uncoded expenses
- [x] Phase 15 Part D — activity view with undo
- [x] Phase 15 Part E — tier/refusal/injection/undo tests and kill switch
- [x] Phase 16 Part A — facts record with provenance
- [x] Phase 16 Part B — propose facts from estimate, contract, invoices
- [x] Phase 16 Part C — Details panel, overview, what-needs-you
- [x] Phase 16 Part D — Ask answers job facts
- [x] Phase 16 live — production hosting, Firestore rules, extractJobFileText, askRisingAmp (11 Sep 2026)

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
