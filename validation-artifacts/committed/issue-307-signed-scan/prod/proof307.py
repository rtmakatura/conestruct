"""#307 prod proof (R151: "Prove 20 of 20 downloads on prod with no re-scan").

Read-only, prod, through the gate and the site's own routes.  For 5 Denver
pins (bodies as measure_refusals.py builds them, scan on): one Generate
(POST /api/render/audit with include_scan_token), then four downloads at
+0, +30, +90 and +150 s after it answered -- pdf, xlsx, crew-pdf, quote, one
each -- carrying the returned site_scan_token as the site does.  Each
download's x-site-scan-source must read "token" (built from the Generate's
scan; no Overpass request).  Then one download with a tampered token, which
must be the honest 400 site_scan_token_invalid.  Pins run in parallel; the
busiest 60 s holds 10 downloads, under the route's 20-per-minute limit.

  python proof307.py > out/proof-run1.jsonl
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(r"C:\Users\rtmak\Documents\traffic-control-tool")
EVID = ROOT / "validation-artifacts/committed/scan-refusal-rate/probes"
sys.path.insert(0, str(EVID))
sys.path.insert(0, str(ROOT / "scripts"))
sys.stdout.reconfigure(encoding="utf-8")
from gate import gate_headers  # noqa: E402
from measure_refusals import PINS, SITE, TEMPLATE, body_for  # noqa: E402

PLAN = ((0, "pdf"), (30, "xlsx"), (90, "crew-pdf"), (150, "quote"))


def post(path: str, body: dict, h: dict) -> httpx.Response:
    return httpx.post(f"{SITE}{path}", json=body, headers=h, timeout=200)


def run_pin(name: str, scenario: dict, h: dict) -> dict:
    at = datetime.now(UTC).isoformat(timespec="seconds")
    t0 = time.time()
    gen = post("/api/render/audit", {"scenario": {**scenario, "include_scan_token": True}}, h)
    out: dict = {"pin": name, "at": at, "generate": {"http": gen.status_code, "seconds": round(time.time() - t0, 1)}}
    if gen.status_code != 200:
        out["generate"]["text"] = gen.text[:200]
        return out
    j = gen.json()
    scan = j["sections"]["site_scan"]
    token = j.get("site_scan_token")
    out["generate"].update(scan_status=scan.get("status"), memo_hit=scan.get("memo_hit"), token=bool(token))
    if not token:
        return out
    signed = {**scenario, "site_scan": {**scenario["site_scan"], "token": token}}
    t_gen = time.time()
    downloads = []
    for delay, kind in PLAN:
        wait = t_gen + delay - time.time()
        if wait > 0:
            time.sleep(wait)
        t1 = time.time()
        body = {"scenario": signed} if kind != "quote" else {"scenario": signed, "settings": {}}
        r = post(f"/api/render/{kind}", body, h)
        downloads.append(
            {
                "delay_s": delay,
                "kind": kind,
                "http": r.status_code,
                "source": r.headers.get("x-site-scan-source"),
                "bytes": len(r.content),
                "seconds": round(time.time() - t1, 1),
                **({"text": r.text[:200]} if r.status_code != 200 else {}),
            }
        )
    out["downloads"] = downloads
    return out


def main() -> None:
    h = gate_headers(SITE)
    template = json.loads(TEMPLATE.read_text("utf-8"))["scenario"]
    resolved = json.loads((EVID / "out" / "pins-resolved.json").read_text("utf-8"))
    names = [n for n in PINS if n in resolved][:5]
    bodies = {n: body_for(template, *PINS[n], resolved[n]) for n in names}
    with ThreadPoolExecutor(len(names)) as ex:
        futs = [ex.submit(run_pin, n, bodies[n], h) for n in names]
        rows = [f.result() for f in futs]
    for row in rows:
        print(json.dumps(row, ensure_ascii=False), flush=True)
    # One tampered token: the honest refusal.
    first = names[0]
    gen = post("/api/render/audit", {"scenario": {**bodies[first], "include_scan_token": True}}, h).json()
    bad = gen["site_scan_token"][:-2] + ("AA" if not gen["site_scan_token"].endswith("AA") else "BB")
    r = post("/api/render/pdf", {"scenario": {**bodies[first], "site_scan": {**bodies[first]["site_scan"], "token": bad}}}, h)
    detail = r.json().get("detail") if r.headers.get("content-type", "").startswith("application/json") else r.text[:200]
    print(json.dumps({"tampered": {"http": r.status_code, "detail": detail}}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
