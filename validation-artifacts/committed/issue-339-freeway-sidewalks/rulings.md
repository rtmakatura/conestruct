# #339 rulings — a freeway plan counts no sidewalk from the site scan

Issue: https://github.com/rtmakatura/conestruct/issues/339. One arc, no checkpoint stop: the ruling below is one of the issue's two proposed solutions and fits existing rules (R145).

## S1 — R145 self-ruled: option (b), keyed on the plan's road type
On a plan whose `params.road_type` is `freeway`, the site scan's `sidewalks` bucket counts nothing, so `pedestrian_facility` does not fire and the plan places no R9-9 and no pedestrian section.
- The bucket keeps what the scan found: `features` stay listed with `relevant: false`, and `details` carries one line naming how many paths were found and why none count ("N sidewalk paths near the freeway not counted: the scan can't tell a sidewalk along a freeway from one on a crossing or frontage street. If one runs along the work zone, correct the scan."). Rule 10: the absence is said, not silent.
- The operator can still assert `pedestrian_facility` (#224 phase 4); it applies with `scan_detected: false`. Suggest-never-set is untouched.
- Applied in `run_site_scan` after the memo/token read; the memo and the signed token keep the raw scan, as with the bearing threshold.
- **CHOSEN, not sourced.** The reason is geometric: the scan sees only each path's centre (`out center tags`), and the 150 ft lateral acceptance was sized for "a typical 4-lane arterial half-section" (`site_detection.py`, #16 threshold notes). Near a freeway that band holds crossing streets, overpasses and frontage roads (43 paths on I-25 at 39.68539, -104.96427). No claim is made about whether pedestrians may use a freeway; nothing on file sources one (Rule 12).
- Keyed on the plan's road type (the operator's freeway), not the OSM `motorway` tag, so it covers every kind that takes `freeway` (shoulder, lane closure, mobile) and needs no new scan input.

Option (a) (a parallel-to-centreline test) is not built: it needs each path's geometry, which changes the scan query, the memo key, the folded-query split (`geometry` is the road set's discriminator) and the response size on every scan.
Rules: 10, 11 (payload-level test), 12, 3 (one producer: the scan module).

## Noted, not changed
`bike_facilities` uses the same 150 ft band and is not touched here: it is outside this issue, and no case on file shows a false bike detection on a freeway (the I-25 row's bike bucket is 0).
