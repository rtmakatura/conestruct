"""The coming-soon gate's bypass header for Python probes.

coming-soon-gate rulings.md R1.4, C-Q7 -- the same contract as
scripts/gate.cjs:

    from gate import gate_headers
    httpx.post(URL, json=body, headers=gate_headers(URL))

The token comes from the GATE_BYPASS_TOKEN env var -- never the repo,
never printed.  Targeting production without it FAILS LOUDLY (every
/api call would 401 behind the gate); anywhere else the header is sent
when the token is set and omitted when it is not.
"""

from __future__ import annotations

import os
from urllib.parse import urlsplit

GATE_HEADER = "x-conestruct-gate"


def is_production(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return host == "conestruct.com" or host.endswith(".conestruct.com")


def gate_headers(url: str) -> dict[str, str]:
    token = os.environ.get("GATE_BYPASS_TOKEN")
    if token:
        return {GATE_HEADER: token}
    if is_production(url):
        raise SystemExit(
            f"GATE_BYPASS_TOKEN is not set, and {urlsplit(url).netloc} is behind "
            "the coming-soon gate: every /api call would 401.  Set "
            "GATE_BYPASS_TOKEN (the value in Vercel prod) and re-run."
        )
    return {}
