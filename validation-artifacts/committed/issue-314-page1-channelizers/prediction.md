# Rule 5 prediction: `issue-314-page1-channelizers` (#314, R136)

Written 2026-10-12, before any code, off main `8f5e482` plus the checkpoint (`332148c`). Lane: the
renderer (page 1 of the plan sheet) only. Authority: `rulings.md` (R135, R136), `checkpoint.md`.

## Deliberate changes: page 1 only, every shoulder plan

1. **A, step 1:** every `CONE` / `DRUM` box that crosses the road outline is pulled inside it (+0.5
   pt). That's the first taper drum (7 pt) and the last downstream cone (5 pt).
2. **A, step 2, after step 1:** the `ARROW_BOARD` moves upstream (in x) until its box clears every
   channelizer box. It clears 1 drum on the one-way plans and 2 on the divided plan.
3. **B:** the sidewalk band starts at the road edge (`_sidewalk_strip_ft`: `road_edge`, not
   `road_edge - 1.0`). The SIDEWALK label moves 3.5 pt with the band's inner edge.
4. **The direction arrow:** on a two-way or divided plan with that side's sidewalk drawn, it sits 8
   pt beyond the band's outer edge instead of 14 pt beyond the shoulder line. One-way plans keep
   #308's in-lane arrows.

## Not changing, proved at the build

- **Placements** (every station and offset), **the device breakdown, the XLSX, the crew sheet (markdown
  and PDF) and the audit (JSON and PDF):** byte-identical to main, diffed as for #312.
- **Other kinds' page 1:** only glyphs that cross the road outline move. Lane-closure tapers end
  inside the outline, which the build checks.

## Predicted churn

| Area | Rough count |
|---|---|
| `test_r94_one_way_page1.py` (the band, the barricades on it) | 0–2 |
| Other existing tests | 0 |
| New tests: the four plans × sidewalk on/off for the boxes, the board, the band and the arrows; the identity check | ~12 |

## Outcome (after the build, `9f3ecd6`)

| Predicted | Actual |
|---|---|
| `test_r94_one_way_page1.py`: 0–2 | **0.** The barricades and R9-9 stay on the band |
| Other existing tests: 0 | **0.** Backend 2748 → 2759 passed (2 skipped) |
| New: ~12 | **11** (`tests/test_page1_channelizers.py`). The identity check is a probe diffed against main, not a test |
| Byte-identical except page 1 | **Proved against main:** `probes/identity_main.txt` vs `identity_branch.txt`, **58 digests identical**. They cover the placements, audit JSON, crew markdown, device breakdown, XLSX cells, audit PDF text and crew PDF text for the four plans with and without a sidewalk, plus page-1 device positions for the flagger and near-intersection plans (other kinds' page 1 doesn't move) |
| **Not predicted** | **The divided plan's taper starts at the plan's left edge.** Sliding the arrow board upstream put it over the plan frame onto the margin, which the first after-crops showed. The board now slides downstream when upstream would leave the plan area, and the acceptance test asserts the board's box stays inside `PLAN_LEFT..PLAN_RIGHT` |

**Evidence:** `before/` and `after/`, 16 crops each: four plans × with and without a sidewalk ×
(taper start, downstream taper). `probes/page1_probe.txt` is before and `page1_probe_after.txt` is
after.

- **Before:**
  - with a sidewalk, the first taper drum is 10.5 pt and the last downstream cone 8.5 pt on the band,
    and the second drum 1.2–1.8 pt;
  - the arrow board overlaps 1 drum (one-way plans) or 2 (divided);
  - the two-way and divided direction arrows sit on the band.
- **After, all 8 cases:** every cone and drum box is inside the road outline and off the band, no
  board overlaps, and no arrow sits on a band.
- **Seen on the divided taper-start crop, outside #314's scope:** the board now ends about 4 pt short of
  sign ②'s marker, and the signs at that taper start (①, ③) overlap the drums and the band as they did
  before (sign layout, not channelizers).
