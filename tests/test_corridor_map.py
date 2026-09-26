"""#301 piece 1 — ``POST /render/corridor-map``: the WHERE band's aerial.

Ruling 1 on the #301 checkpoint: "Option (a), scenario in, PNG out, drawn on
the backend, thin Next proxy."  Asserted on the Static Images request the
endpoint makes (what the band will show) and on what it answers when there
is nothing to draw (Rule 10):

- the band's overlay IS page 2's overlay, byte for byte, plus the pin (#301's
  acceptance — one producer — on the Broadway SB and Lafayette fixtures);
- before the side, the pin alone and nothing directional (#290's pre-side
  ruling); before the kind, the work segment only (rule 112);
- the colours and width ranks equal the picker's ``lib/corridor-zones.ts``
  (ruling 3: all three surfaces in the picker's colours);
- the token never leaves the backend.
"""

from __future__ import annotations

import io
import json
import os
import re
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from urllib.parse import unquote

import httpx
import pytest
from fastapi.testclient import TestClient

import src.rendering.plan_sheet as ps
from src.rendering import static_aerial as sa
from src.rules import site_detection as sd

_TEST_SECRET = "test-secret-do-not-deploy"
AUTH = {"Authorization": f"Bearer {_TEST_SECRET}"}
ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).parent / "fixtures" / "corridor"


def _png() -> bytes:
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), (128, 128, 128)).save(buf, format="PNG")
    return buf.getvalue()


# A real (tiny) image: page 2 embeds what it is handed, so the fake must be
# decodable for the PDF leg of the agreement test.
PNG = _png()


def fixture(name: str, **overrides: Any) -> dict[str, Any]:
    scenario = json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8"))
    scenario.update(overrides)
    return scenario


def unsided(name: str) -> dict[str, Any]:
    scenario = fixture(name)
    scenario["meta"].pop("work")
    return scenario


@pytest.fixture(scope="module", autouse=True)
def _render_secret() -> Iterator[None]:
    os.environ["RENDER_API_SECRET"] = _TEST_SECRET
    yield


@pytest.fixture(autouse=True)
def _no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        sd, "_overpass_request_with_fallback", lambda *_a, **_kw: ({"elements": []}, None)
    )


class _Png:
    content = PNG

    def raise_for_status(self) -> None:
        return None


@pytest.fixture()
def mapbox(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """Every Static Images request, from the band's endpoint and page 2 alike."""
    requests: list[dict[str, Any]] = []
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")

    def get(url: str, params: dict[str, str] | None = None, **_kw: Any) -> _Png:
        requests.append({"url": url, "params": dict(params or {})})
        return _Png()

    monkeypatch.setattr(httpx, "get", get)
    monkeypatch.setattr(ps, "_validate_corridor_bearing", lambda corridor: None)
    return requests


@pytest.fixture()
def client() -> TestClient:
    from src.api.render_api import app

    return TestClient(app)


def band(
    client: TestClient,
    scenario: dict[str, Any],
    stage: str,
    w: int = 600,
    h: int = 300,
    zoom: int | None = None,
):
    body: dict[str, Any] = {"scenario": scenario, "stage": stage, "width": w, "height": h}
    if zoom is not None:
        body["zoom"] = zoom
    return client.post("/render/corridor-map", headers=AUTH, json=body)


def overlays_of(url: str) -> str:
    m = re.match(
        r"https://api\.mapbox\.com/styles/v1/mapbox/[^/]+/static/(.*)/auto/\d+x\d+@2x$", url
    )
    assert m, url
    return m.group(1)


@pytest.mark.parametrize("name", ["broadway-sb", "lafayette-flagger"])
def test_the_band_draws_page_twos_overlay_plus_the_pin(
    client: TestClient, mapbox: list[dict[str, Any]], name: str
) -> None:
    scenario = fixture(name)
    r = band(client, scenario, "laid_out")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content == PNG
    band_url = mapbox[-1]["url"]
    assert client.post("/render/pdf", headers=AUTH, json=scenario).status_code == 200
    page_two_url = mapbox[-1]["url"]
    pin = sa.pin_marker(scenario["meta"]["lat"], scenario["meta"]["lng"])
    assert overlays_of(band_url) == f"{overlays_of(page_two_url)},{pin}"
    # Both surfaces frame auto; page 2's padding at page-2 width.
    assert mapbox[-1]["params"]["padding"] == "60"


def test_two_approaches_on_the_flagger_one_on_the_shoulder(
    client: TestClient, mapbox: list[dict[str, Any]]
) -> None:
    band(client, fixture("broadway-sb"), "laid_out")
    shoulder = overlays_of(mapbox[-1]["url"])
    band(client, fixture("lafayette-flagger"), "laid_out")
    flagger = overlays_of(mapbox[-1]["url"])
    # Each approach's advance warning is one path, or two where it runs past
    # the mapped road (the faded part, #211) — so count approaches by the
    # taper: one path per approach, at full or faded opacity.
    advance = f"path-6+{sa.ZONE_COLOR['advance_warning']}"
    taper = f"path-5+{sa.ZONE_COLOR['transition']}-"
    assert shoulder.count(taper) == 1 and shoulder.count(advance) >= 1
    assert flagger.count(taper) == 2 and flagger.count(advance) >= 2


def test_before_the_side_the_pin_alone(client: TestClient, mapbox: list[dict[str, Any]]) -> None:
    """#290's pre-side ruling: the pin, and nothing directional (P16, Rule 10)."""
    scenario = unsided("broadway-sb")
    r = band(client, scenario, "pin")
    assert r.status_code == 200
    url = mapbox[-1]["url"]
    lat, lng = scenario["meta"]["lat"], scenario["meta"]["lng"]
    assert "path-" not in url
    assert f"/static/{sa.pin_marker(lat, lng)}/{lng:.6f},{lat:.6f},{sa.PIN_ZOOM},0/" in url
    # And the corridor stages refuse — there is no direction to draw.
    for stage in ("work", "laid_out"):
        r = band(client, scenario, stage)
        assert (r.status_code, r.json()["status"]) == (409, "side_not_confirmed")


def test_before_the_kind_the_work_segment_only(
    client: TestClient, mapbox: list[dict[str, Any]]
) -> None:
    """Rule 112: nothing upstream is drawn speculatively."""
    band(client, fixture("lafayette-flagger"), "work")
    overlays = overlays_of(mapbox[-1]["url"])
    paths = [p for p in overlays.split(",") if p.startswith("path-")]
    assert paths and all(p.startswith(f"path-3+{sa.ZONE_COLOR['work_zone']}") for p in paths)


def test_the_band_is_narrower_at_phone_width(
    client: TestClient, mapbox: list[dict[str, Any]]
) -> None:
    band(client, fixture("broadway-sb"), "laid_out", w=348, h=250)
    assert mapbox[-1]["url"].endswith("/auto/348x250@2x")
    assert mapbox[-1]["params"]["padding"] == str(sa.NARROW_PADDING_PX)


def test_the_token_stays_on_the_backend(client: TestClient, mapbox: list[dict[str, Any]]) -> None:
    r = band(client, fixture("broadway-sb"), "laid_out")
    assert mapbox[-1]["params"]["access_token"] == "test-token"
    assert "test-token" not in mapbox[-1]["url"]
    assert b"test-token" not in r.content
    assert "test-token" not in json.dumps(dict(r.headers))


def test_no_pin_no_token_and_a_failed_fetch_answer_in_words(
    client: TestClient, mapbox: list[dict[str, Any]], monkeypatch: pytest.MonkeyPatch
) -> None:
    scenario = fixture("broadway-sb")
    scenario["meta"]["lat"] = 0
    scenario["meta"]["lng"] = 0
    r = band(client, scenario, "pin")
    assert (r.status_code, r.json()["status"]) == (409, "no_pin")

    monkeypatch.setenv("MAPBOX_TOKEN", "")
    r = band(client, fixture("broadway-sb"), "laid_out")
    assert (r.status_code, r.json()["status"]) == (503, "unavailable")

    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")

    def fail(*_a: Any, **_kw: Any) -> None:
        raise httpx.ConnectError("down")

    monkeypatch.setattr(httpx, "get", fail)
    r = band(client, fixture("broadway-sb"), "laid_out")
    assert (r.status_code, r.json()["status"]) == (502, "unavailable")


def test_the_request_is_bounded(client: TestClient, mapbox: list[dict[str, Any]]) -> None:
    assert band(client, fixture("broadway-sb"), "laid_out", w=2000).status_code == 422
    assert band(client, fixture("broadway-sb"), "everything").status_code == 422


def test_the_picture_follows_the_one_layout_call(
    client: TestClient, mapbox: list[dict[str, Any]]
) -> None:
    """#302: at 65->60 the band draws the 570 ft buffer the plan builds."""
    band(client, fixture("broadway-sb", speed=65, workZoneSpeed=60), "laid_out")
    at_step_down = overlays_of(mapbox[-1]["url"])
    band(client, fixture("broadway-sb", speed=65), "laid_out")
    no_reduction = overlays_of(mapbox[-1]["url"])
    buffer = f"path-4+{sa.ZONE_COLOR['buffer']}"
    assert buffer in at_step_down and at_step_down != no_reduction


def test_the_zone_channels_equal_the_pickers() -> None:
    """Ruling 3: the band, the picker and page 2 draw one palette.

    ``lib/corridor-zones.ts`` is the corridor's palette source (registered in
    ``lib/design/ink-exceptions.ts``); this module mirrors it for the Static
    Images surfaces.  Until now they agreed by hand.
    """
    ts = (ROOT / "conestruct/site/lib/corridor-zones.ts").read_text(encoding="utf-8")
    colors = dict(
        re.findall(
            r'^\s+(\w+): "#([0-9A-Fa-f]{6})"', ts.split("ZONE_COLOR")[1].split("};")[0], re.M
        )
    )
    ranks = dict(
        (zone, int(rank))
        for zone, rank in re.findall(
            r"^\s+(\w+): \{ dash: \[[^\]]*\], widthRank: (\d) \}", ts, re.M
        )
    )
    labels = dict(
        re.findall(r'^\s+(\w+): "([A-Za-z ]+)",', ts.split("ZONE_LABEL")[1].split("};")[0], re.M)
    )
    assert {k: v.upper() for k, v in colors.items()} == sa.ZONE_COLOR
    assert ranks == sa.ZONE_RANK
    assert labels == sa.ZONE_WORD


def test_unquoted_overlay_is_well_formed(client: TestClient, mapbox: list[dict[str, Any]]) -> None:
    band(client, fixture("lafayette-flagger"), "laid_out")
    overlays = unquote(overlays_of(mapbox[-1]["url"]))
    assert overlays.count("path-") >= 9
    assert len(mapbox[-1]["url"]) < 8192


# ---------------------------------------------------------------------------
# Zoom (Ryan's hand-check ruling on #301, 2026-09-26): "+ / − ... re-request
# /render/corridor-map with a zoom step; the default framing stays the whole
# corridor ... allow one step out for context; + allows up to N steps in, N
# CHOSEN and recorded.  Keep the pin and overlay."
# ---------------------------------------------------------------------------

_VIEW = re.compile(
    r"/static/(?P<overlays>.*)/(?P<lng>-?[\d.]+),(?P<lat>-?[\d.]+),(?P<z>[\d.]+),0/(?P<w>\d+)x(?P<h>\d+)@2x$"
)


def view_of(url: str) -> dict[str, Any]:
    m = _VIEW.search(url)
    assert m, url
    return {
        "overlays": m.group("overlays"),
        "lat": float(m.group("lat")),
        "lng": float(m.group("lng")),
        "z": float(m.group("z")),
    }


def _pixel_box(points, lat, lng, z, w, h):  # noqa: ANN001
    """Where each point lands in a w x h frame centred at (lat, lng), zoom z."""
    import math

    def merc(la: float, lo: float) -> tuple[float, float]:
        s_ = math.sin(math.radians(la))
        return (lo + 180) / 360, 0.5 - math.log((1 + s_) / (1 - s_)) / (4 * math.pi)

    cx, cy = merc(lat, lng)
    scale = 512 * 2**z
    return [
        ((x - cx) * scale + w / 2, (y - cy) * scale + h / 2) for x, y in (merc(*p) for p in points)
    ]


def test_step_zero_is_the_shipped_framing(client: TestClient, mapbox: list[dict[str, Any]]) -> None:
    band(client, fixture("broadway-sb"), "laid_out")
    default = mapbox[-1]["url"]
    band(client, fixture("broadway-sb"), "laid_out", zoom=0)
    assert mapbox[-1]["url"] == default
    assert "/auto/" in default


@pytest.mark.parametrize("name", ["broadway-sb", "lafayette-flagger"])
def test_the_steps_keep_the_overlay_and_the_pin(
    client: TestClient, mapbox: list[dict[str, Any]], name: str
) -> None:
    band(client, fixture(name), "laid_out")
    shipped = overlays_of(mapbox[-1]["url"])
    for zoom in (-1, 1, 2, 3):
        band(client, fixture(name), "laid_out", zoom=zoom)
        assert view_of(mapbox[-1]["url"])["overlays"] == shipped, zoom
        assert "padding" not in mapbox[-1]["params"]


def test_the_fit_holds_the_whole_corridor_and_each_step_is_one_level(
    client: TestClient, mapbox: list[dict[str, Any]]
) -> None:
    """The backend's fit (the number the steps step from) puts every drawn
    point inside the frame at step 0's zoom; −1 is one level out; +1..+3 are
    one level in each."""
    from src.api.schemas import scenario_to_call
    from src.rules.corridor_layout import laid_out

    scenario = fixture("lafayette-flagger")
    from pydantic import TypeAdapter

    from src.api.schemas import Scenario

    params, *_ = scenario_to_call(
        TypeAdapter(Scenario).validate_python(scenario), place_cross_street=False
    )
    _primary, approaches = laid_out(params, scenario["meta"]["lat"], scenario["meta"]["lng"])
    points = sa.drawn_points(approaches, stage="laid_out")
    (clat, clng), fit = sa.fit_view(points, 600, 300, sa.PADDING_PX)
    for x, y in _pixel_box(points, clat, clng, fit, 600, 300):
        assert sa.PADDING_PX - 1 <= x <= 600 - sa.PADDING_PX + 1
        assert sa.PADDING_PX - 1 <= y <= 300 - sa.PADDING_PX + 1

    band(client, scenario, "laid_out", zoom=-1)
    out = view_of(mapbox[-1]["url"])
    assert out["z"] == pytest.approx(fit - 1, abs=0.01)
    # One step out looks at the corridor's middle.
    assert (out["lat"], out["lng"]) == pytest.approx((clat, clng), abs=1e-6)
    for zoom in (1, 2, 3):
        band(client, scenario, "laid_out", zoom=zoom)
        assert view_of(mapbox[-1]["url"])["z"] == pytest.approx(fit + zoom, abs=0.01)


def test_a_step_in_looks_at_the_work(client: TestClient, mapbox: list[dict[str, Any]]) -> None:
    """P21: zooming in centres on the work segment's middle — what the pin marks."""
    band(client, fixture("broadway-sb"), "laid_out", zoom=3)
    view = view_of(mapbox[-1]["url"])
    # The work runs south from the pin (#298's fix): its middle is south of
    # the pin, on the same road.
    pin = fixture("broadway-sb")["meta"]
    assert view["lat"] < pin["lat"]
    assert abs(view["lng"] - pin["lng"]) < 0.001


def test_before_the_side_the_steps_move_the_pin_view(
    client: TestClient, mapbox: list[dict[str, Any]]
) -> None:
    scenario = unsided("broadway-sb")
    for zoom, z in ((-1, sa.PIN_ZOOM - 1), (3, sa.PIN_ZOOM + 3)):
        band(client, scenario, "pin", zoom=zoom)
        assert f",{z},0/" in mapbox[-1]["url"]
        assert "path-" not in mapbox[-1]["url"]


def test_the_steps_are_bounded(client: TestClient, mapbox: list[dict[str, Any]]) -> None:
    """One step out, three in (CHOSEN, static_aerial.ZOOM_IN_MAX)."""
    assert (sa.ZOOM_OUT_MAX, sa.ZOOM_IN_MAX) == (1, 3)
    for zoom in (-2, 4):
        assert band(client, fixture("broadway-sb"), "laid_out", zoom=zoom).status_code == 422
