"""#314 checkpoint probe: where page 1 puts the shoulder-edge channelizers,
the arrow board, the sidewalk band and the direction arrow, today.

Renders page 1 through the API (TestClient, Overpass stubbed) and records,
from the renderer's own functions: every device's final (x, y) out of
``_layout_device_positions`` with the road outline from ``_road_y_extent``
(same call, same page state), the sidewalk band from ``_draw_strip``, and the
direction arrows from ``_draw_lane_arrow``.  Glyph boxes are the draw
functions' own: cone 8 x 10 pt, drum 10 x 14 pt, arrow board 20 x 12 pt,
each centred on (x, y).  Reports, per case and with / without a sidewalk:
how far each CONE / DRUM box crosses the road outline and the band, every
arrow-board / channelizer overlap, and the direction arrows against the band.
Usage: python page1_probe.py <repo-root>
"""

from __future__ import annotations

import copy
import json
import os
import sys
from pathlib import Path
from typing import Any

ROOT = Path(sys.argv[1]).resolve()
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "probe"
AUTH = {"Authorization": "Bearer probe"}

from fastapi.testclient import TestClient  # noqa: E402

import src.rendering.plan_sheet as ps  # noqa: E402
from src.api.render_api import app  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from src.rules.validators import DeviceType  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]
os.environ.pop("MAPBOX_TOKEN", None)

rec: dict[str, Any] = {}
_orig_layout = ps._layout_device_positions
_orig_strip = ps._draw_strip
_orig_arrow = ps._draw_lane_arrow


def _layout(placements, x_of, station_max_visible, params, shoulder_width_ft, site_flags=None):
    items, lights = _orig_layout(placements, x_of, station_max_visible, params, shoulder_width_ft, site_flags)
    rec["items"] = items
    rec["road"] = ps._road_y_extent(params, shoulder_width_ft)
    return items, lights


def _strip(c, x_left, x_right, y_low, y_high, fill, *a, **kw):
    if fill == ps.SIDEWALK_FILL:
        rec.setdefault("bands", []).append((y_low, y_high))
    return _orig_strip(c, x_left, x_right, y_low, y_high, fill, *a, **kw)


def _arrow(c, x_left, x_right, y, pointing_right=True):
    rec.setdefault("arrows", []).append(y)
    return _orig_arrow(c, x_left, x_right, y, pointing_right)


ps._layout_device_positions = _layout
ps._draw_strip = _strip
ps._draw_lane_arrow = _arrow

FX = ROOT / "tests" / "fixtures"
bw = json.loads((FX / "corridor" / "broadway-sb.json").read_text(encoding="utf-8"))
bw_m = bw["meta"]
cand = bw_m["confirmedRoad"]["candidate"]
bw_m["centerline"] = cand["geometry"]
bw_m["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
bw["carriageway"] = {"oneway": "yes", "highwayClass": "primary", "twinDistanceM": None, "twinSearched": True}
bw["divided"] = False
bw_left = copy.deepcopy(bw)
bw_left["meta"]["work"] = {"side": "left", "travel": "with_geometry"}


def worst(name: str) -> dict[str, Any]:
    return json.loads((FX / "pdf_worst_case" / name).read_text(encoding="utf-8"))["scenario"]


cases = {
    "Broadway one-way, right": bw,
    "Broadway one-way, left": bw_left,
    "two-way undivided (control-typical)": worst("control-typical.json"),
    "divided (adv-shoulder)": worst("adv-shoulder.json"),
}
BOX = {DeviceType.CONE: (8.0, 10.0), DeviceType.DRUM: (10.0, 14.0), DeviceType.ARROW_BOARD: (20.0, 12.0)}


def box(dt, x, y):
    w, h = BOX[dt]
    return (x - w / 2, x + w / 2, y - h / 2, y + h / 2)


def overlap(a, b):
    dx = min(a[1], b[1]) - max(a[0], b[0])
    dy = min(a[3], b[3]) - max(a[2], b[2])
    return (dx, dy) if dx > 0 and dy > 0 else None


client = TestClient(app)
for label, base in cases.items():
    for ped in (False, True):
        body = copy.deepcopy(base)
        body["meta"].setdefault("siteConditions", {})
        body["meta"]["siteConditions"] = {**(body["meta"]["siteConditions"] or {}), "pedestrian_facility": ped}
        rec.clear()
        r = client.post("/render/pdf", headers=AUTH, json=body)
        if r.status_code != 200:
            print(f"== {label}, sidewalk={ped}: HTTP {r.status_code} {r.text[:200]}")
            continue
        y_top, y_bot = min(rec["road"]), max(rec["road"])
        bands = rec.get("bands", [])
        print(f"== {label}, sidewalk={ped}: road outline y {y_top:.1f}..{y_bot:.1f}; "
              f"bands {[(round(a, 1), round(b, 1)) for a, b in bands]}; arrows y {[round(v, 1) for v in rec.get('arrows', [])]}")
        chans = [(p, x, y) for p, x, y in rec["items"] if p.device_type in (DeviceType.CONE, DeviceType.DRUM)]
        boards = [(p, x, y) for p, x, y in rec["items"] if p.device_type == DeviceType.ARROW_BOARD]
        out = []
        for p, x, y in chans:
            b = box(p.device_type, x, y)
            past = max(y_top - b[2], b[3] - y_bot, 0.0)
            on_band = max([max(0.0, min(b[3], hi) - max(b[2], lo)) for lo, hi in bands] or [0.0])
            if past > 0 or on_band > 0:
                out.append(f"{p.device_type.name} st {p.station_ft:g} off {p.offset_ft:g}: "
                           f"{past:.1f} pt past the road outline, {on_band:.1f} pt on the band")
        for line in out:
            print("   " + line)
        if not out:
            print("   every cone / drum box inside the road outline and off the band")
        # Simulated A: each crossing box pulled inside the outline (+0.5 pt);
        # what is left on the band as drawn today (A alone), and on a band
        # that starts at the road edge (A + B: the 1-ft intrusion removed).
        if bands:
            worst_a, worst_ab = 0.0, 0.0
            for p, x, y in chans:
                w, h = BOX[p.device_type]
                cy = min(max(y, y_top + h / 2 + 0.5), y_bot - h / 2 - 0.5)
                b2 = (cy - h / 2, cy + h / 2)
                for lo, hi in bands:
                    worst_a = max(worst_a, min(b2[1], hi) - max(b2[0], lo))
                    # B: the band's inner edge moves to the road outline.
                    if hi > y_bot:  # band below the road (work side at the page bottom)
                        lo2, hi2 = max(lo, y_bot), hi
                    else:
                        lo2, hi2 = lo, min(hi, y_top)
                    worst_ab = max(worst_ab, min(b2[1], hi2) - max(b2[0], lo2))
            print(f"   simulated A alone: worst channelizer on the band {max(worst_a, 0):.1f} pt; "
                  f"A + B: {max(worst_ab, 0):.1f} pt")
        for pb, xb, yb in boards:
            bb = box(DeviceType.ARROW_BOARD, xb, yb)
            for p, x, y in chans:
                o = overlap(bb, box(p.device_type, x, y))
                if o:
                    print(f"   ARROW_BOARD st {pb.station_ft:g} overlaps {p.device_type.name} st "
                          f"{p.station_ft:g} by {o[0]:.1f} x {o[1]:.1f} pt")
        for ay in rec.get("arrows", []):
            for lo, hi in bands:
                if lo - 2 <= ay <= hi + 2:
                    print(f"   direction arrow y {ay:.1f} lies on the band {lo:.1f}..{hi:.1f}")
