"""#306 investigate: which Modal container serves each half of a Generate?

Read-only, prod, through the gate.  For 5 Denver pins (bodies from
scan-refusal-rate/probes/out/pins-resolved.json, built as measure_refusals.py
builds them) it sends /api/render/device-breakdown and /api/render/audit at
once, as the site's Generate does, and records each call's status, time and
scan provenance.  Then it reads the Modal app log for the same window with
container ids (modal app logs --timestamps --show-container-id), so each POST
line can be matched to the container that served it.

  python container_pairs.py > out/container-pairs.txt
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from datetime import UTC, datetime, timedelta
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
from concurrent.futures import ThreadPoolExecutor  # noqa: E402

MODAL = Path(sys.executable).parent / "modal.exe"  # the venv that runs this probe


def main() -> None:
    h = gate_headers(SITE)
    template = json.loads(TEMPLATE.read_text("utf-8"))["scenario"]
    resolved = json.loads((EVID / "out" / "pins-resolved.json").read_text("utf-8"))
    start = datetime.now(UTC) - timedelta(seconds=5)
    print(f"window start {start.isoformat(timespec='seconds')}")
    for name in [n for n in PINS if n in resolved][4:9]:
        body = body_for(template, *PINS[name], resolved[name])
        at = datetime.now(UTC).isoformat(timespec="seconds")
        with ThreadPoolExecutor(2) as ex:
            fb = ex.submit(call, "device-breakdown", body, h)
            fa = ex.submit(call, "audit", body, h)
            rows = [fb.result(), fa.result()]
        print(json.dumps({"pin": name, "at": at, "calls": rows}, ensure_ascii=False), flush=True)
    time.sleep(20)  # let the log catch up
    since = start.strftime("%Y-%m-%dT%H:%M:%S")
    out = subprocess.run(
        [str(MODAL), "app", "logs", "conestruct-render", "--since", since,
         "--timestamps", "--show-container-id", "--search", "POST /render/"],
        capture_output=True, text=True, timeout=120, encoding="utf-8", errors="replace",
    )
    print("\n--- modal app logs (POST /render/ lines, with container ids)")
    print(out.stdout)
    if out.returncode:
        print("stderr:", out.stderr[:500])


if __name__ == "__main__":
    main()
