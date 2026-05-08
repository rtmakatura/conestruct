"""Pydantic models bridging the TypeScript Scenario JSON to the Python rules engine.

The TS web app (``conestruct/site/lib/scenarios/``) carries a discriminated-
union ``Scenario`` type with members:

  * ``ShoulderScenario`` (TA-2 / S-630-1)
  * ``FlaggerLaneClosureScenario`` (TA-10 / S-630-2)
  * ``LaneClosureDividedScenario`` (TA-19 / S-630-3)

Field names there are camelCase.  This module mirrors that shape
verbatim so JSON arriving from Next.js parses directly, then
``scenario_to_call`` translates it into the flat ``ScenarioParams`` +
generator callable that the rules engine consumes.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from src.generation.layout import (
    generate_flagger_alternating_2lane,
    generate_lane_closure_divided,
    generate_mobile_op_2lane,
    generate_mobile_op_multilane,
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
    generate_work_beyond_shoulder,
)
from src.rules.validators import DevicePlacement, ScenarioParams

# ---------------------------------------------------------------------------
# Pydantic models — mirror TS Scenario exactly (camelCase field names)
# ---------------------------------------------------------------------------


class ScenarioMeta(BaseModel):
    project: str = ""
    address: str = ""
    lat: float = 0.0
    lng: float = 0.0
    # Engineering-style location text shown on the title block (e.g.
    # "I-25 NB, MP 144.5–146, Colorado Springs").  Distinct from
    # ``address`` — that's a geocodable street address used for the
    # aerial embed, while this is human-prose for the LOCATION row.
    locationDescription: str = ""
    # Road compass bearing (0 = N, 90 = E).  When provided, the north
    # arrow on the schematic is rotated so the symbol points to true
    # north relative to the page; otherwise the schematic falls back
    # to "up = north" with a verify-bearing caveat.
    bearingDeg: float | None = None
    # Site-condition flags consumed by src.rules.site_adjustments. Default
    # empty: a missing or empty dict keeps the baseline layout unchanged.
    siteConditions: dict[str, bool] = Field(default_factory=dict)


ShoulderRoadType = Literal["rural_undivided", "rural_divided", "urban_arterial", "freeway"]
FlaggerRoadType = Literal["rural_undivided", "urban_arterial"]
Duration = Literal["short", "long"]
ShoulderWorkType = Literal["utility_locate", "survey", "signal_cabinet", "guardrail", "other"]
FlaggerWorkType = Literal["utility_cut", "water_main", "chip_seal", "patching", "other"]
LaneClosureRoadType = Literal["rural_divided", "freeway"]
LaneClosureWorkType = Literal[
    "pavement_repair",
    "striping",
    "drainage",
    "bridge_deck",
    "guardrail",
    "other",
]
WorkBeyondShoulderRoadType = Literal[
    "rural_undivided", "rural_divided", "urban_arterial", "freeway"
]
WorkBeyondShoulderWorkType = Literal[
    "utility",
    "environmental",
    "landscaping",
    "survey",
    "fence_repair",
    "other",
]
MobileRoadType2Lane = Literal["rural_undivided", "urban_arterial"]
MobileRoadTypeMultilane = Literal["rural_divided", "freeway"]
MobileWorkType = Literal[
    "striping",
    "sweeping",
    "mowing",
    "patching_pothole",
    "crack_seal",
    "sign_maintenance",
    "asphalt_repair",
    "other",
]


class ShoulderScenario(BaseModel):
    kind: Literal["shoulder"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: ShoulderRoadType
    speed: int = Field(ge=20, le=80)
    lanes: int = Field(ge=1, le=6)
    laneWidth: float = Field(ge=8.0, le=14.0)
    divided: bool

    workType: ShoulderWorkType
    duration: Duration
    workLen: float = Field(gt=0.0)
    night: bool


class FlaggerLaneClosureScenario(BaseModel):
    kind: Literal["flagger_lane_closure"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: FlaggerRoadType
    speed: int = Field(ge=20, le=55)
    laneWidth: float = Field(ge=9.0, le=14.0)

    workType: FlaggerWorkType
    duration: Duration
    workLen: float = Field(gt=0.0)
    night: bool

    pilotCar: bool
    afad: bool
    pedestrianAccess: bool


class LaneClosureDividedScenario(BaseModel):
    kind: Literal["lane_closure_divided"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: LaneClosureRoadType
    speed: int = Field(ge=35, le=80)
    laneWidth: float = Field(ge=10.0, le=14.0)

    workType: LaneClosureWorkType
    duration: Duration
    workLen: float = Field(gt=0.0)
    night: bool

    truckMountedAttenuator: bool


class WorkBeyondShoulderScenario(BaseModel):
    kind: Literal["work_beyond_shoulder"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: WorkBeyondShoulderRoadType
    speed: int = Field(ge=20, le=80)
    laneWidth: float = Field(ge=9.0, le=14.0)

    workType: WorkBeyondShoulderWorkType
    duration: Duration
    workLen: float = Field(gt=0.0)
    night: bool


class MobileOp2LaneScenario(BaseModel):
    kind: Literal["mobile_op_2lane"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: MobileRoadType2Lane
    speed: int = Field(ge=25, le=55)
    laneWidth: float = Field(ge=9.0, le=14.0)

    workType: MobileWorkType
    workLen: float = Field(gt=0.0)  # trailing distance to shadow vehicle
    night: bool

    arrowBoardOnShadow: bool


class MobileOpMultilaneScenario(BaseModel):
    kind: Literal["mobile_op_multilane"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: MobileRoadTypeMultilane
    speed: int = Field(ge=45, le=80)
    laneWidth: float = Field(ge=10.0, le=14.0)

    workType: MobileWorkType
    workLen: float = Field(gt=0.0)  # trailing distance to shadow vehicle
    night: bool

    secondTMA: bool


Scenario = Annotated[
    ShoulderScenario
    | FlaggerLaneClosureScenario
    | LaneClosureDividedScenario
    | WorkBeyondShoulderScenario
    | MobileOp2LaneScenario
    | MobileOpMultilaneScenario,
    Field(discriminator="kind"),
]


# ---------------------------------------------------------------------------
# Bridge — Scenario → (ScenarioParams, generator, kwargs)
# ---------------------------------------------------------------------------


GeneratorCall = tuple[
    ScenarioParams,
    Callable[..., list[DevicePlacement]],
    dict,
]


def _map_road_type(road_type: str, speed: int) -> str:
    """Translate TS road-type strings to the Python rules engine vocabulary.

    ``urban_arterial`` resolves by speed: >40 mph → ``urban_high``,
    otherwise ``urban_low``.  Both ``rural_*`` collapse to ``rural``;
    the divided/undivided distinction is carried separately by
    ``is_divided``.

    Raises:
        ValueError: ``road_type`` is the legacy descriptor
            ``"divided_highway"`` (no longer a valid road_type — use
            ``is_divided`` for median presence and pick a Table 6B-1
            speed/access category), or any other unmapped value.
    """
    if road_type == "divided_highway":
        raise ValueError(
            "'divided_highway' is not a valid road_type — divided-ness is "
            "carried separately by ScenarioParams.is_divided.  Use one of "
            "'rural_undivided', 'rural_divided', 'urban_arterial', "
            "'freeway' on the TS side, which map to MUTCD Table 6B-1 "
            "categories ('rural', 'urban_high', 'urban_low', 'freeway')."
        )
    if road_type in ("rural_undivided", "rural_divided"):
        return "rural"
    if road_type == "urban_arterial":
        return "urban_high" if speed > 40 else "urban_low"
    if road_type == "freeway":
        return "freeway"
    raise ValueError(f"unmapped road_type: {road_type!r}")


def _meta_params(meta: ScenarioMeta) -> dict:
    """Extract title-block metadata from a ScenarioMeta as kwargs for
    ScenarioParams.  ``project_name`` defaults to "Untitled Project"
    when the UI sends an empty string so the title block always carries
    a non-empty PROJECT row."""
    return {
        "project_name": meta.project or "Untitled Project",
        "location_description": meta.locationDescription or meta.address or "",
        "bearing_deg": meta.bearingDeg,
    }


def scenario_to_call(scenario: Scenario) -> GeneratorCall:
    """Translate a parsed Scenario into a generator invocation.

    Returns ``(params, generator_fn, kwargs)``.  Call as
    ``placements = generator_fn(params, **kwargs)`` and feed the
    placements to the renderers along with ``params``.
    """
    meta_kw = _meta_params(scenario.meta)

    if isinstance(scenario, ShoulderScenario):
        params = ScenarioParams(
            speed_mph=scenario.speed,
            num_lanes=scenario.lanes,
            closure_type="shoulder",
            road_type=_map_road_type(scenario.roadType, scenario.speed),
            work_zone_length_ft=scenario.workLen,
            lane_width_ft=scenario.laneWidth,
            shoulder_width_ft=10.0 if scenario.divided else 8.0,
            is_night=scenario.night,
            is_divided=scenario.divided,
            jurisdiction="CDOT",
            **meta_kw,
        )
        generator = (
            generate_shoulder_closure_divided
            if scenario.divided
            else generate_shoulder_closure_undivided
        )
        return params, generator, {}

    if isinstance(scenario, FlaggerLaneClosureScenario):
        # 2-lane two-way, alternating flow
        params = ScenarioParams(
            speed_mph=scenario.speed,
            num_lanes=2,
            closure_type="lane",
            road_type=_map_road_type(scenario.roadType, scenario.speed),
            work_zone_length_ft=scenario.workLen,
            lane_width_ft=scenario.laneWidth,
            shoulder_width_ft=8.0,
            is_night=scenario.night,
            is_divided=False,
            jurisdiction="CDOT",
            **meta_kw,
        )
        kwargs = {
            "afad": scenario.afad,
            "pilot_car": scenario.pilotCar,
            "pedestrian_access": scenario.pedestrianAccess,
        }
        return params, generate_flagger_alternating_2lane, kwargs

    if isinstance(scenario, LaneClosureDividedScenario):
        # TA-19, right-lane closed on a divided highway with two lanes
        # per direction.  ``num_lanes=2`` documents the work-side
        # carriageway; the generator hard-codes the 2-per-direction
        # geometry so this is informational rather than load-bearing.
        params = ScenarioParams(
            speed_mph=scenario.speed,
            num_lanes=2,
            closure_type="lane",
            road_type=_map_road_type(scenario.roadType, scenario.speed),
            work_zone_length_ft=scenario.workLen,
            lane_width_ft=scenario.laneWidth,
            shoulder_width_ft=10.0,
            is_night=scenario.night,
            is_divided=True,
            jurisdiction="CDOT",
            **meta_kw,
        )
        return params, generate_lane_closure_divided, {}

    if isinstance(scenario, WorkBeyondShoulderScenario):
        # TA-1: work entirely off the roadway.  ``closure_type="shoulder"``
        # so the renderer draws the shoulder area; the generator emits no
        # devices on the road itself.
        params = ScenarioParams(
            speed_mph=scenario.speed,
            num_lanes=2,
            closure_type="shoulder",
            road_type=_map_road_type(scenario.roadType, scenario.speed),
            work_zone_length_ft=scenario.workLen,
            lane_width_ft=scenario.laneWidth,
            shoulder_width_ft=10.0 if scenario.roadType in ("rural_divided", "freeway") else 8.0,
            is_night=scenario.night,
            is_divided=scenario.roadType in ("rural_divided", "freeway"),
            jurisdiction="CDOT",
            **meta_kw,
        )
        return params, generate_work_beyond_shoulder, {}

    if isinstance(scenario, MobileOp2LaneScenario):
        # TA-35: slow-moving operation on a two-lane road.  ``workLen``
        # carries the trailing distance to the shadow vehicle so the
        # generator can place it.
        params = ScenarioParams(
            speed_mph=scenario.speed,
            num_lanes=2,
            closure_type="lane",
            road_type=_map_road_type(scenario.roadType, scenario.speed),
            work_zone_length_ft=scenario.workLen,
            lane_width_ft=scenario.laneWidth,
            shoulder_width_ft=8.0,
            is_night=scenario.night,
            is_divided=False,
            jurisdiction="CDOT",
            **meta_kw,
        )
        return (
            params,
            generate_mobile_op_2lane,
            {"arrow_board_on_shadow": scenario.arrowBoardOnShadow},
        )

    # MobileOpMultilaneScenario — TA-26
    params = ScenarioParams(
        speed_mph=scenario.speed,
        num_lanes=2,
        closure_type="lane",
        road_type=_map_road_type(scenario.roadType, scenario.speed),
        work_zone_length_ft=scenario.workLen,
        lane_width_ft=scenario.laneWidth,
        shoulder_width_ft=10.0,
        is_night=scenario.night,
        is_divided=True,
        jurisdiction="CDOT",
        **meta_kw,
    )
    return (
        params,
        generate_mobile_op_multilane,
        {"second_tma": scenario.secondTMA},
    )
