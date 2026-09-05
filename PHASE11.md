# Phase 11 — Cold start (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything.

Branch: **`phase-11-cold-start`**. Restore tag: `pre-phase11-2026-09-05`. One part per session, one commit per part.

**Part A, Part B and Part C are on the branch (5 Sep 2026), not deployed.** Service worker cache-firsts hashed assets, network-firsts HTML, and never caches Firestore / functions / Storage. Firestore uses `persistentLocalCache` plus `onSnapshot` on the job list, expenses and invoices. Opening a job no longer loads the ten directory collections; those wait for the screen that uses them. Escape hatch: `/clear-sw`. Next is Part D (scope cache invalidation). The owner overrode waiting on production-phone timing. Do not start Part E until C and D are committed.

This phase changes **when and how often** data is fetched, and what is on screen while it is fetched. It does not change what is stored, what is displayed, or any security rule. If a task here seems to need a schema change, stop and ask.

## The problem, in the owner's words

> "Only the start is slow. When I first open the app, that's the main concern. The rest I'm happy to fix but the start is way too slow."

**This phase is about the first three seconds after tapping the icon.** Everything else in here is secondary and can wait.

## Why cold start is slow

It is not the bundle. Initial JS is ~270 KB gzipped against a 275 KB budget (raised from 250 for Firestore’s disk cache). That parse is still cheap next to Iowa.

**It is distance multiplied by the number of things that must happen in order.**

Firestore and all five Cloud Functions are in the United States (`functions/index.js` sets `region: 'us-central1'` on every one). Sydney to `us-central1` is roughly **200 ms round trip**. Sydney to `australia-southeast1` would be about 10 ms. Every single request pays that, and no code change makes light faster.

**A Firestore database's location is permanent.** It is chosen at project creation and cannot be moved. Relocating it means a new project and a full migration of live business data. That is not this phase, and probably should not happen until there are paying customers to justify the risk.

**Do not reflexively move the Cloud Functions either.** `allocateInvoiceNumber` is a Firestore transaction. Moving it to Sydney while Firestore stays in Iowa makes it *slower*, because the function would then be far from the database it talks to. Co-locate functions with the database, not with the user, whenever the function is database-heavy.

So the distance is fixed. **The only lever is the number of round trips, and what the user looks at while they happen.**

### What the boot chain actually did

`App.js` held `<BootScreen />`, which is just the RisingAMP mark on canvas, until `membershipLoading` went false. That only happened at the very end of this chain, with each step waiting on the one above:

1. Download and parse the JS bundle
2. Firebase Auth restores the session
3. `resolveInvitation` + `loadProfile` (correctly parallel)
4. `listInvitedProjects(email)`

Three network waves at ~200 ms each, plus parse, with a static logo on screen for all of it.

## Already shipped (2 Sep 2026)

Three fixes are committed on the Phase 10 branch, because they were small, safe and targeted exactly this:

- **`86e2451` Boot paints from cache.** `readBootCache` / `writeBootCache` / `clearBootCache` in `tenancy.js`, the same localStorage pattern the profile already used. On any start after the first, `App.js` paints membership, the job list and the last open job **before the first request leaves the device**, then revalidates behind. Keyed by uid, cleared on sign out, and cleared when `resolveInvitation` reports a revoked invite.
- **`57e12db` Jobs list paints without waiting on counts.** `listOrgProjects` awaited two counts inside a `for...of`, so counts were sequential per job. They now go out together. It also accepts an already-fetched list, killing a duplicate `listInvitedProjects` that ran on every page load. And `allowedJobs` flows through `OrgContext`, so Jobs home renders immediately and counts fill in after.

Serial round trips from sign-in to a painted Jobs list: **nine down to three** on two jobs, twenty-five down to three on ten.

**Everything below is what remains. Parts A, B and C are on the branch. D and E are the follow-up.**

---

## Part A — A service worker for the app shell

**The biggest remaining cold-start win, and now the top priority.**

There is still no service worker, so every single open re-downloads and re-parses 245 KB of JavaScript before anything runs. For an app that lives on a home screen, that is the difference between a web page and an app.

1. Add a service worker that **cache-firsts the built assets** and **network-firsts the HTML**. Vite has `vite-plugin-pwa`, which generates the manifest from the real build output. Use it rather than hand-writing a worker.
2. Assets are content-hashed by Vite, so cache-first on them is safe: a new build produces new filenames.
3. **Cache the shell only.** Do not cache Firestore requests, Cloud Function calls, or Storage downloads in the service worker. Those have their own caching story in Part B, and a service worker caching money data is how someone sees a stale total.

**The trap:** a bad service worker serves a stale app forever, and the user cannot fix it by refreshing. Get this right:

- New builds must take over on the next open, not require a hard refresh. Configure `skipWaiting` and `clientsClaim`, or show a small "update ready, reload" prompt. Decide which with the owner; for a four-person family app, taking over automatically is usually right.
- Test the upgrade path deliberately: install the worker, deploy a change, reopen, confirm the new version is running.
- Keep a way to unregister. If the worker ever ships broken, there must be a route back.

Phase 7 already made this a home-screen app with correct safe areas. This is the piece that makes it feel like one.

Commit: `Cache the app shell so a repeat open starts from disk.`

`npm start` still has no worker. That is the day-to-day Vite server. To test the saved-app copy on localhost:3000 against staging: `npm run preview:staging`.

---

## Part B — Firestore's own disk cache, and listeners on the hot paths

**On the branch 5 Sep 2026, not deployed.**

`src/firebase/config.js` used `getFirestore(app)` (memory-only, wiped on reload). It now uses `initializeFirestore` with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`, and falls back to `memoryLocalCache` when IndexedDB is missing (private mode, tests).

`getDocs()` still goes to the server. The payoff is `onSnapshot`, which fires from disk then the server:

- Job list: `listenInvitedProjects` in `App.js` (one-shot `listInvitedProjects` stays for invite/remove)
- Expenses and invoices: `listenJobExpenses` / `listenJobInvoices` in `AppContext` (directories moved to Part C)
- Raising an invoice still allocates the number on the server; a manual invoice reload uses `getDocsFromServer`. Cost Plan saves already use `runTransaction`.

Empty disk snapshots are ignored so they cannot wipe a boot-cached job list while Iowa answers.

Commit: `Serve the ledger from Firestore's disk cache and update it live.`

---

## Part C — Stop loading twelve collections to open a job

**On the branch 5 Sep 2026, not deployed.** The owner overrode waiting on production-phone timing.

`AppContext` used to fire all of these the moment a job opened: expenses, labour, trades, companies, suppliers, service providers, progress payments, invoices, HIA contracts, client details, bank details, payers.

Job open now only attaches **expenses and invoices** listeners. The other collections load with `useQuery` on the screen that needs them (`src/hooks/useJobDirectories.ts`). Directories use a 30-minute `staleTime`. Progress payments, HIA contracts and bank details load on the invoice and contract routes. `getClients` runs once (`queryKeys.clients`); `loadCompanies` and `loadClientDetails` share that key.

Commit: `Load a job's reference data on the screen that uses it.`

---

## Part D — Scope the cache invalidation

`AppContext` calls `queryClient.invalidateQueries()` with **no arguments**, which throws away the entire cache on any mutation. One saved expense makes every screen refetch, undoing much of Parts B and C.

Invalidate by key. Saving an expense touches `queryKeys.expenses` and the job's totals, nothing else.

Commit: `Invalidate only the keys a write actually changes.`

---

## Part E — Rollups instead of reading the ledger

`fetchExpensesFromFirestore` pulls up to 1,000 expense documents so the Overview can add them up. It is the largest single payload in the app and it grows with every receipt.

This is the rollup work deferred from Phase 8. Maintain a summary document per job (cost to date, count, per-category and per-month totals) written by a Cloud Function on expense create, update and delete. Overview and Jobs home then read one small document.

**Non-negotiable:** the rollup must be recomputable from the ledger by a script, and a check must recompute and compare. If a rollup and the ledger ever disagree, **the ledger wins and the app says so.** A fast wrong number is worse than a slow right one. The existing 1,000 cap already hides spend rather than showing a partial total, which is the correct instinct to preserve.

Deploy the function **by name**. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport` and `readQuoteFile`.

Commit: `Read job totals from a rollup instead of the ledger.`

---

## Measure, do not guess

Record before and after in `ARCHITECTURE.md` for each part:

- **Time from tapping the home-screen icon to the Jobs list being readable.** This is the number the owner cares about. Measure by force-closing the app and reopening, not by refreshing a tab.
- Serial round trips on that path, counted in the Network panel.
- Documents read, from the Firestore usage tab.

Take readings on **production with real data**, throttled to Fast 3G, on a phone. The whole problem scales with distance and job count, so office wifi against a two-job staging account will always look fine and tell you nothing.

## Out of scope

- **Moving the Firestore database.** Permanent at creation; a migration of live data is its own decision, not a performance fix.
- **Moving Cloud Functions to Sydney.** Would make the database-heavy ones slower while Firestore is in the US.
- Offline data and queued writes. Still its own phase, still worse done badly than not at all.
- Any change to what is stored or displayed, or to rules, auth or the design system.
- App Check enforcement.
- Deploying anything unless the owner names it.

## Definition of done

- Reopening the app from the home screen shows the Jobs list **immediately**, from disk, with no logo pause.
- A new build takes over cleanly on the next open, verified deliberately.
- Opening a job issues two queries, not twelve.
- No screen reads the expense ledger to show a total.
- A write invalidates only its own keys.
- The measured icon-to-Jobs time recorded in `ARCHITECTURE.md`, on production, on a phone, throttled.
- `npm run typecheck`, `test`, `test:rules` and `build` all pass.

---

## Paste this to start the next chat

```
Read CLAUDE.md, then PROGRESS.md, then PHASE11.md.

Phase 11 is cold start. Parts A, B and C are on
phase-11-cold-start, not deployed. Restore tag pre-phase11-2026-09-05.
Never commit to master or main. Localhost stays on staging
(.env.local, rising-amp-staging). Deploy nothing unless he names it.

Next is Part D: scope `invalidateQueries()` so a write only
touches the keys it changes. Do not start E.

Do not redo Part A, Part B, Part C, or the boot cache (86e2451, 57e12db).
Never cache Firestore, Cloud Function or Storage responses in the
service worker. Never hard-delete user records. Never accept a
pasted API key.
```
