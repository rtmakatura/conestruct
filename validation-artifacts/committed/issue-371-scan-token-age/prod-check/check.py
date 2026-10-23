"""#371 production check: a fresh token serves, an old token is refused.

Run from the repo root: ``uv run python validation-artifacts/committed/issue-371-scan-token-age/prod-check/check.py``.
It goes through www.conestruct.com's ``/api/render/*`` proxy (the audit
lane's gate headers) and writes ``results.json`` beside itself.  No token
is ever written: tokens stay in memory, and the results keep only each
token's signed ``measured_at`` (read from the payload, which needs no
secret) and the answers.

1. Fresh: the audit lane's F1 request, Generated with
   ``include_scan_token``, then ``/api/render/pdf`` carrying the token.
2. Old: the tokens #370 session 3 committed in ``a408abe`` (F1, F10) and
   the one main held at ``4a71429`` (issue-331, scanned 2026-10-16), each
   sent on a PDF request.  Expected: 400 ``site_scan_token_invalid`` with
   the expired message when the signed scan is more than 12 h old.
"""

from __future__ import annotations

import base64
import json
import subprocess
import sys
import time
import zlib
from datetime import UTC, datetime
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
sys.path.insert(0, str(REPO / "scripts"))
from gate import gate_headers  # noqa: E402

BASE = "https://www.conestruct.com"
LANE = "validation-artifacts/committed/audit-lane/runs"
OLD = {
    "a408abe F1": ("a408abe", f"{LANE}/F1/audit.json"),
    "a408abe F10": ("a408abe", f"{LANE}/F10/audit.json"),
    "4a71429 issue-331": (
        "4a71429",
        "validation-artifacts/committed/issue-331-lsd-sign-distance/prod-d4c244f/audit.json",
    ),
}


def measured_at(token: str) -> str:
    body = token.split(".")[0]
    payload = json.loads(zlib.decompress(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))))
    return str(payload["measured_at"])


def age_h(stamp: str, now: datetime) -> float:
    return round((now - datetime.fromisoformat(stamp)).total_seconds() / 3600, 2)


def answer(r: httpx.Response) -> dict:
    out: dict = {"status": r.status_code, "x-site-scan-source": r.headers.get("x-site-scan-source")}
    if r.status_code != 200:
        detail = r.json().get("detail", {})
        out |= {k: detail.get(k) for k in ("error", "message", "reason")}
    return out


def main() -> None:
    c = httpx.Client(
        headers={**gate_headers(BASE), "content-type": "application/json"}, timeout=300
    )
    sc = json.loads((REPO / LANE / "F1" / "request.json").read_text("utf-8"))["scenario"]
    results: dict = {"base": BASE, "checked_at": datetime.now(UTC).isoformat(timespec="seconds")}

    gen = c.post(f"{BASE}/api/render/audit", json={"scenario": {**sc, "include_scan_token": True}})
    token = gen.json().get("site_scan_token") if gen.status_code == 200 else None
    fresh: dict = {"generate_status": gen.status_code, "token_returned": bool(token)}
    if token:
        fresh["measured_at"] = measured_at(token)
        time.sleep(5)
        dl = c.post(
            f"{BASE}/api/render/pdf",
            json={"scenario": {**sc, "site_scan": {"proceed_if_unavailable": False, "token": token}}},
        )
        fresh["pdf"] = answer(dl) | {"bytes": len(dl.content)}
    results["fresh"] = fresh

    now = datetime.now(UTC)
    results["old"] = {}
    for name, (sha, path) in OLD.items():
        raw = subprocess.run(
            ["git", "show", f"{sha}:{path}"], cwd=REPO, capture_output=True, check=True
        ).stdout
        tok = json.loads(raw)["site_scan_token"]
        stamp = measured_at(tok)
        time.sleep(5)
        r = c.post(
            f"{BASE}/api/render/pdf",
            json={"scenario": {**sc, "site_scan": {"proceed_if_unavailable": False, "token": tok}}},
        )
        results["old"][name] = {"measured_at": stamp, "age_h": age_h(stamp, now)} | answer(r)

    (HERE / "results.json").write_text(json.dumps(results, indent=1) + "\n", "utf-8")
    print(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
