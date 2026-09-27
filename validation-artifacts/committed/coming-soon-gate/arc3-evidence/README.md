# Arc 3 evidence — the full page at `/` and the 404

## `fhwa-kno-history.htm` — the 1935 claim (R17, Rule 10/12)
FHWA, *The Evolution of MUTCD* (https://mutcd.fhwa.dot.gov/kno-history.htm, "Updated December 2023 for the Eleventh Edition"), saved 2026-09-27. The lines the founders' note rests on:
- "In 1935, the first MUTCD was published."
- "On November 7, 1935, the first edition of MUTCD was approved as a National standard by the American Standards Institute."
- The predecessors were narrower: the 1927 AASHO manual "addressed only use and design for signs on rural roads", and the 1930 NCSHS manual covered urban devices.

Verdict and the other checks (the map, 02, 03, the road): `checkpoint-arc3.md` §3.

## `local-545ece6/` — browser leg, local **dev** server, commit `545ece6`
`AUDIT_OUT=<dir> node measure.cjs http://localhost:3100` (`next dev`, 2026-09-27), at 1440×900, 1024×800, 768×900, 390×844 and 380×800.

| Check | Result |
|---|---|
| Sideways scroll | none on `/` or `/404` at any width |
| axe WCAG 2.2 AA + best practice | 0 violations on `/` and `/404` at every width |
| Targets | none under 32 px at desktop; none under 44 px (both dimensions) at 390 / 380 |
| Contrast (reading text) | lowest pair 5.92:1: the road's stretch words, `--ink-on-dark` at the ruled 70 % (`#929ca9` on `#14202e`); then 6.00 (faint on the nav/footer). Nothing below AA on either page |
| Contrast (the road's "ahead" copy) | 12 / 13 texts rendered at 0.7 × 0.18 opacity: R13's faint road below the highlight that "fades to transparent", drawn under the lit copy. Counted, not scored |
| SVG text | 10 and 10.5 px only (the type roles), on both pages |
| R13 road | shown at 1440 / 1024, not at 768 / 390 / 380. 01's header at 120 px in the column, its milepost at 114 (6 above), the road from 74 |
| R13 highlight | follows the scroll, e.g. 1440: 14 → 545 → 1075 → 1605 → 2136 → 2665 → **3019 of 3019 at scrollY 3349 of 3349** (the bottom of the page); the fade gone (y1 3020) at the end |
| R13 easing | one frame after a jump from the top to the bottom, the highlight is part-way (1440: 1756 of 3019), then settles exactly on the end |
| R14 marker | hidden before 01; then MILEPOST 01 advance warning → 02 taper → 03 buffer → 04 work zone → CO downstream; never below 980 |
| P1 | no box (sheet, sections, headers, close band, stacks and their texts) moved while scrolling top → bottom or while a stack fanned |
| R15 fan | hover: `is-fanned`, the top sheet at `translate(26px, -6px) rotate(7deg)`, transition 0.25 s |
| Reduced motion | road fully drawn at first paint (reveal = the road's height, no fade), no transition on the fan (0 s); the marker still follows the scroll: MILEPOST 03 buffer at mid-page (A3-Q3) |
| R19 `/404` | status 404, "This road is closed.", the one primary to `/` |
| A3-Q2 | `/no-such-page` anonymous: 307 → `/` at every width |
| Page errors | none |

Screenshots:
- `home-<w>-first-screen.png` and `home-<w>-full.png`. The full page is taken under reduced motion, so the road shows fully drawn. Arc 2's caveat still applies: a full-page capture during the hero's load animation can freeze it at its first frames on the dev server.
- `full-1440-scrolled-45.png` / `-100.png`: the road part-lit with the marker, and fully lit at the bottom.
- `full-1440-02-fanned.png`.
- `404-<w>.png`.

Found and fixed by this leg: at `793d1a9`, 01's top margin collapsed through the road's column, so the marker read "01" while the highlight was still at 0 (fix `545ece6`, pinned by `lib/design/coming-soon-css.test.ts`).

## Owed after the ship (Ryan's go)
- `/healthz` sha == HEAD and the served bundle polled before the frontend leg.
- `AUDIT_OUT=<dir> node measure.cjs https://www.conestruct.com`: the same table on prod, which also stands in for the production-build measurement (none was run locally).
- Anonymous sweep: R1.2's set plus `/404` (A3-Q2) answers; every other path goes to `/`.
