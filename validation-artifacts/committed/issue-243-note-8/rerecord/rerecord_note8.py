"""#243 build: re-record the Note 8 leaves, and prove nothing else moved.

Rule 5.  The recorded fixtures are historical recordings (older wire
versions), so a recompute differs from them in many leaves this arc never
touched.  The proof is therefore relative: the same fixtures recomputed on
the code BEFORE the change and AFTER it, through the real API path
(TestClient) with one fixed Overpass stub per fixture (no network).

  dump  <dir>   recompute every fixture on the code at RERECORD_ROOT (default
                this checkout) and write <dir>/<name>.json
  apply <before> <after> [--check]
                list every leaf that differs between before and after; fail
                if any is outside the Note 8 leaves; otherwise write those
                leaves (after's values) into the recordings, and nothing else

The site's audit-shoulder-full.json has no scenario, so its row is
re-derived from its own site-adjustment records: 2 R9-9 per pedestrian
record and 2 M4-9a per bicycle record, all on the right
(site_adjustments.py:171-172, :195/:197), the same derivation the churn
predictor used.  It is checked against the rule by
tests/test_note8_both_sides.py, which builds the same plan shape.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
TARGET = HERE.parents[3]  # the recordings are always this checkout's
ROOT = Path(os.environ.get("RERECORD_ROOT") or TARGET)  # the code that computes
sys.stdout.reconfigure(encoding="utf-8")

LABEL = "Signs on both sides of divided highway"
TIERING = "tests/fixtures/tiering"
SITE_FIXTURE = TARGET / "conestruct/site/components/__fixtures__/audit-shoulder-full.json"
# tests/test_tier_ledger.py SCAN_STUB; the two without one get "down" here
# so the recompute never reaches the network (same stub before and after).
TIERING_STUB = {
    "scanned-lakewood": "recorded",
    "scanned-not-checked": "down",
    "scanned-dismissed": "recorded",
    "scanned-asserted": "recorded",
    "control-lakewood": "down",
    "adv-ni-denver": "down",
}
CORPUS = ("grid_site_pedestrian_facility", "grid_site_bicycle_facility")

ALLOWED = (
    re.compile(r"^sections\.colorado\.checks\[\d+\]\.(pass|detail)$"),
    re.compile(r"^sections\.colorado\.(all_pass|fail_count)$"),
    re.compile(r"^plan_flags\.(compliance_fails|is_clean)$"),
)
CLOCK = re.compile(r"^sections\.site_scan\.(measured_at|duration_ms)$")


def leaves(x: Any, path: str = "") -> dict[str, Any]:
    if isinstance(x, dict):
        out: dict[str, Any] = {}
        for k, v in x.items():
            out.update(leaves(v, f"{path}.{k}" if path else k))
        return out or {path: {}}
    if isinstance(x, list):
        out = {}
        for i, v in enumerate(x):
            out.update(leaves(v, f"{path}[{i}]"))
        return out or {path: []}
    return {path: x}


def set_leaf(doc: dict, path: str, value: Any) -> None:
    parts = re.findall(r"[^.\[\]]+|\[\d+\]", path)
    cur: Any = doc
    for part in parts[:-1]:
        cur = cur[int(part[1:-1])] if part.startswith("[") else cur[part]
    last = parts[-1]
    if last.startswith("["):
        cur[int(last[1:-1])] = value
    else:
        cur[last] = value


def write_snapshot(path: Path, payload: Any) -> None:
    """Write in the file's OWN encoding, so only the patched leaves' lines move.

    The recordings don't share one layout: the corpus uses
    tests/_snapshot_helper's canonical form, some tiering fixtures keep
    insertion order, and the site fixture is one compact line.  Find the
    json.dumps settings that reproduce the file as it is, byte for byte
    (line endings included), and write with those.  No match: refuse.
    """
    raw = path.read_bytes()
    crlf = b"\r\n" in raw
    text = raw.decode("utf-8").replace("\r\n", "\n")
    current = json.loads(text)
    for indent, sep in ((2, None), (4, None), (None, (",", ":")), (None, None)):
        for sort_keys in (True, False):
            for ensure_ascii in (False, True):
                for tail in ("\n", ""):
                    kw: dict[str, Any] = {
                        "indent": indent,
                        "sort_keys": sort_keys,
                        "ensure_ascii": ensure_ascii,
                    }
                    if sep:
                        kw["separators"] = sep
                    if json.dumps(current, **kw) + tail == text:
                        out = json.dumps(payload, **kw) + tail
                        if crlf:
                            out = out.replace("\n", "\r\n")
                        path.write_bytes(out.encode("utf-8"))
                        return
    raise SystemExit(f"{path}: no json.dumps setting reproduces this file; not written")


def dump(out: Path) -> None:
    sys.path.insert(0, str(ROOT))
    os.chdir(ROOT)
    os.environ["RENDER_API_SECRET"] = "rerecord"
    from fastapi.testclient import TestClient

    from src.api import site_scan as ss
    from src.api.render_api import app
    from src.rules import site_detection as sd
    from tests.corpus.manifest import GRID_CASES, scenario_body

    payload = json.loads((ROOT / "tests/fixtures/site_scan/lakewood_overpass.json").read_text("utf-8"))
    stubs = {
        "recorded": lambda q, **_k: (payload, None),
        "down": lambda q, **_k: (None, "stub: mirrors down"),
    }
    client = TestClient(app)
    auth = {"Authorization": "Bearer rerecord"}
    out.mkdir(parents=True, exist_ok=True)
    bodies = {c.id: scenario_body(c) for c in GRID_CASES if c.id in CORPUS}
    for name, mode in TIERING_STUB.items():
        bodies[name] = json.loads((TARGET / TIERING / f"{name}.json").read_text("utf-8"))["scenario"]
    for name, body in bodies.items():
        ss.clear_memo()
        sd._overpass_request_with_fallback = stubs[TIERING_STUB.get(name, "down")]
        r = client.post("/render/audit", json=body, headers=auth)
        assert r.status_code == 200, (name, r.text[:300])
        (out / f"{name}.json").write_text(json.dumps(r.json(), ensure_ascii=False), "utf-8")
        print(f"dumped {name} on {ROOT}")


def recording(name: str) -> tuple[Path, dict, dict]:
    """(file, document, the audit inside it)."""
    if name in CORPUS:
        p = TARGET / "tests/snapshots/corpus" / f"{name}.json"
        d = json.loads(p.read_text("utf-8"))
        return p, d, d
    p = TARGET / TIERING / f"{name}.json"
    d = json.loads(p.read_text("utf-8"))
    return p, d, d["audit"]


def apply(before: Path, after: Path, write: bool) -> int:
    bad: list[str] = []
    for name in (*CORPUS, *TIERING_STUB):
        b = leaves(json.loads((before / f"{name}.json").read_text("utf-8")))
        a = leaves(json.loads((after / f"{name}.json").read_text("utf-8")))
        moved = sorted(p for p in b.keys() | a.keys() if b.get(p, "<absent>") != a.get(p, "<absent>"))
        path, doc, audit = recording(name)
        rec = leaves(audit)
        print(f"\n== {name}")
        allowed = {}
        for p in moved:
            if CLOCK.match(p):
                continue
            if any(r.match(p) for r in ALLOWED):
                allowed[p] = a.get(p)
                note = "" if rec.get(p) == b.get(p) else f"  [recording had {rec.get(p)!r}]"
                print(f"  NOTE8 {p}: {b.get(p)!r} -> {a.get(p)!r}{note}")
                if rec.get(p) != b.get(p):
                    bad.append(f"{name}: recording disagrees with the before-recompute at {p}")
            else:
                print(f"  OTHER {p}: {b.get(p)!r} -> {a.get(p)!r}")
                bad.append(f"{name}: {p}")
        if not allowed:
            print("  (no Note 8 leaf moved)")
        if write and allowed:
            for p, v in allowed.items():
                set_leaf(audit, p, v)
            write_snapshot(path, doc)

    print("\n== audit-shoulder-full.json (re-derived from its adjustment records)")
    fx = json.loads(SITE_FIXTURE.read_text("utf-8"))
    checks = fx["sections"]["colorado"]["checks"]
    i = next(k for k, c in enumerate(checks) if c["label"] == LABEL)
    row = checks[i]
    flags = [x["flag"] for x in fx["sections"].get("site_adjustments") or []]
    m = re.fullmatch(r"Required: True\. Signs placed: (\d+) left, (\d+) right\.", row["detail"])
    dropped = [s for f, s in (("pedestrian_facility", "2 R9-9"), ("bicycle_facility", "2 M4-9a")) if f in flags]
    if m and dropped:
        left, right = int(m.group(1)), int(m.group(2)) - 2 * len(dropped)
        why = (
            "sidewalk and bike-lane signs, posted at the facility" if len(dropped) == 2
            else "sidewalk signs, posted at the sidewalk" if "pedestrian_facility" in flags
            else "bike-lane signs, posted at the facility"
        )
        new = {**row, "pass": left == right and left > 0,
               "detail": f"Required: True. Signs counted: {left} left, {right} right. "
                         f"Not counted: {', '.join(dropped)} ({why})."}
        print(f"  {row}\n  -> {new}")
        checks[i] = new
        fails = sum(1 for c in checks if not c["pass"])
        fx["sections"]["colorado"]["fail_count"] = fails
        fx["sections"]["colorado"]["all_pass"] = fails == 0
        pf = fx["plan_flags"]
        pf["compliance_fails"] = fails
        pf["is_clean"] = pf["validation_warnings"] == 0 and fails == 0 and pf["v1_limitations"] == 0
        print(f"  colorado fail_count {fails}, all_pass {fails == 0}; plan_flags {pf}")
        if write:
            write_snapshot(SITE_FIXTURE, fx)
    else:
        print(f"  unchanged: {row}")

    print("\n== result")
    for x in bad:
        print(f"  FAIL {x}")
    print("FAIL" if bad else ("only Note 8 leaves moved" + ("; written" if write else " (check only)")))
    return 1 if bad else 0


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "dump":
        dump(Path(sys.argv[2]))
    else:
        raise SystemExit(apply(Path(sys.argv[2]), Path(sys.argv[3]), "--check" not in sys.argv))
