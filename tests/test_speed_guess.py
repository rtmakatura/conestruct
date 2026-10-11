"""R126 / R127 -- the road-class speed estimate, prefilled as a guess.

Authority: validation-artifacts/committed/r126-step2/rulings.md.

R126: "Speed: on a road with no posted speed, prefill the road-class estimate
like R108's guesses, marked "⚠ from the road" (one line). The audit and PDF
record it as guessed from the road class, not confirmed by the operator."
R127 Q3: an estimate the kind's range caps is prefilled at the cap, the
evidence saying so.  Q7: the XLSX and crew sheet say so beside the speed, and
the plan sheet's notes box gets one line.

The relay-fact pattern of R110 Q1 (tests/test_r108_guesses.py): the wire
carries the road's OSM ``highway`` tag (``guesses.speed``), the backend maps
it (``src/rules/speed_estimate.py``, mirrored by classify.ts and held equal
here) and caps it, a stale record is an honest 400, and no record is
byte-identical.  R123 Q2's ``speed_estimate`` / ``input_estimates`` are
retired.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api.render_api import app
from src.api.schemas import Scenario, scenario_to_call
from src.export.device_list import export_device_list
from src.rendering.audit_blocks import audit_to_blocks
from src.rules.speed_estimate import SPEED_BY_HIGHWAY, speed_estimate_from_highway
from src.rules.validators import speed_display

_TS = (
    Path(__file__).resolve().parent.parent
    / "conestruct"
    / "site"
    / "lib"
    / "road-detection"
    / "classify.ts"
)


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def _auth() -> dict[str, str]:
    return {"Authorization": "Bearer test-secret-do-not-deploy"}


def _body(**over: Any) -> dict[str, Any]:
    """An urban arterial shoulder plan with no pin: nothing leaves the process."""
    body: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "T", "address": ""},
        "roadType": "urban_arterial",
        "speed": 25,
        "lanes": 1,
        "laneWidth": 12.0,
        "divided": False,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
    }
    body.update(over)
    return body


def _guessed() -> dict[str, Any]:
    # residential estimates 25 mph, prefilled as a guess.
    return _body(speed=25, guesses={"speed": {"highwayClass": "residential"}})


def _flagger_motorway() -> dict[str, Any]:
    # motorway estimates 65; a flagger plan's range caps it at 55 (R127 Q3).
    return {
        "kind": "flagger_lane_closure",
        "meta": {"project": "T", "address": ""},
        "roadType": "rural_undivided",
        "speed": 55,
        "laneWidth": 12.0,
        "workType": "utility_cut",
        "duration": "short",
        "workLen": 500.0,
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
        "guesses": {"speed": {"highwayClass": "motorway"}},
    }


def test_the_frontend_table_mirrors_the_backend_table() -> None:
    m = re.search(
        r"const SPEED_BY_CLASS: Record<string, number> = \{(.*?)\};",
        _TS.read_text(encoding="utf-8"),
        re.S,
    )
    assert m, "SPEED_BY_CLASS not found in classify.ts"
    ts = {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", m.group(1))}
    assert ts == SPEED_BY_HIGHWAY


def test_the_table_answers_by_class() -> None:
    assert speed_estimate_from_highway("residential") == 25
    assert speed_estimate_from_highway("primary") == 45
    assert speed_estimate_from_highway("footway") is None


def test_no_guess_means_no_speed_record_and_a_plain_speed(client: TestClient) -> None:
    res = client.post("/render/audit", json=_body(), headers=_auth())
    assert res.status_code == 200, res.text
    assert "input_guesses" not in res.json()
    params, _g, _k = scenario_to_call(_parse(_body()))
    assert params.speed_guessed is False
    assert speed_display(params) == "25 mph"


def _parse(body: dict[str, Any]) -> Any:
    from pydantic import TypeAdapter

    return TypeAdapter(Scenario).validate_python(body)


def test_the_audit_records_the_guess_as_not_confirmed(client: TestClient) -> None:
    res = client.post("/render/audit", json=_guessed(), headers=_auth())
    assert res.status_code == 200, res.text
    assert res.json()["input_guesses"] == [
        {
            "field": "speed",
            "value": 25,
            "label": "25 mph",
            "source": "road_class",
            "evidence": "OSM highway=residential; no readable posted speed on the road",
            "operator_confirmed": False,
        }
    ]
    # R123's separate record is retired.
    assert "input_estimates" not in res.json()


def test_a_capped_estimate_says_so(client: TestClient) -> None:
    res = client.post("/render/audit", json=_flagger_motorway(), headers=_auth())
    assert res.status_code == 200, res.text
    (record,) = res.json()["input_guesses"]
    assert record["value"] == 55
    assert record["evidence"] == (
        "OSM highway=motorway; no readable posted speed on the road; "
        "estimated 65 mph, capped at 55 mph for this kind of work"
    )


def test_the_audit_pdf_prints_the_guess_line(client: TestClient) -> None:
    projection = client.post("/render/audit", json=_guessed(), headers=_auth()).json()
    text = repr(audit_to_blocks(projection))
    assert "Guessed inputs" in text
    assert (
        "Speed: 25 mph. Guessed from the road class (OSM highway=residential; no readable "
        "posted speed on the road). The operator did not confirm it. "
        "Confirm the posted speed on site."
    ) in text
    assert "Estimated inputs" not in text


def test_a_stale_record_from_r123_is_ignored(client: TestClient) -> None:
    # A plan saved under R123 carries `speed_estimate`; the key is retired.
    res = client.post(
        "/render/audit",
        json=_body(speed=25, speed_estimate={"highwayClass": "residential"}),
        headers=_auth(),
    )
    assert res.status_code == 200, res.text
    assert "input_guesses" not in res.json()


def _stale(res: Any) -> str:
    assert res.status_code == 400, res.text
    detail = res.json()["detail"]
    assert detail["error"] == "guess_stale"
    return detail["message"]


def test_a_speed_that_no_longer_matches_the_guess_is_refused(client: TestClient) -> None:
    body = _guessed()
    body["speed"] = 35
    message = _stale(client.post("/render/audit", json=body, headers=_auth()))
    assert message.startswith(
        "Speed is marked as guessed, but the road class (highway=residential) estimates 25 mph"
    )


def test_a_class_with_no_estimate_is_refused(client: TestClient) -> None:
    body = _guessed()
    body["guesses"] = {"speed": {"highwayClass": "footway"}}
    _stale(client.post("/render/audit", json=body, headers=_auth()))


@pytest.mark.parametrize(
    "path", ["/render/pdf", "/render/device-breakdown", "/render/xlsx", "/render/audit-pdf"]
)
def test_every_render_path_refuses_a_stale_guess(client: TestClient, path: str) -> None:
    body = _guessed()
    body["speed"] = 30
    _stale(client.post(path, json=body, headers=_auth()))


def test_the_xlsx_and_crew_lines_say_guessed(client: TestClient, tmp_path: Path) -> None:
    params, generator, kwargs = scenario_to_call(_parse(_guessed()))
    assert params.speed_guessed is True
    assert speed_display(params) == "25 mph (guessed from the road class, not confirmed)"

    import openpyxl

    out = tmp_path / "plan.xlsx"
    export_device_list(generator(params, **kwargs), params, str(out))
    summary = openpyxl.load_workbook(out)["Summary"]
    cells = {row[0].value: row[1].value for row in summary.iter_rows() if row[0].value}
    assert cells["Speed (mph)"] == "25 (guessed from the road class, not confirmed)"

    res = client.post("/render/markdown", json=_guessed(), headers=_auth())
    assert res.status_code == 200, res.text
    assert "**Speed limit:** 25 mph (guessed from the road class, not confirmed)" in res.text


def test_the_plan_sheet_notes_box_says_guessed(client: TestClient) -> None:
    import fitz

    def page1(body: dict[str, Any]) -> str:
        res = client.post("/render/pdf", json=body, headers=_auth())
        assert res.status_code == 200, res.text[:300]
        return fitz.open(stream=res.content, filetype="pdf")[0].get_text()

    flat = " ".join(page1(_guessed()).split())
    assert "SPEED GUESSED FROM THE ROAD CLASS. CONFIRM THE POSTED SPEED ON SITE." in flat
    assert "SPEED GUESSED" not in " ".join(page1(_body()).split())
