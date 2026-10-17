"""#338 production check: replay audit-shoulder rows through production's
/api/render/* and read the assumed shoulder width off page 1, the audit
JSON and the audit PDF.

    python replay338.py

The gate token comes from GATE_BYPASS_TOKEN, else conestruct/site/.env.local;
it is never printed.  Same pacing and scan-token reuse as replay337.py.
"""

from __future__ import annotations

import copy
import io
import json
import os
import sys
import time
from pathlib import Path

import httpx
import pypdfium2 as pdfium

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
RUNS = REPO / "validation-artifacts" / "committed" / "audit-shoulder" / "runs"
BASE = "https://www.conestruct.com"
HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"
SHA = "fffe9ee"
GAP_S = 4.0

# (case id, expected width or None for the lane control)
CASES = [
    ("ogden-r-25-50ft", "8"),  # the issue's repro: undivided, 25 mph, 50 ft
    ("colo-r-35", "10"),  # divided
    ("bway-r-30", "8"),  # one-way street
]
# Lane control: tests/s630/test_ta10_flagger.py FLAGGER_BASIC_BODY (no pin).
FLAGGER = {
    "kind": "flagger_lane_closure",
    "meta": {"project": "#338 prod control"},
    "roadType": "rural_undivided",
    "speed": 45,
    "laneWidth": 11.0,
    "workType": "utility_cut",
    "duration": "short",
    "workLen": 1000.0,
    "night": False,
    "pilotCar": False,
    "afad": False,
    "pedestrianAccess": False,
}


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


def _pages(b: bytes) -> list[str]:
    doc = pdfium.PdfDocument(io.BytesIO(b))
    try:
        out = []
        for page in doc:
            tp = page.get_textpage()
            out.append(" ".join(tp.get_text_range(0, tp.count_chars()).split()))
        return out
    finally:
        doc.close()


def _check(p: Poster, sc: dict, width: str | None) -> dict:
    a = p.post("/api/render/audit", {"scenario": {**copy.deepcopy(sc), "include_scan_token": True}})
    if a.status_code != 200:
        return {"pass": False, "error": f"audit {a.status_code}"}
    aj = a.json()
    dl = copy.deepcopy(sc)
    if aj.get("site_scan_token"):
        dl["site_scan"] = {"proceed_if_unavailable": False, "token": aj["site_scan_token"]}
    pdf = p.post("/api/render/pdf", {"scenario": dl})
    apdf = p.post("/api/render/audit-pdf", {"scenario": dl})
    if pdf.status_code != 200 or apdf.status_code != 200:
        return {"pass": False, "error": f"pdf {pdf.status_code}/{apdf.status_code}"}
    page1 = _pages(pdf.content)[0]
    audit_pdf = " ".join(_pages(apdf.content))
    taper = aj["sections"]["taper"]
    rec = {
        "page1_row": f"Shoulder width: {width} ft (assumed)" in page1 if width else None,
        "basis": taper.get("shoulder_width_basis"),
        "formula_text_0": taper["formula_text"][0],
        "pending_kinds": [i["kind"] for i in aj["pending_verification"].get("items", [])],
        "plan_flags": aj.get("plan_flags"),
    }
    if width:
        ok = (
            rec["page1_row"]
            and rec["basis"] == "assumed"
            and rec["formula_text_0"] == f"W = {width} ft (assumed)"
            and f"Offset (shoulder width) {width} ft (assumed)" in audit_pdf
            and "shoulder_width_assumed" not in rec["pending_kinds"]
        )
    else:
        ok = (
            "Shoulder width" not in page1
            and rec["basis"] is None
            and "assumed" not in rec["formula_text_0"]
        )
    rec["pass"] = bool(ok)
    return rec


def main() -> int:
    served = httpx.get(HEALTHZ, timeout=30).json()
    sha = str(served.get("sha") or served)
    if not sha.startswith(SHA):
        raise SystemExit(f"healthz serves {sha}, not {SHA}")
    p = Poster()
    results: dict = {"healthz_sha": sha}
    for case, width in CASES:
        print(case, flush=True)
        sc = json.loads((RUNS / case / "request.json").read_text("utf-8"))["scenario"]
        results[case] = _check(p, sc, width)
        print(f"  {'PASS' if results[case]['pass'] else 'FAIL'}", flush=True)
    print("flagger-control", flush=True)
    results["flagger-control"] = _check(p, FLAGGER, None)
    print(f"  {'PASS' if results['flagger-control']['pass'] else 'FAIL'}", flush=True)
    (HERE / "results.json").write_text(json.dumps(results, indent=1), "utf-8")
    return 0 if all(r["pass"] for k, r in results.items() if k != "healthz_sha") else 1


if __name__ == "__main__":
    sys.exit(main())
