# #384 checkpoint: a plain address search answers outside Colorado

*2026-10-23. Branch `issue-384-address-colorado`, on `issue-376-prod-check` (`13cf54d`, #376's production-check evidence, which ships with this fix).*

## Why this stops (R145: low confidence, a reading of R1 that turns away working searches)
The issue proposed #376's rule unchanged: only a full match (`relevance` 1) inside Colorado is the answer. The live probe (`probe.txt` beside this file) shows Mapbox scores real Colorado addresses below 1:

| Search | Colorado box answer | relevance | Today |
|---|---|---|---|
| `1 Main St, Longmont, CO 80501` | 1 South Main Street, Longmont | 0.93 | correct |
| `1437 Banock St, Denver` (typo) | 1437 Bannock Street, Denver | 0.99 | correct |
| `100 Main St, Lafayette, CO` | 100 Main Street, **Broomfield** | 0.96 | Wisconsin |
| `100 Main St, Lafayette` | 100 Main Street, Broomfield | 0.81 | Indiana |

A full-match-only rule refuses the first two, which work today. Accepting any answer in the box takes the last two to Broomfield: still in Colorado, but not the city typed. Relevance alone can't separate them.

## Options
**A. #376's rule as written (relevance 1).** Longmont and the Bannock typo would read "check the spelling". No wrong answers, but searches that work today would stop working.

**B. Accept the box's answer unless Mapbox matches better outside Colorado.** Longmont and Bannock work. Out-of-state searches answer 422. But "100 Main St, Lafayette, CO" lands in Broomfield, the wrong city, and nothing says so (Rule 10).

**C. (Recommended) B, plus: a partial match must lie in a city the operator typed.**
1. Box answer with relevance 1 → the answer (one request, as now).
2. Otherwise, look up Mapbox's best answer with no box. If that answer is outside Colorado and matches better → 422 "outside colorado" ("Plans cover Colorado roads only.").
3. Otherwise, if the box answer's city (Mapbox `context` place) is a word in the typed text → the answer.
4. Otherwise → 404. It reads "No match in Colorado for that address. Check the spelling." That's a new reason, `check address`, worded like #376's city line.

How C answers the probe:

| Search | C |
|---|---|
| `100 Main St, Lafayette` | 422 (Indiana 1.0 beats Broomfield 0.81) |
| `100 Main St, Lafayette, CO` | 404 check address (Broomfield isn't Lafayette) |
| `100 Main St, Aurora` | 422 (Indiana 1.0 beats Aurora, CO 0.87) |
| `1 Main St, Longmont, CO 80501` | Longmont, as today |
| `1437 Banock St, Denver` | Denver, as today |
| `1437 Bannock St, Denver, CO` / `200 S Public Rd, Lafayette` / `2000 E Colfax Ave` | as today (box 1.0) |
| `1600 Pennsylvania Ave, Washington, DC` / `350 5th Ave, New York, NY` | 422 |

A trailing `CO` is spelled out as `Colorado` in both lookups, the way the cross-street path does.

Weak spot: "100 Main St, Aurora" answers "Plans cover Colorado roads only." Aurora is in Colorado, but Mapbox's Colorado answer there is a street with no number (S Main St). The cross-street path in #376 answers the same way. It refuses, and it never shows a wrong pin.

## Rule 5 prediction (option C)
- `lib/geocode.ts`: the plain-address branch (and `MapboxFeature` gains `context`). Cross-street code byte-identical.
- `lib/geocode-precision.ts`: one line for 404 `check address`.
- `lib/geocode.test.ts:74-85`: the pinned URL changes on purpose (gains `&bbox=`). New stub cases for steps 1–4.
- `lib/geocode.live.test.ts`: the issue's rows added; the cross-street rows unchanged.
- `scripts/production-env.txt`: the `MAPBOX_TOKEN` cite line moves only if `geocode.ts:210` shifts. Under C it doesn't, because the edit is below that line.
- Backend: nothing.
