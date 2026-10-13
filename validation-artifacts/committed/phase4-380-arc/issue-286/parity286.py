"""For every regenerated snapshot: the new wire strings equal what AuditTrail.tsx
(at 3fdf074) computes from the same payload.  JS String(number) is mimicked."""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
A = Path(r"C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-286-formula-fields/tests/snapshots")


def js(n):
    if isinstance(n, float) and n.is_integer():
        return str(int(n))
    return str(n)


def find(d):
    if isinstance(d, dict):
        if isinstance(d.get("sections"), dict):
            return d
        for v in d.values():
            r = find(v)
            if r:
                return r
    if isinstance(d, list):
        for v in d:
            r = find(v)
            if r:
                return r
    return None


xify = lambda s: s.replace(" x ", " × ")  # noqa: E731
checked = 0
bad = []
for f in sorted(A.rglob("*.json")):
    if "_pre_" in f.name or f.name.startswith("ni-"):
        continue
    d = find(json.loads(f.read_text(encoding="utf-8")))
    s, m = d["sections"], d["summary"]
    t, b, sp, ad = s["taper"], s["buffer"], s["spacing"], s["advance"]
    is_sh = t["closure_type"] == "shoulder"
    want = {
        "taper.result_text": (t["result_text"], f"{'L/3' if is_sh else 'L'} = {js(m['taper_length_ft'])} ft"),
        "taper.formula_text": (t["formula_text"], [xify(t["L_calc_text"])] + ([xify(t["L_third_calc_text"])] if is_sh else [])),
        "buffer.result_text": (b["result_text"], f"B = {js(m['buffer_space_ft'])} ft"),
        "spacing.result_text": (
            sp["result_text"],
            f"{sp['n_taper_drums_required'] + sp['n_tangent_cones_required']} devices · "
            f"{js(m['device_spacing_taper_ft'])}/{js(m['device_spacing_tangent_ft'])} ft o.c.",
        ),
        "spacing.formula_text": (
            sp["formula_text"],
            [sp["taper_count_text"], sp["tangent_count_text"]]
            + ([sp["downstream_count_text"]] if sp.get("downstream_count_text") else []),
        ),
        "advance.result_text": (ad["result_text"], f"{len(ad['sign_table'])} signs"),
    }
    fl = s.get("flagger") or {}
    if "sight_distance_ft" in fl:
        want["flagger.sight_distance_result_text"] = (fl["sight_distance_result_text"], f"{fl['sight_distance_ft']} ft")
        want["flagger.sight_distance_formula_text"] = (
            fl["sight_distance_formula_text"],
            [f"SSD @ {sp['speed_mph']} mph = {fl['sight_distance_ft']} ft"],
        )
    for k, (got, exp) in want.items():
        checked += 1
        if got != exp:
            bad.append((f.name, k, got, exp))
for x in bad:
    print("MISMATCH", x)
print(f"{checked} strings checked; {len(bad)} mismatches")
sys.exit(1 if bad else 0)
