# R120 on prod `60bbe09` (2026-10-09)

Ryan's ask (R122's preamble): "Check both new lines on prod yourself instead of my browser check
(picker line via a stale left side; refusal via a direct request), and quote what prod returns."

## The refusal: as shipped

`refusal.py` → `refusal.txt`. Both stale shapes answer 400 `pin_model_input`:

> meta.work.side 'left' needs shoulder work on a one-way street: a road tagged one-way and
> confirmed as a one-way street. Choose the right side, or plan shoulder work on a one-way street.

## The side control's line: unreachable on prod

`picker.cjs` (headless Chromium, gate header via `scripts/gate.cjs`) → `facts.json`,
`page-after-kind-switch.png`. N Broadway SB pin, Shoulder work, then the East side (left), then the
kind switched to Flagger lane closure:

| Step | Side options | `side-control-stale` | `side-control-note` |
|---|---|---|---|
| shoulder | West, East | absent | absent |
| East chosen | West, ✓ East | absent | absent |
| flagger | none | **absent** | "the road's sides are unavailable. Reopen the map to retry" |

The last `/api/render/corridor-geometry` response (`facts.json` `geo[3]`): **400** with the R120
refusal. The side options come from that read, which sends the scenario with the stored left side
(`lib/corridor-geometry.ts:230-234`). `render_corridor_geometry` runs `_ensure_scenario_enabled` first
(`src/api/render_api.py:1275`), which runs `_ensure_pin_model_complete`, so the read refuses before it
answers any options. `useCorridorGeometry` maps a non-OK answer to `error`, and the side control shows
its unavailable note. The stale line needs `options.length > 0`
(`components/bands/WhereBand.tsx:239-240`), so it can never render. The band's aerial says "The aerial
didn't load." for the same reason.

The vitest that pins the line (`WhereBand.left-side.test.tsx`) passes because its fetch mock answers
the geometry read with options whatever the scenario says.

Near-intersection is not a clean trigger: its geometry read refuses first for the missing cross street
(`pinModel 'work_start' near_intersection needs meta.intersection`).

Not fixed here (R122 is investigate-only). Drafted as an issue in the chat.
