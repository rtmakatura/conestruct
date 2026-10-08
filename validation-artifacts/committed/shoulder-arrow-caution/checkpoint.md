# shoulder-arrow-caution — issue draft, build plan and Rule 5 prediction (written before any product code)

**Base:** `aa6dcaa`. Rulings: `rulings.md` (R119 Q1). The investigation is the #300 build checkpoint (`issue-300-left-side-oneway/checkpoint.md`, "Build checkpoint for A", item 4). R119 Q1 orders the build, so this file is the plan and the prediction, not a stop.
**Evidence before the diff:** `probes/capture.py before` on `aa6dcaa` → `probes/before/` (summary + page 1 of two live shoulder plans).

## 1. Issue draft (for the chat to repost)

```
Title: Shoulder plans show the arrow board as a right arrow; MUTCD and S-630-1 allow caution mode only for shoulder work
Labels: bug, priority-high, mutcd-compliance, backend, pdf-rendering, layout-engine

## Problem

Every live shoulder plan places its arrow board in arrow mode. Both shoulder generators emit `label="RIGHT_ARROW"` (`layout.py:381` divided, `:746` undivided). Page 1 draws it as a right arrow (`plan_sheet.py:1690-1691`, `_draw_arrow_board` `:868-896`), the legend sample is a right arrow, and the crew sheet tells the crew:

> 1. Position arrow board at the upstream start of the shoulder taper (station 1,240 ft). Set to RIGHT ARROW mode (for right shoulder closure). Activate flashing.

The standards forbid that mode for shoulder work:

- MUTCD 11th Ed. §6L.06 ¶18 (Standard), p. 833: "For shoulder work, for blocking the shoulder, for roadside work near the shoulder, or for temporarily closing one lane on a two-lane, two-way roadway, an arrow board shall be used only in the caution mode."
- §6L.06 ¶17 (Standard), p. 833: "An arrow board in the arrow or chevron mode shall be used only for stationary or moving lane closures on multi-lane roadways."
- CDOT S-630-1 Sheet 2, General Note 26: "If arrow boards are used for shoulder work, blocking the shoulder, for roadside work near the shoulder, or for temporarily closing one lane on a two-lane, two-wayroadway, use the arrow boards only in the caution mode."

Also §6N.06 ¶09 (Standard), p. 845, and TA-4 Note 8 (Standard), p. 866. Neither generator cites a source for the mode; the divided generator's comment (`layout.py:373-375`) says "caution/right-shift indication" and emits an arrow. Behavior-changing fix; today's output is wrong on every shoulder PDF and crew sheet in production.

## Reproduction

1. Plan N Broadway SB (39.73370, -104.98753), Shoulder work, Utility locate, right side.
2. Generate. Page 1 draws the board at the taper start as a black right arrow on yellow; the legend's first row is a right arrow, "Arrow Board".
3. Download the crew sheet. Step 1 reads "Set to RIGHT ARROW mode (for right shoulder closure)."

Expected: the board in caution mode (Flashing Caution, MUTCD Fig 6L-3, p. 834) on page 1, in the legend, and in the crew sheet's words. Same on a divided shoulder plan (the divided generator).

## Impact

- A crew that follows the sheet runs a board in a mode the MUTCD forbids, telling drivers to merge out of a lane that isn't closed.
- A reviewer comparing the sheet to S-630-1 Note 26 finds the plan non-compliant on its face.
- It blocks #300: left-shoulder plans would otherwise mirror the violation into `LEFT_ARROW` (R119 Q1).

## Proposed solution

- Both shoulder generators emit the board as `label="CAUTION"`, the label the mobile generator already uses (`layout.py:2357`), with the §6L.06 ¶18 / Note 26 citation beside it. Position and count unchanged.
- Page 1 draws a `CAUTION` board as the Flashing Caution display (a lamp in each corner, Fig 6L-3). The legend row follows the plan: when every board is in caution mode, its sample is the caution display and it reads "Arrow Board (caution mode)".
- The crew sheet's shoulder step 1 says caution mode and cites both sources.

## Acceptance

- No shoulder plan (divided or undivided) emits `RIGHT_ARROW`; each emits one `ARROW_BOARD` labelled `CAUTION` at today's station and offset.
- Page 1 of a shoulder plan draws no arrow glyph for the board; the legend row reads "Arrow Board (caution mode)".
- The crew sheet's step 1 on a shoulder plan contains "caution mode" and no "RIGHT ARROW".
- Near-intersection and every other kind: byte-identical output (their boards are lane-closure arrows, which ¶17 allows).

## Reference

- `src/generation/layout.py:373-383, 740-748, 2357`
- `src/rendering/plan_sheet.py:868-896, 1690-1691, 2536-2551`
- `src/narrative/templates/base.md.j2:43`
- MUTCD 11th Ed. §6L.06 ¶17-18 (p. 833), Fig 6L-3 (p. 834), §6N.06 ¶09 (p. 845), TA-4 Note 8 (p. 866); CDOT S-630-1 Sheet 2 General Note 26. Pages committed under `validation-artifacts/committed/shoulder-arrow-caution/sources/`.
- Found in the #300 build checkpoint (`d2437f0`); split out by R119 Q1. Refs #300.
- Priority-high. Live on every shoulder plan; blocks #300.
```

## 2. Build plan

| Where | Change |
|---|---|
| `src/generation/layout.py:373-383` (divided) and `:740-748` (undivided) | `label="RIGHT_ARROW"` → `label="CAUTION"`; the comment cites §6L.06 ¶18 (p. 833) and S-630-1 Note 26. Station and offset untouched |
| `src/rendering/plan_sheet.py:868-896` `_draw_arrow_board` | `direction` gains `"caution"`: the same panel, four corner lamps (Fig 6L-3 "Flashing Caution"), no arrow |
| `plan_sheet.py:1690-1691` | `"CAUTION"` → `"caution"`; `LEFT_ARROW` → left; anything else → right (today's fallback, unchanged) |
| `plan_sheet.py:2536-2551` (legend `_device_row`) | For `ARROW_BOARD`: when the plan has boards and every one is `CAUTION`, draw the caution sample and the label "Arrow Board (caution mode)". Otherwise today's row |
| `src/narrative/templates/base.md.j2:43` | The shoulder branch's mode sentence (below). Only shoulder plans reach this text change: the branch is narrowed to `closure_type == "shoulder"`, and every other kind keeps today's sentence word for word |
| `tests/test_rules.py:2010` | Comment only: the example synthetic labels become `CAUTION, WORK_TRUCK, SHADOW_TMA` |

The crew sheet's new step 1 for shoulder plans (unslop rules; no em dashes):

> 1. Position arrow board at the upstream start of the shoulder taper (station 1,240 ft). Set it to caution mode (flashing caution or alternating diamond). Shoulder work takes caution mode only, never an arrow (MUTCD 11th Ed. §6L.06 ¶18, p. 833; CDOT S-630-1 Sheet 2 General Note 26). Activate flashing.

**Kept out of scope (recorded, not changed):**
- The gated kinds that also reach this template's last branch (`lane_closure_divided`, mobile, off-road) print the shoulder sentence today, which is wrong for them ("RIGHT ARROW mode (for right shoulder closure)" on a lane closure whose generator places `LEFT_ARROW`). They're gated (Rule 8), so their crew sheets are fixed at enablement. Narrowing the branch leaves their text byte-identical.
- The device-function column says "Lane closure indication" for every arrow board (`render_api.py:1519`), shoulder plans included. Changing it would move six tiering fixtures. It's a separate wording item.
- The legend sample on lane-closure plans is a right arrow while the plan draws a left arrow (near-intersection). Pre-existing; not a shoulder board.

## 3. Rule 5: the churn prediction (before the diff)

**Behavior changes, deliberate and stated:**
1. Every shoulder plan (divided and undivided generators): the board's label `RIGHT_ARROW` → `CAUTION`. Device counts, stations and offsets unchanged.
2. Page 1 of every shoulder plan: the board draws as the caution display; the legend row reads "Arrow Board (caution mode)" with the caution sample.
3. Every shoulder crew sheet: step 1's mode sentence (above).
4. **The gated mobile two-lane plan's page 1:** its board is already labelled `CAUTION` (`layout.py:2357`) but draws as a right arrow today, because the glyph picker falls through to right. It now draws the caution display, and since its only board is `CAUTION`, its legend row reads "Arrow Board (caution mode)". This is a gated kind (not served in prod); stated here because the glyph change reaches it.

**Assertions predicted to change:** none. No test asserts `RIGHT_ARROW`, the arrow glyph's direction, the legend row text "Arrow Board", or the shoulder crew-sheet sentence (searched `tests/` for `RIGHT_ARROW`, `RIGHT ARROW`, `ARROW mode`, `Activate flashing`, `_draw_arrow_board`). `tests/test_plan_sheet_grayscale.py` calls `_draw_arrow_board` with the default direction and checks the panel reads light; unchanged.

**Recorded baselines predicted unchanged:**
- The 90 files under `tests/snapshots/`: audit JSON only. No arrow-board label, glyph or crew-sheet text in them (`grep RIGHT_ARROW tests/` finds only the `test_rules.py` comment).
- The tiering fixtures: they carry the device row ("Arrow Board", "Lane closure indication"), not the label. Unchanged.
- The 12 `pdf_worst_case` fixtures under `tests/test_pdf_containment.py`: the board glyph draws no words. The legend row gains " (caution mode)" on the 10 shoulder fixtures (`adv-shoulder`, `control-typical` and the eight `scanned-*`; `adv-flagger` and `adv-near-intersection` are not shoulder). That's 4 more words in a row that already truncates at the box edge (`_truncate_to_width`), so edge / box-cross / collision counts are predicted unchanged. **This is the riskiest row**; if any count moves, it's recorded as a miss before the commit.
- The S-630 typicals and `tests/s630`: no arrow label assertions found. Predicted unchanged.

**New tests (Rule 11):**
- **Payload:** both shoulder generators through `scenario_to_call` (Broadway one-way and a divided shoulder): exactly one `ARROW_BOARD`, labelled `CAUTION`, at the same station and offset as before; no `RIGHT_ARROW` anywhere in the plan.
- **Rendered output:** a shoulder `/render/pdf` page 1 has "Arrow Board (caution mode)" in its text, and its board glyph is the caution display (`_draw_arrow_board(..., "caution")` draws four lamps and no arrow path, recorded on a canvas spy). A near-intersection PDF's legend row still reads "Arrow Board".
- **Crew sheet:** a shoulder `/render/markdown` step 1 contains "caution mode" and "§6L.06 ¶18" and no "RIGHT ARROW". A near-intersection one still says "LEFT ARROW mode".
