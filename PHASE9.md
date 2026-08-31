# Phase 9 — Job Files (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything. Open `design/risingamp-files-vision.html` in a browser before writing any code.

Branch: create **`phase-9-job-files`** from the merged Phase 8 branch. Never commit to `master` or `main`. Tag a restore point first: `pre-phase9-2026-08-XX`.

**One part per session. One commit per part.** Phase 8 shipped seven parts in a single 86-file commit and a broken import reached production because of it. That does not happen again.

## The call, and why

The scaffold product is parked. That is clarifying rather than bad: RisingAMP is a job-costing tool for builders, and the next thing it does should make it better at that, not wider.

Three candidates were on the table.

**Offline** is the largest gap between what the product promises and what it does, and it is still the right thing eventually. It is not right now, because the people it protects are currently four family members who are on wifi half the day, and because building it badly (a captured receipt that silently vanishes) is worse than not building it.

**Finishing the Phase 8 leftovers** is necessary but it is not a phase. It is folded into Part A below.

**Job Files wins**, for four reasons that hold together:

1. **It is the real unmet need for the people using this daily.** A builder's actual questions are "where is the engineer's certificate for the slab" and "did we ever get the signed variation for that extra window". The app answers questions about money beautifully and cannot answer either of those.
2. **The infrastructure already exists and is proven.** Receipts already upload to Cloud Storage, are compressed on the way in, and are gated by job membership in `storage.rules`. This extends a working path rather than opening a new one.
3. **It is differentiated in a way generic cloud storage is not.** Dropbox does not know what a job is. RisingAMP does, because Phase 5 made jobs first-class records with stable IDs.
4. **It has a payoff a builder would pay for:** the handover pack. At the end of a job, certificates, warranties and compliance paperwork have to be handed to the client. Today that is a day of hunting through email. If the documents already live on the job, it is one button.

## The cost question, answered with numbers

The worry was that storing job files gets expensive. It does not, and the reason is worth understanding because it dictates the design.

Cloud Storage bills roughly $0.026 per GB per month to store, and roughly $0.12 per GB to serve. `src/firebase/storage.js` already compresses uploads to 1920px wide at 0.8 quality, which takes a 4 to 12 MB phone photo down to **300 to 500 KB**.

A realistic job:

| | Count | Each | Total |
|---|---|---|---|
| Site photos, compressed | 300 | 400 KB | 120 MB |
| PDFs (contracts, variations, permits, certs) | 60 | 800 KB | 48 MB |
| Plans and drawings | 10 | 10 MB | 100 MB |
| **Per job** | | | **~270 MB** |

Round up to 500 MB per job. Ten jobs is 5 GB, which costs **about 13 cents a month**. A hundred jobs costs about $1.30.

Storage is not the risk. **Serving is**, and only if it is done carelessly. A gallery that renders 100 full-size images costs 40 MB per page view. The same gallery rendering 40 KB thumbnails costs 4 MB, a tenth. And one two-minute site video costs more to store and serve than a thousand compressed photos.

So the cost answer is: **files are cheap, thumbnails are mandatory, and video is out of scope in this phase.** Three rules and the bill stays under a couple of dollars a month against $50 to $75 of revenue per customer.

## The design decision that matters most

**No folders. Not now, not later.**

The instinct is a file explorer with a folder tree. It is the wrong shape, and this is the one place to overrule the instinct.

Folders are how documents get lost. Two people file the same certificate in two different places, someone makes "Docs" next to "Documents", and six months later nobody can find the thing. That is the same disease as `72 Centenary Drive` / `72 Centenary Road` / `72 Centenary Rd`, wearing a different costume, and Phase 5 spent an entire phase curing it. Do not reintroduce it in a new feature.

Instead, every file has:

- **A job.** Always. There is no unfiled file.
- **A type**, from a fixed list: Contract, Variation, Plan, Permit, Certificate, Quote, Photo, Invoice received, Other.
- **A name and a date**, and optionally a note.
- **An optional link** to the thing it is about: an expense, an invoice, the HIA contract.

Then finding a file is search plus a type filter, both of which work on the first try and cannot be filed wrong. That is the whole idea: **the shape of the feature is a filing cabinet with labelled drawers, not a hard drive.**

## Prerequisites: Part A

These block the rest of the phase and are small. Do them first, in one session.

**A1. `storage.rules` hardcodes the organisation.**

```
function orgPath() {
  return /databases/(default)/documents/organizations/opal-ss-constructions;
}
```

Phase 8 Part J moved the client to resolving the org from membership, and left the Storage rules behind. Any file rule written in this phase would inherit the same single-tenant assumption. Fix it before adding paths: derive the org from the job document or carry it in the path.

**A2. The 1,000 expense cap.** `src/firebase/data.js` line 69 still caps expenses at 1,000, so a job past that computes margin from a subset and shows it as fact. It was named in Phase 8 and left. It is the only thing in this codebase that can make a number quietly wrong, which is the one promise the product cannot break. Paginate properly, or at minimum detect the cap and refuse to show a margin, saying plainly that there are more expenses than can be totalled.

**A3. Expenses can still be hard-deleted.** `firestore.rules` allows delete on expenses, and `data.js` calls `deleteDoc` on expenses, clients, HIA contracts and progress payments. Phase 8 gave invoices the void treatment and stopped there. Apply the same pattern, because this phase adds a whole new class of user-created records and they must inherit a soft-delete world, not a mixed one.

**A4. `exceljs` is still statically imported** at `excelExport.js:1`, so 249 KB gzipped loads when anyone opens History. The bundle budget does not catch it because the budget measures initial JS and this sits in a lazy route chunk. Make it dynamic. This phase adds an image-heavy screen and should not be piled on top of avoidable weight.

Commit: `Close the Phase 8 leftovers before adding files.`

---

## Part B — The data model and the rules

Design before UI. Propose the model, get a yes, then build.

**Firestore.** A new subcollection under the job, so it inherits the existing tenancy and membership model unchanged:

```
organizations/{orgId}/projects/{jobId}/files/{fileId}
  name            string, what the user typed or the original filename
  type            one of the fixed types above
  storagePath     string
  thumbnailPath   string or null
  contentType     string
  sizeBytes       number
  uploadedBy      uid
  uploadedAt      timestamp
  documentDate    YYYY-MM-DD, the date on the document, not the upload date
  note            string, optional
  linkedTo        { kind: 'expense' | 'invoice' | 'hiaContract', id } or null
  status          'active' | 'archived'
  archivedAt      timestamp or null
```

`documentDate` separate from `uploadedAt` matters. A certificate issued in March uploaded in August is a March document, and sorting by upload date buries it.

**Storage.** `files/{orgId}/{jobId}/{fileId}/{filename}` and `files/{orgId}/{jobId}/{fileId}/thumb.jpg`. Gate on job membership exactly as receipts already are, using the fixed `orgPath` from A1.

**Rules.** Follow the Phase 8 pattern that already works: validate the shape on create and update, and `allow delete: if false`. Archive is a status change, never a deletion. Cap `sizeBytes` in the rules as well as the client, because a client-side limit is a suggestion.

**Zod schema** in `src/domain/schemas.ts` alongside the existing ones, parsed on read and write like everything else.

Write emulator tests for the rules in the same session: a non-member cannot read a file, a member cannot delete one, an oversized file is rejected.

Commit: `Model job files and gate them on job membership.`

---

## Part C — Upload, compress, thumbnail

The cost control lives here, so build it before the browsing UI.

1. **Extend `src/firebase/storage.js`** rather than writing a parallel uploader. The receipt path already validates type, caps size and compresses; reuse it.
2. **Images:** compress to 1920px at 0.8 quality as receipts do, **and generate a 320px thumbnail** stored beside the original. The thumbnail is what every list and grid renders. Never render an original in a list.
3. **PDFs:** store as-is, no compression. Generate a first-page thumbnail if it is cheap to do client-side; if it is not, use a type icon and move on. Do not add a heavy PDF rendering library to the main bundle for this. If a thumbnail library is used at all it loads dynamically, from the file screen only.
4. **Limits, enforced in the client and the rules:** 25 MB per file, images and PDFs and common document types only. **No video in this phase.** One two-minute clip outweighs a thousand photos, and if video is wanted later it is a deliberate decision with its own cap, not something that arrives by accident.
5. **Upload must survive a bad connection.** Show real progress, allow retry on a failed file without re-picking the rest, and never leave a Firestore record pointing at a Storage object that failed to upload. Write the Storage object first, then the Firestore document.
6. **Multiple files at once**, because nobody uploads one permit.

Commit: `Upload job files with compression and thumbnails.`

---

## Part D — The Files screen

Route: `/jobs/:jobId/files`, lazy loaded, added to the job's sidebar.

**Layout, per `design/risingamp-files-vision.html`:**

- A search box that filters on name, note and type, and is the first thing in the tab order.
- A row of type filters as counts, not as bright pills. Colour lives in the data, so a type gets a small dot, never a filled badge.
- A list by default, sorted by `documentDate` descending. A grid toggle for when the job is mostly photos.
- Each row: thumbnail or type icon, name, type, document date, size, and who added it.
- Tapping a row opens a viewer: the image or PDF, its details, its linked record, and actions to rename, change type, edit the note, or archive.

**Show receipts here too.** There are already receipt images in Storage attached to expenses. If the Files screen ignores them, the app has two places where a job's documents live, which is the exact problem this feature exists to solve. Surface them read-only, typed as Receipt, linking back to their expense. Do not move or copy them.

**Empty state matters more than usual.** A new job has no files and that is the first thing a new customer sees. Make it deliberate: what to add, why it helps, and one button.

**Mobile is the primary case.** A builder photographs a permit on site. The upload control must reach the camera directly, tap targets must be big, and the whole flow must work one-handed with the Phase 7 safe areas respected.

Commit: `Add the job Files screen.`

---

## Part E — Make it answer questions

This is what turns a file list into part of RisingAMP rather than a file picker bolted on.

**Feed "What needs you today".** The panel already exists and already reads honest signals only. Add file-derived checks in exactly the same spirit, each one a fact rather than a guess:

- This job has no document typed Contract.
- An invoice over a threshold has no linked quote or variation.
- A file was uploaded with type Other and has sat untyped for more than a week.
- A Certificate has a `documentDate` older than a year, where that matters.

Follow the existing rule: **if the data to compute something honestly does not exist, say nothing.** Do not invent a check that fires on every job on day one, because a panel that always complains gets ignored and takes the real warnings with it.

**Link files to records.** From an expense or an invoice, show its attached documents. From a file, link back. The plumbing is `linkedTo` from Part B.

Commit: `Surface file gaps in What needs you today.`

---

## Part F — The handover pack

The payoff, and the part worth building carefully.

At practical completion a builder owes the client a bundle: certificates, warranties, compliance paperwork, approved plans. Today that is a day of hunting through email and a shoebox.

**Build:** a "Handover pack" action on the job that lists every file of the relevant types with a checkbox, defaults sensibly, lets the user add or remove, then produces a **single PDF** with a cover page (job name, address, date, the builder's business details from the profile) and a contents page, followed by each document. Images become full-page plates. PDFs are appended.

**Do it honestly.** If a document type that a handover normally includes is missing, the pack says so on the contents page rather than quietly omitting it. A pack that pretends to be complete is worse than one that lists what is not there.

**Do it off the main bundle.** `jspdf` is already dynamically imported after Phase 8. Keep it that way. If the merge proves too heavy client-side for a large pack, a Cloud Function is the right home, deployed **by name**, and that is a decision to bring to Lalit rather than take alone.

Commit: `Generate a handover pack from the job's documents.`

---

## Out of scope

- **Video.** Named explicitly so it does not arrive by accident.
- **Folders, nested or otherwise.** See the design decision above. If this is revisited it needs a written argument, not a preference.
- **Sharing files with people outside the org**, public links, or client portals. Real feature, real security surface, its own phase.
- **Editing documents in the app**, e-signature, version history beyond replacing a file.
- **OCR or AI on documents.** The existing receipt OCR is narrow with a safe failure mode. Reading contracts for clauses is neither. Not here.
- Offline, still awaiting its own phase.
- Billing, Stripe, the scaffold product.
- Any production deploy unless Lalit names it. New Cloud Functions deploy **by name only**.

## Definition of done

- A file can only exist on a job, and only a member of that job can read it, proved by an emulator test.
- No file can be hard-deleted, enforced in the rules.
- Every image renders from a thumbnail in every list and grid; no original is ever served into a list view.
- Uploads over 25 MB, and all video, are rejected by the client and by the rules.
- Existing expense receipts appear in Files without being moved or duplicated.
- The Files screen has a deliberate empty state, checked on a brand-new job.
- A handover pack generates and states plainly what is missing.
- Initial JavaScript still under the 250 KB gzipped budget, with the build enforcing it.
- `npm run typecheck`, `test`, `test:rules` and `build` all pass in CI.
- `PROGRESS.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `DATABASE.md` updated, and an ADR recording why there are no folders.
