"""#378 production check: replay the #370 row R6 request (S Colorado Blvd at
E Exposition Ave, near-intersection, sent with ``divided: true`` and the
carriageway facts) on www.conestruct.com, plus the two requests the new
refusal tells the caller to send.  Writes results.json and prints one row
per case.

    uv run python validation-artifacts/committed/issue-378-stale-gated-docs/prod-check/check.py
"""

import copy
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
R6 = json.loads((REPO / "validation-artifacts/committed/audit-lane/runs/R6/request.json").read_text())["scenario"]

NEW = "divided must be false on a near-intersection plan"
OLD = "aren't supported"


def variant(**changes):
    s = copy.deepcopy(R6)
    s.update(changes)
    return s


# (case, endpoint, scenario, expected status, expected: "new text" | "ok").
# The proxy answers the backend's 422 as 400, the status R6 recorded
# before the fix (audit-lane/runs/R6/audit.json).
CASES = [
    ("R6 replay (divided true)", "audit", R6, 400, "new text"),
    ("R6 replay (divided true)", "pdf", R6, 400, "new text"),
    ("R6, divided false, carriageway facts as sent", "audit", variant(divided=False), 200, "ok"),
    ("R6, divided false, carriageway facts as sent", "pdf", variant(divided=False), 200, "ok"),
    ("R6, divided false, carriageway.confirmed divided", "audit",
     variant(divided=False, carriageway={"confirmed": "divided"}), 200, "ok"),
]


def detail_of(r: httpx.Response) -> str:
    try:
        body = r.json()
    except ValueError:
        return ""
    d = body.get("detail", body.get("error", body.get("message", "")))
    return d if isinstance(d, str) else json.dumps(d)


def main() -> int:
    sha = httpx.get(HEALTHZ, timeout=30).json().get("sha", "")
    rows, ok_all = [], True
    with httpx.Client(headers={**gate_headers(BASE), "content-type": "application/json"}, timeout=120) as c:
        for name, ep, sc, want_status, want in CASES:
            r = c.post(f"{BASE}/api/render/{ep}", json={"scenario": sc})
            d = detail_of(r) if r.status_code != 200 else ""
            if want == "new text":
                ok = NEW in d and OLD not in d
            else:
                ok = True
                if ep == "audit" and r.status_code == 200:
                    ok = "median" in r.text.lower()  # #312's divided words reach the audit
            ok = ok and r.status_code == want_status
            ok_all &= ok
            rows.append({"case": name, "endpoint": ep, "status": r.status_code, "expect_status": want_status,
                         "expect": want, "detail": d, "pass": ok})
            print(f"{'PASS' if ok else 'FAIL'} | {name} | /api/render/{ep} | {r.status_code} | {d[:90]}")
    (HERE / "results.json").write_text(json.dumps({"healthz_sha": sha, "rows": rows}, indent=1) + "\n")
    print(f"healthz {sha[:7]}; {sum(r['pass'] for r in rows)}/{len(rows)} PASS")
    return 0 if ok_all else 1


if __name__ == "__main__":
    raise SystemExit(main())
