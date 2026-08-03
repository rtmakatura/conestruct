# Arc 10 evidence — PDF geometry (#140 / #141 / #157)

Capture scripts committed alongside; the SAME scripts produced pre- and
post-fix outputs, so each pair's diff is the evidence.
`capture-140-chord-deviation.py` carries a same-script-both-sides
switch: at the pre-fix sha `build_corridor` has no `centerline`
parameter (and `FORCE_CHORD=1` reproduces that measurement at any sha);
post-fix the same measurement runs against the road-following frame.
All renders go through the production entry points
(`build_corridor` / `render_plan_sheet`); Mapbox fetches use the real
Static API.  Pre-fix captured 2026-08-03 at `074ddb2` (main); post-fix
at the Arc 10 branch tip.

| Issue | Pre-fix (measured) | Post-fix (measured) |
|---|---|---|
| #140 straight chord | Lookout Mountain Rd (pin on-road, 40 mph shoulder, 800 ft work zone, corridor 2,344 ft): drawn work-zone start **56.8 ft**, end **968.4 ft**, corridor upstream end **2,340.1 ft** from the true along-road points; max chord-to-centerline deviation **1,521.4 ft** (`pre-fix-140-deviation.json`; `pre-fix-140-page2.png`: the orange work zone leaves the pavement at the first bend and crosses open hillside).  N Speer Blvd (gentle urban curve, same config): corridor upstream end 187–201 ft off the road.  Production's own `validate_corridor_against_osm` did NOT fire — the anchor bearing matches the road tangent exactly, so the >15° warning is structurally blind to curvature | Same pin, same config, centerline relayed (725 nodes): **0.0 ft** deviation at every measured station; all three endpoints **0.0 ft** from the true along-road points (`post-fix-140-deviation.json`; `post-fix-140-page2.png`: the overlay tracks the road through the bend; CORRIDOR DETAILS carries `Centerline: OSM, full corridor`) |
| #141 unlabeled aerial | `pre-fix-141-page2.png`: satellite-v9 names nothing — location without identity.  `pre-fix-141-style-pair-grayscale.png` (identical viewport, both styles, grayscaled): v9 top has zero labels; streets-v12 bottom renders "E Colfax Ave", "N Broadway", "N Lincoln St", the I-70 shield — white-halo text clearly legible in grayscale | `post-fix-141-page2.png`: the production render now names its roads ("Lookout Mountain Rd", route-68 shields) and the attribution reads "Mapbox satellite imagery with street labels — for context only." |
| #157 stale address | Issue's exact repro (typed "23rd ave, greeley, co", pin at Denver Civic Center): page-1 text extraction shows `LOCATION: 23rd ave, greeley, co` and **no coordinate string anywhere on page 1** (`pre-fix-157-mismatch.pdf`); page 2 printed coords at 4 decimals ABOVE the address — the inverse of the ruled order | Page 1: `LOCATION: 23rd ave, greeley, co` + `COORDINATES: 39.73890, -104.98620` — the contradiction is visible on the document itself.  Page 2: `SITE: 23rd ave, greeley, co` with `39.73890, -104.98620` beneath; `Anchor:` row same 5-decimal format (`post-fix-157-mismatch.pdf`) |

`capture-140-fixture-export.py` records the provenance of
`tests/fixtures/centerline/lookout_mountain_road.json` (Overpass/OSM,
ODbL) — the committed geometry behind the curved-road regression tests
(network guard honored).

Regressions live in `tests/test_corridor_centerline.py` (synthetic
closed-form arc + recorded fixture + Static-URL), 
`tests/test_plan_sheet_aerial_style.py` (URL-level style pin), and
`tests/test_plan_sheet_location.py` (PDF text extraction — the repo's
first).  Frontend: `lib/centerline.test.ts`,
`lib/scenarios/centerline-relay.test.ts`.

Honesty notes: the corpus harness pins 0/0 (no geometry) so its
zero-churn pass is trivial — the curved-road coverage is the fixture
tests above, not the corpus.  Zone classification and the Overpass
bbox stay on the straight frame by ruling — the drawn-vs-classified
frame split on curves is #207.  Live checks after ship measure the
served PDF at a curved pin against the <15 ft bar (vs 1,521.4 ft here).
