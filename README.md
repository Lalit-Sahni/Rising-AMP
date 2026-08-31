# RisingAMP

Construction tracking for Opal SS Constructions. Live shopfront: [https://risingamp.com.au](https://risingamp.com.au).

This repo is a live family business app. Prefer shipping nothing over risking stored jobs, invoices, or people.

## In fifteen minutes

You need **Node 24** (see `.nvmrc`; 20+ will also run Vite). You need the gitignored staging env file; ask the owner, do not invent production keys.

```bash
git clone <this-repo>
cd Rising-AMP
git checkout phase-8-technical-revamp
npm install
cp .env.example .env.local
# Fill .env.local with the staging Firebase web config. Every key is VITE_*.
# VITE_FIREBASE_PROJECT_ID must be rising-amp-staging.
npm start
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google or email/password. Complete the profile if asked. You land on **Jobs**.

Localhost talks to **staging** (`rising-amp-staging`). Production keys live in `.env.production.local` and are only used by `npm run build` before a named hosting deploy.

```bash
npm test
npm run typecheck
npm run test:rules   # needs Java; the script prints the brew command if missing
npm run build        # uses .env.production.local; do not point .env.local at production
```

## What you must not do

- Commit `.env*`, `.phase1-local.json`, or `backups/`
- Point localhost at production to make receipt photos appear
- `firebase deploy` without `--project` and an explicit `--only`, and only when the owner names it
- `firebase deploy --only functions` without naming the function. Production functions are `sendJobInviteEmail`, `readReceiptImage` and `allocateInvoiceNumber`. Deploy **by name**.
- Hard-delete live user records. Archive a job; void an invoice or expense (Recently deleted); revoke access. Permanent delete is only from Recently deleted.
- Paste API keys into chat

## Environments

| Alias | Firebase project | Role |
|--------|------------------|------|
| production | `rising-amp-467702-b5` | Live family app. https://risingamp.com.au |
| staging | `rising-amp-staging` | Copy of production. Localhost. `.firebaserc` default. |

Git push does not deploy. Hosting changes only on `firebase deploy --project production --only hosting`.

## How the app is shaped

- **Vite + React 18 + TypeScript** (`allowJs`, `strict`). New files are TypeScript. Existing JS converts only when a brief says so.
- **Routes** in `src/components/MainContent.js`. Job id is in the URL: `/jobs/:jobId`.
- **Money** is integer cents in `src/money.ts`. Parse at the Firestore boundary.
- **One data import path:** `src/data`.
- **Org** comes from membership at sign-in, not a hardcoded constant. Opal’s id `opal-ss-constructions` remains the live family org.
- Decisions: `ADR/`.

Read next: `CLAUDE.md`, `PROGRESS.md`, `ARCHITECTURE.md`, `DATABASE.md`.
