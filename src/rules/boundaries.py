"""Pin-based jurisdiction suggestion (Endeavor B §2) — advisory only.

Point-in-polygon + distance against the bundled boundary layer built by
``scripts/build_boundaries.py`` (``data/boundaries/``).  No external
geocoding: the pin's lat/lng comes from the existing map picker.

Prime directive: a pin can *suggest*, never *set*.  This module returns
an advisory payload; nothing here reads or writes a scenario, and the
only writer of ``jurisdiction_key`` is the user's explicit Confirm in
the frontend.  A wrong silent guess poisons every downstream number —
suggest-and-confirm, with warnings, always.

Geometry note: layers are projected at load into a local equirectangular
feet frame anchored at the Denver metro center, so all distances here
are in feet directly.  East-west scale error across the metro span is
≈1 % — irrelevant for an advisory 500 ft warning band.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from typing import Any

from shapely.geometry import Point, shape
from shapely.ops import transform
from shapely.prepared import prep

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BOUNDARY_DIR = REPO_ROOT / "data" / "boundaries"

#: Warning band (spec §2): another polygon closer than this ⇒ warn.
NEAR_BOUNDARY_FT = 500.0

# Local equirectangular anchor (Denver metro) and per-degree scales.
_LAT0 = 39.7
_LNG0 = -104.95
_FT_PER_DEG_LAT = 364_606.0
_FT_PER_DEG_LNG = _FT_PER_DEG_LAT * math.cos(math.radians(_LAT0))


def _to_ft(lng: float, lat: float) -> tuple[float, float]:
    return ((lng - _LNG0) * _FT_PER_DEG_LNG, (lat - _LAT0) * _FT_PER_DEG_LAT)


def _project(geom):
    return transform(lambda x, y, z=None: _to_ft(x, y), geom)


class _Layer:
    """One polygon with its name/key, projected to feet, PIP-prepared."""

    def __init__(self, key: str | None, name: str, geom) -> None:
        self.key = key
        self.name = name
        self.geom = _project(geom)
        self.prepared = prep(self.geom)


@lru_cache(maxsize=1)
def _load() -> dict[str, Any]:
    meta = json.loads((BOUNDARY_DIR / "_meta.json").read_text(encoding="utf-8"))
    supported: list[_Layer] = []
    for path in sorted(BOUNDARY_DIR.glob("*.geojson")):
        if path.name in ("places_unsupported.geojson", "counties.geojson"):
            continue
        feat = json.loads(path.read_text(encoding="utf-8"))
        props = feat["properties"]
        supported.append(_Layer(props["key"], props["name"], shape(feat["geometry"])))
    unsupported = [
        _Layer(f["properties"]["key"], f["properties"]["name"], shape(f["geometry"]))
        for f in json.loads(
            (BOUNDARY_DIR / "places_unsupported.geojson").read_text(encoding="utf-8")
        )["features"]
    ]
    counties = [
        _Layer(None, f["properties"]["name"], shape(f["geometry"]))
        for f in json.loads((BOUNDARY_DIR / "counties.geojson").read_text(encoding="utf-8"))[
            "features"
        ]
    ]
    return {
        "supported": supported,
        "unsupported": unsupported,
        "counties": counties,
        "meta": meta,
    }


def boundary_source() -> dict[str, str]:
    """Source + vintage for the honesty line (spec §6)."""
    places = _load()["meta"]["places"]
    return {
        "source": "US Census TIGER/Line Place boundaries",
        "vintage": places["vintage"],
    }


def _source_ref() -> dict[str, str]:
    m = _load()["meta"]["places"]
    return {"doc": m["source"], "date": m["vintage"], "status": "verified"}


def suggest(lat: float, lng: float) -> dict[str, Any]:
    """Advisory suggestion for a pin (spec §2 response shape).

    Returns ``{suggestion, reason, confidence, distance_to_boundary_ft,
    warnings, boundary_source}``.  Never touches a scenario.
    """
    layers = _load()
    pt = Point(*_to_ft(lng, lat))
    src = _source_ref()
    vintage = layers["meta"]["places"]["vintage"]

    inside = next((layer for layer in layers["supported"] if layer.prepared.contains(pt)), None)

    warnings: list[dict[str, Any]] = []

    # Neighbors within the warning band — polygons the pin is NOT in
    # (a containing polygon has distance 0 and is reported separately,
    # as the suggestion or as an unsupported_area warning — never as its
    # own neighbor).
    near: list[tuple[float, _Layer]] = []
    for layer in [*layers["supported"], *layers["unsupported"]]:
        if layer.prepared.intersects(pt):
            continue
        d = pt.distance(layer.geom)
        if d < NEAR_BOUNDARY_FT:
            near.append((d, layer))
    near.sort(key=lambda t: t[0])
    for d, layer in near:
        warnings.append(
            {
                "kind": "near_boundary",
                "message": (
                    f"Pin is {max(int(round(d)), 1)} ft from the {layer.name} "
                    "boundary — jurisdiction lines here are jigsawed; verify "
                    "which side the work zone falls on."
                ),
                "source": src,
            }
        )

    if inside is not None:
        own_edge_ft = pt.distance(inside.geom.boundary)
        confidence = "near_boundary" if (near or own_edge_ft < NEAR_BOUNDARY_FT) else "inside"
        return {
            "suggestion": inside.key,
            "reason": (
                f"Pin is inside {inside.name} municipal limits "
                f"(US Census TIGER/Line Place boundaries, {vintage} vintage)."
            ),
            "confidence": confidence,
            "distance_to_boundary_ft": round(own_edge_ft, 1),
            "warnings": warnings,
            "boundary_source": boundary_source(),
        }

    # Not inside any supported polygon.
    in_unsupported = next(
        (layer for layer in layers["unsupported"] if layer.prepared.contains(pt)), None
    )
    county = next((layer for layer in layers["counties"] if layer.prepared.contains(pt)), None)
    nearest_supported = min(
        ((pt.distance(layer.geom), layer) for layer in layers["supported"]),
        key=lambda t: t[0],
    )
    dist_ft, nearest = nearest_supported

    if in_unsupported is not None:
        warnings.insert(
            0,
            {
                "kind": "unsupported_area",
                "message": (
                    f"Pin is in {in_unsupported.name} — not in the supported "
                    "set; baseline rules will apply unless you pick manually."
                ),
                "source": src,
            },
        )
        reason = (
            f"Pin is inside {in_unsupported.name} municipal limits — a "
            "jurisdiction Conestruct does not carry yet "
            f"(US Census TIGER/Line Place boundaries, {vintage} vintage)."
        )
    elif county is not None:
        warnings.insert(
            0,
            {
                "kind": "unsupported_area",
                "message": (
                    f"Pin is in {county.name} County, outside the mapped "
                    "municipal boundaries — not in the supported set; "
                    "baseline rules will apply unless you pick manually."
                ),
                "source": {
                    "doc": layers["meta"]["counties"]["source"],
                    "date": layers["meta"]["counties"]["vintage"],
                    "status": "verified",
                },
            },
        )
        # Honesty (#155): the layer maps metro places plus the supported
        # set, not every municipality in the county — "unincorporated" is
        # a claim this branch cannot make.  Say what we know: the county,
        # and that no MAPPED municipal boundary contains the pin.
        reason = (
            f"Pin is in {county.name} County, outside the municipal "
            f"boundaries Conestruct maps (US Census TIGER/Line, {vintage} "
            "vintage)."
        )
    else:
        reason = (
            "Pin is outside the mapped Denver-metro boundary layer "
            f"(US Census TIGER/Line, {vintage} vintage)."
        )

    # Within the band of a supported city ⇒ suggest it, low confidence —
    # but ONLY when the pin is in no known place.  A pin inside an
    # unsupported municipality (e.g. the Glendale enclave) is
    # affirmatively somewhere else; back-suggesting the neighbor would be
    # exactly the wrong silent guess this endpoint exists to prevent.
    if in_unsupported is None and dist_ft < NEAR_BOUNDARY_FT:
        return {
            "suggestion": nearest.key,
            "reason": (
                f"Pin is {max(int(round(dist_ft)), 1)} ft outside {nearest.name} "
                f"municipal limits (US Census TIGER/Line, {vintage} vintage) — "
                "confirm only if the work zone is actually inside."
            ),
            "confidence": "near_boundary",
            "distance_to_boundary_ft": round(dist_ft, 1),
            "warnings": warnings,
            "boundary_source": boundary_source(),
        }

    return {
        "suggestion": None,
        "reason": reason,
        "confidence": "outside_supported",
        "distance_to_boundary_ft": round(dist_ft, 1),
        "warnings": warnings,
        "boundary_source": boundary_source(),
    }
