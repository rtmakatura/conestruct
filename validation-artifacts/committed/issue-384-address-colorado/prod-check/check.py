"""#384 production check: POST /api/geocode on www.conestruct.com for the
issue's plain-address searches (live-run.txt beside the parent folder),
plus #376's cross-street rows (issue-376-geocode-colorado/prod-check/),
each against its expected answer.  Writes results.json and prints one
table row per case.

    uv run python validation-artifacts/committed/issue-384-address-colorado/prod-check/check.py
"""

import json
import sys
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
sys.path.insert(0, str(REPO / "scripts"))
from gate import gate_headers  # noqa: E402

BASE = "https://www.conestruct.com"
DILLON = {"lat": 39.957998, "lng": -105.090397, "placeType": "intersection"}
BANNOCK = {"lat": 39.739247, "lng": -104.99097, "placeType": "address"}

# (address, jurisdiction_key, expected status, expected body: dict or reason text, source)
CASES = [
    ("100 Main St, Lafayette, CO", None, 404, "check address", "#384 issue (was Wisconsin)"),
    ("100 Main St, Lafayette", None, 404, "check address", "#384 issue (was Indiana)"),
    ("100 Main St, Aurora", None, 404, "check address", "#384 R1 (was Indiana)"),
    ("350 5th Ave, New York, NY", None, 422, "outside colorado", "#384 another state named"),
    (
        "1600 Pennsylvania Ave, Washington, DC",
        None,
        422,
        "outside colorado",
        "#384 another state named",
    ),
    ("Lafayette, LA", None, 422, "outside colorado", "#384 R2 (box: a Leadville street)"),
    ("Denver, PA", None, 422, "outside colorado", "#384 R2 (box: Parkfield, Denver)"),
    (
        "200 S Public Rd, Lafayette",
        None,
        200,
        {"lat": 39.997225, "lng": -105.090456, "placeType": "address"},
        "#384 unchanged",
    ),
    (
        "1 Main St, Longmont, CO 80501",
        None,
        200,
        {"lat": 40.159755, "lng": -105.103291, "placeType": "address"},
        "#384 partial match, typed city",
    ),
    ("1437 Banock St, Denver", None, 200, BANNOCK, "#384 misspelled street, typed city"),
    ("1437 Bannock St, Denver", None, 200, BANNOCK, "#384 full match, no state typed"),
    ("1437 Bannock St, Denver, CO", None, 200, BANNOCK, "#352 / #384 boxed, same answer"),
    ("US 287 & Dillon Rd, Lafayette, CO", None, 200, DILLON, "#376 unchanged"),
    ("US 287 & Dillon Rd, Lafayette", "cdot", 200, DILLON, "#376 unchanged"),
    ("Colfax & Main, Aurora, IL", None, 422, "outside colorado", "#376 unchanged"),
    (
        "Colfax & Williams",
        "denver",
        200,
        {"lat": 39.739964, "lng": -104.966006, "placeType": "intersection"},
        "#352 unchanged",
    ),
]


def main() -> int:
    rows, results, fails = [], [], 0
    with httpx.Client(
        headers={**gate_headers(BASE), "content-type": "application/json"}, timeout=30
    ) as c:
        for addr, jk, want_status, want, src in CASES:
            r = c.post(f"{BASE}/api/geocode", json={"address": addr, "jurisdiction_key": jk})
            body = r.json() if r.status_code == 200 else r.text.strip()
            ok = r.status_code == want_status and body == want
            fails += not ok
            results.append(
                {
                    "address": addr,
                    "jurisdiction_key": jk,
                    "status": r.status_code,
                    "body": body,
                    "expected_status": want_status,
                    "expected": want,
                    "pass": ok,
                    "source": src,
                }
            )
            shown = json.dumps(body, separators=(",", ":")) if isinstance(body, dict) else body
            rows.append(
                f"| `{addr}` | {jk or 'none'} | {shown} | HTTP {r.status_code} | "
                f"{'PASS' if ok else 'FAIL'} | {src} |"
            )
    (HERE / "results.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print("\n".join(rows))
    print(f"{len(CASES) - fails}/{len(CASES)} PASS")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
