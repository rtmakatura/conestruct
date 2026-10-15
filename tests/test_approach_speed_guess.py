"""#316 (R129 Q5, Q6; R132) — a near-intersection plan's cross-street speed,
guessed from the cross street's road class.

R126's rule, per cross street: on a cross street with no readable posted
speed, the class estimate is the approach speed, recorded as a guess
(``guesses.approach_speed``, one record for the street).  The backend
recomputes it (capped to the approach's 25–55 range) and refuses a stale
one; the audit, the audit PDF and the crew sheet say "guessed"; the plan
sheet's NOTES prints ONE line whichever speeds are guessed (R132), and the
sign schedule keeps all its rows.  No record: every output byte-identical.
"""

from __future__ import annotations

import copy
import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.schemas import Scenario, scenario_to_call
from src.rendering.audit_blocks import audit_to_blocks
from src.rules import site_detection as sd
from src.rules.corridor import _destination_point

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
PIN = (39.7400, -104.9600)
CLAUSE = "(guessed from the road class, not confirmed)"


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *a, **k: ({"elements": []}, None)
    )


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def body(
    *, approach_speed: int = 25, road: str | None = None, cross: str | None = None
) -> dict[str, Any]:
    """A work-start near-intersection plan, two legs; ``road`` / ``cross``
    name the class each speed was guessed from (None: not guessed)."""
    crossing = _destination_point(*PIN, 0.0, 700.0 * 0.3048)
    leg = {
        "speed": approach_speed,
        "roadType": "urban_arterial",
        "lanesPerDirection": 1,
        "laneWidth": 12,
        "signalized": False,
    }
    b: dict[str, Any] = {
        "kind": "near_intersection",
        "meta": {
            "project": "s316",
            "address": "",
            "lat": PIN[0],
            "lng": PIN[1],
            "pinModel": "work_start",
            "work": {"side": "right", "heading": "N"},
            "intersection": {"lat": crossing[0], "lng": crossing[1], "name": "E 17th Ave"},
        },
        "roadType": "urban_arterial",
        "speed": 25,
        "lanes": 2,
        "laneWidth": 12,
        "divided": False,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500,
        "night": False,
        "approaches": [{"id": "cross_a", **leg}, {"id": "cross_b", **leg}],
    }
    guesses: dict[str, Any] = {}
    if road:
        guesses["speed"] = {"highwayClass": road}
    if cross:
        guesses["approach_speed"] = {"highwayClass": cross}
    if guesses:
        b["guesses"] = guesses
    return b


def audit(client: TestClient, b: dict[str, Any]) -> dict[str, Any]:
    res = client.post("/render/audit", headers=AUTH, json=b)
    assert res.status_code == 200, res.text[:300]
    return res.json()


def stale(res: Any) -> str:
    assert res.status_code == 400, res.text[:300]
    detail = res.json()["detail"]
    assert detail["error"] == "guess_stale"
    return detail["message"]


def approach_rows(projection: dict[str, Any]) -> list[dict[str, Any]]:
    return projection["sections"]["approaches"]["approaches"]


# --- the record ---------------------------------------------------------------


def test_the_audit_records_the_cross_street_guess(client: TestClient) -> None:
    (record,) = audit(client, body(cross="residential"))["input_guesses"]
    assert record == {
        "field": "approach_speed",
        "value": 25,
        "label": "25 mph",
        "source": "road_class",
        "evidence": "OSM highway=residential on the cross street; no readable posted speed",
        "operator_confirmed": False,
    }


def test_a_capped_estimate_says_so(client: TestClient) -> None:
    (record,) = audit(client, body(approach_speed=55, cross="motorway"))["input_guesses"]
    assert record["value"] == 55
    assert record["evidence"].endswith("; estimated 65 mph, capped at 55 mph")


def test_both_guesses_are_recorded_road_first(client: TestClient) -> None:
    fields = [
        g["field"]
        for g in audit(client, body(road="residential", cross="residential"))["input_guesses"]
    ]
    assert fields == ["speed", "approach_speed"]


def test_an_approach_speed_that_no_longer_matches_is_refused(client: TestClient) -> None:
    message = stale(
        client.post(
            "/render/audit", headers=AUTH, json=body(approach_speed=30, cross="residential")
        )
    )
    assert message.startswith(
        "Cross-street speed is marked as guessed, but the cross street's class "
        "(highway=residential) estimates 25 mph"
    )
    assert message.endswith("Set cross-street speed in Step 2, then generate again.")


def test_one_leg_off_the_guess_is_refused(client: TestClient) -> None:
    b = body(cross="residential")
    b["approaches"][1]["speed"] = 35
    stale(client.post("/render/audit", headers=AUTH, json=b))


def test_a_class_with_no_estimate_is_refused(client: TestClient) -> None:
    stale(client.post("/render/audit", headers=AUTH, json=body(cross="footway")))


def test_a_kind_with_no_cross_street_is_refused(client: TestClient) -> None:
    b = {
        "kind": "shoulder",
        "meta": {"project": "s316", "address": "", "lat": PIN[0], "lng": PIN[1]},
        "roadType": "urban_arterial",
        "speed": 25,
        "lanes": 1,
        "laneWidth": 12,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 500,
        "night": False,
        "guesses": {"approach_speed": {"highwayClass": "residential"}},
    }
    assert "has no cross street" in stale(client.post("/render/audit", headers=AUTH, json=b))


@pytest.mark.parametrize("path", ["/render/pdf", "/render/xlsx", "/render/markdown"])
def test_every_render_path_refuses_a_stale_guess(client: TestClient, path: str) -> None:
    stale(client.post(path, headers=AUTH, json=body(approach_speed=30, cross="residential")))


# --- the deliverables say so ---------------------------------------------------


def test_no_record_leaves_the_approach_rows_as_they_were(client: TestClient) -> None:
    projection = audit(client, body())
    assert "input_guesses" not in projection
    for row in approach_rows(projection):
        assert "speed_guessed" not in row
        assert CLAUSE not in row["key_text"]
    params, _gen, kwargs = scenario_to_call(_parse(body()))
    assert params.approach_speed_guessed is False
    assert all(not a.speed_guessed for a in kwargs["approaches"])


def test_the_audit_rows_and_pdf_say_guessed(client: TestClient) -> None:
    projection = audit(client, body(cross="residential"))
    for row in approach_rows(projection):
        assert row["speed_guessed"] is True
        assert f"at 25 mph {CLAUSE} (" in row["key_text"]
    text = repr(audit_to_blocks(projection))
    assert (
        "Cross-street speed: 25 mph. Guessed from the road class (OSM highway=residential "
        "on the cross street; no readable posted speed). The operator did not confirm it. "
        "Confirm the posted speed on site."
    ) in text
    assert f"Approach 'cross_a': 25 mph {CLAUSE}, " in text


def test_the_crew_sheet_says_guessed(client: TestClient) -> None:
    res = client.post("/render/markdown", headers=AUTH, json=body(cross="residential"))
    assert res.status_code == 200, res.text[:300]
    assert res.text.count(f"approach** (25 mph {CLAUSE}, ") >= 2
    plain = client.post("/render/markdown", headers=AUTH, json=body())
    assert CLAUSE not in plain.text


# --- the plan sheet's NOTES (R132) ---------------------------------------------

ROAD_LINE = "SPEED GUESSED FROM THE ROAD CLASS. CONFIRM THE POSTED SPEED ON SITE."
CROSS_LINE = "CROSS-STREET SPEED GUESSED FROM THE ROAD CLASS. CONFIRM THE POSTED SPEED ON SITE."
BOTH_LINE = "ROAD AND CROSS-STREET SPEEDS GUESSED FROM THE ROAD CLASS. CONFIRM THEM ON SITE."
SCHEDULE = ("G20-1", "G20-5P", "G20-2", "R2-11")


def page1(client: TestClient, b: dict[str, Any]) -> str:
    import pypdfium2 as pdfium

    res = client.post("/render/pdf", headers=AUTH, json=b)
    assert res.status_code == 200, res.text[:300]
    return " ".join(pdfium.PdfDocument(res.content)[0].get_textpage().get_text_range().split())


@pytest.mark.parametrize(
    ("road", "cross", "line"),
    [
        (None, None, None),
        ("residential", None, ROAD_LINE),
        (None, "residential", CROSS_LINE),
        ("residential", "residential", BOTH_LINE),
    ],
    ids=["neither", "road", "cross-street", "both"],
)
def test_the_notes_print_one_line_and_keep_every_schedule_row(
    client: TestClient, road: str | None, cross: str | None, line: str | None
) -> None:
    flat = page1(client, body(road=road, cross=cross))
    for other in (ROAD_LINE, CROSS_LINE, BOTH_LINE):
        if other == line:
            assert flat.count(other) == 1
        elif line is None or other not in line:
            assert other not in flat
    # R132: "All 4 sign-schedule rows stay on the sheet in every case."
    # The schedule ends where the advance section starts: the all-cut
    # line, or (when a row fits, #235) the table's title.
    start = flat.index("SIGN SCHEDULE")
    end = min(
        i
        for i in (flat.find("ADVANCE SIGNS OFF-PAGE"), flat.find("ADVANCE WARNING SIGNS"))
        if i > 0
    )
    schedule = flat[start:end]
    for code in SCHEDULE:
        assert code in schedule, code
    assert "MORE SIGNS" not in flat
    # R117 Q3a's all-cut line: with a guessed-speed note printing, every
    # advance row is cut and one line names them; with no note (#235's
    # freed room) the first row fits and the table prints instead.
    if line is not None:
        assert "ADVANCE SIGNS OFF-PAGE (" in flat
    else:
        assert "ADVANCE SIGNS OFF-PAGE (" not in flat
        assert "ADVANCE WARNING SIGNS" in flat


def _parse(b: dict[str, Any]) -> Any:
    from pydantic import TypeAdapter

    return TypeAdapter(Scenario).validate_python(copy.deepcopy(b))
