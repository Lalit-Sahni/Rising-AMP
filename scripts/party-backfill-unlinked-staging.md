# Party backfill — owner list (staging)

Auto-link is **exact `canonicalPartyName` equality only**, plus kind. Fuzzy `namesMatch` is listed here and is never written as a `partyId`.

## Counts

- Parties to create: 60
- Rows to stamp: 183
- Rows already stamped (skipped): 0
- Unlinked ledger rows: 19
- Writes planned: 243

## Candidate merge groups

These look similar (`namesMatch`, or the Mark apostrophe case where dropping single-character tokens makes the canonicals equal) but their canonical names differ. **Do not merge them automatically.**

### Group 1 — service provider (namesMatch)

Canonical forms: `metro consulting`, `metro consulting group`

| Display name | Canonical | Job | Collection |
| --- | --- | --- | --- |
| Metro Consulting | `metro consulting` | 72 Centenary Dr | expenses |
| Metro Consulting | `metro consulting` | 72 Centenary Dr | expenses |
| Metro Consulting Group | `metro consulting group` | 72 Centenary Dr | serviceProviders |

### Group 2 — service provider (namesMatch)

Canonical forms: `sydney excavation and demo`, `sydney excavation and demolition`

| Display name | Canonical | Job | Collection |
| --- | --- | --- | --- |
| Sydney Excavation and Demo | `sydney excavation and demo` | 72 Centenary Dr | expenses |
| Sydney Excavation and Demolition | `sydney excavation and demolition` | 72 Centenary Dr | serviceProviders |

### Group 3 — worker (namesMatch)

Canonical forms: `lalit`, `lalit sahni`

| Display name | Canonical | Job | Collection |
| --- | --- | --- | --- |
| Lalit | `lalit` | 72 Centenary Dr | expenses |
| Lalit Sahni | `lalit sahni` | 72 Centenary Dr | labour |

## Unlinked ledger rows

Expenses, invoices and quotes whose typed name did not exact-match one party of the right kind. Grouped by name.

| Name | Kind | Collection | Count | Jobs | Why |
| --- | --- | --- | --- | --- | --- |
| (no name) | — | expenses | 10 | 72 Centenary Dr, Kelly Street | no party hint (equipment) |
| (no name) | — | expenses | 3 | Kelly Street | no party hint (investor) |
| Metro Consulting | service provider | expenses | 2 | 72 Centenary Dr | no exact canonical match |
| ACME SCREW PILES | — | quotes | 1 | Kelly Street | no unique exact canonical match |
| Client | supplier | expenses | 1 | 72 Centenary Dr | no exact canonical match |
| Lalit | worker | expenses | 1 | 72 Centenary Dr | no exact canonical match |
| Sydney Excavation and Demo | service provider | expenses | 1 | 72 Centenary Dr | no exact canonical match |

## Created / linked

Parties to create:

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

Stamps: 183. Already correct: 0.

