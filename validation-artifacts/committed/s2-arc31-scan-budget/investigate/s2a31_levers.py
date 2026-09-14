"""s2-arc31 investigate — #256: the levers, re-measured with spacing.

    python s2a31_levers.py <outDir> <wireJson> [spacingS]

WHY THIS FILE EXISTS.  The first pass (``s2a31_overpass.py``) measured
L1 and L2 cleanly and then RATE-LIMITED ITSELF: overpass-api.de reports
``Rate limit: 2`` per IP (see that run's /api/status block), and firing
L3's two queries, L4's fifteen and L5's three back to back earned HTTP
429 with a 703-byte body on most of them.  Those rows measure the
probe's request rate, not the lever.  This file re-runs the levers that
matter with ``spacingS`` seconds between every single request.  It does
NOT re-run L4 (the 15-trip split) — that lever's answer is already
known and is the reason this file is needed: fifteen serial trips
against a limit of two is self-defeating by construction.

!!  SAME CAVEAT AS THE FIRST PASS  !!
!!  Developer machine, developer egress IP.  Overpass queues and
!!  rate-limits per IP, so the WAIT terms here are not Modal's waits.
!!  Element counts, byte sizes and the recall comparison ARE properties
!!  of the query and do carry over.  Timing here is corroborating, not
!!  probative; s2a31-prod.js owns the prod timing claim.
!!
!!  A 429 or 504 row below is NOT a lever result.  If a leg reports one,
!!  that leg measured nothing and is labelled INVALID in its own line.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(REPO))
# the first pass lives beside this file; reuse its timing helpers rather than
# retyping them, so both passes measure with exactly the same instrument.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from s2a31_overpass import brief, buckets_of, post_query  # noqa: E402

from src.api.schemas import _map_road_type  # noqa: E402
from src.rules.corridor import build_corridor  # noqa: E402
from src.rules.site_detection import (  # noqa: E402
    _CORRIDOR_LATERAL_BUFFER_M,
    _CORRIDOR_LONGITUDINAL_BUFFER_M,
    _VALIDATION_SEARCH_RADIUS_M,
    OVERPASS_MIRRORS,
    _build_bbox_query,
    _build_road_at_query,
)

OUT = Path(sys.argv[1])
WIRE = Path(sys.argv[2])
SPACING_S = float(sys.argv[3]) if len(sys.argv) > 3 else 45.0
OUT.mkdir(parents=True, exist_ok=True)
LOG = OUT / "log.txt"
M0 = OVERPASS_MIRRORS[0]


def log(s: str = "") -> None:
    print(s, flush=True)
    with LOG.open("a", encoding="utf-8") as fh:
        fh.write(s + "\n")


def valid(row: dict) -> bool:
    return row.get("status") == 200 and row.get("elements") is not None


def shot(label: str, query: str, rows: list, keep_payload: bool = False):
    """One spaced request.  Never two in flight, never two inside SPACING_S."""
    r = post_query(M0, query)
    payload = r.pop("_payload", None)
    r.update(lever=label, mirror=M0)
    rows.append(r)
    mark = "" if valid(r) else "   <-- INVALID: this leg measured nothing (see the 429/504 caveat)"
    log(f"  {label:26s} {brief(r)}{mark}")
    time.sleep(SPACING_S)
    return (r, payload) if keep_payload else r


def folded_query(bbox, lat, lng, radius_m) -> str:
    """The two trips as ONE query.

    Overpass can emit more than one result set from one request: name
    each union with ``->.set`` and give each its own ``out``.  The site
    scan wants ``out center tags``; the bearing check wants ``out geom
    tags``.  Both fit in one round trip, which is the whole point —
    the product's cost is trips, not bytes.  The caller can tell the two
    apart on the wire: bearing elements carry ``geometry``.
    """
    south, west, north, east = bbox
    box = f"{south:.6f},{west:.6f},{north:.6f},{east:.6f}"
    r = f"{radius_m:.0f}"
    around = f"around:{r},{lat},{lng}"
    clauses = "\n".join(
        f"  {kind}({box}){filt};"
        for kind, filt in [
            ("node", '["highway"="traffic_signals"]'), ("node", '["highway"="crossing"]'),
            ("way", '["highway"="footway"]'), ("way", '["footway"="sidewalk"]'),
            ("way", '["highway"="cycleway"]'), ("way", '["cycleway"]'),
            ("node", '["amenity"="school"]'), ("way", '["amenity"="school"]'),
            ("node", '["railway"="level_crossing"]'), ("node", '["amenity"="hospital"]'),
            ("way", '["amenity"="hospital"]'), ("node", '["highway"="motorway_junction"]'),
            ("way", '["highway"="motorway_link"]'), ("way", '["highway"="trunk_link"]'),
            ("way", '["bridge"="yes"]'),
        ]
    )
    road = ("^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|"
            "motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$")
    return (
        "[out:json][timeout:10];\n"
        f"(\n{clauses}\n)->.scan;\n"
        ".scan out center tags;\n"
        f'(\n  way({around})["highway"~"{road}"];\n)->.road;\n'
        ".road out geom tags;\n"
    )


def main() -> None:
    log(f"=== s2-arc31 levers, spaced {SPACING_S:g}s — started {datetime.now(UTC).isoformat(timespec='seconds')} ===")
    for line in (__doc__ or "").splitlines():
        if line.startswith("!!"):
            log(line)
    log("")

    raw = json.loads(WIRE.read_text(encoding="utf-8"))["scenario"]
    kw = dict(
        lat=float(raw["meta"]["lat"]), lng=float(raw["meta"]["lng"]),
        bearing_deg=float(raw["meta"]["bearingDeg"]), speed_mph=int(raw["speed"]),
        work_zone_ft=float(raw["workLen"]), closure_type=str(raw["kind"]),
        road_type=_map_road_type(str(raw["roadType"]), int(raw["speed"])),
        lane_width_ft=float(raw.get("laneWidth") or 12.0),
    )
    log(f"corridor from {WIRE.name}: {kw}")

    wide = build_corridor(**kw, downstream_taper_use_max=True)
    tight = build_corridor(**kw, downstream_taper_use_max=False)
    bb_w = wide.corridor_bbox(lateral_buffer_m=_CORRIDOR_LATERAL_BUFFER_M,
                             longitudinal_buffer_m=_CORRIDOR_LONGITUDINAL_BUFFER_M)
    bb_t = tight.corridor_bbox(lateral_buffer_m=_CORRIDOR_LATERAL_BUFFER_M,
                               longitudinal_buffer_m=_CORRIDOR_LONGITUDINAL_BUFFER_M)
    rows: list[dict] = []

    log("")
    log("-- L3 (re-run): the use_max bbox vs the tight bbox, cost and recall --")
    r_w, p_w = shot("L3-wide", _build_bbox_query(bb_w), rows, keep_payload=True)
    r_t, p_t = shot("L3-tight", _build_bbox_query(bb_t), rows, keep_payload=True)
    if valid(r_w) and valid(r_t):
        bw, bt = buckets_of(p_w), buckets_of(p_t)
        log(f"  buckets wide : {bw}")
        log(f"  buckets tight: {bt}")
        diff = {k: bw.get(k, 0) - bt.get(k, 0) for k in set(bw) | set(bt) if bw.get(k, 0) != bt.get(k, 0)}
        log(f"  RECALL COST of the tight bbox (elements no longer FETCHED): {diff or 'none'}")
        log("  NOTE: fetched is not relevant.  _is_feature_relevant() decides what moves a")
        log("  flag, and this probe does not run it — the flag-level cost is <= this.")
    else:
        log("  L3 INVALID this run — one or both legs did not return a payload.")

    log("")
    log("-- L5 (re-run): two trips vs ONE folded query --")
    log("  the product's shape: site scan, then the bearing check, budgeted separately")
    r_s = shot("L5-trip1-scan", _build_bbox_query(bb_w), rows)
    r_b = shot("L5-trip2-bearing", _build_road_at_query(kw["lat"], kw["lng"], _VALIDATION_SEARCH_RADIUS_M), rows)
    log("  the folded shape: both result sets from ONE request")
    fq = folded_query(bb_w, kw["lat"], kw["lng"], _VALIDATION_SEARCH_RADIUS_M)
    (OUT / "query-folded.overpassql").write_text(fq, encoding="utf-8")
    r_f, p_f = shot("L5-folded-1trip", fq, rows, keep_payload=True)
    if valid(r_f) and p_f is not None:
        els = p_f.get("elements", []) or []
        with_geom = [e for e in els if e.get("geometry")]
        log(f"  folded payload: {len(els)} elements, {len(with_geom)} carry geometry (the bearing set),")
        log(f"  {len(els) - len(with_geom)} do not (the scan set).  Separable on the wire: yes.")
        log(f"  folded buckets (scan set, geometry-free): {buckets_of({'elements': [e for e in els if not e.get('geometry')]})}")
    if valid(r_s) and valid(r_b) and valid(r_f):
        two = (r_s["total_ms"] or 0) + (r_b["total_ms"] or 0)
        log(f"  two trips {two:.1f}ms vs folded {r_f['total_ms']:.1f}ms "
            f"(one budget instead of two; the trip COUNT is the structural claim, the ms are this IP's)")
    else:
        log("  the two-vs-one TIMING comparison is INVALID this run (a leg 429'd or 504'd);")
        log("  the separability result above stands on its own if the folded leg was 200.")

    log("")
    log("-- L6: the shipped scan query, spaced, x5 — the clean-answer rate from one IP --")
    ok = 0
    for i in range(5):
        r = shot(f"L6-run{i+1}", _build_bbox_query(bb_w), rows)
        ok += 1 if valid(r) else 0
    log(f"  {ok}/5 clean answers, spaced {SPACING_S:g}s, one IP, one mirror.")
    log("  This is NOT the prod refusal rate — prod retries two more mirrors inside a")
    log("  20 s budget and runs from Modal's IP.  It is the base rate for ONE try.")

    (OUT / "rows.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
    log("")
    log(f"wrote {len(rows)} rows  finished {datetime.now(UTC).isoformat(timespec='seconds')}")


if __name__ == "__main__":
    main()
