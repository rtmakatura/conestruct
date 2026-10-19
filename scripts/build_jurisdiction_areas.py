"""Build the geocoder's search areas from the boundary layer (#347).

The site's geocoder scopes a cross-street search ("Colfax & Williams")
to a place: the city typed after the streets, the jurisdiction the
form has selected, or, with neither, all of the places together.
Mapbox takes that scope as a bounding box.  Every box here is the
extent of US Census TIGER/Line Place polygons already in
``data/boundaries/`` (provenance in its ``_meta.json``), so no
coordinate is chosen by hand (Rule 12).

Writes ``conestruct/site/lib/jurisdiction-areas.json``.  The site reads
that copy because ``data/`` is outside the Vercel build inputs.
``tests/test_jurisdiction_areas.py`` fails when it drifts from a fresh
build.

Run: ``uv run python scripts/build_jurisdiction_areas.py``
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
BOUNDARY_DIR = REPO_ROOT / "data" / "boundaries"
OUT_PATH = REPO_ROOT / "conestruct" / "site" / "lib" / "jurisdiction-areas.json"


def _extent(geometry: dict[str, Any]) -> list[float]:
    """[minLng, minLat, maxLng, maxLat] over every ring's coordinates."""
    if geometry["type"] == "Polygon":
        polygons = [geometry["coordinates"]]
    elif geometry["type"] == "MultiPolygon":
        polygons = geometry["coordinates"]
    else:
        raise ValueError(f"unexpected geometry type {geometry['type']}")
    lngs = [pt[0] for poly in polygons for ring in poly for pt in ring]
    lats = [pt[1] for poly in polygons for ring in poly for pt in ring]
    return [min(lngs), min(lats), max(lngs), max(lats)]


def build() -> dict[str, Any]:
    meta = json.loads((BOUNDARY_DIR / "_meta.json").read_text(encoding="utf-8"))
    areas: dict[str, dict[str, Any]] = {}
    for path in sorted(BOUNDARY_DIR.glob("*.geojson")):
        if path.name in ("places_unsupported.geojson", "counties.geojson"):
            continue
        feat = json.loads(path.read_text(encoding="utf-8"))
        props = feat["properties"]
        areas[props["key"]] = {
            "name": props["name"],
            "supported": True,
            "bbox": _extent(feat["geometry"]),
        }
    unsupported = json.loads(
        (BOUNDARY_DIR / "places_unsupported.geojson").read_text(encoding="utf-8")
    )
    for feat in unsupported["features"]:
        props = feat["properties"]
        areas[props["key"]] = {
            "name": props["name"],
            "supported": False,
            "bbox": _extent(feat["geometry"]),
        }
    boxes = [a["bbox"] for a in areas.values()]
    return {
        "source": meta["places"]["source"],
        "vintage": meta["places"]["vintage"],
        "built_by": "scripts/build_jurisdiction_areas.py",
        # The extent of every place above: the search area for a street
        # pair typed with no city and no jurisdiction selected (#347).
        "combined": [
            min(b[0] for b in boxes),
            min(b[1] for b in boxes),
            max(b[2] for b in boxes),
            max(b[3] for b in boxes),
        ],
        "areas": dict(sorted(areas.items())),
    }


def render() -> str:
    return json.dumps(build(), indent=2) + "\n"


if __name__ == "__main__":
    OUT_PATH.write_text(render(), encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(REPO_ROOT)}")
