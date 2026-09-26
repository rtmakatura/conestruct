"""#243 investigate: the Note 8 per-side sign lists, measured.

Read-only.  For each corridor it
  1. POSTs the scenario to prod /api/render/audit twice, with the site scan
     (what the site sends) and without it (no scan, so no site adjustments),
     and prints prod's Note 8 row and plan_flags;
  2. replays the same two scenarios in-process at this checkout (= main =
     the prod sha; the scan is the real Overpass call) through
     render_api._placements_for, and prints every mainline sign per side;
  3. scores each option on the adjusted plan.

Then the negative case: the generator's own plan with the left-side W20-1
removed, scored under the same options (and the layout validator).

Corridors:
  broadway     prod/broadway-audit-request.json (the site's own request)
  denver-demo  prod/denver-demo-audit-request.json (the site's own request)
  e470-control E-470 southbound, 39.8281935,-104.7472008 (Adams County, open
               land): the CONTROL, a divided road where the scan finds no
               sidewalk and no bike lane.  The broadway request with the
               E-470 candidate from prod /api/road-bearing (motorway,
               oneway, 75 mph, 2 lanes), roadType freeway, 75 mph, 2 x 12 ft.
  i25-urban    I-25 South Valley Hwy SE-bound, 39.68539,-104.96427: tried as
               the control first; the scan DOES find a sidewalk there, so it
               is kept as an observation, not the control.  roadType freeway,
               60 mph (OSM maxspeed), 3 lanes x 12 ft.  Prod's own gates set
               the size: it declines the default 10.5 ft lane on a freeway
               (11 ft minimum, prod/i25-declined-page.txt), and it refuses
               OSM's 4 lanes at 11-12 ft ("4 lanes x 12.0 ft + 10 ft shoulder
               = 58.0 ft exceeds the plan sheet's drawable half-road (52 ft)").
  Both built bodies are saved beside this file (<name>-request.json).

  .venv/Scripts/python.exe note8_probe.py > note8-probe.txt
"""

from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import httpx
from pydantic import TypeAdapter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT))
sys.stdout.reconfigure(encoding="utf-8")

from src.api import render_api  # noqa: E402
from src.api.audit import build_audit_trail  # noqa: E402,F401
from src.api.schemas import Scenario, scenario_to_call  # noqa: E402
from src.rules.devices import DeviceType  # noqa: E402
from src.rules.site_adjustments import apply_site_adjustments  # noqa: E402
from src.rules.validators import validate_co_signs_both_sides  # noqa: E402

SITE = "https://www.conestruct.com"
HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"
SCN = TypeAdapter(Scenario)

# Note 8 governs "All warning and regulatory signs".  By MUTCD 11th Ed.
# chapter: 6G TTC Zone Regulatory Signs (R series; the WORK ZONE G20-5aP
# plaque is in Figure 6G-1), 6H TTC Zone Warning Signs (W series, and G20-1 /
# G20-2 / G20-4 at 6H.35-6H.37, p. 810), 6I TTC Zone Guide Signs (M4 detour
# series, 6I.02, p. 812).  S1-1 is the school advance warning sign (Part 7).
# So the literal families are every sign these plans emit except the M4 guide
# signs.  R9-9 SIDEWALK CLOSED is a 6G regulatory sign (6G.10, p. 797).
PED_FACILITY = {"R9-8", "R9-9", "R9-10", "R9-11", "R9-11a"}


def note8_family(label: str) -> bool:
    return not label.startswith("M")


# Each option: (predicate on (placement, added_by_adjustment), honours the
# "except where only one shoulder is closed" clause).
OPTIONS = {
    "today": (lambda p, adj: True, False),
    "a  literal families (drop 6I guide: M4-9a)": (lambda p, adj: note8_family(p.label or ""), False),
    "a' a, less ped facility signs (R9-8..R9-11a)": (
        lambda p, adj: note8_family(p.label or "") and (p.label or "") not in PED_FACILITY,
        False,
    ),
    "b  not added by an adjustment (origin tag)": (lambda p, adj: not adj, False),
    "c  a' and b": (
        lambda p, adj: note8_family(p.label or "") and (p.label or "") not in PED_FACILITY and not adj,
        False,
    ),
    "d  the shoulder exception only": (lambda p, adj: True, True),
    "d+a' exception, and a' elsewhere": (
        lambda p, adj: note8_family(p.label or "") and (p.label or "") not in PED_FACILITY,
        True,
    ),
}


def signs(placements):
    return [
        p
        for p in placements
        if p.approach_id == "mainline" and p.device_type == DeviceType.SIGN_GENERIC
    ]


def side_lists(placements):
    s = signs(placements)
    fmt = lambda p: f"{p.label}@{p.station_ft:,.0f}"  # noqa: E731
    left = [fmt(p) for p in sorted(s, key=lambda p: -p.station_ft) if p.offset_ft < 0]
    right = [fmt(p) for p in sorted(s, key=lambda p: -p.station_ft) if p.offset_ft > 0]
    centre = [fmt(p) for p in s if p.offset_ft == 0]
    return left, right, centre


def score(placements, added_ids, option, params):
    pred, exception = option
    s = signs(placements)
    left = sum(1 for p in s if p.offset_ft < 0 and pred(p, id(p) in added_ids))
    right = sum(1 for p in s if p.offset_ft > 0 and pred(p, id(p) in added_ids))
    required = params.is_divided and not (exception and params.closure_type == "shoulder")
    return left, right, (left == right and left > 0) if required else True, required


def line(opt, lf, rt, ok, req, prefix="option"):
    r = "" if req else " (not required: one shoulder closed)"
    return f"  {prefix} {opt:<46} {lf} left · {rt} right -> {'PASS' if ok else 'FAIL'}{r}"


# Capture which placements each call's apply_site_adjustments appended (the
# origin tag option (b) would add; the adjustments append after the
# generator's list, and limited_sight_distance only moves existing signs).
_added: list[set[int]] = []


def _recording_apply(placements, params, flags=None):
    out, records = apply_site_adjustments(placements, params, flags)
    _added.append({id(p) for p in out[len(placements):]})
    return out, records


render_api.apply_site_adjustments = _recording_apply


def relayed(body: dict) -> dict:
    """What the Next proxy sends Modal: conestruct/site/lib/scenarios/
    centerline-relay.ts withRelayedCenterline (render-proxy.ts:6)."""
    b = copy.deepcopy(body)
    meta = b["meta"]
    cr = meta.get("confirmedRoad")
    geom = (cr or {}).get("candidate", {}).get("geometry")
    if cr and geom and len(geom) >= 2 and cr["pinLat"] == meta["lat"] and cr["pinLng"] == meta["lng"]:
        meta["centerline"] = geom
        if meta.get("pinModel") == "work_start":
            meta["roadDirection"] = {
                "osmBearingDeg": cr["candidate"]["bearing"] % 360,
                "oneway": (cr["candidate"].get("tags") or {}).get("oneway"),
            }
    return b


def replay(body: dict):
    sc = SCN.validate_python(relayed(body))
    _added.clear()
    placements, params, site_records, _night, _appr, scan = render_api._placements_for(sc)
    return placements, params, site_records, scan, (_added[-1] if _added else set())


def prod_audit(body: dict):
    r = httpx.post(f"{SITE}/api/render/audit", json={"scenario": body}, timeout=180)
    r.raise_for_status()
    a = r.json()
    n8 = a["sections"]["colorado"]["checks"][0]
    return n8, a["plan_flags"], [x["flag"] for x in a["sections"].get("site_adjustments") or []]


def built_body(template: dict, lat: float, lng: float, ref: str, **fields) -> dict:
    """The site's request shape at another pin: prod's first motorway
    candidate with this ref, confirmed exactly as the picker records it."""
    cands = httpx.post(f"{SITE}/api/road-bearing", json={"lat": lat, "lng": lng}, timeout=60).json()[
        "candidates"
    ]
    cand = next(c for c in cands if c.get("ref") == ref and c["highway_class"] == "motorway")
    b = copy.deepcopy(template)
    b["meta"]["lat"], b["meta"]["lng"] = lat, lng
    b["meta"]["confirmedRoad"] = {"candidate": cand, "pinLat": lat, "pinLng": lng}
    b.update(divided=True, **fields)
    b.pop("detectedLanesTotal", None)
    b.pop("signalDistanceM", None)
    return b


def main():
    print("healthz:", httpx.get(HEALTHZ, timeout=30).json())
    load = lambda n: json.loads((HERE / "prod" / f"{n}-audit-request.json").read_text("utf-8"))[  # noqa: E731
        "scenario"
    ]
    broadway = load("broadway")
    corridors = {
        "broadway": broadway,
        "denver-demo": load("denver-demo"),
        "e470-control": built_body(
            broadway, 39.8281935, -104.7472008, "E470",
            roadType="freeway", speed=75, lanes=2, laneWidth=12,
        ),
        "i25-urban": built_body(
            broadway, 39.68539, -104.96427, "I 25",
            roadType="freeway", speed=60, lanes=3, laneWidth=12,
        ),
    }
    for n in ("e470-control", "i25-urban"):
        (HERE / f"{n}-request.json").write_text(json.dumps({"scenario": corridors[n]}), "utf-8")
    for name, body in corridors.items():
        print(f"\n==================== {name}")
        road = body["meta"]["confirmedRoad"]["candidate"]
        print(
            f"road: {road.get('name')} ({road.get('ref')}) way {road['way_id']} "
            f"{road['highway_class']} oneway={road['tags'].get('oneway')} | kind {body['kind']} "
            f"roadType {body['roadType']} {body['speed']} mph lanes {body['lanes']} "
            f"divided {body['divided']} side {body['meta']['work']}"
        )
        for mode, b in (
            ("WITH adjustments (site scan on, as the site sends)", body),
            ("WITHOUT adjustments (no site scan)", {k: v for k, v in body.items() if k != "site_scan"}),
        ):
            print(f"\n-- {mode}")
            n8, flags, adj = prod_audit(b)
            print(f"prod /api/render/audit: pass={n8['pass']} | {n8['detail']}")
            print(f"prod plan_flags: {flags} | site adjustments: {adj}")
            placements, params, records, scan, added = replay(b)
            left, right, centre = side_lists(placements)
            print(f"replay is_divided={params.is_divided} scan={scan.provenance.status} "
                  f"adjustments={[r['flag'] for r in records]}")
            print(f"  LEFT  ({len(left)}): {', '.join(left)}")
            print(f"  RIGHT ({len(right)}): {', '.join(right)}")
            if centre:
                print(f"  CENTRE ({len(centre)}): {', '.join(centre)}")
            added_signs = [p for p in signs(placements) if id(p) in added]
            print(f"  added by adjustments: {[f'{p.label}@{p.station_ft:,.0f} ({p.offset_ft:+.1f})' for p in added_signs]}")
            for opt, o in OPTIONS.items():
                print(line(opt, *score(placements, added, o, params)))

    print("\n==================== NEGATIVE CASE: the left-side W20-1 removed")
    for name, body in (
        ("broadway (shoulder, divided)", broadway),
        ("e470-control (shoulder, divided)", corridors["e470-control"]),
        ("lane closure divided (TA-19 / Case 10), 65 mph rural_divided", {
            "kind": "lane_closure_divided",
            "meta": {"project": "", "address": "", "lat": 39.8281935, "lng": -104.7472008, "bearingDeg": 180},
            "roadType": "rural_divided", "speed": 65, "laneWidth": 12,
            "workType": "pavement_repair", "duration": "short", "workLen": 1000, "night": False,
            "truckMountedAttenuator": False,
        }),
    ):
        sc = SCN.validate_python(relayed({k: v for k, v in body.items() if k != "site_scan"}))
        params, generator, kwargs = scenario_to_call(sc)
        raw = generator(params, **kwargs)
        w20 = [p for p in raw if p.label == "W20-1" and p.offset_ft < 0]
        broken = [p for p in raw if p is not w20[0]] if w20 else raw
        print(f"\n-- {name}: generator plan {len(signs(raw))} signs; removed {w20[0].label}@{w20[0].station_ft:,.0f} ({w20[0].offset_ft:+.1f})" if w20 else f"\n-- {name}: no left W20-1 to remove")
        for opt, o in OPTIONS.items():
            print(line(opt, *score(broken, set(), o, params)))
        v = validate_co_signs_both_sides(broken, params)
        print(f"  validator CO_SIGN_BOTH_SIDES: {len(v)} error(s): {[x.message for x in v]}")
        # And the same plan WITH the Broadway-style ped adjustment on top.
        adj, _ = apply_site_adjustments(broken, params, {"pedestrian_facility": True, "bicycle_facility": True})
        added = {id(p) for p in adj[len(broken):]}
        for opt, o in OPTIONS.items():
            print(line(opt, *score(adj, added, o, params), prefix="+ped&bike"))


if __name__ == "__main__":
    main()
