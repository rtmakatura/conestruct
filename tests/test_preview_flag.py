"""#282 — the preview-as-read flag, tested where the bug would live.

#281's ruling: "A preview is a read.  No band, no lock, never memoised,
never written ... the fast request only (breakdown), never the audit, scan
or PDFs.  Needs a backend preview flag on the request (Phase 0)."

These are PAYLOAD-level tests (Rule 11).  A pure-function test of the flag
would pass while the endpoint still fired an Overpass round trip and wrote
the memo, because the defect lives at the seam, not in a function: the
breakdown path runs ``_placements_for``, which runs ``run_site_scan`` and
raises an honest 400 when Overpass never answers.  So every test here goes
through the HTTP endpoint with the transport stubbed, and asserts on what
crossed the wire and what the scan layer was asked to do.

Nothing sends this flag yet, and that is the expected end state of the
arc: Phase 0 is "foundations, nothing visible".
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from src.api import site_scan as ss
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
LAT, LNG, BEARING = 39.7113, -105.0815, 180.0


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _fresh_memo() -> Iterator[None]:
    ss.clear_memo()
    yield
    ss.clear_memo()


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


@pytest.fixture()
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {_TEST_SECRET}"}


class CountingOverpass:
    """Counts every Overpass round trip the request layer attempts."""

    def __init__(self) -> None:
        self.calls = 0

    def __call__(self, *_a: Any, **_kw: Any) -> tuple[dict[str, Any], None]:
        self.calls += 1
        return {"elements": []}, None


@pytest.fixture()
def overpass(monkeypatch: pytest.MonkeyPatch) -> CountingOverpass:
    stub = CountingOverpass()
    monkeypatch.setattr(sd, "_overpass_request_with_fallback", stub)
    return stub


def scenario(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "kind": "shoulder",
        "meta": {"project": "s282", "address": "", "lat": LAT, "lng": LNG, "bearingDeg": BEARING},
        "roadType": "urban_arterial",
        "speed": 45,
        "lanes": 2,
        "laneWidth": 12,
        "divided": True,
        "workType": "utility_locate",
        "duration": "short",
        "workLen": 1000,
        "night": False,
    }
    base.update(over)
    return base


# ---------------------------------------------------------------------------
# The schema
# ---------------------------------------------------------------------------


def test_preview_defaults_to_false_on_every_kind() -> None:
    """Backend-first: the field must EXIST server-side before any sender
    sets it, because Pydantic silently drops an unknown field — a frontend
    that shipped first would send ``preview`` into a void and get a
    generate back."""
    from src.api.schemas import (
        FlaggerLaneClosureScenario,
        LaneClosureDividedScenario,
        MobileOp2LaneScenario,
        MobileOpMultilaneScenario,
        NearIntersectionScenario,
        ShoulderScenario,
        WorkBeyondShoulderScenario,
    )

    for cls in (
        ShoulderScenario,
        FlaggerLaneClosureScenario,
        LaneClosureDividedScenario,
        WorkBeyondShoulderScenario,
        MobileOp2LaneScenario,
        MobileOpMultilaneScenario,
        NearIntersectionScenario,
    ):
        assert "preview" in cls.model_fields, cls.__name__
        assert cls.model_fields["preview"].default is False, cls.__name__


# ---------------------------------------------------------------------------
# preview: true — the read
# ---------------------------------------------------------------------------


def test_preview_runs_no_scan_and_writes_no_memo(
    client: TestClient, auth: dict[str, str], overpass: CountingOverpass
) -> None:
    """The ruling's core: never memoised, never written, never the scan.

    The scenario carries ``site_scan``, which without the flag WOULD fire a
    round trip and populate the memo.  With the flag it must do neither.
    """
    body = scenario(preview=True, site_scan={})
    res = client.post("/render/device-breakdown", headers=auth, json=body)
    assert res.status_code == 200, res.text[:300]
    assert overpass.calls == 0, "a preview must not touch Overpass"
    assert len(ss._MEMO) == 0, "a preview must not write the memo"


def test_preview_echoes_itself_on_the_wire(
    client: TestClient, auth: dict[str, str], overpass: CountingOverpass
) -> None:
    """The echo is the MECHANISM that stops a consumer presenting a preview
    as a generate.  A frontend convention would not be one."""
    res = client.post(
        "/render/device-breakdown", headers=auth, json=scenario(preview=True, site_scan={})
    )
    assert res.status_code == 200
    assert res.json().get("preview") is True


def test_preview_still_returns_the_cheap_numbers(
    client: TestClient, auth: dict[str, str], overpass: CountingOverpass
) -> None:
    """A read that returns nothing is not a preview.  The breakdown's own
    payload must survive — the before/after panel is built from it."""
    res = client.post("/render/device-breakdown", headers=auth, json=scenario(preview=True))
    assert res.status_code == 200
    payload = res.json()
    for key in ("devices", "total_devices", "unique_types", "zone_geometry"):
        assert key in payload, key
    assert payload["total_devices"] > 0


def test_preview_is_refused_on_the_paths_it_may_not_take(
    client: TestClient, auth: dict[str, str], overpass: CountingOverpass
) -> None:
    """ "The fast request ONLY (breakdown), never the audit, scan or PDFs."

    Silently ignoring the flag on those paths would let a caller believe it
    had asked for a read and receive a write — Rule 10.  The refusal is an
    honest 400 that names the flag.
    """
    # Bare-scenario bodies.
    for path in ("/render/audit", "/render/pdf", "/render/xlsx", "/render/markdown"):
        res = client.post(path, headers=auth, json=scenario(preview=True))
        assert res.status_code == 400, f"{path} returned {res.status_code}"
        assert "preview" in res.text.lower(), path

    # Wrapped bodies take the scenario under a key — refused just the same,
    # and tested in their own shape so a 422 (the wrapper rejecting the
    # request) can never be mistaken for the guard doing its job.
    for path in ("/render/quote", "/render/quote-breakdown"):
        res = client.post(path, headers=auth, json={"scenario": scenario(preview=True)})
        assert res.status_code == 400, f"{path} returned {res.status_code}"
        assert "preview" in res.text.lower(), path


# ---------------------------------------------------------------------------
# preview absent — byte-identical to today
# ---------------------------------------------------------------------------


def test_absent_flag_is_byte_identical_to_today(
    client: TestClient, auth: dict[str, str], overpass: CountingOverpass
) -> None:
    """Absent ⇒ nothing changes, including the ABSENCE of the echo.  A
    ``preview: false`` key on every ordinary response would be a wire change
    to every consumer, which the ruling explicitly does not ask for."""
    res = client.post("/render/device-breakdown", headers=auth, json=scenario())
    assert res.status_code == 200
    assert "preview" not in res.json()


def test_absent_flag_still_scans_when_asked(
    client: TestClient, auth: dict[str, str], overpass: CountingOverpass
) -> None:
    """The other half of byte-identical: a scenario carrying ``site_scan``
    and NO preview flag must still fire the scan it asked for."""
    res = client.post("/render/device-breakdown", headers=auth, json=scenario(site_scan={}))
    assert res.status_code == 200
    assert overpass.calls >= 1, "without the flag the scan must still run"
