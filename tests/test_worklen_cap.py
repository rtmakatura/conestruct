"""workLen upper bound (WORK_LEN_MAX_FT) across all six scenario schemas.

Before the cap, ``workLen`` had only a ``gt=0`` floor: ``Infinity``
passed validation and died as an OverflowError (HTTP 500) in the
half-mile plaque math (``co_construction_plaques``), and a large finite
value like ``5e7`` silently generated ~492,000 device placements on one
sheet.  Two contracts pinned here:

  * every scenario kind's schema accepts ``workLen`` at the ceiling and
    rejects just above it (``le=WORK_LEN_MAX_FT``);
  * the render API answers raw-body ``Infinity`` / ``NaN`` / huge-finite
    with a clean structured 422 — never a 500.  The Infinity/NaN half
    needs the ``RequestValidationError`` handler in render_api.py:
    starlette renders JSON with ``allow_nan=False``, so FastAPI's
    default handler crashed serializing the rejected non-finite input
    back into the error body (a bare 500 masking the 422).
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

from src.api.schemas import WORK_LEN_MAX_FT, Scenario

_SECRET = "test-secret-do-not-deploy"

_ADAPTER: TypeAdapter[Scenario] = TypeAdapter(Scenario)

_META = {
    "project": "worklen-cap",
    "address": "",
    "lat": 0.0,
    "lng": 0.0,
    "siteConditions": {},
}

# One schema-valid body per scenario kind (workLen filled per-test).
_BODIES: dict[str, dict] = {
    "shoulder": {
        "kind": "shoulder",
        "meta": _META,
        "roadType": "rural_divided",
        "speed": 55,
        "lanes": 2,
        "laneWidth": 12.0,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "night": False,
        "workZoneSpeed": None,
    },
    "flagger_lane_closure": {
        "kind": "flagger_lane_closure",
        "meta": _META,
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 12.0,
        "workType": "utility_cut",
        "duration": "short",
        "night": False,
        "pilotCar": False,
        "afad": False,
        "pedestrianAccess": False,
    },
    "lane_closure_divided": {
        "kind": "lane_closure_divided",
        "meta": _META,
        "roadType": "freeway",
        "speed": 65,
        "laneWidth": 12.0,
        "workType": "pavement_repair",
        "duration": "short",
        "night": False,
        "truckMountedAttenuator": True,
    },
    "work_beyond_shoulder": {
        "kind": "work_beyond_shoulder",
        "meta": _META,
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 12.0,
        "workType": "utility",
        "duration": "short",
        "night": False,
    },
    "mobile_op_2lane": {
        "kind": "mobile_op_2lane",
        "meta": _META,
        "roadType": "rural_undivided",
        "speed": 45,
        "laneWidth": 12.0,
        "workType": "striping",
        "night": False,
        "arrowBoardOnShadow": True,
    },
    "mobile_op_multilane": {
        "kind": "mobile_op_multilane",
        "meta": _META,
        "roadType": "freeway",
        "speed": 65,
        "laneWidth": 12.0,
        "workType": "striping",
        "night": False,
        "secondTMA": False,
    },
}


@pytest.mark.parametrize("kind", sorted(_BODIES))
def test_worklen_at_ceiling_validates(kind: str) -> None:
    scenario = _ADAPTER.validate_python({**_BODIES[kind], "workLen": WORK_LEN_MAX_FT})
    assert scenario.workLen == WORK_LEN_MAX_FT


@pytest.mark.parametrize("kind", sorted(_BODIES))
@pytest.mark.parametrize(
    "bad_value",
    [WORK_LEN_MAX_FT + 0.1, 5e7, float("inf")],
    ids=["just-above", "huge-finite", "infinity"],
)
def test_worklen_above_ceiling_rejects(kind: str, bad_value: float) -> None:
    with pytest.raises(ValidationError) as exc_info:
        _ADAPTER.validate_python({**_BODIES[kind], "workLen": bad_value})
    assert any(e["type"] == "less_than_equal" for e in exc_info.value.errors())


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("RENDER_API_SECRET", _SECRET)
    from src.api.render_api import app

    # raise_server_exceptions=False so a regression to the bare-500 path
    # shows up as an assertion failure, not a passing raised exception.
    return TestClient(app, raise_server_exceptions=False)


def _post_pdf_raw(client: TestClient, work_len_literal: str):
    """POST /render/pdf with ``workLen`` spliced in as a raw JSON token.

    ``Infinity`` / ``NaN`` can't ride ``json=`` (httpx serializes with
    ``allow_nan=False``), but Python's ``json.loads`` — hence FastAPI's
    body parser — accepts the bare tokens, so this is exactly what an
    abusive client can send.
    """
    body = json.dumps({**_BODIES["shoulder"], "workLen": 0})
    raw = body.replace('"workLen": 0', f'"workLen": {work_len_literal}')
    assert work_len_literal in raw
    return client.post(
        "/render/pdf",
        headers={
            "Authorization": f"Bearer {_SECRET}",
            "Content-Type": "application/json",
        },
        content=raw,
    )


@pytest.mark.parametrize(
    "literal",
    ["Infinity", "-Infinity", "NaN", "5e7", "20000.1"],
)
def test_render_pdf_extreme_worklen_is_clean_422(client: TestClient, literal: str) -> None:
    """No OverflowError / bare 500 reachable: structured 422 every time."""
    res = _post_pdf_raw(client, literal)
    assert res.status_code == 422, res.text
    detail = res.json()["detail"]
    assert any(e["loc"][-1] == "workLen" for e in detail)


def test_render_pdf_at_ceiling_succeeds(client: TestClient) -> None:
    res = _post_pdf_raw(client, "20000.0")
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"
