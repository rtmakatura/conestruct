"""#292: one time-of-day window -- every mirror's real answer time, and prod's.

Read-only.  For each pin in out/queries.json (the exact scan query prod
sends, build_queries.py):

  1. the query goes to all three Overpass mirrors AT ONCE, the backend's own
     request (POST data=query, its User-Agent), each with a 30 s read cap --
     long enough to see how late a slow mirror really answers.  Recorded
     per mirror: HTTP status, seconds to the full answer, bytes, the
     payload's remark, element count, way-geometry null points, the error;
  2. then one cold prod Generate's audit for the same pin, through the gate
     (body as measure_refusals.py builds it, include_breakdown as the site
     now sends it): status, seconds, the scan's status / mirror / duration
     / error.

Strategies (today's chain, without kumi, all at once, other budgets) are
then simulated on these numbers by simulate.py.

  python measure_window.py <label> > out/window-<label>.jsonl
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
EVID = ROOT / "validation-artifacts/committed/scan-refusal-rate/probes"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(EVID))
sys.path.insert(0, str(ROOT / "scripts"))
sys.stdout.reconfigure(encoding="utf-8")
from gate import gate_headers  # noqa: E402
from measure_refusals import PINS, SITE, TEMPLATE, body_for  # noqa: E402

from src.rules.site_detection import OVERPASS_MIRRORS, USER_AGENT  # noqa: E402


def ask(url: str, query: str) -> dict:
    t0 = time.monotonic()
    out: dict = {"mirror": url.split("/")[2]}
    try:
        r = httpx.post(url, data={"data": query}, headers={"User-Agent": USER_AGENT},
                       timeout=httpx.Timeout(30.0, connect=10.0))
        out.update(http=r.status_code, seconds=round(time.monotonic() - t0, 2), bytes=len(r.content))
        try:
            p = r.json()
            els = p.get("elements") or []
            out.update(
                remark=p.get("remark"),
                elements=len(els),
                null_points=sum(1 for e in els for x in (e.get("geometry") or []) if x is None),
            )
        except ValueError:
            out["not_json"] = r.text[:120]
    except httpx.HTTPError as exc:
        out.update(seconds=round(time.monotonic() - t0, 2), error=f"{type(exc).__name__}: {exc}"[:160])
    return out


def prod_audit(body: dict, h: dict) -> dict:
    t0 = time.monotonic()
    r = httpx.post(f"{SITE}/api/render/audit", json={"scenario": {**body, "include_breakdown": True}},
                   headers=h, timeout=200)
    out = {"http": r.status_code, "seconds": round(time.monotonic() - t0, 2)}
    try:
        j = r.json()
        s = j["sections"]["site_scan"] if r.status_code == 200 else (j.get("detail") or {}).get("site_scan") or {}
        out.update(scan=s.get("status"), mirror=(s.get("mirror") or "").split("/")[2] if s.get("mirror") else None,
                   duration_ms=s.get("duration_ms"), memo_hit=s.get("memo_hit"), error=s.get("error"))
    except Exception:  # noqa: BLE001
        out["text"] = r.text[:160]
    return out


def main() -> None:
    label = sys.argv[1]
    queries = json.loads((HERE / "out" / "queries.json").read_text("utf-8"))
    template = json.loads(TEMPLATE.read_text("utf-8"))["scenario"]
    resolved = json.loads((EVID / "out" / "pins-resolved.json").read_text("utf-8"))
    h = gate_headers(SITE)
    print(json.dumps({"window": label, "start": datetime.now(UTC).isoformat(timespec="seconds"),
                      "healthz": httpx.get("https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz",
                                           timeout=30).json()}), flush=True)
    for pin, query in queries.items():
        at = datetime.now(UTC).isoformat(timespec="seconds")
        with ThreadPoolExecutor(len(OVERPASS_MIRRORS)) as ex:
            mirrors = list(ex.map(lambda u: ask(u, query), OVERPASS_MIRRORS))
        prod = prod_audit(body_for(template, *PINS[pin], resolved[pin]), h)
        print(json.dumps({"window": label, "pin": pin, "at": at, "mirrors": mirrors, "prod": prod},
                         ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
