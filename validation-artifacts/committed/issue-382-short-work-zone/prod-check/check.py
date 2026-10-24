"""#382 production check: the 50 ft requests that answered 400 before
(F17 flagger; N12 and N14 near-intersection at 45 and 55 mph) build on
www.conestruct.com, and a geometry refusal that stays (freeway lane width
under 11 ft) still answers 400.  Writes results.json and prints one row
per case.

    uv run python validation-artifacts/committed/issue-382-short-work-zone/prod-check/check.py
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
HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"
RC = HERE.parent / "render-check"


def body(case: str) -> dict:
    return json.loads((RC / case / "request.json").read_text(encoding="utf-8"))


LANE_WIDTH = {
    "kind": "shoulder",
    "meta": {"project": "#382 prod check", "address": "", "lat": 0.0, "lng": 0.0},
    "roadType": "freeway",
    "speed": 55,
    "lanes": 2,
    "laneWidth": 10.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 1000.0,
    "night": False,
}

# (case, endpoint, scenario, expected status, expected rule)
CASES = [
    ("F17 flagger, 50 ft", "audit", body("flagger-50"), 200, None),
    ("F17 flagger, 50 ft", "pdf", body("flagger-50"), 200, None),
    ("N12 near-intersection 45 mph, 50 ft", "audit", body("near-int-45-50"), 200, None),
    ("N12 near-intersection 45 mph, 50 ft", "pdf", body("near-int-45-50"), 200, None),
    ("N14 near-intersection 55 mph, 50 ft", "audit", body("near-int-55-50"), 200, None),
    ("N14 near-intersection 55 mph, 50 ft", "pdf", body("near-int-55-50"), 200, None),
    (
        "freeway shoulder, 10 ft lanes (control)",
        "audit",
        LANE_WIDTH,
        400,
        "LANE_WIDTH_BELOW_FREEWAY_MIN",
    ),
]


def main() -> int:
    sha = httpx.get(HEALTHZ, timeout=30).json().get("sha", "")
    rows, ok_all = [], True
    with httpx.Client(
        headers={**gate_headers(BASE), "content-type": "application/json"}, timeout=180
    ) as c:
        for name, ep, sc, want_status, want_rule in CASES:
            r = c.post(f"{BASE}/api/render/{ep}", json={"scenario": sc})
            note = ""
            ok = r.status_code == want_status
            if ok and want_status == 200 and ep == "audit":
                geo = r.json()["sections"]["geometry_validation"]
                rules = [v["rule_id"] for v in geo["violations"]]
                note = f"all_pass={geo['all_pass']} violations={rules}"
                ok = geo["all_pass"] is True and rules == ["WORK_ZONE_SHORT_VS_BUFFER"]
            elif ok and want_status == 200:
                note = f"{r.headers.get('content-type')} {len(r.content)} bytes"
                ok = r.headers.get("content-type", "").startswith("application/pdf")
            elif ok:
                note = r.text[:300]
                ok = want_rule in r.text and "WORK_ZONE_SHORTER_THAN_TAPER" not in r.text
            else:
                note = r.text[:300]
            ok_all &= ok
            rows.append(
                {
                    "case": name,
                    "endpoint": ep,
                    "status": r.status_code,
                    "expect_status": want_status,
                    "note": note,
                    "pass": ok,
                }
            )
            verdict = "PASS" if ok else "FAIL"
            print(f"{verdict} | {name} | /api/render/{ep} | {r.status_code} | {note[:90]}")
    (HERE / "results.json").write_text(
        json.dumps({"healthz_sha": sha, "rows": rows}, indent=1) + "\n"
    )
    print(f"healthz {sha[:7]}; {sum(r['pass'] for r in rows)}/{len(rows)} PASS")
    return 0 if ok_all else 1


if __name__ == "__main__":
    raise SystemExit(main())
