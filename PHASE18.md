# Phase 18: People (agent brief)

Read `CLAUDE.md`, `PROGRESS.md`, `PHASE17.md`, `PHASE17-CLOSEOUT.md`, then this. Branch **`phase-18-people`**. Tag a restore point first. One part per session, one commit per part. Localhost stays on staging. Nothing goes to production until the owner names the project and the surface.

This phase is about **who a person is, what they are allowed to do, and where you go to see and change that**. It is one phase deliberately. The roles model, the page that edits it, and the identity bugs underneath are the same subject, and splitting them would produce a page that cannot express the model or a model nobody can reach.

## Why this exists

The owner's words: people "look messy under the job title in overview", removing someone means "go into the job section, click add users, then delete them", and "there's no way of looking at profiles". All three are true, and they are symptoms of the same thing: **RisingAMP has no concept of a person.** It has a list of email strings.

The state of it today, confirmed by reading the code, not by guessing:

- **The entire permission system is one line.** `src/firebase/tenancy.js:147`: `role: canonicalEmail(data.ownerEmail) === canonicalEmail(email) ? 'owner' : 'member'`. That ternary is it. `'member'` is never read anywhere; every gate in the app is written as `role === 'owner'`, so member means only "not owner".
- **Below the job document there is no gradation at all.** `canUseProject()` in `firestore.rules:59` grants full read and write on expenses, invoices, files, cost plan, quotes, contracts and every directory collection to anyone whose email is on `invitedEmails`. Whoever you add to a job to photograph a receipt can also edit an invoice, lock the cost plan, and change the contract.
- **Sixteen UI gates hang off `isOwner`**, and the Firestore rules enforce exactly two things: only the org owner may create a job (`firestore.rules:74`), and only the org owner may change `invitedEmails`, `status` or `assistantWritesEnabled`.
- **The one always-visible people list** is `<JobPeople emails={jobInvitedEmails} invites={jobInvites} />` at `src/components/pages/DashboardPage.js:314`, wedged between the job title and the Client build / Own build toggle, with no `ownerEmail` and no `onRemove`. So it labels nobody and does nothing. That is the mess he means.
- **The only way to remove someone** is `JobsHomePage.js:285` `removePerson`, reachable only from inside the invite panel that opens off the owner-only UserPlus icon on a job row.
- **There is no way to view a person.** `publicProfiles` holds a name and a photo, the chip that renders it is not clickable, and there is no `/people` route.

## The decision already made

The owner chose **four roles**, and **design first**: the page is drawn and approved before the model is built to serve it, rather than the page being shaped by whatever was easy to query.

| Role | Where it lives | What it can do |
| --- | --- | --- |
| **Owner** | `organizations/{orgId}.ownerEmail`, immutable from the client | Everything. Creates jobs, invites and removes anyone, archives, assigns every role, holds the assistant kill switch. Exactly one per org. |
| **Manager** | `projects/{jobId}.managers[]` | Everything on the jobs they are on, plus create a job, invite and remove people below them, archive. Cannot remove the owner, cannot change the owner's role, cannot change another manager's role. |
| **Site** | default for anyone on `invitedEmails` and not in another list | The daily work: add and edit expenses, scan receipts, upload files and photos, code expenses to the cost plan, read everything on their jobs. Cannot invite, archive, create a job, edit an invoice, or lock or archive the cost plan. |
| **Viewer** | `projects/{jobId}.viewers[]` | Reads everything on the jobs they are on. Writes nothing, anywhere. For a bookkeeper or an accountant. |

**A homeowner is not a Viewer and must never be given that role.** A Viewer sees the cost plan, which means supplier pricing, subcontractor rates and the margin. A client-facing role is a different and much larger build with real commercial consequences if the boundary leaks. It is explicitly out of scope here. Do not add one, and do not leave a door open that could be mistaken for one.

---

## Part A: the design, and it is already done

`design/risingamp-people-vision.html`, approved before this brief was written. **Build to it.** Where the code cannot serve the design, say so and propose a change to the design rather than quietly shipping something else. The owner has been burned before by an agent implementing a diagram as a spec, so if a detail looks ambiguous, ask rather than infer.

The three things the design commits to, which the rest of this phase exists to serve:

1. **A person is a row, not a chip.** Photo, name, role, the jobs they are on, when they were last active, and what they have actually done. Clicking the row opens them.
2. **One place to change anything about a person.** Invite, assign a role, move them between jobs, remove them. Not spread across a job row icon, a dashboard header and a confirm dialog.
3. **The job header stops being a people list.** It gets a compact presence line that says how many people are on the job and opens the People page filtered to that job. The full list moves where it belongs.

---

## Part B: the roles model

**Three parallel arrays on the job document, and `invitedEmails` stays exactly as it is.**

```
projects/{jobId}
  invitedEmails: string[]   unchanged. who can see this job at all.
  managers:      string[]   new. subset of invitedEmails.
  viewers:       string[]   new. subset of invitedEmails.
```

Absent from both new arrays means **Site**. That is the migration default and it is the safe direction: least privilege among the working roles, and it keeps every person's daily work going on day one.

This shape is chosen deliberately over the obvious alternative of a `members` map keyed by email. **Do not use a map.** Email addresses contain dots, Firestore treats a dot in a field path as nesting, and `updateDoc` with a dotted key would silently create nested objects instead of one member entry. Arrays also mean `arrayUnion` and `arrayRemove` work normally, `in` works natively in rules, and the whole thing mirrors the `invitedEmails` pattern already in the codebase.

**Every array stores both spellings**, exactly as `emailInviteVariants` already does for `invitedEmails` (`src/firebase/emailAddress.ts:24`). Rules do no canonicalisation, so this is load-bearing. Read `src/firebase/emailAddress.ts` before writing a line of this part.

**The rules cost is zero extra reads.** `canUseProject()` already does one `get()` on the job document. The role arrays ride along in that same get, and Firestore deduplicates identical `get()` calls within one rule evaluation. Use `let` bindings inside rules functions so it stays one call and stays readable:

```
function jobData() {
  return get(/databases/$(database)/documents/organizations/$(orgId)/projects/$(projectId)).data;
}
function canRead()   { return signedIn() && emailLower() in jobData().invitedEmails; }
function isViewer()  { return signedIn() && emailLower() in jobData().viewers; }
function isManager() { return signedIn() && emailLower() in jobData().managers; }
function canWrite()  { return canRead() && !isViewer(); }
function canManage() { return isOrgOwner() || isManager(); }
```

Then rewrite every existing rule that currently says `canUseProject()`:

- **expenses, files, quotes, parties, tradeList, facts, askHistory, assistantReceipts**: read `canRead()`, write `canWrite()`.
- **invoices, hiaContracts, progressPayments**: read `canRead()`, write `canManage()`. Money going out to a client is not site work.
- **costPlan**: read `canRead()`, create and edit allocations `canWrite()`, but **lock and archive `canManage()`**. Today any member can lock the plan; that is a state machine with commercial consequences and it belongs to a manager.
- **the project document itself**: `invitedEmails`, `managers`, `viewers`, `status`, `archivedAt`, `archivedBy` all `canManage()`. Create still `isOrgOwner() || isManager()`.

**Four invariants the rules must enforce, not just the client:**

1. `managers` and `viewers` are disjoint. A person has one role.
2. Both are subsets of `invitedEmails`. You cannot hold a role on a job you are not on.
3. The owner's email is never in `viewers`. `ownerStaysOnJob()` at `firestore.rules:64` already keeps the owner on `invitedEmails`; extend it.
4. A manager cannot add themselves to `managers` on a job where they are not already a manager, and cannot remove the owner from anything.

**Migration.** Write `scripts/phase18-assign-roles.ts` as a dry-run-first script in the same shape as the existing production scripts. It must refuse `--production` without an explicit second confirmation, and it must **propose each person's role from evidence rather than guessing**: for every person on every job, report what they have actually done in the last 90 days, counted from `expenses` (created and edited), `invoices`, `files` uploaded, `assistantReceipts`, and cost plan changes. Print a table of person, jobs, activity, proposed role. Write nothing until the owner approves the table. Somebody who has only ever added expenses and photos is Site. Somebody who has issued invoices or locked a cost plan is Manager. Somebody with no writes at all in 90 days is a question for the owner, not an automatic Viewer.

**The boot cache is now security-relevant and it was not before.** `tenancy.js:83` caches the membership, including the role, in `localStorage` under `risingAmp.boot.{uid}`, and `App.js:96` re-applies it at boot before any network check. With real roles, anyone can edit that value and repaint the UI as a manager. The rules still refuse the write, so nothing is actually at risk, but the UI would lie to them and then fail confusingly. **State plainly in the code that the cached role is for first paint only and is never authorisation**, make every gated action fail on the rules error rather than on the cached role, and show a real message when a write is refused rather than a silent no-op.

Commit: `Give a person a role on a job, and make the rules mean it.`

---

## Part C: the People page

A real route at `/people`, in the sidebar under Main, not buried under More.

**The list.** One row per person in the org, not per job. Photo or initials, name, the role, the jobs they are on, last active, and a quiet marker for anyone whose invite has not been accepted. Sorted with people who need attention first: never signed in, invite bounced, no role set. Follow the repo's existing table conventions and keep the row height honest; this is a list of eight people, not eight hundred, so it should feel calm rather than dense.

**The person panel.** Opens as a side panel, not a modal, so the list stays visible. Shows what `publicProfiles` allows plus what the viewer is entitled to see, and nothing more. **Read `src/firebase/profileGate.js` before writing this.** `toPublicProfile` at line 37 exists specifically to strip mobile, ABN, business name and address, and there is a comment saying so. That boundary was closed on purpose in an earlier phase. Do not reopen it. The panel shows name, photo, email, role, jobs, when they joined, when they were last active, and a short activity summary drawn from data the viewer can already read. It does not show a phone number or an address, to anyone, including the owner, because `profiles/{uid}` is readable only by that person.

If the owner wants a contact number for a worker, that is the `parties` directory, which already exists and is the right home for it. Say so in the UI rather than quietly widening the profile rules.

**Actions on the panel**, each gated by `canManage()` and each with a real confirmation that names the consequence:

- Change role. A four-way control, with the owner row not editable and a manager unable to change another manager.
- Add to a job, remove from a job.
- Remove from the organisation. This is the one with a trap in it, described in Part E.
- Resend the invite, which reuses the Phase 17 Part F invite path and shows the delivery status that work already records.

Commit: `A page where a person is a person.`

---

## Part D: fix the job header, and per-job assignment

**Remove `<JobPeople>` from `DashboardPage.js:314`.** In its place, one compact line: how many people are on this job, up to four overlapping avatars, and a link that opens `/people` filtered to this job. It sits with the job metadata, not in the title block competing with the job name.

**The job row in `JobsHomePage.js` keeps its invite affordance**, because inviting someone to a specific job while looking at that job is the right moment for it. But it changes from an inline panel that both lists and edits people into a single action that opens the People page filtered to that job with the add field focused. One place edits people. The job row is a doorway to it, not a second implementation.

**Delete the duplicated people editing**, including `removePerson` at `JobsHomePage.js:285` and the inline `JobPeople` at `JobsHomePage.js:518`. Two implementations of the same thing is how they drift.

**While you are in `JobsHomePage.js`, fix this:** the Rename (Pencil) button at line 620 has no `isOwner` gate, and `firestore.rules:87` permits any member to update `name`, `budget` and `kind`. So anyone on a job can rename it and switch it between client build and own build. Under the new model, renaming a job is `canManage()`. Fix the rule and the button together.

Commit: `One place to manage people, and a job header that reads clean.`

---

## Part E: the identity bugs underneath

These are real, they already bite, and several were found by the owner's own auditors during the Phase 17 hotfix. They are independent of Parts B through D and can be pulled forward at any time if the owner wants them sooner.

**1. Session is not scoped to the person.** `src/firebase/tenancy.js:20` defines six flat localStorage keys with no uid: `risingAmp.projectId`, `workspaceId`, `projectName`, `orgId`, `invitedEmails`, `projectStatus`. `handleLogout` at `App.js:230` calls `clearBootCache(authUid)` but **never calls `clearSession()`**, so they all survive a sign out. `App.js:51` then seeds React state from them before auth resolves, so the next person on the same browser sees the previous person's job name and invited-email list painted into the shell, then a permission error. Scope every session key by uid the way the boot cache already is, and call `clearSession()` on sign out. The comment at `tenancy.js:80` claims a shared machine cannot show one person another's jobs. Make that true.

**2. Gmail dots break profile lookups but not membership.** `canonicalEmail` strips dots and plus-addressing for gmail. Every membership path uses it. **Every profile path uses `normalizeEmail` instead**, which does not: `loadProfilesForEmails` at `profiles.js:187`, `syncPublicProfile` at `profiles.js:69`, `findProfileByEmail` at `profiles.js:81`, `pickProfileForEmail` at `profileGate.js:52`. The result is that `JobPeople` de-dupes by canonical email and then looks the survivor up by normalized email, so a person invited under one spelling whose Google account uses the other silently falls back to a bare email address with no name and no photo. Worse, a person with both a Google and a password login can be sent through profile setup a second time. Make the `publicProfiles` document id canonical, write a one-time backfill for existing rows, and use the same canonicalisation on both sides. The rules at `firestore.rules:1243` pin the doc id to the token email lowercased, so **the rule has to change with it** or writes will start failing. Change them together or not at all.

**3. A newly invited person is stranded.** `App.js:150` sets up the only realtime listener *inside* the `if (!invite.invited) return;` early return at line 135, so an uninvited person subscribes to nothing. The effect's dependency array is `[authUid, authEmail]`, neither of which changes when somebody adds their email. So they sit on Ask for access until they press Check again, which is `window.location.reload()`. Give them a listener. Note the ordering trap: `firestore.rules:28` denies them the org document until the owner's second write lands, so the listener has to tolerate permission-denied and retry rather than treat it as a refusal.

**4. A failed lookup looks like a refusal.** `resolveInvitation` at `tenancy.js:189` returns `reason: 'lookup-failed'` for a transient Firestore error, and the UI shows the same Ask for access screen it shows a genuine stranger. Telling somebody they are not on the list when the network hiccuped is a lie the app should not tell. Separate the two: not on the list gets Ask for access, a failed lookup gets a retry with the real reason.

**5. A stranger fills in their ABN before being told no.** `App.js:335` renders `ProfileSetupScreen` when the profile is incomplete, and `App.js:346` renders `AskForAccessScreen` only after. So somebody with no access completes a full profile including business name, ABN and address, and is then told they cannot come in. Check access first.

**6. Removing someone can remove them from jobs you cannot see.** `removeEmailFromProject` at `projectCatalog.js:276` decides whether to drop a person from the org's `invitedEmails` by listing **the remover's visible jobs**. Its own comment admits the limitation. If the person is still on a job the remover cannot see, they are dropped from the org anyway and lose the whole app while still appearing on that job. Under the new model a manager will be removing people far more often than the owner did, so this gets worse, not better. Either compute it server-side in a callable that can see every job, or refuse the org-level removal and leave them on the org with no jobs, which is a harmless state. Do not leave it as it is.

**7. Two leaks worth closing while you are here.** `firestore.rules:840` reads `allow read: if signedIn()` on `tradeList`, so any signed-in Firebase account, invited or not, can read the org's trade list. And `storage.rules:65` allows any signed-in user to read any avatar by uid. Neither is catastrophic and neither is defensible. Scope both to the org.

Commit one per numbered item, or group 1 through 5 if they stay small. Do not group 6 with anything.

---

## Part F: your own profile

`ProfilePage.js` currently renders the setup form plus two links. Now that there is a People page, your own row should be reachable from the same place everyone else's is, and Profile becomes what it should be: your details, your role stated plainly, your sign-in method, and the owner-only controls.

Small, but do it properly rather than leaving two different ideas of what a profile is.

Commit: `Your profile, in the same language as everyone else's.`

---

## Part G: prove it

Not a checklist of green ticks. Show the owner it works.

1. On staging, with two browsers, sign in as the owner in one and a Site person in the other. Screenshot the Site person being refused an invoice edit and succeeding at an expense. The refusal must be a clear message, not a silent failure.
2. Sign out in one browser and sign in as somebody else. Nothing from the previous person is visible at any point, including during the first paint.
3. Invite somebody while they are sitting on the Ask for access screen. They get in without touching anything.
4. Edit `risingAmp.boot.{uid}` in localStorage to claim manager. The UI may paint it briefly. Every write must still be refused, with a message that says so.
5. Run the role migration dry-run against real staging data and paste the proposed table into `PROGRESS.md`. Zero writes.
6. Confirm no expense, invoice, file or cost plan row changed anything except the rules that guard it. This phase moves no money.
7. Bundle size against the 400 KB ceiling, and what moved.

Report as a morning summary in `PROGRESS.md` under Phase 18.

---

## Known, deliberately not in this phase

- **A client or homeowner role.** Out of scope, and dangerous to improvise. A Viewer sees the cost plan and therefore the margin.
- **More than one owner per org.** `ownerEmail` is a scalar and immutable from the client by design. Transferring ownership is a separate, deliberate piece of work.
- **Per-job roles differing from org roles.** The arrays are per job, which allows it, but the People page presents one role per person. Do not build a matrix UI until somebody asks for one.
- **Cross-kind party duplicates**, still outstanding from Phase 13, and the Metro Consulting three-way merge. Still the owner's decision.
- Production deploy. Not until he asks and names the surface.
