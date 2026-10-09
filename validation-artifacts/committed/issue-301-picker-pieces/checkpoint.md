# 📋 Checkpoint: #301 pieces 3+ (the picker modal's decision work), R122

Investigated on main `60bbe09` (= prod), 2026-10-09. No code written. Rulings: `rulings.md`.
Prod evidence: `probes/prod-60bbe09/` (headless Chromium through the gate, N Broadway SB pin
39.73370, -104.98753, at 1440 and 390). Every `path:line` is at `60bbe09`; frontend paths are under
`conestruct/site/`.

## Plain English

**`LocationPickerModal.tsx` is unchanged since `d6d7971` (2026-09-29).** R108's build (`477c951`),
r116, #309 and #300 never touched it. So the modal on prod is the #290 / #301-piece-2 modal: search,
coordinates, the map with its overlay, "Which road?", ROAD PROPERTIES, the cross-street pin for
near-intersection work, and an empty CORRIDOR EXTENT panel.

**What's left of the four pieces:**

| Piece | Status on prod | Recommendation |
|---|---|---|
| 3d. Jurisdiction and street-class suggestions | **Moot (R108).** The modal never rendered them. The guesses are prefilled on WHAT, and the modal's Save is only their producer. | Nothing to migrate. Delete the stale comments that still list "suggestions" as modal work. |
| 3b. Road properties | **Still applies, and conflicts with R107/R108.** Four editable rows (speed, lanes, road type, divided) duplicate WHAT's "The road" column, in a second provenance vocabulary. | **Remove from the modal; don't migrate.** WHAT already owns every field. One fact (the class-fallback speed) exists only in the modal and needs a home (Q2). |
| 3a. Road candidates | Still applies. "Which road? · N detected" and the candidate list. Picking needs a pin but not the map. | **Stays in the modal for now** (Q3). The band can't place a pin, so moving the list splits one decision across two surfaces. |
| 3c. Cross-street pin | Still applies. It needs a map click. The zoom ruling bars mapbox-gl on the band. | **Stays in the modal.** Fix the band's dead-end line: it says "Mark the cross street on the map" and has no control (Q4). |

**Proposed:** three branches, all frontend only, no backend change and no deliverable change:
cleanup → road-properties → cross-street entry. After that, #301's end state is "the modal is the
map": the pin, the road pick and the cross pin. That needs your ruling on Q3, because ruling 189 says
the decision work migrates.

**Found on the way (not #301):** the R120 picker line can't render on prod. See
`issue-300-left-side-oneway/r120-prod/README.md`; an issue is drafted in the chat.

---

## 1. What the modal holds on prod `60bbe09`, and who else says it

| # | Modal piece | Where (`LocationPickerModal.tsx`) | Band equivalent today | P2 status |
|---|---|---|---|---|
| 1 | Address search, area-level re-centre, band address auto-geocode | `:1514-1569`, UI `:1713-1744`; `:1313-1367` | WHERE has an address field and "Pick on map" / "Edit on map" (`WhereBand.tsx:495-524`), with no geocoder of its own (`:490-494`) | one producer (the modal) |
| 2 | "+ Or enter coordinates manually" (#230 pasted pairs) | `:1750-1803`, handlers `:1399-1477` | `ManualFallback` only when there's no map token (`WhereBand.tsx:749-776`) | one producer |
| 3 | The map: pin click, drag and re-detect, satellite/streets, Recenter, overlay, legend, side sentence | `:1115-1382`, `:999-1092`, `:1812-1902`, `:2143-2162`, `:1830-1837` | `BandAerial`, a read-only backend PNG (`WhereBand.tsx:571-577`) | the picture has two renderers from one producer (piece 1, ruled) |
| 4 | **3a** Detection outcome, "Which road?", candidate list, Re-detect | `DetectionOutcomeCard :2669-2753`, `WhichRoadCard :2763-2819`, `CandidatePicker :2851-2895`, `detectAt :791-898`, `applyCandidate :1483-1500` | the ledger's "Found the spot" / "Work starts" name the picked road (`lib/scenarios/move-ledger.ts:126-155`); the stale-road warning (`WhereBand.tsx:535-540`); Carriageway on WHAT (`PlanDetails.tsx:360-390`) | the list is modal-only; the outcome is on the band |
| 5 | **3b** ROAD PROPERTIES: speed, lanes per direction, road type, divided, each with pips, "OSM · MEASURED / INFERRED / OPERATOR-SET", "modified" and ↺ revert | `RoadPropertiesPanel :2166-2235`, `DetectedRows :2237-2435`, `RoadFieldRow :2442-2535`, editors `:2537-2668` | WHAT "The road": Speed, Lanes + lane width, Road type, Street class, Carriageway / Divided, each with a ⚠ / ✓ line (`WhatBand.tsx:431-554`, `PlanDetails.tsx:314-390`) | **duplicated: two editable controls and two provenance voices per field** |
| 6 | **3c** Cross-street pin: "Mark the intersection on the map", move, clear | `CrossStreetPanel :2042-2136`, `placeCrossPin :924-985`, `clearCrossPin :987-995` | WHERE fact "at X" (`band-facts.ts:170-174`); NearIntersectionForm's "Where is the intersection?" line (`NearIntersectionForm.tsx:262-268`), which has no control | modal-only producer |
| 7 | **3d** Jurisdiction and street-class suggestions | none. "suggest" and "jurisdiction" appear only in comments (`:797`, `:1574`) | prefilled guesses on WHAT (`lib/scenarios/guesses.ts:83-156`, `GeneratorShell.tsx:785-835`; `PlanDetails.tsx:81-92, 314-328`; `WhatBand.tsx:365-382, 568-614`) | one voice (WHAT) |
| 8 | CORRIDOR EXTENT remnant: wait/side/kind notes, the refusal text, the Centerline coverage row (#211) | `CorridorPreviewPanel :2908-3026` | the band's Extent row and aerial legend | the side sentence is said twice inside the modal (map caption and panel; `1440-3-picked.png`) |

### 3b's conflicts, observed on prod

**Divided on a one-way road (P2 / Rule 10).** Broadway SB is a confirmed one-way street. On prod I
clicked DIVIDED in the modal (`1440-D-modal-divided.png`: "Divided · MODIFIED · OPERATOR-SET") and
saved.
- Every later request carried `divided: true` (`1440-D-payloads.json`).
- WHAT still read "Carriageway · ✓ detected · One-way" (`1440-D-what-text.txt:66-68`). No Divided
  toggle is shown on a one-way road, by #308's P2 choice (`PlanDetails.tsx:57-68`).
- The side control still offered both curbs (`1440-D-sides.json`).
- So the operator's answer rides the wire and no band shows it.
- **It is inert today:** locally, the Broadway right-shoulder audit is byte-identical with
  `divided` false and true (`probes/divided_effect.py`; same hash, 7,064 chars), because the
  confirmed one-way verdict governs.
- **Classification:** a hidden value and a second control for one fact. No wrong output.

**Road type, preview ≠ applied (code read, not exercised).**
- The modal's Road type row shows `overrides ?? detected`.
- If the operator set road type on WHAT, `applyClassification` keeps theirs (`lib/scenarios/auto-apply.ts:517-529`, R110 Q4).
- So the modal can show a road type that its Save won't apply. That breaks "preview must equal
  applied" (`feedback_handoff_provenance_pattern`).

**Two vocabularies for one fact.** The modal says "OSM · INFERRED"; WHAT says "⚠ from the road". FLOW.md
§3 step 1 (Where) lists "classification detail, provenance tokens" under *what they can ignore*.
Step 2 (What) owns "anything the system guessed wrong".

**The one fact that lives only in the modal: a class-fallback speed.**
- With no `maxspeed` tag, the classifier infers a speed from the highway class (`confidence: "low"`, `lib/road-detection/classify.ts:286-297`).
- That speed is never applied: `speedLimitMph` comes only from the tag (`:367`).
- WHAT has a Speed detection row only when the tag exists (`lib/road-detection/detected-rows.ts:175`).
- The modal shows the fallback with "Low-confidence fallback. It won't apply unless you accept it." and a **Use N mph** button (UX-02, `LocationPickerModal.tsx:2335-2352`).
- So removing the panel removes the only place an operator sees it. See Q2.

The lanes clamp note ("5 lanes/direction … Plan will use 4") is **already on WHAT** through
`HandoffNotes.tsx:83`, so nothing is lost there.

### 3d after R108: moot, plus stale text

- **Nothing in the modal contradicts R108.** It has no confirm, dismiss or suggestion UI.
- **Stale descriptions remain:**
  - `WhereBand.tsx:21-22` lists "suggestions" as the modal's decision work.
  - `GeneratorShell.tsx:770-774` says the jurisdiction fetch "NEVER writes … onConfirmSuggestion below". The code under it writes the guess, and `onConfirmSuggestion` no longer exists.
- **Leftover types:** `JurisdictionSection.tsx` still carries suggestion types (`:34`, `:136`). Only `STREET_CLASSES` and `StreetClassEvidence` are imported from it.

### Dead code in the modal (read, unused at `60bbe09`)

- `ROAD_TYPE_LABELS` (`:210-215`) and the `bearingToDirectionLabel` alias (`:274`).
- `effectiveRoadType / Divided / Speed / Lanes` (`:553-579`).
- `crossDetectCtxRef.bearing` (`:430`, `:917`): written, never read.
- `corridorReadyRef`: written, never read.
- `suppressFlyToRef` and `suppressDragHandlerRef`: never set true.
- `CandidateCaption`'s `multi`: always false (`:2801`), so "· change it above" can't render.
- The props `initial.speedMph`, `laneWidth`, `divided` (passed at `GeneratorSidebar.tsx:523-526`, never read; their docs say "deleted by #301").
- Outside the modal: the move ledger's Extent comment says "the picker carries `workZoneFt`" (`lib/scenarios/move-ledger.ts:168-172`), and the picker has had no length control since #290.

### Not #301's, noted

- **P16:** the detecting state draws an `animate-pulse` placeholder bar (`LocationPickerModal.tsx:2694`). P16 bans loading skeletons. One line; it can ride the cleanup branch if you want it there.
- **Typed coordinates leave the map at state zoom.** On prod, after typed coordinates the pin sat at Denver with the map still showing all of Colorado (`1440-3-picked.png`, `390-3-picked.png`). `applyPinPosition` flies only when `opts.fly` (`:1067-1078`). Not investigated; headless timing isn't ruled out.

---

## 2. The questions

**Q1. Road properties (3b): remove from the modal rather than migrate?** Recommend **yes**.
- WHAT already has every field with R107's layout and R108's markers. Moving the panel to the band would only duplicate WHAT on WHERE.
- After the change, the modal's subtitle "review the detected road properties" becomes "Drop a pin where the work starts, and pick the road." (draft, unslop-checked).
- The modal keeps "Which road?" and Re-detect.
- **Alternative:** a read-only summary of the four values in the modal. Not recommended: it's still a second voice (P2).

**Q2. The class-fallback speed: where does it go when the panel leaves?** Recommend **(b)**.
- **(a) Drop it.** The fallback was never applied and the operator sets speed on WHAT. The hint is lost.
- **(b) A ⚠ line on WHAT's Speed row, no button:** "⚠ no posted speed on the road · its class suggests 30 mph". The value isn't prefilled and nothing is confirmed. The operator picks from the Speed control as for any value. This keeps the hint and adds no confirm step (R108). **CHOSEN wording pending your ruling.**
- **(c) Prefill it, marked ⚠, as R108 does for street class.** This changes plans: every untagged road's speed moves from the scenario default to the class value. Speed sets every taper, buffer and sign spacing, and a guess lower than the true posted speed shortens all of them. Not recommended without a separate ruling. R110 Q6 extended R108 to road type only.

**Q3. Candidates (3a): stay in the modal?** Recommend **yes, for now**.
- **Why not move it now:** the band can't place a pin (no map by the zoom ruling, and no geocoder), and the candidates come from the pin. Today one surface does "pin → which road?". Moving the list to the band means Save with an unpicked road, then pick on the band. That splits one FLOW step-1 decision in two (P18), and loses the map beside the list.
- **What would make the move worth it** is pin entry on the band (address and coordinates, no map). That's a bigger, separate piece.
- **#301's end state, proposed:** the modal is the map (pin, road pick, cross pin), and #301 closes after the three branches below. Ruling 189 says the decision work "migrates piece by piece", so this needs your ruling. The alternative is to keep #301 open for a later "pin entry on the band" piece.

**Q4. Cross-street (3c): stays in the modal, with a band entry point?** Recommend **yes**.
- The pin needs a map click, and no vitest places one. It can't come to the band under option (a).
- **The fix is the dead end.** NearIntersectionForm says "not marked. Mark the cross street on the map" (`NearIntersectionForm.tsx:262-268`) with no control.
- **Proposed:** a "Mark on map" button there that opens the modal with intersection mode armed. Today the operator must find "Edit on map", then the panel's own button.
- **Alternative:** a list of detected cross streets on the band ("E 12th Ave · 150 ft upstream"). That needs a backend producer and overlaps #285 (the nearest-intersection tag). Not now.

---

## 3. Proposed branches, one per surface, in ship order

Stacked: each branches from the previous tip (`feedback_stacked_arc_branches`). All frontend only.

| # | Branch | Surface | Scope | Lane |
|---|---|---|---|---|
| 1 | `issue-301-modal-cleanup` | the modal + comments | §1's dead code, the unused props (`speedMph`, `laneWidth`, `divided` on `LocationPickerInitial`), the stale comments (3d, `move-ledger.ts:168-172`), the dead `JurisdictionSection` suggestion types. Optional: P16's pulse bar. | light, behaviour-preserving |
| 2 | `issue-301-road-properties` | the modal's right column + WHAT's Speed row | remove ROAD PROPERTIES and the override plumbing (`RoadFieldOverrides`, `lib/scenarios/overrides.ts`, `LocationPickerResult.overrides`, `confirmedRoad.overrides`); new subtitle; Q2's speed line on WHAT | normal |
| 3 | `issue-301-cross-street-entry` | NearIntersectionForm's intersection line | the "Mark on map" button (Q4); the modal opens with intersection mode armed | light |

Screenshots at 1440 and 390 for 2 and 3. Prod check by headless browser after each ship.

## 4. Rule 5: predicted churn

**Backend: none on any branch.** No `src/` file changes; the backend suite and every baseline are untouched.
**Deliverables: byte-identical** for the same scenario. The backend never reads `meta.confirmedRoad`
(`src/api/schemas.py` doesn't name it), so dropping `confirmedRoad.overrides` changes no backend-read
field.

**Branch 1 (cleanup):**
- No behaviour or copy change.
- **Tests:** about 10 modal test files pass the props being deleted (`speedMph` in every `LocationPickerModal.*.test.tsx` props fixture). Each loses the prop lines, with no assertion change.
- `DetectedVsApplied.confidence.test.tsx:32` cites modal line numbers in a comment; the comment is re-pointed.
- With the P16 bar: one test asserting the placeholder, if any exists (none found by grep).

**Branch 2 (road properties). Deliberate behaviour changes:**
1. The modal shows no road properties and can't edit speed, lanes, road type or divided. Those are edited on WHAT only.
2. **The flow that used the modal's editors moves to WHAT.** Every other flow sends the same backend-read fields as today.
3. The class-fallback speed moves from the modal's accept button to WHAT's Speed row as a line (Q2 b). No value changes. A scenario that took "Use N mph" in the modal now sets N on WHAT.
4. The modal subtitle copy (Q1).
5. **The hidden `divided: true` from the modal on a one-way road can no longer be produced.** Plan-inert today (§1).

**Branch 2 tests, file by file (counts are `it(` counts):**
- **Deleted:**
  - `LocationPickerModal.provenance` (7) and `DetectedVsApplied.confidence` (9): they pin the panel.
  - `lib/scenarios/overrides.test` (10), together with `overrides.ts`, if no other caller remains (to be enumerated at the build).
- **Rewritten:**
  - `GeneratorShell.handoff-provenance` (5): the UX-02 accept cases move to WHAT's line.
  - `handoff-summary.test`: the UX-02 accept/skip subset (of 32).
- **Edited, no assertion change:** `onSave` stubs that pass `overrides` in `GeneratorSidebar.corridor-bar` (4), `.fact-strip` (4), `.jurisdiction-band` (3), `GeneratorShell.disclosure-container` (5), `.confirmed-road` (2), `.picker-reapply` (11), `.kind-switch` (4), `.kind-confirm` (12).
- **Checked at the build for row assertions:** `LocationPickerModal.road-pick` (9), `.state-contract` (12) and `.scan-honesty` (4). The detection outcome card stays, so most of these hold.
- **New:** about 3 tests for the WHAT Speed line (shown on a fallback, absent with a tag, no button) and 1 asserting the modal renders no road-property editor.
- **Unchanged:** `lib/road-detection/classify.test` (43) and `provenance.test` (20). The classifier and the vocabulary stay, since WHAT reads them.

**Branch 3 (cross-street entry):**
- One new control. The NearIntersectionForm line gains a button; the copy around it stays.
- **Tests:** about 2 new (the button opens the modal with intersection mode armed; absent when a cross street is marked). `GeneratorShell.near-intersection` (5) and `LocationPickerModal.intersection` (4) unchanged.

**Not changing, proved at each build:**
- the backend suite;
- the audit / PDF / XLSX for the Broadway SB and Lafayette flagger fixtures;
- the WHERE ledger rows;
- the band aerial;
- the modal's map, search, coordinates and candidates.

## 5. Principles (DESIGN-PRINCIPLES.md), for what's left

The surfaces: the modal (FLOW step 1 Where, the rep and the estimator) and WHAT's Speed row (step 2
What, same users).

| P | Verdict | Note |
|---|---|---|
| P1 Nothing moves that the user did not ask to move | honoured | Branch 2 removes a modal column; the band doesn't reflow (`WhatBand.tsx:431-447`: a line under an existing row, present from first render). Branch 3 adds a button in place of a sentence (`NearIntersectionForm.tsx:262-268`), present from first render. |
| P2 One voice per fact | **fixes a deviation** | Today speed, lanes, road type and divided have two controls and two voices (§1 row 5). Branch 2 leaves WHAT as the one voice. The modal's side sentence is said twice (row 8); not in scope unless you want it on branch 1. |
| P3 The next thing to do is visible | honoured / improved | Branch 3 puts the next action where the line asks for it. |
| P4 Edges, not eyeballing | n/a for 1; honoured for 2/3 | The new Speed line uses the row's existing `notes` slot (`WhatBand.tsx:436`); the button uses the form's control column. Measured at the build. |
| P5 Hierarchy by weight and colour | honoured | The speed line is `tr-prov` amber like the other ⚠ lines. |
| P6 Content never dictates layout | honoured | The modal's right column already scrolls; removing the panel shortens it. The speed line wraps inside its cell (390 check at the build). |
| P7 Reversible before irreversible | n/a | |
| P8 Wait states are honest | honoured | No new wait. |
| P9 Every state has a symbol and a word | honoured | "⚠ no posted speed…" (Q2 b); the button carries a word. File:line at the build. |
| P10 Targets sized for the hand | to measure | The new button is 44 px at ≤480 like the band's other controls. |
| P11 Consistency is a rule | **fixes a deviation** | Two provenance vocabularies (modal "OSM · INFERRED" vs WHAT "⚠ from the road") become one. |
| P12 Polish is trust | honoured | The dead-end line goes (branch 3). |
| P13 Simple first; the rest on request | honoured | Step 1 stops asking about classification detail. |
| P14 Empty states show the shape | n/a | |
| P15 Every action undoable, the record stays | honoured | Edits on WHAT keep their ✓ yours / ⚠ records (R110). |
| P16 No skeletons or fake progress | deviation found | `LocationPickerModal.tsx:2694` pulse bar; fix optional on branch 1. |
| P17 A named person doing a named job | honoured | Step 1 Where and step 2 What, the rep and the estimator (FLOW §1). |
| P18 One question per step | honoured; Q3 is about keeping it | The modal asks "where, and which road?"; WHAT asks "anything we got wrong?". |
| P19 The default view is the 80% case | honoured | The road-property editors leave step 1, where FLOW says they can be ignored. |
| P20 Zones by the user's question | **fixes a deviation** | Road properties belong to "What's the job? / anything we got wrong?", not "Is this the right spot?". |
| P21 The model matches the mental model | honoured | No change to the pin model. |
| P22 Revision is a mode | n/a | |

## 6. What I need from you

Q1–Q4 above. With "yes" to all four, I build branch 1, then 2 stacked on it, then 3. Each gets its
own report, verifier verdict and ship line.
