"""Pydantic models bridging the TypeScript Scenario JSON to the Python rules engine.

The TS web app (``conestruct/site/lib/scenarios/``) carries a discriminated-
union ``Scenario`` type with members:

  * ``ShoulderScenario`` (TA-3, TA-5 on freeways / S-630-1)
  * ``FlaggerLaneClosureScenario`` (TA-10 / S-630-1 Cases 17 & 42)
  * ``LaneClosureDividedScenario`` (TA-19 / S-630-3)

Field names there are camelCase.  This module mirrors that shape
verbatim so JSON arriving from Next.js parses directly, then
``scenario_to_call`` translates it into the flat ``ScenarioParams`` +
generator callable that the rules engine consumes.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated, Literal, Self

from pydantic import BaseModel, Field, model_validator

from src.generation.layout import (
    generate_flagger_alternating_2lane,
    generate_lane_closure_divided,
    generate_mobile_op_2lane,
    generate_mobile_op_multilane,
    generate_near_intersection,
    generate_shoulder_closure_divided,
    generate_shoulder_closure_undivided,
    generate_work_beyond_shoulder,
)
from src.rules.validators import ApproachParams, DevicePlacement, ScenarioParams

# ---------------------------------------------------------------------------
# Pydantic models — mirror TS Scenario exactly (camelCase field names)
# ---------------------------------------------------------------------------

# Upper bound for ``workLen`` on every scenario kind, matching the
# ``DetectSiteRequest.work_zone_ft`` cap (render_api.py).  20,000 ft is
# ~3.8 miles — beyond any single-plan work zone.  Without a ceiling,
# ``workLen=Infinity`` passed validation and died as an OverflowError
# (HTTP 500) in the plaque math, and large finite values silently
# generated hundreds of thousands of device placements.  Mirrored in
# conestruct/site/lib/scenarios/validation.ts (MAX_WORK_LEN_FT).
WORK_LEN_MAX_FT = 20000.0

# Widest half-road (work-direction lanes + shoulder, in ft) the plan
# sheet can draw at its fixed 3.5 pt/ft vertical scale.  Verified
# empirically: at 52 ft (e.g. 3 lanes x 14 ft + 10 ft shoulder) the
# sheet renders cleanly; beyond it the road collides with the title
# block and dimension callouts.  Shoulder width is derived in the
# bridge (10 ft divided / 8 ft undivided).  Mirrored in
# conestruct/site/lib/scenarios/validation.ts (MAX_DRAWABLE_HALF_ROAD_FT).
MAX_DRAWABLE_HALF_ROAD_FT = 52.0


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
    # Spec §4.1 (issue #150): the on-sheet device summary is on by default;
    # jurisdictions whose record carries requires=on_sheet_device_summary
    # render it regardless of this toggle.
    includeDeviceSummary: bool = True


# ---------------------------------------------------------------------------
# Jurisdiction-layer extension (phase1-backend-spec §3.1) — additive, all
# optional, snake_case (the spec's casing decision §1.1 #1; the TS side
# adapts).  Absent ⇒ current behavior, untouched: no jurisdiction block is
# computed and the plan renders exactly as today (baseline-only).
# ---------------------------------------------------------------------------


class WorkSchedule(BaseModel):
    """When the work happens — consumed by the jurisdiction hours evaluation.

    ``start_time``/``end_time`` are decimal hours (8.5 = 8:30 AM), same
    convention as the jurisdiction data files' hours windows.
    """

    date_mode: Literal["single", "range", "tbd"]
    work_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    work_date_end: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: float | None = Field(default=None, ge=0.0, le=24.0)
    end_time: float | None = Field(default=None, ge=0.0, le=24.0)

    @model_validator(mode="after")
    def _check_time_order(self) -> Self:
        if (
            self.start_time is not None
            and self.end_time is not None
            and self.end_time <= self.start_time
        ):
            raise ValueError(
                f"schedule end_time ({self.end_time}) must be after start_time "
                f"({self.start_time}) — overnight schedules are not supported yet."
            )
        return self


class JurisdictionScenarioFields(BaseModel):
    """Mixin adding the optional jurisdiction-layer fields to every kind."""

    jurisdiction_key: str | None = None
    street_class: Literal["local", "collector", "arterial"] | None = None
    schedule: WorkSchedule | None = None


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


class ShoulderScenario(JurisdictionScenarioFields):
    kind: Literal["shoulder"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: ShoulderRoadType
    # Speed domain mirrors MUTCD Table 6B-2: the rules engine resolves
    # buffer space only for multiples of 5 in 20..75 mph.  Constraining
    # here turns out-of-domain inputs (OSM km/h conversions like 62,
    # 80-mph rural tags) into a clean 422 instead of a 500 deep in the
    # table lookup (audit fix B-04).  Same grid on every kind below.
    speed: int = Field(ge=20, le=75, multiple_of=5)
    # Lanes per direction on the work side (same semantics as
    # ``ScenarioParams.num_lanes``).  Capped at 4: even at the 8-ft
    # minimum lane width, 5+ lanes exceed MAX_DRAWABLE_HALF_ROAD_FT
    # (cross-checked against laneWidth below).
    lanes: int = Field(ge=1, le=4)
    laneWidth: float = Field(ge=8.0, le=14.0)
    divided: bool

    workType: ShoulderWorkType
    duration: Duration
    workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)
    night: bool
    # Optional work-zone speed limit when reduced below ``speed``.  None
    # / omitted means no reduction.  Equal to ``speed`` is accepted and
    # normalized to None at the bridge (``scenario_to_call``).  Strictly
    # greater than ``speed`` is rejected below.  Same Table 6B-2 grid as
    # ``speed`` — posted limits are multiples of 5, and the stepped
    # W3-5 advisory math assumes the 5-mph grid.
    workZoneSpeed: int | None = Field(default=None, ge=20, le=75, multiple_of=5)
    # Detection relay (issue #136) — the raw OSM total-lane count of the
    # roadway as detected by the frontend, BEFORE the per-direction halving
    # that fills ``lanes``.  A pure relayed fact: it drives no geometry and
    # no label.  Its sole consumer is the single-lane eligibility gate
    # (``_ensure_lane_eligible`` in render_api): the per-direction ``lanes``
    # model has no honest representation of a road with one lane total
    # (``lanes=1`` already means the classic 2-lane two-way road), so a
    # genuinely single-lane undivided road is refused rather than silently
    # drawn as 2-lane (rule 10).  None / omitted means "no detection
    # signal" and never blocks — direct API callers and manual entry are
    # unaffected.  The frontend clears it when the operator corrects the
    # lane count, lifting the block.
    detectedLanesTotal: int | None = Field(default=None, ge=1)
    # Detection relays (issue #120) — the parsed OSM ``lanes:forward`` /
    # ``lanes:backward`` / ``lanes:both_ways`` tag values, relayed unchanged
    # (pure facts; they drive no geometry and no label).  Sole consumer is
    # the lane-count consistency check (``lanes_arithmetic_mismatch``
    # below): when total, forward, and backward all exist and
    # total != forward + backward + both_ways, the OSM lane data
    # contradicts itself and the detected count can't be trusted.  On this
    # kind the check only feeds the audit's non-blocking "verify lane
    # count" caution — never a block.  None / omitted means "no detection
    # signal" and the check never fires; the frontend clears all of them
    # when the operator edits the lane count.
    detectedLanesForward: int | None = Field(default=None, ge=1)
    detectedLanesBackward: int | None = Field(default=None, ge=1)
    detectedLanesBothWays: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def _check_work_zone_speed(self) -> Self:
        if self.workZoneSpeed is not None and self.workZoneSpeed > self.speed:
            raise ValueError(
                f"workZoneSpeed ({self.workZoneSpeed}) must be <= posted speed ({self.speed})."
            )
        return self

    @model_validator(mode="after")
    def _check_drawable_road_width(self) -> Self:
        # Mirrored in conestruct/site/lib/scenarios/validation.ts.
        shoulder_ft = 10.0 if self.divided else 8.0
        half_road = self.lanes * self.laneWidth + shoulder_ft
        if half_road > MAX_DRAWABLE_HALF_ROAD_FT:
            max_width = (MAX_DRAWABLE_HALF_ROAD_FT - shoulder_ft) / self.lanes
            raise ValueError(
                f"{self.lanes} lanes x {self.laneWidth} ft + {shoulder_ft:.0f} ft shoulder "
                f"= {half_road:.1f} ft exceeds the plan sheet's drawable half-road "
                f"({MAX_DRAWABLE_HALF_ROAD_FT:.0f} ft) — use a lane width of "
                f"{max_width:.1f} ft or less, or reduce the lane count."
            )
        return self


class FlaggerLaneClosureScenario(JurisdictionScenarioFields):
    kind: Literal["flagger_lane_closure"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: FlaggerRoadType
    speed: int = Field(ge=20, le=55, multiple_of=5)
    laneWidth: float = Field(ge=9.0, le=14.0)

    workType: FlaggerWorkType
    duration: Duration
    workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)
    night: bool

    pilotCar: bool
    afad: bool
    pedestrianAccess: bool
    # Detection relay (issue #136) — raw OSM total-lane count; see the
    # matching field on ``ShoulderScenario``.  A flagger is always
    # undivided (TA-10, one lane each direction), so a detected total of 1
    # is genuinely single-lane and refused by ``_ensure_lane_eligible``.
    detectedLanesTotal: int | None = Field(default=None, ge=1)
    # Detection relay (issue #158) — the raw OSM ``oneway`` tag value of the
    # detected road, relayed unchanged (a pure fact; drives no geometry or
    # label).  Its sole consumer is the directionality eligibility gate
    # (``_ensure_direction_eligible`` in render_api): a flagger operation
    # (TA-10) alternates traffic through one open lane between two OPPOSING
    # directions, so on a one-way road there is no opposing direction to
    # hold and the template would direct traffic that isn't there (rule 10)
    # — the gate refuses the tag values that mean one-directional
    # (``yes``/``-1``/``reversible``).  ``no`` / None / omitted means "two-way
    # or no detection signal" and never blocks — direct API callers and
    # manual entry are unaffected.  The frontend clears it when the operator
    # confirms the road carries two-way traffic, lifting the block.
    oneway: str | None = Field(default=None)
    # Detection relays (issue #120) — see the matching fields on
    # ``ShoulderScenario``.  Audit-caution-only on this kind (a flagger has
    # no lane field to correct); never blocks.
    detectedLanesForward: int | None = Field(default=None, ge=1)
    detectedLanesBackward: int | None = Field(default=None, ge=1)
    detectedLanesBothWays: int | None = Field(default=None, ge=1)


class LaneClosureDividedScenario(JurisdictionScenarioFields):
    kind: Literal["lane_closure_divided"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: LaneClosureRoadType
    speed: int = Field(ge=35, le=75, multiple_of=5)
    laneWidth: float = Field(ge=10.0, le=14.0)

    workType: LaneClosureWorkType
    duration: Duration
    workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)
    night: bool

    truckMountedAttenuator: bool


class WorkBeyondShoulderScenario(JurisdictionScenarioFields):
    kind: Literal["work_beyond_shoulder"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: WorkBeyondShoulderRoadType
    speed: int = Field(ge=20, le=75, multiple_of=5)
    laneWidth: float = Field(ge=9.0, le=14.0)

    workType: WorkBeyondShoulderWorkType
    duration: Duration
    workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)
    night: bool


class MobileOp2LaneScenario(JurisdictionScenarioFields):
    kind: Literal["mobile_op_2lane"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: MobileRoadType2Lane
    speed: int = Field(ge=25, le=55, multiple_of=5)
    laneWidth: float = Field(ge=9.0, le=14.0)

    workType: MobileWorkType
    workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)  # trailing distance to shadow vehicle
    night: bool

    arrowBoardOnShadow: bool


class MobileOpMultilaneScenario(JurisdictionScenarioFields):
    kind: Literal["mobile_op_multilane"]
    meta: ScenarioMeta = ScenarioMeta()

    roadType: MobileRoadTypeMultilane
    speed: int = Field(ge=45, le=75, multiple_of=5)
    laneWidth: float = Field(ge=10.0, le=14.0)

    workType: MobileWorkType
    workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)  # trailing distance to shadow vehicle
    night: bool

    secondTMA: bool


IntersectionRoadType = Literal["rural_undivided", "urban_arterial"]
# Phase 1 scope: S-630-1 Cases 18/19 are undivided/arterial plates.
# Freeway at-grade intersections are rare and rural_divided adds the
# median-opening question — both deferred; the Literal is the gate.
ApproachRoadType = Literal["rural_undivided", "urban_arterial"]
IntersectionWorkType = Literal[
    "utility_cut",
    "water_main",
    "patching",
    "signal_work",
    "other",
]


class IntersectionApproach(BaseModel):
    """One cross-street leg entering the intersection.

    An ordinary 4-leg intersection contributes TWO approaches (the two
    cross-street directions of travel toward the intersection); a
    T-intersection contributes one.  The mainline is never in this
    list — it is the scenario's top-level fields, id ``"mainline"``.
    """

    # Stable identifier, referenced by DevicePlacement.approach_id and
    # by the per-approach audit nesting.  "mainline" is reserved for
    # the scenario's primary road — enforced by the validator below
    # (pydantic-core's regex engine has no look-ahead, so the
    # reservation can't live in the pattern).
    id: str = Field(pattern=r"^[a-z][a-z0-9_]{0,31}$")

    @model_validator(mode="after")
    def _check_id_not_reserved(self) -> Self:
        if self.id == "mainline":
            raise ValueError(
                'approach id "mainline" is reserved for the scenario\'s '
                "primary road — pick another id for the cross street."
            )
        return self

    # Floor 25 per the increment-1 ruling — matching the enabled kinds'
    # form floor, not the Table 6B-2 grid floor (the tables serve 20 mph,
    # but that wider bound was offered and declined).  Cap 55 matches the
    # mainline cap below (D8 — Cases 18/19 are arterial/local plates).
    speed: int = Field(ge=25, le=55, multiple_of=5)
    roadType: ApproachRoadType
    # Same semantics as ScenarioParams.num_lanes: lanes PER DIRECTION.
    # Capped at 4 like every kind's lane count.
    lanesPerDirection: int = Field(ge=1, le=4)
    laneWidth: float = Field(ge=9.0, le=14.0)

    # Flag-and-cite only (#117 signal posture): True emits a
    # pending_verification item citing §6N.12.04 (signal review per
    # Part 4) and §6N.12.05 (jurisdiction contact).  No signal math.
    signalized: bool

    # Compass bearing of the approach's direction of travel toward the
    # intersection (0 = N, 90 = E).  Drawing/geo overlay only; the
    # rules math never reads it.
    bearingDeg: float | None = None

    # Where this approach's road centerline crosses the mainline
    # station axis, in the SAME frame as DevicePlacement.station_ft
    # (0 = downstream end of the work zone, increasing upstream).
    # Both approaches of one cross street carry the same value.
    # Near/far side derives from it: < 0 → intersection downstream of
    # the work → near-side work per §6N.12.08 (its Fig. 6P-21 draws
    # the situation as a center-lane variant; the emitted right-lane
    # train is Fig. 6P-22's near-side approach); > workLen →
    # intersection upstream → far-side work (§6N.12.12).  Values
    # inside [0, workLen] are rejected on the scenario (in-intersection
    # work is Phase 2).  Bounds keep the value finite and inside the
    # same envelope as workLen itself.
    alongStationFt: float = Field(ge=-WORK_LEN_MAX_FT, le=WORK_LEN_MAX_FT)

    # Detection relays (issue #120) — the parsed OSM lane tags of the
    # cross-street way (raw total plus per-direction and center-turn-lane
    # counts), relayed unchanged.  Sole consumer is the lane-count
    # consistency gate (``_ensure_lane_confidence`` in render_api): when
    # total != forward + backward + both_ways the OSM lane data
    # contradicts itself, the detected approach lane count can't be
    # trusted, and generation is refused with an honest 400 (Ruling B,
    # #120 — intersection approaches get the hard gate).  None / omitted
    # means "no detection signal" and never blocks — direct API callers
    # and manual entry are unaffected.  The frontend clears all four when
    # the operator confirms or edits the approach lane count.
    detectedLanesTotal: int | None = Field(default=None, ge=1)
    detectedLanesForward: int | None = Field(default=None, ge=1)
    detectedLanesBackward: int | None = Field(default=None, ge=1)
    detectedLanesBothWays: int | None = Field(default=None, ge=1)


class NearIntersectionScenario(JurisdictionScenarioFields):
    """Work near (not within) an intersection — S-630-1 Cases 18/19.

    GATED: absent from ``ENABLED_SCENARIOS`` (render_api.py) and from
    the frontend mirror; requests return the standard gated-kind 400.
    Option C (#117): cross-street control is computed into the device
    list / quote / narrative / audit; the plan sheet cites the S-630-1
    plate instead of drawing the intersection.  The kind name is
    side-neutral — near-side vs. far-side work is DERIVED from each
    approach's ``alongStationFt``, never an input flag.
    """

    kind: Literal["near_intersection"]
    meta: ScenarioMeta = ScenarioMeta()

    # --- mainline: same field set and bounds as ShoulderScenario,
    # speed capped at 55 like the flagger kind (D8); floor 25 per the
    # increment-1 ruling (same as the approach floor above) ---
    roadType: IntersectionRoadType
    speed: int = Field(ge=25, le=55, multiple_of=5)
    lanes: int = Field(ge=1, le=4)  # per direction, as everywhere
    laneWidth: float = Field(ge=9.0, le=14.0)
    divided: bool  # Phase 1: must be False (validator below)

    workType: IntersectionWorkType
    duration: Duration
    workLen: float = Field(gt=0.0, le=WORK_LEN_MAX_FT)
    night: bool

    # min 1 (a T-intersection), max 2 (one cross street, both legs).
    # A second cross street inside one work zone is multi-road scope;
    # raising the max is a deliberate, schema-visible act.
    approaches: list[IntersectionApproach] = Field(min_length=1, max_length=2)

    @model_validator(mode="after")
    def _check_not_divided(self) -> Self:
        if self.divided:
            raise ValueError(
                "divided intersections are not supported yet — Cases 18/19 "
                "are undivided/arterial plates; a divided mainline adds the "
                "median-opening question (deferred)."
            )
        return self

    @model_validator(mode="after")
    def _check_approach_ids_unique(self) -> Self:
        ids = [a.id for a in self.approaches]
        if len(set(ids)) != len(ids):
            raise ValueError(f"approach ids must be unique, got {ids}")
        return self

    @model_validator(mode="after")
    def _check_intersection_outside_work_zone(self) -> Self:
        # Phase 1 is Cases 18/19: work NEAR an intersection.  Work
        # within the intersection interior (MUTCD Figures 6P-26/27,
        # §6N.12.14-16) is out of scope — a clean 422 here, not a
        # silently-wrong near-side plan (rule 10).
        for a in self.approaches:
            if 0.0 <= a.alongStationFt <= self.workLen:
                raise ValueError(
                    f"approach {a.id!r}: the cross street crosses inside the "
                    f"work zone (alongStationFt={a.alongStationFt:g}, work "
                    f"zone spans 0..{self.workLen:g}).  Work within the "
                    f"intersection (MUTCD Figures 6P-26/27) is not supported."
                )
        return self

    @model_validator(mode="after")
    def _check_drawable_road_width(self) -> Self:
        # Mainline only: under Option C the cross street is never drawn
        # (the sheet cites the S-630-1 plate), so the drawable bound
        # does not apply to approaches.  Same check as ShoulderScenario,
        # undivided 8-ft shoulder.
        shoulder_ft = 8.0
        half_road = self.lanes * self.laneWidth + shoulder_ft
        if half_road > MAX_DRAWABLE_HALF_ROAD_FT:
            max_width = (MAX_DRAWABLE_HALF_ROAD_FT - shoulder_ft) / self.lanes
            raise ValueError(
                f"{self.lanes} lanes x {self.laneWidth} ft + {shoulder_ft:.0f} ft shoulder "
                f"= {half_road:.1f} ft exceeds the plan sheet's drawable half-road "
                f"({MAX_DRAWABLE_HALF_ROAD_FT:.0f} ft) — use a lane width of "
                f"{max_width:.1f} ft or less, or reduce the lane count."
            )
        return self


Scenario = Annotated[
    ShoulderScenario
    | FlaggerLaneClosureScenario
    | LaneClosureDividedScenario
    | WorkBeyondShoulderScenario
    | MobileOp2LaneScenario
    | MobileOpMultilaneScenario
    | NearIntersectionScenario,
    Field(discriminator="kind"),
]


def lanes_arithmetic_mismatch(
    total: int | None,
    forward: int | None,
    backward: int | None,
    both_ways: int | None,
) -> bool:
    """The #120 lane-count consistency predicate — the ONE definition.

    True when the OSM lane tags contradict themselves: ``lanes``,
    ``lanes:forward``, and ``lanes:backward`` all exist and
    ``total != forward + backward + both_ways`` (``lanes:both_ways`` is a
    center turn lane / TWLTL and counts toward the total on a correctly
    tagged road; treating it as 0 only when absent).  Without the
    both_ways term the check would flag most correctly-tagged
    center-turn-lane arterials — a Denver-metro Overpass survey
    (2026-07-27) measured 13.3% of fully-lane-tagged ways as naive
    mismatches but only 1.28% once both_ways is honored, and the residue
    is genuine data defects.

    Any of total/forward/backward absent ⇒ indeterminate ⇒ False — the
    relay-omitted case never fires, so direct API callers and manual
    entry are unaffected (the #136/#158 principle).

    DELIBERATELY NARROWER than the frontend ``lanesSuspicion`` heuristic
    (conestruct/site/lib/road-detection/cross-street.ts), which also
    keys on ``turn:lanes*`` presence for confirm-copy purposes.
    Turn-lane tags belong to the whole way, not the work location, so
    they are excluded here by ruling (#120, 2026-07-27) — do not widen
    this to match the frontend.

    Consumers: ``_ensure_lane_confidence`` (render_api — honest 400 on
    near_intersection approaches) and the audit's non-blocking "verify
    lane count" caution (audit_projection).
    """
    if total is None or forward is None or backward is None:
        return False
    return total != forward + backward + (both_ways or 0)


def flagger_lane_ineligible_high(
    total: int | None,
    forward: int | None,
    backward: int | None,
    both_ways: int | None,
) -> bool:
    """The #86 flagger multi-lane eligibility ceiling — the ONE definition.

    True when the detected road carries more lanes than a flagger
    alternating operation (TA-10) covers.  Eligibility is geometric, not
    classificational (#86 ruling, 2026-07-27): TA-10 applies where one
    through lane runs in each direction — MUTCD Figure 6P-10 "Lane
    Closure on a Two-Lane Road Using Flaggers" — and no source draws a
    flagger-alternating typical for a road with two or more lanes per
    direction.  MUTCD §6N.11 "Work within the Traveled Way of a
    Multi-Lane, Non-Access Controlled Highway" (11th Ed., printed p. 847
    / PDF p. 83) routes those roads to the merge-taper closure family:
    "When a lane is closed on a multi-lane road for other than a mobile
    operation, a transition area containing a merging taper shall be
    used." (Standard, ¶03).

    The ceiling (#86 plan, approved 2026-07-27):

    - total >= 4 — two or more through lanes somewhere under any real
      tagging.  Refused unconditionally.
    - total == 3 — eligible ONLY when the relays decompose consistently
      as one through lane each way plus a center turn lane
      (forward == 1 and backward == 1 and both_ways == 1, which is
      arithmetic-consistent by construction and stays within 6P-10's
      shape: the through movement is one lane per direction).  A bare 3
      (no directional tags) cannot be told apart from a 2+1 directional
      split, and the gate does not guess — refused, with the recovery
      confirm as the operator's path.
    - total <= 2 — never fires (the classic 2-lane two-way road; the
      genuinely single-lane total of 1 is the LOW side, refused by
      ``_ensure_lane_eligible`` directly).

    ``total`` absent ⇒ no detection signal ⇒ False — direct API callers
    and manual entry are unaffected (the #136/#158 principle).

    Mirrored on the frontend in
    conestruct/site/lib/scenarios/auto-apply.ts
    (``flaggerLaneIneligibleHigh``) to drive the recovery CheckRow.

    Sole backend consumer: ``_ensure_lane_eligible`` (render_api) —
    flagger_lane_closure only; shoulder work on a multi-lane road is
    valid and never touched by this predicate.
    """
    if total is None:
        return False
    if total >= 4:
        return True
    if total == 3:
        return not (forward == 1 and backward == 1 and both_ways == 1)
    return False


# ---------------------------------------------------------------------------
# Bridge — Scenario → (ScenarioParams, generator, kwargs)
# ---------------------------------------------------------------------------


GeneratorCall = tuple[
    ScenarioParams,
    Callable[..., list[DevicePlacement]],
    dict,
]

# V1 sanity range for the canonical shoulder width set at this bridge.
# ``ScenarioParams.shoulder_width_ft`` is the single source of truth for
# shoulder width across the pipeline (generators, renderer, audit,
# validators, narrative all read it), so the one place that assigns it
# also guards it.  Hard error by design: anything outside this range is
# outside V1's intended scope and must fail loudly, not render quietly.
_SHOULDER_WIDTH_MIN_FT: float = 4.0
_SHOULDER_WIDTH_MAX_FT: float = 14.0


def _validated(params: ScenarioParams) -> ScenarioParams:
    """Guard the canonical shoulder width on every params leaving the bridge."""
    if not (_SHOULDER_WIDTH_MIN_FT <= params.shoulder_width_ft <= _SHOULDER_WIDTH_MAX_FT):
        raise ValueError(
            f"shoulder_width_ft={params.shoulder_width_ft!r} is outside the "
            f"supported range [{_SHOULDER_WIDTH_MIN_FT:g}, "
            f"{_SHOULDER_WIDTH_MAX_FT:g}] ft for V1 scenarios."
        )
    return params


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
        # Normalize workZoneSpeed == speed (or unset) to None — both
        # mean "no reduction in effect" downstream.
        wz_speed = (
            scenario.workZoneSpeed
            if scenario.workZoneSpeed is not None and scenario.workZoneSpeed < scenario.speed
            else None
        )
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
            work_zone_speed_mph=wz_speed,
            **meta_kw,
        )
        generator = (
            generate_shoulder_closure_divided
            if scenario.divided
            else generate_shoulder_closure_undivided
        )
        return _validated(params), generator, {}

    if isinstance(scenario, FlaggerLaneClosureScenario):
        # 2-lane two-way, alternating flow.  ``num_lanes`` is the
        # per-direction count (one lane each way).
        params = ScenarioParams(
            speed_mph=scenario.speed,
            num_lanes=1,
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
        return _validated(params), generate_flagger_alternating_2lane, kwargs

    if isinstance(scenario, LaneClosureDividedScenario):
        # TA-19, right-lane closed on a divided highway with two lanes
        # per direction.  ``num_lanes`` is the per-direction count; the
        # renderer draws that many lanes per carriageway (the generator
        # itself hard-codes the 2-per-direction device geometry).
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
        return _validated(params), generate_lane_closure_divided, {}

    if isinstance(scenario, WorkBeyondShoulderScenario):
        # TA-1: work entirely off the roadway.  ``closure_type="shoulder"``
        # so the renderer draws the shoulder area; the generator emits no
        # devices on the road itself.  ``num_lanes`` is per direction: 2 on
        # the divided road types, 1 on the 2-lane undivided ones.
        wbs_divided = scenario.roadType in ("rural_divided", "freeway")
        params = ScenarioParams(
            speed_mph=scenario.speed,
            num_lanes=2 if wbs_divided else 1,
            closure_type="shoulder",
            road_type=_map_road_type(scenario.roadType, scenario.speed),
            work_zone_length_ft=scenario.workLen,
            lane_width_ft=scenario.laneWidth,
            shoulder_width_ft=10.0 if wbs_divided else 8.0,
            is_night=scenario.night,
            is_divided=wbs_divided,
            jurisdiction="CDOT",
            **meta_kw,
        )
        return _validated(params), generate_work_beyond_shoulder, {}

    if isinstance(scenario, MobileOp2LaneScenario):
        # TA-35: slow-moving operation on a two-lane road.  ``workLen``
        # carries the trailing distance to the shadow vehicle so the
        # generator can place it.  ``num_lanes`` is per direction (one
        # lane each way on the 2-lane road).
        params = ScenarioParams(
            speed_mph=scenario.speed,
            num_lanes=1,
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
            _validated(params),
            generate_mobile_op_2lane,
            {"arrow_board_on_shadow": scenario.arrowBoardOnShadow},
        )

    if isinstance(scenario, MobileOpMultilaneScenario):
        # TA-26
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
            _validated(params),
            generate_mobile_op_multilane,
            {"second_tma": scenario.secondTMA},
        )

    if isinstance(scenario, NearIntersectionScenario):
        # S-630-1 Sheet 10 Case 18 (GATED — the ENABLED_SCENARIOS gate
        # still 400s the kind over HTTP; this bridge serves the internal
        # call path and tests until enablement).  The mainline is an
        # undivided right-lane closure; ``near_intersection=True`` keeps
        # ``_is_flagger_scenario`` from claiming it.  Approaches ride
        # kwargs as ApproachParams with road types pre-mapped to the
        # Table 6B-1 vocabulary, per-leg.
        params = ScenarioParams(
            speed_mph=scenario.speed,
            num_lanes=scenario.lanes,
            closure_type="lane",
            road_type=_map_road_type(scenario.roadType, scenario.speed),
            work_zone_length_ft=scenario.workLen,
            lane_width_ft=scenario.laneWidth,
            shoulder_width_ft=8.0,
            is_night=scenario.night,
            is_divided=False,
            jurisdiction="CDOT",
            near_intersection=True,
            **meta_kw,
        )
        approaches = [
            ApproachParams(
                id=a.id,
                speed_mph=a.speed,
                road_type=_map_road_type(a.roadType, a.speed),
                num_lanes=a.lanesPerDirection,
                lane_width_ft=a.laneWidth,
                along_station_ft=a.alongStationFt,
                signalized=a.signalized,
            )
            for a in scenario.approaches
        ]
        return _validated(params), generate_near_intersection, {"approaches": approaches}

    # Union members without a generator bridge fail loudly here.  The
    # ENABLED_SCENARIOS gate rejects them upstream with a 400; this
    # guard covers direct callers and keeps a future union member from
    # silently riding the last branch's generator.
    raise ValueError(
        f"no generator bridge for scenario kind {scenario.kind!r} — "
        f"the kind is schema-only (gated) until its generator lands."
    )
