"""s2-arc5 investigation: replay the stitch at multiple sites; prototype fixes.

READ-ONLY vs the repo.  Fetches same-name Overpass pools (cached to disk),
replays stitchChain exactly as route.ts implements it, computes coverage
for a realistic corridor, and measures hairpins.  Then prototypes
approach A (progress-constrained joins + bounded-gap bridging) for
comparison.  Deterministic given the cached pools.
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

M_PER_FT = 0.3048

SITES = [
    # key, pin, corridor bearing (deg, direction the corridor walks), name
    ("bayaud", (39.71466, -104.94071), 85.33, "East Bayaud Avenue"),
    ("colorado", (39.7135, -104.94055), 1.59, "South Colorado Boulevard"),
    ("cedar", (39.70955, -104.94071), 85.0, "East Cedar Avenue"),
    ("sixth", (39.72590, -104.94150), 85.0, "East 6th Avenue"),
    ("bayaud_couplet", (39.71468, -104.94380), 265.0, "East Bayaud Avenue"),
    ("lookout", (39.7423111, -105.2392485), 171.8, "Lookout Mountain Road"),
]


def fetch_pool(key, pin, name):
    f = CACHE / f"{key}.json"
    if f.exists():
        return json.load(open(f, encoding="utf-8"))
    q = (
        f'[out:json][timeout:10];'
        f'(way(around:1700,{pin[0]},{pin[1]})["highway"]["name"="{name}"];);'
        f"out geom tags;"
    )
    last = None
    for url in (
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass-api.de/api/interpreter",
        "https://overpass.openstreetmap.fr/api/interpreter",
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
            time.sleep(5)
            return j
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(5)
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


def ways_of(pool):
    return [
        e
        for e in pool.get("elements", [])
        if e["type"] == "way" and len(e.get("geometry", [])) >= 2
    ]


# ---- current stitch, byte-faithful to route.ts:385-415 ---------------------
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


# ---- prototype A: progress-constrained joins + bounded-gap bridging --------
GAP_MAX_M = 80.0  # candidate value; the ruling decides
HEADING_TOL_DEG = 60.0


def heading_diff(a, b):
    return abs(((a - b + 540) % 360) - 180)


def end_heading(chain, at_tail):
    if at_tail:
        return ib(chain[-2]["lat"], chain[-2]["lon"], chain[-1]["lat"], chain[-1]["lon"])
    return ib(chain[1]["lat"], chain[1]["lon"], chain[0]["lat"], chain[0]["lon"])


def try_extend(chain, w, at_tail, allow_gap):
    """Return the oriented geometry to append (w/o the shared node) or None.

    Progress constraint: the joined way's initial heading (leaving the
    chain end) must be within HEADING_TOL_DEG of the chain's end heading —
    this rejects couplet return-halves and any doubling back.
    Bounded gap: when no endpoint matches exactly, accept a join whose
    endpoint is within GAP_MAX_M of the chain end (heading still applies)
    and record the gap as a synthetic straight connector.
    """
    g = w["geometry"]
    end = chain[-1] if at_tail else chain[0]
    ch = end_heading(chain, at_tail)
    options = []
    for oriented in (g, list(reversed(g))):
        d = hav(end["lat"], end["lon"], oriented[0]["lat"], oriented[0]["lon"])
        exact = key_of(oriented[0]) == key_of(end)
        if not exact and (not allow_gap or d > GAP_MAX_M):
            continue
        wh = ib(oriented[0]["lat"], oriented[0]["lon"], oriented[1]["lat"], oriented[1]["lon"])
        # heading of the connector itself must also progress
        if not exact:
            gh = ib(end["lat"], end["lon"], oriented[0]["lat"], oriented[0]["lon"])
            if heading_diff(gh, ch) > HEADING_TOL_DEG:
                continue
        if heading_diff(wh, ch) > HEADING_TOL_DEG:
            continue
        options.append((0.0 if exact else d, oriented, exact))
    if not options:
        return None
    options.sort(key=lambda t: t[0])
    d, oriented, exact = options[0]
    return (oriented[1:] if exact else oriented), d, exact


def stitch_proto(own, pool_ways, anchor, bearing):
    # orient the own way so its tail is the corridor's walk direction
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
                r = try_extend(chain, w, at_tail, allow_gap=True)
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


# ---- frame math (byte-faithful to centerline.ts) ----------------------------
def frame_coverage(chain, anchor, bearing):
    pts = [(n["lat"], n["lon"]) for n in chain]
    cum = [0.0]
    for i in range(len(pts) - 1):
        cum.append(cum[-1] + hav(*pts[i], *pts[i + 1]))
    best = (math.inf, 0.0, 0)
    for i in range(len(pts) - 1):
        kx = math.cos(math.radians(anchor[0])) * 111320
        ky = 110540
        ax = (pts[i][1] - anchor[1]) * kx
        ay = (pts[i][0] - anchor[0]) * ky
        bx = (pts[i + 1][1] - anchor[1]) * kx
        by = (pts[i + 1][0] - anchor[0]) * ky
        dx, dy = bx - ax, by - ay
        ls = dx * dx + dy * dy
        t = 0 if ls == 0 else max(0, min(1, -(ax * dx + ay * dy) / ls))
        d = math.hypot(ax + t * dx, ay + t * dy)
        if d < best[0]:
            best = (d, cum[i] + t * (cum[i + 1] - cum[i]), i)
    snap_d, arc, seg = best
    tangent = ib(*pts[seg], *pts[seg + 1])
    diff = ((tangent - bearing + 540) % 360) - 180
    sign = 1 if abs(diff) <= 90 else -1
    cov_ft = ((cum[-1] - arc) if sign > 0 else arc) / M_PER_FT
    return snap_d, cov_ft, sign


def hairpin_metric(chain):
    """Count vertex-to-vertex heading reversals > 150 deg (a real road
    polyline essentially never reverses between adjacent segments)."""
    n = 0
    worst = 0.0
    for i in range(len(chain) - 2):
        h1 = ib(chain[i]["lat"], chain[i]["lon"], chain[i + 1]["lat"], chain[i + 1]["lon"])
        h2 = ib(chain[i + 1]["lat"], chain[i + 1]["lon"], chain[i + 2]["lat"], chain[i + 2]["lon"])
        d = heading_diff(h1, h2)
        if d > 150:
            n += 1
        worst = max(worst, d)
    return n, worst


CORRIDOR_FT = 3110.0

for key, pin, bearing, name in SITES:
    pool = fetch_pool(key, pin, name)
    ways = ways_of(pool)
    if not ways:
        print(f"== {key}: NO WAYS for {name!r}")
        continue
    # own way = nearest to pin (same as route's snap winner among same-name)
    def snap_d(w):
        return min(
            hav(pin[0], pin[1], n["lat"], n["lon"]) for n in w["geometry"]
        )
    own = min(ways, key=snap_d)
    cur_chain, cur_used = stitch_current(own, ways)
    sd, cov, sign = frame_coverage(cur_chain, pin, bearing)
    hp, worst = hairpin_metric(cur_chain)
    print(f"== {key} ({name}, {len(ways)} ways, own={own['id']}, oneway={own.get('tags',{}).get('oneway')})")
    print(
        f"   CURRENT: chain {len(cur_chain)} pts / {sum(hav(cur_chain[i]['lat'],cur_chain[i]['lon'],cur_chain[i+1]['lat'],cur_chain[i+1]['lon']) for i in range(len(cur_chain)-1)):.0f} m, "
        f"ways used {len(cur_used)}, coverage {cov:.0f} ft of {CORRIDOR_FT:.0f}, "
        f"hairpins {hp} (worst adj-heading delta {worst:.0f} deg)"
    )
    p_chain, p_used, bridges = stitch_proto(own, ways, pin, bearing)
    sd2, cov2, sign2 = frame_coverage(p_chain, pin, bearing)
    hp2, worst2 = hairpin_metric(p_chain)
    print(
        f"   PROTO-A: chain {len(p_chain)} pts, ways used {len(p_used)}, "
        f"bridges {bridges}, coverage {cov2:.0f} ft, hairpins {hp2} (worst {worst2:.0f} deg)"
    )
