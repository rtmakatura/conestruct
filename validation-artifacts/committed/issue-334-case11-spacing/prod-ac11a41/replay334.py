"""#334 production check: replay audit-shoulder rows through production's
/api/render/* and read the advance-sign distances off the audit JSON, page 1
and the crew sheet.

    python replay334.py

The two freeway rows the issue names must show Case 11's distances from the
taper (oracle O16, copied by hand: W5-1 500, W21-5aR 1,000 and 2,000, W20-1
5,200 ft) and no W20-2. The control (colo-r-35, a divided arterial) must keep
its Table 6B-1 series (W20-2 present, "A (nearest)" label).

The gate token comes from GATE_BYPASS_TOKEN, else conestruct/site/.env.local;
it is never printed.  Same pacing and scan-token reuse as replay338.py.
"""

from __future__ import annotations

import copy
import io
import json
import os
import re
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
SHA = "ac11a41"
GAP_S = 4.0

CASE_11 = sorted([("W5-1", 500), ("W21-5aR", 1000), ("W21-5aR", 2000), ("W20-1", 5200)])
CASES = ["e470-r-75", "i25-r-65-night-3lanes"]
CONTROL = "colo-r-35"
_CODES = {"W5-1", "W21-5aR", "W20-1", "W20-2"}


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


def _page1(b: bytes) -> str:
    doc = pdfium.PdfDocument(io.BytesIO(b))
    try:
        tp = doc[0].get_textpage()
        return " ".join(tp.get_text_range(0, tp.count_chars()).split())
    finally:
        doc.close()


def _check(p: Poster, sc: dict, control: bool) -> dict:
    a = p.post("/api/render/audit", {"scenario": {**copy.deepcopy(sc), "include_scan_token": True}})
    if a.status_code != 200:
        return {"pass": False, "error": f"audit {a.status_code}"}
    aj = a.json()
    dl = copy.deepcopy(sc)
    if aj.get("site_scan_token"):
        dl["site_scan"] = {"proceed_if_unavailable": False, "token": aj["site_scan_token"]}
    pdf = p.post("/api/render/pdf", {"scenario": dl})
    md = p.post("/api/render/markdown", {"scenario": dl})
    if pdf.status_code != 200 or md.status_code != 200:
        return {"pass": False, "error": f"pdf {pdf.status_code} / markdown {md.status_code}"}
    advance = aj["sections"]["advance"]
    audit_ft = sorted(
        (r["Code"], int(r["Distance from Taper (ft)"].split()[0].replace(",", "")))
        for r in advance["sign_table"]
        if r["Code"] in _CODES
    )
    page1 = _page1(pdf.content)
    page1_ft = sorted(
        (code, int(ft))
        for code, ft in re.findall(r"\b(W5-1|W21-5aR|W20-1|W20-2) [A-Z ]+? (\d+) ft", page1)
    )
    crew_ft = sorted(
        (code, int(ft.replace(",", "")))
        for code, ft in re.findall(
            r"^\| (W5-1|W21-5aR|W20-1|W20-2) \| [^|]+ \| ([\d,]+) ft upstream \|$",
            md.text,
            flags=re.M,
        )
    )
    rec = {
        "audit": audit_ft,
        "page1": page1_ft,
        "crew": crew_ft,
        "positions": [r["Position"] for r in advance["sign_table"]],
        "source": advance.get("source"),
        "plan_flags": aj.get("plan_flags"),
    }
    if control:
        ok = (
            "W20-2" in {c for c, _ in audit_ft}
            and "A (nearest)" in rec["positions"]
            and rec["source"] == "MUTCD 11th Ed. Table 6B-1"
        )
    else:
        ok = (
            audit_ft == CASE_11
            and page1_ft == CASE_11
            and crew_ft == CASE_11
            and "W20-2" not in page1
            and rec["source"] == "CDOT S-630-1 Sheet 7 Case 11"
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
    for case in CASES + [CONTROL]:
        print(case, flush=True)
        sc = json.loads((RUNS / case / "request.json").read_text("utf-8"))["scenario"]
        results[case] = _check(p, sc, control=case == CONTROL)
        print(f"  {'PASS' if results[case]['pass'] else 'FAIL'}", flush=True)
    (HERE / "results.json").write_text(json.dumps(results, indent=1), "utf-8")
    return 0 if all(r["pass"] for k, r in results.items() if k != "healthz_sha") else 1


if __name__ == "__main__":
    sys.exit(main())
