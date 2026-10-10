"""#315: a stored left side the backend no longer builds.

R124 option (a), R125 (``validation-artifacts/committed/issue-315-stale-left/
rulings.md``): the two READ endpoints answer a left side that
``schemas.left_side_built`` refuses as NO side, so the side control gets the
curbs it can offer and the band's aerial the pin picture; the geometry read
adds ``side_refused`` with the backend's one line per cause (R125 Q1).  Every
deliverable still refuses with R120's 400 (``test_left_side_oneway.py``).

Tested where the bug lived (Rule 11): the wire, on N Broadway SB
(``tests/fixtures/corridor/broadway-sb.json``) in each stale shape, the prod
repro (a kind change to flagger) among them.
"""

from __future__ import annotations

import copy
import io
import json
import os
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from src.api.render_api import SIDE_REFUSAL_MESSAGES, _side_refusal, app
from src.api.schemas import Scenario, left_side_built
from src.rendering import plan_sheet as ps
from src.rules import site_detection as sd

AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}
CORRIDOR = Path(__file__).parent / "fixtures" / "corridor"
ONE_WAY_STREET = {
    "oneway": "yes",
    "highwayClass": "primary",
    "twinDistanceM": None,
    "twinSearched": True,
}


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> None:
    os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"


@pytest.fixture(autouse=True)
def _no_overpass(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(app)


def broadway(side: str | None = "left") -> dict[str, Any]:
    """N Broadway SB as the site relays it after #308: a one-way street."""
    b = json.loads((CORRIDOR / "broadway-sb.json").read_text(encoding="utf-8"))
    meta = b["meta"]
    cand = meta["confirmedRoad"]["candidate"]
    meta["centerline"] = cand["geometry"]
    meta["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": "yes"}
    meta.pop("work", None)
    if side is not None:
        meta["work"] = {"side": side, "travel": "with_geometry"}
    b["carriageway"] = dict(ONE_WAY_STREET)
    b["divided"] = False
    return b


def stale(cause: str) -> dict[str, Any]:
    """Broadway with its left side stored, made stale by ``cause``."""
    b = broadway("left")
    if cause == "not_shoulder":
        # The prod repro (issue-300-left-side-oneway/r120-prod): the kind
        # switched to a flagger lane closure after the left curb was picked.
        f = json.loads((CORRIDOR / "lafayette-flagger.json").read_text(encoding="utf-8"))
        f["meta"] = copy.deepcopy(b["meta"])
        f["carriageway"] = copy.deepcopy(b["carriageway"])
        return f
    if cause == "no_road":
        b["meta"]["centerline"] = None
    elif cause == "no_facts":
        del b["carriageway"]
    elif cause == "two_way":
        b["meta"]["roadDirection"]["oneway"] = "no"
        b["carriageway"]["oneway"] = "no"
    elif cause == "divided":
        b["carriageway"]["confirmed"] = "divided"
    elif cause == "undecided":
        b["carriageway"]["twinSearched"] = False
    elif cause == "highway":
        b["carriageway"]["highwayClass"] = "motorway"
    else:  # pragma: no cover - a typo in the parametrisation
        raise AssertionError(cause)
    return b


def unsided(body: dict[str, Any]) -> dict[str, Any]:
    b = copy.deepcopy(body)
    b["meta"].pop("work", None)
    return b


def parsed(body: dict[str, Any]) -> Any:
    return TypeAdapter(Scenario).validate_python(body)


def geometry(client: TestClient, body: dict[str, Any]) -> dict[str, Any]:
    r = client.post("/render/corridor-geometry", headers=AUTH, json=body)
    assert r.status_code == 200, r.text
    return r.json()


CAUSES = ["not_shoulder", "no_road", "no_facts", "two_way", "divided", "undecided", "highway"]


def test_every_cause_has_one_message() -> None:
    assert sorted(SIDE_REFUSAL_MESSAGES) == sorted(CAUSES)


@pytest.mark.parametrize("cause", CAUSES)
def test_each_stale_shape_is_named_by_its_own_cause(cause: str) -> None:
    scenario = parsed(stale(cause))
    assert left_side_built(scenario) is False
    assert _side_refusal(scenario) == {
        "side": "left",
        "cause": cause,
        "message": SIDE_REFUSAL_MESSAGES[cause],
    }


@pytest.mark.parametrize(
    "body",
    [broadway("right"), broadway("left"), broadway(None), broadway("median")],
    ids=["right", "built-left", "unsided", "median"],
)
def test_no_refusal_unless_a_stored_left_is_refused(body: dict[str, Any]) -> None:
    # The agreement with left_side_built: a refusal exactly when the stored
    # side is left and the predicate says no.  Median is #315's to leave alone.
    assert _side_refusal(parsed(body)) is None


@pytest.mark.parametrize("cause", CAUSES)
def test_the_geometry_read_answers_a_stale_left_as_no_side(client: TestClient, cause: str) -> None:
    body = stale(cause)
    j = geometry(client, body)
    assert j["status"] == "side_not_confirmed"
    assert j["side_refused"] == {
        "side": "left",
        "cause": cause,
        "message": SIDE_REFUSAL_MESSAGES[cause],
    }
    # Only the curbs the backend builds, all right sides here.
    assert j["side_options"] and all(o["work"]["side"] == "right" for o in j["side_options"])
    # Everything but the reason is the answer for the same scenario with no side.
    j.pop("side_refused")
    assert j == geometry(client, unsided(body))


@pytest.mark.parametrize(
    "body",
    [broadway("right"), broadway("left"), broadway(None)],
    ids=["right", "built-left", "unsided"],
)
def test_every_other_answer_carries_no_side_refused_key(
    client: TestClient, body: dict[str, Any]
) -> None:
    assert "side_refused" not in geometry(client, body)


def test_the_prod_repro_offers_the_west_curb(client: TestClient) -> None:
    j = geometry(client, stale("not_shoulder"))
    assert [(o["label"], o["work"]) for o in j["side_options"]] == [
        ("West side · southbound traffic", {"side": "right", "travel": "with_geometry"}),
    ]
    assert j["side_refused"]["message"] == (
        "Left-side work is laid out for shoulder work only. Pick a right-side curb, "
        "or switch back to Shoulder work."
    )


@pytest.mark.parametrize("cause", ["not_shoulder", "divided"])
def test_every_deliverable_still_refuses_a_stale_left(client: TestClient, cause: str) -> None:
    r = client.post("/render/audit", headers=AUTH, json=stale(cause))
    assert r.status_code == 400, r.text
    assert r.json()["detail"]["error"] == "pin_model_input"


# --- the band's aerial (R125 Q2) ------------------------------------------


def _png() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), (128, 128, 128)).save(buf, format="PNG")
    return buf.getvalue()


class _Png:
    content = _png()

    def raise_for_status(self) -> None:
        return None


@pytest.fixture()
def mapbox(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")
    monkeypatch.setattr(httpx, "get", lambda *_a, **_kw: _Png())
    monkeypatch.setattr(ps, "_validate_corridor_bearing", lambda corridor: None)


def band(client: TestClient, body: dict[str, Any], stage: str):
    return client.post(
        "/render/corridor-map",
        headers=AUTH,
        json={"scenario": body, "stage": stage, "width": 600, "height": 300},
    )


@pytest.mark.usefixtures("mapbox")
@pytest.mark.parametrize("cause", ["not_shoulder", "divided", "two_way"])
def test_the_aerial_shows_the_pin_for_a_stale_left(client: TestClient, cause: str) -> None:
    r = band(client, stale(cause), "pin")
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "image/png"
    # Nothing laid out is drawn until a side is chosen: the pre-side answer.
    r = band(client, stale(cause), "work")
    assert r.status_code == 409
    assert r.json() == {"status": "side_not_confirmed", "message": None}
