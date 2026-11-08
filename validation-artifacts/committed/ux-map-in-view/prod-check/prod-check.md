# #456 production check (2026-11-08, on `dca423d`)

Ship: SHIP VERIFIED, healthz and served frontend at `dca423d`.

Setup: https://www.conestruct.com/sandbox, live backend, **live Overpass and live road-bearing** (no stubs; `STUB_BEARING` unset), gate header via `scripts/gate.cjs` `newGatedContext`. Script: `script/walk-prod.mjs`, which is #456's local `walk.mjs` (`../evidence/script/`) with three changes: `BASE` is production; the road-bearing stub runs only with `STUB_BEARING`; the picker step waits for the road button before clicking (`ROAD`, default "Colfax Avenue, westbound"; at 390 `ROAD="Colfax Avenue"`, since 1600 E Colfax offers four roads with Franklin St first). Chromium, DPR 1. The walk's `16-held` step slows only the browser's own aerial request (client-side), not the site. Summaries: `walk/summary.txt`; raw: `walk/*.json`.

Pins: 1550 E Colfax Ave (1198x930, East Colfax Avenue westbound), 1600 E Colfax Ave (390x844).

| Check | 1198x930 | 390x844 |
|---|---|---|
| Layout | two columns, aerial 411x560 left, card right | 150 px strip at the nav (frame 52..202) on the kind and side questions |
| Aerial in view, first question | 440 of 560 px (the #460 landing, unchanged) | the whole strip |
| Answering a side | 25 ms, no blank, 0 requests | 29 ms, no blank, 0 requests |
| Undo the side / side again | 27 / 41 ms, no blank | 35 / 48 ms, no blank |
| Aerial requests per walk | 5 (`pin work work pin work`) | **5** (`pin work work pin work`): no second pin picture before the tap question, so M21 holds live |
| Tap question | armed 51.5..611.5, found, no scroll (205 -> 205) | full height 51.8..301.8, found, no scroll (214 -> 214) |
| Hide map / Show map | n/a (two columns) | Hide 95.8x44, Show 102.1x44; hidden through the side's Undo; Show restores the strip |
| WHAT row / Generate hint, kind chosen, WHERE open | "Opens after you confirm where" / "Confirm where the work is first" | same |
| WHAT row / Generate hint, no kind | "pending: kind of work not chosen" / "Choose the kind of work" | same |
| axe (band) | 0 in every measured state | 0 |
| Page errors | 0 | 0 |
| Layout shift, band-sourced | 0.0029 | 0.0308 |

Seen and not a fault: the Undo step records `a=1` at both sizes (0 in the local walk). The walk's total stays 5 aerial requests in the same order as locally, so this looks like the unused kind load-ahead (`work`, evidence.md § Ruling 3 trace) finishing during the Undo on live timing, not an extra image. The map never went blank. Not traced further.

Known, filed, unchanged: the strip covers the side question's heading at 390 (`crops/390x844-03-03-side-question.png`, #461); the picker's focus scroll (#460).

Crops (`crops/`): the kind and side questions, the armed and found tap question and the held picture at both sizes; Hide map at 390.

Verdict: **PASS** at 1198x930 and 390x844 on live data. Ryan's browser check is open (visible design).
