# #440 checkpoint — investigate first (CC, 2026-11-04)

Base: `origin/main` `9f1314e`. No pending evidence branch. No park-list item: no money, pricing or legal; no safety distance; no Ryan ruling reversed; no gated scenario enabled; nothing outside the repo. So no stop; the calls are in `rulings.md` § R145.

## 1. Today's cross-street path, end to end

| Hop | Where | What |
|---|---|---|
| Ask | `components/bands/WhereQuestions.tsx:117-135` | side question, while `intersection_not_marked`: the backend line + "Mark on map", no side choices (157-158) |
| Ask | `components/bands/BandAerial.tsx:165-166` | the same line as the aerial's note, on the `pin` picture |
| Open | `components/GeneratorSidebar.tsx:443, 474` | `openPicker(true)`: the picker armed (`LocationPickerModal.tsx:425-427`) |
| Click | `LocationPickerModal.tsx:1020-1023` | the map click routes to `placeCrossPin` while armed |
| Lookup | `LocationPickerModal.tsx:798-863` | `POST /api/road-bearing` at the click → `scan_status` guard → `deriveCrossStreet` (`lib/road-detection/cross-street.ts:232`) |
| Panel | `LocationPickerModal.tsx:1938-2010` | the control, its button words, resolving / none / error / restored / detected lines |
| Save | `LocationPickerModal.tsx:1484-1500` | `crossStreet` + `intersection` {lat, lng, name, highwayClass, postedSpeedMph} |
| Apply | `GeneratorSidebar.tsx:303-388` | `meta.intersection`; `approaches` from `approachesFromCrossStreet` (fresh-content guard), `withoutOperatorSet(approachSpeed)`, `detectionOverrides: undefined`, the lane-count hold |
| Wire | `meta.intersection`, `approaches[]` | the scenario is the payload |
| Readers | `src/api/schemas.py:191` `intersection_not_marked`; `:1477` `work_start_cross_station` (station from `meta.intersection`); `:1833-1847` `ApproachParams` per leg → `generate_near_intersection` (`src/generation/layout.py:1953`, the cross-leg advance signs: PDF page 1, the audit, the device breakdown, the quote); `src/rules/nearest_intersection.py:259` (marked pin → the WHERE tag); `lib/cross-street-tag.ts:51` (key includes the cross pin); the scan boxes per approach (#290 flagger note; near_intersection scans per approach through the same params) |
| Also reads the line | `lib/scenarios/move-ledger.ts` (side row), `lib/scenarios/rail.ts` + `validation.ts:315` (the rail's "Mark the cross street on the map. The plan places it from there.") | out of this arc's ruling 7 list; unchanged |

## 2. Ruling 2's trace

See `rulings.md` X2: side options don't read the crossing (`src/api/render_api.py:1594-1657`, computed at 1738 before the not-marked check at 1740). Order: side → kind → cross street.

**Superseded (session 2, 2026-11-04):** Ryan revised ruling 2: the order is kind → cross street (near-intersection only) → side. The trace above still holds. The kinds that change the side options are in `rulings.md` X20.

## 3. What a tap on the band aerial takes

- The aerial is an `<img>` of a backend Static Images picture (`static_aerial.py:211-248`), not Mapbox GL. A pixel becomes a coordinate only through the frame's centre and zoom. The backend fixes them only for the `pin` stage (`static_aerial.py:238-239`, `PIN_ZOOM` 17 + step, centred on the pin). Zoom-0 `work` / `laid_out` frames are `auto` (Mapbox's fit).
- So, while the cross-street question is current, the band asks for the `pin` picture, and the tap goes to `POST /render/aerial-point` (X3). At 1440 the frame is about 600 px wide (about 900 ft at z17 @ 39.7°N); at 390 about 358 px (about 540 ft). A crossing out of frame: the zoom-out step, or "Use the big map instead" (ruling 4).
- #301 piece 1 built the aerial read-only (`BandAerial.tsx:3-28`); no click handler exists on it today.

## 4. Rule 5 churn prediction

Changes (deliberate):
- **Backend:** `src/rendering/static_aerial.py` gains the pin-frame point function; `src/api/render_api.py` gains `POST /render/aerial-point`; `src/rules/nearest_intersection.py` adds `cross_direction` on `marked_cross_pin` answers only. New tests for each. Every other answer of every endpoint is byte-identical; no PDF, audit, XLSX or fixture changes.
- **Frontend:** new `app/api/aerial-point/route.ts` (proxy); the lookup core moves out of `LocationPickerModal.tsx` into a shared function (the picker's click behaviour is the same); the cross-street apply moves out of `onPickerSave` into a shared function (the Save's output is byte-identical); `WhereQuestions.tsx` adds the third question and drops the not-marked branch (the side choices show while unmarked); `BandAerial.tsx` gains the armed target, the bar, "Use the big map instead", the box and label, and drops the not-marked note; `LocationPickerModal.tsx` drops the detected paragraph; CSS in the band's sheet.
- **Tests that move:** `BandAerial.test.tsx` (the note line at :108), `WhereBand.no-crossing.test.tsx` (the side block and Mark on map, :95-120), `LocationPickerModal.intersection.test.tsx` (if any assertion reads the detected paragraph), `GeneratorShell.near-intersection.test.tsx` (form-side Mark on map, :251-262, kept: the WHAT form's button is out of scope). Suites that count CONFIRM questions for a near-intersection kind (`GeneratorShell.kind-confirm`, `kind-switch`, `batch-corrections`) may move where they pick that kind ("Question k of 3"). Backend: `tests/test_no_crossing_marked.py` unchanged (the line stays on the wire for the ledger and the rail).
- **Byte-identical:** the scenario the picker Save writes; every deliverable; the shoulder and flagger CONFIRM card (two questions); NEEDS YOU; the WHAT form's Mark on map.

### Amended after the build (2026-11-04, the diff-verifier's REPAIR): what the prediction missed, stated, not explained away

- **Source files not named above:** `lib/cross-street-mark.ts` (new: the one state hook for armed / in flight / failure / mark pixel / undo snapshot), `lib/cross-street-tag.ts` (hands down `offset_ft` and `cross_direction` for a marked answer; the tag's text and provenance unchanged), `lib/render-proxy.ts` (the aerial-point forward), `components/QuestionSteps.tsx`, `components/GeneratorSidebar.tsx`, `components/BandStack.tsx`, `components/bands/WhereBand.tsx` (the wiring between the hook, the card and the aerial).
- **Tests and census not named above:** `middleware.test.ts` (the new route's gate row); `type-census.test.ts` / `lib/design/type-exceptions.ts` (3 new declarations on registered sizes; the picker's 11 px count 7 → 6 and the Tailwind count 200 → 199, from the deleted paragraph); `lib/cross-street-tag.test.ts` (+1); new suites `tests/test_aerial_point.py`, `app/api/aerial-point/route.test.ts`, `components/GeneratorShell.cross-street-tap.test.tsx`, `components/bands/WhereQuestions.cross-line.test.ts` (the ✓ row's second line from the wire fields) and the shared lookup / apply tests. Artifacts, not code: `evidence/script/walk.mjs` (the walk, not yet run), `vitest-run1-failures.txt` and `pytest-full-run-failures.txt`.
- **Config:** `scripts/production-env.txt`, two `NEXT_PUBLIC_MAPBOX_TOKEN` cites moved by the edits (`LocationPickerModal.tsx:325` → `321`, `WhereBand.tsx:436` → `441`); caught by `tests/test_vercel_env_check.py` in the full run (`pytest-full-run-failures.txt`).
- **Predicted but did not move:** `LocationPickerModal.intersection.test.tsx` (no assertion read the detected paragraph); `GeneratorShell.kind-confirm`, `kind-switch`, `batch-corrections` (no CONFIRM count moved); `GeneratorShell.near-intersection.test.tsx` passed unchanged.
- **Behaviour change not predicted:** on the pin stage the aerial's picture key is the pin, frame and zoom step only (X16), so a zoom step there survives edits that don't move the pin.

## 5. P1–P22 for the changed surfaces (FLOW.md step 1, Where; user: a field rep or a TCP drafter on a first near-intersection plan)

| P | How this arc meets it |
|---|---|
| P1 | The ✓ row reserves its height while the lookup runs; Move keeps the old mark until a new tap; nothing reflows under the tap. |
| P2 | One producer for the lookup and the apply (X4); the street name from `meta.intersection.name` on both the label and the row. |
| P3 | The next action (tap) is on the map the question points at, with the bar saying what to tap. |
| P4 | The bar spans the aerial edge to edge; the outline is inset on the frame. |
| P5 | The bar is the one `--act` fill on the band while armed; the row's name is 15/600 over a 12.5 line. |
| P6 | The label wraps inside the frame at 390; the row's line wraps under the name. |
| P7 | Undo restores the pre-mark fields byte-identically (X7); nothing is generated until Confirm. |
| P8 | "Finding the street name…" in place; failure says so with Try again. |
| P9 | ✓ + words on the done row; the armed state has the bar's words and the crosshair glyph. |
| P10 | Use the big map instead, Move, Undo, Cancel, Try again: 44 px. |
| P11 | The question is one more `QuestionSteps` question; no second card. |
| P12 | The box, label and bar use existing tokens only; no new size or hex (ruling 8). |
| P13 | The cross street is asked only for the near-intersection kind. |
| P14 | Unmarked: the question card with its line; no fake row. |
| P15 | Undo on the row and on the collapsed record (X7). |
| P16 | No skeleton; the old picture is not held across frames (the box shows only on the tapped picture, X5). |
| P17 | A field rep marking the cross street for a near-intersection plan. |
| P18 | One question at a time; the tap answers the current one. |
| P19 | The picker stays one click away for hard spots. |
| P20 | WHERE asks where; the cross street is a where fact. |
| P21 | "Tap the intersection nearest the work" matches how a rep names the spot. |
| P22 | Revision is untouched (the sidebar unmounts after Generate). |

### Session 2 (2026-11-04): Ryan's revised ruling 2, the reorder. Stated after the build, in this session, before the commit. Prediction and diff are listed together.

- **Behaviour change, deliberate (ruling 2):** the CONFIRM card asks the kind first, then (near-intersection only) the cross street, then the side. Confirm and the W8 hold move to the side when a work-start pin is down, else they stay on the kind. Counts: near-intersection "Question 2 of 3" on the cross street, "3 of 3" on the side; shoulder and flaggers "2 of 2" on the side. So the shoulder and flagger card (§ 4's "byte-identical: the shoulder and flagger CONFIRM card") **now changes**: same two questions, opposite order.
- **Behaviour change, deliberate (ruling 2, X20-X21):** a kind change that changes the backend's built `side_options` clears `meta.work`, the way the side's Undo does, and shows "The sides changed with the new kind of work." on the side question until it is answered again. That happens only on a confirmed one-way street, when switching to or from flaggers. Nothing else in the scenario moves, and no deliverable changes for a plan whose side is answered.
- **Source:** `components/bands/WhereQuestions.tsx` (the order, the line, the exported `useSideClearOnKindChange`); `components/GeneratorSidebar.tsx` (calls the hook beside its geometry read, because the card unmounts when the column moves on); `components/BandStack.tsx`, `components/bands/WhereBand.tsx` (pass `sidesChanged` down). Config: `scripts/production-env.txt`, the `NEXT_PUBLIC_MAPBOX_TOKEN` cite `WhereBand.tsx:441` → `444`.
- **Tests that move:** `GeneratorShell.cross-street-tap.test.tsx` (the helper follows the new order; "Question 2 of 3"; a new test for the side asked last with Confirm); `GeneratorShell.where-confirm-card.test.tsx` (the records' order); `WhereBand.side-control.test.tsx` (the side's record is the last one); `WhereBand.no-crossing.test.tsx` (the side is reached through its Next row); `WhereBand.left-side.test.tsx` (+2: cleared and re-asked on a one-way street, kept when the options don't change). Artifact: `evidence/script/walk.mjs` follows the new order and adds the side steps.
- **Byte-identical:** the backend; every deliverable; the scenario the picker Save and the tap write; NEEDS YOU; the WHAT form.
