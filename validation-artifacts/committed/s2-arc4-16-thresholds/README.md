# s2-arc4 — #16 residual: the threshold-sourcing closure

Branch `issue-16-thresholds` (three commits, `Refs #16`), off main at
`92b3dc2`.  The arc closes #16's three residual failures: the false
§6N.12/§6N.16 attribution, the unsourced detection thresholds, and the
unrendered margin (`nearest_distance_m`/`details` typed but dead —
booleans only).

## Contents

- `source-scan-6n-negative.txt` — the attribution verified by subject:
  §6N.12 (p. 848) and §6N.16 (p. 851) are both distance-free; "urban
  A-spacing 250 ft" matches no Table 6B-1 row (100/350/500/1,000,
  p. 773); Ch. 6H is "TTC Zone Warning Signs", not interchange signing.
  Dispositions per the GO.  Proposed citation-counter increment 17→18.
- `scan-raw-output.txt` — raw extractor output backing every claim
  above; `scan-6n-sections.py` / `scan-6b1-6h.py` — the scanners
  (pypdf; case-insensitive, U+2011-normalized).
- `repro-margin-invisible.py` — the margin-invisibility reproduction:
  two sidewalks (10 ft and 140 ft off the road centerline) flip the
  same boolean; runnable at any sha.
- `pre-fix-margin-capture.txt` — pre-fix wire: the 140 ft feature reads
  `Setback Path [lateral @ 400 ft]` — the station, not the offset that
  made it relevant; the UI renders neither.
- `post-fix-margin-capture.txt` — post-fix wire: `Setback Path
  [lateral 140 ft off centerline]`.
- `pre-fix-rows-red-run.txt` — the new mounted rendered-row tests run
  against the pre-fix rows: 4 present-case failures (the received
  textContent is the booleans-only render, zero numbers), both #186
  absent cases already passing.

## The threshold inventory outcome (zero value changes)

| value | disposition |
|---|---|
| 50 / 25 ft (`classify_distance` defaults) | CHOSEN at s2-arc3; #16 revisit ran and HELD (docstring records it) |
| 150 ft lateral acceptance (sidewalks/bike) | CHOSEN-marked, arterial half-section rationale |
| 250 ft outside tolerance (intersections) | CHOSEN-marked; false attribution removed; Table 6B-1 as context only |
| 500 ft outside tolerance (interchanges) | CHOSEN-marked; ditto (coincides with the rural A value — coincidence, not citation) |
| 152.4 m longitudinal bbox pad | kept — invariant already recorded |
| 100 m lateral bbox pad | hoisted to `_CORRIDOR_LATERAL_BUFFER_M`; CHOSEN + the previously-unstated ≥150 ft invariant written down |
| 500 m point-mode radius | CHOSEN-marked |
| +4/+6/+2/+500 ft placement setbacks | OUT — placement class, queued per s2-arc2 GO ruling 3 (flag-don't-fix confirmed) |

Declared churn, in full: the two site_adjustments `rule` strings and
three audit `pending_verification` labels (page cites + real titles;
`grid_site_adjacent_{intersection,interchange}.json` re-baselined for
exactly those 8 lines each), the AuditTrail static-fallback chips kept
byte-identical to the derived ones, corridor `details` for
lateral-zone features now state the lateral offset, and the new
evidence lines under auto-checked site-condition rows.  Suites:
backend 1901 passed / 2 skipped (unchanged); frontend 683 passed
(677 + 6 new).
