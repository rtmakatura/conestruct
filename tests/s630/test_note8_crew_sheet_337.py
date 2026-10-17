"""#337 — the crew sheet and the audit agree on CDOT S-630-1 Sheet 2 Note 8.

Note 8: signs "shall be posted on both sides of the roadway on divided
highways … except where only one shoulder is closed (ex: Case 11 on
Sheet 7)".  A divided shoulder plan mirrors its signs anyway, as a house
choice (#243 R54, ``layout.py`` ``generate_shoulder_closure_divided``); its
audit row reads "Not required".  The crew sheet must not call the mirror a
requirement.  A divided lane closure is what Note 8 governs, and its line
is unchanged.

Rule 11: the shoulder plan is read off the delivered crew sheet
(``/render/markdown``, ``/render/crew-pdf``) and the audit
(``/render/audit``) through the real API.  The divided lane closure is
gated over HTTP, so its crew sheet is rendered from its generator.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.generation.layout import generate_lane_closure_divided
from src.narrative.crew_narrative import render_crew_narrative_markdown
from src.rules.validators import ScenarioParams

from ._harness import CASE_11_GENERAL_BODY
from .test_cross_surface import _pdf_text, _post, api  # noqa: F401  (``api`` is a fixture)

_REQUIRED = "must be posted on BOTH sides of the roadway per CDOT S-630-1 Sheet 2 General Note 8"
_CHOICE = (
    "this plan posts signs on both sides of the roadway by choice. CDOT S-630-1 "
    "Sheet 2 General Note 8 doesn't require it when only one shoulder is closed"
)


def _note8_row(audit: dict[str, Any]) -> dict[str, Any]:
    rows = [c for c in audit["sections"]["colorado"]["checks"] if "Note 8" in c["citation"]]
    assert len(rows) == 1
    return rows[0]


@pytest.mark.parametrize("night", [False, True], ids=["day", "night"])
def test_divided_shoulder_crew_sheet_agrees_with_audit(
    night: bool,
    api: TestClient,  # noqa: F811
) -> None:
    scenario = {**CASE_11_GENERAL_BODY, "night": night}
    crew = _post(api, "/render/markdown", scenario).text
    crew_pdf = " ".join(
        " ".join(_pdf_text(_post(api, "/render/crew-pdf", scenario).content)).split()
    )
    audit = _post(api, "/render/audit", scenario).json()

    assert _note8_row(audit)["detail"].startswith("Not required: one shoulder closed")
    assert _REQUIRED not in crew
    assert _CHOICE in crew
    assert "must be posted on BOTH sides" not in crew_pdf
    assert "posts signs on both sides of the roadway by choice" in crew_pdf


def test_divided_lane_closure_keeps_note8_requirement() -> None:
    params = ScenarioParams(
        speed_mph=55,
        num_lanes=2,
        closure_type="lane",
        road_type="freeway",
        work_zone_length_ft=1000.0,
        lane_width_ft=12.0,
        is_divided=True,
        jurisdiction="CDOT",
    )
    crew = render_crew_narrative_markdown(generate_lane_closure_divided(params), params)
    assert f"- Divided highway: All warning and regulatory signs {_REQUIRED}." in crew
    assert "by choice" not in crew
