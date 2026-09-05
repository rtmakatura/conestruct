# s2a19 live check — PRODUCTION
UTC: 2026-09-05T15:37:21.191Z
BASE: https://www.conestruct.com
healthz (HTTP 200): {"status":"ok","sha":"0af99de198dc8d71bacec22342365e1a40dcbace"}
git rev-parse origin/main: 0af99de198dc8d71bacec22342365e1a40dcbace
**PASS** — GATE — healthz sha == origin/main — 0af99de198dc8d71bacec22342365e1a40dcbace vs 0af99de198dc8d71bacec22342365e1a40dcbace

## 1440×1000
**PASS** — [1440x1000] P1 Generate at Lakewood settles with an ok scan and a live breakdown — 4835 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
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
**PASS** — [1440x1000] P9 the next audit request carries the dismiss marker (reason other + note) — same wire marker as before — [{"flag":"pedestrian_facility","action":"dismiss","reason":"other","recorded_at":"2026-09-05T15:37:46+00:00","note":"construction fence"}]
**PASS** — [1440x1000] P9b the plan re-generates and the × record shows — 1412 ms — VERIFIED · 3 plan flags ▸REVIEW FLAGS
**PASS** — [1440x1000] P10 section 03 rows carry Correct / Assert in setup LINKS, no button in a row — {"correct":3,"assert":2,"buttonsInSignpostRows":0}
**PASS** — [1440x1000] P10b a section 03 signpost brings the block inside the viewport — top 98 bottom 455 of 1000 (scrollY 494)

## 380×800
**PASS** — [380x800] P1 Generate at Lakewood settles with an ok scan and a live breakdown — 6243 ms — VERIFIED · 2 plan flags ▸REVIEW FLAGS
**PASS** — [380x800] P2 the results-head jump line is inside the post-generate viewport — top 159 bottom 176 of 800 (scrollY 1648) — "Site conditions — 3 detected · correct in setup ↑"
INFO — [380x800] the block itself after the landing — top -796 bottom -239 of 800 (scrollY 1648) — above the fold, as measured on ed878cf
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
**PASS** — [380x800] P9 the next audit request carries the dismiss marker (reason other + note) — same wire marker as before — [{"flag":"pedestrian_facility","action":"dismiss","reason":"other","recorded_at":"2026-09-05T15:38:15+00:00","note":"construction fence"}]
**PASS** — [380x800] P9b the plan re-generates and the × record shows — 1087 ms — VERIFIED · 3 plan flags ▸REVIEW FLAGS
**PASS** — [380x800] P10 section 03 rows carry Correct / Assert in setup LINKS, no button in a row — {"correct":3,"assert":2,"buttonsInSignpostRows":0}
**PASS** — [380x800] P10b a section 03 signpost brings the block inside the viewport — top 97 bottom 721 of 800 (scrollY 755)

RESULT: ALL PASS 35/35 (+2 INFO)
