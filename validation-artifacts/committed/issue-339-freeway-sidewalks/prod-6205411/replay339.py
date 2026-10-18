"""#339 production check: replay the audit-shoulder rows i25-r-65-night-3lanes
(the issue's repro) and two city-street sidewalk controls: bway-r-30 (N Broadway,
the issue's named control) and colfax-r-35 through
production's /api/render/audit and /api/render/markdown.

    python replay339.py <repo-root> <sha>

1. I-25 (freeway): no pedestrian_facility flag, the sidewalks bucket not
   detected and carrying the "not counted" line, no R9-9 in the breakdown,
   no sidewalk site adjustment, and no pedestrian section in the crew sheet.
2. N Broadway and E Colfax: pedestrian_facility still set, R9-9 still placed,
   and the crew sheet still says a pedestrian facility is affected.

Run 1 (results-run1.json) scored both rows false on the checker, not the
plan: it matched "edestrian" anywhere in the crew sheet (the I-25 sheet says
the word outside the section) and read the breakdown without asking for it
(include_breakdown is opt-in, #306).  Run 2 checks the section heading and
asks for the breakdown.  Run 2 (results-run2.json) failed I-25 on the
heading alone: the section stays on every Denver plan for the Denver TCP
sheet requirement (crew_narrative.py), which applies with or without a
sidewalk.  Run 3 checks the section's own affected / not-affected line
(i25-crew-ped-section.md is the live I-25 section).  Run 3
(results-run3.json) passed with Colfax as the only control; run 4 adds
N Broadway, the control the issue names.

The gate token comes from GATE_BYPASS_TOKEN, else conestruct/site/.env.local;
it is never printed.  Same pacing as replay335.py.
"""

from __future__ import annotations

import copy
import json
import os
import sys
import time
from pathlib import Path

import httpx

REPO = Path(sys.argv[1]).resolve()
SHA = sys.argv[2]
HERE = Path(__file__).resolve().parent
RUNS = REPO / "validation-artifacts/committed/audit-shoulder/runs"
BASE = "https://www.conestruct.com"
HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"
GAP_S = 4.0
NOTE_TAIL = "near the freeway not counted: the scan can't tell a sidewalk along a freeway"
PED_AFFECTED = "A pedestrian facility is affected by this closure."
PED_NONE = "No pedestrian or bicycle facility is flagged as affected by this closure."


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


def _body(row: str) -> dict:
    return copy.deepcopy(json.loads((RUNS / row / "request.json").read_text("utf-8")))


def _row(p: Poster, row: str) -> dict:
    body = _body(row)
    md = p.post("/api/render/markdown", {"scenario": body["scenario"]})
    # The breakdown rides the audit only on request (#306, opt-in).
    body["scenario"]["include_breakdown"] = True
    a = p.post("/api/render/audit", body)
    if a.status_code != 200 or md.status_code != 200:
        return {"error": f"audit {a.status_code} / markdown {md.status_code}"}
    audit = a.json()
    scan = audit["sections"]["site_scan"]
    side = (scan.get("buckets") or {}).get("sidewalks") or {}
    codes = [d.get("code") for d in (audit.get("breakdown") or {}).get("devices", [])]
    return {
        "scan_status": scan.get("status"),
        "road_type": (scan.get("inputs") or {}).get("road_type"),
        "pedestrian_facility": (scan.get("flags") or {}).get("pedestrian_facility"),
        "sidewalks_detected": side.get("detected"),
        "sidewalks_details": side.get("details"),
        "r9_9_in_breakdown": "R9-9" in codes,
        "sidewalk_adjustment": any(
            "R9-9" in str(adj.get("action", "")) for adj in audit["sections"]["site_adjustments"]
        ),
        "crew_ped_affected": PED_AFFECTED in md.text,
        "crew_ped_none": PED_NONE in md.text,
    }


def main() -> int:
    healthz = httpx.get(HEALTHZ, timeout=60).json()
    print("healthz:", healthz.get("sha", healthz))
    p = Poster()
    i25 = _row(p, "i25-r-65-night-3lanes")
    i25["pass"] = (
        i25.get("scan_status") == "ok"
        and i25.get("road_type") == "freeway"
        and not i25.get("pedestrian_facility")
        and i25.get("sidewalks_detected") is False
        and any(NOTE_TAIL in d for d in i25.get("sidewalks_details") or [])
        and not i25.get("r9_9_in_breakdown")
        and not i25.get("sidewalk_adjustment")
        and not i25.get("crew_ped_affected")
        and bool(i25.get("crew_ped_none"))
    )
    controls: dict[str, dict] = {}
    for row in ("bway-r-30", "colfax-r-35"):
        c = _row(p, row)
        c["pass"] = (
            c.get("scan_status") == "ok"
            and c.get("pedestrian_facility") is True
            and bool(c.get("r9_9_in_breakdown"))
            and bool(c.get("crew_ped_affected"))
        )
        controls[row] = c
    results = {
        "sha_expected": SHA,
        "healthz_sha": healthz.get("sha"),
        "1_i25_freeway_no_sidewalk": i25,
        "2_bway_control_keeps_sidewalk": controls["bway-r-30"],
        "3_colfax_control_keeps_sidewalk": controls["colfax-r-35"],
    }
    results["pass"] = (
        str(healthz.get("sha", "")).startswith(SHA)
        and i25["pass"]
        and all(c["pass"] for c in controls.values())
    )
    (HERE / "results.json").write_text(json.dumps(results, indent=1) + "\n", "utf-8")
    print(json.dumps({k: v.get("pass") if isinstance(v, dict) else v for k, v in results.items()}))
    return 0 if results["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
