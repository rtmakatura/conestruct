"""#337 production check: replay audit-shoulder rows through production's
/api/render/* and read the Note 8 line off the crew sheet and the audit.

    python replay337.py

The gate token comes from GATE_BYPASS_TOKEN, else conestruct/site/.env.local;
it is never printed.  Same pacing and scan-token reuse as replay336.py.
The divided lane closure is gated over HTTP, so production can't show it;
its unchanged line is pinned by tests/s630/test_note8_crew_sheet_337.py.
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
SHA = "e11bf09"
GAP_S = 4.0
OLD = "must be posted on BOTH sides"
NEW = (
    "this plan posts signs on both sides of the roadway by choice. CDOT S-630-1 "
    "Sheet 2 General Note 8 doesn't require it when only one shoulder is closed"
)

# (case id, audit row, divided?)
CASES = [
    ("colo-r-35", "colo-r-35", True),  # the issue's repro, day
    ("colo-r-40-night", "colo-r-40-night", True),
    ("bway-r-30", "bway-r-30", False),  # one-way control: no divided line
]


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


def _pdf_text(b: bytes) -> str:
    doc = pdfium.PdfDocument(io.BytesIO(b))
    try:
        out = []
        for page in doc:
            tp = page.get_textpage()
            out.append(tp.get_text_range(0, tp.count_chars()))
        return " ".join(" ".join(out).split())
    finally:
        doc.close()


def main() -> int:
    served = httpx.get(HEALTHZ, timeout=30).json()
    sha = str(served.get("sha") or served.get("git_sha") or served)
    if not sha.startswith(SHA):
        raise SystemExit(f"healthz serves {sha}, not {SHA}")
    p = Poster()
    results: dict = {"healthz_sha": sha}
    for case, row, divided in CASES:
        print(case, flush=True)
        sc = json.loads((RUNS / row / "request.json").read_text("utf-8"))["scenario"]
        a = p.post("/api/render/audit", {"scenario": {**copy.deepcopy(sc), "include_scan_token": True}})
        if a.status_code != 200:
            results[case] = {"pass": False, "error": f"audit {a.status_code}"}
            continue
        aj = a.json()
        dl = copy.deepcopy(sc)
        if aj.get("site_scan_token"):
            dl["site_scan"] = {"proceed_if_unavailable": False, "token": aj["site_scan_token"]}
        md = p.post("/api/render/markdown", {"scenario": dl})
        pdf = p.post("/api/render/crew-pdf", {"scenario": dl})
        if md.status_code != 200 or pdf.status_code != 200:
            results[case] = {"pass": False, "error": f"crew {md.status_code}/{pdf.status_code}"}
            continue
        (HERE / f"{case}-crew.md").write_text(md.text, "utf-8")
        crew_pdf = _pdf_text(pdf.content)
        rows = [c for c in aj["sections"]["colorado"]["checks"] if "Note 8" in c["citation"]]
        detail = rows[0]["detail"] if rows else None
        lines = [ln for ln in md.text.splitlines() if "Note 8" in ln]
        if divided:
            ok = (
                bool(detail) and detail.startswith("Not required: one shoulder closed")
                and NEW in md.text and OLD not in md.text
                and "posts signs on both sides of the roadway by choice" in crew_pdf
                and OLD not in crew_pdf
            )
        else:
            ok = "Divided highway" not in md.text and "Divided highway" not in crew_pdf
        results[case] = {"pass": ok, "audit_note8": detail, "crew_note8_lines": lines}
        print(f"  {'PASS' if ok else 'FAIL'} audit={detail!r}", flush=True)
    (HERE / "results.json").write_text(json.dumps(results, indent=1), "utf-8")
    return 0 if all(r["pass"] for k, r in results.items() if k != "healthz_sha") else 1


if __name__ == "__main__":
    sys.exit(main())
