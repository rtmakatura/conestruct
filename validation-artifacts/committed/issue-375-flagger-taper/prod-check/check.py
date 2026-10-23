"""#375 production check: a short flagger zone is refused against the one-lane, two-way taper.

Run from the repo root with GATE_BYPASS_TOKEN set:
``uv run python validation-artifacts/committed/issue-375-flagger-taper/prod-check/check.py``.
It replays the audit lane's own requests (#370, ``audit-lane/runs/<id>/request.json``)
through www.conestruct.com's ``/api/render/*`` proxy.  No scan token is read or
written (#371): a geometry refusal answers before the scan, and the 100 ft row
only needs the audit's status.  Writes ``results.json``.

Rows:
- F17 (flagger, 50 ft, 25 mph; the #375 acceptance): the audit and the PDF
  refuse with the new one-lane, two-way taper message.
- F17 at 100 ft: the audit builds (200); the limit didn't move.
- N1 at 100 ft (near-intersection control): still refused with the merging
  taper (L) wording, speed and "reduce the speed limit" included.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
sys.path.insert(0, str(REPO / "scripts"))
from gate import gate_headers  # noqa: E402

BASE = "https://www.conestruct.com"
HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"
RUNS = REPO / "validation-artifacts/committed/audit-lane/runs"
RULE = "WORK_ZONE_SHORTER_THAN_TAPER"
FLAGGER_MSG = (
    "Work zone length (50 ft) is shorter than the 100 ft one-lane, two-way taper "
    "this flagger plan draws. Increase the work zone to at least 100 ft."
)
GAP_S = 4.0


def scenario(rid: str, work_len: float) -> dict:
    sc = json.loads((RUNS / rid / "request.json").read_text("utf-8"))["scenario"]
    return {**sc, "workLen": work_len}


def refusal(r: httpx.Response) -> dict:
    out: dict = {"status": r.status_code}
    try:
        detail = r.json()["detail"]
    except (ValueError, KeyError, TypeError):
        out["body"] = r.text[:500]
        return out
    out["error"] = detail.get("error")
    out["message"] = detail.get("message")
    out["taper_violation"] = next(
        (v for v in detail.get("violations", []) if v["rule_id"] == RULE), None
    )
    return out


def main() -> None:
    c = httpx.Client(
        headers={**gate_headers(BASE), "content-type": "application/json"}, timeout=300
    )
    last = 0.0

    def post(path: str, body: dict) -> httpx.Response:
        nonlocal last
        wait = last + GAP_S - time.time()
        if wait > 0:
            time.sleep(wait)
        r = c.post(f"{BASE}{path}", content=json.dumps({"scenario": body}))
        last = time.time()
        print(time.strftime("%H:%M:%S"), path, r.status_code, flush=True)
        return r

    res: dict = {
        "ran_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "healthz": httpx.get(HEALTHZ, timeout=30).json(),
    }
    f17 = scenario("F17", 50.0)
    res["F17_audit"] = refusal(post("/api/render/audit", f17))
    res["F17_pdf"] = refusal(post("/api/render/pdf", f17))
    res["F17_100ft_audit_status"] = post("/api/render/audit", scenario("F17", 100.0)).status_code
    res["N1_100ft_audit"] = refusal(post("/api/render/audit", scenario("N1", 100.0)))

    a, p, n = res["F17_audit"], res["F17_pdf"], res["N1_100ft_audit"]
    nmsg = (n.get("taper_violation") or {}).get("message", "")
    res["verdicts"] = {
        "F17": a["status"] == 400
        and a["message"] == FLAGGER_MSG
        and (a["taper_violation"] or {}).get("message") == FLAGGER_MSG
        and p["status"] == 400
        and p["message"] == FLAGGER_MSG,
        "F17_100ft": res["F17_100ft_audit_status"] == 200,
        "N1_control": n["status"] == 400
        and "required merging taper (L) of" in nmsg
        and " mph. " in nmsg
        and nmsg.endswith(", or reduce the speed limit."),
    }
    (HERE / "results.json").write_text(json.dumps(res, indent=1) + "\n", "utf-8")
    print(json.dumps(res["verdicts"]))


if __name__ == "__main__":
    main()
