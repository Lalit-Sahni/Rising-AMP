# Phase 13 — The tidy workplace (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything.

Branch: **`phase-13-query-layer`** from the merged Phase 12 branch. Tag `pre-phase13-2026-09-XX` first. One part per session, one commit per part.

**There is no AI in this phase.** Phase 14 is the assistant. Phase 13 is the structure it will stand on, and every part of it makes the existing app better on its own. If Phase 14 never happens, nothing here is wasted.

## Why this phase exists

The owner wants an assistant you can ask anything about a job. The thing that decides whether that works is not the model. It is whether the data underneath is a **tidy standardised workplace, where a search resolves because everything has a place**, or a **messy library, where every search is a new adventure.**

Phases 5 to 12 already built most of the tidy workplace: jobs with stable IDs, trades with stable IDs, files with a fixed nine-type list and no folders, money as integer cents, expenses carrying a `tradeId`, zod schemas on every entity, invoices with server-allocated numbers.

Four things are still messy, and each one is a question the assistant would answer wrongly:

| Mess | The question it breaks |
|---|---|
| Parties are free text, matched by fuzzy string compare | "What have we paid Mark this year" |
| The rollup buckets by category and month only | "How are we tracking against the plan on carpentry" |
| Rollups are per job, never org-wide | "What have we spent on concreting across every job" |
| Document text is never extracted | "What does the contract say about retention" |

Fix those four and add one typed query surface, and the assistant becomes a thin layer. Skip them and no amount of model quality compensates, because the model would be guessing at structure that does not exist.

## The rule that governs the whole phase

**Numbers are computed by code, never by a model.** Phase 14's assistant will not read your ledger and add it up. It will choose which query to run, and this phase's query layer will compute the answer with the same functions that render the Overview. That is the only way the assistant and the dashboard cannot disagree.

So every query built here must be usable by the UI as well as by a model later. If a query is only good enough for a chatbot, it is not good enough.

---

## Part A — Party identity

**The one genuine mess, and the biggest single change.**

`src/firebase/partyName.js` canonicalises names (`canonicalPartyName` strips "pty", "ltd", punctuation) and fuzzy-matches with `namesMatch`. It is good at what it was built for: deduplicating a dropdown at read time. It is not an identity system.

Today "Mark", "Mark's Joinery", "Mark Joinery Pty Ltd" and a typo are four different suppliers. Any total per supplier is a fuzzy string match, which means it is confidently incomplete. That is the same disease as `72 Centenary Drive` / `Road` / `Rd`, which Phase 5 spent a whole phase curing.

**The pattern already exists.** `partyId` is on quotes today (`src/domain/schemas.ts` line 191, `src/firebase/quotes.ts`). Extend it, do not invent a second scheme.

1. **A party record per org**: `organizations/{orgId}/parties/{partyId}` with a display name, a canonical name, a kind (supplier, worker, trade, client, service provider), optional ABN, email, phone, and `status`.
2. **Backfill** from the existing directory collections using `canonicalPartyName` to group. Where the grouping is ambiguous, **do not guess**: leave the rows unlinked and list them for the owner to merge. A wrongly merged supplier is worse than an unmerged one.
3. **Stamp `partyId`** onto expenses, invoices and quotes going forward. Keep the free-text name on the document as written, exactly as Phase 5 kept `projectName` on old invoices. The name is what was typed; the id is what it means.
4. **Merge, never delete.** Two parties merge by pointing one at the other with a `mergedInto` field. Reversible, and no row loses its history.
5. Demote `namesMatch` to what it is good at: **suggesting** a merge at entry time, in the UI, with a human confirming.

The migration follows the heightened process: staging first with a copy of production, reversible, idempotent, dry-runnable, backup before production, owner approval on the plan before any write.

Commit: `Give every supplier, worker and client a stable id.`

---

## Part B — Rollup buckets that match the questions

`functions/lib/ledgerRollup.js` buckets `byCategory` and `byMonth`. Expenses already carry `tradeId` (`schemas.ts` line 43) and, after Part A, `partyId`.

1. **Add `byTrade`** to the rollup. Roughly the same shape as `byCategory`. This makes plan versus actual per trade a single document read instead of a ledger scan, and it is the question a builder actually asks.
2. **Add `byParty`** once Part A lands.
3. **Add an org-level rollup** at `organizations/{orgId}/ledgerRollup/current`, maintained the same way, so portfolio questions do not fan out across every job.

`maintainLedgerRollup` already recomputes the whole job on any expense write, so the new buckets come from the same pass. `scripts/recompute-ledger-rollups.js` must be extended to rebuild the new shape, and the same gate holds: **a second dry-run must plan zero writes before anything reads the new buckets.**

Keep the existing rule: if a rollup and the ledger disagree, the ledger wins and the app says so.

Commit: `Bucket the rollup by trade and party, and roll the org up too.`

---

## Part C — Extract document text at upload

Files are opaque blobs today. Nothing can answer a question about what a contract says, and the Files search only matches names and notes.

1. On upload, extract text and store it in a **sibling document**, not on the file record: `…/files/{fileId}/content/text`. Keeping it separate means the file list stays small and cheap to read, which matters because Phase 11 spent a whole phase on that.
2. **PDFs**: extract embedded text. If a PDF has no text layer it is a scan; leave it and mark `textStatus: 'none'` rather than pretending.
3. **Images**: do not OCR them in this phase. Receipt OCR already exists and is narrow with a safe failure mode. General image OCR is a different problem with a worse failure mode, and it can wait for evidence anyone wants it.
4. Cap what is stored. A 200-page spec does not need every word indexed for this to be useful; store the first N characters and record that it was truncated.
5. Extraction runs in a Cloud Function on upload, deployed **by name**. It must never block the upload: the file lands first, text follows.

Commit: `Extract text from uploaded documents so they can be searched.`

---

## Part D — The query layer

**This is the standardisation.** One module of typed, parameterised, **read-only** queries with zod schemas on both the input and the output.

Start with roughly ten, drawn from the questions actually asked on a job:

```
spendByTrade(jobId?, tradeId?, from?, to?)
spendByParty(jobId?, partyId?, from?, to?)
spendByCategory(jobId?, from?, to?)
planVsActual(jobId, tradeId?)
invoicesByStatus(jobId?, status, olderThanDays?)
jobSummary(jobId)
portfolioSummary()
findFiles(jobId?, type?, text?)
findExpenses(jobId?, partyId?, text?, from?, to?)
quotesForTrade(jobId, tradeId)
```

Rules for every one of them:

- **Read-only.** No query in this module writes anything, ever.
- **Org and membership scoped**, from the caller's identity, not from a parameter. A query cannot be asked to look at another org.
- **Served from the rollup where a rollup exists.** Only fall through to the ledger when a question genuinely needs rows.
- **Returns a typed result plus its provenance**: which query ran, with what parameters, and how many rows or which rollup revision it came from. Phase 14 needs that to show its working; the UI can use it to say "as at".
- **Honest about limits.** The 1,000-expense cap must surface in the result, not be silently absorbed. A query that cannot answer completely says so.

**Build it so the UI uses it too.** That is the test of whether it is right. If a screen cannot be rebuilt on these queries, they are shaped for a chatbot rather than for the product.

Commit: `Add a typed, read-only query layer over jobs, money and files.`

---

## Part E — Make the palette answer real questions

Phase 12 built `src/components/CommandPalette.tsx` and `PaletteHost.tsx`. Extend it, do not build a second search.

1. Wire the palette to Part D so typing "concreting" on a job offers **spend on concreting**, not just matching rows.
2. Results render as **the app's own components**: a trade board, invoice rows, a file row that opens the Phase 9 viewer. Not prose, not a list of links.
3. Scope to the current job by default, with a visible chip the user can remove to go org-wide.
4. Full-text file search comes from Part C's extracted text.

By the end of this part the app answers questions **with no AI at all**. That matters: it is the proof the structure is right, and it is what Phase 14 will drive rather than replace.

Commit: `Let the command palette answer questions, not just find rows.`

---

## Out of scope

- **Any AI, any model call, any chat.** That is Phase 14. If this phase touches OpenAI, it has gone wrong.
- Writes of any kind through the query layer.
- OCR of images beyond the existing receipt scanner.
- Embeddings or a vector store. Phase 14 will decide where retrieval belongs, and it is a narrow slice.
- Moving Firestore or the functions out of `us-central1`.
- App Check enforcement.
- Deploying anything unless the owner names it. New functions deploy **by name**.

## Definition of done

- Every expense, invoice and quote written from now on carries a `partyId`, and the backfill left ambiguous rows unlinked and listed rather than guessed.
- Two parties can be merged and unmerged, and no row loses its history.
- The rollup buckets by trade and party, an org rollup exists, and the recompute gate still reports zero writes on a second dry-run.
- An uploaded PDF with a text layer is searchable by its contents within a minute; one without is marked, not faked.
- Ten typed read-only queries exist, membership-scoped, rollup-first, each returning provenance.
- At least one existing screen is rebuilt on the query layer to prove the shape.
- The command palette answers a spend question on a job with no model involved.
- Initial JS gzip still under the 275 KB ceiling. That ceiling is held, not raised.
- `npm run typecheck`, `test`, `test:rules` and `build` all pass.
