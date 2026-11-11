import os, sys, time, datetime

sys.path.insert(0, os.getcwd())
from src.rules import site_detection as sd

q = sd._build_road_at_query(39.7399691, -104.968354, sd.CROSS_STREET_RADIUS_M)
committed = open(
    "validation-artifacts/committed/missions/ux-token-map-load-edit/issue-484/overpass-fixture/365beea785c9dba7.query.txt",
    encoding="utf-8",
).read()
print("query == committed:", q.strip() == committed.strip())
t = time.perf_counter()
payload, err = sd._overpass_request_with_fallback(q, budget_s=sd.SUBJECT_BUDGET_S)
ms = (time.perf_counter() - t) * 1000
found = (
    None
    if payload is None
    else sd.cross_street_from_elements(
        payload.get("elements", []), (39.7399691, -104.968354), 90.0, "East Colfax Avenue"
    )
)
print(
    datetime.datetime.now().isoformat(timespec="seconds"),
    f"{ms:.0f} ms",
    "err",
    err,
    "elements",
    None if payload is None else len(payload.get("elements", [])),
    "pick",
    None if found is None else (found.name, len(found.lines)),
)
