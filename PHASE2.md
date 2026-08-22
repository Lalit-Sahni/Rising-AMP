# Phase 2 — Visual overhaul (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file. Open `design/opal-track-reference.html` in a browser before touching CSS. That file is the Manrope + Palette 1 look (`opal-track-MANROPE_P1.html` is the same mockup).

This is a **restyle, not a rewrite.** Behaviour, data, routes, auth, Firestore, and calculations must not change. If a change alters what the app does rather than how it looks, it is out of scope.

This is a **restyle, not a rewrite.** Behaviour, data, routes, auth, Firestore, and calculations must not change. If a change alters what the app does rather than how it looks, it is out of scope.

Phase 1 is already live (Google login, org, job picker, per-job invites). Do not rebuild auth. Do not re-run cutover.

---

## What this phase is

Put Opal Track onto one disciplined design system taken from the mockup. Same screens, same buttons, same numbers — new clothes.

## The design reference

`design/opal-track-reference.html` is the look source of truth (Manrope + Palette 1).

- Its `:root` block is the token system. Copy those values. Do not invent extra colours.
- Its sections (sidebar, stat cards, category cards, quick actions) show the target treatment.
- It is a **reference to match**, not code to paste into React. Recreate the language with the app’s own components.

The mockup is a concept. It includes things the live app does **not** do. Do not add those (see “Mockup vs live app” below).

---

## Tokens (from the reference `:root`)

```
--steel-900: #17181C    sidebar, headings on dark
--steel-800: #1F2127
--steel-700: #2A2D34
--ink:       #1C1E23    body text on light
--slate-600: #565B64    secondary text
--slate-400: #8A9099    labels, muted
--hairline:  #E7E9EC    borders
--canvas:    #F5F6F8    page background
--surface:   #FFFFFF    cards
--accent:    #E85D1A    hi-vis orange — the only brand accent
--accent-600:#C64E12    hover
--accent-tint:#FCEEE4   selected fill
--pos:       #2E7D57    whispered positive (paid, remaining)
--neg:       #C0392B    whispered negative (over budget)
--c-labour:  #5E82A6    data ink only
--c-trade:   #C08A3E
--c-materials:#B5654A
--c-service: #4E8C82
--c-equipment:#7E9B63
--radius:    12px
--radius-sm: 8px
--shadow:    0 1px 2px rgba(23,24,28,.04), 0 1px 3px rgba(23,24,28,.03)
--ui:        Manrope, system-ui, sans-serif
```

Rules of the look:

- **One brand accent only.** Orange for primary buttons, the active nav marking line, the primary metric’s thin top line, selected states. Everything else stays steel / ink / hairline.
- **Colour lives in the data, never on the furniture.** Category colour appears only in dots, icons, and chart bars. Cards, panels and backgrounds stay white or canvas. No tinted card fills. No coloured bars down the side of cards. No filled bright category pills — a 7px dot plus the label is enough.
- **Borders over shadows.** Hairline `#E7E9EC`. The mockup’s `--shadow` is a whisper, not a glow.
- **Type.** Manrope for everything. Money, counts, and dates use `font-variant-numeric: tabular-nums` (the `.tabular` class). Do not load a second display font.
- **Signature.** A 2–3px orange marking line: active sidebar item (left edge) and the primary stat card (top edge). Keep every accent thin.

Current Tailwind already has a different orange (`#ea580c`) and `brand-black`. Phase 2 replaces those with the tokens above. Do not keep both systems.

Prefer loading Manrope via Google Fonts in `public/index.html` (no new npm package). Keep **lucide-react** (already in the app). Do not add another icon library.

---

## Mockup vs live app (do not build mockup-only features)

| In the mockup | Live app today | Phase 2 |
|---------------|----------------|---------|
| Continue with Google | Exists (`LoginScreen.jsx`) | Restyle it |
| Email field + Terms / Privacy | **Does not exist.** Google only | **Do not add** |
| Job-list picker | Exists (`ProjectPicker.jsx`) with rename + per-job invite | Restyle it. Keep rename + invite working |
| Search / ⌘K on picker | Does not exist | Optional client-side filter of already-loaded jobs only. No new data |
| “New job list” | Does not exist | **Do not add** |
| Week / Month / Quarter | Dashboard already has a time grouping control | Restyle the existing control. Do not change what it calculates |
| Quick action “Reports” | Export lives in the header | Restyle existing export. Do not add a Reports page |
| HIA / Budget / History tiles | Those pages already exist | Tiles only navigate to existing `currentPage` keys |

---

## Scope and order (propose, then do)

Work on branch **`phase-2-visual`** created from `phase-1-foundation`. One reviewable step at a time. Show localhost, wait for Lalit’s yes, then the next step. Same branch is fine (Phase 1 working style). Do not deploy to production until he asks after the restyle is done.

### Step 0 — Theme only (no screen restyle yet)

1. Create `phase-2-visual` from `phase-1-foundation`.
2. Put tokens in **one** place the whole app can read: `tailwind.config.js` theme extend **and** CSS variables on `:root` in `src/index.css` (or a small `src/styles/tokens.css` imported from there). Map Tailwind names to the mockup (`accent` → `#E85D1A`, etc.).
3. Load Manrope in `public/index.html`.
4. Change nothing else visual. Show Lalit the token file + fonts loaded. Get yes.

### Then restyle screen by screen

Keep every existing control working. Match mockup treatments.

1. **Shell** — `Sidebar.js` + `Header.js` (steel sidebar, thin orange active mark, top bar, job-name chip). This is the chrome every later screen sits in.
2. **Sign-in + picker + not-invited** — `LoginScreen.jsx`, `ProjectPicker.jsx`, `NotInvitedScreen.jsx`. Google button as in the mockup. Keep invite/rename/sign-out. No email/password. No “new job list”.
3. **Dashboard** — `DashboardPage.js` and its cards/widgets. Kill rainbow `from-blue-500` / emerald / purple quick-action tiles. Primary stat gets the orange top hairline. Money in mono.
4. **Add Expense** — `AddExpensePage.js` and the expense modal/grid it uses.
5. **Invoices** — `InvoiceManagementPage.jsx` (and invoice preview if it shows on that flow).
6. **History** — `HistoryPage.js`.
7. **Budget** — `BudgetTrackingPage.js` and `BudgetTrackerCard.jsx`.

HIA contract, client manager, OCR test pages: restyle only if they appear in the normal family path; otherwise leave them for a later pass. Do not big-bang the whole `src/components` tree in one diff.

---

## Fix while restyling (display only)

These are visual bugs, not data bugs. Do not change how budget or dates are stored.

1. **No budget set looks like a green “Remaining”.** On the dashboard (and budget card), when `budget` is 0 / unset, show the mockup empty state: “No budget set” + “Set one to track spend against a target” + existing Set budget action. Do not show a fake remaining % or a warning-as-success colour.
2. **“Invalid Date” in invoices (and dashboard date helper).** Never render the string `Invalid Date`. Show a real formatted date, or an em dash / “—” placeholder. Helpers already exist in `DashboardPage.js` (~line 60) and `InvoiceManagementPage.jsx` (~lines 95, 359). Display only.

---

## Out of scope

- Data, schema, Firestore, Storage, auth logic, invite backend, calculations, routes, new pages, new features
- Any behaviour change (including email login, creating jobs, billing, a second product)
- New npm packages except asking first. Fonts via Google Fonts do not need a package. Do not add a second icon set; lucide stays
- Deploying functions. Deleting PIN folders. Writing to production until Lalit asks after the restyle looks right
- Pasting the mockup HTML into the React app
- Rewriting `AppContext`, merging `data.js` / `firebaseService.js`, or “cleaning the repo”

---

## How to preview

`npm start` → http://localhost:3000 → **staging**. Open the mockup next to it (`design/opal-track-reference.html`). Live site stays as it is until an explicit production deploy of hosting only.

## Continuity

Keep `CLAUDE.md` and `PROGRESS.md` current. Small diffs. Propose each step, then execute. Commit on `phase-2-visual` when Lalit asks, or after each approved screen.

Lalit is not a full-time engineer. Talk in plain language. Show localhost, not a design essay.
