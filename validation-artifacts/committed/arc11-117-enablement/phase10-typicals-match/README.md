# Arc 11 phase 10 — Case 18 typicals-match evidence (Refs #117)

The amended Rule-8 enablement bar (ruled 2026-07-27): generated
`near_intersection` output matches the published intersection typicals.
Run 2026-08-04 on branch `issue-117-enablement`.

## Sources and provenance

- **Extraction source**: `validation-artifacts/s630-1-2026.pdf`, Sheet
  10 = PDF p. 158 — the **July 2026 26-sheet edition only** (title
  block "Standard Sheet No. 10 of 26", Last Modification 07/01/26,
  issued July 01, 2026 — visible in `sheet10-full.png`).  No
  19-sheet-era artifact was used as a source; the spike's plate zoom
  (`validation-artifacts/intersections-spike/s630_case18_zoom.png`)
  served as a cross-check only (Case 18's plate was verified identical
  across editions 2026-07-09).
- **Renders committed here**: `sheet10-full.png` (3× render of the
  whole sheet), `sheet10-TL.png` (Case 18's vertical feeding train),
  `sheet10-BL.png` (Case 18's horizontal train, caption, Notes, and
  the opposing-set dims).  These are the images the extraction was
  read from.
- **Fixture**: `tests/fixtures/cdot_s630_typicals/case_18.json` —
  every value carries a named sheet region (`extraction_provenance`
  key + per-value `provenance` fields).
- **Match rules**: `tests/fixtures/cdot_s630_typicals/match_rules.md`,
  section "Case 18 (near_intersection)" — the tool↔plate mapping and
  the three documented departures.

## Match run — 9/9 PASS (`match-run.txt`, verbatim pytest -v output)

| Assertion | Category | Result |
|---|---|---|
| Mainline train sign sequence W20-1 → R2-10 → W20-5(R) → W4-2(R), outermost-first | MATCH (plate feeding train) | PASS |
| Mainline gaps = rural key C/B/A (500/500/500); R2-10 at ½C inside W20-1; W4-2(R) at A from taper start | MATCH (key + ½C, horizontal-train reading) | PASS |
| Merging taper span = legend formula L = S×W (540 ft at 45 mph × 12 ft) | MATCH (legend formula) | PASS |
| Cross-leg stations = the plate's DRAWN dims verbatim (R2-10 at 500′, W20-1 at 1,000′, R2-11 at 100′ departure) on a rural leg | MATCH (drawn dims — no key scaling in between) | PASS |
| Urban ≤40 cross leg substitutes A=100 per the key + Sheet 10 Note 1 | MATCH (key substitution; Documented Departure 3 disclosed) | PASS |
| No second closure train on the cross street; no opposing-mainline signs; audit narrative names the corner-quadrant delta + #128 | DOCUMENTED DEPARTURES 1 & 2 (disclosed, not emitted) | PASS |
| Far side: continuous channelizers taper→upstream curb and downstream curb→work zone, box empty, no R3-7 turn-bay signs | MATCH (Fig. 6P-22 note-7 shape — the plate has no far-side drawing; MUTCD target per match_rules) | PASS |
| Far side: merging taper fully upstream of the intersection | MATCH (§6N.12.12 companion) | PASS |
| Audit cites "Case 18" + "Sheet 10 … 18/19" | MATCH (citation surface) | PASS |

Zero BUG, zero FIXTURE_GAP (the Phase-4 findings taxonomy); the three
deltas are the disclosed departures, asserted as disclosed-not-emitted.

## Known upstream discrepancy (recorded, not corrected)

Sheet 10's legend maps VARIES → "Buffer Space (see General Note 23 on
Sheet 2)" and CZ → "General Note 17"; the actual Sheet-2 buffer note is
24 (S-630-1's own legend error, standing memory note).  The fixture
records this and nothing in the tool was "corrected" to match.

## Tolerance

The harness's standing ±10 ft for computed stations
(`tests/s630/_harness.py::assert_within`); key lookups exact.  No new
chosen values.
