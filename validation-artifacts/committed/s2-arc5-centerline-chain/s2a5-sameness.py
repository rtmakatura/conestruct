"""s2-arc5 pre-code sameness check (GO ruling 6) — READ-ONLY.

For each reference pin: the PRODUCTION road-bearing response's candidate
geometry is the current stitcher's live output.  Fetch the same-name
Overpass pool, run the prototype stitcher (progress-constrained joins +
bounded-gap bridging, GAP 60 / HEADING 60, oneway tie-break), trim to
±1700 m of the snapped point exactly as the route does, and compare
vertex-for-vertex.  IDENTICAL = zero churn at that pin.  DIFFERENT =
enumerated churn, predicted before any code ships.
"""

import json
import math
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
HERE = Path(__file__).parent
CACHE = HERE / "pools"
CACHE.mkdir(exist_ok=True)

PINS = [
    ("northglenn", 39.886, -104.9811),
    ("lakewood", 39.7113, -105.0815),
    ("colfax", 39.73997, -104.96632),
    ("bayaud", 39.71466, -104.94071),
]

GAP_MAX_M = 60.0
HEADING_TOL_DEG = 60.0
GEOMETRY_RADIUS_M = 1700.0
GEOMETRY_MAX_NODES = 300


def post_json(url, body):
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def overpass(q, cache_name):
    f = CACHE / cache_name
    if f.exists():
        return json.load(open(f, encoding="utf-8"))
    last = None
    for url in (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.openstreetmap.fr/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
    ):
        req = urllib.request.Request(
            url,
            data=("data=" + urllib.parse.quote(q)).encode(),
            headers={
                "content-type": "application/x-www-form-urlencoded",
                "user-agent": "conestruct-triage/s2a5",
            },
        )
        try:
            j = json.load(urllib.request.urlopen(req, timeout=30))
            json.dump(j, open(f, "w", encoding="utf-8"))
            time.sleep(4)
            return j
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(4)
    raise last


def hav(a, b, c, d):
    R = 6371008.8
    p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c - a), math.radians(d - b)
    x = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def ib(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    dl = math.radians(d - b)
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1) * math.sin(p2) - math.sin(p1) * math.cos(p2) * math.cos(dl)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def key_of(n):
    return f"{n['lat']:.7f},{n['lon']:.7f}"


def heading_diff(a, b):
    return abs(((a - b + 540) % 360) - 180)


def end_heading(chain, at_tail):
    if at_tail:
        return ib(chain[-2]["lat"], chain[-2]["lon"], chain[-1]["lat"], chain[-1]["lon"])
    return ib(chain[1]["lat"], chain[1]["lon"], chain[0]["lat"], chain[0]["lon"])


def oneway_dir(w):
    ow = (w.get("tags", {}) or {}).get("oneway")
    return ow if ow in ("yes", "-1") else None


def try_extend(chain, w, at_tail):
    g = w["geometry"]
    end = chain[-1] if at_tail else chain[0]
    ch = end_heading(chain, at_tail)
    options = []
    for rev, oriented in ((False, g), (True, list(reversed(g)))):
        d = hav(end["lat"], end["lon"], oriented[0]["lat"], oriented[0]["lon"])
        exact = key_of(oriented[0]) == key_of(end)
        if not exact and d > GAP_MAX_M:
            continue
        wh = ib(oriented[0]["lat"], oriented[0]["lon"], oriented[1]["lat"], oriented[1]["lon"])
        if not exact:
            gh = ib(end["lat"], end["lon"], oriented[0]["lat"], oriented[0]["lon"])
            if heading_diff(gh, ch) > HEADING_TOL_DEG:
                continue
        if heading_diff(wh, ch) > HEADING_TOL_DEG:
            continue
        # oneway agreement: consumed forward (not reversed) matches a
        # oneway=yes way's travel direction; reversed opposes it.
        ow = oneway_dir(w)
        agrees = 1 if ow is None else (0 if (ow == "yes") == (not rev) else 1)
        options.append((0.0 if exact else d, agrees, oriented, exact))
    if not options:
        return None
    options.sort(key=lambda t: (t[0], t[1]))
    d, agrees, oriented, exact = options[0]
    return (oriented[1:] if exact else oriented), d, exact


def stitch_proto(own, pool_ways):
    chain = list(own["geometry"])
    used = {own["id"]}
    bridges = []
    for at_tail in (True, False):
        grew = True
        while grew:
            grew = False
            best = None
            for w in pool_ways:
                if w["id"] in used:
                    continue
                r = try_extend(chain, w, at_tail)
                if r is None:
                    continue
                app, d, exact = r
                if best is None or d < best[1]:
                    best = (w, d, app, exact)
            if best is not None:
                w, d, app, exact = best
                if at_tail:
                    chain = chain + app
                else:
                    chain = list(reversed(app)) + chain
                used.add(w["id"])
                if not exact:
                    bridges.append((w["id"], round(d, 1)))
                grew = True
    return chain, used, bridges


def stitch_current(own, pool_ways):
    chain = list(own["geometry"])
    used = {own["id"]}
    grew = True
    while grew:
        grew = False
        head = key_of(chain[0])
        tail = key_of(chain[-1])
        for w in pool_ways:
            if w["id"] in used:
                continue
            g = w["geometry"]
            s, e = key_of(g[0]), key_of(g[-1])
            if s == tail:
                chain = chain + g[1:]
            elif e == tail:
                chain = chain + list(reversed(g))[1:]
            elif e == head:
                chain = g[:-1] + chain
            elif s == head:
                chain = list(reversed(g))[:-1] + chain
            else:
                continue
            used.add(w["id"])
            grew = True
    return chain, used


def trim(chain, ref_lat, ref_lng):
    cum = [0.0]
    for i in range(len(chain) - 1):
        cum.append(cum[i] + hav(chain[i]["lat"], chain[i]["lon"], chain[i + 1]["lat"], chain[i + 1]["lon"]))
    ref_idx = 0
    ref_d = math.inf
    for i, n in enumerate(chain):
        d = hav(ref_lat, ref_lng, n["lat"], n["lon"])
        if d < ref_d:
            ref_d = d
            ref_idx = i
    ref_arc = cum[ref_idx]
    kept = [n for i, n in enumerate(chain) if abs(cum[i] - ref_arc) <= GEOMETRY_RADIUS_M]
    if len(kept) > GEOMETRY_MAX_NODES:
        interior = kept[1:-1]
        stride = len(interior) / (GEOMETRY_MAX_NODES - 2)
        kept = [kept[0]] + [interior[int(i * stride)] for i in range(GEOMETRY_MAX_NODES - 2)] + [kept[-1]]
    return [[round(n["lat"], 7), round(n["lon"], 7)] for n in kept]


for name, lat, lng in PINS:
    served = post_json("https://www.conestruct.com/api/road-bearing", {"lat": lat, "lng": lng})
    cands = served.get("candidates") or []
    if not cands:
        print(f"== {name}: NO candidates served (transient?) — rerun")
        continue
    c = cands[served.get("primary_index") or 0]
    cname = c.get("name")
    served_geom = [[round(p[0], 7), round(p[1], 7)] for p in (c.get("geometry") or [])]
    q = (
        f'[out:json][timeout:10];'
        f'(way(around:{GEOMETRY_RADIUS_M:.0f},{lat},{lng})["highway"]["name"="{cname}"];);'
        f"out geom tags;"
    )
    pool = overpass(q, f"sameness-{name}.json")
    ways = [e for e in pool.get("elements", []) if e["type"] == "way" and len(e.get("geometry", [])) >= 2]
    own = next((w for w in ways if str(w["id"]) == c.get("way_id")), None)
    if own is None:
        print(f"== {name}: own way {c.get('way_id')} not in pool — investigate")
        continue
    cur_chain, _ = stitch_current(own, ways)
    cur = trim(cur_chain, c["snapped_lat"], c["snapped_lng"])
    p_chain, p_used, bridges = stitch_proto(own, ways)
    pro = trim(p_chain, c["snapped_lat"], c["snapped_lng"])
    replay_ok = cur == served_geom
    same = pro == served_geom
    print(
        f"== {name} ({cname!r} way {c['way_id']}): served {len(served_geom)} pts; "
        f"replay-of-current {'MATCHES served' if replay_ok else 'DIFFERS from served (' + str(len(cur)) + ' pts)'}; "
        f"proto {'IDENTICAL' if same else f'DIFFERS ({len(pro)} pts, bridges {bridges})'}"
    )
