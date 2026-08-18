"""s2-arc4 live checks, payload series (Refs #16) — READ-ONLY.

Runs against production through the public proxy (no secrets).

  P1 — the no-flip sameness check (Northglenn / uncapped buckets): the
       arc changed zero threshold values, so for every feature present
       in BOTH the committed s2-arc3 round-2 responses and today's
       responses (matched by label, per frame), zone and relevant must
       be IDENTICAL.  Features present on only one side are OSM data
       drift (two days of edits), reported separately — drift is not a
       flip.  Any flip on a matched feature is a REPAIR signal per the
       GO, never a re-baseline.
  P2 — the served lateral-details format (Lakewood / S Wadsworth, whose
       sidewalk/bike buckets carry relevant lateral-zone features):
       every details entry for a lateral-zone feature reads
       "[lateral N ft off centerline]"; the pre-fix "[lateral @ N ft]"
       form is gone; non-lateral entries keep "[zone @ N ft]".
  P3 — the served audit strings: sections.site_adjustments rules and
       citations carry the page-cited titles; the pending_verification
       labels carry their page cites; "Ch. 6H" appears nowhere.
  P4 — the served crew narrative (Site-Specific Notes): both new rule
       strings render; "Ch. 6H" absent.

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

BASE = "https://www.conestruct.com"
OUT = Path(__file__).parent / "outS2A4"
OUT.mkdir(exist_ok=True)
R2 = ROOT / "validation-artifacts/committed/s2-arc3-classification-frame/live-checks/outS2A3"

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
            raw = r.read().decode()
            try:
                return r.status, json.loads(raw)
            except ValueError:
                return r.status, raw
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]
    except Exception as e:  # noqa: BLE001
        return None, f"{type(e).__name__}: {e}"


def feature_map(resp):
    """(bucket, label) -> (zone, relevant) for every feature record."""
    out = {}
    for k, v in (resp or {}).items():
        if isinstance(v, dict) and isinstance(v.get("features"), list):
            for f in v["features"]:
                out[(k, f.get("label"))] = (f.get("zone"), f.get("relevant"))
    return out


# ---- P1: Northglenn no-flip sameness --------------------------------------
N_PIN = (39.886, -104.9811)
s_rb, rb = post("/api/road-bearing", {"lat": N_PIN[0], "lng": N_PIN[1]})
ncand = None
if s_rb == 200 and isinstance(rb, dict):
    for c in rb.get("candidates") or []:
        if c.get("geometry") and len(c["geometry"]) >= 2:
            ncand = c
            break
if ncand is None:
    check("P1. Northglenn candidate available", False, f"road-bearing {s_rb}")
else:
    log(f"  P1 candidate: {ncand.get('name')!r} way {ncand.get('way_id')}")
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
    s_a, resp_a = post("/api/render/detect-site", n_body)
    s_b, resp_b = post("/api/render/detect-site", {**n_body, "centerline": ncand["geometry"]})
    (OUT / "p1-northglenn-chord.json").write_text(json.dumps(resp_a, indent=2), encoding="utf-8")
    (OUT / "p1-northglenn-road.json").write_text(json.dumps(resp_b, indent=2), encoding="utf-8")
    if s_a != 200 or s_b != 200:
        check("P1. Northglenn detects serve", False, f"chord {s_a}, road {s_b}")
    else:
        flips = []
        drift_only = 0
        matched = 0
        for tag, old_name, new in (
            ("chord", "r2-s2-northglenn-chord.json", resp_a),
            ("road", "r2-s2-northglenn-road.json", resp_b),
        ):
            old = feature_map(json.loads((R2 / old_name).read_text(encoding="utf-8")))
            now = feature_map(new)
            for key in old.keys() | now.keys():
                if key in old and key in now:
                    matched += 1
                    if old[key] != now[key]:
                        flips.append((tag, key, old[key], now[key]))
                else:
                    drift_only += 1
        check(
            "P1. no threshold flip on any matched feature (values held)",
            matched > 0 and not flips,
            f"{matched} matched features, {len(flips)} flips, "
            f"{drift_only} present-one-side-only (OSM drift, not flips)",
        )
        for f in flips:
            log(f"  FLIP: {f}")

# ---- P2: Lakewood lateral-details format ----------------------------------
L_PIN = (39.7113, -105.0815)
s_rb2, rb2 = post("/api/road-bearing", {"lat": L_PIN[0], "lng": L_PIN[1]})
lcand = None
if s_rb2 == 200 and isinstance(rb2, dict):
    for c in rb2.get("candidates") or []:
        name = (c.get("name") or "").lower()
        if "wadsworth" in name and c.get("geometry") and len(c["geometry"]) >= 2:
            lcand = c
            break
if lcand is None:
    check("P2. Lakewood/Wadsworth candidate available", False, f"road-bearing {s_rb2}")
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
    s_l, resp_l = post("/api/render/detect-site", l_body)
    (OUT / "p2-lakewood-road.json").write_text(json.dumps(resp_l, indent=2), encoding="utf-8")
    if s_l != 200:
        check("P2. Lakewood detect serves", False, f"HTTP {s_l}")
    else:
        import re

        all_details = [
            d
            for v in resp_l.values()
            if isinstance(v, dict)
            for d in v.get("details") or []
            if isinstance(d, str)
        ]
        lateral_new = [d for d in all_details if re.search(r"\[lateral \d+ ft off centerline\]", d)]
        lateral_old = [d for d in all_details if "[lateral @" in d]
        # Format check applies to feature display lines only (they all
        # carry a "[...]" suffix); placeholder details like
        # road_curvature's "not implemented" sentence carry no bracket
        # and are exempt (first run counted them and failed — runner
        # defect, disclosed).
        other = [d for d in all_details if "[" in d and "[lateral" not in d]
        other_ok = all(re.search(r"\[\w+ @ -?\d+ ft\]", d) for d in other)
        check(
            "P2. lateral-zone details state the offset; pre-fix form gone; other zones unchanged",
            bool(lateral_new) and not lateral_old and other_ok,
            f"{len(lateral_new)} lateral-format lines, {len(lateral_old)} old-form, "
            f"{len(other)} other-zone lines",
        )
        for d in lateral_new[:3]:
            log(f"  served: {d}")

# ---- P3 + P4: the served attribution strings ------------------------------
SCENARIO = {
    "kind": "shoulder",
    "meta": {
        "project": "s2a4 live check",
        "address": "",
        "lat": 0,
        "lng": 0,
        "siteConditions": {"adjacent_intersection": True, "adjacent_interchange": True},
    },
    "roadType": "urban_arterial",
    "speed": 40,
    "lanes": 2,
    "laneWidth": 12,
    "divided": False,
    # First run sent "utility_cut" and the proxy's honest 400 answered
    # with the shoulder validator's own enum — corrected (runner defect,
    # disclosed).
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 800,
    "night": False,
}

RULE_6N12 = "MUTCD §6N.12 p. 848 — Work within the Traveled Way at an Intersection (11th Ed.)"
RULE_6N16 = "MUTCD §6N.16 p. 851 — Interchanges (11th Ed.)"

s_au, audit = post("/api/render/audit", {"scenario": SCENARIO})
(OUT / "p3-audit-served.json").write_text(
    json.dumps(audit, indent=2) if isinstance(audit, dict) else str(audit), encoding="utf-8"
)
if s_au != 200 or not isinstance(audit, dict):
    check("P3. served audit strings page-cited", False, f"HTTP {s_au}")
else:
    recs = {r.get("flag"): r for r in audit.get("sections", {}).get("site_adjustments", [])}
    labels = " ".join(
        str(it.get("label")) for it in audit.get("pending_verification", {}).get("items", [])
    )
    blob = json.dumps(audit)
    check(
        "P3. served audit strings page-cited (rules, citations, pending labels; no Ch. 6H)",
        recs.get("adjacent_intersection", {}).get("rule") == RULE_6N12
        and recs.get("adjacent_interchange", {}).get("rule") == RULE_6N16
        and recs.get("adjacent_intersection", {}).get("citation") == "MUTCD § 6N.12 p. 848"
        and recs.get("adjacent_interchange", {}).get("citation") == "MUTCD § 6N.16 p. 851"
        and "§6N.12, 11th Ed. p. 848" in labels
        and "§6N.16, 11th Ed. p. 851" in labels
        and "Ch. 6H" not in blob,
    )

s_md, md = post("/api/render/markdown", {"scenario": SCENARIO})
(OUT / "p4-narrative-served.md").write_text(str(md), encoding="utf-8")
check(
    "P4. served crew narrative carries both page-cited rules; Ch. 6H absent",
    s_md == 200
    and isinstance(md, str)
    and RULE_6N12 in md
    and RULE_6N16 in md
    and "Ch. 6H" not in md,
    f"HTTP {s_md}",
)

(OUT / "s2a4-payload-raw.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"\nDONE — failures: {failures}")
sys.exit(1 if failures else 0)
