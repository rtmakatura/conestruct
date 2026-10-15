"""#307 measure first (option (c)): after a Generate, does a download reuse its scan?

Read-only, prod, through the gate. For 5 Denver pins (bodies as
measure_refusals.py builds them, scan on): one POST /api/render/audit (the
Generate), then four follow-up POST /api/render/audit at +0, +30, +90 and
+150 s after the Generate answered. Every download route builds its plan
through the same ``_placements_for`` scan as the audit, on the same Modal app,
so a follow-up audit is the download's scan with its provenance visible:
``memo_hit`` true = the download reused the Generate's scan; false = it
scanned again (and could refuse, or answer differently). +150 s is past the
memo's 120 s TTL. Pins run in parallel, as five users would.

  python measure307.py > out/followups.jsonl
"""

from __future__ import annotations

import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(r"C:\Users\rtmak\Documents\traffic-control-tool")
EVID = ROOT / "validation-artifacts/committed/scan-refusal-rate/probes"
sys.path.insert(0, str(EVID))
sys.path.insert(0, str(ROOT / "scripts"))
sys.stdout.reconfigure(encoding="utf-8")
from gate import gate_headers  # noqa: E402
from measure_concurrent import call  # noqa: E402
from measure_refusals import PINS, SITE, TEMPLATE, body_for  # noqa: E402

DELAYS_S = (0, 30, 90, 150)


def run_pin(name: str, body: dict, h: dict) -> dict:
    at = datetime.now(UTC).isoformat(timespec="seconds")
    gen = call("audit", body, h)
    t_gen = time.time()
    follow = []
    for d in DELAYS_S:
        wait = t_gen + d - time.time()
        if wait > 0:
            time.sleep(wait)
        follow.append({"delay_s": d, **call("audit", body, h)})
    return {"pin": name, "at": at, "generate": gen, "followups": follow}


def main() -> None:
    h = gate_headers(SITE)
    template = json.loads(TEMPLATE.read_text("utf-8"))["scenario"]
    resolved = json.loads((EVID / "out" / "pins-resolved.json").read_text("utf-8"))
    names = [n for n in PINS if n in resolved][:5]
    with ThreadPoolExecutor(len(names)) as ex:
        futs = [ex.submit(run_pin, n, body_for(template, *PINS[n], resolved[n]), h) for n in names]
        for f in futs:
            print(json.dumps(f.result(), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
