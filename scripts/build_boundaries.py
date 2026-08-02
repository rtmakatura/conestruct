"""Build the jurisdiction boundary layer (Endeavor B §1).

Acquire → verify → encode, never assert.  Reads the raw sources cached in
``data/raw/boundaries/``, extracts the needed polygons, simplifies at
~10 m with topology preserved, and writes ``data/boundaries/``:

- ``<key>.geojson``               one file per supported jurisdiction key
- ``places_unsupported.geojson``  metro places we do NOT carry (warning layer)
- ``counties.geojson``            metro counties (unincorporated fallback)
- ``_meta.json``                  provenance: source, vintage, retrieved,
                                  license, simplification_m — per layer

Source selection (the §1.1 acquisition verification, 2026-07-21):

1. Colorado DOLA municipal boundaries (preference #1) — license verified
   Public Domain (data.colorado.gov u943-ics6), currency verified
   (feature service modified 2026-07-17, monthly Socrata refresh) — but
   REJECTED on coverage: the served Denver polygon has ZERO interior
   rings, silently swallowing the Glendale enclave.  That defect is the
   exact trap spec §1.2 names, so DOLA cannot back the suggest layer.
   The rejection is recorded in ``_meta.json``.
2. US Census TIGER/Line 2025 Place + County boundaries (the spec's
   sanctioned fallback) — public domain, current vintage, and verified
   to carry the enclave: TIGER's Denver polygon has 10 interior rings
   and a Glendale interior point tests OUTSIDE Denver.  CHOSEN.

This script HARD-FAILS if the Glendale hole does not survive
simplification (spec §1.2: enclave holes must survive).

Raw inputs expected (downloaded separately, gitignored):
- data/raw/boundaries/tl_2025_08_place.zip   (TIGER2025 Colorado places)
- data/raw/boundaries/tl_2025_us_county.zip  (TIGER2025 national counties)

Usage (venv):  python scripts/build_boundaries.py
"""

from __future__ import annotations

import io
import json
import zipfile
from pathlib import Path

import shapefile  # pyshp
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "boundaries"
OUT = ROOT / "data" / "boundaries"

# Supported set = the picker keys that have a place polygon.
# (cdot and e470 are road/corridor authorities — phase B2 layers.)
# Greeley + Thornton added for #155: their rule records shipped in
# data/jurisdictions/ but neither was reachable — no polygon here, no
# picker entry.  Same TIGER 2025 vintage; no re-download.
SUPPORTED: dict[str, str] = {
    "denver": "Denver",
    "lakewood": "Lakewood",
    "englewood": "Englewood",
    "littleton": "Littleton",
    "centennial": "Centennial",
    "parker": "Parker",
    "greeley": "Greeley",
    "thornton": "Thornton",
}

# Metro places we do NOT carry: the warning layer (spec §2
# ``unsupported_area``) and near-boundary neighbor naming.  Includes the
# Glendale enclave and every place adjacent to a supported city.
UNSUPPORTED: dict[str, str] = {
    "glendale": "Glendale",
    "aurora": "Aurora",
    "greenwood_village": "Greenwood Village",
    "cherry_hills_village": "Cherry Hills Village",
    "sheridan": "Sheridan",
    "bow_mar": "Bow Mar",
    "columbine_valley": "Columbine Valley",
    "lone_tree": "Lone Tree",
    "foxfield": "Foxfield",
    "castle_pines": "Castle Pines",
    "castle_rock": "Castle Rock",
    "westminster": "Westminster",
    "wheat_ridge": "Wheat Ridge",
    "edgewater": "Edgewater",
    "mountain_view": "Mountain View",
    "lakeside": "Lakeside",
    "arvada": "Arvada",
    "golden": "Golden",
    "morrison": "Morrison",
    "commerce_city": "Commerce City",
    "broomfield": "Broomfield",
    "northglenn": "Northglenn",
    "federal_heights": "Federal Heights",
}

# Incorporated-place LSAD codes (city / town) — excludes CDPs, which are
# statistical, not jurisdictional.
INCORPORATED_LSAD = {"25", "43"}

# TIGER county FIPS (STATEFP 08) for the metro fallback layer, plus the
# counties of the authored non-metro jurisdiction records.
COUNTIES: dict[str, str] = {
    "031": "Denver",
    "005": "Arapahoe",
    "059": "Jefferson",
    "035": "Douglas",
    "001": "Adams",
    "014": "Broomfield",
    "041": "El Paso",
    "123": "Weld",
    "069": "Larimer",
}

# ~10 m expressed in degrees of latitude (1° lat ≈ 111,320 m).  Longitude
# degrees are shorter at Denver's latitude, so the true tolerance is ≤10 m.
SIMPLIFY_M = 10
SIMPLIFY_DEG = SIMPLIFY_M / 111_320

# Denver-metro anchor for disambiguating duplicate place names statewide.
METRO_ANCHOR = (-104.99, 39.74)


def _reader(zip_name: str, base: str) -> tuple[shapefile.Reader, list[str]]:
    zf = zipfile.ZipFile(RAW / zip_name)
    r = shapefile.Reader(
        shp=io.BytesIO(zf.read(f"{base}.shp")),
        dbf=io.BytesIO(zf.read(f"{base}.dbf")),
        shx=io.BytesIO(zf.read(f"{base}.shx")),
    )
    return r, [f[0] for f in r.fields[1:]]


def _clean(g):
    if not g.is_valid:
        g = g.buffer(0)
    s = g.simplify(SIMPLIFY_DEG, preserve_topology=True)
    return s if s.is_valid else s.buffer(0)


def place_geoms() -> dict[str, object]:
    """Extract every needed incorporated place from TIGER CO places."""
    wanted = {**SUPPORTED, **UNSUPPORTED}
    by_name: dict[str, list] = {}
    reader, fields = _reader("tl_2025_08_place.zip", "tl_2025_08_place")
    for sr in reader.iterShapeRecords():
        rec = dict(zip(fields, sr.record, strict=False))
        if rec["NAME"] in wanted.values() and rec["LSAD"] in INCORPORATED_LSAD:
            by_name.setdefault(rec["NAME"], []).append(shape(sr.shape.__geo_interface__))
    out: dict[str, object] = {}
    ax, ay = METRO_ANCHOR
    for key, name in wanted.items():
        matches = by_name.get(name, [])
        if not matches:
            raise SystemExit(f"GATE FAILED: no incorporated place named {name!r}")
        if len(matches) > 1:
            # Duplicate name statewide — keep the metro one and say so.
            matches.sort(key=lambda g: (g.centroid.x - ax) ** 2 + (g.centroid.y - ay) ** 2)
            print(
                f"note: {name!r} matches {len(matches)} places statewide — "
                "kept the Denver-metro one"
            )
        out[key] = _clean(matches[0])
    return out


def county_geoms() -> dict[str, object]:
    """Extract the metro counties from the TIGER national shapefile."""
    reader, fields = _reader("tl_2025_us_county.zip", "tl_2025_us_county")
    out: dict[str, object] = {}
    for sr in reader.iterShapeRecords():
        rec = dict(zip(fields, sr.record, strict=False))
        if rec["STATEFP"] == "08" and rec["COUNTYFP"] in COUNTIES:
            out[COUNTIES[rec["COUNTYFP"]]] = _clean(shape(sr.shape.__geo_interface__))
    missing = set(COUNTIES.values()) - set(out)
    if missing:
        raise SystemExit(f"GATE FAILED: TIGER extract missing counties {missing}")
    return out


def feature(geom, props: dict) -> dict:
    return {"type": "Feature", "properties": props, "geometry": mapping(geom)}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    places = place_geoms()
    supported = {k: places[k] for k in SUPPORTED}
    unsupported = {k: places[k] for k in UNSUPPORTED}

    # --- Verification gates (encode nothing that fails these) ---------
    glendale_pt = unsupported["glendale"].representative_point()
    if supported["denver"].contains(glendale_pt):
        raise SystemExit(
            "GATE FAILED: Glendale enclave hole did not survive — a point "
            "inside Glendale tests inside Denver.  Do not ship this data."
        )
    # Denver's OUTLINE must still surround Glendale (i.e. the hole exists
    # rather than Denver merely ending nearby).
    denver_outline = unary_union(
        [Polygon(p.exterior) for p in getattr(supported["denver"], "geoms", [supported["denver"]])]
    )
    if not denver_outline.contains(glendale_pt):
        raise SystemExit(
            "GATE FAILED: Glendale is not inside Denver's outline — wrong "
            "Glendale extracted or Denver geometry broken."
        )
    for key, g in places.items():
        if g.is_empty or not g.is_valid:
            raise SystemExit(f"GATE FAILED: invalid/empty geometry for {key}")

    counties = county_geoms()

    # --- Encode --------------------------------------------------------
    for key, g in supported.items():
        (OUT / f"{key}.geojson").write_text(
            json.dumps(feature(g, {"key": key, "name": SUPPORTED[key]})),
            encoding="utf-8",
        )
    (OUT / "places_unsupported.geojson").write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    feature(g, {"key": key, "name": UNSUPPORTED[key]})
                    for key, g in unsupported.items()
                ],
            }
        ),
        encoding="utf-8",
    )
    (OUT / "counties.geojson").write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [feature(g, {"name": name}) for name, g in counties.items()],
            }
        ),
        encoding="utf-8",
    )

    meta = {
        "places": {
            "source": "US Census TIGER/Line 2025 Place boundaries, Colorado (tl_2025_08_place.zip)",
            "publisher": "US Census Bureau",
            "license": "Public domain (US federal government work)",
            "vintage": "2025",
            "retrieved": "2026-07-21",
            "simplification_m": SIMPLIFY_M,
            "verification": (
                "Enclave gate: TIGER Denver carries 10 interior rings; a "
                "Glendale interior point tests OUTSIDE Denver, before and "
                "after 10 m simplification (scripts/build_boundaries.py "
                "hard-fails otherwise)."
            ),
            "sources_evaluated": {
                "dola_municipal_boundaries": {
                    "dataset": (
                        "Colorado DOLA municipal boundaries — Geospatial "
                        "Portal feature service DOLA_Municipalities (ArcGIS "
                        "item b02e634e5cfd4c32b1852e9fc4ba0012) / "
                        "data.colorado.gov u943-ics6"
                    ),
                    "license": "Public Domain (verified, licenseId PUBLIC_DOMAIN)",
                    "currency": (
                        "verified current — service modified 2026-07-17, "
                        "Socrata mirror auto-updates monthly"
                    ),
                    "verdict": "REJECTED on coverage",
                    "reason": (
                        "Served Denver polygon has zero interior rings — the "
                        "Glendale enclave is silently absorbed (a Glendale "
                        "interior point tested INSIDE Denver).  DOLA also "
                        "self-describes as 'a best effort compilation and "
                        "not an authoritative or official source'."
                    ),
                },
            },
        },
        "counties": {
            "source": "US Census TIGER/Line 2025 County boundaries (tl_2025_us_county.zip)",
            "publisher": "US Census Bureau",
            "license": "Public domain (US federal government work)",
            "vintage": "2025",
            "retrieved": "2026-07-21",
            "simplification_m": SIMPLIFY_M,
        },
        "display_note": (
            "Boundary data is approximate — confirm jurisdiction with the permitting authority."
        ),
    }
    (OUT / "_meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    sizes = {p.name: p.stat().st_size for p in sorted(OUT.iterdir())}
    print(json.dumps(sizes, indent=2))
    print("verification gates passed (Glendale enclave hole intact)")


if __name__ == "__main__":
    main()
