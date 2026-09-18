# Phase 17 closeout (agent brief)

Read `CLAUDE.md`, `PROGRESS.md`, `PHASE17.md`, then this. Stay on **`phase-17-coding-fixes`**. One commit per task. Nothing deployed. Localhost stays on staging.

Parts A, B, C, D and F are committed and the work is good. This closes the four gaps between that and a phase that is actually finished. Do them in this order: task 1 is the one that hurts the next agent if it is skipped.

---

## 1. Bring `PROGRESS.md` up to date

The Phase 17 table lists Part A alone. Six commits have landed since. Any agent that boots, reads `PROGRESS.md` and believes it will conclude B through F were never done and may redo them.

Fill the table with every part, its real SHA, and its gzip figure measured at that commit (not copied forward):

| Commit | What |
| --- | --- |
| `888d118` | A, switch defaults on, gate on tier and origin |
| `e54d37c` | B, Activity shows what was done and who did it |
| `3289331` | Part F brief added to `PHASE17.md` |
| `66e76c8` | C, propose from the supplier name |
| `49afc12` | F, record every invite and learn when one bounces |
| `9da2dfe` | D, waste, cleaning, fixtures, and owner-added sections |
| `2582fe1` | Atomic commit of an expense and its receipt |

Also record, in prose, the three things a future agent must not have to rediscover:

- On this branch a missing `assistantWritesEnabled` means **on**. `CLAUDE.md`, `AGENTS.md` and `DATABASE.md` were corrected when staging shipped, then again when production shipped (19 Sep 2026).
- `origin: 'human' | 'assistant'` is now required on `codeExpense`, `createExpense` and `codeExpenseBatch`. Only the screen that owns the confirmation may claim `'human'`. Never spread a model-supplied object into an action input.
- An expense write and its receipt are one `writeBatch`. Do not add a new write path that puts them in separate calls.

Commit: `Record what Phase 17 actually did.`

---

## 2. Run Part E and report the numbers

`scripts/phase17-staging-proposals.ts` exists, is read-only and refuses `--production`. It has never been run. Until it is, the central claim of Part C is unverified.

Run it against staging and put the output in `PROGRESS.md` under Phase 17.

**Report honestly, including if it got worse.** There is a specific reason it might have. `expenseHaystackFields` now feeds nine fields into `matchingSections` instead of four. More fields means more chances that **two** sections match one expense, and a multi-hit does not produce a proposal, it falls through to `noneProposal` with alternatives. So the change could have moved rows from "uncertain with a proposal" into "none with alternatives" and lowered the proposal count. That is the number to look at first.

Report four things:

1. Proposal count before Part C and after, over the same live uncoded set.
2. Every row where a name field produced a proposal the description did not. This is the list the owner reads.
3. Every row that **lost** a proposal by going multi-hit, if any.
4. Confirmation that no already-coded expense appears in any proposal set.

If (3) is non-trivial, do not paper over it. Say so and propose a fix in the report rather than implementing one. The likely fix is a field priority: when several sections match, prefer the hit from the highest-priority field rather than returning none. Do not write that without the owner seeing the numbers first.

Commit: `Prove the proposal change on real staging data.`

---

## 3. Finish the atomic work, or narrow its claim

`2582fe1` made single-row coding, creation and undo atomic. It left `restoreTradeIdBatch` in `src/actions/undo.ts` un-atomic in two places:

- After the child loop, the parent receipt is stamped with a separate `store.patchReceipt`. If that write fails after forty children reverted, the parent still reads `applied` and Activity offers "Undo all" on an already-reverted batch.
- The fallback inside the loop, when a child undo fails, is a bare `store.updateExpense` with no receipt patch at all. That one genuinely leaves an expense reverted with its child receipt still saying `applied`.

This self-heals on retry, because a child returns early on `status === 'undone'`, so it corrupts nothing. But the docblock at the top of `src/actions/atomicCommits.test.ts` claims "no reverted row still showing 'applied'", and the batch parent can do exactly that. The claim and the code disagree.

Pick one and do it properly:

- **Finish it.** Give the batch parent the same treatment: the last child's revert and the parent's `undone` stamp go in one commit, and delete the bare `updateExpense` fallback rather than leaving a write that skips the receipt entirely.
- **Or narrow the claim.** Leave the batch path as is, correct the docblock to say single-row paths only, and add a test that proves the batch parent is idempotent on retry so the self-healing is a tested property rather than an assumption.

Finishing it is the better answer. Say which you chose and why.

Commit: `Make the batch undo as atomic as the single one.` (or the honest equivalent)

---

## 4. One em dash in shipped copy

`src/components/JobPeople.jsx`:

```
{line.to} — invited {line.ageLabel} · {line.statusLabel}
```

The owner's standing constraint is no em dashes. Replace it with a middle dot separator to match the rest of the line, or restructure so the address and the status read as two elements. The other em dashes added this phase are in comments and test names; leave those.

While in this file, check the line holds at 360px with a 28 character address. It is rendering three pieces of information in one row at 11.5px.

Commit: `Say it without the dash.`

---

## 5. Decide what is tracked

Untracked in the working tree:

- `Claude outputs/` and `brand/`
- `design/risingamp-invite-email-v2.html` (the approved invite redesign, keep it)
- `design/risingamp-record-vision.html`, `design/risingamp-scaffold-vision.html`
- `scripts/phase17-staging-proposals.ts` (keep it, task 2 depends on it)

`brand/` holds the generated logo assets and their build script, so it belongs in the repo. `Claude outputs/` looks like scratch. Do not guess: commit what is clearly a source artefact, add the rest to `.gitignore`, and list in the commit message what you ignored and why so the owner can overrule you in one read.

Commit: `Track the brand kit and the design files, ignore the scratch.`

---

## Before you say it is done

- `npm run typecheck` clean.
- Full vitest and node suites pass, with the counts stated against the branch-point baseline of 568 vitest and 168 node.
- Firestore rules tests pass.
- Gzip figure against the 400 KB ceiling, and what moved since `ac1239c`.
- `PROGRESS.md` reflects all of the above.

Do not deploy. Do not merge to `master` or `main`. Production still runs Phase 16 and the owner has not named a surface.
