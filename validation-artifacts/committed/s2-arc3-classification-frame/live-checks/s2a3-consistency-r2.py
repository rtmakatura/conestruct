"""s2-arc3 live checks round 2, payload series (Refs #207) — READ-ONLY.

Runs against production through the public proxy (no secrets).  The
served classification frame became reachable when the proxy fix
shipped; this script measures it:

  D2' — the 166-vertex fixture relay now serves (round 1: HTTP 413).
  D3' — INVERTED from round 1: a sub-1 KB sharply bent centerline must
        CHANGE the classification vs the no-centerline body (round 1:
        byte-identical, the allowlist strip).
  C1/C2 — curved-pin drawn-vs-classified consistency: a corridor on
        Lookout Mountain Rd anchored at its real feature cluster, the
        confirmed road's geometry relayed exactly as the frontend
        would.  Each served relevant feature is matched to its OSM
        element (full-precision coords via Overpass) and its served
        station/lateral/zone compared against the LOCAL road frame
        (src.rules.corridor at the shipped commit — identical inputs,
        so agreement must be within the server's 0.1 ft rounding).
        C2: the chord twin materially disagrees on this curve
        (non-vacuity).
  S1/S2 — straight control (Lakewood / S Wadsworth): the plan declared
        "zones identical, stations within ±0.2 ft" expecting a
        geometrically straight control; the first complete run measured
        the road's REAL gentle curvature (max A/B station delta
        29.1 ft over the corridor), so the checks are recast to the
        claim the control actually verifies — for identical inputs,
        SERVED == LOCAL per frame: the no-centerline response matches
        the local chord frame and the with-centerline response matches
        the local road frame, each within the server's 0.1 ft rounding
        (S1); and every feature-set difference between the two
        responses is exactly a bbox-membership difference the local
        model predicts (S2).  The A/B delta itself is reported as the
        measured curvature, declared — not re-baselined silently.

Run from repo root with the venv python.
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))

from src.rules.corridor import WorkCorridor, build_corridor  # noqa: E402

BASE = "https://www.conestruct.com"
OUT = Path(__file__).parent / "outS2A3"
OUT.mkdir(exist_ok=True)

FIX = json.loads(
    (ROOT / "tests/fixtures/centerline/lookout_mountain_road.json").read_text()
)

failures = 0
lines = []


def log(msg):
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    lines.append(f"- `{stamp}` {msg}")
    print(f"{stamp} {msg}")


def check(name, cond, extra=""):
    global failures
    tag = "**PASS**" if cond else "**FAIL**"
    if not cond:
        failures += 1
    log(f"{tag} — {name}{f' ({extra})' if extra else ''}")


def post(path, body, timeout=60):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, None


def overpass(query):
    for mirror in (
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass-api.de/api/interpreter",
    ):
        req = urllib.request.Request(
            mirror,
            data=("data=" + urllib.parse.quote(query)).encode(),
            headers={
                "User-Agent": "conestruct-traffic-control-tool/0.2 (+https://conestruct.com)",
                "content-type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return json.loads(r.read().decode())
        except Exception:  # noqa: BLE001
            continue
    return None


import urllib.parse  # noqa: E402

CORRIDOR_FIELDS = {
    "radius_m": 500,
    "speed_mph": 40,
    "work_zone_ft": 800.0,
    "closure_type": "shoulder",
    "road_type": "rural_undivided",
    "lane_width_ft": 12.0,
}


def features_of(resp):
    out = {}
    for k, v in resp.items():
        if isinstance(v, dict) and isinstance(v.get("features"), list):
            for f in v["features"]:
                out[(k, f["label"])] = f
    return out


# ---- D2' / D3' -----------------------------------------------------------

lookout_body = {
    "lat": FIX["anchor"][0],
    "lng": FIX["anchor"][1],
    "bearing_deg": FIX["bearing_deg"],
    **CORRIDOR_FIELDS,
}
s0, d1 = post("/api/render/detect-site", lookout_body)
s2, d2 = post(
    "/api/render/detect-site", {**lookout_body, "centerline": FIX["centerline"]}
)
check(
    "D2'. the 166-vertex fixture relay serves (round 1: 413)",
    s2 == 200 and d2 and d2.get("mode") == "corridor",
    f"HTTP {s2}",
)
(OUT / "r2-d2-with-centerline.json").write_text(json.dumps(d2, indent=2), encoding="utf-8")

bent = [
    [FIX["anchor"][0], FIX["anchor"][1]],
    [FIX["anchor"][0] - 0.004, FIX["anchor"][1] + 0.001],
    [FIX["anchor"][0] - 0.005, FIX["anchor"][1] + 0.008],
]
s3, d3 = post("/api/render/detect-site", {**lookout_body, "centerline": bent})


def canonical(resp):
    return json.dumps(
        {
            k: sorted(
                (f["label"], f["zone"], f["along_station_ft"], f["lateral_offset_ft"])
                for f in v["features"]
            )
            for k, v in resp.items()
            if isinstance(v, dict) and isinstance(v.get("features"), list)
        },
        sort_keys=True,
    )


check(
    "D3' (inverted). the bent centerline CHANGES the classification vs no-centerline",
    s0 == 200 and s3 == 200 and d1 and d3 and canonical(d1) != canonical(d3),
    "canonical responses differ" if d1 and d3 and canonical(d1) != canonical(d3) else "identical",
)
(OUT / "r2-d3-bent-small.json").write_text(json.dumps(d3, indent=2), encoding="utf-8")

# ---- C-series: curved consistency ---------------------------------------
# Anchor at the Lookout feature cluster (round 1 located it ~3,100 ft
# upstream of the fixture anchor: unnamed intersection at 39.7338,
# -105.2392).  The road-bearing endpoint supplies the confirmed road's
# geometry + bearing exactly as the picker would.

C_PIN = (39.7338, -105.2392)
s_rb, rb = post("/api/road-bearing", {"lat": C_PIN[0], "lng": C_PIN[1]})
cand = None
if s_rb == 200 and rb and rb.get("candidates"):
    named = [
        c
        for c in rb["candidates"]
        if c.get("geometry") and len(c["geometry"]) >= 2 and "Lookout" in str(c.get("name"))
    ]
    any_geom = [c for c in rb["candidates"] if c.get("geometry") and len(c["geometry"]) >= 2]
    cand = (named or any_geom or [None])[0]
if cand is not None:
    log(
        f"  C candidate: {cand.get('name')!r} way {cand.get('way_id')} "
        f"bearing {cand.get('bearing')} snap {cand.get('snap_distance_m')} m "
        f"geomLen {len(cand['geometry'])}"
    )
if cand is None:
    check("C1. curved-pin consistency (road candidate available)", False, "no candidate with geometry")
else:
    c_body = {
        "lat": C_PIN[0],
        "lng": C_PIN[1],
        "bearing_deg": cand["bearing"],
        **CORRIDOR_FIELDS,
        "centerline": cand["geometry"],
    }
    s_c, served = post("/api/render/detect-site", c_body)
    (OUT / "r2-c1-curved-detect.json").write_text(json.dumps(served, indent=2), encoding="utf-8")

    # Local twin — identical inputs, the shipped commit's code.
    local = build_corridor(
        lat=C_PIN[0],
        lng=C_PIN[1],
        bearing_deg=cand["bearing"],
        speed_mph=40,
        work_zone_ft=800.0,
        closure_type="shoulder",
        road_type="rural",
        centerline=tuple((p[0], p[1]) for p in cand["geometry"]),
    )
    chord = WorkCorridor(
        anchor_lat=local.anchor_lat,
        anchor_lng=local.anchor_lng,
        anchor_description="chord twin",
        bearing_deg=local.bearing_deg,
        advance_warning_ft=local.advance_warning_ft,
        taper_ft=local.taper_ft,
        buffer_ft=local.buffer_ft,
        work_zone_ft=local.work_zone_ft,
        downstream_taper_ft=local.downstream_taper_ft,
        centerline=None,
    )

    # Full-precision coords for the served features via Overpass.
    south, west, north, east = local.corridor_bbox(
        lateral_buffer_m=100.0, longitudinal_buffer_m=152.4
    )
    q = f"""[out:json][timeout:20];
(
  node({south},{west},{north},{east})["highway"~"^(traffic_signals|crossing)$"];
  way({south},{west},{north},{east})["highway"="footway"];
  way({south},{west},{north},{east})["footway"="sidewalk"];
  way({south},{west},{north},{east})["highway"="cycleway"];
);
out center tags;"""
    op = overpass(q)
    coords = []
    for el in (op or {}).get("elements", []):
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lng = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is not None:
            coords.append((float(lat), float(lng)))
    log(
        f"  C Overpass coord fetch: {'FAILED (all mirrors)' if op is None else f'{len(coords)} elements'}"
    )

    served_feats = features_of(served or {})
    # Compare EVERY classified feature (relevant or not) — served must
    # equal local for all of them; require at least one relevant match
    # so the check can't pass vacuously on empty corridors.
    relevant = [
        (k, f) for k, f in served_feats.items() if f.get("along_station_ft") is not None
    ]
    n_relevant = sum(1 for _, f in relevant if f.get("relevant"))
    compared = 0
    worst = 0.0
    zone_mismatch = 0
    chord_delta_max = 0.0
    for (bucket, label), f in relevant:
        # Match the served feature to its OSM element by the 4-dp coords
        # embedded in unnamed labels, else by nearest station agreement.
        best = None
        for lat, lng in coords:
            if f"{lat:.4f}" in label and f"{lng:.4f}" in label:
                best = (lat, lng)
                break
        if best is None:
            continue
        st_local = local.along_station_ft(*best)
        lat_local = local.lateral_offset_ft(*best)
        zone_local = local.classify_distance(*best)
        d_st = abs(st_local - f["along_station_ft"])
        d_lat = abs(lat_local - f["lateral_offset_ft"])
        worst = max(worst, d_st, d_lat)
        if zone_local != f["zone"]:
            zone_mismatch += 1
        chord_delta_max = max(
            chord_delta_max, abs(chord.along_station_ft(*best) - f["along_station_ft"])
        )
        compared += 1
        log(
            f"  C-match [{bucket}] {label!r}: served {f['zone']} @ {f['along_station_ft']} ft"
            f" / local {zone_local} @ {st_local:.1f} ft (Δst {d_st:.2f}, Δlat {d_lat:.2f};"
            f" chord would say {chord.along_station_ft(*best):.1f} ft)"
        )

    check(
        "C1. served station/zone == the local road frame for every matched feature",
        s_c == 200 and compared >= 1 and n_relevant >= 1 and worst <= 0.2 and zone_mismatch == 0,
        f"{compared} matched ({n_relevant} relevant among served), "
        f"max Δ {worst:.2f} ft, zone mismatches {zone_mismatch}",
    )
    check(
        "C2. the chord frame materially disagrees on this curve (non-vacuity)",
        compared >= 1 and chord_delta_max > 50.0,
        f"max chord-vs-served station delta {chord_delta_max:.0f} ft",
    )

# ---- S-series: straight control ------------------------------------------

L_PIN = (39.7113, -105.0815)
s_rb2, rb2 = post("/api/road-bearing", {"lat": L_PIN[0], "lng": L_PIN[1]})
wads = None
if s_rb2 == 200 and rb2 and rb2.get("candidates"):
    for c in rb2["candidates"]:
        if c.get("geometry") and len(c["geometry"]) >= 2 and "Wadsworth" in str(c.get("name")):
            wads = c
            break
if wads is None:
    check("S1. straight control (Wadsworth candidate available)", False, "no candidate")
else:
    log(
        f"  S candidate: {wads.get('name')!r} way {wads.get('way_id')} "
        f"bearing {wads.get('bearing')} geomLen {len(wads['geometry'])}"
    )
    base_body = {
        "lat": L_PIN[0],
        "lng": L_PIN[1],
        "bearing_deg": wads["bearing"],
        **CORRIDOR_FIELDS,
        "road_type": "urban_arterial",
    }
    s_a, resp_a = post("/api/render/detect-site", base_body)
    s_b, resp_b = post(
        "/api/render/detect-site", {**base_body, "centerline": wads["geometry"]}
    )
    (OUT / "r2-s-straight-chord.json").write_text(json.dumps(resp_a, indent=2), encoding="utf-8")
    (OUT / "r2-s-straight-road.json").write_text(json.dumps(resp_b, indent=2), encoding="utf-8")

    # Local twins from the identical request inputs.
    def _s_corridor(centerline):
        return build_corridor(
            lat=L_PIN[0],
            lng=L_PIN[1],
            bearing_deg=wads["bearing"],
            speed_mph=40,
            work_zone_ft=800.0,
            closure_type="shoulder",
            road_type="urban_low",  # urban_arterial @ 40 mph maps here
            centerline=centerline,
        )

    local_chord = _s_corridor(None)
    local_road = _s_corridor(tuple((p[0], p[1]) for p in wads["geometry"]))

    # Full-precision coords for every feature in the wider of the two
    # bboxes, via Overpass.
    boxes = [
        local_chord.corridor_bbox(lateral_buffer_m=100.0, longitudinal_buffer_m=152.4),
        local_road.corridor_bbox(lateral_buffer_m=100.0, longitudinal_buffer_m=152.4),
    ]
    south = min(b[0] for b in boxes)
    west = min(b[1] for b in boxes)
    north = max(b[2] for b in boxes)
    east = max(b[3] for b in boxes)
    q2 = f"""[out:json][timeout:20];
(
  node({south},{west},{north},{east})["highway"~"^(traffic_signals|crossing)$"];
  way({south},{west},{north},{east})["highway"="footway"];
  way({south},{west},{north},{east})["footway"="sidewalk"];
  way({south},{west},{north},{east})["highway"="cycleway"];
  way({south},{west},{north},{east})["cycleway"];
);
out center tags;"""
    op2 = overpass(q2)
    s_coords = []
    for el in (op2 or {}).get("elements", []):
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lng = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is not None:
            s_coords.append((float(lat), float(lng)))
    log(
        f"  S Overpass coord fetch: {'FAILED (all mirrors)' if op2 is None else f'{len(s_coords)} elements'}"
    )

    def match_coords(label):
        # Unique 4-dp match only: dense urban data carries several
        # elements sharing rounded coords, and a wrong pairing shows up
        # as a few-ft phantom delta (the first complete run's 6.19 ft).
        hits = [
            (lat, lng)
            for lat, lng in s_coords
            if f"{lat:.4f}" in label and f"{lng:.4f}" in label
        ]
        return hits[0] if len(hits) == 1 else None

    fa, fb = features_of(resp_a or {}), features_of(resp_b or {})
    shared = sorted(set(fa) & set(fb))
    only_a, only_b = sorted(set(fa) - set(fb)), sorted(set(fb) - set(fa))

    # S1 (recast): SERVED == LOCAL per frame, for every matchable shared
    # feature; the A/B delta is the road's real curvature, reported.
    matched = 0
    worst_local = 0.0
    zmis_local = 0
    curvature_max = 0.0
    for k in shared:
        pt = match_coords(k[1])
        if pt is None or fa[k]["along_station_ft"] is None:
            continue
        matched += 1
        da = abs(local_chord.along_station_ft(*pt) - fa[k]["along_station_ft"])
        db = abs(local_road.along_station_ft(*pt) - fb[k]["along_station_ft"])
        dla = abs(local_chord.lateral_offset_ft(*pt) - fa[k]["lateral_offset_ft"])
        dlb = abs(local_road.lateral_offset_ft(*pt) - fb[k]["lateral_offset_ft"])
        worst_local = max(worst_local, da, db, dla, dlb)
        if local_chord.classify_distance(*pt) != fa[k]["zone"]:
            zmis_local += 1
        if local_road.classify_distance(*pt) != fb[k]["zone"]:
            zmis_local += 1
        curvature_max = max(
            curvature_max, abs(fa[k]["along_station_ft"] - fb[k]["along_station_ft"])
        )
    check(
        "S1 (recast). served == local per frame for every matched shared feature",
        s_a == 200 and s_b == 200 and matched >= 3 and worst_local <= 0.2 and zmis_local == 0,
        f"{matched} matched, max served-vs-local delta {worst_local:.3f} ft, "
        f"zone mismatches {zmis_local}; measured A/B curvature delta up to "
        f"{curvature_max:.1f} ft (the road's, declared)",
    )

    # Set-membership on Lakewood is structurally NOT evaluable: every
    # populated bucket carries its 5-record evidence cap (counts 11-25),
    # so the two responses expose different SLICES of the bbox contents,
    # not different memberships.  Recorded as a limitation; the
    # membership check runs on the Northglenn pin below, whose
    # uncapped buckets carry complete lists.
    capped = [
        k
        for k, v in (resp_b or {}).items()
        if isinstance(v, dict)
        and isinstance(v.get("features"), list)
        and len(v["features"]) >= 5
    ]
    log(
        f"  S set-membership not evaluable on Lakewood: buckets at the "
        f"5-record cap: {capped} (counts exceed the evidence window)"
    )

# ---- S2: set membership on an uncapped pin (Northglenn / Washington Way)

N_PIN = (39.886, -104.9811)
s_rb3, rb3 = post("/api/road-bearing", {"lat": N_PIN[0], "lng": N_PIN[1]})
ncand = None
if s_rb3 == 200 and rb3 and rb3.get("candidates"):
    for c in rb3["candidates"]:
        if c.get("geometry") and len(c["geometry"]) >= 2:
            ncand = c
            break
if ncand is None:
    check("S2. uncapped-pin set membership (candidate available)", False, "no candidate")
else:
    log(
        f"  S2 candidate: {ncand.get('name')!r} way {ncand.get('way_id')} "
        f"bearing {ncand.get('bearing')} geomLen {len(ncand['geometry'])}"
    )
    n_body = {
        "lat": N_PIN[0],
        "lng": N_PIN[1],
        "bearing_deg": ncand["bearing"],
        **CORRIDOR_FIELDS,
        "road_type": "urban_arterial",
    }
    s_na, resp_na = post("/api/render/detect-site", n_body)
    s_nb, resp_nb = post(
        "/api/render/detect-site", {**n_body, "centerline": ncand["geometry"]}
    )
    (OUT / "r2-s2-northglenn-chord.json").write_text(
        json.dumps(resp_na, indent=2), encoding="utf-8"
    )
    (OUT / "r2-s2-northglenn-road.json").write_text(
        json.dumps(resp_nb, indent=2), encoding="utf-8"
    )

    def _n_corridor(centerline):
        return build_corridor(
            lat=N_PIN[0],
            lng=N_PIN[1],
            bearing_deg=ncand["bearing"],
            speed_mph=40,
            work_zone_ft=800.0,
            closure_type="shoulder",
            road_type="urban_low",
            centerline=centerline,
        )

    n_chord = _n_corridor(None)
    n_road = _n_corridor(tuple((p[0], p[1]) for p in ncand["geometry"]))
    nbox_a = n_chord.corridor_bbox(lateral_buffer_m=100.0, longitudinal_buffer_m=152.4)
    nbox_b = n_road.corridor_bbox(lateral_buffer_m=100.0, longitudinal_buffer_m=152.4)

    def in_box(box, pt):
        return box[0] <= pt[0] <= box[2] and box[1] <= pt[1] <= box[3]

    def uncapped_features(resp):
        out = {}
        for k, v in (resp or {}).items():
            if (
                isinstance(v, dict)
                and isinstance(v.get("features"), list)
                and len(v["features"]) < 5
            ):
                for f in v["features"]:
                    out[(k, f["label"])] = f
        return out

    na, nb = uncapped_features(resp_na), uncapped_features(resp_nb)
    n_only_a = sorted(set(na) - set(nb))
    n_only_b = sorted(set(nb) - set(na))
    # Coords for the deltas: query Overpass over the union box.
    us, uw = min(nbox_a[0], nbox_b[0]), min(nbox_a[1], nbox_b[1])
    un, ue = max(nbox_a[2], nbox_b[2]), max(nbox_a[3], nbox_b[3])
    q3 = f"""[out:json][timeout:20];
(
  way({us},{uw},{un},{ue})["highway"="cycleway"];
  way({us},{uw},{un},{ue})["cycleway"];
  node({us},{uw},{un},{ue})["amenity"="school"];
  way({us},{uw},{un},{ue})["amenity"="school"];
);
out center tags;"""
    op3 = overpass(q3)
    n_coords = []
    for el in (op3 or {}).get("elements", []):
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lng = el.get("lon") or (el.get("center") or {}).get("lon")
        if lat is not None:
            n_coords.append((float(lat), float(lng)))
    log(
        f"  S2 Overpass coord fetch: {'FAILED' if op3 is None else f'{len(n_coords)} elements'}"
    )

    def n_match(label):
        hits = [
            (lat, lng)
            for lat, lng in n_coords
            if f"{lat:.4f}" in label and f"{lng:.4f}" in label
        ]
        return hits[0] if len(hits) == 1 else None

    unexplained = []
    n_checked = 0
    for k in n_only_a:
        pt = n_match(k[1])
        if pt is None:
            continue
        n_checked += 1
        if in_box(nbox_b, pt):
            unexplained.append(("chord-only-but-in-road-box", k))
    for k in n_only_b:
        pt = n_match(k[1])
        if pt is None:
            continue
        n_checked += 1
        if in_box(nbox_a, pt):
            unexplained.append(("road-only-but-in-chord-box", k))
    identical_sets = len(n_only_a) == 0 and len(n_only_b) == 0
    check(
        "S2 (uncapped buckets). set differences are exactly predicted bbox-membership differences",
        s_na == 200
        and s_nb == 200
        and len(na) >= 1
        and (identical_sets or (len(unexplained) == 0 and n_checked >= 1)),
        f"{len(na)}/{len(nb)} uncapped features; chord-only {len(n_only_a)}, "
        f"road-only {len(n_only_b)}, unexplained {len(unexplained)}",
    )
    if unexplained:
        log(f"  unexplained set deltas: {unexplained}")

(OUT / "r2-payload-raw.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

(OUT / "r2-payload-raw.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"\nDONE — failures: {failures}")
sys.exit(1 if failures else 0)
