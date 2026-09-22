# 📋 #289 Phase 2 — the band stack (S1–S4) and revision (S7): investigation checkpoint

**Arc:** s2-arc34. **Branch:** `issue-289-band-stack`, cut from `main` at `e60c91c`
(= `origin/main` = prod `healthz`, checked 2026-09-22). **Authority:** `rulings.md`, filed
first on this branch. **Investigation only** — no product file is touched by this commit; the
only code written is the checkpoint probe under `prototype/`, which nothing imports.

Design authority read in full for this checkpoint: #281 Part 1 (body, §1–§8.40) and Part 2
(comment 1, rules 1–204), #289's body, FLOW.md §3–§9, DESIGN-PRINCIPLES.md P1–P22.

---

## THE SHORT VERSION

Phase 2 is **frontend-only**, and the wire is unchanged except for one additive flag that is
already deployed on the backend and has **zero senders today** (#282). Every band, fact line
and field maps to a scenario field that already exists. The writer enumeration is closed: nine
call sites write the scenario in setup today, and every one of them becomes a band re-open.

Nine things need your ruling before anything is built. Seven are code and spec questions; two
came out of the measurement probe and are arithmetic. None is a churn prediction — each one
would change or contradict a #281 rule, which is #288's standing stop condition.

| # | what | where |
|---|---|---|
| **R1** | The fifth-step section (Flagger / Cross street) has no band. Four bands were designed on the shoulder frame. | §D.4 |
| **R2** | `ScenarioPicker` renders all seven kinds with a disabled banner; rule 135 says gated kinds are "not rendered at all today". | §C.3 |
| **R3** | A preview skips the site scan, so **preview ≠ applied** — which collides with #267's invariant that #289 says Phase 2 absorbs. | §A.4 |
| **R4** | Rule 124 collapses NEEDS YOU in S7; ruling 186 says always expanded. State or contradiction? | §E.5 |
| **R5** | ACKNOWLEDGE — Phase 1's finding. Does revision give it a writer, or does it stay a row with no button? | §E.6 |
| **R6** | §8.25 moved site conditions into NEEDS YOU. The **pre-generate** half (`SiteConditionsField`) still sits in setup with no band to live in. | §D.5 |
| **R7** | `--nav-h` is 52 px; rule 21 says 48. Every landing target is computed from it. | §F.4 |
| **R8** | **The landing cannot land at 1440 in S3/S4** — the column is shorter than the viewport, so no scroll call can reach the computed spot. Ruling 184 assumes it can. | `prototype/band-stack-landing.md` §2 |
| **R9** | **The setup fact line measures 60 px at 1440 and 131 px at 380**, not rule 56's 44. Rule 28's `--fact-h: 44px` reserve — the thing Phase 1 deferred to Phase 2 — under-reserves by 16 px and 87 px. | `prototype/band-stack-landing.md` §3 |

Everything else below is a mapping, and it holds.

---

## A. The wire map, and the writer enumeration

### A.1 Every band, fact line and field already has a field

Checkpoint question (a) asks the wire to be proved unchanged. It is. Nothing in S1–S4 or S7
displays or writes a value the scenario does not already carry.

| surface | value | field it reads | mints a field? |
|---|---|---|---|
| WHERE, S1 | search text | `meta.address` | no |
| WHERE, S2 | the pin | `meta.lat` / `meta.lng` (0/0 = unset, `hasLocation`) | no |
| WHERE, S2 | the road and direction | `meta.confirmedRoad` (`types.ts:290-297`) | no |
| WHERE, S2 | extent | `scenario.workLen` | no |
| WHERE, S2 | the kind chips | `scenario.kind` + `SCENARIO_KINDS` / `ENABLED_SCENARIO_KINDS` (`lib/scenarios/index.ts:234,283`) | no |
| WHERE fact line | the whole string | the five above, joined | no |
| WHAT | speed / lanes / lane width | `scenario.speed`, `.lanes`, `.laneWidth` | no |
| WHAT | road type | `scenario.roadType` | no |
| WHAT | jurisdiction | `scenario.jurisdiction_key` + the evaluated `JurisdictionBlock` | no |
| WHAT | work dates | `scenario.schedule` (`date_mode`, `work_date`, `work_date_end`, `start_time`, `end_time`) | no |
| WHAT | every provenance line | `meta.confirmedRoad.fields[*]` through `lib/road-detection/provenance.ts` | no |
| GENERATE | the disabled reason | `deriveRail().blocker.message` (`lib/scenarios/rail.ts`) | no |
| S4 | the locked fact lines | the same two strings at `opacity .5` | no |
| S7 | the staged field | shell state, never the scenario, until APPLY | no |
| S7 | the before/after "was" column | the settled `deviceBreakdown` on screen | no |
| S7 | the before/after "now" column | the **preview** response (§A.3) | no |

**Rule 10 consequences, stated rather than assumed.** Three things the frames show have no
producer today and therefore render nothing or render a lesser truth:

- **"210 ft N of W 38th Ave"** (Part 1 §4.2, the move ledger's row 2, and the WHERE fact line)
  needs the nearest intersection at pin time. `lib/road-detection/cross-street.ts` exists but
  is the `near_intersection` kind's **deliberate second pin**, not a nearest-intersection
  producer for any kind. #281's own audit ruling already says what happens meanwhile: "until
  then the tag prints the road name, lat/lng in provenance". Phase 3 owns the real tag.
- **"✓ proposed"** on a kind chip (rule 135, Part 1 §4.4) has no derivation. #281: "the chips
  render unselected with no '✓ proposed'". Confirmed — nothing in `lib/` proposes a kind.
- **Move ledger row 5, "See the plan grow"**, is Phase 3's approaches. It renders `◌ pending`
  with its subline, which is rule 70's `pending` state and is honest.

Which move-ledger rows are honest today: **1 (Found the spot), 3 (Extent), 4 (Which side —
as a question, not a proposal)**. Row 2 is honest with a lesser value; row 5 is pending.

### A.2 The writer enumeration — "only APPLY writes", the list

Every call site that writes `scenario` or `meta` from a setup surface today. This is the
honesty test checkpoint (a) asks for: after Phase 2, each of these is reached through a band
re-open, and **none of them writes on blur**.

**`SetupStrip.tsx` — the nine inline writers (§8.27, ruling 190, #262 closes by deletion):**

| # | cell | site | writes | commit today |
|---|---|---|---|---|
| 1 | Jurisdiction | `:350` → `setJurisdictionKey` (shell `:1552`) | `jurisdiction_key` | `onChange` |
| 2 | Street class | `:388` → `setStreetClass` (shell `:1555`) | `street_class` | `onClick` |
| 3 | Speed | `:418` | `speed` | `onChange` |
| 4 | Lane width | `:450` | `laneWidth` | `onChange` |
| 5 | Work zone | `:213-223` `commitWorkLen` | `workLen` | **blur / Enter** (#252) |
| 6 | Date | `:521` `setSchedule` | `schedule.work_date` | `onChange` |
| 7 | Hours start | `:548` `setSchedule` | `schedule.start_time` | `onChange` |
| 8 | Hours end | `:570` `setSchedule` | `schedule.end_time` | `onChange` |
| 9 | Edit full setup | `:593-598` `onReopen` | nothing — a mode switch | click |

Two of the nine are `Structural` cells (Scenario `:319`, Road `:325`) that write nothing and
only reopen. Cell 5 is the only one that already commits on blur, and #252's comment explains
why — it is the pattern rule 95.2 generalises to every field.

**`GeneratorSidebar.tsx` — the panel writers:**

| site | writes |
|---|---|
| `:300` `setMeta` | the whole `meta` object, from every section below |
| `:304` `onPickerSave` → `:317` `withPin(...)` | pin, bearing, confirmed road, overrides, and the handoff record |
| `:439` `ScenarioPicker onChange` → `onKindChange` | `kind` (carry-across-kinds) |
| `:1208`, `:1220` | manual lat / lng, each through `withPin` |
| the per-kind forms (`ShoulderForm`, `FlaggerForm`, `NearIntersectionForm`) | `speed`, `lanes`, `laneWidth`, `roadType`, `divided`, night, speed-reduction, AFAD, pilot car, approaches |
| `ScheduleField` | `schedule` |
| `SiteConditionsField` | `meta.siteConditionOverrides` |

**`withPin`** (`lib/scenarios/site-corrections.ts:138`) is the one that matters for S7: a pin
move clears staged site corrections. Rule: **a pin move discards the staged set**, and the
band must say so before it moves rather than after.

**After Phase 2 the writers are exactly three:**
1. **APPLY** — folds the staged field set and the staged corrections into one write (ruling 191).
2. **The kind chips' Confirm** — `kind` is confirmed, never inferred (suggest-never-set).
3. **The picker's Save** — `onPickerSave`, unchanged, because the modal stays (ruling 189).

Everything else stages. That list is what the payload-level assertion tests.

### A.3 The one new sender: the preview

`#282` shipped **backend-first and is deployed** (`src/api/schemas.py:197-223`,
`src/api/render_api.py:196-218`, `:1300-1332`). The contract, as the backend states it:

- `preview: bool = False` on every scenario kind (`PreviewScenarioFields`).
- Accepted on **`/render/device-breakdown` only**; every other path raises an honest 400 naming
  the flag (`_ensure_preview_allowed`).
- When set: the cheap numbers only, **the site scan does not run**, nothing is memoised.
- The response echoes `"preview": true` — "the mechanism rather than a courtesy".

**Senders today: zero.** `grep -rn "device-breakdown" conestruct/site` gives one proxy
(`lib/render-proxy.ts:213`) and one route (`app/api/render/device-breakdown/route.ts`);
neither knows the field. Phase 2 makes the sender count **one**: the revision preview, which
posts the staged scenario with `preview: true` to the existing breakdown route. No new
endpoint, no new proxy, no schema change. **Backend: 0.**

### A.4 R3 — preview ≠ applied, and #267 says it must be

The backend records the consequence at the field's own definition:

> the consequence the ruling accepts, recorded where the field is defined: a preview skips the
> scan, so it computes taper/buffer/spacing WITHOUT the site adjustments an Apply would add.
> Preview != applied (#198's family).

#289's "Absorbs" list says the opposite for the same panel:

> #267 (send the widths; "preview must equal applied" is an invariant for the revision preview
> too)

Both cannot hold. The numbers in the before/after panel are, by the backend's own design, a
different computation from the one APPLY performs — on any plan whose site scan adds devices,
the panel's "now" for Total devices is **wrong for the applied plan, and correct for the
question the panel asked**.

Rule 91 makes the panel state *which value* the figures are for. It does not make it state
*which computation* produced them, and that is the gap. Three answers:

- **(a) The header note grows a clause** — "for 35 mph · before site conditions". One string,
  rule 91's own slot, and it is true in all four situations.
- **(b) The Total devices row carries the deferred treatment** (rule 95.5's `deferred`,
  "recomputes on apply") whenever the plan on screen has any scanned condition that changed
  counts, and the number when it does not. Most honest, most conditional, and it means the row
  changes treatment for reasons the user cannot see.
- **(c) #267's invariant is scoped to the picker preview only** and this is recorded as a
  deliberate exception, with the panel saying nothing extra.

**Recommendation: (a)**, because it is one clause in a slot rule 91 already reserves, it costs
no conditional logic, and it makes the difference visible in every situation rather than only
the ones a predicate catches. (c) is the option that quietly reopens #198's family.

---

## B. The component plan, per rule

Checkpoint question (b). "Carried" = mounts unchanged in a new parent. "Restructured" = same
job, new shape, existing tests re-point. "New" = nothing today does this.

| rules | component | verdict | where it is today |
|---|---|---|---|
| 50–55 | C2 verdict strip | **carried** | `StatusBar.tsx` — Phase 1 left it; §8.33 is a rename only |
| 56–60 | C4 collapsed fact line | **new** | nothing renders one; `--fact-h` is declared (`globals.css:772`) and `ResultsHead.tsx` is where Phase 2 restores its slot |
| 61–66 | C3 open band | **new** | `FieldGroup` (`GeneratorFormPrimitives.tsx`) is the nearest thing and is a section, not a band |
| 67–71 | C5 move ledger | **restructured** | `ProgressRail.tsx` + `lib/scenarios/rail.ts`. The **derivation is carried verbatim** — `deriveRail` already emits `state / glyph / word / info / aria` per entry and #228's sentinel test forbids a second one. Only the component changes. |
| 72–79 | C6 NEEDS YOU | **carried** | `NeedsYou.tsx`, shipped in Phase 1 |
| 90–95.15 | C10 before/after panel | **new** | nothing computes or shows a delta |
| 130–131 | `.pri` / `.pri.xl` | **restructured** | `GenerateButton` inside `GeneratorSidebar.tsx:556`; the framed footer is §8.26's |
| 132 | `.ghost` | **carried** | `.dl-btn` / `.scan-actions` treatment |
| 133 | `.act` ledger action | **new** | the rail's jump buttons are the ancestor and they go (§8.17) |
| 134 | `.lk` fact link | **new** | the strip's `⤢ / ✎` split is what it replaces (§8.27) |
| 135 | `.chip` kind chip | **restructured** | `ScenarioPicker` (`GeneratorSidebar.tsx:1280`) — same labels, same TA/sheet citations, same carry-across-kinds; vertical list → horizontal chips. See **R2**. |
| 136–138 | `.fld` + provenance line | **restructured** | the forms' inputs plus `DetectedVsApplied.tsx`'s clause; #273's producer is already single-sourced |
| 139 | blocker chain | **carried** | `deriveRail().blocker` — already one source for the CTA reason and the rail (`rail.ts:266-288`), already asserted |
| 140 | disclosure row | **carried** | `DisclosureRow.tsx`, Phase 1 |
| 26, 33 | band stack container + focus target | **new** | the results stack's target exists (`GeneratorShell.tsx:1604`); the band stack's does not — `setupRef` (`:1511`) is on the zone that the bands replace |

**Retires as a shape, transfers as facts:** `SetupStrip.tsx` (605 lines, deleted — §8.27),
`ProgressRail.tsx` (component only — its derivation stays), `DetectedVsApplied.tsx` (443
lines; its six rows become provenance lines — §8.23, "the separate block is gone; nothing it
said is gone"), the `setup-panel` / `setup-grid` shell and the `zone-head` in
`GeneratorShell.tsx:1515` (§8.28 — Phase 1 dropped the results heading; the setup heading is
still there).

### B.1 Every `tr-question` use — role 5's first consumers

`.tr-question` is declared (`lib/design/type-roles.ts:129`, `globals.css:2652`, with the
`≤520px` variant at `:2662`) and has **no consumer in the product today**. Phase 2 mounts
exactly **five**, one per open band per state, never two at once (rule 65):

| # | state | band | the question, verbatim from Part 1 |
|---|---|---|---|
| 1 | S1 | WHERE | "Where is the work?" |
| 2 | S2 | WHERE | "Where is the work?" (unchanged — the band does not re-title mid-step) |
| 3 | S3 | WHAT | "Anything we got wrong?" |
| 4 | S7 | the re-opened band | the same question as its step, under the "REVISING · {FIELD}" header |
| 5 | — | GENERATE | **none.** The generate frame (rule 116) has a primary and a caption, no question. |

So the count is **three distinct strings, one live at a time**. The probe confirms the token
switches 22 px → 19 px on its own at 520 (`prototype/band-stack-landing.md` §4); #283 needs no
further work for Phase 2.

---

## C. WHERE, with the modal behind it (ruling 189)

Checkpoint question (c).

### C.1 The three states

| state | the band shows | the modal |
|---|---|---|
| **S1, no pin** | question, provenance, search field + FIND (rule 114: 1fr / 132 px, gap 12, both 44 px), aerial placeholder 296 px with its centre hint | closed |
| **S2, pin dropped** | aerial 300 px with the segment, the **outcome** as the move ledger's row 1 ("✓ Found the spot …… E Colfax Ave EB, Denver"), the kind chips, the confirm primary | **opened from the band** for the decision work — candidates, bearing, cross-street, suggestions. `LocationPickerModal.tsx` is 3,293 lines and **none of it moves this phase**. |
| **S3, confirmed** | the band is gone; one fact line plus the 104 px corridor strip (rule 116) | closed |

**What opens it:** the ledger's row-1 `CHANGE` action, and the row-2 `MOVE` action. Both are
`.act` controls (rule 133) inside the band. **What closes it:** Save (`onPickerSave`,
`GeneratorSidebar.tsx:304`) or Cancel, unchanged. **What the band reads back:** exactly what
`onPickerSave` writes today — `lat`, `lng`, `bearingDeg`, `confirmedRoad`, the detection
overrides, and the handoff record that drives the `.sys-event` "Applied from picker" block
(`:907`).

### C.2 The #234 rehydration contract, extended

#234 today: the intersection marker is not restored when the picker reopens. #289 adds "fact
line and modal agree on the intersection in **both** directions". That is two assertions, and
only one of them is #234's:

- **Modal → fact line** (#234's own direction): reopening the picker restores what the
  scenario holds. The picker already takes `initial.confirmedRoad`
  (`GeneratorSidebar.tsx:575`); the intersection is the part it drops.
- **Fact line → modal** (new): the value the fact line prints and the value the modal shows are
  **one derivation**, not two formattings of the same fields. This is the #228 discipline
  applied to a second surface, and it is the only way the two cannot drift.

Consequence for the build: the WHERE fact-line string gets a **named producer** in
`lib/scenarios/` — a pure function, like `deriveRail`, that both the fact line and the picker's
summary read. Nothing composes it inline.

### C.3 R2 — the kind chips and the four gated kinds

Rule 135 on the gated variant: "opacity .45, **not rendered at all today** (only three kinds
are enabled)". Today `ScenarioPicker` (`GeneratorSidebar.tsx:1280`) renders **all seven** of
`SCENARIO_KINDS` and pairs them with `DisabledScenarioBanner`, which is how a user learns a
kind exists but is not available. `ENABLED_SCENARIO_KINDS` is `["shoulder",
"flagger_lane_closure", "near_intersection"]` (`lib/scenarios/index.ts:283`) and must match
`render_api.py`'s `ENABLED_SCENARIOS`.

Not rendering the four is a **behaviour change**, and rule 5 says a behaviour change is
deliberate and stated. It also collides with #277's surviving half, which #289 keeps: "gated
kinds name it in their enablement bar" — a kind that does not render has no bar to name it in.

- **(a) Rule 135 as written** — three chips, the four gated kinds disappear, `DisabledScenarioBanner`
  is deleted, and #277's second bullet closes as moot.
- **(b) Three chips plus a provenance line** under them naming what is not offered and why
  ("four kinds are not enabled — each needs its typical sheet validated"), which keeps rule
  135's chip row and keeps the fact discoverable.

**Recommendation: (b)**. Rule 10's instinct is that absence renders as absence, and four kinds
vanishing with no word is absence rendering as nothing. It costs one provenance line.

---

## D. WHAT — the field grid with provenance

Checkpoint question (d).

### D.1 The producer, and it is already one

`lib/road-detection/provenance.ts` (#273) is the single producer:
`sourceToken()`, `provenanceClause()`, `valuesAgree()`, `appliedTokenFor()`, over the frozen
tables `DETECTED_TOKENS` (`measured` / `inferred` / `overridden`), `APPLIED_TOKENS`
(`operator-set` / `changed in plan`), plus `WITHDRAWN` and `NO_DETECTED_TOKEN`. Its own header
records why it exists: the picker and the ledger each minted the same strings and one of them
string-compared its own output to choose a colour.

So the WHAT grid composes from it and mints nothing. Rule 138's amber is
`provenanceClause({detectedToken: "inferred"})` and the amber is a **class on the provenance
line, never the field border**.

### D.2 Which fields have a producer, and which do not

The ledger's six rows (`DetectedVsApplied.tsx:230-400`) are Bearing, Speed limit, Lanes per
direction, Road type, Divided, One-way. The WHAT grid's six cells are speed / lanes / lane
width; road type / jurisdiction / work dates. They do not line up:

| WHAT cell | producer | line it renders |
|---|---|---|
| Speed limit | ledger row 2 | `OSM · 30 mph · measured` |
| Lanes | ledger row 3 | `OSM · 2 · measured`, `· operator-set` / `· changed in plan` when it differs (#275's `overridden` third state) |
| **Lane width** | **none — detection never reports it** | `your change · operator-set from here on` (rule 137's own example for an operator-set field) |
| Road type | ledger row 4 | `⚠ OSM · inferred, not measured` when the classifier inferred (rule 138) |
| **Jurisdiction** | not detection — the evaluated `JurisdictionBlock` and the pin suggestion | §D.3 |
| **Work dates** | **none — operator-only** | `optional · permit lead times need it` (Part 1 §7.13) |

**Three ledger rows have no WHAT cell**: Bearing, Divided, One-way. §8.23 says "nothing it said
is gone", and #289 says #214's bearing disclosure "survives as the WHAT band's provenance
(restyled, never deleted)". Where they go:

- **Bearing** — the WHERE fact line's provenance and the corridor strip's caption. It is a
  property of the road, not of the job, and the sidebar already prints it there
  (`GeneratorSidebar.tsx:888`). #214 is satisfied by the clause surviving, not by a field.
- **Divided / One-way** — the **road type** cell's provenance line, which is where they belong:
  they are what makes a road type what it is, and the ledger already reports them as detection
  facts about the same road.

Rule 137 — "a field with no provenance line is a defect" — is therefore satisfiable for all
six cells, with two of them carrying an operator-set or optional clause rather than a
detection one.

### D.3 The jurisdiction field's three states (ruling 196, rule 14, #276)

Today, two live defects in one control:

1. **`JurisdictionSection.tsx:252` renders `.jbar-skel-line` while the evaluated block is in
   flight.** That is a skeleton, and rule 14 forbids skeletons anywhere. Its comment says the
   quiet part out loud: "the chain slot renders a skeleton at final size so data landing causes
   zero reflow" — it is solving rule 28's problem with the thing rule 14 bans.
2. **`SetupStrip.tsx:262-266` falls back to the static label** when the evaluated block is
   absent **or errored**: `jurisdiction?.name ?? JURISDICTION_OPTIONS.find(...)?.label ?? key`.
   That is #276 exactly — an errored evaluation renders as a confident name.

Ruling 196 gives three states and no fourth:

| state | the field shows | the provenance line |
|---|---|---|
| unset | `Not set` (rule 136's placeholder word) | `MUTCD + Colorado Supplement only` |
| evaluated | the block's `name` | `evaluated · <authority> · calls this plan a <tcp_term>` |
| **errored** | the last honest thing — the **selected key's label**, never presented as evaluated | an honest word: `not evaluated — <reason>`, and the row does **not** claim the authority |

The reserved height that stops the reflow transfers from §8.31's bar (`globals.css:1790-1805`,
`.jbar-slot-auth` / `-hint` / `-chain`, 36 / 34 / 108 px) as a **min-height on the provenance
line**, not as a skeleton. That is ruling 196's "no skeleton; §8.31's reserved height
transfers", read literally.

**A finding, not a ruling:** those three `.jbar-slot-*` rules are already dead CSS —
`JurisdictionContextBar` was deleted in Phase 1 and nothing renders them (LEG6.md's findings
section lists all nine orphaned selectors with line numbers). Phase 2 is the commit that
deletes them, because it is the commit that replaces what they reserved for. `.jbar-auth`,
`.jbar-skel-line` and `.jbar-suggest` are **live** and must not be swept up with them.

### D.4 R1 — the kind switch, and the section with no band

§8.22: "which fields render still switches on kind". That is true of the 3 × 2 grid — and it is
not the whole switch. Two of the three live kinds carry a **fifth FieldGroup** that the grid has
no room for:

| kind | fifth section | what is in it |
|---|---|---|
| `shoulder` | none | — |
| `flagger_lane_closure` | **Flagger** (`FlaggerForm.tsx:419`) | AFAD, pilot car, pedestrian detour |
| `near_intersection` | **Cross street** (`NearIntersectionForm.tsx:336`) | the approach set, the signalized-intersection flag, and the **approach-confirm hold** — which is a rail blocker (`rail.ts:HOLD_BLOCKER`) and therefore a verdict-strip string and a disabled-primary reason |

`FIFTH_STEP_LABEL` (`rail.ts:147`) is the existing table; `deriveRail` already emits the
`extra` entry only when the kind has one. Part 1's four bands were drawn on the **shoulder**
frame (§2.3's grid is speed / lanes / lane width, road type / jurisdiction / dates — a shoulder
job), and neither Part 1 nor Part 2 says where the fifth section goes.

- **(a) A third row in the WHAT grid**, rendered only for kinds that have one. Keeps four bands.
  The grid stops being 3 × 2 and the band grows ~120 px for two of three kinds.
- **(b) A fifth band**, conditional on kind. Honest, and it breaks ruling 198's "four bands, not
  five" for two of the three live kinds — including the `STEP n OF 4` index in every header.
- **(c) A disclosure inside the WHAT band**, closed by default, counted in its header.
  Preserves four bands and the grid; puts the `near_intersection` approach-confirm blocker
  behind a click, which is a P3 problem — the thing blocking Generate would not be visible.

**Recommendation: (a)**, with the blocker's own row never inside a disclosure. It keeps ruling
198 intact, it keeps rule 139's chain visible, and "which fields render switches on kind" is
already the rule. **RULING NEEDED** because the 3 × 2 grid is rule 116's, and (a) edits it.

### D.5 R6 — site conditions, the half that did not move

§8.25 moved "Site conditions you assert" into NEEDS YOU, and Phase 1 built that:
`NeedsYouConditions.tsx` renders the rows post-generate, with staging. But
`SiteConditionsField.tsx` still mounts **pre-generate** in the setup panel
(`GeneratorSidebar.tsx:527`), and NEEDS YOU does not exist before a plan does. So in S1–S3
there is a surface that asserts site conditions and, after Phase 2, no band that holds it.

- **(a) It moves into the WHAT band** as a third row / disclosure with the fifth section (R1).
- **(b) It does not render pre-generate at all** — conditions are asserted against a plan, and
  before a plan there is nothing to assert against. The operator sets them in NEEDS YOU after
  the first generate, and the first plan is generated without them.
- **(c) It gets the GENERATE band**, which is otherwise a primary and a caption with a whole
  band to itself.

**Recommendation: (c)**. The GENERATE band is the emptiest band in the column and "anything you
already know about the site, before we look" is the last question before the button. It costs
no grid change and it keeps a pre-generate assert path that exists today. (b) is a behaviour
deletion that would need its own rule-5 statement.

### D.6 The three issues the grid absorbs

- **#209** — the picker offers `max={6}` lanes (`LocationPickerModal.tsx:2440`) against a domain
  max of 4, and renders lanes/divided editors on kinds that discard them. In the WHAT grid the
  lanes cell is `max={4}` and a field a kind discards is **read-only with its reason on its own
  provenance line** (rule 136's `invalid` / `disabled` variants, never a silent absence).
- **#215** — window boundaries labelled. `ScheduleField.tsx:239` `ScheduleWindowsBlock` moves
  with the dates cell; the labels are added there and tested at the grid's column width (about
  270 px at 1440) **and** at 380, which is what #215 asks for.
- **#267** — the picker preview sends the scenario's widths. This is the picker's own
  corridor-spec call (`LocationPickerModal.tsx:581` → `fetchCorridorSpec`,
  `render-proxy.ts:291-295`), whose body carries `kind / speed / roadType` and lets lane width
  and shoulder width ride backend defaults. Phase 2 adds `laneWidth` and `shoulderWidth` to
  `CorridorSpecRequestBody`. **This is a second wire change** — small, additive, and the
  backend's `CorridorSpecRequest` must take the fields first (Pydantic drops unknowns). Named
  here so the "backend: 0" claim stays true or stops being made: **backend 0 for the preview,
  backend 1 small additive schema change for #267**, or #267 defers.

---

## E. Revision (S7) — the preview is a read

Checkpoint question (e).

### E.1 Where staged field edits live

In the **shell**, beside the staged corrections, generalised once — FLOW.md §5b is explicit:
"generalised once at the shell, never rebuilt inside each editor (P11, the re-audit)".

Today `GeneratorShell.tsx:512` holds `const [staged, setStaged] = useState<StagedCorrection[]>([])`,
where `StagedCorrection = StagedScanCorrection | StagedManualCondition` (`types.ts:285`).
Phase 2 widens that union with a third member — a staged **field** edit (`{field, from, to}`)
— and `stage()` / `unstage()` / `applyStaged()` (`site-corrections.ts:211-263`) take it.
`stagedDisclose` (`GeneratorShell.tsx:1344`) already mounts the stale dim for `staged.length > 0`,
so S7's dim needs no new predicate.

**Consequence, and it is ruling 191's whole point:** the staged set is one list, so APPLY is
one write, and the sentence enumerates what is in it — "1 field · 2 corrections".

### E.2 What fires the preview, and what it carries

- **Fires:** blur or Enter on a staged field (rule 95.2). Never on keystroke. This is exactly
  `SetupStrip.tsx:213`'s `commitWorkLen` pattern, which #252 already established and which is
  the one editor in the build doing the right thing today.
- **Carries:** the wire scenario with the staged value applied and `preview: true`, POSTed to
  the existing `/api/render/device-breakdown` route. Nothing else — no audit, no scan, no PDF
  (the backend refuses those with a named 400).
- **Writes:** nothing. No band (rule 95.1), no lock, no memo, the field stays editable.
- **The panel's four situations** map onto request state directly: **7a** no request has been
  fired for the value in the field · **7b** in flight · **7c** landed · **7d** failed.

The reserved status row (rule 95.4) is what makes 7a → 7b → 7c move nothing below it, and it is
the panel's **only** live region (rule 95.14).

### E.3 What the panel does with the answer

Six rows, always, in all four situations (rule 90). Four previewed — taper L, buffer B, device
spacing, total devices — from `zone_geometry` and `total_devices`, which the breakdown response
already carries and the counts hero already renders. Two deferred — **Verdict** and **Needs
you** — which "always show their current value in `was` and always read `recomputes on apply`
in `now`, in all four situations, including 7c" (rule 95.6). They are never predicted, which is
rulings 195 and 204 discharged at the row level.

### E.4 APPLY's fold, and DISCARD

- **APPLY** merges the staged field set into the scenario and the staged corrections into
  `meta.siteConditionOverrides` in one `setScenario`, fires one generate, mounts one working
  band. The footer sentence enumerates. In **7b** and **7d** it stays enabled and the sentence
  says what is being given up (ruling 202's two strings, verbatim in `rulings.md`).
- **DISCARD** clears the staged list and re-collapses the band. No dialog (Part 1 §5.6).
- **Escape** is DISCARD, and it must fire **zero requests** — #289's acceptance. The preview is
  the only request in the neighbourhood and it is already fired only on commit, so this holds
  by construction and is asserted, not assumed.
- **A pin move clears everything** (`withPin`), staged fields included.

### E.5 R4 — ruling 186 against rule 124

- **Ruling 186**, on S8: "S8's collapsed NEEDS YOU — **rejected**. Always expanded.
  State-dependent defaults drift."
- **Rule 124**, on S7: "In S7 NEEDS YOU renders collapsed as a disclosure reading '▲ Needs you ·
  3 · for the plan on screen', because its expanded actions belong to the answer on screen, not
  to the staged change."

Both are about the same block defaulting to collapsed in one state. Ruling 186's stated reason
— state-dependent defaults drift — applies to rule 124 word for word. The difference Part 2
offers is that S7's collapse has a **reason about correctness** (the actions would write against
a plan the user is mid-way through replacing) where S8's was an assumption about the reader.

- **(a) It is a state, not a contradiction.** Rule 124 stands; the collapse is justified by the
  actions being wrong to offer, not by the reader having read it. The summary line's
  "for the plan on screen" clause is what says so.
- **(b) It is a contradiction.** NEEDS YOU stays expanded in S7 and its **actions** are disabled
  with the reason on their title (rule 130's disabled contract), which shows the items and
  refuses the writes.

**Recommendation: (a)**, because (b) puts three disabled action rows on screen in the state
that already has the most controls, and rule 141 forbids nothing here but P18 does. But this is
a direct ruling-186 question and I am not going to decide it by preference. **RULING NEEDED.**

### E.6 R5 — ACKNOWLEDGE's home

Phase 1's finding, recorded in #288's ruling (d): "if the wire carries nothing for it to write,
it does not render as a button. The item shows with its provenance 'surfaced, not
auto-applied' and no action … Record it as a finding for #289 (revision mode may give it a real
home)."

Revision mode **does** now offer a home: the staged set. An ACKNOWLEDGE would stage like a
correction and ride the same APPLY. What it still lacks is a **wire field to write** — nothing
in the scenario records "the operator has seen this conditional item", and minting one is a
backend change this phase has no budget for.

- **(a) It stays a row with no button**, unchanged from Phase 1, and the finding carries to the
  phase that mints the field.
- **(b) It stages as a client-only acknowledgement** that suppresses nothing, persists nothing,
  and is lost on reload. That is a control that writes nothing, which is what Phase 1 refused.
- **(c) It gets a field** — `meta.acknowledged: string[]` — which is a wire change, frontend-only
  (like `confirmedRoad`, which the backend ignores), and therefore cheap.

**Recommendation: (a)** for Phase 2 and file (c) as its own issue. (c) is right and it is not
this arc's.

---

## F. The landing, per transition — measured

Checkpoint question (f). Full numbers, method and the three options in
**`prototype/band-stack-landing.md`**; `prototype/band-stack.html` is the rig and
`prototype/measure-landing.js` the probe. Headline:

### F.1 The displacements

| transition | 1440 | 380 |
|---|---:|---:|
| S1 → S2 | +367 | +571 |
| S2 → S3 | −288 | −97 |
| S3 → S4 | −324 | −745 |
| S4 → S5 | +500 (stand-in) | +490 (stand-in) |
| S5 → S7 | +590 | +827 |
| S7 → S5 | −590 | −827 |

Part 1 §7.1 estimated 300–430 px. The measured range is **97–827 px**, and the largest is the
S7 re-open at 380, which is more than a viewport.

### F.2 R8 — four of six transitions cannot land at 1440

Because the column is shorter than the viewport in S3 (`docH 1000` in a 1000 px viewport =
zero scrollable pixels), no scroll call can put the target at `--nav-h + 8`. `armLandingCheck`
would burn both re-issues and end 276 px off. **Ruling 184 assumes a computed spot exists; in
S3 and S4 at 1440 it does not.** Three options and a recommendation in the probe note.

### F.3 R9 — the fact line is 60 px, not 44

Measured with #281's own S5 string: **60.00 px at 1440, 130.63 px at 380**. `--fact-h: 44px`
(`globals.css:772`) under-reserves by 16 and 87 px — and rule 56's 44 px is ~3.6 px short of
its own padding plus rule 8's line-height even on the shortest possible line (45.50 px
measured). This is the reserve **Phase 1 explicitly deferred to Phase 2** (`ResultsHead.tsx`,
the recorded deviation), so Phase 2 is where it gets the right number or the right shape.
Three options and a recommendation in the probe note.

### F.4 R7 — `--nav-h` is 52, rule 21 says 48

`globals.css:747` declares `--nav-h: 52px`; rule 21 specifies "Height 48 px". Every landing
target in the build is computed from the token (`:1454`, `:1470`), and every arc-28 leg
measured against it. Either the nav moves to 48 (a visible 4 px change with its own churn and
its own re-measure of every landing leg) or rule 21 is corrected to 52. The probe measured
against **52**, deliberately, so its numbers transfer either way. **RULING NEEDED** — it is a
#281 rule.

### F.5 Focus, aria and the lock (checkpoint question 7)

- **Rule 33** — two targets, both `tabIndex={-1}`. The results-stack target exists and is
  correct (`GeneratorShell.tsx:1604`, with Phase 1's comment explaining why it stayed). The
  band-stack target is new; `setupRef` (`:1511`) sits on the zone the bands replace and moves
  onto the stack container. "Generate focuses the results stack at the settle" is already what
  `:1032` does. "A CHANGE link focuses the band it re-opens" is new.
- **Rule 118** — `aria-disabled`, not `disabled`, under the lock, so controls stay focusable;
  focus returns to the opener **only if the close actually dropped focus to body**. Both halves
  exist today (`SetupStrip.tsx:81-87` and `:205-231`) and are the contract rule 118 says is
  "unchanged from the setup strip's contract" — so the strip's deletion must carry them, not
  bury them.
- **Write-lock declarations** — `data-write` is on 11 sites in `SetupStrip.tsx` alone; every new
  band control declares one, and the honesty test extends to them. The **preview control does
  not**: a read is not a write, and declaring it would be the misstatement rule 95.1 exists to
  prevent.
- **Rule 139** — the blocker chain is already single-sourced in `deriveRail` and already
  asserted (`ProgressRail.single-voice.test.tsx`, `GeneratorShell.rail-single-source.test.tsx`).
  The three consumers change (verdict strip, disabled primary, move-ledger attention rows); the
  derivation does not, and #228's sentinel transfers to the fact lines.

---

## G. Rule 5 — the churn, predicted before the diff

Checkpoint question (g). Rule 5: churn is predicted, never explained after the fact.

### G.1 Unit suites that break by construction

**35 files** reference a surface this phase deletes or restructures
(`rail-step` · `setup-strip` · `sv-editor` · `zone-head` · `Pick Location on Map` ·
`ProgressRail` · `SetupStrip` · `deriveRail` · `DetectedVsApplied`). Grouped by what happens
to them:

| group | files | disposition |
|---|---|---|
| `ProgressRail.test.tsx`, `ProgressRail.single-voice.test.tsx` | 2 | **re-point** to the move ledger. The derivation assertions transfer unchanged — they test `deriveRail`, not the component. |
| `lib/scenarios/rail.test.ts` | 1 | **unchanged.** The derivation is carried verbatim; if this file needs an edit, something was re-derived and that is the defect #228 forbids. |
| `SetupStrip.*.test.tsx` (disclosure, focus, jurisdiction, schedule) | 4 | **retire as layout, transfer as behaviour.** The focus-restore contract (rule 118) and the jurisdiction states (#276) become band tests; the strip's cell layout goes with the strip. |
| `DetectedVsApplied.*.test.tsx` | 6 | **retire as layout, transfer as facts** — #289's own words for the #273 ledger. Every provenance clause assertion moves to the WHAT grid's lines; `provenance.test.ts` is untouched, because the producer does not change. |
| `GeneratorSidebar.*.test.tsx` (corridor-bar, fact-strip, jurisdiction-band, prepin-gating, manual-pin-move) | 5 | **re-point** to the WHERE and WHAT bands. |
| `GeneratorShell.*` (zone-headings, zone-staging, rail-vocabulary, kind-switch, results-head, confirmed-road, picker-reapply, batch-corrections, near-intersection, scan-*, handoff-provenance, disclosure-container) | 14 | **re-point selectors.** Behaviour assertions stand; the query strings change. |
| `shell-chrome.test.tsx`, `NeedsYouConditions.*`, `WorkingBand.test.tsx`, `LocationPickerModal.a11y.test.tsx` | 3 | **incidental references** — checked, not re-pointed, unless they select a dropped node. |

`GeneratorShell.results-head.test.tsx` is the one that changes meaning rather than selectors:
it currently asserts the slot renders **nothing** (Phase 1's deviation). Phase 2 restores an
occupant, so the assertion inverts — and that inversion is the deviation being closed, which is
exactly what `ResultsHead.tsx` says Phase 2 is for.

### G.2 Live-check suites (#237)

**85 files** under `validation-artifacts/committed/` reference one of those selectors, across
the arc-1 … arc-32 and s2-arc1 … s2-arc32 legs. They are **committed evidence of past runs**,
not a suite that runs on every change, and they are not re-pointed retroactively — rewriting a
finished report's probe is the thing LEG6 called "a file that changes under a finished report
makes the report unreadable".

What #237 actually asks for is narrower and is this phase's: the **s2a7 browser live-check
helper matches the rail's Generate entry and reports a false "0 checked"**. The rule #289 sets
is **zero-match fails loudly**, and that is a property of the helper, not of the 85 files. So:

- the helper gains a zero-match throw, once, in this phase's own evidence directory;
- every probe this phase writes mints `data-testid` hooks as the bands are built — band
  identity, open / collapsed / pending — so the next arc selects on a declared hook rather than
  on a class that a restyle can move;
- the older legs stay as they are, and the README records that they describe a surface that no
  longer exists.

### G.3 The 380 axe baseline

Phase 1 closed line 7 at 380 (`38 interactive`, `under: []` at both floors,
`axe target-size: 0`). Phase 2 adds `.lk`, `.act`, `.chip` and six `.fld` controls, all of which
rule 15 puts at **44 px minimum at 380** — `.act`'s 32 px is explicitly raised by rule 133's own
last line. The baseline to beat is therefore "still zero", and the probe measures it at the
32 floor and the 44 floor the way LEG6 did.

### G.4 Contracts that must not move

| contract | how Phase 2 keeps it |
|---|---|
| **#198 byte-identity** | The two `.sys-event` blocks that move are `GeneratorSidebar.tsx:907` ("Applied from picker", the handoff notes) and `JurisdictionSection.tsx:410` (the suggestion records). Their sentences are single text nodes and stay single text nodes in their new container. Asserted by the existing `disclosure-container` tests, re-pointed. |
| **rail single-voice (#228)** | `deriveRail` is the one derivation; the fact lines and the move ledger read it. A second derivation is the defect the sentinel test exists to catch, and the sentinel transfers. |
| **suggest-never-set** | The kind chips confirm, never infer. Only APPLY writes. **The preview writes nothing — asserted at payload level**, which means asserting the request body carries `preview: true` and that no `setScenario` fires on the response. |
| **spec 31** | No band + refusal co-frame. S6's rule 120 unmounts everything else; the fact line stays and stays changeable. |
| **write lock** | `data-write` on every new write control; **not** on the preview. |
| **expectation-JSON pin, snapshots, PDF containment** | Untouched — frontend-only. |
| **citation counter 19** | No new citation is authored. The chips' TA/sheet strings are `SCENARIO_KINDS`' existing `sub` values, verbatim. |
| **`getByText` direct text nodes** | Unchanged discipline. |
| **Rules 3 / 10 / 12 / 13** | Rule 3: no frontend computes taper, buffer or counts — the preview is a request. Rule 10: §A.1's three no-producer surfaces render absence. Rule 12: every new constant in this phase is a #281 rule number, cited. Rule 13: §D.3's amber is on the provenance line and the dim in S7 is rule 122's, which is #288's open contrast question (unposted issue, body at `s2-triage-3/issue-dim-contrast.md`) — **Phase 2 puts more nodes under that wrapper and should not land before it is settled**. |

---

## H. The commit sequence

Checkpoint question (h). Each shippable, each naming the surface it mounts, **no ship that
changes nothing visible** (the arc-33 rule).

| # | commit | mounts | visible change |
|---|---|---|---|
| 1 | `rulings.md` | — | none — the arc's authority, filed first (already committed as `8f843e3`) |
| 2 | **this checkpoint** | — | none — investigation; nothing ships from it |
| — | **RULING** | | |
| 3 | the fact line and the band shell, with the WHERE band in S1 | C3, C4, `.lk`, the band-stack focus target | **S1 is the column.** The setup panel's header and the rail are gone; the search field and the aerial are in a band. |
| 4 | the move ledger and the kind chips, S2 | C5, `.act`, `.chip` | S2 reads as the §5a ledger; the picker opens from the band |
| 5 | the WHAT band, S3 | the field grid, the provenance lines, `.fld`, the generate frame | the per-kind form, the jurisdiction band and the schedule become one band; `DetectedVsApplied` retires |
| 6 | S4 and the collapse landing | the locked fact lines, the empty verdict slot, ruling 184's landing per transition | Generate stops navigating; the setup collapses in place |
| 7 | the reserved slot restored + the setup fact line, S5 | `ResultsHead`'s occupant, rule 28 closed | the results stack gains its first row — #288's line 5 deviation closes |
| 8 | the before/after panel and the preview, S7 | C10, the status row, the preview sender | revision exists; `SetupStrip` is deleted and #262 closes by deletion |
| 9 | evidence | — | none — prod legs at both widths, output outside the repo |

Commits 3–8 each change something a hand-check can see, and each leaves the build in a state
that generates a plan. Commit 8 is the only one that touches the wire, and it touches it by
setting an existing flag.

**Stop points:** after commit 3 (the column's voice changes — the first thing Ryan should see)
and after commit 8, before evidence.

---

## I. The principles table

Checkpoint question (i). Every surface this phase mounts, with the FLOW.md step and the user it
serves (P17), and the principles it is answerable to.

| surface | FLOW step | user | principles | how |
|---|---|---|---|---|
| WHERE band, S1 | 2 Where | rep / operator | **P18** one question, one primary (FIND) · **P3** the next thing is the only thing · **P14** the aerial's hint shows the shape of the answer | one band open, two pending lines below showing the whole job |
| WHERE band, S2 | 2 Where | rep / operator | **P21** the pin marks the work · **P9** every ledger row has a glyph and a word · **P19** three chips, gated kinds named not rendered | the move ledger is the band's own progress surface |
| the picker modal | 2 Where | rep / operator | **P13** simple thing first, decision work on request · **P11** it is unchanged, so it cannot drift | ruling 189 — the band owns the outcome, the modal the decision |
| the kind chips | 1 Kind | rep / operator | **P15** confirm never infer · **P2** one voice for the kind | suggest-never-set; no "✓ proposed" until Phase 3 has a producer |
| WHAT grid | 3 Fix | rep / operator | **P2** one voice per fact (the provenance line replaces the ledger) · **P9** amber guess carries a word · **P16** no skeleton in the jurisdiction field · **P12** every field has a provenance line or it is a defect | #273's single producer; rule 137 |
| the jurisdiction field | 3 Fix | rep / operator | **P16**, **P8** the errored state says so · **P6** reserved height, not a skeleton | ruling 196's three states |
| collapsed fact lines | 2–3 | rep / operator | **P1** the movement is user-initiated · **P10** the link is 32 px at 1440, 44 at 380 · **P13** the answer in one line, the way back in one link | rules 56–60; §8.27's six inline edits become six re-openings |
| GENERATE band | 3 Go | rep / operator | **P18** one primary · **P3** the disabled reason is the verdict's string | rule 139's chain, single-sourced |
| S4, the lock | 3 Go | all three | **P8** honest, visible, non-blocking — the aerial is not dimmed and reading never stops · **P16** no fake progress, one busy signal per fact (ruling 200) | rules 117–118; the working band is the only voice |
| the re-opened band, S7 | 5b Revise | estimator | **P22** revision is a mode, not a reload · **P7** reversible before irreversible, batch before commit · **P15** DISCARD costs nothing | ruling 191's one APPLY; Part 1 §5.6 |
| the before/after panel | 5b Revise | estimator | **P2** the panel states which input it computed for · **P8** 7b is in-flight and readable, never blank · **P16** no skeleton in any of the four situations · **P14** 7d says what failed | rules 90–95.15; the reserved status row |
| the stale ribbon + dim, S7 | 5b Revise | estimator | **P9** symbol and word · **P16** the previous answer stays, labelled · **P13** downloads stay live inside the dim | rules 122–123; #288 clause 6 keeps the ribbon out of the dim |
| the landing, every collapse | all | all three | **P1** nothing moves that the user did not ask to move — and **R8** says the landing cannot always deliver | ruling 184, measured in `prototype/band-stack-landing.md` |

**Where a principle is knowingly bent:** P1, at every collapse, by 97–827 px. Ruling 184
accepts it as user-initiated. The probe's numbers are what that acceptance costs, stated before
the diff rather than after it.

---

## What this checkpoint does not claim

- **Nothing is measured on the product**, because the product renders no band. Every number in
  §F is the spec's own geometry, measured on a rig built from it. The rig is not product code
  and nothing imports it.
- **The S4 → S5 displacement is understated** at both widths: the probe's results stack is a
  stand-in, and Phase 1's real one is taller.
- **The 3,293-line picker is not read line by line.** Ruling 189 keeps it whole this phase, so
  what matters is its two seams — `initial` (`GeneratorSidebar.tsx:571-581`) and `onSave`
  (`:304-408`) — and both are read.
- **#283 is still open** although `tr-question` and the nine sizes are shipped and consumed by
  the census. Phase 2 is its first product consumer; whether that closes it is not this arc's
  call.
