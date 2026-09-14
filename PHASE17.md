# Phase 17: Make coding work (agent brief)

Read `CLAUDE.md`, `PROGRESS.md`, `PHASE13.md`, `PHASE16.md`, then this. Branch **`phase-17-coding-fixes`**. Tag a restore point first. One part per session, one commit per part. Localhost stays on staging. Nothing goes to production until the owner names the project and the surface.

## Why this exists

Four symptoms, one cause.

1. Coding an expense is refused with *"The owner has turned off assistant writes"*, even when the owner picks the trade himself.
2. "What the assistant did" in the side menu opens a page that is permanently empty.
3. The proposal reads the description and ignores who he paid.
4. There is nowhere to code bins, cleaning, a bathtub, a dishwasher, mixers or sinks.

The first two are the same bug. The kill switch has refused every action-layer write since it shipped, so no receipt was ever written, so the activity page has nothing to show. The page is not broken. It is correctly reporting that nothing has ever been allowed to happen.

**The principle for this phase, in the owner's words:** tight enough not to be wrong, and where it cannot be sure, then take the precaution. Not precautions by default.

The codebase already implements that principle. `assignTier` in `src/actions/core.ts` refuses to write any field that came from inference: direct evidence (`user`, `record`, `ocr`) gets `do`, anything inferred gets `propose`, and a model never sets the tier. That is the real safety mechanism and it works. The kill switch is a second, blunter gate bolted on top that ignores the tier and blocks everything equally. It does not make the app safer than `assignTier` already makes it. It makes the app do nothing.

So the switch stops being the default posture and becomes what it should have been: an off-ramp for a day when he does not trust it.

---

## Part A: the switch stops being the default

**1. Default to on.** `assistantWritesEnabled` currently must be explicitly `true` or writes are refused, and the field does not exist on the org document, so it has always been off. Invert the missing case: absent means on. Explicit `false` means off. The owner turning it off stays fully honoured; never having touched it no longer means off. Do not change `firestore.rules`. The rule that only the owner may write this field is correct.

**2. The tier decides, not the function name.** `refuseIfAssistantWritesDisabled` runs on `codeExpense`, `createExpense` and `codeExpenseBatch` by name. Delete `MUTATING_ACTION_NAMES`; a function name is not evidence of anything. When the switch is off, refuse only what `assignTier` gave `tier: 'do'` **and** whose evidence did not come from a person. A `propose` never wrote anything, so there is nothing to gate.

**3. A person's choice is never an assistant write.** `ProposeTradesSheet` shows every row, lets the owner override the trade in a dropdown, and routes Accept through `applyProposedTrades` to `codeExpenseBatch`. The value came from a human looking straight at it. Add an explicit `origin: 'human' | 'assistant'` to the input of `codeExpense`, `createExpense` and `codeExpenseBatch`. Required, no default, so every call site must state which it is. `origin: 'human'` means a person saw this exact value on screen and confirmed it: both Accept buttons in the sheet are `'human'`. `origin: 'assistant'` means an unreviewed flow picked it. The switch, when off, refuses only `'assistant'`. Store the origin on the receipt.

**4. A failed read is not a decision.** `readAssistantWritesEnabled` ends in `catch { return false }`. Offline, a cold cache, a slow rules evaluation and a deliberate switch-off all produce the same answer. Make it `true | false | 'unknown'`. With the new default, `'unknown'` resolves to allowed, and the underlying error goes to the console. Never present an infrastructure failure as somebody's choice.

**5. Fix the message.** `ASSISTANT_WRITES_OFF_MESSAGE` ends with "You can still undo what it already did", which is meaningless on a refusal where nothing happened. Two messages instead. Owner: *"Assistant writes are off. Turn them back on in Profile."* Anyone else: *"Assistant writes are off for this organisation. Only the owner can turn them on."* Non-owners cannot see the toggle at all, so the message has to name who to ask.

**6. Say it before, not after.** If the switch is off, `ProposeTradesSheet` shows a quiet line at the top, before he selects forty rows, not a refusal after.

Tests: `killSwitch.test.ts` asserts the current behaviour and will fail. Rewrite it, do not delete it. It must prove that a fresh org with no field writes normally; that explicit `false` still refuses `origin: 'assistant'` and still allows `origin: 'human'`; that `'unknown'` allows and does not claim the owner turned anything off; that a `propose` is never gated; and that undo works in every case.

Commit: `Make assistant writes on by default and gate on evidence, not function name.`

---

## Part B: the activity page has something to show

The page and its route are fine. `AssistantActivityPage` renders, `listAssistantReceipts` works, undo reads the stored receipt. It is empty because no receipt has ever been written. Part A fixes that on its own. Three things finish it.

1. **Say who did it.** With `origin` on the receipt, a row reads *"You coded 12 expenses"* or *"The assistant coded 12 expenses"*. Both belong on this page. It is an undo log, not a confession log.
2. **Empty state tells the truth.** "Nothing yet" with no explanation is why it reads as broken. When there are no receipts, say what would put one here.
3. **Header wording.** `Header.js` shows "What it did" and the sidebar shows "What the assistant did". Once the page carries his own accepted rows, one honest label for both: **Activity**.

The inline trade picker on the Cost Plan page goes straight to `setExpenseTradeId` and bypasses the action layer entirely. Leave it that way. A person typing into a form is not an event worth logging, and routing it through the action layer would be work for no benefit.

Commit: `Show what was done and who did it.`

---

## Part C: the proposal reads who he paid

In `src/actions/proposeTrades.ts`, `expenseHaystack` reads `description`, `itemName`, `tradeName` and `notes`. Every name field is ignored, and `partyId` is used only to count exact history. A `$4,200` line from "Jim's Electrical Pty Ltd" described as "progress claim 2" gets no proposal at all.

1. **Add the names to the haystack:** `supplier`, `workerName`, `serviceName`, `equipmentName`, and `partyName` where present.
2. **Resolve the party.** Pass an optional `partyNamesById: Map<string, string>` into `proposeTrades`, built in `ProposeTradesSheet` from the org party directory it can already reach. This is what lets a **first** expense from a new supplier get a proposal.
3. **A name is a hint, never a fact.** Party history with two or more prior codings stays `source: 'record'`, `status: 'confident'`, which is the only thing `assignTier` will let write. A name match is `source: 'inferred'`, `status: 'uncertain'`, always, and therefore always a proposal he has to accept. "Metro Electrical" can invoice for a switchboard and for a light fitting. Never promote a name match to confident. This is the precaution the principle asks for, in the one place it is actually needed.
4. **Use a single prior coding.** `uniqueLeader` requires `count >= 2`. One prior coding of the same `partyId` is real evidence: return it as `uncertain` with *"Coded to Electrical once for this supplier."* Two or more stays confident. This alone should clear a large share of the uncoded list.
5. **Reasons name the field that won**, because he audits these. *"Supplier name matches the Electrical section"* reads differently from *"Description matches the Electrical section"*, and he needs to know which to distrust.
6. **Injection.** Party names come from OCR on supplier invoices. Run `stripInstructionClauses` over the resolved name exactly as the description is treated, and add a case to `injection.eval.test.ts` with an instruction clause in a supplier name. A supplier does not get to tell the app what to do.
7. Word-boundary matching via `containsWholePhrase` stays. Do not regress to `includes`; that is the Phase 13 palette bug.

Commit: `Propose a trade from the supplier name, not just the description.`

---

## Part D: sections for the money that has nowhere to go

This is about **cost plan sections**, the `APP_TRADES` list that holds Site works, Carpentry, Electrical and the rest. `EXPENSE_CATEGORIES` is a different axis and is not touched in this phase.

**Three new entries appended to `APP_TRADES`** in `src/domain/costPlanCore.ts`, before `other`, which stays last. Append only. Never reorder and never rename an existing id: these ids are stored on expense documents and `mergeTradeList` keys off them.

```
{ id: 'waste-removal',     name: 'Waste and bins' }
{ id: 'cleaning',          name: 'Cleaning' }
{ id: 'fixtures-fittings', name: 'Fixtures and fittings' }
```

Add aliases to `TRADE_ALIASES` in both `src/domain/costPlan.ts` and `src/actions/proposeTrades.ts`. They are duplicated; leave the duplication alone this phase, just keep them identical.

- `waste-removal`: bin, bins, skip, skip bin, waste, rubbish, tip, tip fees, disposal
- `cleaning`: clean, cleaner, builders clean, final clean, site clean
- `fixtures-fittings`: bathtub, bath, tub, basin, sink, vanity, tapware, tap, taps, mixer, mixers, shower, toilet, appliance, appliances, dishwasher, oven, cooktop, rangehood, pc item

`ensureOrgTradeList` backfills app defaults an org is missing, so existing orgs pick these up on next load. Verify that on staging against live-shaped data, not by reading the code.

**Then the part that matters more: he can add a section himself.** `addOrgTrade` already exists and works. The only screen that calls it is `BreakIntoTradesSheet`, which runs once at setup, so after a plan exists there is no way to add a section. Add an "Add a section" control to the Cost Plan page, available whenever `planHasTrades(plan)`. Owner-only, consistent with the other plan controls. Then he never has to ask for a section again, which is the real fix; the three defaults above are a convenience.

**The hard constraint:** his imported plan totals $321,916.29 and that number is the estimate. A new section is added with **no allocation**. It must not change the plan total, the margin, or any imported figure. It is a bucket spend can be coded to, showing against a zero allocation exactly like existing extras. Prove it with a test that imports the `112 Cost Sheet.xlsx` fixture, adds a section, and asserts the total is still `32191629` cents to the cent.

Commit: `Add waste, cleaning and fixtures, and let the owner add a section.`

---

## Part E: prove it on his real data

Not a checklist of green ticks. Show him the thing working.

1. On a fresh staging org with no `assistantWritesEnabled` field, open Sort to cost plan and accept. It writes. Screenshot.
2. Open Activity. The rows are there, attributed to him, and Undo reverses them. Screenshot.
3. Switch it off deliberately. A confident assistant row is refused with the new message; an accepted-by-hand row still writes.
4. Kill the network mid-action. The message says the check failed, not that the owner turned it off.
5. Run the proposal over his current uncoded list. Report the before and after count of expenses that get a proposal, and list every row where the supplier name produced a proposal the description did not. He will read that list.
6. Confirm nothing already coded had its `tradeId` changed by anything in this phase. Zero writes to coded rows.
7. Bundle size against the 400 KB working ceiling, and what moved.

Report as a morning summary in `PROGRESS.md` under Phase 17, in the usual format.

---

## Known, deliberately not in this phase

- **Cross-kind party duplicates.** Charlie Bobcat appears three times across two kinds, Aluming across two. This weakens party history and directly limits Part C. It is a data merge needing the owner's decision on the Metro Consulting / Metro Consultancy / Metro Consulting Group three-way. Flag it again at the end; merge nothing yourself.
- **`APP_TRADES` does not match his real BOQ's 22 sections.** Out of scope. Do not attempt a reconciliation here.
- Production deploy. Not until he asks and names the surface.
