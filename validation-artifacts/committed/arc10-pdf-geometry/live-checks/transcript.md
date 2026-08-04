# Arc 10 live checks — transcript (#140 / #141 / #157)

**Run date:** 2026-08-04 (UTC timestamps in `assertions-raw.md`).
**Result: 25/25 PASS, 0 failures** — 9 browser assertions (incl. the
build gate) in `assertions-raw.md` + 16 served-PDF measurements in
`pdf-measurements.md`, both verified by count.  Read-only throughout:
no accounts, no DB writes, no plan saves; PDF downloads are stateless
renders through the page's own buttons; zero route interception.
Overpass reference fetches are read-only queries.

## Build table

| Surface | sha |
|---|---|
| healthz (`…modal.run/healthz`) | `4fee6b88cce4b51c5588f20a665014e66cf32ed5` |
| `git rev-parse origin/main` | `4fee6b88cce4b51c5588f20a665014e66cf32ed5` |
| served `/_next/static` bundle | `4fee6b88cce4b51c5588f20a665014e66cf32ed5` |

## The #140 measurement (served document, curved road)

Configured live at the fixture pin (39.74231, -105.23925 — a node ON
Lookout Mountain Road), candidate way 17070828 confirmed, plan-sheet
PDF downloaded through the page's own button
(`served-lookout-shoulder.pdf`).  The embedded 2400×1000 aerial was
extracted from the PDF, the camera solved (zoom 17; translation fit
landed **2 ft** from the outside rebuild — the center was recomputable,
only the integer zoom floor differed because the relayed frame's
work-zone chord differs slightly from an outside re-stitch), and every
orange path pixel measured against all same-name OSM way segments:

| Metric | Value |
|---|---|
| median deviation | **3.0 ft** |
| p99 | **5.7 ft** |
| max | **6.7 ft** (bar: < 15 ft) |
| pre-fix same road | **1,521.4 ft** |
| chord counterfactual under the same translation fit | **69 ft** (the bar's power: a straight overlay cannot be translated onto this curve) |

3,491 path pixels; stroke half-width is ~2 px ≈ 4 ft at zoom 17, so
the max is edge pixels of a path drawn on the road.  The CORRIDOR
DETAILS panel prints `Centerline: OSM, full corridor` (A8), and the
picker preview ribbon (`01-picker-corridor-lookout.png`) visibly hugs
the road through every bend, zone labels riding the curve.

**Compat control:** an off-road pin (Ferril Lake, City Park; zero
candidates) with a manually typed bearing renders fine —
`served-offroad-shoulder.pdf`, corridor details present, **no**
Centerline row (the chord frame, honestly undisclosed as centerline),
COORDINATES row present (B1–B3).

**Absent-location control:** blocked by #186's gate on prod (AWAITING
LOCATION, Generate disabled) — no path to an unlocated PDF exists, so
the backend test
(`test_plan_sheet_location.py::test_no_location_renders_dash_never_zeros`)
carries the em-dash case.  Stated, not forced.

## #141 / #157 on the served document

- Attribution verbatim: "Mapbox satellite imagery with street labels —
  for context only." (A7); the aerial pair
  (`03-served-aerial-color.png` / `04-served-aerial-gray.png`) shows
  "Lookout Mountain Rd" and route-68 shields legible in grayscale.
- Page 1: `LOCATION: Lookout Mountain Road, Golden, CO` +
  `COORDINATES: 39.74231, -105.23925` (A1–A3).
- Page 2: caption address-first with the coordinates beneath, and the
  Anchor row carries the same value in the same 5-decimal format
  (A4–A6) — three coordinate prints, one value, one format.

## Run notes (probe-assumption failures, disclosed)

Four browser runs and several measurement iterations preceded the
clean pass; no production assertion that executed correctly ever
failed:

1. Run 1: `#proj-address` locator — the field sits in the collapsed
   "Project details" section.
2. Run 2: bearing locator matched the map's compass button; the picker
   bearing input is the "0–359" placeholder field.
3. Run 3 (browser green, measurement caught it): the sidebar ADDRESS
   field **geocodes and lands the pin** — the #157 issue's own
   behavior — which moved the plan a mile down the road, out from
   under the fixture-anchored reference window.  The typed string
   moved to the non-geocoding "Location description" field and the
   measurement was made self-sufficient (reference fetched around the
   anchor the document itself prints).
4. Run 4 measurement iterations: (a) the served camera's integer zoom
   is not exactly recomputable from outside (relayed-frame chord) —
   the camera is now solved from the data, and the solve landed 2 ft
   from the rebuild; (b) an 18-pixel tail at 25–30 ft was **a red car
   parked in a roadside pullout** (color-mask false positive; the
   overlay's orange keeps blue well below green, car-red does not —
   mask refined with a g−b term).  Decimation and carriageway
   hypotheses were tested and ruled out (relayed chain is 270 nodes,
   under the 300 cap; deviation unchanged against an all-ways
   reference).

## Evidence files

`arc10-live-checks.js` (browser script, matches the artifacts as
produced), `measure-served-pdf.py` (camera solve + measurement),
`assertions-raw.md`, `pdf-measurements.md`, screenshots 01–04, both
served PDFs.
