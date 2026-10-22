"""Lane-closure audit, phase 1: fetch every matrix row's outputs from production.

Usage (gate token in GATE_BYPASS_TOKEN, never printed):
    python fetch.py [row-id ...]

Adapted from audit-shoulder/fetch.py (pacing, 429 back-off, pin cache, signed
scan-token reuse for the downloads).  New for the two lane kinds (#370):

* Flagger rows build the flagger wire the way /sandbox does (a mirror of
  conestruct/site/lib/scenarios/index.ts:127-146 and auto-apply.ts:668-688):
  the detection relays (lanes, oneway, signal), no carriageway.
* Near-intersection rows mark the cross street the way an operator does: the
  site's cross-street search (/api/geocode) gives the intersection, the
  road-bearing scan there gives the cross street (mirror of
  lib/road-detection/cross-street.ts pickCrossCandidate /
  approachesFromCrossStreet), and the work-start pin is placed along the
  traffic direction so the backend measures the planned station
  (src/api/schemas.py work_start_cross_station: station = workLen - D for a
  cross street D ft downstream of the pin; workLen + U for one U ft upstream).
* Every row asks /api/render/corridor-geometry for its side options and
  writes the chosen option's `meta.work` verbatim, as the side control does
  (components/bands/WhereBand.tsx).

Pacing: GAP_S between every request; on 429 it waits out the window; on
site_scan_unavailable or an Overpass outage (road-bearing scan_status
"unavailable") it backs off 30/60/120 s and then gives up on that row.
"""

from __future__ import annotations

import copy
import json
import math
import re
import sys
import time
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from gate import gate_headers  # noqa: E402

BASE = "https://www.conestruct.com"
HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"
RUNS = HERE / "runs"
GAP_S = 4.0
DOWNLOADS = [("pdf", "plan.pdf"), ("xlsx", "devices.xlsx"), ("markdown", "crew.md"),
             ("crew-pdf", "crew.pdf"), ("quote", "quote.xlsx")]
ROAD_TYPE = {"urban": "urban_arterial", "rural": "rural_undivided"}
# Site defaults (lib/scenarios/index.ts:127-146 flagger, :211-233 near_intersection).
FLAGGER_DEFAULTS = {"workType": "utility_cut", "duration": "long",
                    "pilotCar": False, "afad": False, "pedestrianAccess": False}
NI_DEFAULTS = {"workType": "utility_cut", "duration": "short", "workLen": 500}
# CHOSEN (rulings R5): a near row with no station runs at -100 ft like N1; a
# far row puts the cross street 100 ft upstream of the work start; R8 puts it
# 200 ft into the work zone.
NEAR_STATION_FT = -100
FAR_UPSTREAM_FT = 100
INSIDE_FT = 200
FT_M = 0.3048

# --- the site's classification (mirrors; the site is authoritative) ----------
LANES_BY_CLASS = {"motorway": 2, "motorway_link": 1, "trunk": 2, "trunk_link": 1, "primary": 2,
                  "primary_link": 1, "secondary": 1, "secondary_link": 1, "tertiary": 1,
                  "tertiary_link": 1, "unclassified": 1, "residential": 1}
STREET_CLASS = {"motorway": "arterial", "motorway_link": "arterial", "trunk": "arterial",
                "trunk_link": "arterial", "primary": "arterial", "primary_link": "arterial",
                "secondary": "arterial", "secondary_link": "arterial", "tertiary": "collector",
                "tertiary_link": "collector", "unclassified": "local", "residential": "local",
                "living_street": "local", "service": "local"}
ONE_WAY = {"yes", "-1"}
STREET_CLASSES = {"primary", "secondary", "tertiary", "unclassified", "residential"}
TWIN_RADIUS_M = 100
MAX_HALF_ROAD_FT = 52
SIGNAL_NEARBY_M = 30  # cross-street.ts:24
CROSS_BEARING_TOL = 25  # cross-street.ts:107-130


def _lane_num(raw):
    try:
        n = float(raw)
    except (TypeError, ValueError):
        return None
    return math.floor(n) if n > 0 else None


def classify(cand: dict, is_urban: bool) -> dict:
    """classifyFromOsmTags, as audit-shoulder/fetch.py mirrors it."""
    hc = cand["highway_class"]
    tags = cand.get("tags") or {}
    ow = tags.get("oneway")
    oneway = ow in ONE_WAY
    carriageway = None
    divided = hc in ("motorway", "motorway_link", "trunk", "trunk_link")
    if oneway and (hc in STREET_CLASSES or hc in ("trunk", "motorway")):
        carriageway = {"oneway": ow, "highwayClass": hc,
                       "twinDistanceM": cand.get("twin_distance_m"),
                       "twinSearched": bool(cand.get("twin_searched", False))}
        if hc in ("trunk", "motorway"):
            verdict = "divided"
        elif carriageway["twinDistanceM"] is not None and carriageway["twinDistanceM"] <= TWIN_RADIUS_M:
            verdict = "divided"
        elif not carriageway["twinSearched"]:
            verdict = "undecided"
        else:
            verdict = "one_way_street"
        divided = verdict == "divided"
    fwd = _lane_num(tags.get("lanes_forward"))
    total = _lane_num(tags.get("lanes"))
    if fwd is not None:
        per_dir = fwd
    elif total is not None:
        per_dir = total if oneway else max(1, total // 2)
    else:
        per_dir = None
    lanes = per_dir if per_dir is not None else LANES_BY_CLASS.get(hc, 1)
    return {"divided": divided, "carriageway": carriageway, "oneway": ow,
            "lanesDetected": per_dir, "lanes": min(4, max(1, round(lanes))),
            "detectedLanesTotal": total, "detectedLanesForward": fwd,
            "detectedLanesBackward": _lane_num(tags.get("lanes_backward")),
            "detectedLanesBothWays": _lane_num(tags.get("lanes_both_ways")),
            "streetClass": STREET_CLASS.get(hc)}


def fit_lane_width(lanes: int, divided: bool, want: float = 12.0) -> float:
    shoulder = 10.0 if divided else 8.0
    ceiling = math.floor(((MAX_HALF_ROAD_FT - shoulder) / lanes) * 2) / 2
    return min(want, ceiling)


def snap_speed(raw) -> int | None:
    """parseMaxspeedToMph + snapSpeedToDomain('near_intersection'): 25-55, 5 mph grid."""
    if not raw:
        return None
    m = re.match(r"\s*(\d+)\s*(mph)?", str(raw))
    if not m:
        return None
    v = int(m.group(1))
    if not m.group(2):
        v = round(v / 1.609344)
    return min(55, max(25, 5 * round(v / 5)))


# --- geometry -----------------------------------------------------------------
def dest(lat: float, lng: float, bearing: float, ft: float) -> tuple[float, float]:
    r = 6371008.8
    d = ft * FT_M / r
    b, p1, l1 = math.radians(bearing), math.radians(lat), math.radians(lng)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1),
                         math.cos(d) - math.sin(p1) * math.sin(p2))
    return round(math.degrees(p2), 7), round(math.degrees(l2), 7)


def angdiff(a: float, b: float) -> float:
    return abs((a - b + 180) % 360 - 180)


# --- paced HTTP --------------------------------------------------------------
class Paced:
    def __init__(self):
        self.c = httpx.Client(headers={**gate_headers(BASE), "content-type": "application/json"},
                              timeout=300)
        self.last = 0.0
        self.log: list[str] = []

    def post(self, path: str, body: dict) -> httpx.Response:
        for attempt in range(4):
            wait = self.last + GAP_S - time.time()
            if wait > 0:
                time.sleep(wait)
            t0 = time.time()
            r = self.c.post(f"{BASE}{path}", content=json.dumps(body))
            self.last = time.time()
            msg = f"{time.strftime('%H:%M:%S')} {path} -> {r.status_code} ({self.last - t0:.1f}s)"
            print(msg, flush=True)
            self.log.append(msg)
            if r.status_code == 429:
                time.sleep(65)
                continue
            if r.status_code == 400 and "site_scan_unavailable" in r.text[:2000]:
                time.sleep(30 * 2 ** attempt)
                continue
            if path == "/api/road-bearing" and r.status_code == 200 and r.json().get("scan_status") == "unavailable":
                time.sleep(30 * 2 ** attempt)
                continue
            return r
        return r

    def cached(self, name: str, path: str, body: dict) -> dict:
        f = RUNS / "_pins" / f"{name}.json"
        if not f.exists():
            r = self.post(path, body)
            f.write_text(json.dumps({"request": body, "status": r.status_code, "response": r.json()},
                                    indent=1), "utf-8")
        return json.loads(f.read_text("utf-8"))["response"]

    def road(self, lat: float, lng: float) -> dict:
        return self.cached(f"rb_{lat:.6f}_{lng:.6f}", "/api/road-bearing", {"lat": lat, "lng": lng})


def pick(cands: list[dict], pattern: str, two_way: bool = False) -> dict | None:
    rx = re.compile(pattern, re.I)
    for cd in cands:
        if two_way and (cd.get("tags") or {}).get("oneway") in ONE_WAY:
            continue
        if rx.search(cd.get("name") or "") or rx.search(cd.get("ref") or ""):
            return cd
    return None


def pick_cross(cands: list[dict], main: dict) -> dict | None:
    """pickCrossCandidate: the nearest candidate that isn't the mainline."""
    for cd in sorted(cands, key=lambda c: c.get("snap_distance_m") or 0):
        if cd.get("way_id") == main.get("way_id") or (cd.get("name") and cd.get("name") == main.get("name")):
            continue
        if min(angdiff(cd["bearing"], main["bearing"]), angdiff(cd["bearing"], main["bearing"] + 180)) <= CROSS_BEARING_TOL:
            continue
        return cd
    return None


def approaches(cross: dict, is_urban: bool) -> list[dict]:
    """approachesFromCrossStreet (cross-street.ts:197-232)."""
    tags = cross.get("tags") or {}
    oneway = tags.get("oneway") in ONE_WAY
    fwd, total = _lane_num(tags.get("lanes_forward")), _lane_num(tags.get("lanes"))
    per_dir = fwd if fwd is not None else (total if (total and oneway) else (max(1, total // 2) if total else None))
    base = {"speed": snap_speed(tags.get("maxspeed")) or 30,
            "roadType": "urban_arterial" if is_urban else "rural_undivided",
            "lanesPerDirection": min(4, max(1, per_dir or 1)), "laneWidth": 12,
            "signalized": cross.get("signal_distance_m") is not None and cross["signal_distance_m"] <= SIGNAL_NEARBY_M}
    for k, t in (("detectedLanesTotal", "lanes"), ("detectedLanesForward", "lanes_forward"),
                 ("detectedLanesBackward", "lanes_backward"), ("detectedLanesBothWays", "lanes_both_ways")):
        if _lane_num(tags.get(t)) is not None:
            base[k] = _lane_num(tags.get(t))
    legs = [{"id": "cross_a", **base, "bearingDeg": cross["bearing"]}]
    if not oneway:
        legs.append({"id": "cross_b", **base, "bearingDeg": (cross["bearing"] + 180) % 360})
    return legs


def base_meta(row: dict, lat: float, lng: float, rb: dict, cand: dict) -> dict:
    meta = {
        "project": f"Audit {row['id']}", "address": "", "lat": lat, "lng": lng,
        "pinModel": "work_start", "centerline": cand.get("geometry"),
        "roadName": cand.get("name"), "roadRef": cand.get("ref"),
        "roadDirection": {"osmBearingDeg": cand["bearing"] % 360,
                          "oneway": (cand.get("tags") or {}).get("oneway")},
        "confirmedRoad": {"candidate": cand, "method": "operator_pick", "overrides": {},
                          "isUrban": bool(rb.get("isUrban")), "placeName": rb.get("placeName"),
                          "pinLat": lat, "pinLng": lng},
        "intersection": None,
    }
    if (row.get("extra") or {}).get("limitedSightDistance"):
        meta["siteConditions"] = {"limited_sight_distance": True}
    return meta


def guesses(s: dict, c: dict, cand: dict, juris: str | None, lat: float, lng: float) -> None:
    g = {}
    if c["streetClass"]:
        s["street_class"] = c["streetClass"]
        g["street_class"] = {"highwayClass": cand["highway_class"]}
    if juris:
        s["jurisdiction_key"] = juris
        g["jurisdiction_key"] = {"lat": lat, "lng": lng}
    if g:
        s["guesses"] = g


def apply_over(s: dict, row: dict) -> None:
    for k, v in (row.get("over") or {}).items():
        s["laneWidth" if k == "laneWidthFt" else k] = v


def flagger(row: dict, lat: float, lng: float, rb: dict, cand: dict, juris: str | None) -> dict:
    c = classify(cand, bool(rb.get("isUrban")))
    s = {"kind": "flagger_lane_closure", "meta": base_meta(row, lat, lng, rb, cand),
         **FLAGGER_DEFAULTS, "roadType": ROAD_TYPE[row["road_type"]], "speed": row["speed"],
         "laneWidth": 12, "workLen": row.get("work_ft", 400), "night": row.get("time") == "night",
         "site_scan": {"proceed_if_unavailable": False}}
    if c["oneway"] is not None:
        s["oneway"] = c["oneway"]
    for k in ("detectedLanesTotal", "detectedLanesForward", "detectedLanesBackward",
              "detectedLanesBothWays"):
        if c[k] is not None:
            s[k] = c[k]
    if cand.get("signal_distance_m") is not None:
        s["signalDistanceM"] = cand["signal_distance_m"]
    for k in ("pilotCar", "afad", "pedestrianAccess"):
        if (row.get("extra") or {}).get(k):
            s[k] = True
    guesses(s, c, cand, juris, lat, lng)
    return s


def near_intersection(row: dict, lat: float, lng: float, rb: dict, cand: dict, juris: str | None,
                      xing: dict, legs: list[dict]) -> dict:
    c = classify(cand, bool(rb.get("isUrban")))
    lanes = c["lanes"]
    s = {"kind": "near_intersection", "meta": base_meta(row, lat, lng, rb, cand),
         **NI_DEFAULTS, "roadType": ROAD_TYPE[row["road_type"]], "speed": row["speed"],
         "lanes": lanes, "laneWidth": fit_lane_width(lanes, False), "divided": False,
         "workLen": row.get("work_ft", NI_DEFAULTS["workLen"]),
         "night": row.get("time") == "night", "approaches": legs,
         "site_scan": {"proceed_if_unavailable": False}}
    s["meta"]["intersection"] = xing
    if c["carriageway"]:
        s["carriageway"] = c["carriageway"]
    extra = row.get("extra") or {}
    if extra.get("workType"):
        s["workType"] = extra["workType"]
    if extra.get("turnBayStorageFt"):
        s["turnBayStorageFt"] = extra["turnBayStorageFt"]
    guesses(s, c, cand, juris, lat, lng)
    return s


def place_work_start(p: Paced, row: dict, pin: dict, xing: dict, main_x: dict) -> dict:
    """Walk from the intersection to the work start along the traffic direction.

    Two-way roads try both directions and keep the first whose work-start pin
    snaps to the same named two-way road; a one-way road has one legal direction.
    """
    tags = main_x.get("tags") or {}
    ow = tags.get("oneway")
    b = main_x["bearing"]
    travels = [b] if ow == "yes" else [b + 180] if ow == "-1" else [b, b + 180]
    work_len = row.get("work_ft", NI_DEFAULTS["workLen"])
    side = row.get("side", "near")
    tried = []
    for t in travels:
        t %= 360
        if row["id"] == "R8":
            plat, plng = dest(xing["lat"], xing["lng"], t + 180, INSIDE_FT)
        elif side == "near":
            s = row.get("work_start_from_cross_ft", NEAR_STATION_FT)
            plat, plng = dest(xing["lat"], xing["lng"], t + 180, work_len - s)
        else:
            plat, plng = dest(xing["lat"], xing["lng"], t, FAR_UPSTREAM_FT)
        rb = p.road(plat, plng)
        cand = pick(rb.get("candidates") or [], pin["road"], two_way=ow not in ONE_WAY)
        tried.append({"traffic_bearing": t, "pin": [plat, plng],
                      "snapped": (cand or {}).get("name"), "way": (cand or {}).get("way_id")})
        if cand is not None:
            travel = "with_geometry" if angdiff(cand["bearing"], t) < 90 else "against_geometry"
            return {"lat": plat, "lng": plng, "rb": rb, "cand": cand, "travel": travel,
                    "traffic_bearing": t, "tried": tried}
    return {"error": "no work-start pin snaps to the mainline", "tried": tried}


def choose_side(p: Paced, sc: dict, side: str, travel: str | None) -> tuple[dict | None, list]:
    probe = copy.deepcopy(sc)
    probe["meta"].pop("work", None)
    g = p.post("/api/render/corridor-geometry", {"scenario": probe})
    opts = g.json().get("side_options", []) if g.status_code == 200 else []
    for o in opts:
        w = o.get("work") or {}
        if w.get("side") == side and (travel is None or w.get("travel") == travel):
            return o, opts
    return None, opts


def main(only: list[str]) -> None:
    m = json.loads((HERE / "matrix.json").read_text("utf-8"))
    pins = m["pins"]
    rows = [r for r in m["rows"] if (not only or r["id"] in only) and not r.get("deferred")]
    (RUNS / "_pins").mkdir(parents=True, exist_ok=True)
    hz = httpx.get(HEALTHZ, timeout=30).json()
    print("healthz", hz.get("sha") or hz)
    (RUNS / "healthz.json").write_text(json.dumps(hz, indent=1), "utf-8")
    p = Paced()
    for row in rows:
        out = RUNS / row["id"]
        out.mkdir(parents=True, exist_ok=True)
        pin = pins[row["pin"]]
        meta = {"row": row, "pin": pin, "healthz_sha": hz.get("sha")}

        def skip(msg: str) -> None:
            meta["error"] = msg
            (out / "fetch.json").write_text(json.dumps(meta, indent=1), "utf-8")
            print(row["id"], "SKIP", msg, flush=True)

        if row["kind"] == "flagger_lane_closure":
            lat, lng = pin["lat"], pin["lng"]
            rb = p.road(lat, lng)
            cand = pick(rb.get("candidates") or [], pin["road"])
            if cand is None:
                skip(f"no candidate matches {pin['road']!r}")
                continue
            js = p.cached(f"js_{lat:.6f}_{lng:.6f}", "/api/jurisdiction/suggest", {"lat": lat, "lng": lng})
            sc = flagger(row, lat, lng, rb, cand, js.get("suggestion"))
            want_side, want_travel = "right", None
        else:
            addr = row.get("cross") or pin["cross"]
            gq = {"address": addr}
            if pin.get("cross_juris"):
                gq["jurisdiction_key"] = pin["cross_juris"]
            gx = p.cached("geo_" + re.sub(r"\W+", "_", addr), "/api/geocode", gq)
            if gx.get("placeType") != "intersection":
                skip(f"cross-street search for {addr!r} answered {gx}")
                continue
            rbx = p.road(gx["lat"], gx["lng"])
            main_x = pick(rbx.get("candidates") or [], pin["road"])
            cross = pick_cross(rbx.get("candidates") or [], main_x) if main_x else None
            if cross is None:
                skip(f"no mainline/cross street at {addr!r}")
                continue
            xing = {"lat": gx["lat"], "lng": gx["lng"], "name": cross.get("name") or cross.get("ref")}
            legs = approaches(cross, bool(rbx.get("isUrban")))
            if row["id"] == "R10":
                # Injected: lane tags that don't add up (#120), recorded in fetch.json.
                for leg in legs:
                    leg.update({"detectedLanesTotal": 4, "detectedLanesForward": 1,
                                "detectedLanesBackward": 1})
                    leg.pop("detectedLanesBothWays", None)
                meta["injected"] = "approach lane tags 4 = 1 + 1 (#120)"
            ws = place_work_start(p, row, pin, xing, main_x)
            meta["placement"] = {k: v for k, v in ws.items() if k not in ("rb", "cand")}
            meta["cross"] = {"address": addr, "geocode": gx, "name": xing["name"],
                             "way": cross.get("way_id"), "oneway": (cross.get("tags") or {}).get("oneway")}
            if "error" in ws:
                skip(ws["error"])
                continue
            lat, lng, rb, cand = ws["lat"], ws["lng"], ws["rb"], ws["cand"]
            js = p.cached(f"js_{lat:.6f}_{lng:.6f}", "/api/jurisdiction/suggest", {"lat": lat, "lng": lng})
            sc = near_intersection(row, lat, lng, rb, cand, js.get("suggestion"), xing, legs)
            want_side, want_travel = row.get("lane", "right"), ws["travel"]
        # The side is chosen before the row's operator edits apply, so a
        # refusal row's edit (speed 60, an 8 ft lane, divided) is refused by
        # the deliverables, not by the side read.
        opt, opts = choose_side(p, sc, want_side, want_travel)
        meta["side_options"] = opts
        if opt is None and row["expect"] != "refuse":
            skip(f"no side option {want_side}/{want_travel}")
            continue
        sc["meta"]["work"] = opt["work"] if opt else {"side": want_side, "travel": want_travel or "with_geometry"}
        meta["side_label"] = opt.get("label") if opt else "not offered; sent as the row asks"
        apply_over(sc, row)
        (out / "request.json").write_text(json.dumps({"scenario": sc}, indent=1), "utf-8")
        audit_sc = copy.deepcopy(sc)
        audit_sc["include_scan_token"] = True
        audit_sc["include_breakdown"] = True
        r = p.post("/api/render/audit", {"scenario": audit_sc})
        meta["audit_status"] = r.status_code
        (out / "audit.json").write_text(r.text, "utf-8")
        token = r.json().get("site_scan_token") if r.status_code == 200 else None
        meta["scan_token"] = bool(token)
        dl_sc = copy.deepcopy(sc)
        if token:
            dl_sc["site_scan"] = {"proceed_if_unavailable": False, "token": token}
        meta["downloads"] = {}
        for kind, fname in DOWNLOADS if r.status_code == 200 else DOWNLOADS[:1]:
            d = p.post(f"/api/render/{kind}", {"scenario": dl_sc})
            meta["downloads"][kind] = {"status": d.status_code,
                                       "type": d.headers.get("content-type"), "bytes": len(d.content)}
            if d.status_code == 200:
                (out / fname).write_bytes(d.content)
            else:
                (out / f"{kind}-error.txt").write_text(d.text[:20000], "utf-8")
        (out / "fetch.json").write_text(json.dumps(meta, indent=1), "utf-8")
        print(row["id"], "audit", r.status_code, "token", bool(token),
              {k: v["status"] for k, v in meta["downloads"].items()}, flush=True)
    (RUNS / "fetch-log.txt").write_text("\n".join(p.log), "utf-8")


if __name__ == "__main__":
    main(sys.argv[1:])
