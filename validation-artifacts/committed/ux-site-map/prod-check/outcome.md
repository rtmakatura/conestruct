# #447 production check on 36c45cc (2026-11-06)

SHIP VERIFIED: `/healthz` sha and the served frontend are both `36c45cc75ff12bbfc52ac0d0f48f2dee318a4697`, which is main HEAD.

Run: `script/walk-prod.mjs` against https://www.conestruct.com/sandbox, 1600 E Colfax Ave, Denver, with the gate token from `.env.local` (never printed or saved), the header sent to the site only. Chromium at DPR 2. Live: geocoding, `/api/road-bearing`, the generate, `/api/needs-you-map` with its Overpass read and Mapbox picture. Changed in the browser, for the last two states only, because they can't be had on demand: see "The two states that were forced". Picture: `walk/`. Numbers: `walk/walk-1440-390.json`.

**Result: PASS at 1440x900 and 390x844 on live data.**

| Check | 1440x900 | 390x844 |
|---|---|---|
| Sidewalk question: live subject | `drawn`, 2,028 ms | `drawn`, 1,965 ms |
| Sidewalk, zoomed in: live subject | `drawn`, 3,217 ms | `drawn`, 1,734 ms |
| Bike lane question: live subject | `drawn`, 2,441 ms | `drawn`, 1,453 ms |
| Intersection question: live subject | `drawn`, 2,816 ms | `drawn`, 1,403 ms |
| Answers moved when the map loaded | 0 px | 0 px |
| Answers moved when the image failed | 0 px | 0 px |
| Frame height, loading and shown | 423, 423 | 270, 270 |
| axe, in the 5 states measured | 0 | 0 |
| Zoom buttons | 44x44 | 44x44 |
| Street-level link | 174.9x44 | 328x44 |
| Horizontal overflow | 0 | 0 |
| Page errors | 0 | 0 |

The frame at 390 is 360x270, the ruled 4:3, with only the zoom on it and the label and link under it. The intersection question draws one ring, on the nearest crossing, at both widths.

## The two states that were forced

Neither is a real production failure. Overpass answered every live request in this check, so a real failed read was not seen.

- **No line (`*-no-line.png`).** The request's flag was changed to `school_zone`, which has nothing at this pin, so the live backend really drew no subject and answered `x-map-subject: none`. That is the header and the picture a failed Overpass read gives, by the code path in `src/api/render_api.py`, but the walk reached it one zoom step out, so its frame is wider than a failed read at the first step would be. What a person sees: the picture and the work, no label, the key without the subject's line, no message.
- **Failed image (`*-failed-image.png`).** The request was answered 502 in the browser. "The map didn't load. Your answer still works without it." holds the frame's space, the zoom and street-level link go, and the answers stay usable.

## The first run

The first run stopped at both widths before any map, and the fault was the walk's. Its wait matched "Save & Close", which is always on the dialog, so it moved on before the road lookup answered: at 390 no road was picked, and at 1440 the form said "No confirmed road at this pin". It now waits for the Colfax candidate, as #446's check did, and the next run passed at both widths. Those two error screenshots were replaced by that run and aren't kept. #446's road-service failures did not recur in the second run; two widths say little about how often they happen.

## Seen, not changed

- **The words don't change when the line is missing.** With no line drawn, the explanation still reads "The map shows an intersection 73.2 ft from the work" right above a picture that doesn't show one. "The map" there means the map data, and no line with no message is the ruled behaviour, but on a failed Overpass read the two sit side by side. For Ryan to weigh.
- **"Along the work zone" and the picture.** The bike lane question asks about a lane "along the work zone", and the line it draws runs up Franklin St, across the work's end. The scan's 58.1 ft is what it counted; the map is what makes this visible, which is the point of #447. The scan's selection wasn't changed by this issue.

## By eye

Opened: `390-01-q1-map`, `390-04-q3-map`, `390-05-no-line`, `390-06-failed-image`, `1440-03-q2-map`, `1440-04-q3-map`. The others weren't opened one by one. The app's sticky bar shows at the top of the 390 crops; that comes from how the walk's element screenshots stitch. `*-02-q1-zoom-in` is named in the JSON and left out to keep the size down. Ryan's browser check is still the visual gate.

## Not done in production

A real failed Overpass read; the interchange and school questions with a drawn line (this pin has neither); following the street-level link; Apply answers, and so the plan, audit and PDF after it (this issue doesn't change them); a saved plan reopened on these questions; real phones, real Safari, a real screen reader.
