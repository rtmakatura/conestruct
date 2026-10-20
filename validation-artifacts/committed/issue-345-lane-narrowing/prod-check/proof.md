# #345 production check of f7e4d48 — PASS 2/2

Run 2026-10-19 against www.conestruct.com (through the site proxy). healthz =
`f7e4d480f341351824223dd4027297f1544bde9e` (`healthz.txt`); the frontend was
built and served at f7e4d48.

## 1. The form keeps the road's count (`browser345.cjs`, `form-result.json`)
/sandbox, pin 39.68539, -104.96427, way 37927445 (South Valley Highway
southeast, freeway), shoulder work, south side · eastbound. The form prefilled
4 lanes x 10.5 ft. The audit requests, in order:

| lanes | width | roadLanesPerDirection | status | lanes_drawn_below_road |
|---|---|---|---|---|
| 4 | 10.5 | 4 | 400 (#335 refusal: at 11 ft the sheet draws at most 3) | — |
| 3 | 10.5 | 4 | 400 (11 ft freeway minimum) | — |
| 3 | 11 | 4 | 200 | the freeway-minimum note |

Before #345 the second and third requests carried no `roadLanesPerDirection`.
Note returned: "Drawn as 3 lanes per direction; the road has 4. Freeway lanes
must be at least 11 ft (CDOT S-630-1 Sheet 7 Case 11), and at that width 4 lanes
and the 10 ft shoulder overrun the 52 ft half-road this plan can draw, so the
device offsets are measured against 3 lanes." Screenshots: `form-before.png`,
`form-after.png`.

## 2. Every surface, plus controls (`prodcheck345.py`, `replay.txt`)
#341's recorded I-25 run (`audit-shoulder/runs/i25-r-65-night-3lanes`) through
prod /render/audit, /render/markdown and /render/pdf page 1:

- I-25 3 x 11, road 4 (#345 repro): freeway-minimum note on all three. PASS
- I-25 3 x 12, road 4 (recorded run): same note. PASS
- Rural divided 3 x 11, road 4: #341's "(entered)" sentence unchanged. PASS
- Rural divided 4 x 10.5, road 5: #310's "at most 4 lanes" sentence unchanged. PASS

No page 1 says "SHEET'S". Page images: `page1-case1..4.png`.
