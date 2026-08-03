"""#141 — the page-2 aerial uses a labeled style.

URL-level regression on the Mapbox Static request: the style segment,
the size segment, and the @2x retina flag must survive any future URL
refactor.  The label legibility itself is measured on the served PDF in
the live checks (grayscale pair); this pins the request that produces
it.
"""

from __future__ import annotations

import pytest

from src.rendering import plan_sheet as ps
from src.rules.corridor import build_corridor

_PNG_1PX = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000d49444154789c626001000000ffff03000006000557bfabd40000000049454e44ae426082"
)


class _FakeResponse:
    content = _PNG_1PX

    def raise_for_status(self) -> None:
        return None


@pytest.fixture()
def captured_url(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    seen: list[str] = []

    def fake_get(url: str, params: dict | None = None, timeout: float | None = None):
        seen.append(url)
        return _FakeResponse()

    monkeypatch.setattr(ps.httpx, "get", fake_get)
    monkeypatch.setattr(ps, "_validate_corridor_bearing", lambda corridor: None)
    return seen


def test_pin_only_aerial_uses_labeled_style(captured_url: list[str]) -> None:
    assert ps._fetch_mapbox_aerial(39.7423, -105.2392, "test-token") is not None
    url = captured_url[0]
    assert "/styles/v1/mapbox/satellite-streets-v12/static/" in url
    assert url.endswith("1200x500@2x")


def test_corridor_aerial_uses_labeled_style(captured_url: list[str]) -> None:
    corridor = build_corridor(
        lat=39.7423,
        lng=-105.2392,
        bearing_deg=155.9,
        speed_mph=40,
        work_zone_ft=800.0,
        closure_type="shoulder",
        road_type="urban_high",
    )
    assert ps._fetch_mapbox_aerial(39.7423, -105.2392, "test-token", corridor=corridor) is not None
    url = captured_url[0]
    assert "/styles/v1/mapbox/satellite-streets-v12/static/path-" in url
    assert url.endswith("1200x500@2x")


def test_style_constant_is_the_single_source() -> None:
    """The raw v9 style must not linger anywhere in the module."""
    import inspect

    source = inspect.getsource(ps)
    assert "satellite-v9" not in source
