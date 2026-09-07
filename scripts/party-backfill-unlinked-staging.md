# Party backfill — owner list (staging)

Auto-link is **exact `canonicalPartyName` equality only**, plus kind. Fuzzy `namesMatch` is listed here and is never written as a `partyId`.

## Apply (staging, 7 Sep 2026)

Staging Firestore rules deployed. Created **60** parties. Stamped **183** rows. Second dry-run: `0 write(s) planned`. Production was not touched. No functions or hosting.

## Counts (plan that was applied)

- Parties created: 60
- Rows stamped: 183
- Rows already stamped on verify: 183
- Unlinked ledger rows: 19
- Writes after apply: 0

## Merged on staging (owner yes, 7 Sep 2026)

`status: merged` + `mergedInto` only. Nobody deleted. Script: `scripts/merge-parties-staging.js`. Second dry-run: `0 write(s) planned`. Production was not touched.

| From | Canonical / kind | Created as (merged) | Survivor | Survivor id |
| --- | --- | --- | --- | --- |
| Lalit | `lalit` / worker | `gCXsTD8qspWEyvbkOTgG` | Lalit Sahni | `anabRwYbHvfQFxEEwdAj` |
| Sydney Excavation and Demo | `sydney excavation and demo` / service provider | `QgbD83aiiUJOoWXFeiaj` | Sydney Excavation and Demolition | `QCKcfwLfOpI355VanO8M` |

Stamped two 72 Centenary Dr expenses onto those survivors.

## Still back to the owner — do not merge

These look similar (`namesMatch`) but the owner has not named a survivor.

### Metro Consulting vs Metro Consulting Group — service provider

Canonical forms: `metro consulting`, `metro consulting group`

| Display name | Canonical | Job | Collection |
| --- | --- | --- | --- |
| Metro Consulting | `metro consulting` | 72 Centenary Dr | expenses |
| Metro Consulting | `metro consulting` | 72 Centenary Dr | expenses |
| Metro Consulting Group | `metro consulting group` | 72 Centenary Dr | serviceProviders |

Smith / Smithson Electrical and Mark's Joinery / Mark Joinery Pty Ltd were **not** in staging data, so they did not appear as groups. Tests still lock that bar.

## Unlinked ledger rows

Expenses, invoices and quotes whose typed name did not exact-match one party of the right kind. Grouped by name.

| Name | Kind | Collection | Count | Jobs | Why |
| --- | --- | --- | --- | --- | --- |
| (no name) | — | expenses | 10 | 72 Centenary Dr, Kelly Street | no party hint (equipment) |
| (no name) | — | expenses | 3 | Kelly Street | no party hint (investor) |
| Metro Consulting | service provider | expenses | 2 | 72 Centenary Dr | no exact canonical match |
| ACME SCREW PILES | — | quotes | 1 | Kelly Street | no unique exact canonical match |
| Client | supplier | expenses | 1 | 72 Centenary Dr | no exact canonical match |

## Created / linked

Parties created on staging:

- Vaneet Khera — `vaneet khera` (client)
- Fable test supplier — `fable test supplier` (supplier)
- GreatWater Fabrication & Lock Solutions Pty Ltd — `greatwater fabrication and lock solutions` (supplier)
- Aluming Pty Ltd — `aluming` (supplier)
- Bunnings Warehouse — `bunnings` (supplier)
- Complete Lintels Pty Ltd — `complete lintels` (supplier)
- Inspire — `inspire` (supplier)
- Mega Lighting — `mega lighting` (supplier)
- NSW Bricks — `nsw bricks` (supplier)
- Rodgers Revesby — `rodgers revesby` (supplier)
- Stratco — `stratco` (supplier)
- Mohammad (Tony) — `mohammad tony` (worker)
- Meesum — `meesum` (worker)
- Harkirat — `harkirat` (worker)
- Bismun — `bismun` (worker)
- krishna choudhary — `krishna choudhary` (worker)
- Lalit Sahni — `lalit sahni` (worker)
- Gurjant — `gurjant` (worker)
- Jaspal — `jaspal` (worker)
- Raunak — `raunak` (worker)
- Waterproof — `waterproof` (trade)
- Barton Construction Group — `barton construction group` (trade)
- Concreate — `concreate` (trade)
- Mak's Control — `mak s control` (trade)
- Aluming Windows — `aluming windows` (trade)
- Guri Bricky — `guri bricky` (trade)
- Legend Scaffold — `legend scaffold` (trade)
- COOLTECH ENTERPRISES PTY LTD — `cooltech enterprises` (trade)
- Pharoahs Plumbing — `pharoahs plumbing` (trade)
- Rockwall Framing Group — `rockwall framing group` (trade)
- My Group Rendrer — `my group rendrer` (trade)
- Price Right Bins — `price right bins` (trade)
- ACP Cladding — `acp cladding` (trade)
- WaterPlanet — `waterplanet` (trade)
- Julian — `julian` (trade)
- Punjab Skip BIns — `punjab skip bins` (trade)
- TCE ELECTRICAL PTY LTD — `tce electrical` (trade)
- Lear Enterprises — `lear enterprises` (trade)
- AK Electro Services — `ak electro services` (trade)
- Pavinder Roofer — `pavinder roofer` (trade)
- Charlies Bobcat and Tipper Hire — `charlies bobcat and tipper hire` (trade)
- No 1 Pest Control — `no 1 pest control` (trade)
- Tony (Silicon) — `tony silicon` (trade)
- Basta Traffic Management — `basta traffic management` (service provider)
- Charlie Bobcat — `charlie bobcat` (service provider)
- Charlie's Bobcat and Tipper Hire — `charlie s bobcat and tipper hire` (service provider)
- Demolition — `demolition` (service provider)
- HIA — `hia` (service provider)
- Loo Hire — `loo hire` (service provider)
- Metro Consultancy — `metro consultancy` (service provider)
- Metro Consulting Group — `metro consulting group` (service provider)
- Opal — `opal` (service provider)
- Opal SS Constructions — `opal ss constructions` (service provider)
- Punjab Skip Bin — `punjab skip bin` (service provider)
- Sydney Excavation and Demolition — `sydney excavation and demolition` (service provider)
- John Smith — `john smith` (worker)
- DSB Civil & Structural Design — `dsb civil and structural design` (service provider)
- Land Developers — `land developers` (service provider)
- Land Vendor — `land vendor` (service provider)
- Solicitor Prabhjit Kaur — `solicitor prabhjit kaur` (service provider)

Stamped: 183. Verify already-correct: 183.
