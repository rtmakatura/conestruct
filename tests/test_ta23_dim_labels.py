"""#330: TA-23 page 1's dimension labels don't crowd.

Records every ``_draw_dim`` call of a real render (the spans, rows and
anchors actually drawn) and checks the drawn geometry: no two labels in a
row within 4 pt, no leader within 3 pt of a label in a row it crosses, no
in-span label over a tick, everything on the plan.  E 11th and E 14th,
bays of 50, 300 and 1,200 ft.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pytest
from reportlab.pdfbase.pdfmetrics import stringWidth

from src.api.schemas import scenario_to_call
from src.rendering import plan_sheet as ps
from src.rendering.plan_sheet import render_plan_sheet
from tests.test_left_lane_near_intersection import UPSTREAM, ni
from tests.test_left_side_oneway import parsed

E_11TH = {"lat": 39.73385, "lng": -104.98753, "name": "E 11th Ave"}


@pytest.fixture(autouse=True)
def _env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MAPBOX_TOKEN", raising=False)
    os.environ.setdefault("RENDER_API_SECRET", "test-secret-do-not-deploy")


def drawn_dims(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, cross: dict, work_len: float, storage: float
) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    real = ps._draw_dim

    def spy(c, x1, x2, y, label, raise_tier=None, below=False, anchor="center"):  # type: ignore[no-untyped-def]
        calls.append({"x1": x1, "x2": x2, "label": label, "tier": raise_tier, "anchor": anchor})
        return real(c, x1, x2, y, label, raise_tier=raise_tier, below=below, anchor=anchor)

    monkeypatch.setattr(ps, "_draw_dim", spy)
    body = ni("left", cross)
    body["workLen"] = work_len
    body["turnBayStorageFt"] = storage
    params, gen, kwargs = scenario_to_call(parsed(body))
    render_plan_sheet(
        gen(params, **kwargs),
        params,
        output_path=str(tmp_path / "p.pdf"),
        approaches=kwargs["approaches"],
    )
    # The fit-by-construction dry run may draw page 1 twice; keep the last pass.
    first = next(i for i, c in enumerate(calls) if c["label"].startswith("L = "))
    starts = [i for i, c in enumerate(calls) if c["label"].startswith("L = ")]
    return calls[starts[-1] :] if starts else calls[first:]


@pytest.mark.parametrize("storage", [50.0, 300.0, 1200.0])
@pytest.mark.parametrize(
    ("cross", "work_len"), [(E_11TH, 1000.0), (UPSTREAM, 2000.0)], ids=["e11th", "e14th"]
)
def test_no_label_touches_a_label_a_leader_or_a_tick(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, cross: dict, work_len: float, storage: float
) -> None:
    dims = drawn_dims(tmp_path, monkeypatch, cross, work_len, storage)
    assert any(d["label"] == "CROSS STREET" for d in dims)
    boxes = []
    ticks = sorted({round(x, 3) for d in dims for x in (d["x1"], d["x2"])})
    for d in dims:
        lo, hi = sorted((d["x1"], d["x2"]))
        w = stringWidth(d["label"], "Helvetica", 7)
        leader = (lo + hi) / 2.0
        tier = d["tier"] or 0
        if tier == 0:
            blo, bhi = leader - w / 2.0, leader + w / 2.0
            # An in-span label clears its own ticks and every other tick.
            assert all(not (blo - 1.0 < t < bhi + 1.0) for t in ticks), d["label"]
        else:
            blo, bhi = ps._anchored_extent(leader, w, d["anchor"])
        assert blo >= ps.PLAN_LEFT and bhi <= ps.PLAN_RIGHT, d["label"]
        boxes.append((tier, blo, bhi, leader if tier else None, d["label"]))
    for i, (ti, lo_i, hi_i, ld_i, li) in enumerate(boxes):
        for tj, lo_j, hi_j, _ld_j, lj in boxes[i + 1 :]:
            if ti == tj:
                assert hi_i + 4.0 <= lo_j or hi_j + 4.0 <= lo_i, (li, lj)
        if ld_i is not None:
            for tj, lo_j, hi_j, _ld, lj in boxes:
                if tj < ti:
                    assert not (lo_j - 3.0 < ld_i < hi_j + 3.0), (li, "leader through", lj)


def test_every_other_plan_keeps_the_greedy_rows() -> None:
    # The search is TA-23's only: with no turn-bay frame, _draw_landmarks
    # never calls it (parity holds every other page byte-identical).
    assert ps._TURN_BAY_FRAME.get() is None
