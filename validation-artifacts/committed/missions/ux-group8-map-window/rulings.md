# Rulings: mission ux-group8-map-window, item #507 (folds in #506)

Source: `docs/prompts/cc-prompt-ux-group8-map-window.md` (`dc9fcba` on `mission-mwsl-prod-check`). Design canvas: https://claude.ai/artifact/TbdFDMmjqJpsUkqsT5wpFL, boards `W1`, `W2`, `F1`, `F2`.

## Ryan's rulings (2026-11-10), verbatim

1. **The window's look follows group 1's rules (`W1`).**
   - The heading is "Where is the work?" (19/600), with the line "Search an address or tap the map where the work starts, then pick the road."
   - The address field and Search are 44 px.
   - The map has only zoom on it: no text overlay and no layer toggle unless you trace one as needed, and record it.
   - The right panel holds "Which road is the work on?" as a radio list, then "Where the work starts" with its line and "Tap the map to move it".
   - The footer has Cancel and "Save and close".
   - Inter throughout. No mono, no caps labels.
2. **One entry per street.**
   - When a street is mapped as two one-way carriageways (or two OSM ways with one name and opposite directions), the list shows it once, e.g. "East Colfax Avenue · Traffic both ways · 9 m from your pin".
   - Trace how the road list is built today and where the direction is stored. Choosing the side on the page (ruling 3) sets the carriageway.
   - Rule 3 applies: the backend decides the grouping and the carriageway, not the frontend. Record the grouping rule and every case it covers (dual carriageway, a true one-way, a divided road).
3. **The side question carries the direction (`W2`).**
   - For a street with traffic both ways, both sides show, each with its traffic: "North side · Next to westbound traffic" and "South side · Next to eastbound traffic". The question reads "Which side of <street> is the work on?"
   - For a true one-way street, the one side is picked for you. A line says why, e.g. "<Street> is one-way here, so the work is on the <side> side, next to its traffic." Nothing is left to tick.
   - Rule 12 applies to every name and direction.
4. **When the road lookup fails (`F1`):**
   - The panel shows a plain message: "We couldn't look up the roads here." / "The road data service didn't answer. Try again, or tell us which way the road runs and carry on." It has a real "Try again" that re-runs the lookup (closes #498 if that's the same thing; record it).
   - Then "Which way does the road run?" with four choices, each with a small line icon: "East–west", "North–south", "Northeast–southwest", "Northwest–southeast". Under them: "Look at the map: which way do the lanes run past your pin?"
   - "Detection service unavailable" and every other jargon error in the window get plain words. List each one.
5. **The sides after the fallback (`F2`):**
   - The side question offers only the picked direction's two sides, named for that direction, with the traffic beside each, e.g. "Northwest side · Next to traffic heading southwest" and "Southeast side".
   - It also gets the line "You said the road runs <direction>, so these are its two sides."
   - Trace today's side naming on a diagonal road. If a detected diagonal road is named misleadingly today (e.g. "north side" on a road heading northeast), fix it the same way, and record it.
6. **Save only with an answer (#506).** "Save and close" is enabled only when a road is picked, or a direction is picked in the fallback. Otherwise it's disabled, with the line "Pick a road, or a direction if the lookup failed." Trace #506's path, and add a test that fails on it.
7. **The rest stays.** Move, Edit on map, #446's tap feedback, #485's take-turns editing, #469's band height and #490's column rule all stay as they are. Add the window's states to the permanent checks: band and columns, 44 px (with Mapbox's marks excepted, per #505), and axe.
8. Every new string is listed with its source. No new hex. Unslop.

Mission-level: stop for any change to a device count (sign/device counts in any plan, fixture or baseline).

## Traces

### T1. How the road list is built today, and where the direction is stored
- `conestruct/site/app/api/road-bearing/route.ts` (server, the one producer of the road list): one Overpass query within 50 m, each way snapped (<= 30 m), each candidate carries `bearing` (the snap segment in OSM vertex order) and `tags.oneway` (raw). `dedupCandidates` (`lib/road-detection/dedup.ts`) keys on name|class|bearing-octant, so the two carriageways of a dual carriageway land in opposite octants and stay two entries. That is the E Colfax "eastbound / westbound" pair. A second Overpass round trip stitches each candidate's geometry and measures `twin_distance_m` (`lib/road-detection/twin.ts`).
- The picker (`components/LocationPickerModal.tsx`) shows each candidate as `"<name>, <compass>bound"` (`roadName`, from `candidateLabel`), and Save writes `meta.confirmedRoad = {candidate, classification, ...}`.
- Direction is stored on the candidate (`bearing`, `tags.oneway`) and relayed on the wire as `meta.roadDirection` + `meta.centerline` by `lib/scenarios/centerline-relay.ts`. The backend's `_side_options` (`src/api/render_api.py`) offers a road's edges from that centerline and drops any edge whose travel runs against the one-way tag (`corridor.against_legal_direction`). One carriageway of E Colfax is one-way and divided, so it gets ONE option: the "one-answer side question" seen 2026-11-06.

### T2. Side naming on a diagonal road (ruling 5)
`corridor_layout.cardinal` quantizes to the nearest of N/E/S/W (CHOSEN in #290, not a Ryan ruling). A road whose traffic heads 45° (northeast) is offered as "South side · eastbound traffic" (right edge 135° rounds to South, travel 45° rounds to East). Its real edge is the southeast side and its traffic heads northeast: misleading (Rule 12). Fixed the same way as F2 (R145-8 below). The plan sheet's page 2 also prints `cardinal(...)[1]` bound words (`plan_sheet.py:4739`); that PDF text is out of this item's files and is filed as a follow-up.

### T3. #506's no-road Save path
`canSave` (LocationPickerModal.tsx, before this change) blocked only `roadUnresolved` (more than one candidate, none ticked) and an in-flight lookup; the comment said "Zero-candidate and detection-error paths remain saveable." A failed lookup (`/api/road-bearing` non-200, `scan_status: "unavailable"`, or a thrown fetch) set `classify.state = "error"` with no candidate, so Save went through with `confirmedRoad: null`. `onPickerSave` then cleared the detection relays, the wire had no centerline, and the backend's `_side_options` fell back to the four headings: exactly #506's "1,000 ft (default)" and four-option side question. The prod run's two 400s were not captured with URLs; the only 400s on this path are `/api/road-bearing`'s own "Invalid JSON"/"Invalid coords" and the corridor-geometry read's refusal (shown as "declined"). Neither is reproducible from the code with a valid pin, so they are recorded as unexplained, not fixed (no 400 source changed).

### T4. #498
`gh issue view 498`: see checkpoint.md. The F1 "Try again" re-runs the same `detectAt` the old "↻ Re-detect roads" ran.

## R145 self-ruled calls

- **R145-1 Grouping lives in the road list's server producer.** The road list is built only by `/api/road-bearing` (server side); the picker component renders what it gets and groups nothing. The grouping rule is applied there (`lib/road-detection/group.ts`, called by the route), and the carriageway is chosen by the Python backend's `_side_options`: each option names the carriageway it lays out, and the page writes it verbatim (Rule 3). No grouping or carriageway choice is computed in a component.
- **R145-2 The grouping rule.** Two candidates in one lookup are one street when: same name (or same ref when unnamed), same OSM highway class, both tagged one-way (`yes`/`-1`), and their travel directions are 150° or more apart (the twin rule's `OPPOSITE_MIN_DEG`, #308). Both are within 30 m of the pin (the snap limit), so each is within the 100 m twin radius of the other: the backend's R83 verdict for each is "divided". The nearer carriageway leads; the other rides as `twin`. Cases:
  - Dual carriageway, both carriageways found (E Colfax at Race): one entry, "Traffic both ways"; the side question offers each carriageway's outer edge, and the side picked sets the carriageway.
  - True one-way street (Lincoln St): no same-name opposite way in the list, one entry "One-way"; the backend offers its legal right edge (and #300's left curb on shoulder work). When exactly one side is offered it is picked for you with the why-line.
  - Divided road with only one carriageway in reach (wide median, or a trunk/motorway carriageway): one entry, "One-way"; one side offered (the median edge stays unoffered, #290), picked for you.
  - Two-way road (one way, untagged or `oneway=no`): one entry, "Traffic both ways", two sides, unchanged.
- **R145-3 The carriageway swap writes the same plan a carriageway pick wrote before.** Choosing the twin's side swaps `confirmedRoad.candidate` to the twin and re-applies the twin's own classification through the same `applyClassification` the picker's Save uses. The resulting scenario is the one today's picker produced when the operator ticked that carriageway, so no device count can move (checked: see checkpoint.md § Device counts).
- **R145-4 One side picked for you only when the backend offers exactly one.** Ruling 3's "true one-way" auto-pick is applied when the backend offers one built side. #300's left curb (shoulder work on a one-way street, a Ryan ruling) is kept, so a one-way street with two offered curbs still asks. Not reversing #300; flagged in the report.
- **R145-5 The fallback also answers "no road found".** A completed lookup with no road within 30 m gets the same direction question (its own first line, below), since ruling 6 otherwise leaves such a pin unsaveable.
- **R145-6 Map controls.** The satellite/streets toggle, the two bottom text overlays, the Recenter button and the zone legend leave the map. Zoom (+/−, Mapbox's NavigationControl, 44 px) is the only control. The corridor line stays drawn (it is the road's geometry, not text); its text-label layer goes (a text overlay).
- **R145-7 "Tap the map to move it"** renders as a plain line, not a link: the map tap is the action, and a link that does nothing would be a fake control.
- **R145-8 Diagonal side names.** Side and traffic words use eight compass points (octants, 22.5° either side, the same bins as `dedup.bearingOctant`). A cardinal octant keeps "<X>bound traffic"; a diagonal one reads "traffic heading <northeast>". CHOSEN (non-safety): the octant bins, so a road at 20° still reads northbound. Roads in cardinal octants are byte-identical; the four legacy headings (a plan saved before this change with no road) keep their labels.
- **R145-9 Jargon replaced, new strings listed** in checkpoint.md § Strings.
- **R145-10 Kept for need (ruling 1's "unless you trace one as needed"):** the coordinate entry (the only way in without a Mapbox token), the cross-street panel (near_intersection's marked crossing, #117/#234), and the corridor preview's refusal/declined/error lines (Rule 10: an honest refusal must stay visible).
- **R145-11 Honest words for a lone one-way carriageway (gate round 1, Rule 12).** A way tagged one-way is named by the #308 carriageway verdict (the frontend mirror in `lib/road-detection/carriageway.ts`, for words only; the backend's verdict builds the plan): "One-way" and "<Street> is one-way here, …" only for a one-way street; "Divided road" and "<Street> is divided here, so the work is on the <side> side, next to the traffic on this side." for one carriageway of a divided road (e.g. E Speer Blvd, twin 60.5 m away, out of the list's 30 m reach); "Traffic one way here" in the list and "Only the <side> side can be laid out here, so the work is on that side, next to its traffic." when the facts can't decide. R145-2's "One-way" for a divided carriageway is superseded.
- **R145-12 No Undo on a side picked for you (gate round 1).** The auto-picked lone side's record has no Undo (`QuestionSteps` record `noUndo`): its only effect was to re-pick the same side, a fake control by R145-7's rule. Any other answered side keeps its Undo.
- **R145-13 The Centerline row keeps its words (#513, gate round 3).** "OSM, full corridor" and "covers … ft, bearing beyond" are the plan sheet's CORRIDOR DETAILS row word for word (`plan_sheet.py:4657-4660`), and #211 binds the two surfaces to one vocabulary for one fact. Plain words for that row belong on both surfaces at once, so it is filed as #515 and the window keeps today's words. "none: straight projection along the heading" stays with its row for the same reason (it is the row's third value). Ruling 1's "unless you trace one as needed": traced to #211.
- **R145-14 The road list's travel words are the backend's (#512, gate round 3; Ryan 2026-11-11).** Ryan: the label "must come from the Python backend's existing one-way classification (the same one that decides sides), not a separate rule in the Next route; the route may still do the display grouping." The side choices read the tag through `against_legal_direction`: `yes` and `-1` rule a direction out, anything else rules none out. That reading is now `corridor.legal_offset_deg`, and `corridor.travel_reading` builds on it, so the list never names a direction the side question contradicts. Cases: one-way tag → one way (named by #308's verdict, R145-11); a grouped street → both ways; `reversible` / `alternating` → "Direction changes by time"; untagged or `no` → both ways; an untagged motorway or motorway link → no direction words, because OSM implies one-way there while the side choices offer both edges, so either claim would be untrue (Rule 12; Rule 10: say nothing). Making the side choices honour the implied one-way is a change to which plans the backend accepts, so it is filed as #514, not folded. The route only relays raw facts and attaches the answer; a backend miss shows the distance alone (Rule 10). CHOSEN (non-safety): the 2500 ms wait.
