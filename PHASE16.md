# Phase 16 — The job knows itself (agent brief)

Read `CLAUDE.md`, `PROGRESS.md`, `PHASE14.md`, `PHASE15.md`, then this. Branch **`phase-16-job-facts`**. Tag a restore point first. One part per session, one commit per part.

## Why this exists

The owner asked Ask how many square metres the house is. It could not answer. Three reasons, and only the third one matters:

1. `findFiles` returned a document instead of a fact. Phase 14 Part F fixes that.
2. Site plans are drawings with no useful text layer.
3. **The app does not know a single fact about the job.** `jobSchema` has a name, a status, a kind and an invite list. No address, no floor area, no storeys, no lot and DP, no council, no contract value, no dates.

That third one is the real gap and it is not an AI problem. An assistant can only be as good as what the app knows, and RisingAMP knows money and knows that documents exist. It does not know the job.

Here is the sting: the BOQ importer **already reads** `Built Area (Sqm) 167.22` out of the owner's estimate. It parsed 22 sections and $321,916.29 from that same file. Then it discarded the floor area, because nothing asked for it.

**The principle for every future phase:** when Ask fails, first ask whether the answer should be a fact the app stores. Reach for better retrieval only when it should not be.

---

## Part A — The facts record

`organizations/{orgId}/projects/{jobId}/facts/current`. One document, zod schema, versioned like the cost plan.

Every field is **optional, typed, and carries where it came from**:

```
value      the fact
source     'owner' | 'import' | 'document' | 'assistant'
sourceRef  the file id, import id, or null
confirmedBy / confirmedAt   set when a human agreed
updatedAt
```

The provenance is not bookkeeping. It is what lets an answer say *"167.22 sqm, from the cost sheet you imported, not yet confirmed"* rather than stating it flatly. A fact nobody has confirmed is still useful; pretending it is confirmed is not.

**The fields**, chosen because a builder asks about them constantly:

- Site: address, suburb, postcode, lot and DP, council, zoning
- Building: floor area (sqm), site area (sqm), storeys, bedrooms, bathrooms, garage spaces, build type
- Commercial: contract value, contract type, deposit, retention percentage
- Dates: contract signed, site start, practical completion target, actual practical completion
- Compliance: builder licence, HBCF certificate number, CDC or DA number, certifier

Rules that hold for all of them:

- **Nothing is required.** An empty fact is normal and honest. Never invent a default.
- **Money is integer cents**, through the Phase 8 money module, no exceptions.
- **Areas are numbers with a stated unit**, always sqm, never a free-text string.
- **No field is ever silently overwritten.** A new value from a different source is a proposal, not a write, unless a human confirmed nothing before it.
- Soft everything: history is kept, the current value points at the one in force.

Rules and emulator tests as usual: members read, org-invited write a valid shape, delete denied.

**Part A done.** A job can hold `facts/current` (`schemaVersion: 1`): every field optional, every present field a value with source (`owner` | `import` | `document` | `assistant`), sourceRef, confirmation and a soft `previous` cap of 20. Empty `{ jobId, schemaVersion: 1, updatedAt }` is valid; nothing invents 0 sqm or $0. Money is integer cents; areas are `{ value, unit: 'sqm' }`. `decideFactWrite` never silently overwrites a confirmed value unless the incoming source is `owner`; otherwise it proposes (proposals are not persisted this part). Domain `src/domain/jobFacts.ts`, adapter `src/firebase/jobFacts.ts` (not imported from App.js / PaletteHost). Members read/write a valid shape; delete denied; extra keys denied. Schema in the repo; not deployed. Production untouched.

Commit: `Give a job a facts record, with provenance on every field.`

---

## Part B — Fill it from what you already have

Typing thirty fields per job is how this feature dies. Almost all of it is already in the app.

1. **The BOQ import.** `boqLayout.ts` already walks the header block where `Built Area (Sqm)` sits. Capture that labelled area instead of discarding it. This is the smallest change with the largest payoff and it is what started this phase. The cover `Date` is the estimate’s date, not a job fact — do not map it to `siteStart` or any date field.
2. **The HIA contract**: contract value and type when stored. Do not invent dates, deposit or retention the form does not keep.
3. **Invoices and client details**: the client, and often the site address.
4. **Documents** (needs Phase 14 Part F): a CDC or DA number, a licence number, a certifier off a permit or a certificate.
5. **The job name** is frequently the address. Offer it, never assume it.

Every one of these arrives as a **proposal with its source**, shown in one place: *"From your cost sheet: floor area 167.22 sqm. Correct?"* Accept, edit, or dismiss. Nothing auto-writes on the first pass.

**Do not OCR drawings to read dimensions.** A vision model reading a figure off a plan will be confidently wrong eventually, on a number somebody prices work from. That is the scaffold-stock-photo idea the owner already rejected, in a new costume. The floor area is a fact a human confirms once, not one inferred from a drawing on every question.

**Part B done.** Importing a bill of quantities proposes cover facts instead of discarding them: Kelly St `Built Area (Sqm) 167.22` (unit always `sqm`, source `import`) and `Sinlge Storey` as `single storey`. `18 Square` is not converted. The cover `Date` (29/5/2026) is the estimate’s date, not `siteStart` or any date field. A BOQ line `Certifier - CDC` is not a CDC number. Live HIA rows propose `contractValueCents` (integer cents from `totalAmount`), `contractType` `HIA`, and a non-empty client address; the form does not store deposit, retention or signed dates, so those are not invented. Unique live client / invoice addresses propose `address`; two different addresses propose nothing from that source. Permit / certificate / contract `content/text` (`ok` / `truncated` only) may propose a labelled CDC/DA, builder licence or certifier; `none` / `error` is a scan, not a guess; plan files are not read. A job name that looks like a street is offered as `address`, never assumed. One proposal per field; import beats document beats job name. `decideFactWrite` `keep` is not shown; a confirmed conflict is shown as blocked and is not written on Accept-all. Edited values save as `source: 'owner'`. Writes go through `saveJobFacts` after Accept (`confirmedBy` / `confirmedAt` set). The review sheet is lazy from Cost Plan (after a successful import, and from **Review job details** for existing HIA / clients / invoices / job name / files) and from HIA after a successful save. Floor area from an already imported plan cannot be recovered — the cover was discarded and Excel extracts are unsupported; re-import is how 167.22 appears. Not imported from App.js / PaletteHost / Header. Production untouched.

Commit: `Propose job facts from the estimate, the contract and the invoices.`

---

## Part C — Where facts live in the product

- A **Details** panel on the job: grouped, quiet, editable in place, each field showing its source on hover or tap. Unconfirmed values are visibly unconfirmed.
- **Job overview** leads with the two or three that matter: address, floor area, contract value.
- **"What needs you today"** gains one honest item: *"5 job details are unconfirmed."* Only when there is something to confirm, and only once, never nagging.
- Facts flow into what already exists: the handover pack cover page, the invoice header, the export.

Follow the design system. Facts are data, so a source marker is a small dot or a quiet label, never a coloured pill or a tinted card.

**Part C done.** Job details live on Overview (`/jobs/:jobId`), not a new route. The lead under the job title shows address, floor area (`{value} sqm`) and contract value (`formatCents`) only when those facts exist; an address that equals the job name is not repeated; the Contract / Cost-to-date KPI cards stay paid-invoice / spend figures. A grouped Details panel (Site / Building / Commercial / Dates / Compliance) is lazy (`JobFactsPanel.tsx`): present fields only, in-place edit, quiet source (11px slate label or a 7px hairline dot — never a pill), unconfirmed reads `Not confirmed`, empty groups stay quiet behind **Add a detail**. Empty strings / 0 sqm / $0 are not saved. `facts/current` is fetched with a dynamic adapter import and fails quiet (rules still not deployed). `unconfirmedJobFactCount` plus `withJobFactsAttention` add one what-needs-you line when the count is above 0; Review scrolls to Details. Owner edits go through `saveJobFacts` with `source: 'owner'`. The handover cover prefers `facts.address` when present, else the client address, and may add floor area / contract value only if stored. Invoices take an optional `siteAddress` under Job (Bill to stays the client; HIA claims omit the prop). Expense export still works as two arguments and may title/subtitle a job name and present fact strings. Not imported from App.js / PaletteHost / Header. Dashboard does not static-import the adapter or the proposal sheet. Production untouched.

Commit: `Show job details where they belong, with their source.`

---

## Part D — Ask can answer them

1. A read-only query, `jobFacts(jobId, field?)`, in `src/queries/`, same discipline as the other ten.
2. The router routes to it. "How many square metres is the house", "what is the address", "what is the contract value", "when is PC" all resolve to a field lookup. Instant, exact, no model reading a document.
3. **An answer states the source when the fact is unconfirmed**: *"167.22 sqm, from the cost sheet you imported. Nobody has confirmed it yet."*
4. **A missing fact refuses usefully**, per Phase 14 Part G: *"The floor area is not recorded on this job."* with an action to add it. After Phase 15 that action can write it with the owner's confirmation.

Commit: `Let Ask answer a question about the job itself.`

---

## Out of scope

- OCR or vision on drawings. Named twice on purpose.
- Anything that computes a fact rather than recording one. Floor area is entered or imported, never derived from a rate.
- A property-data integration. Later, and it would still land as a proposal.
- Scaffold, billing, production deploys unless the owner names them.

## Definition of done

- A job carries typed facts, every one optional, every one with a source.
- Importing a BOQ proposes the floor area from a labelled Built Area (Sqm). The cover Date is the estimate’s date, not a job fact.
- The HIA contract proposes the stored contract value (integer cents) and type. Dates, deposit and retention are not invented when the form does not store them.
- Nothing auto-overwrites a fact a human confirmed.
- "How many square metres is the house" answers from a field, states its source, and refuses usefully when the field is empty.
- Money is cents, areas are numbers in sqm, and no drawing was read by a model.
