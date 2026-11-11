# #517 production check (with #520, #521; mission #518)

Run 2026-11-11 against `https://www.conestruct.com/sandbox`.

- `/healthz` sha: `9bc3ca25e18776e6f4e2f97c36e79f5b4683ad88`, equal to `origin/main`; ship.ps1 reported the served frontend built at `9bc3ca2`.
- Gate token: sent in the `x-conestruct-gate` header only (`scripts/gate.cjs`). A scan of this folder and the extra crops for its first 12 characters found 0 files.
- Run one at a time (concurrent prod walks hit the map read limit, #486).

## 1. The columns check (#520), `logs/cols-prod.log`

`SITE=https://www.conestruct.com STUB_ROAD=0 ONLY=what ZOOMS=1 SIZES=1024x768,1198x930,1440x900,390x844 node scripts/verify-columns-end-together.mjs`

10 states x 4 sizes, 40 readings. Where each column's content ends, two-column grids: max 0 px. Controls under 44 px in 0 readings, axe violations in 0 readings. The WHERE phases it also prints: 0 overlaps, 0 past the band. **RESULT PASS**.

## 2. The walk, `script/walk-517-prod.mjs`, `logs/walk-prod.log`

Copied from `../walk-script/walk517.mjs` with three changes listed in its header (the prod site, a forced 504 on `/api/road-bearing` in the pin flow as in #516's check, round 3's grid selectors). Flows colfax, pin and zero at 1440x900, 1198x930 and 390x844: 54 readings, 45 crops in `crops/`.

| | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| readings | 18 | 18 | 18 |
| axe violations (band) | 0 | 0 | 0 |
| controls under 44 px | 0 | 0 | 0 |
| mono or uppercase in the section | 0 | 0 | 0 |
| Inter loaded | yes | yes | yes |
| box rows when Street class is checked (y before → after) | 407.5 / 490 / 572.5, 0 px | 407.5 / 490 / 572.5, 0 px | 523.38 / 655.88 / 788.38, 0 px |
| 4xx/5xx/page errors | none, except the forced 504 (pin flow) | same | same |

Lines read on prod (1440):

- E Colfax, measured row closed: "Measured from the map / 30 mph · 2 lanes each way · Divided / Not from the map: 12 ft lanes".
- N Lincoln St (one-way), no guess left: "Measured from the map / 30 mph · 4 lanes · One-way / Not from the map: 11 ft lanes · Urban street · Arterial street · Denver". No "each way" (#521).
- Failing point, one guess: "Check this guess / Jurisdiction / ⚠ / Based on where your pin is / Denver"; the road row is titled "About the road".
- Times set: "Start time / Set by you / 9:00 AM" and "End time / Set by you / 3:00 PM" (#521).
- Checked guess: "Street class / ✓ / Checked / Collector", the row unmoved.

## Result: PASS at every size

Not checked here: how the last row looks with its content set about 13 px lower (S24); that is in Ryan's browser check.
