"""#306 investigate, option (b): audit first, then the breakdown -- does the
breakdown land on the container that just scanned (and hit its memo)?

Read-only, prod, through the gate.  For 8 Denver pins (bodies as
measure_refusals.py builds them): POST /api/render/audit, wait for it, then
POST /api/render/device-breakdown; record each call's status and time.  The
container that served each is read afterwards from the Modal app log
(--timestamps --show-container-id), saved beside the output.

  python sequential_pairs.py > out/sequential-pairs.txt
"""

from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
EVID = ROOT / "validation-artifacts/committed/scan-refusal-rate/probes"
sys.path.insert(0, str(EVID))
sys.path.insert(0, str(ROOT / "scripts"))
sys.stdout.reconfigure(encoding="utf-8")
from gate import gate_headers  # noqa: E402
from measure_concurrent import call  # noqa: E402
from measure_refusals import PINS, SITE, TEMPLATE, body_for  # noqa: E402


def main() -> None:
    h = gate_headers(SITE)
    template = json.loads(TEMPLATE.read_text("utf-8"))["scenario"]
    resolved = json.loads((EVID / "out" / "pins-resolved.json").read_text("utf-8"))
    for name in [n for n in PINS if n in resolved][:8]:
        body = body_for(template, *PINS[name], resolved[name])
        at = datetime.now(UTC).isoformat(timespec="seconds")
        a = call("audit", body, h)
        b = call("device-breakdown", body, h)
        print(json.dumps({"pin": name, "at": at, "calls": [a, b]}, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
