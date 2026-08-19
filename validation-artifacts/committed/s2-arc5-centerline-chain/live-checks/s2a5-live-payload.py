"""s2-arc5 live checks, payload series (Refs #210, #211) — READ-ONLY.

Production through the public proxy at 5a06f25.

  P1 — the served E Bayaud chain is fixed: extends east across the
       divided S Colorado crossing, no adjacent-heading reversal >= 150°,
       and station-frame coverage now exceeds the 3,110 ft corridor.
  P2 — #207-method agreement at E Bayaud: detect-site with the relayed
       (fixed) chain; features east of Colorado appear (the pre-fix bbox
       ended ~20 ft east of the pin, so they structurally could not);
       for lateral-zone features the reported along-station agrees with
       an independent projection onto the SAME relayed chain (sub-5 ft).
  P3 — no-flip controls: Northglenn (vs the committed s2-arc3 r2
       captures) and Lakewood (vs the committed s2-arc4 P2 capture):
       every feature present in BOTH frames keeps (zone, relevant).
  P4 — the partial-coverage class still serves honestly: the S Colorado
       pin's chain ends at the Ellsworth name change; coverage < the
       corridor; no reversal (raw material for the browser B2 check).
"""

import json
import math
import sys
import time
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(__file__).resolve().parents[4] if False else Path(
    "C:/Users/rtmak/Documents/traffic-control-tool"
)
OUT = Path(__file__).parent / "outS2A5-live"
OUT.mkdir(exist_ok=True)
BASE = "https://www.conestruct.com"
R2 = ROOT / "validation-artifacts/committed/s2-arc3-classification-frame/live-checks/outS2A3"
A4 = ROOT / "validation-artifacts/committed/s2-arc4-16-thresholds/live-checks/outS2A4"

M_PER_FT = 0.3048
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


def post(path, body, timeout=90):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode())
    except Exception as e:  # noqa: BLE001
        return None, f"{type(e).__name__}: {e}"


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


def max_reversal(pts):
    worst = 0.0
    for i in range(len(pts) - 2):
        h1 = ib(*pts[i], *pts[i + 1])
        h2 = ib(*pts[i + 1], *pts[i + 2])
        worst = max(worst, abs(((h1 - h2 + 540) % 360) - 180))
    return worst


def coverage_ft(pts, anchor, bearing):
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
    _, arc, seg = best
    tangent = ib(*pts[seg], *pts[seg + 1])
    sign = 1 if abs(((tangent - bearing + 540) % 360) - 180) <= 90 else -1
    return ((cum[-1] - arc) if sign > 0 else arc) / M_PER_FT


def station_of(pts, p):
    """Arc station (ft) of the projection of p onto the polyline."""
    cum = [0.0]
    for i in range(len(pts) - 1):
        cum.append(cum[-1] + hav(*pts[i], *pts[i + 1]))
    best = (math.inf, 0.0)
    for i in range(len(pts) - 1):
        kx = math.cos(math.radians(p[0])) * 111320
        ky = 110540
        ax = (pts[i][1] - p[1]) * kx
        ay = (pts[i][0] - p[0]) * ky
        bx = (pts[i + 1][1] - p[1]) * kx
        by = (pts[i + 1][0] - p[0]) * ky
        dx, dy = bx - ax, by - ay
        ls = dx * dx + dy * dy
        t = 0 if ls == 0 else max(0, min(1, -(ax * dx + ay * dy) / ls))
        d = math.hypot(ax + t * dx, ay + t * dy)
        if d < best[0]:
            best = (d, cum[i] + t * (cum[i + 1] - cum[i]))
    return best[1] / M_PER_FT


def feature_map(resp):
    out = {}
    for k, v in (resp or {}).items():
        if isinstance(v, dict) and isinstance(v.get("features"), list):
            for f in v["features"]:
                out[(k, f.get("label"))] = (f.get("zone"), f.get("relevant"))
    return out


# ---- P1: the served E Bayaud chain -----------------------------------------
B_PIN = (39.71466, -104.94071)
s, rb = post("/api/road-bearing", {"lat": B_PIN[0], "lng": B_PIN[1]})
bcand = None
if s == 200 and isinstance(rb, dict):
    for c in rb.get("candidates") or []:
        if "bayaud" in (c.get("name") or "").lower() and c.get("geometry"):
            bcand = c
            break
(OUT / "p1-bayaud-road-bearing.json").write_text(json.dumps(rb, indent=1), encoding="utf-8")
if bcand is None:
    check("P1. E Bayaud candidate served", False, f"road-bearing {s}")
else:
    g = [(p[0], p[1]) for p in bcand["geometry"]]
    max_lon = max(p[1] for p in g)
    rev = max_reversal(g)
    cov = coverage_ft(g, B_PIN, bcand["bearing"])
    check(
        "P1. the served chain crosses S Colorado, no reversal, coverage exceeds the corridor",
        max_lon > -104.93 and rev < 150 and cov > 3110,
        f"{len(g)} pts, east to lon {max_lon:.5f}, worst reversal {rev:.0f}°, coverage {cov:.0f} ft",
    )

# ---- P2: #207-method agreement at E Bayaud ---------------------------------
if bcand is not None:
    body = {
        "lat": B_PIN[0],
        "lng": B_PIN[1],
        "bearing_deg": bcand["bearing"],
        "speed_mph": 40,
        "work_zone_ft": 1000,
        "closure_type": "shoulder",
        "road_type": "urban_arterial",
        "lane_width_ft": 12,
        "centerline": bcand["geometry"],
    }
    s2, det = post("/api/render/detect-site", body)
    (OUT / "p2-bayaud-detect-road.json").write_text(json.dumps(det, indent=1), encoding="utf-8")
    if s2 != 200:
        check("P2. E Bayaud detect serves", False, f"HTTP {s2}")
    else:
        east = 0
        agree = []
        for k, v in det.items():
            if not isinstance(v, dict) or not isinstance(v.get("features"), list):
                continue
            for f in v["features"]:
                lat, lon = f.get("lat"), f.get("lng")
                if lon is not None and lon > -104.9395:
                    east += 1
                if (
                    f.get("zone") == "lateral"
                    and f.get("along_station_ft") is not None
                    and lat is not None
                ):
                    mine = station_of([(p[0], p[1]) for p in bcand["geometry"]], (lat, lon))
                    anchor_st = station_of(
                        [(p[0], p[1]) for p in bcand["geometry"]], B_PIN
                    )
                    # backend stations are signed from the anchor along the
                    # walk; compare absolute along-arc offsets
                    delta = abs(abs(mine - anchor_st) - abs(f["along_station_ft"]))
                    agree.append((f.get("label"), round(delta, 2)))
        worst = max((d for _, d in agree), default=None)
        check(
            "P2. features east of Colorado are fetched+classified; along-stations agree with an independent projection",
            east > 0 and worst is not None and worst < 5.0,
            f"{east} features east of the crossing; {len(agree)} lateral agreements, worst {worst} ft",
        )
        for lbl, d in agree[:4]:
            log(f"  agreement: {lbl!r} Δ {d} ft")

# ---- P3: no-flip controls ---------------------------------------------------
N_PIN = (39.886, -104.9811)
s3, rb2 = post("/api/road-bearing", {"lat": N_PIN[0], "lng": N_PIN[1]})
ncand = next(
    (c for c in (rb2.get("candidates") or []) if c.get("geometry")), None
) if s3 == 200 and isinstance(rb2, dict) else None
if ncand is None:
    check("P3a. Northglenn candidate", False, f"road-bearing {s3}")
else:
    n_body = {
        "lat": N_PIN[0],
        "lng": N_PIN[1],
        "bearing_deg": ncand["bearing"],
        "speed_mph": 40,
        "work_zone_ft": 800,
        "closure_type": "shoulder",
        "road_type": "urban_arterial",
        "lane_width_ft": 12,
    }
    sa, ra = post("/api/render/detect-site", n_body)
    sb, rbb = post("/api/render/detect-site", {**n_body, "centerline": ncand["geometry"]})
    (OUT / "p3-northglenn-chord.json").write_text(json.dumps(ra, indent=1), encoding="utf-8")
    (OUT / "p3-northglenn-road.json").write_text(json.dumps(rbb, indent=1), encoding="utf-8")
    flips, matched, drift = [], 0, 0
    for old_name, new in (
        ("r2-s2-northglenn-chord.json", ra),
        ("r2-s2-northglenn-road.json", rbb),
    ):
        old = feature_map(json.loads((R2 / old_name).read_text(encoding="utf-8")))
        now = feature_map(new)
        for key in old.keys() | now.keys():
            if key in old and key in now:
                matched += 1
                if old[key] != now[key]:
                    flips.append((key, old[key], now[key]))
            else:
                drift += 1
    check(
        "P3a. Northglenn no-flip vs the s2-arc3 r2 captures",
        sa == 200 and sb == 200 and matched > 0 and not flips,
        f"{matched} matched, {len(flips)} flips, {drift} one-side-only (OSM drift)",
    )

L_PIN = (39.7113, -105.0815)
s4, rb3 = post("/api/road-bearing", {"lat": L_PIN[0], "lng": L_PIN[1]})
lcand = None
if s4 == 200 and isinstance(rb3, dict):
    for c in rb3.get("candidates") or []:
        if "wadsworth" in (c.get("name") or "").lower() and c.get("geometry"):
            lcand = c
            break
if lcand is None:
    check("P3b. Lakewood candidate", False, f"road-bearing {s4}")
else:
    l_body = {
        "lat": L_PIN[0],
        "lng": L_PIN[1],
        "bearing_deg": lcand["bearing"],
        "speed_mph": 40,
        "work_zone_ft": 1500,
        "closure_type": "shoulder",
        "road_type": "urban_arterial",
        "lane_width_ft": 12,
        "centerline": lcand["geometry"],
    }
    s5, rl = post("/api/render/detect-site", l_body)
    (OUT / "p3-lakewood-road.json").write_text(json.dumps(rl, indent=1), encoding="utf-8")
    old = feature_map(json.loads((A4 / "p2-lakewood-road.json").read_text(encoding="utf-8")))
    now = feature_map(rl if isinstance(rl, dict) else {})
    flips, matched, drift = [], 0, 0
    for key in old.keys() | now.keys():
        if key in old and key in now:
            matched += 1
            if old[key] != now[key]:
                flips.append((key, old[key], now[key]))
        else:
            drift += 1
    check(
        "P3b. Lakewood no-flip vs the s2-arc4 capture",
        s5 == 200 and matched > 0 and not flips,
        f"{matched} matched, {len(flips)} flips, {drift} one-side-only (OSM drift)",
    )

# ---- P4: the partial-coverage class ----------------------------------------
C_PIN = (39.7135, -104.94055)
s6, rb4 = post("/api/road-bearing", {"lat": C_PIN[0], "lng": C_PIN[1]})
ccand = None
if s6 == 200 and isinstance(rb4, dict):
    for c in rb4.get("candidates") or []:
        if "colorado" in (c.get("name") or "").lower() and c.get("geometry"):
            ccand = c
            break
(OUT / "p4-colorado-road-bearing.json").write_text(
    json.dumps(rb4, indent=1) if isinstance(rb4, dict) else str(rb4), encoding="utf-8"
)
if ccand is None:
    check("P4. S Colorado candidate", False, f"road-bearing {s6}")
else:
    g = [(p[0], p[1]) for p in ccand["geometry"]]
    cov = coverage_ft(g, C_PIN, ccand["bearing"])
    rev = max_reversal(g)
    check(
        "P4. the honest gap survives: coverage < 3,110 ft corridor, no reversal",
        0 < cov < 3110 and rev < 150,
        f"{len(g)} pts, coverage {cov:.0f} ft, worst reversal {rev:.0f}°",
    )

(OUT / "s2a5-payload-raw.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"\nDONE — failures: {failures}")
sys.exit(1 if failures else 0)
