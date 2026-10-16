"""Shoulder-work audit, phase 1: fetch every matrix row's outputs from production.

Usage (gate token in GATE_BYPASS_TOKEN, never printed):
    python fetch.py [row-id ...]

For each pin it asks /api/road-bearing once (cached under runs/_pins/) and
/api/jurisdiction/suggest once, then builds the scenario the way /sandbox
does (a mirror of conestruct/site/lib/road-detection/classify.ts,
carriageway.ts and lib/scenarios/auto-apply.ts; see `classify`).  For each
row it posts /api/render/audit with include_scan_token, then reuses that
signed token for the five downloads (ruling c, 2026-10-16), so production
scans each corridor once.

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

# --- the site's classification (mirrors; the site is authoritative) ----------
SPEED_BY_CLASS = {"motorway": 65, "motorway_link": 45, "trunk": 55, "trunk_link": 45,
                  "primary": 45, "primary_link": 35, "secondary": 40, "secondary_link": 30,
                  "tertiary": 35, "tertiary_link": 30, "unclassified": 30, "residential": 25}
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


def _lane_num(raw):
    try:
        n = float(raw)
    except (TypeError, ValueError):
        return None
    return math.floor(n) if n > 0 else None


def classify(cand: dict, is_urban: bool) -> dict:
    """classifyFromOsmTags + applyDetected for a shoulder plan."""
    hc = cand["highway_class"]
    tags = cand.get("tags") or {}
    ow = tags.get("oneway")
    oneway = ow in ONE_WAY
    if hc in ("motorway", "motorway_link"):
        rt, divided = "freeway", True
    elif hc in ("trunk", "trunk_link"):
        rt, divided = ("urban_arterial" if is_urban else "rural_divided"), True
    elif hc == "primary_link" and oneway:
        rt, divided = ("urban_arterial" if is_urban else "rural_divided"), True
    else:
        rt, divided = ("urban_arterial" if is_urban else "rural_undivided"), False
    carriageway = None
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
        if not is_urban:
            rt = "rural_divided" if divided else "rural_undivided"
    fwd = _lane_num(tags.get("lanes_forward"))
    total = _lane_num(tags.get("lanes"))
    if fwd is not None:
        per_dir = fwd
    elif total is not None:
        per_dir = total if oneway else max(1, total // 2)
    else:
        per_dir = None
    lanes = per_dir if per_dir is not None else LANES_BY_CLASS.get(hc, 1)
    return {"roadType": rt, "divided": divided, "carriageway": carriageway,
            "lanesDetected": per_dir, "lanes": min(4, max(1, round(lanes))),
            "detectedLanesTotal": total,
            "detectedLanesForward": fwd,
            "detectedLanesBackward": _lane_num(tags.get("lanes_backward")),
            "detectedLanesBothWays": _lane_num(tags.get("lanes_both_ways")),
            "streetClass": STREET_CLASS.get(hc)}


def fit_lane_width(lanes: int, divided: bool, want: float = 12.0) -> float:
    shoulder = 10.0 if divided else 8.0
    ceiling = math.floor(((MAX_HALF_ROAD_FT - shoulder) / lanes) * 2) / 2
    return min(want, ceiling)


def scenario(row: dict, pin: dict, rb: dict, cand: dict, juris: str | None) -> dict:
    c = classify(cand, bool(rb.get("isUrban")))
    lanes = c["lanes"]
    meta = {
        "project": f"Audit {row['n']} {row['id']}", "address": "",
        "lat": pin["lat"], "lng": pin["lng"], "pinModel": "work_start",
        "confirmedRoad": {"candidate": cand, "classification": {
            "roadType": c["roadType"], "divided": c["divided"], "laneWidthFt": 12,
            "lanesPerDirection": c["lanesDetected"]},
            "method": "operator_pick", "overrides": {}, "isUrban": bool(rb.get("isUrban")),
            "placeName": rb.get("placeName"), "pinLat": pin["lat"], "pinLng": pin["lng"]},
        "intersection": None,
        "work": {"side": row["side"], "travel": row.get("travel", "with_geometry")},
    }
    if row.get("lsd"):
        meta["siteConditions"] = {"limited_sight_distance": True}
    s = {
        "kind": "shoulder", "meta": meta,
        "roadType": c["roadType"], "speed": row["speed"], "lanes": lanes,
        "laneWidth": fit_lane_width(lanes, c["divided"]), "divided": c["divided"],
        "workType": "utility_locate", "duration": "short", "workLen": row["len"],
        "night": row["night"], "site_scan": {"proceed_if_unavailable": False},
    }
    for k in ("detectedLanesTotal", "detectedLanesForward", "detectedLanesBackward",
              "detectedLanesBothWays"):
        if c[k] is not None:
            s[k] = c[k]
    if c["lanesDetected"] is not None:
        s["roadLanesPerDirection"] = c["lanesDetected"]
    if cand.get("signal_distance_m") is not None:
        s["signalDistanceM"] = cand["signal_distance_m"]
    if c["carriageway"]:
        s["carriageway"] = c["carriageway"]
    guesses = {}
    if c["streetClass"]:
        s["street_class"] = c["streetClass"]
        guesses["street_class"] = {"highwayClass": cand["highway_class"]}
    if juris:
        s["jurisdiction_key"] = juris
        guesses["jurisdiction_key"] = {"lat": pin["lat"], "lng": pin["lng"]}
    if guesses:
        s["guesses"] = guesses
    for k, v in (row.get("over") or {}).items():
        s[k] = v
    return s


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


def pick(cands: list[dict], pattern: str) -> dict | None:
    rx = re.compile(pattern, re.I)
    for cd in cands:
        if rx.search(cd.get("name") or "") or rx.search(cd.get("ref") or ""):
            return cd
    return None


def main(only: list[str]) -> None:
    m = json.loads((HERE / "matrix.json").read_text("utf-8"))
    pins = m["pins"]
    rows = [r for r in m["rows"] if not only or r["id"] in only or r["n"] in only]
    (RUNS / "_pins").mkdir(parents=True, exist_ok=True)
    hz = httpx.get(HEALTHZ, timeout=30).json()
    print("healthz", hz.get("sha") or hz)
    (RUNS / "healthz.json").write_text(json.dumps(hz, indent=1), "utf-8")
    p = Paced()
    for row in rows:
        out = RUNS / row["id"]
        out.mkdir(parents=True, exist_ok=True)
        pin = pins[row["pin"]]
        pc = RUNS / "_pins" / f"{row['pin']}.json"
        if not pc.exists():
            rb = p.post("/api/road-bearing", {"lat": pin["lat"], "lng": pin["lng"]}).json()
            js = p.post("/api/jurisdiction/suggest", {"lat": pin["lat"], "lng": pin["lng"]}).json()
            pc.write_text(json.dumps({"road_bearing": rb, "jurisdiction": js}, indent=1), "utf-8")
        pinfo = json.loads(pc.read_text("utf-8"))
        rb, js = pinfo["road_bearing"], pinfo["jurisdiction"]
        cand = pick(rb.get("candidates") or [], pin["road"])
        meta = {"row": row, "pin": pin, "healthz_sha": hz.get("sha")}
        if cand is None:
            meta["error"] = f"no candidate matches {pin['road']!r}: " + ", ".join(
                f"{c.get('name')}/{c.get('ref')}" for c in rb.get("candidates") or [])
            (out / "fetch.json").write_text(json.dumps(meta, indent=1), "utf-8")
            print(row["id"], "SKIP", meta["error"])
            continue
        sc = scenario(row, pin, rb, cand, js.get("suggestion"))
        (out / "request.json").write_text(json.dumps({"scenario": sc}, indent=1), "utf-8")
        audit_sc = copy.deepcopy(sc)
        audit_sc["include_scan_token"] = True
        audit_sc["include_breakdown"] = True
        r = p.post("/api/render/audit", {"scenario": audit_sc})
        meta["audit_status"] = r.status_code
        (out / "audit.json").write_text(r.text, "utf-8")
        token = None
        if r.status_code == 200:
            token = r.json().get("site_scan_token")
        meta["scan_token"] = bool(token)
        dl_sc = copy.deepcopy(sc)
        if token:
            dl_sc["site_scan"] = {"proceed_if_unavailable": False, "token": token}
        meta["downloads"] = {}
        kinds = DOWNLOADS if r.status_code == 200 else DOWNLOADS[:1]
        for kind, fname in kinds:
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
