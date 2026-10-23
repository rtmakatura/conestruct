"""#376 production check: POST /api/geocode on www.conestruct.com for the
issue's four searches, the two named-state refusals, and #352's production
check rows (issue-352-authority-areas/prod-check.md), each against its
expected answer.  Writes results.json and prints one table row per case.

    uv run python validation-artifacts/committed/issue-376-geocode-colorado/prod-check/check.py
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

# (address, jurisdiction_key, expected status, expected body: dict or reason text, source)
CASES = [
    ("US 287 & Dillon Rd, Lafayette, CO", None, 200, DILLON, "#376 row 1 (was California)"),
    ("US 287 & Dillon Rd, Lafayette", None, 200, DILLON, "#376 row 2 (was Louisiana)"),
    ("US 287 & Dillon Rd, Lafayette", "cdot", 200, DILLON, "#376 row 3 (was Louisiana)"),
    ("US 287 & Dillon Rd, Lafayette, Colorado", None, 200, DILLON, "#376 row 4"),
    ("Colfax & Main, Aurora, IL", None, 422, "outside colorado", "#376 R1 (was Aurora, Illinois)"),
    ("Johnston & Pinhook, Lafayette, LA", None, 422, "outside colorado", "#376 R1"),
    (
        "US 285 & CO 9",
        "cdot",
        200,
        {"lat": 39.221229, "lng": -105.993766, "placeType": "intersection"},
        "#352",
    ),
    (
        "I-25 & US 50",
        "cdot",
        200,
        {"lat": 38.338098, "lng": -104.619794, "placeType": "intersection"},
        "#352",
    ),
    (
        "Colfax & Main",
        "cdot",
        200,
        {"lat": 39.738365, "lng": -104.323716, "placeType": "intersection"},
        "#352",
    ),
    (
        "Academy & Platte",
        "el_paso",
        200,
        {"lat": 38.839656, "lng": -104.757338, "placeType": "intersection"},
        "#352",
    ),
    (
        "Eisenhower & Lincoln",
        "loveland",
        200,
        {"lat": 40.407199, "lng": -105.073065, "placeType": "intersection"},
        "#352",
    ),
    ("Colfax & Main", "e470", 422, "add a city", "#352"),
    ("Colfax & Main", None, 422, "add a city", "#352"),
    (
        "Colfax & Williams",
        None,
        200,
        {"lat": 39.739964, "lng": -104.966006, "placeType": "intersection"},
        "#352",
    ),
    (
        "Colfax & Williams",
        "denver",
        200,
        {"lat": 39.739964, "lng": -104.966006, "placeType": "intersection"},
        "#352",
    ),
    (
        "1437 Bannock St, Denver, CO",
        None,
        200,
        {"lat": 39.739247, "lng": -104.99097, "placeType": "address"},
        "#352",
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
