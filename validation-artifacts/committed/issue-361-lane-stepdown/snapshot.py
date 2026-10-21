"""#361 byte-identity snapshot: dump audit JSON, crew markdown and PDF text
for a fixed plan set through the real API (TestClient).

    uv run --extra dev python snapshot.py <out_dir>

(run from the repo root, with this file's path).  Run once on the base (a
``git archive`` with its own env) and once on the fix, then diff the folders.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from tests.s630._harness import _common  # noqa: E402
from tests.s630.test_cross_surface import _pdf_text, _post, api  # noqa: E402
from tests.s630.test_ta10_flagger import FLAGGER_BASIC_BODY  # noqa: E402

# A live lane-closure kind (lane_closure_divided is gated on the API;
# flagger and near_intersection cap at 55 mph and carry no work-zone speed).
FLAGGER = {**FLAGGER_BASIC_BODY, "roadType": "rural_undivided"}


def _wz(body: dict[str, Any], speed: int, wz: int | None) -> dict[str, Any]:
    out = {**body, "speed": speed}
    if wz is not None:
        out["workZoneSpeed"] = wz
    return out


PLANS: dict[str, dict[str, Any]] = {
    # Predicted to stay byte-identical.
    "case26-freeway-65-60": _common(65, 60),
    "case27-freeway-75-65": _common(75, 65),
    "case11-freeway-65": _common(65, None),
    "case11-freeway-55-50": _common(55, 50),
    "shoulder-rural-divided-65-60": {**_common(65, 60), "roadType": "rural_divided"},
    "flagger-45": FLAGGER_BASIC_BODY,
    "flagger-55": _wz(FLAGGER, 55, None),
    "shoulder-rural-divided-65-55": {**_common(65, 55), "roadType": "rural_divided"},
    # Predicted to move (crew sheet only).  No live lane kind carries a
    # work-zone speed, so the lane half is proven at the producer level
    # (tests/s630/test_lane_stepdown_361.py).
    "shoulder-freeway-65-55": _common(65, 55),
    "shoulder-freeway-75-70": _common(75, 70),
}


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    # The tests' offline API (fake Mapbox tile, gate secret), unwrapped.
    client = api.__wrapped__(pytest.MonkeyPatch())  # type: ignore[attr-defined]
    for name, body in PLANS.items():
        audit = _post(client, "/render/audit", body)
        (out / f"{name}.audit.json").write_text(
            json.dumps(audit.json(), indent=1, sort_keys=True), encoding="utf-8"
        )
        md = _post(client, "/render/markdown", body)
        (out / f"{name}.crew.md").write_text(md.text, encoding="utf-8")
        pdf = _post(client, "/render/pdf", body)
        text = "\n\f\n".join(_pdf_text(pdf.content))
        (out / f"{name}.pdf.txt").write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
