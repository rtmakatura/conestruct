"""#365 evidence: crop page 2's CORRIDOR DETAILS box on the corner plan.

Usage: python plan_sheet_crop.py <repo_root> <out.png>

Serves /render/pdf for the pinned near-side corner plan (the same body as
byte_identity.py's ``ni_near_corner``), Mapbox and Overpass stubbed, renders
page 2 at 4x and crops from the "CORRIDOR DETAILS" title to the row below
"Work zone".
"""

from __future__ import annotations

import io
import os
import sys
from pathlib import Path
from typing import Any

root = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(root))
os.environ["RENDER_API_SECRET"] = "test-secret"
os.environ["MAPBOX_TOKEN"] = "test-token"

import pypdfium2 as pdfium  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

import src  # noqa: E402
import src.api.render_api as render_api  # noqa: E402
from src.rendering import plan_sheet as ps  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from tests.test_lane_confidence_block import _ni_body  # noqa: E402

assert Path(src.__file__).resolve().is_relative_to(root), src.__file__


class _Png:
    def __init__(self) -> None:
        buf = io.BytesIO()
        Image.new("RGB", (4, 4), (128, 128, 128)).save(buf, format="PNG")
        self.content = buf.getvalue()

    def raise_for_status(self) -> None:
        return None


ps.httpx.get = lambda *_a, **_k: _Png()  # type: ignore[assignment]
ps._validate_corridor_bearing = lambda corridor: None  # type: ignore[assignment]
sd._overpass_request_with_fallback = lambda q, **_k: (None, "stub")  # type: ignore[assignment]
render_api.ENABLED_SCENARIOS = frozenset({"shoulder", "flagger_lane_closure", "near_intersection"})

body: dict[str, Any] = _ni_body(alongStationFt=-60.0)
body["meta"] = {**body["meta"], "lat": 39.73997, "lng": -104.96632, "bearingDeg": 90.0}
resp = TestClient(render_api.app).post(
    "/render/pdf", json=body, headers={"Authorization": "Bearer test-secret"}
)
page = pdfium.PdfDocument(resp.content)[1]
text = page.get_textpage()
full = text.get_text_range()


def _box(needle: str) -> tuple[float, float, float, float]:
    i = full.index(needle)
    boxes = [text.get_charbox(k) for k in range(i, i + len(needle))]
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


scale = 4.0
title = _box("CORRIDOR DETAILS")
work = _box("Work zone:")
_, height = page.get_size()
img = page.render(scale=scale).to_pil()
left = (title[0] - 12) * scale
right = (title[0] + 300) * scale
top = (height - title[3] - 8) * scale
bottom = (height - work[1] + 22) * scale
img.crop((int(left), int(top), int(right), int(bottom))).save(sys.argv[2])
