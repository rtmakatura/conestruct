# #447 walk evidence (2026-11-06, re-cropped after Ryan's phone fix round; every measure and crop is from the final code)

Local `next dev` on the issue-447 worktree, local backend through ux-group3's `serve_replay.py`. Overpass was asked live once per query and replayed after that (`overpass-fixture/`: the seeded ux-group3 answers plus what this walk recorded). Mapbox was live, through the backend. `/api/road-bearing` was stubbed from the recorded fixture. The pin is 1600 E Colfax Ave, Denver. Playwright Chromium, DPR 2, 1440x900 and 390x844.

Script: `script/walk.mjs`. Every measure: `crops/walk.json`. Red proof: `red-proof.md`.

## What the walk measured

| Ruling | Check | 1440 | 390 |
|---|---|---|---|
| 1, phone round | Frame size: 2:1 from 480 px up, 4:3 below | 846 x 423 | 360 x 270 |
| Phone round | On the map | zoom, label, link | zoom only |
| Phone round | Under the map, in a held 84 px space | nothing (0 px) | label, link |
| 1, 8 | Zoom buttons | 44 x 44 | 44 x 44 |
| 5, 8 | Street-level link | 174.9 x 44 | 328 x 44 |
| 7 | Answers moved when the image loaded | 0 px | 0 px |
| 7 | Answers moved when the image failed | 0 px | 0 px |
| 7 | Frame and key height, before and after both | 423 / 18.8 | 270 / 72.3 |
| 8 | axe on the card, in the 5 states run (3 questions, no geometry, failed) | 0 violations | 0 violations |
| 6 | Page scrolls sideways | no | no |
| 5 | Link | `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=39.739905,-104.968361`, `target=_blank` | same |

Requests, both widths, flag / zoom step / HTTP / subject: sidewalks 0 200 drawn; sidewalks 1 200 drawn; bike lane 0 200 drawn; intersection 0 200 drawn; school −1 200 none (below); intersection 1 502 (forced). Answering asked for nothing.

## The crops

Named `<width>-<step>-<state>.png` in `crops/`, 10 committed: `01-q1-map` sidewalks, `03-q2-map` bike lane, `04-q3-map` crossing, `05-no-geometry`, `06-failed-image`, at each width. `02-q1-zoom-in` is named in `walk.json` and was left out at first to keep the size down; it was committed on `issue-447-prod-check` on 2026-11-07 (about 1.5 MB together) so the ship's cleanup can remove the issue-447 worktree. The zoom measure is in the JSON.

- **No geometry is real, not a rewritten header.** The walk asks the backend for a flag with nothing counted at this pin (no school), on the crossing's card, so the backend drew no line and framed the work zone. That crop is at zoom step −1, the unseen frame the walk used, which is why it's zoomed out. The question text on it is the crossing's; only the picture's request changed.
- **The failed image** is forced with a 502 at the browser. The answers still work.

## Found by eye and fixed

- The key's "dashed" swatch, a 4 px dashed border 16 px long as `SeeA` draws it, rendered solid, so the key told the lines apart by hue alone (Rule 13). It's now a drawn dash, 24 px wide, solid swatch 24 px too. No new hex.
- The walk's first no-geometry state only rewrote the header and kept the line in the picture. Replaced as above.

## For Ryan's hand check

- **One ring, nearest crossing** (phone fix round), at both widths: `390-04-q3-map.png`, `1440-04-q3-map.png`. The frame is centred on it. Other crossings the scan counted aren't marked, and the question's text doesn't change.
- **The label isn't on the line** from 480 px up (X4), it's in the map's top-left corner.
- **The held space under the phone map:** with no line drawn (`390-05-no-geometry.png`) there is a 40 px blank under the link, and a key line short. That's what keeps the choices from moving (X11).
- **The nav in the 390 crops:** the card is now taller than the 844 px window, so the sticky nav lands on the top of the element shot. That's the screenshot, not the layout. From the map's top to the end of the choices is about 625 CSS px, so they fit on one screen.
- **A sidewalk line can look like more than sidewalks.** `highway=footway` includes crosswalks mapped as paths, and the scan counts them, so the line shows them too. The question text is unchanged.

## Known limits

- **Not walked:** the interchange and school questions with a drawn line; this pin has neither. The route, selectors and words are covered by `tests/test_needs_you_map.py` and `NeedsYouMap.test.tsx`.
- **Not opened:** the street-level link's URL and target were read; it wasn't followed to Google.
- **Not run:** a real phone, or the map on production. Live Overpass fails often (handoff § Next, 3 of 10 page loads at #446's check), and when this read fails the map draws no line with no message beyond the key leaving that line out. That's the ruled behaviour (Rule 10), but expect it on production.
- **Mapbox's actual monthly use** isn't visible from the repo (`checkpoint.md` § 3).
- **Rule 5, amended before the diff:** `middleware.test.ts` gets the new route's row, which its table test requires. Otherwise as predicted.

No gate token or render secret is saved here. The walk ran on throwaway local values.
