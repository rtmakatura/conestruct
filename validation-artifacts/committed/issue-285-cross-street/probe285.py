"""#285: which fetch radius finds the nearest named cross street?

    python probe285.py <outdir> [reps]

For each test pin: snap to the nearest named vehicular way within 60 m
(the road the picker would confirm), then run the shared-node query at
400, 800 and 1700 m through the backend's own Overpass helper
(`_overpass_request_with_fallback`, both mirrors at once).  The query
returns every node the road's same-name ways share with another named
vehicular way; the nearest by straight-line distance from the pin is
"the cross street" at that radius.  Ryan's ruling (2026-10-14): pick the
smallest radius that finds the cross street in the test set.  "Finds"
means it names the same nearest intersection as 1700 m does.
"""

import json
import math
import sys
import time
from pathlib import Path

sys.path.insert(0, r"C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-295-stale-ink")
from src.rules.site_detection import _overpass_request_with_fallback  # noqa: E402

OUT = Path(sys.argv[1])
REPS = int(sys.argv[2]) if len(sys.argv) > 2 else 2
OUT.mkdir(parents=True, exist_ok=True)
RADII = [400, 800, 1700]
VEHICULAR = (
    "motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|"
    "tertiary|tertiary_link|unclassified|residential|living_street"
)

PINS = [
    ("N Broadway SB, Denver", 39.73370, -104.98753),
    ("Lafayette St, Denver", 39.74362, -104.97070),
    ("E Bayaud Ave, Denver", 39.71466, -104.94071),
    ("E Colfax Ave, Denver", 39.74000, -104.96000),
    ("Federal Blvd, Denver", 39.73200, -105.02500),
    ("W Alameda Ave, Lakewood", 39.71130, -105.08150),
    ("S Wadsworth Blvd, Lakewood", 39.67000, -105.08140),
    ("Lookout Mountain Rd, Golden (fixture anchor)", 39.7423111, -105.2392485),
    # Rural: (label, lat, lng, ref) -- the pin is a real node mid-way along
    # the nearest way carrying that ref within 5 km of the given point.
    ("US 40 near Cheyenne Wells", 38.8200, -102.3500, "US 40"),
    ("CO 71 south of Ordway", 38.1500, -103.7600, "CO 71"),
    ("US 40 west of Craig", 40.5000, -107.7500, "US 40"),
    ("CO 119 Boulder Canyon", 40.0050, -105.4100, "CO 119"),
    ("US 285 south of Fairplay", 39.1500, -105.9600, "US 285"),
    ("US 24 near Hartsel", 39.0200, -105.7900, "US 24"),
    ("US 287 north of Lamar", 38.1500, -102.6200, "US 287"),
    ("CO 9 north of Breckenridge", 39.5300, -106.0500, "CO 9"),
]


def hav(a, b):
    r = 6371008.8
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def seg_dist(p, a, b):
    # local equirectangular, metres
    k = math.cos(math.radians(p[0]))
    ax, ay = (a[1] - p[1]) * 111320 * k, (a[0] - p[0]) * 110540
    bx, by = (b[1] - p[1]) * 111320 * k, (b[0] - p[0]) * 110540
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
    return math.hypot(ax + t * dx, ay + t * dy)


def on_road(lat, lng, ref):
    q = f'[out:json][timeout:15];way(around:5000,{lat},{lng})[highway~"^({VEHICULAR})$"][ref~"(^|;) ?{ref}($|;)"];out geom tags;'
    data, err = _overpass_request_with_fallback(q, budget_s=25)
    if not data or not data.get("elements"):
        return None
    best = None
    for w in data["elements"]:
        g = [(n["lat"], n["lon"]) for n in w.get("geometry", []) if n]
        if len(g) < 3:
            continue
        mid = g[len(g) // 2]
        d = hav((lat, lng), mid)
        if best is None or d < best[0]:
            best = (d, mid)
    return best[1] if best else None


def snap(lat, lng):
    q = f'[out:json][timeout:15];way(around:60,{lat},{lng})[highway~"^({VEHICULAR})$"][~"^(name|ref)$"~"."];out geom tags;'
    data, err = _overpass_request_with_fallback(q, budget_s=25)
    if data is None:
        return None, err
    best = None
    for w in data.get("elements", []):
        g = [(n["lat"], n["lon"]) for n in w.get("geometry", []) if n]
        d = min((seg_dist((lat, lng), g[i], g[i + 1]) for i in range(len(g) - 1)), default=1e9)
        if best is None or d < best[0]:
            t = w["tags"]
            key = ("name", t["name"]) if "name" in t else ("ref", t["ref"])
            best = (d, key, w["id"], t.get("highway"))
    return best, None


def esc(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')


rows = []
log = open(OUT / "log.txt", "w", encoding="utf-8")


def say(s):
    print(s)
    log.write(s + "\n")
    log.flush()


for pin in PINS:
    label, lat, lng = pin[:3]
    if len(pin) == 4:
        found = on_road(lat, lng, pin[3])
        if not found:
            say(f"{label}: no way with ref {pin[3]} within 5 km")
            continue
        lat, lng = found
    s, err = snap(lat, lng)
    if not s:
        say(f"{label}: no named vehicular way within 60 m ({err})")
        rows.append({"pin": label, "lat": lat, "lng": lng, "snap": None, "err": err})
        continue
    d, (key, name), wid, hw = s
    say(f"{label} @ {lat:.6f},{lng:.6f}: road {key}='{name}' ({hw}, way {wid}, {d:.1f} m from pin)")
    for radius in RADII:
        for rep in range(REPS):
            q = (
                "[out:json][timeout:15];"
                f'way(around:{radius},{lat},{lng})[highway~"^({VEHICULAR})$"]["{key}"="{esc(name)}"]->.road;'
                "node(w.road)->.rn;"
                f'way(bn.rn)[highway~"^({VEHICULAR})$"][~"^(name|ref)$"~"."]->.touch;'
                "(.touch; - .road;)->.cross;"
                "node(w.cross)->.cn;"
                "node.rn.cn->.shared;"
                ".cross out body;"
                ".shared out skel;"
            )
            meta: dict = {}
            t0 = time.monotonic()
            data, err = _overpass_request_with_fallback(q, budget_s=25, meta=meta)
            secs = time.monotonic() - t0
            if data is None:
                say(f"   r={radius} rep{rep}: REFUSED in {secs:.2f}s ({err})")
                rows.append({"pin": label, "road": name, "radius": radius, "rep": rep, "ok": False, "s": secs, "err": err})
                continue
            els = data.get("elements", [])
            ways = [e for e in els if e["type"] == "way"]
            nodes = {e["id"]: (e["lat"], e["lon"]) for e in els if e["type"] == "node"}
            names_at = {}
            for w in ways:
                tg = w.get("tags", {})
                nm = tg.get("name") or tg.get("ref", "")
                if tg.get(key, "").strip().lower() == name.strip().lower():
                    continue
                for nid in w.get("nodes", []):
                    if nid in nodes:
                        names_at.setdefault(nid, set()).add(nm)
            cands = sorted(
                ((hav((lat, lng), nodes[n]), sorted(nm), n) for n, nm in names_at.items()),
                key=lambda c: c[0],
            )
            best = cands[0] if cands else None
            size = len(json.dumps(data))
            say(
                f"   r={radius} rep{rep}: {secs:.2f}s {size / 1024:.0f} KB, {len(nodes)} shared node(s), "
                + (f"nearest {best[1]} at {best[0]:.0f} m (node {best[2]})" if best else "NO cross street")
            )
            rows.append(
                {
                    "pin": label, "road": name, "radius": radius, "rep": rep, "ok": True, "s": round(secs, 3),
                    "kb": round(size / 1024, 1), "shared": len(nodes),
                    "nearest": {"names": best[1], "m": round(best[0], 1), "node": best[2]} if best else None,
                    "mirror": meta.get("mirror") or meta.get("overpass_mirror"),
                }
            )
            (OUT / "rows.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
            time.sleep(1.5)
(OUT / "rows.json").write_text(json.dumps(rows, indent=1), encoding="utf-8")
say("done")
