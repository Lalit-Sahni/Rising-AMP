# Phase 11 — Make it load fast (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything.

Branch: **`phase-11-load-time`** from the merged Phase 10 branch. Tag `pre-phase11-2026-09-XX` first. One part per session, one commit per part.

This phase changes **when and how often** data is fetched. It does not change what is stored, what is displayed, or any rule. If a task here seems to need a schema change, stop.

## Why the app feels slow

It is not the bundle. Initial JS is 245.4 KB gzipped against a 250 KB budget, which is fine. **It is the number of network round trips that have to finish, one after another, before anything useful appears.**

Signing in and landing on Jobs runs this chain. Each numbered step waits for the one above it:

| # | What | Round trips |
|---|---|---|
| 1 | Download and parse the JS bundle | 1 |
| 2 | Firebase Auth restores the session | 1 |
| 3 | `resolveInvitation` + `loadProfile` (correctly parallel) | 1 |
| 4 | `listInvitedProjects(email)` in `App.js` | 1 |
| 5 | Jobs home calls `listOrgProjects`, which runs `listInvitedProjects` **again** | 1 |
| 6 | Then 2 counts **per job, sequentially** | 2 × jobs |
| 7 | If a job was open last time, `AppContext` fires 12 loads | 1 wave, up to 1,000 docs |

With two jobs that is **nine round trips in series**. With ten jobs it is twenty-five. At a realistic 150 to 300 ms each on a phone, the Jobs screen cannot appear in under about two seconds no matter how fast the code is, and on a site with one bar it is far worse.

**Nothing above is cached between page loads.** `App.js` and `AppContext` use raw promises, not TanStack Query, so every refresh, every tab, every return to the app repeats all of it from zero.

### The four specific faults

1. **`listOrgProjects` awaited inside a `for...of`.** Two sequential round trips per job when they are all independent.
2. **`listInvitedProjects` runs twice per page load.** Once in `App.js` during sign-in, once inside `listOrgProjects` on the Jobs screen. Same query, same answer, no cache.
3. **The Jobs screen waits for counts it does not need.** Names, status and kind are already in hand after step 4. The expense and invoice counts are decoration on a card, and the whole screen was blocked on them.
4. **Opening a job loads twelve collections at once**, including up to 1,000 expense documents, when the Overview needs two of them.

## Already fixed (2 Sep 2026, on the Phase 10 branch)

Parts of 1, 2 and 3 are done, because they were small and safe:

- `listOrgProjects` now issues every count with `Promise.all`. Two jobs: four sequential trips become one wave. Ten jobs: twenty become one.
- `listOrgProjects(email, projects)` accepts an already-fetched list, so the duplicate query does not run.
- `allowedJobs` flows from `App.js` through `OrgContext`, and Jobs home paints from it immediately with counts blank, then fills the counts in when they land.

That removes roughly six of the nine serial round trips on a two-job account. **Everything below is what remains.**

---

## Part A — Put the boot path behind a persisted cache

The largest remaining win, and the one the user feels most, because it makes a **return** visit near-instant.

Today the sign-in chain (`resolveInvitation`, `loadProfile`, `listInvitedProjects`) is raw promises in `App.js`. TanStack Query is installed, configured with `staleTime: 60_000`, and used for the Cost Plan, but the boot path bypasses it entirely.

1. Move all three into `useQuery` under the existing keys in `src/query/client.ts` (`queryKeys.jobs` is already defined and unused for this).
2. Add a **localStorage persister** (`@tanstack/query-sync-storage-persister` and `persistQueryClient`) so the cache survives a reload. A returning user then sees their jobs painted from cache in about zero milliseconds while the network revalidates behind them.
3. Set a sensible `staleTime` per key: the job list changes rarely, a profile almost never. Sixty seconds is too short for both.

**Care:** persisted cache must be keyed by uid and cleared on sign out, or one person sees another's job list on a shared machine. There is already a `clearSession()`; clear the query cache in the same place, and never persist anything from `profiles`.

Commit: `Serve the sign-in chain from a persisted cache.`

---

## Part B — Stop loading twelve collections to open a job

`AppContext` fires all of these the moment a job opens: expenses, labour, trades, companies, suppliers, service providers, progress payments, invoices, HIA contracts, client details, bank details, payers.

The job Overview needs **expenses and invoices**. The other ten belong to screens the user may never open in that session.

- Move each directory load (labour, trades, suppliers, service providers, payers, clients) to a `useQuery` that runs on the screen that needs it. They are reference data that changes rarely, so a long `staleTime` makes them free after the first visit.
- Move progress payments, HIA contracts and bank details to the invoice and contract routes.
- **`getClients` is called twice** in the same wave, by `loadCompanies` and by `loadClientDetails`. One of them goes.

This is the change that makes tapping into a job feel instant, and it takes about ten queries and up to a thousand documents off the critical path.

Commit: `Load a job's reference data on the screen that uses it.`

---

## Part C — Stop reading the whole ledger to show a total

`fetchExpensesFromFirestore` pulls up to 1,000 expense documents so the Overview can add them up. That is the largest single payload in the app and it grows with every receipt.

This is the rollup work deferred from Phase 8 and it is now the right time. Maintain a summary document per job (cost to date, count, per-category and per-month totals) written by a Cloud Function on expense create, update and delete. The Overview and Jobs home then read one small document instead of the ledger.

**Non-negotiable:** the rollup must be recomputable from the ledger by a script, and there must be a check that recomputes and compares. If a rollup and the ledger ever disagree, **the ledger wins and the app says so.** A fast wrong number is worse than a slow right one, and the 1,000 cap already hides spend rather than showing a partial total, which is the correct instinct to preserve.

Deploy the function **by name**. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber` and `checkEstimateImport`.

Commit: `Read job totals from a rollup instead of the ledger.`

---

## Part D — Scope the cache invalidation

`AppContext` line 373 calls `queryClient.invalidateQueries()` with no arguments. That throws away **the entire cache** on any mutation, so one saved expense makes every screen refetch from scratch, which undoes much of Parts A and B.

Invalidate by key: saving an expense touches `queryKeys.expenses` and the job's rollup, nothing else.

Commit: `Invalidate only the keys a write actually changes.`

---

## Part E — Cache the shell so a repeat visit downloads nothing

There is still no service worker, so every visit re-downloads 245 KB of JavaScript even when nothing changed.

Add a service worker that cache-firsts the built assets (they are content-hashed, so this is safe) and network-firsts the HTML. This is **not** offline data support, which remains its own phase. It is only the shell, and it is the difference between a two second start and an instant one on a repeat visit.

**Care:** a bad service worker serves a stale app forever. Use a generated manifest tied to the build hashes, and make sure a new deploy takes over on the next load rather than needing a hard refresh.

Commit: `Cache the app shell so a repeat visit starts instantly.`

---

## Measure, do not guess

Every part states a number before and after, recorded in `ARCHITECTURE.md`:

- Serial round trips from sign-in to the Jobs list painting, counted in the Network panel.
- Documents read on that path, from the Firestore usage tab.
- Time to the Jobs list being readable, throttled to Fast 3G in devtools, which is closer to a site than office wifi.

Take the readings on **production with real data**, not on a two-job staging account, because the whole problem scales with the number of jobs.

## Out of scope

- Offline data and queued writes. Still its own phase, still worse done badly.
- Any change to what is stored or displayed.
- Rules, auth, or the design system.
- App Check enforcement.
- Deploying anything unless Lalit names it.

## Definition of done

- Sign-in to a painted Jobs list is **one wave of parallel requests**, not a chain.
- A repeat visit paints from cache before the network answers.
- Opening a job issues two queries, not twelve.
- No screen reads the expense ledger to show a total.
- A write invalidates only its own keys.
- Numbers recorded in `ARCHITECTURE.md`, measured on production, throttled.
