# #299: the scan's north-up box vs. a road-following strip, measured

Measured 2026-10-14 against the two live mirrors (`probe299.py`; rows `run-n20/rows.json`, log
`run-n20/log.txt`, summary `sum299.py`). No product change: the measurement says keep the box.

## What was measured

Two corridors at a 45-degree bearing in central Denver (39.7392, -104.9903), built by the backend's
own corridor code at `40f23e6`+:

- a 45 mph shoulder plan;
- a rural 45 mph flagger at #290's both-approach extent (the case #299 worries about).

For each: today's scan query (`_build_bbox_query` over `corridor_bbox`, padded 100 m lateral and
152.4 m longitudinal) and the same query with every `(box)` filter replaced by
`(around:100, <the centerline extended 152.4 m past each end>)`: the same two pads. Each POSTed
to both mirrors 20 times, alternating shape order and spaced 2 s apart: 160 requests.

## Results

| Case | Mirror | Shape | Answered | Median s | p90 s | Median KB | Elements |
|---|---|---|---|---|---|---|---|
| flagger, both approaches | overpass-api.de | box | 12/20 | 4.57 | 7.10 | 552 | 2898 |
| flagger, both approaches | overpass-api.de | strip | 5/20 | 7.30 | 9.46 | 122 | 626 |
| flagger, both approaches | overpass.openstreetmap.fr | box | 20/20 | 3.61 | 4.70 | 552 | 2898 |
| flagger, both approaches | overpass.openstreetmap.fr | strip | 20/20 | 3.80 | 4.09 | 122 | 626 |
| shoulder | overpass-api.de | box | 7/20 | 5.56 | 11.30 | 243 | 1234 |
| shoulder | overpass-api.de | strip | 12/20 | 7.34 | 12.18 | 82 | 415 |
| shoulder | overpass.openstreetmap.fr | box | 20/20 | 3.37 | 9.86 | 243 | 1234 |
| shoulder | overpass.openstreetmap.fr | strip | 20/20 | 3.84 | 12.39 | 82 | 415 |

Non-200 answers: all overpass-api.de 504s, 21 of 40 box and 23 of 40 strip.

**Coverage:** every element the box returned whose center lies inside the strip (100 m of the
extended centerline) also came back from the strip: 0 missing in both cases (370 and 566 box
elements; the strip returned 415 and 626, its extras being ways that cross the band with their
center outside it).

## What it says

- **The strip cuts the payload 3 to 4.5 times** (243 KB to 82 KB; 552 KB to 122 KB) with no loss
  of coverage.
- **It does not cut the time.** On the mirror that answers (openstreetmap.fr, 40 of 40 for both
  shapes) the strip's median is 0.2 to 0.5 s slower; on overpass-api.de it is about 2 to 3 s slower
  when it answers at all. `around` costs the server more than the smaller payload saves, which is
  the cost #299 flagged as unmeasured.
- A refusal is a time-out (#256, #292: the budget runs out), not a payload problem, so the strip
  would not lower the refusal rate and slightly raises the time a scan takes.

**Recommendation: keep the box.** #299's own prediction (a 2.19 km² diagonal box costing ~2 s of
transfer on the slow mirror) didn't hold on the mirrors answering today: the flagger box's 552 KB
answered in a median 3.6 s on openstreetmap.fr.

## Caveat

#299 asked for N=20 "on prod". This run asked the same two mirrors directly from a workstation, not
from the Modal container; the server-side cost of each shape (the deciding number) is the same,
only the network path differs.
