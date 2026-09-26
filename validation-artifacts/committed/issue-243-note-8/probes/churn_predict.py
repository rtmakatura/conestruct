"""#243 investigate: predict the Rule 5 churn of each option on every recorded
audit in the repo (read-only).

For each recorded audit (tests/snapshots/*.json, tests/snapshots/corpus/*.json,
tests/fixtures/tiering/*.json, the site's audit-shoulder-full.json fixture):
the recorded Note 8 row, the site adjustments that fired, the kind, and the
row each option would record.  The adjustments add exactly two right-side
signs per flag (site_adjustments.py:170-173 R9-9, :193-198 M4-9a), so the
new counts are the old counts less those signs; nothing else moves.

  .venv/Scripts/python.exe churn_predict.py > churn-predict.txt
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.stdout.reconfigure(encoding="utf-8")

FILES = (
    sorted((ROOT / "tests" / "snapshots").glob("*.json"))
    + sorted((ROOT / "tests" / "snapshots" / "corpus").glob("*.json"))
    + sorted((ROOT / "tests" / "fixtures" / "tiering").glob("*.json"))
    + [ROOT / "conestruct" / "site" / "components" / "__fixtures__" / "audit-shoulder-full.json"]
)
DETAIL = re.compile(r"Required: (True|False)\. Signs placed: (\d+) left, (\d+) right\.")


def audit_of(d):
    return d["audit"] if "audit" in d else d


def kind_of(d, a):
    sc = d.get("scenario")
    if sc:
        return sc["kind"]
    label = json.dumps(a["sections"].get("case", {}))
    if "Shoulder" in label or "shoulder" in label:
        return "shoulder"
    if "lagger" in label:
        return "flagger"
    return "?"


def row(req, left, right, exception_applies):
    if exception_applies:
        return (True, f"(not required: one shoulder closed) {left} left, {right} right")
    ok = (left == right and left > 0) if req else True
    return (ok, f"Required: {req}. Signs placed: {left} left, {right} right.")


def main():
    stats = {"a'": {"flip": 0, "text": 0}, "d": {"flip": 0, "text": 0}, "d+a'": {"flip": 0, "text": 0}}
    print(f"{'file':<62} {'kind':<9} {'adj':<9} recorded -> a' | d")
    for f in FILES:
        d = json.loads(f.read_text("utf-8"))
        a = audit_of(d) if isinstance(d, dict) else None
        if not isinstance(a, dict) or "sections" not in a:
            print(f"{f.relative_to(ROOT).as_posix():<62} (not a recorded audit; skipped)")
            continue
        n8 = a["sections"]["colorado"]["checks"][0]
        m = DETAIL.fullmatch(n8["detail"])
        req, left, right = m.group(1) == "True", int(m.group(2)), int(m.group(3))
        flags = [r["flag"] for r in a["sections"].get("site_adjustments") or []]
        drop = 2 * sum(1 for x in flags if x in ("pedestrian_facility", "bicycle_facility"))
        kind = kind_of(d, a)
        a1 = row(req, left, right - drop, False)
        d1 = row(req, left, right, req and kind == "shoulder")
        da = row(req, left, right - drop, req and kind == "shoulder")
        rec = (n8["pass"], n8["detail"])
        for k, new in (("a'", a1), ("d", d1), ("d+a'", da)):
            if new[0] != rec[0]:
                stats[k]["flip"] += 1
            if new[1] != rec[1]:
                stats[k]["text"] += 1
        adj = "+".join(x[:4] for x in flags if x in ("pedestrian_facility", "bicycle_facility")) or "-"
        mark = lambda new: ("FLIP " if new[0] != rec[0] else "") + ("text" if new[1] != rec[1] else "same")  # noqa: E731
        rel = f.relative_to(ROOT).as_posix()
        print(f"{rel:<62} {kind:<9} {adj:<9} {'PASS' if rec[0] else 'FAIL'} {left}/{right} -> {mark(a1)} | {mark(d1)}")
    print("\nfiles:", len(FILES))
    for k, v in stats.items():
        print(f"option {k}: Note 8 pass flips {v['flip']}, detail text changes {v['text']}")


if __name__ == "__main__":
    main()
