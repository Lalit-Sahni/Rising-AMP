# Rising AMP (Opal Track)

Family construction tracker for Opal SS Constructions. Live app after Phase 1 (2026-08-23): Google login, one company, two job lists.

Live: https://rising-amp-467702-b5.web.app  
Local preview: `npm start` → http://localhost:3000 (talks to **staging**, not live)

## What it does

- Sign in with Google / Gmail. Only invited addresses get in.
- Choose a job list (72 Centenary Dr or Gurner St). Invite is **per job**, not the whole company.
- Expenses (with receipt OCR), invoices, history, budget / HIA, clients.
- Site Log and Weekly Report were removed in Phase 1.

## Preview vs live

| | Localhost | Live site |
|--|-----------|-----------|
| Command | `npm start` | already deployed |
| Firebase | staging (`rising-amp-staging`) via `.env.local` | production (`rising-amp-467702-b5`) |
| Receipt photos | often missing (staging has no Storage bucket) | work |

Do not copy production keys into `.env.local`. Git push does **not** deploy. Live only changes with:

```bash
npm run build   # uses .env.production.local
firebase deploy --project production --only hosting,firestore:rules
```

Never deploy functions unless the owner explicitly asks.

## Setup

Need Node 18.17+ (see `.nvmrc`).

```bash
npm install
cp .env.example .env.local
# Fill .env.local with staging Firebase keys, never production.
npm start
```

Gitignored and never committed: `.env*`, `.phase1-local.json`, `backups/`.

## Agent / continuity docs

If you are an agent (or picking this up later), read in this order:

1. `CLAUDE.md` — safety, environments, what is in scope
2. `PROGRESS.md` — next concrete step
3. `PHASE2.md` — visual overhaul brief (open `design/opal-track-reference.html`)
4. `ARCHITECTURE.md` — how the running app is built
5. `PLAN.md` — Phase 1 record (complete)

Phase 1 is **done**. Phase 2 is a visual overhaul: read `PHASE2.md` and open `design/opal-track-reference.html`. New git branch `phase-2-visual` from `phase-1-foundation`.
