"""#335 production check: replay the audit-shoulder row i25-r-65-night through
production's /api/render/audit and follow each refusal's own suggested fix.

    python replay335.py <repo-root> <sha>

1. The site's default (4 lanes x 10.5 ft) is refused with
   LANE_WIDTH_BELOW_FREEWAY_MIN, and the refusal names its fix
   ("Set lanes per direction to N and lane width to W ft"), not "Increase
   lane width".
2. That fix produces a plan (HTTP 200).
3. 4 lanes x 11 ft (the old loop's second step) is refused with "Reduce the
   lane count to N", not "Use a lane width of", and that fix produces a plan.

The gate token comes from GATE_BYPASS_TOKEN, else conestruct/site/.env.local;
it is never printed.  Same pacing as replay334.py.
"""

from __future__ import annotations

import copy
import json
import os
import re
import sys
import time
from pathlib import Path

import httpx

REPO = Path(sys.argv[1]).resolve()
SHA = sys.argv[2]
HERE = Path(__file__).resolve().parent
REQ = REPO / "validation-artifacts/committed/audit-shoulder/runs/i25-r-65-night/request.json"
BASE = "https://www.conestruct.com"
HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"
GAP_S = 4.0
FREEWAY_FIX = re.compile(r"Set lanes per direction to (\d+) and lane width to (\d+) ft")
SCHEMA_FIX = re.compile(r"Reduce the lane count to (\d+)\.")


def _token() -> str:
    tok = os.environ.get("GATE_BYPASS_TOKEN")
    if tok:
        return tok
    for line in (REPO / "conestruct" / "site" / ".env.local").read_text("utf-8").splitlines():
        if line.startswith("GATE_BYPASS_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("GATE_BYPASS_TOKEN not found")


class Poster:
    def __init__(self) -> None:
        self.c = httpx.Client(
            timeout=180,
            headers={"x-conestruct-gate": _token(), "content-type": "application/json"},
        )
        self.last = 0.0

    def post(self, path: str, body: dict) -> httpx.Response:
        for attempt in range(4):
            wait = self.last + GAP_S - time.time()
            if wait > 0:
                time.sleep(wait)
            r = self.c.post(f"{BASE}{path}", content=json.dumps(body))
            self.last = time.time()
            print(f"  {path} -> {r.status_code}", flush=True)
            if r.status_code == 429:
                time.sleep(65)
                continue
            if r.status_code == 400 and "site_scan_unavailable" in r.text[:2000]:
                time.sleep(30 * 2**attempt)
                continue
            return r
        return r


def _body(**over: object) -> dict:
    body = copy.deepcopy(json.loads(REQ.read_text("utf-8")))
    body["scenario"].update(over)
    return body


def main() -> int:
    healthz = httpx.get(HEALTHZ, timeout=60).json()
    print("healthz:", healthz.get("sha", healthz))
    p = Poster()
    results: dict[str, dict] = {}

    r1 = p.post("/api/render/audit", _body())
    t1 = r1.text
    m1 = FREEWAY_FIX.search(t1)
    step1 = {
        "status": r1.status_code,
        "rule": "LANE_WIDTH_BELOW_FREEWAY_MIN" in t1,
        "names_fix": m1.group(0) if m1 else None,
        "old_wording_absent": "Increase lane width" not in t1,
    }
    step1["pass"] = r1.status_code == 400 and step1["rule"] and bool(m1) and step1["old_wording_absent"]
    results["1_site_default_4x10.5"] = step1

    step2: dict = {"pass": False}
    if m1:
        r2 = p.post(
            "/api/render/audit", _body(lanes=int(m1.group(1)), laneWidth=float(m1.group(2)))
        )
        step2 = {"applied": m1.group(0), "status": r2.status_code, "pass": r2.status_code == 200}
    results["2_follow_fix"] = step2

    r3 = p.post("/api/render/audit", _body(laneWidth=11.0))
    t3 = r3.text
    m3 = SCHEMA_FIX.search(t3)
    step3 = {
        "status": r3.status_code,
        "names_fix": m3.group(0) if m3 else None,
        "old_wording_absent": "Use a lane width of" not in t3,
    }
    # The site proxy returns the schema refusal as 400 (the backend's raw
    # status is 422); either is a refusal.  First run expected 422 only and
    # scored this step 2/3 on the status alone (correction recorded below).
    step3["pass"] = r3.status_code in (400, 422) and bool(m3) and step3["old_wording_absent"]
    if m3:
        r4 = p.post("/api/render/audit", _body(lanes=int(m3.group(1)), laneWidth=11.0))
        step3["fix_status"] = r4.status_code
        step3["pass"] = step3["pass"] and r4.status_code == 200
    results["3_old_loop_step_4x11"] = step3

    passed = sum(1 for v in results.values() if v["pass"])
    out = {
        "sha": SHA,
        "healthz": healthz.get("sha"),
        "results": results,
        "summary": f"{passed}/3 PASS",
        "correction": (
            "Run 1 scored step 3 FAIL only because it expected HTTP 422; the site proxy "
            "returns the schema refusal as 400. Wording, old-wording absence and the "
            "fix's HTTP 200 all passed in run 1. Step 3 now accepts 400 or 422."
        ),
    }
    (HERE / "results.json").write_text(json.dumps(out, indent=2) + "\n", "utf-8")
    print(json.dumps(out, indent=2))
    return 0 if passed == 3 else 1


if __name__ == "__main__":
    raise SystemExit(main())
