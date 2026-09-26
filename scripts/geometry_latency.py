"""FORWARD COPY (coming-soon-gate C-Q7) of validation-artifacts/committed/
issue-301-band-aerial/probes/geometry_latency.py -- "the Python probe
pattern" -- which stays as recorded.  Changes: ROOT resolves from
scripts/, and every POST sends the gate's bypass header
(scripts/gate.py -- exits loudly on prod without GATE_BYPASS_TOKEN).

#301 checkpoint (b) — how long the corridor-geometry READ takes on prod.

The band already sends this request (WhereBand.tsx:377, for the side
options); an image route would send the same scenario once more.  Three
POSTs per fixture to https://www.conestruct.com/api/render/corridor-geometry
(the public proxy, rate-limited 30/min; a read — no plan is written).

    python geometry_latency.py > geometry-latency.txt
"""

from __future__ import annotations

import json
import statistics
import time
from pathlib import Path

import httpx
from gate import gate_headers

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "validation-artifacts/committed/issue-290-picker-draws/prod-after"
URL = "https://www.conestruct.com/api/render/corridor-geometry"
HEADERS = gate_headers(URL)  # exits before any request

for name in ("broadway-prod-after", "lafayette-flagger-prod-after"):
    body = json.loads((SRC / f"{name}-sided-request.json").read_text(encoding="utf-8"))
    times, status = [], None
    for _ in range(3):
        t = time.perf_counter()
        r = httpx.post(URL, json={"scenario": body["scenario"]}, headers=HEADERS, timeout=60.0)
        times.append((time.perf_counter() - t) * 1000)
        status = (r.status_code, r.json().get("status"), len(r.content))
    print(
        f"{name:32s} {status} runs {', '.join(f'{x:.0f}' for x in times)} ms; "
        f"median {statistics.median(times):.0f} ms"
    )
