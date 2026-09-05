# s2a19 live check — LOCAL
UTC: 2026-09-05T14:54:34.209Z
BASE: http://localhost:3000
healthz (HTTP 200): {"status":"ok","sha":"unknown"}
git rev-parse HEAD: 0b614fa388518e241fb005e41d9e5e7835c6b23c — local mode: the served build is this working tree (next dev + uvicorn at http://127.0.0.1:8765/healthz), not a deploy.

## 1440×1000
**PASS** — [1440x1000] P1 Generate at Lakewood settles with an ok scan and a live breakdown — 477 ms — VERIFIED · 3 plan flags ▸REVIEW FLAGS
**PASS** — [1440x1000] P2 the results-head jump line is inside the post-generate viewport — top 147 bottom 164 of 1000 (scrollY 956) — "Site conditions — 3 detected · correct in setup ↑"
INFO — [1440x1000] the block itself after the landing — top -364 bottom -74 of 1000 (scrollY 956) — above the fold, as measured on ed878cf
**PASS** — [1440x1000] P3 clicking the line brings the block inside the viewport — top 98 bottom 388 of 1000 (scrollY 494)
**PASS** — [1440x1000] P3b focus moved to the block (jumpToAnchor)
**PASS** — [1440x1000] P4 Dismiss opens the picker: four radios in the DOM, no <select>, Confirm disabled — fenced,removed,not_in_work_zone,other
**PASS** — [1440x1000] P5 axe, picker open: zero color-contrast targets in the picker — none
**PASS** — [1440x1000] P5b axe total 0 ≤ baseline 2 — none
**PASS** — [1440x1000] P6 measured: legend and unselected chip ≥ 4.5:1 — legend {"fg":"#c8d1dd","bg":"#14202e","ratio":10.68}; chip {"fg":"#93a0b0","bg":"#14202e","ratio":6.19}
**PASS** — [1440x1000] P7 chosen chip: ✓ glyph + text + :checked, act pair ≥ 4.5:1; Confirm enabled — {"glyph":"✓","text":"Fenced off","checked":true}; chip {"fg":"#34a9e8","bg":"#14202e","ratio":6.26}
**PASS** — [1440x1000] P7b axe, reason chosen: zero picker color-contrast; total ≤ baseline — none
**PASS** — [1440x1000] P8 Other without a note keeps Confirm disabled
**PASS** — [1440x1000] P8b measured: note input ink and placeholder ≥ 4.5:1 — note {"fg":"#ffffff","bg":"#14202e","ratio":16.46}; placeholder {"fg":"#93a0b0","bg":"#14202e","ratio":6.19}
**PASS** — [1440x1000] P8c axe, other + note: zero picker color-contrast; total ≤ baseline — none
**PASS** — [1440x1000] P9 the next audit request carries the dismiss marker (reason other + note) — same wire marker as before — [{"flag":"pedestrian_facility","action":"dismiss","reason":"other","recorded_at":"2026-09-05T14:54:43+00:00","note":"construction fence"}]
**PASS** — [1440x1000] P9b the plan re-generates and the × record shows — 467 ms — VERIFIED · 4 plan flags ▸REVIEW FLAGS
**PASS** — [1440x1000] P10 section 03 rows carry Correct / Assert in setup LINKS, no button in a row — {"correct":3,"assert":2,"buttonsInSignpostRows":0}
**PASS** — [1440x1000] P10b a section 03 signpost brings the block inside the viewport — top 98 bottom 455 of 1000 (scrollY 494)

## 380×800
**PASS** — [380x800] P1 Generate at Lakewood settles with an ok scan and a live breakdown — 480 ms — VERIFIED · 3 plan flags ▸REVIEW FLAGS
**PASS** — [380x800] P2 the results-head jump line is inside the post-generate viewport — top 727 bottom 744 of 800 (scrollY 1080) — "Site conditions — 3 detected · correct in setup ↑"
INFO — [380x800] the block itself after the landing — top -228 bottom 329 of 800 (scrollY 1080)
**PASS** — [380x800] P3 clicking the line brings the block inside the viewport — top 98 bottom 655 of 800 (scrollY 754)
**PASS** — [380x800] P3b focus moved to the block (jumpToAnchor)
**PASS** — [380x800] P4 Dismiss opens the picker: four radios in the DOM, no <select>, Confirm disabled — fenced,removed,not_in_work_zone,other
**PASS** — [380x800] P5 axe, picker open: zero color-contrast targets in the picker — scrollable-region-focusable .gap-8; target-size .strip-edit-all
**PASS** — [380x800] P5b axe total 2 ≤ baseline 2 (named: scrollable-region-focusable, target-size) — scrollable-region-focusable .gap-8; target-size .strip-edit-all
**PASS** — [380x800] P6 measured: legend and unselected chip ≥ 4.5:1 — legend {"fg":"#c8d1dd","bg":"#14202e","ratio":10.68}; chip {"fg":"#93a0b0","bg":"#14202e","ratio":6.19}
**PASS** — [380x800] P7 chosen chip: ✓ glyph + text + :checked, act pair ≥ 4.5:1; Confirm enabled — {"glyph":"✓","text":"Fenced off","checked":true}; chip {"fg":"#34a9e8","bg":"#14202e","ratio":6.26}
**PASS** — [380x800] P7b axe, reason chosen: zero picker color-contrast; total ≤ baseline — scrollable-region-focusable .gap-8; target-size .strip-edit-all
**PASS** — [380x800] P8 Other without a note keeps Confirm disabled
**PASS** — [380x800] P8b measured: note input ink and placeholder ≥ 4.5:1 — note {"fg":"#ffffff","bg":"#14202e","ratio":16.46}; placeholder {"fg":"#93a0b0","bg":"#14202e","ratio":6.19}
**PASS** — [380x800] P8c axe, other + note: zero picker color-contrast; total ≤ baseline — scrollable-region-focusable .gap-8; target-size .strip-edit-all
**PASS** — [380x800] P9 the next audit request carries the dismiss marker (reason other + note) — same wire marker as before — [{"flag":"pedestrian_facility","action":"dismiss","reason":"other","recorded_at":"2026-09-05T14:54:55+00:00","note":"construction fence"}]
**PASS** — [380x800] P9b the plan re-generates and the × record shows — 479 ms — VERIFIED · 4 plan flags ▸REVIEW FLAGS
**PASS** — [380x800] P10 section 03 rows carry Correct / Assert in setup LINKS, no button in a row — {"correct":3,"assert":2,"buttonsInSignpostRows":0}
**PASS** — [380x800] P10b a section 03 signpost brings the block inside the viewport — top 98 bottom 722 of 800 (scrollY 754)

RESULT: ALL PASS 34/34 (+2 INFO)
