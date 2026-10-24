"""#377 production check: replay the #370 row R1 request (N Broadway at
E 11th Ave, Denver: one-way, 5 lanes) on www.conestruct.com, plus three
variants of it, each against its expected answer.  Writes results.json and
prints one table row per case.

    uv run python validation-artifacts/committed/issue-377-oneway-flagger/prod-check/check.py
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
R1 = json.loads((REPO / "validation-artifacts/committed/audit-lane/runs/R1/request.json").read_text())["scenario"]

LANE_MSG = (
    "This road appears to carry more lanes than a flagger operation covers. "
    "TA-10 applies where one through lane runs in each direction. If detection "
    "is wrong, confirm 'Road has one through lane in each direction' in the form "
    "and regenerate."
)


def variant(**changes):
    s = copy.deepcopy(R1)
    for k, v in changes.items():
        if v is None:
            s.pop(k, None)
        else:
            s[k] = v
    return s


# (case, endpoint, scenario, expected status, expected: "one-way" | "lane exact" | "ok")
CASES = [
    ("R1 replay (one-way, 5 lanes)", "pdf", R1, 400, "one-way"),
    ("R1 replay (one-way, 5 lanes)", "device-breakdown", R1, 400, "one-way"),
    ("R1 replay (one-way, 5 lanes)", "audit", R1, 400, "one-way"),
    ("R1, one-way, 1 lane", "pdf", variant(detectedLanesTotal=1), 400, "one-way"),
    ("R1, two-way confirmed, 5 lanes", "pdf", variant(oneway=None), 400, "lane exact"),
    ("R1, two-way confirmed, lanes confirmed", "pdf", variant(oneway=None, detectedLanesTotal=None), 200, "ok"),
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
            if want == "one-way":
                ok = "one-way street" in d and "Road carries two-way traffic" in d and "more lanes" not in d
            elif want == "lane exact":
                ok = d == LANE_MSG
            else:
                ok = True
            ok = ok and r.status_code == want_status
            ok_all &= ok
            rows.append({"case": name, "endpoint": ep, "status": r.status_code, "expect_status": want_status,
                         "expect": want, "detail": d, "pass": ok})
            print(f"{'PASS' if ok else 'FAIL'} | {name} | /api/render/{ep} | {r.status_code} | {d[:70]}")
    (HERE / "results.json").write_text(json.dumps({"healthz_sha": sha, "rows": rows}, indent=1) + "\n")
    print(f"healthz {sha[:7]}; {sum(r['pass'] for r in rows)}/{len(rows)} PASS")
    return 0 if ok_all else 1


if __name__ == "__main__":
    raise SystemExit(main())
