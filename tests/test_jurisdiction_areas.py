"""#347: the site's geocoder search areas match a fresh build from data/boundaries."""

from __future__ import annotations

import importlib.util
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = REPO_ROOT / "scripts" / "build_jurisdiction_areas.py"


def _builder():
    spec = importlib.util.spec_from_file_location("build_jurisdiction_areas", SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_committed_areas_match_a_fresh_build() -> None:
    mod = _builder()
    committed = mod.OUT_PATH.read_text(encoding="utf-8")
    assert committed == mod.render(), (
        "conestruct/site/lib/jurisdiction-areas.json is stale; "
        "run `uv run python scripts/build_jurisdiction_areas.py`"
    )


def test_every_box_is_the_polygon_extent() -> None:
    mod = _builder()
    areas = mod.build()["areas"]
    # Denver and Aurora are the issue's two cities; both are TIGER places.
    assert areas["denver"]["supported"] is True
    assert areas["aurora"]["supported"] is False
    for key, area in areas.items():
        min_lng, min_lat, max_lng, max_lat = area["bbox"]
        assert min_lng < max_lng and min_lat < max_lat, key
    # Every supported area is a jurisdiction the backend has a record for.
    for key, area in areas.items():
        if area["supported"]:
            assert (REPO_ROOT / "data" / "jurisdictions" / f"{key}.json").exists(), key
