"""#367 byte-identity snapshot: dump audit JSON, crew markdown and PDF text
for live plans through the real API (TestClient), and the audit JSON for
lane_closure_divided plans (gated on the API) through the real producers.

    uv run --extra dev python <this file> <out_dir>

Run from the worktree root on the base (before the fix) and on the fix,
then diff the folders.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))

from tests.s630._harness import _common  # noqa: E402
from tests.s630.test_cross_surface import _pdf_text, _post, api  # noqa: E402
from tests.s630.test_lane_buffer_cite_367 import _lane_audit  # noqa: E402
from tests.s630.test_ta10_flagger import FLAGGER_BASIC_BODY  # noqa: E402

FLAGGER_55 = {**FLAGGER_BASIC_BODY, "roadType": "rural_undivided", "speed": 55}

# Live plans: predicted byte-identical on all three surfaces.
PLANS: dict[str, dict[str, Any]] = {
    "case26-freeway-65-60": _common(65, 60),
    "case27-freeway-75-65": _common(75, 65),
    "case11-freeway-65": _common(65, None),
    "case11-freeway-75": _common(75, None),
    "shoulder-freeway-65-55": _common(65, 55),
    "shoulder-freeway-75-70": _common(75, 70),
    "shoulder-rural-divided-65": {**_common(65, None), "roadType": "rural_divided"},
    "shoulder-rural-divided-65-60": {**_common(65, 60), "roadType": "rural_divided"},
    "flagger-45": FLAGGER_BASIC_BODY,
    "flagger-55": FLAGGER_55,
}

# Gated lane plans (producer level): the four without the Case 26/27
# step-down are predicted to move (buffer lookup_text and source only);
# the two step-downs (#361's branch) are predicted byte-identical.
LANE: dict[str, tuple[int, int | None]] = {
    "lane-65": (65, None),
    "lane-75": (75, None),
    "lane-65-55": (65, 55),
    "lane-75-70": (75, 70),
    "lane-65-60": (65, 60),
    "lane-75-65": (75, 65),
}


def _dump(path: Path, obj: Any) -> None:
    path.write_text(json.dumps(obj, indent=1, sort_keys=True), encoding="utf-8")


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    # The tests' offline API (fake Mapbox tile, gate secret), unwrapped.
    client = api.__wrapped__(pytest.MonkeyPatch())  # type: ignore[attr-defined]
    for name, body in PLANS.items():
        _dump(out / f"{name}.audit.json", _post(client, "/render/audit", body).json())
        md = _post(client, "/render/markdown", body)
        (out / f"{name}.crew.md").write_text(md.text, encoding="utf-8")
        pdf = _post(client, "/render/pdf", body)
        text = "\n\f\n".join(_pdf_text(pdf.content))
        (out / f"{name}.pdf.txt").write_text(text, encoding="utf-8")
    for name, (speed, wz) in LANE.items():
        _dump(out / f"{name}.audit.json", _lane_audit(speed, wz))


if __name__ == "__main__":
    main(Path(sys.argv[1]))
