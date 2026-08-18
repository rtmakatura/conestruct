# s2-arc3 evidence — #207: classification joins the centerline frame

By explicit design note (pre-arc `corridor.py:218-223`), only the
*drawing* was centerline-aware after #140; `along_station_ft`,
`lateral_offset_ft`, `classify_distance`, and `corridor_bbox` stayed on
the straight chord.  On a curved road, a detected feature's drawn
position and its classified station/zone disagreed by up to the full
chord deviation.  This arc ports the same cached centerline frame into
the classification path and rebuilds the Overpass bbox over the road
path (arc branch `issue-207-classification-frame`).

## Files

- `pre-fix-capture.txt` — recorded at `17c25fb` (pre-arc HEAD): sampling
  the DRAWN corridor of the committed Lookout Mountain Road fixture at
  100-ft stations and asking the then-current chord classification about
  each on-road point.  **22/24 stations misclassified `lateral`, max
  along-station error 868 ft, max chord lateral offset of an on-road
  point 1,521 ft (the Arc 10 recorded chord deviation), and 16/24 drawn
  points OUTSIDE the Overpass bbox** — two-thirds of the corridor's
  features were never even fetched.  Straight control: 0.00 ft errors;
  one boundary tie at exactly station 900.0 ft (the work_zone/buffer
  cut), 25 millionths of a foot of float noise across the `<=` boundary
  — a harness artifact, noted per the GO.
- `repro-classification-chord.py` — the rerunnable measurement.  Section
  1 measures the PRODUCT frame; section 2 measures a chord twin with the
  centerline withheld, which reproduces the pre-#207 classification at
  any sha (the Arc 10 `FORCE_CHORD` idiom, script-level — the product
  carries no flag; no centerline attached ⇒ the chord frame,
  structurally).  Samples at 50 + 100k ft so the stride never lands on
  an exact zone boundary.
- `post-fix-capture.txt` — the script's output at the arc branch tip:
  **product frame 0/23 misclassified, 0.0 ft max errors, 23/23 inside
  the bbox; chord twin still reproduces 22/23 misclassified, 844.8 ft
  max along error, 1,478.4 ft max lateral, 16/23 outside** (the twin's
  figures differ from the pre-fix capture's only by the 50-ft sampling
  phase).

## The invariant, post-change

`corridor_bbox` ↔ `_CORRIDOR_LONGITUDINAL_BUFFER_M` (site_detection.py):
with a centerline the box hulls every centerline vertex whose station
falls in the ±500 ft-buffered window, plus the tangent-extended window
ends and the anchor, padded by the lateral buffer in all four cardinal
directions — a strict superset of every point the classification frame
can accept plus its lateral acceptance band (exactness-via-vertices:
between vertices the polyline is straight, so its extremes are at
vertices).  Proof: `TestCorridorBboxSuperset` in
`tests/test_classification_frame.py` — containment on the curved
fixture and the synthetic arc, the chord twin's leak asserted beside it
(non-vacuity), and the no-centerline box byte-identical to the original
corner math.

## Threshold sourcing (GO rulings)

- `lateral_threshold_ft = 50.0` / `outside_tolerance_ft = 25.0`:
  CHOSEN-marked in the `classify_distance` docstring, values unchanged;
  expressly value-revisitable at #16's threshold pass.
- Regression tolerance 2.0 ft: sourced to
  `test_corridor_centerline.py:100`'s discretization bound (1°-sampled
  synthetic arc ≈ 2 ft vertex-discretization error); the on-polyline
  round-trip itself is float-exact and asserted at 0.01 ft.

## Wire

One additive request-side field (`DetectSiteRequest.centerline`),
relayed by the frontend through the staleness-guarded
`withRelayedCenterline` (#140 rule: exact pin match, wire-only, never
stored).  An older backend drops the field silently and classifies on
the chord — graceful, but backend-first is the deploy order (standing
rule; honored via ship.ps1 mechanics).

Refs #207.
