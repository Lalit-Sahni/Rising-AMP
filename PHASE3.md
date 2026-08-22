# Phase 3 — Vision (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file. Open `design/risingamp-vision.html` in a browser before touching code.

Phase 1 (login, org, job lists) and Phase 2 (Manrope restyle) are **live**. Do not re-run cutover. Do not restyle tokens. Do not deploy to production until Lalit asks after this work is done.

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
| Jobs as home, all jobs visible | Chooser, then one job at a time (`ProjectPicker` → dashboard) | Propose first. Cross-job list is new UX, same job documents. |
| Combined margin / “need attention” across jobs | Numbers exist per job, not as a portfolio | Display only from existing expenses + invoices. Do not invent new stored fields until asked. |
| “New job” button | **Does not exist.** Owner creates job lists by hand | **Do not add** until Lalit explicitly says yes |
| Brand “RisingAMP” | Sidebar says “Opal Track” | **Do not rename** the live app until he says yes |
| Verdict “On track / margin at risk” | Dashboard has stats, no one-line verdict | Display only, derived from paid invoices vs spend. Show the rule before shipping it. |
| “What needs you today” | Unreviewed / uncategorized alerts exist | Display only from data already there (missing dates, missing receipts, unreviewed). Do not fake items. |
| Scan “Check this” on unsure fields | OCR fills a form; no explicit uncertainty flag | Restyle/confirm UX on the existing scanner. Do not change how totals are calculated. |
| Budget tracking / HIA / Clients in nav | Those pages exist | Keep them working. Do not drop them because the mockup hid them. |

---

## Scope and order (propose, then do)

Work on branch **`phase-3-vision`** created from **`phase-2-visual`** (the live look). Never commit to `master` or `main`. Localhost stays on staging. Do not write to production Firestore. Do not deploy functions.

### Step 0 — Branch + mockup only (no app code)

**Done (2026-08-23).** Branch `phase-3-vision` exists. Look source is `design/risingamp-vision.html`. Nothing in `src/` was changed. Waiting for a yes on the mockup-vs-live table above.

1. Create `phase-3-vision` from `phase-2-visual`.
2. Confirm `design/risingamp-vision.html` is the look source.
3. Change **nothing** in `src/`. Tokens and Manrope are already live from Phase 2.
4. Show Lalit this file’s mockup-vs-live table. Get yes on what is in scope. Wait.

### Then, only after yes, screen by screen

Keep every existing control working. Same auth, same job invites, same calculations unless a display rule was approved.

1. Job overview verdict + “what needs you” (inside the current job, no new job list yet)
2. Capture “check this” on the existing OCR confirm step
3. Jobs portfolio (all invited jobs in one list) — only if Step 0 got a yes
4. Anything named “New job” or a live rename to RisingAMP — only if he asks in so many words

---

## Out of scope until asked

- Data, schema, Firestore writes, Storage, auth, invite backend
- Creating job lists, billing, Stripe, a second product
- Deploying functions, deleting PIN folders
- Pasting the vision HTML into the React app
- Production hosting deploy until he asks after this phase looks right

---

## How to preview

- Day-to-day: `npm start` → http://localhost:3000 → **staging**
- Live (do not overwrite until asked): https://rising-amp-467702-b5.web.app
- Vision mockup: `design/risingamp-vision.html`
- Phase 2 look (what is live now): `design/opal-track-reference.html`

## Continuity

Keep `CLAUDE.md` and `PROGRESS.md` current. Small diffs. Propose, then wait, then do. Talk in plain language.
