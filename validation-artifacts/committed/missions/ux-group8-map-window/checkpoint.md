# Checkpoint: #507 (folds in #506), mission ux-group8-map-window

Branch `issue-507-map-window`, stacked on `mission-mwsl-prod-check` at `dc9fcba`. No park-list item hit before code (R145; see rulings.md).

## Plan (5 bullets)

1. **Problem.** `LocationPickerModal.tsx` still has the old look (mono caps labels, map overlays, "Detection service unavailable"); `route.ts` + `dedup.ts` keep a dual carriageway's two ways as two entries, so a one-carriageway pick leaves a one-option side question; with no road, `_side_options` (`render_api.py`) offers four compass headings; `canSave` lets a failed lookup save with no road (#506, trace T3).
2. **Rulings.** Ryan's rulings 1–8 (2026-11-10), quoted in rulings.md; R145-1…R145-14 self-ruled there (R145-11/12 at gate round 1, R145-13/14 at round 3).
3. **Change.** (a) the route groups a street's opposite one-way carriageways into one candidate with a `twin`; (b) the picker is rebuilt to W1/F1: heading, 44 px search, zoom only, radio road list with "Traffic both ways"/"One-way", "Where the work starts", Cancel / "Save and close", a lookup-failed panel with a real Try again and the four-direction question; Save needs a road or a direction; (c) the wire relays `twinRoad` and `roadAxis`; `_side_options` offers the twin's outer edge (naming the carriageway), only the picked axis's two headings, and eight-point names for diagonal roads; (d) the side question names the street, auto-picks a lone offered side with the why-line, carries the fallback's line, and a twin-side click swaps the carriageway through the picker's own classification apply.
4. **Rule 5 churn prediction** (below).
5. **Proof.** Red proof: a mounted picker test on #506's path (lookup fails → Save must be disabled) failing on `dc9fcba`; vitest for every changed component/lib file; pytest for `render_api` side options and the schema; local walk with Overpass stubbed at 1440, 1198x930, 390 with axe and the 44 px measure. Commit-worthy crops in this folder; bulk extras in `validation-artifacts-extra/ux-group8-map-window/`.

## Rule 5 churn prediction (written before the diff)

Changes:
- Picker look and copy (every string in § Strings). Tests that query the old words change with them.
- Picker Save: disabled after a failed lookup or a no-road lookup until a direction is picked (#506; behavior change, deliberate).
- Road list: a same-name opposite one-way pair is one entry (behavior change, deliberate). The route's response gains `twin` on the lead candidate only when grouped; every other response is byte-identical.
- Side options: diagonal-octant roads get eight-point words (label change only). A plan with `twinRoad` gets the twin's outer edge as a second option. A plan with `roadAxis` gets only that axis's two headings. Every other side-options answer is byte-identical (cardinal-octant roads, the legacy four headings).
- Schema: `WorkPlacement.heading` accepts NE/SE/SW/NW; `ScenarioMeta` gains optional `twinRoad`, `roadAxis` (absent ⇒ unchanged).
- Side question: titled with the street's name when a road is confirmed; a lone offered side is written for you.

Stays byte-identical:
- Every device count, sign list, PDF, XLSX and audit for every existing fixture and baseline (no fixture carries `twinRoad`/`roadAxis`/a diagonal heading; `cardinal()` and page 2 are not touched).
- Move, Edit on map, #446, #485, #469 band height, #490 columns.
- The corridor-geometry read's laid-out answer (only `side_options` labels/entries move, as above).

## Strings

### Replaced (ruling 4: every jargon error in the window; ruling 1: no caps labels)
| # | Before | After |
|---|---|---|
| 1 | "Detection service unavailable" (error card) | "We couldn't look up the roads here." + "The road data service didn't answer. Try again, or tell us which way the road runs and carry on." |
| 2 | "Couldn't reach road-detection service." (map warning) | removed; #1 says it |
| 3 | "Road detection is unavailable right now. Use ↻ Re-detect roads to retry." | removed; #1 and its "Try again" |
| 4 | "↻ Re-detect roads" | "Try again" (in the failed state) |
| 5 | "No road detected at this point" / "No roads detected" | "We didn't find a road at your pin." |
| 6 | "No road detected within 30 m. Verify the location. With no road, the band asks which way traffic heads." and "Set road properties in Step 2, or drag the pin closer to the roadway. With no road, the band asks which way traffic heads." | "No mapped road runs within 30 m. Move the pin onto the road, or tell us which way the road runs and carry on." |
| 7 | "Detecting roads at pin…" | "Looking up the roads at your pin…" |
| 8 | "Detecting road… Save turns on once detection settles" | "Looking up the roads. Save turns on when that's done." |
| 9 | "⚠ Pick a road to continue" | "Pick a road, or a direction if the lookup failed." |
| 10 | "Map unavailable" + "NEXT_PUBLIC_MAPBOX_TOKEN is not configured. The interactive map can't load. Enter coordinates manually below." | "The map can't load here." + "Enter the coordinates above instead." |
| 11 | "Corridor preview unavailable. Couldn't reach the layout service. You can still save; the plan is validated when generated." | "We couldn't draw the work on the map. You can still save; the plan is checked when it's made." |
| 12 | "Corridor preview declined: <msg>" / "Corridor preview declined." + "You can still save; the plan is validated when generated." | "The work can't be drawn here: <msg>" / "The work can't be drawn here." + "You can still save; the plan is checked when it's made." |
| 13 | "Can't lay the corridor out here: <reason>" | "The work can't be laid out here: <reason>" |
| 14 | "Couldn't reach the road-detection service. Describe the approaches by hand in the form." (cross street) | "The street lookup didn't answer. Describe the approaches by hand in the form." |
| 15 | "WORK ZONE · DEFINE" / "Define Work Zone" / "Drop a pin where the work starts, and pick the road." | "Where is the work?" / "Search an address or tap the map where the work starts, then pick the road." |
| 16 | "PICK THE ROAD · N FOUND", "ROAD", "Change", "Details", "Detected from OSM: …° (…) · way …" | "Which road is the work on?" (radio list); the rest removed |
| 17 | row "East Colfax Avenue, westbound" + "Main road · 9 m from your pin" | "East Colfax Avenue" + "Traffic both ways · 9 m from your pin" / "One-way · N m from your pin" |
| 18 | "Save & Close" | "Save and close" |
| 19 | map overlay "CLICK THE MAP OR SEARCH TO DROP A PIN" | "Search an address or tap the map to place your pin." (in the rail) |
| 20 | map overlay and panel "Save, then say which side is occupied." (#402 ruling 2) | W1's "You'll pick the side of the road next, on the page." |
| 21 | "CORRIDOR EXTENT", "Drop a pin to compute the corridor.", "Computing corridor extent…", "Corridor lengths wait on the kind of work. Choose it after you save.", "Save the pin; the corridor lays out on the band." | removed (ruling 1: the rail holds the road question and "Where the work starts") |
| 22 | "STREETS"/"SATELLITE" toggle, "RECENTER", zone legend, zone text labels on the map | removed (ruling 1, R145-6) |
| 23 | "+ OR ENTER COORDINATES MANUALLY" / "− HIDE COORDINATE ENTRY" / "LAT / LNG DECIMAL DEGREES" | "Or enter coordinates manually" / "Hide coordinate entry" / "Latitude and longitude, in decimal degrees" |
| 24 | "Area located. Drop a pin on the road to detect roads." (coarse geocode notice) | "That search found a town or area. Tap the map on the road where the work starts." (#513) |
| 25 | the corridor preview's "Centerline" row: "OSM, full corridor" / "covers … ft, bearing beyond" / "none: straight projection along the heading" | kept, R145-13 (#513) |

### New strings and their source
| String | Source |
|---|---|
| "Where is the work?" | ruling 1 |
| "Search an address or tap the map where the work starts, then pick the road." | ruling 1 |
| "Which road is the work on?" | ruling 1 |
| "You'll pick the side of the road next, on the page." | W1 board |
| "Where the work starts" | ruling 1 |
| "At your pin." | R145-7 (W1's line without the cross-street distance, which the window does not read) |
| "Search an address or tap the map to place your pin." | R145 (the old overlay, off the map) |
| "Tap the map to move it." | ruling 1 (as a plain line, R145-7) |
| "Traffic both ways · N m from your pin" | ruling 2 |
| "One-way · N m from your pin" | R145-2 (ruling 2's row pattern for a one-way) |
| "Divided road · N m from your pin" | R145-11 (the #308 verdict `divided`) |
| "Traffic one way here · N m from your pin" | R145-11 (the #308 verdict `undecided` or any other) |
| "Direction changes by time · N m from your pin" | #512 (`travel_reading` `changes_by_time`: `oneway=reversible` / `alternating`) |
| "N m from your pin" with no direction words | #512, Rule 10 (`travel_reading` `unknown`, or no backend answer) |
| "<Street> is divided here, so the work is on the <side> side, next to the traffic on this side." | R145-11 (the picked-for-you line, divided) |
| "Only the <side> side can be laid out here, so the work is on that side, next to its traffic." | R145-11 (the picked-for-you line, undecided) |
| "That search found a town or area. Tap the map on the road where the work starts." | #513 (plain words for #24) |
| "We couldn't look up the roads here." / "The road data service didn't answer. Try again, or tell us which way the road runs and carry on." / "Try again" | ruling 4 |
| "We didn't find a road at your pin." / "No mapped road runs within 30 m. Move the pin onto the road, or tell us which way the road runs and carry on." | R145-5 (30 m = the route's SNAP_MAX_DISTANCE_M) |
| "Which way does the road run?" / "East–west" / "North–south" / "Northeast–southwest" / "Northwest–southeast" / "Look at the map: which way do the lanes run past your pin?" | ruling 4 |
| "Looking up the roads at your pin…" / "Looking up the roads. Save turns on when that's done." | R145 (plain words for #7, #8) |
| "Pick a road, or a direction if the lookup failed." | ruling 6 |
| "Save and close" | ruling 1 |
| "The map can't load here." / "Enter the coordinates above instead." | R145 (plain words for #10) |
| "We couldn't draw the work on the map. You can still save; the plan is checked when it's made." / "The work can't be drawn here: …" / "The work can't be laid out here: …" | R145 (plain words for #11-#13) |
| "The street lookup didn't answer. Describe the approaches by hand in the form." | R145 (plain words for #14) |
| "Latitude and longitude, in decimal degrees" | R145 (#23 without caps or the slash) |
| "Which side of <street> is the work on?" | ruling 3 |
| "<Street> is one-way here, so the work is on the <side> side, next to its traffic." | ruling 3 |
| "You said the road runs <direction>, so these are its two sides." | ruling 5 |
| backend "<Point> side · traffic heading <point>" and its "Next to traffic heading <point>" | ruling 5 / F2 board; eight-point words R145-8 |

No new hex: every colour in the new CSS block (`app/globals.css`, `.map-window`) is an existing token (`--warn`, `--vd-flag-ground`, `--act`, `--act-bright`, `--on-act`, `--rule`, `--ink*`, `--fail`, `--da-ground`).

## Device counts (no PARK: none moves)

- No file under `tests/fixtures/` or `tests/snapshots/` changed (`git status` empty there); no fixture carries `twinRoad`, `roadAxis` or a diagonal heading.
- `scenario_to_call` reads neither new field; `twinRoad` is read only by `_side_options`.
- `tests/test_side_options_507.py::test_the_twin_relay_moves_no_device`: the device list (type, label) with and without `twinRoad` is identical. `::test_a_diagonal_heading_builds_the_same_devices_as_a_cardinal_one`: NE vs E, identical.
- The carriageway swap writes the twin's own classification through `applyClassification`, the call the picker's Save makes for a picked candidate (R145-3), so a swapped plan equals the old "tick that carriageway" plan.
- pytest on the count and side files (test_rules, test_replication_snapshot, test_work_start_fixture_twins, test_ni_summary_counts_cross_street, test_thornton_stipulation6_count_388, test_night_adjustments and the side-option files): 296 passed.

## Actual churn vs prediction

Matches the prediction, plus: the type census, ink and spacing guard tests moved with the restyle (the picker's Tailwind debt rows left for the `.map-window` block); #402's picker side sentence was replaced by W1's line (prediction listed it under the look); the side auto-pick does not fire while the band re-asks the side on purpose (#440 X20, #485), found by the band tests.

## Churn amendment (gate round 1, written before the repair diff)
- Rule 10: the WHERE summary, the column's road label and the provenance line name a grouped street without a direction until its side is picked (`plannedDirection`, labels.ts); every other road reads exactly as before.
- Rule 12 (R145-11): a lone one-way way reads "One-way" only for a one-way street; "Divided road" / "Traffic one way here" otherwise, and the picked-for-you line follows the same verdict.
- R145-12: the side picked for you has no Undo (shared `QuestionSteps` gains an optional `noUndo`; every other caller unchanged).
- Commit message: the #506 claim narrowed to "no save with no answer" (the default length after a fallback save is unchanged); D3 (43 px coordinate boxes at desk widths, predates this change) stated beside the 44 px claim.
- `scripts/verify-columns-end-together.mjs` learns the auto-picked side so its existing states pass again; #510 narrowed to the new window states.
- Kept-as-is list above: "Undo on a side picked for you re-picks it" is superseded by R145-12.

## #498
Not the same thing: #498 is the WHERE band's failed geometry read (`useCorridorGeometry`), not the window's road lookup. F1's Try again re-runs the road lookup only. #498 stays open.

## Walk defects and their disposition (walk.md)
- D1 (fixed): a side picked for you moved the card on, so its why-line was never seen and the record said "the road". The record row now carries the why-line ("<Street> is one-way here, so the work is on the <side> side, next to its traffic."), and any other side record names the street. Not re-walked (fold-in after the walk); covered by WhereBand.side-control and GeneratorShell.kind-confirm.
- D2 (part fixed, rest filed #510): the check scripts' "Save & Close" now also accepts "Save and close"; teaching the columns script the auto-picked side and the window's states is #510.
- Kept as is: Undo on a side picked for you re-picks it (ruling 3: nothing left to tick); the fallback's north-south sides read "traffic heading north" (F2's wording) while a detected road reads "northbound traffic".

## Follow-ups filed
- #509: page 2's bound words stay four-way while the side question now names diagonals.
- #510: the permanent checks can't reach the new window states or the auto-picked side (ruling 7's script half).
- #514 (round 3): the side choices read an untagged motorway as two-way; the road list says no direction for it meanwhile (R145-14).
- #515 (round 3): the Centerline row's plain words, on the window and the plan sheet together (R145-13).

## Gate round 3: #511, #512, #513 folded in (Ryan, 2026-11-11)

Ryan allowed one third gate round for #507 only, to fold in #511–#513, and ruled for #512 and ruling 2 that the road list's "Traffic both ways" / one-way words come from the Python backend's one-way reading (the one that decides the sides), not a rule in the Next route; the route may still group for display.

Churn prediction (stated in the session plan before the diff):
- Changes: the road row's words for `reversible` / `alternating` ways ("Direction changes by time"), for an untagged motorway or link and when the backend doesn't answer (distance only); the direction tiles' mark and picked ring; the coarse geocode notice; two code comments; a new backend read `/render/road-travel`; a new optional wire field `travel` on each `/api/road-bearing` candidate.
- Byte-identical: `against_legal_direction`'s results (it now calls `legal_offset_deg`, the same reading), every side option, every plan and device count; the Colfax, Lincoln and Speer rows' words.

What was built:
- #512: `src/rules/corridor.py` `legal_offset_deg` (the tag reading `against_legal_direction` uses) and `travel_reading` on top of it; `src/api/render_api.py` `/render/road-travel` returns it with #308's `carriageway_verdict` per entry; `lib/road-detection/road-travel.ts` relays the raw facts from the route and attaches the answer (CHOSEN 2500 ms timeout; any failure leaves no words); `roadRowLine` renders the backend's words only. The frontend mirror (`carriageway.ts`) is no longer used by the picker.
- #511: each tile carries `road-pick-mark`; `.mw-axis.is-picked` adds an inset 1 px `--act` ring, so picked differs from hover (border colour only) by the filled mark and the ring.
- #513: the coarse notice in plain words (#24); the Centerline row kept (#25, R145-13); the comments at the #139 and #189 guards corrected; this file's R145 range and strings completed.
