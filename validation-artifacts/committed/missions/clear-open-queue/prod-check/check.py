"""Mission clear-open-queue (#387) production check of 0ea3e8a.

    #385/#383/#380  healthz sha == origin/main (comments and tests only)
    #381  a Thornton crew sheet lists the jurisdiction-required row and
          quotes stipulation 6; a CDOT crew sheet has no such row
    #369  POST /render/corridor-map answers image/jpeg with JPEG bytes
          (the backend route itself)
    #367  CDOT lane-closure audits at 65/75 mph; a shoulder at 65 mph
          still cites Sheet 7 Case 11

Requests go straight to the Modal backend (Bearer MODAL_RENDER_SECRET from
conestruct/site/.env.local; never printed or saved).  The site proxy was not
used: the GATE_BYPASS_TOKEN in .env.local answers 401 on www.conestruct.com.
Writes results.json and prints one row per case.

    uv run python validation-artifacts/committed/missions/clear-open-queue/prod-check/check.py
"""

import copy
import json
import os
import subprocess
from pathlib import Path
from typing import Any

import httpx

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
BACKEND = "https://rtmakatura--conestruct-render-fastapi-app.modal.run"

# tests/test_plan_sheet_device_summary.py FLAGGER_BODY / SHOULDER_BODY
FLAGGER = {
    "kind": "flagger_lane_closure",
    "meta": {"project": "#387 prod check", "address": "", "lat": 0.0, "lng": 0.0},
    "roadType": "rural_undivided",
    "speed": 45,
    "laneWidth": 11.0,
    "workType": "utility_cut",
    "duration": "short",
    "workLen": 1000.0,
    "night": False,
    "pilotCar": False,
    "afad": False,
    "pedestrianAccess": False,
}
SHOULDER = {
    "kind": "shoulder",
    "meta": {"project": "#387 prod check", "address": "", "lat": 0.0, "lng": 0.0},
    "roadType": "rural_divided",
    "speed": 55,
    "lanes": 2,
    "laneWidth": 12.0,
    "divided": True,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 800.0,
    "night": False,
}


# tests/s630/_harness.py _common(speed, None); the control asserts as
# tests/s630/test_lane_buffer_cite_367.py does (source and lookup end on Case 11)
def freeway_shoulder(speed: int) -> dict[str, Any]:
    return {
        "kind": "shoulder",
        "meta": {"project": "#387 prod check"},
        "roadType": "freeway",
        "speed": speed,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }


# tests/s630/test_lane_stepdown_361.py _LANE_BODY
def lane(speed: int) -> dict[str, Any]:
    return {
        "kind": "lane_closure_divided",
        "meta": {"project": "#387 prod check"},
        "roadType": "freeway",
        "speed": speed,
        "laneWidth": 12.0,
        "workType": "pavement_repair",
        "duration": "short",
        "workLen": 1000.0,
        "night": False,
        "truckMountedAttenuator": False,
    }


AWS = "Advance Warning Signs (jurisdiction-required)"


def _rules(node: Any) -> list[str]:
    if isinstance(node, dict):
        own = [node["rule"]] if isinstance(node.get("rule"), str) else []
        return own + [s for v in node.values() for s in _rules(v)]
    if isinstance(node, list):
        return [s for v in node for s in _rules(v)]
    return []


# data/jurisdictions/thornton.json:53, read from the file (verbatim).
RULE = next(
    s
    for s in _rules(json.loads((REPO / "data/jurisdictions/thornton.json").read_text("utf-8")))
    if "stipulation #6" in s
)
TABLE_6B_2 = "MUTCD 11th Ed. Sec 6B.06, Table 6B-2 (stopping sight distance)."
CASE_11 = "CDOT S-630-1 Sheet 7 Case 11 (buffer VARIES per General Note 24)."


def with_j(base: dict, key: str | None) -> dict:
    b = copy.deepcopy(base)
    if key:
        b["jurisdiction_key"] = key
    return b


def equipment(md: str) -> str:
    return md.split("## Required Equipment", 1)[-1].split("## ", 1)[0]


def find_buffer(audit: dict) -> dict | None:
    secs = audit.get("sections", audit)
    if isinstance(secs.get("buffer"), dict):
        return secs["buffer"]
    return None


rows: list[dict[str, Any]] = []


def row(check: str, case: str, ok: bool | None, observed: str) -> None:
    rows.append({"check": check, "case": case, "pass": ok, "observed": observed})
    v = {True: "PASS", False: "FAIL", None: "N/A"}[ok]
    print(f"{v} | {check} | {case} | {observed[:160]}")


def main() -> int:
    head = subprocess.run(
        ["git", "rev-parse", "origin/main"], capture_output=True, text=True, cwd=REPO
    ).stdout.strip()
    sha = httpx.get(f"{BACKEND}/healthz", timeout=60).json().get("sha", "")
    row(
        "#385 #383 #380",
        "healthz sha == origin/main",
        sha == head and bool(sha),
        f"healthz {sha} / origin/main {head}",
    )

    secret = os.environ["MODAL_RENDER_SECRET"]
    api = httpx.Client(headers={"authorization": f"Bearer {secret}"}, timeout=180)

    # --- #381 crew sheet -------------------------------------------------
    quote = f'{AWS}. Thornton Construction & TC Permit handout, stipulation 6: "{RULE}"'
    for name, body in (
        ("Thornton flagger", with_j(FLAGGER, "thornton")),
        ("Thornton shoulder", with_j(SHOULDER, "thornton")),
    ):
        r = api.post(f"{BACKEND}/render/markdown", json=body)
        md = r.text.replace("\r\n", "\n")
        listed = f"- 1× {AWS}\n" in equipment(md)
        quoted = quote in md
        row(
            "#381",
            name,
            r.status_code == 200 and listed and quoted,
            f"{r.status_code}; equipment lists '1× {AWS}': {listed}; "
            f"stipulation 6 quoted verbatim: {quoted}",
        )
    for name, body in (
        ("CDOT flagger (jurisdiction_key cdot)", with_j(FLAGGER, "cdot")),
        ("CDOT shoulder (jurisdiction_key cdot)", with_j(SHOULDER, "cdot")),
        ("flagger, no jurisdiction (CDOT default)", with_j(FLAGGER, None)),
    ):
        r = api.post(f"{BACKEND}/render/markdown", json=body)
        md = r.text
        absent = "jurisdiction-required" not in md and "Not placed on the drawing" not in md
        row(
            "#381",
            name,
            r.status_code == 200 and absent,
            f"{r.status_code}; no jurisdiction-required row: {absent}",
        )

    # --- #369 aerial content-type ---------------------------------------
    scen = json.loads(
        (REPO / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8")
    )
    pic = {"scenario": scen, "stage": "laid_out", "width": 600, "height": 300}
    for name, url in (("broadway-sb laid_out 600x300", f"{BACKEND}/render/corridor-map"),):
        r = api.post(url, json=pic)
        ct = r.headers.get("content-type", "")
        magic = r.content[:3].hex(" ").upper()
        row(
            "#369",
            name,
            r.status_code == 200
            and ct.startswith("image/jpeg")
            and r.content[:3] == b"\xff\xd8\xff",
            f"{r.status_code}; content-type {ct}; first bytes {magic}; {len(r.content)} bytes",
        )

    # --- #367 buffer source ---------------------------------------------
    for speed, ft in ((65, 645.0), (75, 820.0)):
        r = api.post(f"{BACKEND}/render/audit", json=lane(speed))
        if r.status_code == 200:
            buf = find_buffer(r.json()) or {}
            ok = buf.get("buffer_ft") == ft and buf.get("source") == TABLE_6B_2
            row(
                "#367",
                f"CDOT lane closure {speed} mph, no WZ speed",
                ok,
                f"200; buffer_ft {buf.get('buffer_ft')}; source {buf.get('source')!r}",
            )
        else:
            row(
                "#367",
                f"CDOT lane closure {speed} mph, no WZ speed",
                None,
                f"{r.status_code} (lane_closure_divided is gated on the API, Rule 8): "
                f"{r.text[:200]}",
            )
    for speed, ft in ((65, 645.0), (75, 820.0)):
        r = api.post(f"{BACKEND}/render/audit", json=freeway_shoulder(speed))
        buf = find_buffer(r.json()) if r.status_code == 200 else {}
        buf = buf or {}
        ok = (
            r.status_code == 200
            and buf.get("buffer_ft") == ft
            and str(buf.get("source", "")).endswith(CASE_11)
            and str(buf.get("lookup_text", "")).endswith(
                "(Sheet 7 Case 11: buffer VARIES per General Note 24)."
            )
        )
        row(
            "#367",
            f"CDOT freeway shoulder {speed} mph, no WZ speed (control)",
            ok,
            f"{r.status_code}; buffer_ft {buf.get('buffer_ft')}; source {buf.get('source')!r}",
        )

    (HERE / "results.json").write_text(
        json.dumps(
            {"healthz_sha": sha, "origin_main": head, "rows": rows}, indent=1, ensure_ascii=False
        )
        + "\n",
        encoding="utf-8",
    )
    fails = [r for r in rows if r["pass"] is False]
    print(
        f"healthz {sha[:7]}; {sum(r['pass'] is True for r in rows)} PASS, "
        f"{len(fails)} FAIL, {sum(r['pass'] is None for r in rows)} N/A"
    )
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
