"""The worst-case fixtures' site-scan stub (#383), shared by every test
that renders tests/fixtures/pdf_worst_case through the real scan path.

Each fixture's ``_provenance.overpass`` names its Overpass answer:
"recorded" serves tests/fixtures/site_scan/lakewood_overpass.json, "down"
serves "mirrors down", and no key installs nothing (the fixture never
scans).  The network is never reached.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "pdf_worst_case"
SCAN_PAYLOAD = Path(__file__).parent / "fixtures" / "site_scan" / "lakewood_overpass.json"


def stub_worst_case_scan(name: str, monkeypatch: pytest.MonkeyPatch) -> None:
    """Clear the scan memo, then route fixture ``name``'s Overpass trip to
    its stub, so no fixture serves another's scan."""
    from src.api import site_scan as ss
    from src.rules import site_detection as sd

    ss.clear_memo()
    prov = json.loads((FIXTURE_DIR / f"{name}.json").read_text(encoding="utf-8"))
    mode = prov.get("_provenance", {}).get("overpass")
    if mode == "recorded":
        payload = json.loads(SCAN_PAYLOAD.read_text(encoding="utf-8"))
        monkeypatch.setattr(sd, "_overpass_request_with_fallback", lambda q, **_k: (payload, None))
    elif mode == "down":
        monkeypatch.setattr(
            sd, "_overpass_request_with_fallback", lambda q, **_k: (None, "stub: mirrors down")
        )
