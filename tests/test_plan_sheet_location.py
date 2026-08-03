"""#157 — the sheet prints BOTH the typed address and the pin (ruled 2026-07-30).

Rendered-output tests (Rule 11: the defect shipped in the drawn PDF, so
the assertions extract text from the rendered document, not from helper
return values).  The reproduction scenario is the issue's own: typed
"23rd ave, greeley, co", pin at Denver Civic Center — pre-fix, page 1
carried the Greeley string and no coordinate anywhere.
"""

from __future__ import annotations

import pypdfium2 as pdfium
import pytest

from src.generation.layout import generate_flagger_alternating_2lane
from src.rendering import plan_sheet as ps
from src.rules.validators import ScenarioParams

DENVER = (39.7389, -104.9862)


def _tiny_png_bytes() -> bytes:
    """A real (drawable) PNG — ReportLab hands it to PIL at drawImage."""
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (4, 4), (128, 128, 128)).save(buf, format="PNG")
    return buf.getvalue()


class _FakeResponse:
    content = _tiny_png_bytes()

    def raise_for_status(self) -> None:
        return None


@pytest.fixture()
def offline_aerial(monkeypatch: pytest.MonkeyPatch) -> None:
    """Page 2 renders without network: fake tile, silenced OSM check."""
    monkeypatch.setenv("MAPBOX_TOKEN", "test-token")
    monkeypatch.setattr(ps.httpx, "get", lambda *a, **k: _FakeResponse())
    monkeypatch.setattr(ps, "_validate_corridor_bearing", lambda corridor: None)


def _mismatch_params() -> ScenarioParams:
    return ScenarioParams(
        closure_type="flagger",
        road_type="urban_low",
        speed_mph=30,
        num_lanes=2,
        lane_width_ft=12.0,
        work_zone_length_ft=300.0,
        location_description="23rd ave, greeley, co",
        bearing_deg=0.0,
    )


def _render(tmp_path, params: ScenarioParams, **kwargs) -> list[str]:
    """Render through the production entry point; return per-page text."""
    out = str(tmp_path / "sheet.pdf")
    placements = generate_flagger_alternating_2lane(params)
    ps.render_plan_sheet(placements, params, output_path=out, **kwargs)
    doc = pdfium.PdfDocument(out)
    return [doc[i].get_textpage().get_text_range() for i in range(len(doc))]


class TestFormatLatLng:
    def test_five_decimals(self) -> None:
        assert ps._format_latlng(39.738901234, -104.986198765) == "39.73890, -104.98620"

    def test_absence_renders_as_absence(self) -> None:
        assert ps._format_latlng(None, None) == "—"
        assert ps._format_latlng(0.0, 0.0) == "—"

    def test_zero_lat_alone_is_not_the_sentinel(self) -> None:
        """Only the JOINT 0/0 sentinel means unset (mirrors hasLocation)."""
        assert ps._format_latlng(0.0, -104.9862) == "0.00000, -104.98620"


class TestTitleBlockPrintsBoth:
    def test_mismatch_scenario_prints_address_and_pin(self, tmp_path, offline_aerial: None) -> None:
        pages = _render(
            tmp_path,
            _mismatch_params(),
            site_address="23rd ave, greeley, co",
            site_lat=DENVER[0],
            site_lng=DENVER[1],
        )
        page1 = pages[0]
        assert "23rd ave, greeley, co" in page1
        assert "COORDINATES:" in page1
        assert "39.73890, -104.98620" in page1

    def test_no_location_renders_dash_never_zeros(self, tmp_path) -> None:
        pages = _render(tmp_path, _mismatch_params())
        assert len(pages) == 1  # no coords → no aerial page
        page1 = pages[0]
        assert "COORDINATES:" in page1
        assert "0.00000" not in page1


class TestPageTwoCaption:
    def test_address_first_coordinates_beneath(self, tmp_path, offline_aerial: None) -> None:
        pages = _render(
            tmp_path,
            _mismatch_params(),
            site_address="23rd ave, greeley, co",
            site_lat=DENVER[0],
            site_lng=DENVER[1],
        )
        assert len(pages) == 2
        page2 = pages[1]
        # Ruled order: the label line carries the typed address; the
        # authoritative pin prints as its own 5-decimal line.
        assert "SITE: 23rd ave, greeley, co" in page2
        assert "39.73890, -104.98620" in page2
        # The label line never carries the coordinates.
        assert "SITE: 39." not in page2
        # Anchor row shares the same 5-decimal format.
        assert "39.73890, -104.98620" in page2.split("Anchor:")[1]
