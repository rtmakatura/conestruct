"""#292: the exact Overpass query the prod scan sends for each measured pin.

Read-only, no network.  Each pin's body is the site's request (as
scan-refusal-rate/probes/measure_refusals.py builds it, road confirmed from
the resolved candidates kept in pins-resolved.json), relayed the way the
site proxy relays it (centerline + roadDirection, as note8_probe.relayed),
then run through the backend at this checkout with the Overpass fetch
replaced by a recorder: the query is captured and the scan told the mirrors
are down.  Writes out/queries.json {pin: query}.

R76 (2026-10-02) adds the Federal pin: its body is the site's own request
as #304 captured it (tests/fixtures/site_scan/federal_request.json; no
confirmed road, so the relay leaves it as it is).

  python build_queries.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "probe"
EVID = ROOT / "validation-artifacts/committed/scan-refusal-rate/probes"
sys.path.insert(0, str(EVID))

from fastapi.testclient import TestClient  # noqa: E402

from src.api import render_api  # noqa: E402
from src.api import site_scan as ss  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from measure_refusals import PINS, TEMPLATE, body_for  # noqa: E402

sys.path.insert(0, str(ROOT / "validation-artifacts/committed/issue-243-note-8/recheck-2f27be3"))
from note8_probe import relayed  # noqa: E402

FEDERAL = ROOT / "tests/fixtures/site_scan/federal_request.json"


def extra_bodies() -> dict[str, dict]:
    """R76: pins measured from a captured body rather than built from PINS."""
    return {"federal": json.loads(FEDERAL.read_text("utf-8"))["scenario"]}


def main() -> None:
    template = json.loads(TEMPLATE.read_text("utf-8"))["scenario"]
    resolved = json.loads((EVID / "out" / "pins-resolved.json").read_text("utf-8"))
    captured: dict[str, str] = {}
    current = {"pin": ""}

    def recorder(query, **_k):
        captured[current["pin"]] = query
        return None, "probe: query captured, no request sent"

    sd._overpass_request_with_fallback = recorder
    client = TestClient(render_api.app, raise_server_exceptions=False)
    for name in PINS:
        if name not in resolved:
            continue
        ss.clear_memo()
        current["pin"] = name
        body = relayed(body_for(template, *PINS[name], resolved[name]))
        r = client.post("/render/audit", json=body, headers={"Authorization": "Bearer probe"})
        print(f"{name}: HTTP {r.status_code}; query {len(captured.get(name, ''))} chars")
    for name, body in extra_bodies().items():
        ss.clear_memo()
        current["pin"] = name
        r = client.post("/render/audit", json=relayed(body), headers={"Authorization": "Bearer probe"})
        print(f"{name}: HTTP {r.status_code}; query {len(captured.get(name, ''))} chars")
    (HERE / "out" / "queries.json").write_text(json.dumps(captured, indent=1), "utf-8")


if __name__ == "__main__":
    main()
