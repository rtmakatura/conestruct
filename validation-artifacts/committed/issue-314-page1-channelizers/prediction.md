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
