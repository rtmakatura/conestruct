"""The laid-out corridor, per approach — one producer for every surface (#290).

Checkpoint (k) commit 7 / P11: "the same five channels on the picker and
page 2".  ``/render/corridor-geometry`` (the picker's overlay) and the plan
sheet's page 2 both draw the corridor from THIS module, so the two can never
disagree about where a zone lies or how many approaches a kind has:

* :func:`laid_out` — THE call that builds a drawn corridor from a plan's
  params (#302): the primary and its approaches, from one argument list
  (:func:`corridor_kwargs`) carrying every length input the generators
  use.  The picker's geometry, page 2 and the band's aerial all call it,
  so no surface builds its corridor from a hand-written list that can
  drift — which is how the work-zone speed went missing.
* :func:`approach_corridors` — the primary corridor and, for a work-start
  flagger, the opposing traffic's (ruling 9: the pin is the closed lane's
  upstream end; the other traffic reaches the work at its far end).
* :func:`zone_spans` — each zone's station span from the anchor, in
  corridor order.
* :func:`zone_parts` — a span's road-following points, split where the
  relayed road geometry ends (#211: footage on the end tangent is flagged
  ``extended``, never a tangent posing as the road — Rule 10).
* :func:`cardinal` — the nearest compass words for a bearing, the side
  control's and the legends' vocabulary (ruling 8).

Nothing here computes a zone LENGTH — those are the corridor's own
(``build_corridor``); this module only walks them.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from src.rules.corridor import (
    WorkCorridor,
    _initial_bearing_deg,
    build_corridor,
    opposing_work_start,
    placed_downstream_taper_ft,
    station_path,
)

# Corridor order, downstream (the anchor, station 0) → upstream.  The
# frontend's lib/corridor-zones.ts ``CORRIDOR_ZONES`` is the same list.
ZONE_ORDER: tuple[str, ...] = (
    "downstream",
    "work_zone",
    "buffer",
    "transition",
    "advance_warning",
)

_CARDINALS: tuple[tuple[str, str], ...] = (
    ("North", "northbound"),
    ("East", "eastbound"),
    ("South", "southbound"),
    ("West", "westbound"),
)


def cardinal(bearing_deg: float) -> tuple[str, str]:
    """The nearest of N / E / S / W, as a side word and a traffic word.

    CHOSEN (#290): the side control's words quantize to the nearest
    cardinal — "East side · northbound traffic" (ruling 8) — the way a
    crew and an 811 ticket say it.  Only the words quantize; the geometry
    each choice writes (``travel`` against the relayed road) is exact.
    """
    return _CARDINALS[int(((bearing_deg % 360.0) + 45.0) // 90.0) % 4]


def zone_spans(c: WorkCorridor) -> list[tuple[str, float, float]]:
    """Each zone's station span, from the anchor, in corridor order."""
    lengths = (
        c.downstream_taper_ft,
        c.work_zone_ft,
        c.buffer_ft,
        c.taper_ft,
        c.advance_warning_ft,
    )
    spans: list[tuple[str, float, float]] = []
    cursor = 0.0
    for name, length in zip(ZONE_ORDER, lengths, strict=True):
        spans.append((name, cursor, cursor + length))
        cursor += length
    return spans


@dataclass(frozen=True)
class PathPart:
    """One drawable run of a zone: road-backed, or on the end tangent."""

    points: list[tuple[float, float]]
    extended: bool


def zone_parts(c: WorkCorridor, a: float, b: float, max_points: int = 100) -> list[PathPart]:
    """The span ``a``–``b``'s points, split at the geometry's two boundaries.

    ``centerline_start_ft`` on the downstream side (a work-start anchor past
    the end of the way) and ``centerline_coverage_ft`` upstream.  No
    centerline: one road-less part — the chord IS the model there.
    """
    coverage = c.centerline_coverage_ft()
    if coverage is None:
        return [PathPart(station_path(c, a, b, max_points), False)]
    start = c.centerline_start_ft() or 0.0
    cuts = [(a, start, True), (max(a, start), min(b, coverage), False), (coverage, b, True)]
    parts: list[PathPart] = []
    for lo, hi, extended in cuts:
        lo, hi = max(lo, a), min(hi, b)
        if hi > lo:
            parts.append(PathPart(station_path(c, lo, hi, max_points), extended))
    return parts or [PathPart(station_path(c, a, b, max_points), True)]


def approach_travel_bearing_deg(c: WorkCorridor) -> float:
    """The direction of travel at a corridor's work start (its upstream edge)."""
    far_end = c.point_at_station_ft(c.downstream_taper_ft + c.work_zone_ft)
    near = c.point_at_station_ft(c.downstream_taper_ft + c.work_zone_ft - 1.0)
    return _initial_bearing_deg(*far_end, *near)


def approach_corridors(
    primary: WorkCorridor,
    *,
    flagger: bool,
    pin_model: str,
    **corridor_kwargs: Any,
) -> list[tuple[str, WorkCorridor]]:
    """``[("primary", primary)]``, plus ``("opposing", …)`` for a work-start flagger.

    ``corridor_kwargs`` are the primary's own ``build_corridor`` arguments
    (speed, work length, closure type, …) so the opposing approach is
    built from the same inputs, at the work's far end, travelling back
    toward the pin (:func:`~src.rules.corridor.opposing_work_start`).
    Raises what ``build_corridor`` raises (``ValueError``).
    """
    corridors = [("primary", primary)]
    if flagger and pin_model == "work_start":
        far_end, opposing_travel = opposing_work_start(primary)
        corridors.append(
            (
                "opposing",
                build_corridor(
                    lat=far_end[0],
                    lng=far_end[1],
                    bearing_deg=opposing_travel,
                    pin_model="work_start",
                    **corridor_kwargs,
                ),
            )
        )
    return corridors


def is_flagger(params: Any) -> bool:
    """The flagger predicate every corridor surface uses (validators' own)."""
    from src.rules.validators import _is_flagger_scenario

    return bool(_is_flagger_scenario(params))


def corridor_kwargs(params: Any, *, placements: Iterable[Any] | None = None) -> dict[str, Any]:
    """The ``build_corridor`` arguments for a plan — the ONE list (#302).

    Every length input the generators use: the speed, the work length, the
    closure (a flagger maps to its one-lane two-way taper, as every surface
    already did), the road type, the widths, the jurisdiction, the relayed
    road, the work-zone speed (the buffer's CDOT step-downs), and — when the
    caller has the layout — the downstream run the plan placed
    (:func:`~src.rules.corridor.placed_downstream_taper_ft`, #257).  Without
    placements the §6B.08 floor, which is what the layout places for every
    enabled kind (the corridor-geometry read has no layout).
    """
    kwargs: dict[str, Any] = {
        "speed_mph": params.speed_mph,
        "work_zone_ft": params.work_zone_length_ft,
        "closure_type": "flagger_alternating_2lane" if is_flagger(params) else params.closure_type,
        "road_type": params.road_type,
        "lane_width_ft": params.lane_width_ft,
        "shoulder_width_ft": params.shoulder_width_ft,
        "jurisdiction": params.jurisdiction,
        "centerline": getattr(params, "centerline", None),
        "work_zone_speed_mph": getattr(params, "work_zone_speed_mph", None),
    }
    if placements is not None:
        kwargs["downstream_taper_ft"] = placed_downstream_taper_ft(placements)
    return kwargs


def primary_corridor(
    params: Any, lat: float, lng: float, *, placements: Iterable[Any] | None = None
) -> WorkCorridor:
    """The plan's own corridor at the pin, from :func:`corridor_kwargs`.

    Raises what ``build_corridor`` raises (``ValueError``).
    """
    return build_corridor(
        lat=lat,
        lng=lng,
        bearing_deg=params.bearing_deg,
        pin_model=str(getattr(params, "pin_model", "corridor_end")),
        **corridor_kwargs(params, placements=placements),
    )


def laid_out_approaches(
    primary: WorkCorridor, params: Any, *, placements: Iterable[Any] | None = None
) -> list[tuple[str, WorkCorridor]]:
    """:func:`approach_corridors` for a plan, from the same argument list."""
    return approach_corridors(
        primary,
        flagger=is_flagger(params),
        pin_model=str(getattr(params, "pin_model", "corridor_end")),
        **corridor_kwargs(params, placements=placements),
    )


def laid_out(
    params: Any, lat: float, lng: float, *, placements: Iterable[Any] | None = None
) -> tuple[WorkCorridor, list[tuple[str, WorkCorridor]]]:
    """The plan's laid-out corridor: ``(primary, approaches)`` (#302, #301).

    ``params`` must carry a bearing (a confirmed side under the work-start
    model).  Raises ``ValueError`` when the corridor cannot be built.
    """
    primary = primary_corridor(params, lat, lng, placements=placements)
    return primary, laid_out_approaches(primary, params, placements=placements)
