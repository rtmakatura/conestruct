"""#381 churn: crew sheet (/render/markdown) and replication snapshot.

Usage: python churn.py <code root> [predict]
Renders every kind x jurisdiction x street class x day/night through the
real endpoints of the tree at <code root> and prints sha256 prefixes.
With "predict", prints instead which bodies have a fired count delta that
the old crew sheet dropped (a delta-only row with no mode note, or a
topped-up placed row), read from that tree's shared row walk.
"""

import copy
import hashlib
import json
import os
import re
import sys

root = sys.argv[1]
sys.path.insert(0, root)
sys.path.insert(1, os.getcwd())
os.environ["RENDER_API_SECRET"] = "s"
from fastapi.testclient import TestClient  # noqa: E402

import src.api.render_api as r  # noqa: E402
from tests.test_plan_sheet_device_summary import FLAGGER_BODY, SHOULDER_BODY  # noqa: E402
from tests.test_r117_jurisdiction_raised import _broadway_denver  # noqa: E402

assert os.path.normcase(r.__file__).startswith(os.path.normcase(os.path.normpath(root)))
KEYS = [None] + sorted(
    f[:-5] for f in os.listdir(os.path.join(root, "data", "jurisdictions"))
)
bodies = {}
for k in KEYS:
    for cls in (None, "local", "collector", "arterial"):
        if k is None and cls is not None:
            continue
        for night in (False, True):
            for kind, base in (("flagger", FLAGGER_BODY), ("shoulder", SHOULDER_BODY),
                               ("ni", _broadway_denver())):
                b = copy.deepcopy(base)
                if k:
                    b["jurisdiction_key"] = k
                else:
                    b.pop("jurisdiction_key", None)
                if cls:
                    b["street_class"] = cls
                else:
                    b.pop("street_class", None)
                b["night"] = night
                bodies[f"{kind}-{k}-{cls}-{'night' if night else 'day'}"] = b

for k in (None, "thornton"):
    b = copy.deepcopy(FLAGGER_BODY)
    b["pilotCar"] = True
    if k:
        b["jurisdiction_key"] = k
    bodies[f"flagger-pilotcar-{k}"] = b

c = TestClient(r.app)
H = {"Authorization": "Bearer s"}

if len(sys.argv) > 2 and sys.argv[2] == "predict":
    from pydantic import TypeAdapter

    from src.rules.jurisdiction import aggregate_device_rows_with_deltas

    out = {}
    for name, b in bodies.items():
        resp = c.post("/render/markdown", json=b, headers=H)
        if resp.status_code != 200:
            out[name] = f"refused {resp.status_code}"
            continue
        sc = TypeAdapter(r.Scenario).validate_python(b)
        placements, params, *_ = r._placements_for(sc)
        deltas = r._jurisdiction_eval(sc, params)[1]
        rows = aggregate_device_rows_with_deltas(placements, deltas, params)
        dropped = [
            row.display_override or str(row.device_type)
            for row in rows
            if (row.display_override is not None and row.mode_note is None)
            or (row.display_override is None and row.jurisdiction_added > 0)
        ]
        fired = any(row.jurisdiction_required for row in rows)
        out[name] = {"crew_changes": dropped, "any_fired_count_add": fired}
    print(json.dumps(out, indent=1, sort_keys=True))
    sys.exit(0)

out = {}
for name, b in bodies.items():
    md = c.post("/render/markdown", json=b, headers=H)
    snap = c.post("/render/replication-snapshot", json={"scenario": b}, headers=H)
    s = re.sub(r"GIT_SHA=\S+", "GIT_SHA=X", snap.text)
    s = re.sub(r"\d{4}-\d{2}-\d{2}", "DATE", s)
    m = re.sub(r"\d{4}-\d{2}-\d{2}", "DATE", md.text)
    out[name] = {
        "md": f"{md.status_code}:" + hashlib.sha256(m.encode()).hexdigest()[:12],
        "snapshot": f"{snap.status_code}:" + hashlib.sha256(s.encode()).hexdigest()[:12],
    }
print(json.dumps(out, indent=1, sort_keys=True))
