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
