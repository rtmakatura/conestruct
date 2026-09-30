"""The site's Generate fires /api/render/device-breakdown and /api/render/audit
at once (the #243 sweep log: both REQ lines before either RES).  Does each run
its own scan?  Read-only, prod, through the gate.  For each pin (bodies from
out/pins-resolved.json, as measure_refusals.py builds them), after the memo's
TTL, the two calls go out concurrently; each one's HTTP status and wall time
are recorded, and the audit's scan provenance.  A breakdown that takes about
as long as the audit ran its own scan; one that takes ~1 s was served from
the memo.

  python measure_concurrent.py > out/concurrent.jsonl
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
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parents[3] / "scripts"))
from gate import gate_headers  # noqa: E402
from measure_refusals import PINS, SITE, TEMPLATE, body_for  # noqa: E402


def call(ep: str, body: dict, h: dict) -> dict:
    t0 = time.time()
    r = httpx.post(f"{SITE}/api/render/{ep}", json={"scenario": body}, headers=h, timeout=200)
    out = {"endpoint": ep, "http": r.status_code, "seconds": round(time.time() - t0, 1)}
    try:
        j = r.json()
    except Exception:  # noqa: BLE001
        return {**out, "text": r.text[:200]}
    scan = j["sections"]["site_scan"] if r.status_code == 200 and "sections" in j else (
        (j.get("detail") or {}).get("site_scan") if isinstance(j, dict) and isinstance(j.get("detail"), dict) else None
    )
    if scan:
        out.update(scan_status=scan.get("status"), mirror=scan.get("mirror"),
                   duration_ms=scan.get("duration_ms"), memo_hit=scan.get("memo_hit"), error=scan.get("error"))
    elif r.status_code != 200:
        out["text"] = r.text[:200]
    return out


def main() -> None:
    h = gate_headers(SITE)
    template = json.loads(TEMPLATE.read_text("utf-8"))["scenario"]
    resolved = json.loads((HERE / "out" / "pins-resolved.json").read_text("utf-8"))
    for name in [n for n in PINS if n in resolved][:5]:
        body = body_for(template, *PINS[name], resolved[name])
        at = datetime.now(UTC).isoformat(timespec="seconds")
        with ThreadPoolExecutor(2) as ex:
            fb = ex.submit(call, "device-breakdown", body, h)
            fa = ex.submit(call, "audit", body, h)
            rows = [fb.result(), fa.result()]
        print(json.dumps({"pin": name, "at": at, "calls": rows}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
