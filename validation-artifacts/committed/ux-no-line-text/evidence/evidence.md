# #448 walk evidence (2026-11-08)

Local `next dev` on the issue-448 worktree, local backend through ux-group3's `serve_replay.py` replaying ux-site-map's Overpass fixture (`ux-site-map/evidence/overpass-fixture/`). Mapbox live, through the backend. `/api/road-bearing` stubbed from the recorded fixture. Pin 1600 E Colfax Ave, Denver. Playwright Chromium, DPR 1, 1440x900 then 390x844, one browser at a time. The gate header went only to the site's own origin (`scripts/gate.cjs` `newGatedContext`). Script: `script/walk.mjs`. Every measure: `crops/walk.json`.

All on the first question (sidewalks, 4 devices added). States:
- **loading**: before the picture answers.
- **drawn**: the backend's answer `x-map-subject: drawn`.
- **no line**: a real empty subject, not a rewritten header. The walk asks the backend for the school flag (nothing at this pin) on the sidewalks card at zoom −1; it answered `none`.
- **failed**: a 502 at the browser on zoom +1.

Map requests, both widths (`walk.json` `mapRequests`): sidewalks 0 200 drawn; school −1 200 none; sidewalks +1 502.

## What the walk measured

| Check | 1440 | 390 |
|---|---|---|
| Sentence, loading | "The scan found sidewalks 57.4 ft from the work, so we added 4 devices …" | same |
| Sentence, drawn | "The map shows sidewalks 57.4 ft from the work, so we added 4 devices …" (today's) | same |
| Sentence, no line | "The scan found sidewalks 57.4 ft from the work, but the map couldn't draw them. Check them at street level. We added 4 devices …" | same |
| Sentence, failed | "The scan found sidewalks 57.4 ft from the work, so we added 4 devices …" | same |
| Sentences visible / held hidden, every state | 1 / 2, computed `visibility: hidden` | same |
| Explanation height, all four states | 40.5 px | 81 px |
| Answers' top, all four states (moved) | 771.8 (0 px) | 841.5 (0 px) |
| axe on the card (drawn, no line, failed) | 0 violations | 0 violations |
| Zoom buttons | 44 x 44 | 44 x 44 |
| Street-level link | 174.9 x 44 | 328 x 44 |
| Next question button | 140.9 x 44 | 140.9 x 44 |
| Page scrolls sideways | no | no |
| Page errors | 0 | 0 |

## Crops (`crops/`, DPR 1)

`<width>-01-drawn.png`, `<width>-02-no-line.png`, `<width>-03-failed.png` at 1440 and 390.

## Known limits

- Walked on the sidewalks question only; every kind's three sentences are pinned in `NeedsYouQuestion.test.tsx`, and the intersection's no-line sentence mounted in `NeedsYouMap.test.tsx`.
- Not run on production or a real phone.

No gate token or render secret is saved here. The walk ran on throwaway local values.
