"""#347: the site's geocoder search areas match a fresh build from data/boundaries."""

from __future__ import annotations

import importlib.util
import json
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


def test_authority_areas_follow_each_record_authority() -> None:
    """#352: every jurisdiction record with no TIGER place gets its
    authority's extent; e470's toll corridor has no sourced polygon."""
    built = _builder().build()
    places = built["areas"]
    authority = built["authority_areas"]
    assert set(authority) == {"cdot", "el_paso", "loveland"}
    for path in sorted((REPO_ROOT / "data" / "jurisdictions").glob("*.json")):
        key = path.stem
        if key in places:
            assert key not in authority, key
            continue
        rec = json.loads(path.read_text(encoding="utf-8"))
        scope = {"state": "state", "county": "county", "city": "place"}.get(rec["authority"])
        if scope is None:
            assert key not in authority, key
        else:
            assert authority[key]["scope"] == scope, key
    # Colorado holds every place and the combined box.
    co = authority["cdot"]["bbox"]
    for b in [built["combined"], *(a["bbox"] for a in places.values())]:
        assert co[0] <= b[0] and co[1] <= b[1] and b[2] <= co[2] and b[3] <= co[3]
    # El Paso's box holds the county polygon in counties.geojson.
    counties = json.loads(
        (REPO_ROOT / "data" / "boundaries" / "counties.geojson").read_text(encoding="utf-8")
    )
    el_paso = next(f for f in counties["features"] if f["properties"]["name"] == "El Paso")
    lo_lng, lo_lat, hi_lng, hi_lat = authority["el_paso"]["bbox"]
    for poly in el_paso["geometry"]["coordinates"]:
        for ring in poly if el_paso["geometry"]["type"] == "MultiPolygon" else [poly]:
            for lng, lat in ring:
                assert lo_lng <= lng <= hi_lng and lo_lat <= lat <= hi_lat


def test_combined_box_is_the_extent_of_every_place() -> None:
    built = _builder().build()
    boxes = [a["bbox"] for a in built["areas"].values()]
    assert len(boxes) == 31
    min_lng, min_lat, max_lng, max_lat = built["combined"]
    for b in boxes:
        assert min_lng <= b[0] and min_lat <= b[1] and b[2] <= max_lng and b[3] <= max_lat
    assert min_lng in [b[0] for b in boxes] and max_lat in [b[3] for b in boxes]
