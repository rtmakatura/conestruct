"""R117/R118 build: write the new leaves into the tiering recordings, and nothing else.

R117 Q1b adds three leaves to the wire: ``raised`` and ``device_label`` on
the applied jurisdiction deltas (``raised`` only on fired count add-device
deltas), and ``jurisdiction_added`` on jurisdiction-required breakdown
rows.  The recordings in tests/fixtures/tiering/ are historical (older wire
versions), so they are not re-recorded wholesale: each fixture's scenario is
recomputed through the real API path (TestClient /render/device-breakdown,
Overpass stubbed empty, no network) and ONLY those leaves are copied into
the recording.  Every other leaf stays as recorded.  A row is matched by its
(device, code); a fixture whose live rows don't match its recorded rows
one-to-one is refused rather than guessed.

    python rerecord_r117.py [--check]

``--check`` prints what would change and writes nothing.
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
os.environ["MAPBOX_TOKEN"] = ""
sys.stdout.reconfigure(encoding="utf-8")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]

TIERING = ROOT / "tests" / "fixtures" / "tiering"
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}
CHECK = "--check" in sys.argv[1:]


def main() -> int:
    client = TestClient(app)
    for path in sorted(TIERING.glob("*.json")):
        if path.name == "tiering-expectations.json":
            continue
        fx = json.loads(path.read_text(encoding="utf-8"))
        jur = fx.get("jurisdiction")
        if not jur:
            print(f"{path.name}: no jurisdiction block, unchanged")
            continue
        r = client.post("/render/device-breakdown", headers=AUTH, json=fx["scenario"])
        if r.status_code != 200:
            print(f"{path.name}: live breakdown {r.status_code}, REFUSED: {r.text[:200]}")
            return 1
        live = r.json()
        out = copy.deepcopy(fx)
        changes: list[str] = []
        rec_deltas = out["jurisdiction"]["applied_deltas"]
        live_deltas = live["jurisdiction"]["applied_deltas"]
        if len(rec_deltas) != len(live_deltas):
            print(f"{path.name}: delta count differs ({len(rec_deltas)} vs {len(live_deltas)}), REFUSED")
            return 1
        for i, (rd, ld) in enumerate(zip(rec_deltas, live_deltas, strict=True)):
            for key in ("raised", "device_label"):
                if key in ld and rd.get(key) != ld[key]:
                    rd[key] = ld[key]
                    changes.append(f"jurisdiction.applied_deltas[{i}].{key} = {ld[key]!r}")
        if "breakdown" in out:
            rec_rows = out["breakdown"]["devices"]
            live_rows = {(d["device"], d["code"]): d for d in live["devices"]}
            for j, row in enumerate(rec_rows):
                if not row.get("jurisdiction_required"):
                    continue
                lr = live_rows.get((row["device"], row["code"]))
                if lr is None or lr["qty"] != row["qty"]:
                    print(f"{path.name}: row {row['device']!r} has no live twin with qty {row['qty']}, REFUSED")
                    return 1
                if row.get("jurisdiction_added") != lr["jurisdiction_added"]:
                    row["jurisdiction_added"] = lr["jurisdiction_added"]
                    changes.append(f"breakdown.devices[{j}].jurisdiction_added = {lr['jurisdiction_added']}")
        print(f"{path.name}: {len(changes)} leaf(s)")
        for c in changes:
            print(f"   {c}")
        if changes and not CHECK:
            raw = path.read_bytes().decode("utf-8")
            nl = "\r\n" if "\r\n" in raw else "\n"
            # Each recording's own format (the s2-arc7 files: indent 1,
            # ASCII escapes, no trailing newline; the s2-arc17/18 files:
            # indent 2, UTF-8, trailing newline) -- found by round-tripping
            # the file as it is, so only the new leaves change.  A file no
            # candidate reproduces is refused.
            fmt = next(
                (
                    (ind, ea, tn)
                    for ind in (1, 2)
                    for ea in (True, False)
                    for tn in ("", "\n")
                    if (json.dumps(fx, indent=ind, ensure_ascii=ea) + tn).replace("\n", nl) == raw
                ),
                None,
            )
            if fmt is None:
                print(f"{path.name}: format not reproducible, REFUSED")
                return 1
            ind, ea, tn = fmt
            text = json.dumps(out, indent=ind, ensure_ascii=ea) + tn
            path.write_bytes(text.replace("\n", nl).encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
