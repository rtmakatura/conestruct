# 📋 Checkpoint: Setup box + Step 2 redesign (R106–R109)

Investigated on main `4ae98aa`, 2026-10-07. No code written. Rulings: `rulings.md`. Mockups: `design-refs/`.
Every `path:line` below is at `4ae98aa`.

## 1. Rule 3: who decides that a guess becomes the value?

**Today the frontend decides, for all three guessed fields. The backend only ever sees a set value, and nothing on the wire says where it came from.**

| Field | Where the guess is made | Who writes it today | On the wire |
|---|---|---|---|
| Road type | frontend: `lib/road-detection/classify.ts` (`classifyFromOsmTags`), applied at the picker → form handoff by `lib/scenarios/auto-apply.ts:506-640` | the handoff, no confirm | `roadType`, a plain required value (`src/api/schemas.py:436`) |
| Street class | frontend: `suggestStreetClass()` maps the OSM `highway` tag (`lib/road-detection/classify.ts:436-457`) | the operator's Confirm click (`components/GeneratorShell.tsx:1676-1683`) | `street_class`, optional, absent = `None` (`src/api/schemas.py:340`) |
| Jurisdiction | backend: `POST /jurisdiction/suggest` → `src/rules/boundaries.py:113` (TIGER place polygons); advisory, never reads a scenario | the operator's Confirm click (`components/GeneratorShell.tsx:1583-1593`) | `jurisdiction_key`, optional (`src/api/schemas.py:339`) |

- The Confirm/Dismiss records are React state only: "never written to scenario state or the payload" (#227 GO ruling 3, `components/GeneratorShell.tsx:769-777`).
- The audit and the PDFs record no provenance for any input today. `audit.py:913-916` prints `road_type = '…'` and nothing about where it came from.

### Recommended backend shape: relay the raw fact, the backend owns the guess (the #136/#158/#308 relay-fact pattern)

R108 moves the write from the Confirm click to the prefill, which stays in the frontend: the WHAT band has to show the value before Generate, exactly as road type does now.
- **What it adds:** the audit must now say "guessed, not confirmed". That claim should be the backend's own, not a label the frontend asserts.
- **New optional wire field:** on `JurisdictionScenarioFields` (every kind inherits it):
  ```
  guesses?: {
    street_class?:     { highwayClass: string }        // the OSM tag the class was guessed from
    jurisdiction_key?: { lat: number; lng: number }    // the pin the boundary guess was made at
  }
  ```
- **When an entry is present:** only while its field still holds the untouched guess. The operator changing the field drops the entry, so the value is plain operator-set from then on.
- **The backend recomputes each guess from the raw fact:**
  - jurisdiction from `boundaries.suggest(lat, lng)`, the same function the endpoint already serves;
  - street class from a new `src/rules/street_class.py`, which takes over `STREET_CLASS_BY_HIGHWAY`. The frontend table becomes a commented mirror, pinned equal to the backend's by a test, as `ONEWAY_BLOCKING` is.
- **If the recomputed guess equals the value:** the audit records it as a guess.
- **If it doesn't:** honest 400 `guess_stale`. The frontend sent a stale record, and a stale claim presented as current is a Rule 10 violation.
- **Absent `guesses`:** byte-identical to today, so no existing fixture moves.

Alternatives, not recommended:
- **(b) Frontend sends labels** (`{field, value, source: "pin"}`) and the backend prints them. Simpler, but the backend would print a provenance claim it cannot check: the label is the fix, which P21 and Rule 3 forbid.
- **(c) Backend fills absent fields itself at render.** The WHAT band could not show the value before Generate, and "absent" would stop meaning "not set" (Rule 10).

## 2. What it changes in the audit and the PDFs

The guess changes the plan. A prefilled jurisdiction turns on that jurisdiction's evaluation, so every surface it feeds moves (see §4). The new provenance record lands as follows:

| Surface | Change (recommended) |
|---|---|
| Audit JSON | new `input_guesses: [{field, value, source, evidence, operator_confirmed: false}]`, one entry per guess the backend verified |
| Audit PDF | one line per guess in the inputs block. Example (draft copy, unslop-checked):<br>"Jurisdiction: Denver. Guessed from the pin (inside Denver municipal limits, US Census TIGER/Line, 2024). The operator did not confirm it. Confirm the jurisdiction with the permitting authority."<br>"Street class: Arterial. Guessed from the road (OSM highway=primary). The operator did not confirm it. The jurisdiction's adopted classification map governs." |
| Plan sheet PDF | no new text. It prints neither field today; the only jurisdiction text is the conflicts footnote (`plan_sheet.py:3282-3304`). |
| XLSX Summary, crew narrative | each prints `Jurisdiction: <name>` (`src/export/device_list.py:254`, `src/narrative/crew_narrative.py:820`). **Question Q3:** append "(guessed from the pin, not confirmed)" while the guess is untouched? I recommend yes. The crew sheet is read in the field, where a wrong jurisdiction matters most. |
| `pending_verification` | **not used, recommended.** Every pending item flips `plan_flags.is_clean` to false (`audit.py:2281-2290`), so nearly every pinned plan would stop reading clean, and road type's guess has never been a pending item. **Question Q2.** |

**A guess the operator changes:** the entry is gone, so the audit treats the value as operator-set and says nothing about the guess. **Left as is:** the record stands. Both match R108's "keeps that record honest".

## 3. Rulings R108 overrides

### R108 overrides, for street class and jurisdiction only

| # | Ruling | Where | Overridden |
|---|---|---|---|
| 1 | **R100** "An answered suggestion may collapse into its field." | `declutter-three-surfaces/rulings.md:35` | fully: nothing is answered any more |
| 2 | **R96 A**: "Confirmations shown inside the field they confirm, with Undo kept." | `declutter-three-surfaces/rulings.md:19` | the confirmation part only; the markers, the grid and the popover stand |
| 3 | **Endeavor B prime directive**: "the only writer of `jurisdiction_key` is the user's explicit Confirm" | `src/rules/boundaries.py:7-11` | Confirm as writer. The endpoint stays advisory and still never reads a scenario (`tests/test_boundary_suggest.py:227` stays green). The docstring is reworded. |
| 4 | **#152 C**: "the single writer of street_class from this feature is the user's Confirm click" | `GeneratorShell.tsx:828-836`; `GeneratorShell.class-suggest.test.tsx:3-8` | fully. The derivation and its "vanishes on a stale road" keying become the prefill's source. |
| 5 | **suggest-never-set** (no canonical ruled text in the repo: `CLAUDE.md:33` is a `[CARRY OVER]` placeholder; the earliest text is `boundaries.py:7-11`, `ee36cb4`) | `CLAUDE.md:33` | **repealed for these two fields only.** It still holds for the kind (Rule 8, `FLOW.md:65`), scan corrections, the scan, the S7 preview and the aerial. CLAUDE.md needs a foreground edit to say so. |
| 6 | **"A differing manual pick demotes the suggestion to a passive notice"** | `JurisdictionSection.tsx:226-227, 359-360` | fully: no agree/differ rows |
| 7 | **#227 resolved-suggestion records** (⌁ → ✓/× + evidence + Undo) | `conestruct/site/DESIGN-SPACING.md:94, 133-134` | fully, for these two fields. Site-condition corrections keep the shape. |
| 8 | **#227 GO ruling 3**: records "never written to scenario state or the payload" | `DESIGN-SPACING.md:153-158` | moot. The new `guesses` entry is a different fact (where the value came from, not a decision), and it does go on the wire. This is stated as a deliberate change. |
| 9 | **Dismiss honesty**: "no state moves, no ✓ is manufactured" | `DESIGN-SPACING.md:223-225` | fully: no Dismiss |
| 10 | **⌁ = "a suggestion awaiting Confirm/Dismiss"**, and #289 Q5's "keep ⌁" | `DESIGN-SPACING.md:111`; `issue-289-band-stack/rulings.md:475` | partly: its only two producers go. The glyph stays in the vocabulary for Phase 3's proposed kind. |
| 11 | **#201**: "proximity is how a user knows which control a confirm applies to" | `arc16-polish/arc16-polish.md:17-20`; `issue-289-band-stack/rulings.md:619` | fully: no Confirm |
| 12 | **#289**: "The suggestion row spans the full WHAT band directly under the grid row holding its field" | `issue-289-band-stack/rulings.md:613-617` | fully |
| 13 | **#289 WHAT density, item 4**: "…and any suggestion needing action as one line + Confirm/Dismiss" | `issue-289-band-stack/rulings.md:572-574` | that clause only |
| 14 | **#228 ruling 7**: Location's "2 to confirm" count | `DESIGN-SPACING.md:201-206`; `lib/scenarios/rail.ts:121-128, 357-358` | fully. It is already dead UI: `ProgressRail` is deleted (`GeneratorSidebar.tsx:581`), but `pendingSuggestions` is still computed and passed in. The plumbing is removed with it. |

### Not overridden, said so explicitly because R108's "any earlier ruling" could be read wide

- **The kind is confirmed, never inferred** (Rule 8, `FLOW.md:65`). R108 names two fields; the kind is an enablement gate.
- **R83:** "If the test can't decide, the operator confirms; the plan doesn't guess." There is no guess to prefill. It is a question, and it stays one (the Carriageway row's "⚠ needs you").
- **The backend lane gates and their recovery confirms** (#120 lane confidence, #136, #86, #158, the cross-street lane hold). These are refusals on MUTCD-load-bearing values.
- **Site-condition Dismiss/Assert/Keep in NEEDS YOU** (R96 C, R99, R103). Corrections, not guesses. NEEDS YOU has never carried these two suggestions.
- **P15:** still holds. Changing a prefilled field is an ordinary field edit. Only its #227 origin loses two instances.

### One contradiction to reconcile (Q6)

`issue-279-classifier/rulings.md:137-140` says road-type classification is "a suggestion, not an answer … the operator confirms it, and only then does it ride the scenario". That describes #279's unmerged classifier (worktree `issue-279-classifier`). The shipped code auto-applies road type with no confirm, which is the model R108 cites. Does R108 also govern #279's classifier, so it prefills with a ⚠ mark and no confirm? I recommend yes, so all three guesses work one way, ruled on #279 when it resumes. This arc doesn't touch it.

## 4. Rule 5: churn predicted before the diff

### Behaviour: deliberate, stated

1. **Any pin inside one of the 8 TIGER-place jurisdictions now generates with `jurisdiction_key` set.** Those are Denver, Lakewood, Englewood, Littleton, Centennial, Parker, Greeley and Thornton. CDOT and E-470 are never guessed: `suggest()` tests place polygons only. Before, the key was unset unless the operator confirmed. What follows:
   - the breakdown carries a `jurisdiction` block, and its applied deltas change device counts, the quote, the XLSX and the on-sheet summary (`render_api.py:1657-1658`);
   - the plan PDF can force the device summary on and add the "† N ADOPTED-SOURCE CONFLICTS" footnote (`render_api.py:876-887`);
   - the audit PDF cover's triage count includes jurisdiction facts (`render_api.py:1808-1813`);
   - on Denver one-way checks the audit JSON appends `DENVER_DEFERS_TO_MUTCD_SENTENCE` (`audit.py:961`);
   - the crew narrative's ped/bike rules change for Denver, Littleton and Englewood (`crew_narrative.py:730-758`).
2. **Any confirmed road with a mapped highway tier now carries `street_class`.** It matters only with a jurisdiction (`_jurisdiction_eval` returns early without one, `render_api.py:1598-1607`), which is now the usual case. Class-scoped triggers resolve from UNKNOWN to fires / doesn't fire, hours windows evaluate, the hours meter prices, and the permit tier resolves Minor or Major (`src/rules/jurisdiction.py:183-186, 224-227, 429-438, 478-480`).
3. **New text:** the audit JSON `input_guesses` and its audit PDF lines (§2). If Q3 is yes, a clause on the XLSX and crew jurisdiction lines.
4. **A pin on a state highway inside Denver is guessed "Denver"**, though CDOT may govern. Today that same pin's suggestion says so ("Confirm the jurisdiction with the permitting authority"). That sentence and the boundary warnings survive (§6, D4).

### Not changing, proved at the build

- **Absent `guesses`:** byte-identical output. Every backend fixture and the expectation-JSON pin carry no pin guess, so 0 moves are expected, and the build diffs a fixture set to show it.
- **Plan-sheet geometry:** 0 device moves. Street class and jurisdiction feed counts and text, never placement.
- **The engine buffer table:** `params.jurisdiction` stays hardcoded `"CDOT"` (`schemas.py:1270`).

### Tests: predicted churn (frontend). The backend only adds tests.

| Suite | Tests | Fate |
|---|---|---|
| `GeneratorShell.suggest-contract.test.tsx` | 6 | rewritten to the inverse contract: the pin guess prefills an absent key, marks it ⚠, never overwrites an operator value, and carries `guesses` iff untouched |
| `GeneratorShell.class-suggest.test.tsx` | 7 | same, for street class |
| `GeneratorShell.suggestion-records.test.tsx` | 2 | retired: no records. Its "no `/resolution|suggested/` on the wire" guard becomes "`guesses` present iff untouched". |
| `GeneratorShell.class-stability.test.tsx` | 5 | kept; its suggestion-slot references re-pointed |
| `GeneratorShell.rail-vocabulary.test.tsx`, `lib/scenarios/rail.test.ts` | the "N to confirm" cases | retired with `pendingSuggestions` |
| `WhatBand.declutter / density / detection`, `JurisdictionSection.placement`, `bands/PlanDetails` | the suggestion-row, R100 record and label cases | re-pointed to the R107 layout and labels |
| `ResultsHead.grid`, `GeneratorShell.results-head` (R106 branch) | 7 | re-pointed to the cell grid; test ids and targets kept |

**#198 byte-identity, deliberately broken for these strings only, which are deleted:**
- "Confirmed X (was Y).";
- "Dismissed the X suggestion. Y stands.";
- "Pin suggests: …", "Detected road suggests street class: …";
- the agree/differ rows.

Every other #198 string stays as it is.

### Copy changes (R107, R108)

| Was | Becomes |
|---|---|
| "Street classification" | "Street class" |
| "One-way street or divided road?" ("One-way street" / "One side of a divided road") | "Carriageway" ("One-way" / "Divided") |
| "Night operation" | "Hours" |
| "Work-zone speed reduction" ("No reduction" / "Reduced") | "Speed reduction" ("None" / "Reduced", as the mockup has it: Q8) |
| band head "prefilled from the road · guesses marked" | "N guesses marked ⚠ · change any that are wrong" |
| Setup's "pick a value to change it" (R106) | "pick a cell to change it" |

## 5. Principles P1–P22

| P | Risk, and where | How the plan honours it |
|---|---|---|
| P1 | A late pin guess landing in the jurisdiction cell; the suggestion rows disappearing; R106's taller box at the settle (`ResultsHead.tsx:43-49`, `--fact-min-h` 48 px) | The cell's value changes in place and the row height stays fixed (one 44 px control). The rows are removed outright, never mid-session. R106 raises the results-head reserve to the box's measured height at 1440 and 390, recorded in a row-height table. |
| P2 | The guess stated twice (marker + record), or Setup repeating the ⚠ | One marker per field. Setup shows values only, and WHAT owns the ⚠ (Q9). |
| P3 | A near-boundary or unsupported-area warning hidden in the popover | Warnings that start with ⚠ stay inline. `markerOf` already returns null for a ⚠ line (`provenance-marker.ts:53`). |
| P4 | R107's label column and control edge | One 132 px label track and one control edge per column (mockup); measured. |
| P5 | Labels sans 12.5/500 and markers mono, per the mockup | The existing `tr-*` roles; no new sizes. |
| P6 | Segmented controls sizing to content (the "Arterial" gap) | `grid-template-columns: repeat(n, minmax(0,1fr))` on every segment. Setup uses fixed 5 tracks with Road and Dates spanning 2. |
| P7 | A prefill must not trigger a render | The prefill is a state write. Renders still go through the existing debounce and Generate; no request per guess. |
| P8 | The pin lookup in flight | The cell reads "◌ evaluating", as the jurisdiction field's state words already do, with no skeleton. |
| P9 | ⚠ from the road / ⚠ from the pin / ✓ measured / ✓ yours / ◌ not set | All from the fixed vocabulary, with symbol + word. |
| P10 | Every control 44 px (R107); Setup cells ≥ 64 px | axe `target-size` at 390. |
| P11 | The `.classpick` chips and `.a-chip` two-ways become one segmented control | One `.seg` treatment, existing tokens only; the token test extends. |
| P12 | none | Ryan's hand-check. |
| P13/P19 | Evidence (TIGER reason, map caveat, warnings) moves into each field's popover | The popover already exists (R98/R101); nothing is lost (§6, D4). |
| P14 | No guess | "◌ not set", as today (R108). |
| P15 | No more Undo on a guess | Changing the field is the undo, and it is a normal field write. The audit's record follows the field (§2). The principle still holds; two of its instances go. |
| P16 | No placeholder guess before the lookup answers | No value until the answer lands. "◌ evaluating" is the honest word. |
| P17 | Rep/estimator in Step 2 | Unchanged job: correct what the road got wrong. |
| P18 | Removing Confirm buttons removes competing actions | One primary per screen holds. |
| P20 | "The road" / "The job" stay the user's two questions | As R101. |
| P21 | A guessed jurisdiction must read as a guess | The ⚠ marker, plus the audit record; the backend owns the claim (§1). |
| P22 | Post-generate pin moves | The guess lifecycle follows the staged revision; it never silently regenerates (D3). |

## 6. Decisions: my recommendation is the default unless you rule otherwise

- **D1, Rule 3 shape.** Relay-fact `guesses`, with the backend recomputing and verifying each guess (§1). **Q1: confirm.**
- **D2, the audit record.** `input_guesses` in the audit JSON plus audit PDF lines, not `pending_verification`. **Q2:** confirm that a guessed plan still reads clean.
- **D3, guess lifecycle.**
  - **Street class:** written at the picker → form handoff, with road type, only when `street_class` is absent.
  - **Jurisdiction:** written when the lookup answers, only when `jurisdiction_key` is absent.
  - **An operator-set value is never overwritten.** This departs from road type, whose fresh detection rewrites it unconditionally (`auto-apply.ts:506`). **Q4:** confirm "never overwrite".
  - **A pin move:** clears an untouched guess and re-guesses for the new pin.
  - **After Generate:** a new guess rides the S7 staged change and shows in its preview before Apply (P22). It never writes on its own.
- **D4, the evidence survives in the popover (Rule 10).**
  - **Jurisdiction:** the TIGER reason and the "Confirm the jurisdiction with the permitting authority" caveat. A near-boundary warning stays an inline ⚠ line.
  - **Street class:** the "per Denver functional classification map" chip and "The road tier is a proxy; the adopted map governs."
  - **No guess:** unsupported-area warnings still show under "◌ not set".
- **D5, N in the header.** The number of WHAT cells whose marker is ⚠: road type when inferred, street class and jurisdiction when untouched guesses, plus any other inferred clause. **Q5:** what the header reads at N = 0. I recommend "nothing guessed · every value is measured or yours".
- **D6, #279 classifier.** Governed by R108 when it resumes (§3). **Q6.**
- **D7, R107 rows that the mockup and the rules disagree on.**
  - **Lanes (Q7).** The mockup has one "Lanes" row with two selects and one "✓ measured". Lane width is never measured (`WhatBand.tsx:489-493`). I recommend one row with two markers: "✓ measured · ✓ yours". A single "✓ measured" would claim the width was measured, which breaks rule 137 / R98.
  - **Hours and Speed reduction have no marker in the mockup (Q8).** Rule 137 is absolute, so I recommend keeping their "i about" marker. Also Q8: "None" (mockup) or "No reduction" (current) for the reduction's off option.
  - **Carriageway.** Shown under the same condition as today (#308's street-class one-way roads). The urban-arterial "Divided highway" toggle isn't named in R107, so it keeps its label.
  - **The work-zone speed limit row** (shown once "Reduced") sits under Speed reduction. Schedule windows sit under Work dates. The kind's own fields stay below the columns.
  - **390 px.** The two columns stack to one. Below 520 px the label sits above its control: 132 px plus two selects doesn't fit a 318 px row. The mockup is 880 px only, so this is my call (flag).
- **D8, R106 Setup.**
  - **Lanes.** Today it holds two targets, `lanes` and `laneWidth`, each opening S7 on its own field (`RevisionBand.tsx:41-47`). "Every cell is a button with the target it has today" can't hold for a cell with two targets. **Q9a:** I recommend the LANES cell holds two full-height buttons ("2" and "12 ft"), and every other cell is one whole-cell button.
  - **A kind with no lane count** draws "LANES · 1 · fixed by this kind" as a non-button cell, so the grid keeps its shape (P6, Rule 10).
  - **At 390:** 2 tracks, with Road and Dates spanning 2.
  - **Guessed values carry no ⚠ on Setup** (P2: WHAT owns it). **Q9b.**

## 7. Branches, in R109's order

1. **`setup-what-r108`** (R108 + R107), not frontend-only:
   - backend: `guesses` schema, `src/rules/street_class.py`, guess verification and `guess_stale`, `input_guesses` in the audit JSON and audit PDF (plus the XLSX and crew clause if Q3);
   - frontend: the prefill writes, the WHAT two-column layout, the labels, the header count, and removal of the suggestion rows, records and `pendingSuggestions`.
   - Tests first (Rule 11: payload-level for the wire, rendered output for the audit PDF), then the code.
   - The report carries screenshots at 1440 and 390 and the Rule 5 outcomes against §4.
2. **`setup-box-r106`** (R106), frontend-only, **stacked on branch 1's tip**. Report as above.

## Housekeeping

- `design-refs/` and `cc-prompt-setup-what-redesign.md` are copied into this folder (`design-refs/`, `prompt.md`). The originals get deleted once the arc ships.
- **`cc-prompt-308-followups.md` (all three parts shipped):** the prompt says to delete it. All three files are untracked in the main checkout, and this background job can't edit those, so the deletions need a foreground session.
- **Docs that go stale with R108, edited in this arc's branch 1:**
  - `conestruct/site/DESIGN-SPACING.md:144` ("pin → suggestions → confirm");
  - `src/rules/boundaries.py:7-11`'s docstring.
- **Needs a foreground session:** the suggest-never-set line in `CLAUDE.md`, and `memory.md:16-17, 27, 62, 86`.
