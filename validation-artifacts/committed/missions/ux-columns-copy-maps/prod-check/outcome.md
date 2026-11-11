# Production check: mission ux-columns-copy-maps (#494) on beca76f

Date: 2026-11-10.  `/healthz` sha = `beca76f25fdbb4e537a56b1a70ca8ed40bffd522` = `origin/main`.
Site: https://www.conestruct.com/sandbox, headless Chromium (Playwright), DPR 1, pin 1600 E Colfax Ave, Denver, live road data
(`STUB_ROAD=0`), road "East Colfax Avenue, eastbound".  Read-only: answers picked on the page, Generate pressed, nothing saved, no one
signed in.  Failures were forced only by page routes in the browser (`/api/corridor-map` or `/api/render/corridor-geometry` answered
500), never on the backend.  The gate header went only to www.conestruct.com through `scripts/gate.cjs`; the token was read from the
main checkout's `conestruct/site/.env.local` into the process environment at run time.

| Item | Result |
|---|---|
| #490 the two WHERE columns end together | **PASS on every state reached**: aerial ↔ right column 0 px in 25 states x 6 runs (1024x768, 1198x930, 1440x900; 100% and 200% text) = 150 readings; Your plan's 3 hero cells and the 4 Downloads cards 0 px in 6 runs each.  **6 of the 31 states NOT reached on prod**, see § 1 |
| #490 Mapbox's marks on the frame, no overlap | **PASS**: 0 overlaps in 150 readings (two-column runs) and 25 readings at 390x844 (100% text, attribution under the frame); the Generate outline map placeholder draws the marks in all 7 runs, attribution "© Maxar © Mapbox © OpenStreetMap Improve this map" |
| #490 nothing past the band | **PASS**: 0 text-bearing elements past the band's bottom in 150 readings |
| #491 the two failure lines | **PASS**: byte for byte at 1440x900 and 390x844: "The map didn't load. Edit on map opens the big map at your pin." (class `a-aerial-note tr-note`) and "We couldn't load this road's sides." (`tr-note wq-line`), both Inter 12.5px; page errors 0 |
| #487 cross-street tag on E Colfax unchanged | **PASS**: the intersection question draws Franklin Street dashed with tag "Franklin Street" (Inter 12.5px/600), inside the frame, clear of the zoom buttons and the street-level link; tag box 434,329 / 434,329 / 26,17 (110x30) at 1440 / 1198 / 390, the same as #486's check on fe57324; response header `x-map-cross-street: Franklin Street` |
| Generate CLS, outlines, soft→sharp | **PASS**: `verify-generate-cls.mjs` unmodified, HOLD_MS 0 and 4000: CLS 0 at all three widths both runs, outline check PASS, 0 outlines left, soft→sharp PASS (846x423 / 360x270).  NEEDS YOU +91 / +91 / +53 (3 live questions over the one-question reserve; reported, not failed, as on #486) |
| axe / 44 px / console | **PASS** where the walks run axe: NEEDS YOU's 3 maps x 3 widths soft and sharp, Details closed and open: axe 0, under 44 px 0; console errors 0 and page errors 0 at all three widths.  The columns check runs no axe, so this check has no axe reading for the WHERE band; #486's check (fe57324) has the last one |

## 1. The permanent check (`scripts/verify-columns-end-together.mjs`, unmodified)

`STUB_ROAD=0 SITE=https://www.conestruct.com GATE_BYPASS_TOKEN=... node scripts/verify-columns-end-together.mjs` (default sizes and
zooms), then again with `SIZES=390x844 ZOOMS=1`.  Logs: `logs/verify-columns-end-together.txt`, `logs/verify-columns-end-together-390.txt`;
readings: `columns/readings.json`, `columns-390/readings.json`.

Both runs end `RESULT FAIL` (exit 1), and **no reading failed**.  The FAIL is the line `ERRORS states: locator.click: Timeout 30000ms
exceeded.` in every run, at the same step: after `edit-cancelled`, the Move walk (`move-action-start`, search, `where-edit-done`) cannot pick
the road in the picker headless on live road data.  This is the limit #486's check met at #485 step C, filed as #489.  The states walk
stops there, so these 6 states were **not measured on prod**: `edit-moved`, `edit-done-side-reasked`, `side-answered-after-move`,
`reopened-after-confirm`, `edit-after-confirm`, `cancelled-after-confirm`.  They were measured locally before the ship (report § #490, 31
states, 0 px).  With `STUB_ROAD=0` the long-name and tap variants ran on the live road answer: the walk's road answer was not replaced, so
the "long-name" states here show the live name, not a 3-line one.

## 2. #491 (`script/walk-491-prod.mjs`, log `logs/walk-491-prod.txt`, crops `crops/`)

One fresh context per failure per width; each line read from the DOM after the forced 500.

## 3. #487 and the NEEDS YOU maps (`script/walk-results-prod.mjs`, log `logs/walk-results-prod.txt`, JSON and crops `walk/`)

The #486 production copy, run unchanged with HOLD_MS=4000.  Its #482 line prints `at 14.5 s undefined` because that read needs
HOLD_MS >= 15000; not part of this check.  "Settled gap 30, later 24" is the entry animation #486 § 2 explains.

## Not committed

162 per-state crops from the two-column run and 27 from the 390 run (about 100 MB) were moved, not deleted, to
`validation-artifacts-extra/mission-494/` in the main checkout (untracked).  Four representative crops and every outline-map crop are here.

Token scan of every output from this check (logs, JSON, crops, scripts, the scratchpad runner; 240 files): **0** hits of the token value,
**0** lines naming the gate header.
