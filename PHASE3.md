# Phase 3 — Vision (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file. Open `design/risingamp-vision.html` in a browser before touching code.

Phase 1 (login, org, job lists) and Phase 2 (Manrope restyle) are **live**. Phase 3 UI is on `phase-3-vision` against **staging / localhost** after Lalit’s GO (2026-08-23). Do not re-run cutover. Do not restyle tokens. Do not deploy to production until Lalit asks after this work is done.

This is the **same family app and the same data**. The vision is: lead with one honest answer (is this job making money), then the handful of things that need attention. It is not a second product, not billing, not Stripe.

---

## What this phase is

The tracker already records the past. This phase reads it back. Same numbers, a tool that has your back.

Look source: `design/risingamp-vision.html` (also at the repo root as `risingamp-vision.html`). Its `:root` already matches Phase 2 (Manrope, Palette 1). Do not invent extra colours. Do not paste the HTML into React.

## The three screens in the mockup

1. **Jobs** — all jobs in one list, with margin / status / “needs you”, plus a portfolio strip.
2. **Job overview** — a verdict banner first, then stats, “what needs you today”, cash, category spend, recent.
3. **Capture** — scan fills vendor / amount / category; if it is unsure, it flags the field instead of saving quietly.

## Mockup vs live app (do not build mockup-only features)

| In the mockup | Live app today | Phase 3 |
|---------------|----------------|---------|
| Jobs as home, all jobs visible | Chooser, then one job at a time (`ProjectPicker` → dashboard) | **Shipped on localhost/staging.** Jobs home lists invited jobs. |
| Combined margin / “need attention” across jobs | Numbers exist per job, not as a portfolio | **Shipped.** Display only from existing expenses + invoices. |
| “New job” button | **Does not exist.** Owner creates job lists by hand | **Skipped.** No create-job write. |
| Brand “RisingAMP” | Sidebar said “Opal Track” | **Shipped in the UI** (not Firebase project / collection ids). |
| Verdict “On track / margin at risk” | Dashboard had stats, no one-line verdict | **Shipped.** Derived from paid invoices vs spend. |
| “What needs you today” | Unreviewed / uncategorized alerts exist | **Shipped.** Display only (missing dates, missing receipts, unreviewed if the field is in use). |
| Scan “Check this” on unsure fields | OCR fills a form; no explicit uncertainty flag | **Shipped** from missing/invalid extracted fields and scanner warnings. Not from a fake 85% score. |
| Budget tracking / HIA / Clients in nav | Those pages exist | **Kept.** Under sidebar **More**. |

---

## Scope and order (propose, then do)

Work on branch **`phase-3-vision`** created from **`phase-2-visual`** (the live look). Never commit to `master` or `main`. Localhost stays on staging. Do not write to production Firestore. Do not deploy functions.

### Step 0 — Branch + mockup only (no app code)

**Done (2026-08-23).** Branch `phase-3-vision` exists. Look source is `design/risingamp-vision.html`.

### After yes (localhost / staging)

**Done on this branch against staging.** Job overview, jobs home, RisingAMP naming, OCR check-this from real signals. New job create skipped. Production not deployed. See `PROGRESS.md`.

---

## Out of scope until asked

- Creating job lists, billing, Stripe, a second product
- Deploying functions, deleting PIN folders
- Pasting the vision HTML into the React app
- Production hosting deploy until he asks after this phase looks right
- Enabling email/password on **production** Auth (staging is already on)

---

## How to preview

- Day-to-day: `npm start` → http://localhost:3000 → **staging**
- Live (do not overwrite until asked): https://rising-amp-467702-b5.web.app
- Vision mockup: `design/risingamp-vision.html`
- Phase 2 look (what is live now): `design/opal-track-reference.html`

## Continuity

Keep `CLAUDE.md` and `PROGRESS.md` current. Small diffs. Propose, then wait, then do. Talk in plain language.
