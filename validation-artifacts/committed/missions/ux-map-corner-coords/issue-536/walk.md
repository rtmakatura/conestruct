# #536 local walk: the corner in the road row's title

Walked 2026-11-19 on `issue-536-corner-in-title` (uncommitted work on bed68a4), local `next dev` on :3536 for this worktree's site, at 1440x900, 1198x930 and 390x844 (DPR 1, Chromium via Playwright). Script: `walk-script/walk536.mjs` (adapted from #525's `walk525.mjs`), launcher `walk-script/launch-site.cjs` (the main checkout's `.env.local` read raw, nothing printed; live Overpass and the `.env.local` backend, no stubs). Pins picked with `walk-script/probe.cjs` against the local `/api/road-bearing`. The pin was typed into the window's coordinate boxes. The dev server was stopped by process tree after the walk (port 3536 free, no node or Chromium left).

## Pins

| Pin | Coordinates | Why |
|---|---|---|
| Colfax and Pennsylvania | 39.7401, -104.9811 | the issue's pin |
| Colfax and Humboldt | 39.7401, -104.9696 | probed: both rows name each other as the cross street |
| No cross street | 39.7401, -104.9757 | mid-block on Colfax between Emerson and Ogden; probe returned one row, no `cross_street` |

## Readings (`shots/walk.json`)

Same at all three sizes; Inter loaded at every size; axe on `[role=dialog]`: 0 violations in all nine runs.

| Pin | Rows (title / second line) |
|---|---|
| Colfax and Pennsylvania | "Pennsylvania Street at East Colfax Avenue" / "Traffic both ways · 2 m from your pin"; "East Colfax Avenue at Pennsylvania Street" / "Traffic both ways · 5 m from your pin" |
| Colfax and Humboldt | "East Colfax Avenue at Humboldt Street" / "Traffic both ways · 5 m from your pin"; "Humboldt Street at East Colfax Avenue" / "Traffic both ways · 8 m from your pin" |
| No cross street | "East Colfax Avenue" / "Traffic both ways · 6 m from your pin" (no `.road-pick-at`) |

- Street name: Inter 13.5 px, weight 600, rgb(234, 240, 247) (`--ink`). " at <cross street>": 13.5 px, weight 400, rgb(174, 187, 204), the same computed colour as the second line (`--ink-mute`).
- Every title fits on one line at all three sizes (the rows are 64 px tall at every pin), so no wrap was seen; the span is inline and wraps with the name when it must.
- Accessible names (Playwright aria snapshot, 1440): radio "Pennsylvania Street at East Colfax Avenue Traffic both ways · 2 m from your pin", radio "East Colfax Avenue at Pennsylvania Street Traffic both ways · 5 m from your pin". The corner is in the name.
- Before: #525's committed crops at the same pin show the old row ("… · at East Colfax Avenue" on the second line): `../../ux-group7b-guesses-hours/issue-525/crops/after-{1440,1198,390}-colfax-pennsylvania.png`.

## Crops (committed, `shots/`)

- Road list: `{1440,1198,390}-{colfax-pennsylvania,colfax-humboldt,no-cross-street}-list.png`.
- Whole window at Colfax and Pennsylvania: `{1440,1198,390}-colfax-pennsylvania.png`. The other six whole-window shots are in `validation-artifacts-extra/ux-map-corner-coords/issue-536/` in the main checkout (untracked).
