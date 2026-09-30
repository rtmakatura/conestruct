"""How often does the in-generate site scan refuse on prod, and why?

Read-only against prod, through the coming-soon gate (scripts/gate.py).  For
10 fixed Denver pins, ROUNDS times, it POSTs the site's own request shape to
/api/render/audit and then /api/render/device-breakdown, and records per call:
HTTP status, wall time, the scan's status / reason / error text / mirror /
duration / memo hit / remark / bytes, and (for a refusal) the full detail.

The body: the site's Broadway request (issue-243-note-8/recheck-2f27be3/prod/
broadway-audit-request.json) with the pin moved and the road confirmed from
prod's own /api/road-bearing first candidate, exactly as the picker records it;
divided = the candidate's oneway tag; everything else the template's (shoulder,
30 mph urban arterial).  The scan memo (per container, TTL 120 s) is honoured
by waiting GAP_S between rounds; any memo hit is recorded and reported apart.

  python measure_refusals.py [rounds] > out/<stamp>.jsonl   (one JSON object per call)
"""

from __future__ import annotations

import copy
import json
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import httpx

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
from gate import gate_headers  # noqa: E402

SITE = "https://www.conestruct.com"
HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz"
TEMPLATE = ROOT / "validation-artifacts/committed/issue-243-note-8/recheck-2f27be3/prod/broadway-audit-request.json"
GAP_S = 130  # > the scan memo's 120 s TTL
PINS = {
    "broadway-sb": (39.73370, -104.98753),
    "broadway-demo": (39.7269, -104.9873),
    "n-federal": (39.7342642691076, -105.02504468168067),
    "e-colfax": (39.73997, -104.96632),
    "e-bayaud": (39.71466, -104.94071),
    "colorado-blvd": (39.7253, -104.9407),
    "s-university": (39.6960, -104.9590),
    "w-alameda": (39.7110, -105.0000),
    "downing": (39.7200, -104.9730),
    "santa-fe": (39.7200, -104.9985),
}


def body_for(template: dict, lat: float, lng: float, cand: dict) -> dict:
    b = copy.deepcopy(template)
    m = b["meta"]
    m["lat"], m["lng"] = lat, lng
    m.pop("centerline", None)
    m["confirmedRoad"] = {**m["confirmedRoad"], "candidate": cand, "pinLat": lat, "pinLng": lng}
    b["divided"] = (cand.get("tags") or {}).get("oneway") == "yes"
    b.pop("detectedLanesTotal", None)
    if cand.get("signal_distance_m") is not None:
        b["signalDistanceM"] = cand["signal_distance_m"]
    else:
        b.pop("signalDistanceM", None)
    return b


def scan_of(resp: httpx.Response) -> tuple[dict, dict | None]:
    try:
        j = resp.json()
    except Exception:  # noqa: BLE001
        return {}, {"text": resp.text[:300]}
    if resp.status_code == 200 and isinstance(j, dict) and "sections" in j:
        return j["sections"].get("site_scan") or {}, None
    detail = j.get("detail") if isinstance(j, dict) else None
    if isinstance(detail, dict):
        return detail.get("site_scan") or {}, {k: detail.get(k) for k in ("error", "message")}
    return {}, {"text": resp.text[:300]}


def main() -> None:
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    h = gate_headers(SITE)
    template = json.loads(TEMPLATE.read_text("utf-8"))["scenario"]
    print(json.dumps({"healthz": httpx.get(HEALTHZ, timeout=30).json()}), flush=True)
    # The roads are resolved once and kept (out/pins-resolved.json), so every
    # round -- and any re-run -- sends the same bodies.  /api/road-bearing asks
    # Overpass too, so it is retried; a pin that never resolves is recorded.
    resolved_path = HERE / "out" / "pins-resolved.json"
    resolved = json.loads(resolved_path.read_text("utf-8")) if resolved_path.exists() else {}
    for name, (lat, lng) in PINS.items():
        for attempt in range(1, 5):
            if name in resolved:
                break
            try:
                c = httpx.post(
                    f"{SITE}/api/road-bearing", json={"lat": lat, "lng": lng}, headers=h, timeout=60
                )
                cand = (c.json().get("candidates") or [None])[0]
            except Exception as exc:  # noqa: BLE001
                print(json.dumps({"pin": name, "resolve_attempt": attempt, "failed": repr(exc)[:200]}), flush=True)
                time.sleep(10 * attempt)
                continue
            if cand is None:
                print(json.dumps({"pin": name, "skipped": "no road candidate"}), flush=True)
                break
            resolved[name] = cand
        resolved_path.write_text(json.dumps(resolved, ensure_ascii=False), "utf-8")
    bodies = {n: body_for(template, *PINS[n], resolved[n]) for n in PINS if n in resolved}
    print(json.dumps({"pins": list(bodies)}), flush=True)
    for rnd in range(1, rounds + 1):
        if rnd > 1:
            time.sleep(GAP_S)
        for name, body in bodies.items():
            for ep in ("audit", "device-breakdown"):
                t0 = time.time()
                at = datetime.now(UTC).isoformat(timespec="seconds")
                try:
                    r = httpx.post(f"{SITE}/api/render/{ep}", json={"scenario": body}, headers=h, timeout=200)
                    status, secs = r.status_code, round(time.time() - t0, 1)
                    scan, refusal = scan_of(r)
                except Exception as exc:  # noqa: BLE001
                    status, secs, scan, refusal = None, round(time.time() - t0, 1), {}, {"exception": repr(exc)}
                print(json.dumps({
                    "round": rnd, "pin": name, "endpoint": ep, "at": at, "http": status, "seconds": secs,
                    "scan_status": scan.get("status"), "reason": scan.get("reason"), "error": scan.get("error"),
                    "mirror": scan.get("mirror"), "duration_ms": scan.get("duration_ms"),
                    "memo_hit": scan.get("memo_hit"), "remark": scan.get("overpass_remark"),
                    "bytes": scan.get("response_bytes"), "refusal": refusal,
                }, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
