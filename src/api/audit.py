"""
Audit-trail builder for the MHT plan generator.

Exposes one public function — ``build_audit_trail`` — that recomputes
every intermediate value the Streamlit verification panel displays,
calling the same MUTCD/CDOT spacing functions the layout engine uses.

The dict returned mirrors the structure the UI expects: one top-level
key per expander, each holding the inputs, formulas, and source
citations needed to justify a number to a Traffic Control Supervisor.
"""

from __future__ import annotations

import math
from typing import Any

from src.generation.layout import (
    device_count_floors,
    flagger_chain_stations,
    near_intersection_stations,
)
from src.rules.devices import DeviceType
from src.rules.sign_codes import PLAQUE_CODES, substitute_sign_description
from src.rules.spacing import (
    _cdot_buffer_or_none,
    advance_warning_spacing,
    buffer_space,
    co_construction_plaques,
    co_speed_reduction_signs,
    device_spacing_in_taper,
    device_spacing_on_tangent,
    downstream_taper_length,
    one_lane_two_way_device_spacing,
    one_lane_two_way_taper_length,
    pick_device_count,
    shoulder_taper_length,
    stopping_sight_distance_ft,
    taper_length,
)
from src.rules.tables import (
    CDOT_BUFFER_STEPDOWN,
    COLORADO_OVERRIDES,
    TAPER_LENGTH_FORMULA_THRESHOLD_MPH,
)
from src.rules.validators import (
    ApproachParams,
    DevicePlacement,
    ScenarioParams,
    _is_flagger_scenario,
    shoulder_ta_reference,
    validate_corridor_geometry,
)

_TABLE_6B_1_CATEGORIES: frozenset[str] = frozenset(
    {"urban_low", "urban_high", "rural", "expressway", "freeway"}
)

# Discrete display citations for the on-screen audit panel (#97).
#
# The audit *PDF* renders the prose ``source`` field on each section
# (e.g. "MUTCD 11th Ed. Sec 6B.06, Table 6B-2 …") and is already correct.
# The React audit panel (``AuditTrail.tsx``) needs a short cite header and
# a footer chip, and used to HARDCODE them — which is how it drifted to
# 2009-edition numbers (§6C.06/§6C.09/Table 6C-3) while the backend prose
# already said 6B/6K.  These constants are the single source for those two
# panel strings; the panel reads ``section.citation.{cite,footer}`` instead
# of re-deriving them, so the panel and the PDF can no longer disagree.
#
# 11th-edition mapping (2023 renumber of Part 6): device spacing
# §6C.09→§6K.01, buffer §6C.06→§6B.06, taper criteria moved Chapter 6C→6B
# (§6C.08→§6B.08, Table 6C-3→Table 6B-3).  The taper footer is a single
# constant matching the dominant shoulder/lane Table 6B-3 lookup; the
# flagger one-lane two-way taper's §6B.08 50-100 ft band is already named
# in its prose ``source``/body text (pre-existing imprecision in the table
# chip, neither introduced nor worsened here).
#
# FOLLOW-UP: the prose ``source`` sentences still spell these section
# numbers out independently; consolidating them onto these constants would
# kill the last drift seam but churns PDF snapshot strings, so it is left
# to its own behavior-preserving PR (rule #5).
_CITATION_TAPER: dict[str, str] = {
    "cite": "MUTCD § 6B.08",
    "footer": "MUTCD 2023 EDITION · CHAPTER 6B · TABLE 6B-3",
}
_CITATION_BUFFER: dict[str, str] = {
    "cite": "MUTCD § 6B.06",
    "footer": "MUTCD § 6B.06 · STOPPING SIGHT DISTANCE",
}
_CITATION_SPACING: dict[str, str] = {
    "cite": "MUTCD § 6K.01",
    "footer": "MUTCD § 6K.01 · CHANNELIZING DEVICE SPACING",
}

# Sheet 12 FINES DOUBLE SIGNING NOTES — operational rules attached to
# every applicable fines_double section (shoulder, lane-divided, and
# flagger all cite the same four notes; hoisted when the flagger
# envelope shipped in the Item 3 correction PR 2).
_SHEET_12_OPERATIONAL_NOTES: list[dict[str, str]] = [
    {
        "citation": "S-630-1 Sheet 12, Note 1",
        "action": (
            "Install Fines Double signs no more than 4 "
            "hours before the start of the work day. Do "
            "not leave signs up overnight when work is "
            "not active."
        ),
    },
    {
        "citation": "S-630-1 Sheet 12, Note 2",
        "action": (
            "Remove or cover Fines Double signs when work "
            "concludes; doubled fines apply only when "
            "workers or work activity are present in the "
            "zone."
        ),
    },
    {
        "citation": "S-630-1 Sheet 12, Note 3",
        "action": (
            "Relocate the R2-10/R2-11 envelope to follow "
            "the actual work area as the project "
            "progresses; do not leave Fines Double signs "
            "in place beyond the active work zone."
        ),
    },
    {
        "citation": "S-630-1 Sheet 12, Note 4",
        "action": (
            "Maintain a 250 ft minimum spacing between "
            "Fines Double signs (R2-10, R2-11, G20-5P/"
            "R2-6P assemblies) and other warning or "
            "regulatory signs. Engineer may adjust "
            "placement to satisfy this minimum."
        ),
    },
]


def _ft(value: float) -> int:
    """Round a length in feet to whole feet for DISPLAY only.

    The MUTCD §6B.08 taper formulas yield long decimal tails (e.g. L =
    W·S²/60 = 83.3333, L/3 = 27.7778); the spec tabulates taper lengths in
    whole feet.  This is the single source of that display precision —
    applied at the projection composition points so the PDF, the AuditTrail
    UI, and the JSON all render one value identically (it retired a
    three-way split: PDF ``:g`` → 27.7778, backend string ``:.1f`` → 27.8,
    UI ``Math.round`` → 28).  Scoped to the taper-length family only;
    buffers, device spacing, intervals, and offsets are left untouched.
    Computed values feeding device counts and geometry checks keep full
    precision — only the rendered number rounds.
    """
    return round(value)


def build_audit_trail(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
    site_lat: float | None = None,
    site_lng: float | None = None,
    approaches: list[ApproachParams] | None = None,
) -> dict[str, Any]:
    """Recompute every audit-trail intermediate the verification UI needs.

    Branches on ``params.closure_type``:

    * ``"shoulder"`` — taper offset is the closed shoulder width and the
      required taper run is L/3 (MUTCD §6B.08).
    * ``"lane"`` — taper offset is one lane width and the required taper
      run is the full merging taper L (MUTCD §6B.08).

    Falls back to the shoulder-closure presentation for any other value
    so the verification panel keeps rendering until other scenarios are
    implemented.

    ``shoulder_width_ft`` defaults to ``params.shoulder_width_ft`` (the
    single source of truth); the kwarg remains as an explicit override.
    """
    if shoulder_width_ft is None:
        shoulder_width_ft = params.shoulder_width_ft
    speed = params.speed_mph
    wz_len = params.work_zone_length_ft
    is_lane = params.closure_type == "lane"
    # near_intersection (Option C inc. 3, Refs #117): an undivided lane
    # closure that is NOT the flagger kind — same exclusion
    # _is_flagger_scenario carries; without it this kind would get the
    # flagger presentation (one-lane two-way taper, TA-10 case).
    is_near = params.near_intersection
    if is_near and not approaches:
        # Rule 10: auditing this kind without its approach data would
        # produce a confidently wrong document (no per-leg sections, no
        # signal disclosure), not a degraded one.
        raise ValueError(
            "build_audit_trail: the near_intersection kind requires the "
            "approaches list (same ApproachParams the generator got)."
        )
    if approaches and not is_near:
        raise ValueError(
            "build_audit_trail: approaches are only meaningful for the near_intersection kind."
        )
    ni = near_intersection_stations(params, approaches) if is_near else None
    # Mainline-frame placements — approach-frame stations are measured
    # from the intersection curb line and must never be mixed into
    # mainline math (DevicePlacement.approach_id contract).  Identity
    # for every other kind, where all placements are mainline.
    mainline_placements = [p for p in placements if p.approach_id == "mainline"]
    is_flagger = is_lane and not params.is_divided and not is_near
    offset_ft = params.lane_width_ft if is_lane else shoulder_width_ft
    offset_label = "lane width" if is_lane else "shoulder width"
    # Single source of truth for "work-zone speed is reduced from the
    # posted speed". Drives both the S1 case routing
    # (shoulder_no_reduction vs shoulder_reduced_speed) and Item 3's
    # Fines Double envelope gate — same predicate, deduplicated.
    wz_speed = params.work_zone_speed_mph
    is_reduced = wz_speed is not None and wz_speed < speed
    # Exact Case 26/27 mandated step-down (65->60, 75->65) — the only
    # reductions that carry the CDOT supplement buffer minimum AND the
    # Case 26/27 citation.  Gated on ``jurisdiction == "CDOT"`` — the same
    # predicate the buffer source uses (``is_divergent``/``supplement_speed``
    # below) — so case identity, taper citation, and buffer source can never
    # disagree on the jurisdiction axis (#72; the #64/#63/#65 no-drift
    # guarantee).  ``_cdot_buffer_or_none`` keys only on speed, so without
    # the jurisdiction term a federal 65->60 scenario would take a Case 26
    # label while its buffer source stayed federal Table 6B-2.  A non-standard
    # reduction (e.g. 65->55) is generic Case 11 with a reduction marker.
    is_supplement_case = (
        params.jurisdiction == "CDOT" and _cdot_buffer_or_none(speed, wz_speed) is not None
    )

    # ------------------------------------------------------------------
    # 1. Taper length
    # ------------------------------------------------------------------
    threshold = TAPER_LENGTH_FORMULA_THRESHOLD_MPH
    # Single source of truth for the taper value — spacing.taper_length() is
    # the canonical L (W x S at/above the threshold, W x S^2 / 60 below).  The
    # if/else only selects the per-branch display strings; both branches show
    # the same number the canonical helper produced (#55: audit.py no longer
    # re-inlines the >= threshold formula).
    L_full = taper_length(speed, offset_ft)
    if speed >= threshold:
        formula_choice = f"Speed {speed} mph >= {threshold} mph threshold -> using L = W x S"
        formula_latex = r"L = W \times S"
        L_calc_text = f"L = {offset_ft:g} x {speed} = {_ft(L_full)} ft"
    else:
        formula_choice = f"Speed {speed} mph < {threshold} mph threshold -> using L = W x S^2 / 60"
        formula_latex = r"L = \frac{W \times S^2}{60}"
        # B-03 — the displayed arithmetic must match the formula that
        # produced the number (the linear-format text shown here used
        # to contradict the quadratic result at speeds below 40).
        L_calc_text = f"L = {offset_ft:g} x {speed}^2 / 60 = {_ft(L_full)} ft"
    L_third = shoulder_taper_length(speed, offset_ft)

    if is_flagger:
        # PR 2 geometry correction: flagger alternating-flow operations
        # use the one-lane two-way taper (MUTCD §6B.08 ¶14: 50–100 ft,
        # ~20 ft device spacing), NOT the merging taper L — the taper
        # stages stopped traffic behind a flagger.  CDOT Case 17:
        # "THIS TAPER MUST BE SHORT ENOUGH TO NOT BE MISTAKEN FOR A
        # TRANSITION."  L_full above remains the W×S reference value;
        # the formula texts are overridden so the audit shows the
        # actually-applied rule.
        L_required = one_lane_two_way_taper_length()
        L_required_label = "one-lane two-way taper"
        L_required_calc_text = (
            f"Required: {L_required:g} ft (one-lane two-way taper, "
            "50-100 ft band per MUTCD Sec 6B.08; plan uses the 100 ft "
            "maximum)"
        )
        formula_choice = (
            "Flagger alternating-flow: one-lane two-way taper (50-100 ft "
            "fixed band per MUTCD Sec 6B.08) -> using 100 ft maximum; "
            "the merging-taper L = W x S formula does not apply"
        )
        formula_latex = r"50 \le L \le 100"
        L_calc_text = f"One-lane two-way taper = {L_required:g} ft (Sec 6B.08 50-100 ft band)"
        source_text = (
            "MUTCD 11th Ed. Sec 6B.08 (one-lane, two-way traffic "
            "control): 50-100 ft taper with channelizing devices at "
            "approximately 20 ft spacing. CDOT S-630-1 Case 17 warns "
            "the taper must be short enough to not be mistaken for a "
            "transition."
        )
        cdot_reference = (
            "MUTCD 11th Ed. Part 6 TA-10 (flagger-controlled one-lane two-way operation)"
        )
    elif is_near:
        L_required = L_full
        L_required_label = "L (full merging taper)"
        L_required_calc_text = f"Required: L = {_ft(L_full)} ft (full taper for lane closure)"
        source_text = (
            "MUTCD 11th Ed. Sec 6B.08, Table 6B-3. Lane closures use the "
            "full merging taper length L."
        )
        cdot_reference = (
            "CDOT S-630-1 Case 18 (traffic control around a work area "
            "near an intersection, one lane closed; Sheet 10)"
        )
    elif is_lane:
        L_required = L_full
        L_required_label = "L (full merging taper)"
        L_required_calc_text = f"Required: L = {_ft(L_full)} ft (full taper for lane closure)"
        source_text = (
            "MUTCD 11th Ed. Sec 6B.08, Table 6B-3. Lane closures use the "
            "full merging taper length L."
        )
        cdot_reference = "CDOT S-630-1 Case 10 (one lane closed on 4-lane divided highway, Sheet 7)"
    else:
        L_required = L_third
        L_required_label = "L/3 (shoulder taper)"
        L_required_calc_text = f"L/3 = {_ft(L_full)} / 3 = {_ft(L_third)} ft"
        source_text = (
            "MUTCD 11th Ed. Sec 6B.08, Table 6B-3. Shoulder closures use L/3 "
            "per Sec 6B.08 (Table 6B-3)."
        )
        # Routing-aware taper cdot_reference (V1-Wide S1). Only the exact
        # Case 26/27 mandated step-down (65->60, 75->65) maps to the Sheet
        # 14 parametric typicals; a non-standard reduction (e.g. 65->55)
        # stays on Case 11 with a reduction marker; no reduction is plain
        # Case 11.  Gated on ``is_supplement_case`` so the taper citation
        # tracks the buffer citation exactly.
        if is_supplement_case and speed == 65:
            cdot_reference = (
                "CDOT S-630-1 Case 26 (shoulder closure on freeway/expressway, "
                "65 mph posted with reduced work-zone speed; Sheet 14)"
            )
        elif is_supplement_case and speed == 75:
            cdot_reference = (
                "CDOT S-630-1 Case 27 (shoulder closure on freeway/expressway, "
                "75 mph posted with reduced work-zone speed; Sheet 14)"
            )
        elif is_reduced:
            cdot_reference = (
                "CDOT S-630-1 Case 11 (right-shoulder closure on divided "
                "highway, reduced work-zone speed)"
                if params.is_divided
                else (
                    "CDOT S-630-1 Case 11 (right-shoulder closure, applied to "
                    "undivided highway, reduced work-zone speed)"
                )
            )
        else:
            cdot_reference = (
                "CDOT S-630-1 Case 11 (right-shoulder closure on divided highway)"
                if params.is_divided
                else ("CDOT S-630-1 Case 11 (right-shoulder closure, applied to undivided highway)")
            )

    taper_section = {
        "speed_mph": speed,
        "closure_type": params.closure_type,
        "offset_label": offset_label,
        "offset_ft": offset_ft,
        # Backwards-compatible field for existing UI references; for lane
        # closures this stores the closed lane width.
        "shoulder_width_ft": offset_ft,
        "formula_choice": formula_choice,
        "formula_latex": formula_latex,
        "L_calc_text": L_calc_text,
        # Display-only whole-feet rounding (see _ft); the local L_full /
        # L_required floats above keep full precision for pick_device_count
        # and the geometry checks.
        "L_full_ft": _ft(L_full),
        "L_third_calc_text": L_required_calc_text,
        "L_third_ft": _ft(L_required),
        "L_required_ft": _ft(L_required),
        "L_required_label": L_required_label,
        "source": source_text,
        "cdot_reference": cdot_reference,
        # #97 — discrete panel citation (the PDF keeps rendering ``source``).
        "citation": _CITATION_TAPER,
    }

    # ------------------------------------------------------------------
    # 2. Buffer space — jurisdiction-aware (V1-Wide Item 2).
    # ------------------------------------------------------------------
    # Three cases:
    #   A. CDOT + speed posts a hard minimum (Sheet 14 Cases 26/27 at
    #      65/75 mph) — divergent from MUTCD; emit full annotation with
    #      structured fields for parseable downstream consumption.
    #   B. CDOT + speed not in supplement (silent fallback) — falls
    #      back to federal MUTCD value per Sheet 2 General Note 24;
    #      flag the silence in lookup_text.
    #   C. federal jurisdiction — pure MUTCD baseline.
    # Structured divergence fields (jurisdiction/cdot_value_ft/
    # mutcd_value_ft/divergence) appear only in case A so non-divergent
    # speeds stay byte-identical to pre-Item-2 modulo the citation +
    # silent annotation.
    buf = buffer_space(speed, jurisdiction=params.jurisdiction, work_zone_speed_mph=wz_speed)
    # The 570/650 supplement minimum is conditional: it applies only on a
    # qualifying Case 26/27 step-down (65->60, 75->65).  ``cdot_value`` is
    # None for a plain 65/75 closure or a non-standard reduction, so the
    # divergence branch (and its "Case 26/27" citation) fires only when the
    # supplement minimum actually governs.
    cdot_value = _cdot_buffer_or_none(speed, wz_speed)
    is_divergent = params.jurisdiction == "CDOT" and cdot_value is not None
    # True at 65/75 mph regardless of reduction: the supplement tabulates a
    # (conditional) minimum at this speed, which lets us explain *why* the
    # federal value is used when no qualifying step-down is present.
    supplement_speed = params.jurisdiction == "CDOT" and speed in CDOT_BUFFER_STEPDOWN

    if is_divergent:
        mutcd_value = buffer_space(speed, jurisdiction="federal")
        # Local variable scoped to the buffer-section CDOT supplement
        # row label; named `_supplement_row_label` to avoid shadowing
        # the outer `case_label` variable used by the S1 case routing
        # below (audit.py:~555).
        _supplement_row_label = "Case 26 at 65 mph" if speed == 65 else "Case 27 at 75 mph"
        buffer_section = {
            "speed_mph": speed,
            "lookup_text": (
                f"CDOT supplement: {buf:g} ft. MUTCD Table 6B-2: {mutcd_value:g} ft. "
                f"Plan uses CDOT supplement value. Note: CDOT supplement permits "
                f"shorter buffer than federal table. Verify against project-specific "
                f"engineering judgment."
            ),
            "buffer_ft": buf,
            "source": (
                f"CDOT S-630-1 Standard Plan, Sheet 14 ({_supplement_row_label}). "
                f"MUTCD 11th Ed. Sec 6B.06, Table 6B-2 (federal baseline)."
            ),
            "jurisdiction": params.jurisdiction,
            "cdot_value_ft": int(buf),
            "mutcd_value_ft": int(mutcd_value),
            "divergence": True,
            "citation": _CITATION_BUFFER,
        }
    elif supplement_speed:
        # CDOT 65/75 mph but no qualifying Case 26/27 step-down: the
        # supplement minimum is SSD at the reduced work-zone speed, which is
        # not in effect, so MUTCD Table 6B-2 at the posted speed governs per
        # Sheet 7 Case 11 (buffer "VARIES", General Note 24).
        required_wz = CDOT_BUFFER_STEPDOWN[speed]
        supplement_min = _cdot_buffer_or_none(speed, required_wz)
        _supplement_case = "Case 26" if speed == 65 else "Case 27"
        buffer_section = {
            "speed_mph": speed,
            "lookup_text": (
                f"MUTCD Table 6B-2: {buf:g} ft. CDOT S-630-1 Sheet 14 posts a "
                f"{supplement_min:g} ft minimum at {speed} mph, but only as part of the "
                f"{_supplement_case} mandatory speed step-down "
                f"({speed} → {required_wz} mph); this plan has no qualifying "
                f"reduction, so the federal posted-speed value governs (Sheet 7 "
                f"Case 11: buffer VARIES per General Note 24)."
            ),
            "buffer_ft": buf,
            "source": (
                "MUTCD 11th Ed. Sec 6B.06, Table 6B-2 (stopping sight distance). "
                "CDOT S-630-1 Sheet 7 Case 11 (buffer VARIES per General Note 24)."
            ),
            "citation": _CITATION_BUFFER,
        }
    elif params.jurisdiction == "CDOT":
        buffer_section = {
            "speed_mph": speed,
            "lookup_text": (f"MUTCD Table 6B-2: {buf:g} ft (CDOT supplement silent at this speed)"),
            "buffer_ft": buf,
            "source": "MUTCD 11th Ed. Sec 6B.06, Table 6B-2 (stopping sight distance)",
            "citation": _CITATION_BUFFER,
        }
    else:  # jurisdiction == "federal"
        buffer_section = {
            "speed_mph": speed,
            "lookup_text": f"MUTCD Table 6B-2: {buf:g} ft",
            "buffer_ft": buf,
            "source": "MUTCD 11th Ed. Sec 6B.06, Table 6B-2 (stopping sight distance)",
            "citation": _CITATION_BUFFER,
        }

    # ------------------------------------------------------------------
    # 3. Channelizing device spacing
    # ------------------------------------------------------------------
    # Flagger one-lane two-way taper uses the §6B.08 ¶14 ~20 ft device
    # spacing (taper-specific guidance overrides the speed-based §6K.01
    # rule); all other tapers use §6K.01 speed-in-feet.  Tangent spacing
    # is §6K.01 2x-speed everywhere.
    in_taper = one_lane_two_way_device_spacing() if is_flagger else device_spacing_in_taper(speed)
    on_tan = device_spacing_on_tangent(speed)

    # Deployed counts mirror the layout engine
    # (``src/generation/layout.py`` calls the same helper).  Naive
    # ``ceil(length / spacing)`` was wrong on two counts: it returned
    # the interval count (= devices - 1) and ignored the §6K.01
    # asymmetric acceptance window.  Floors come from the generators'
    # shared ``device_count_floors`` source (audit fix B-07) so the
    # "required" recompute matches what the layout actually deploys —
    # the undivided-shoulder taper floor of 4 and the flagger tangent
    # floor of 3 bind at low speeds / short zones.
    taper_min, tangent_min = device_count_floors(params)
    n_taper_drums = pick_device_count(L_required, in_taper, min_count=taper_min)
    n_tangent_cones = pick_device_count(wz_len, on_tan, min_count=tangent_min)
    taper_interval = L_required / (n_taper_drums - 1)
    tangent_interval = wz_len / (n_tangent_cones - 1)

    actual_drums = sum(1 for p in mainline_placements if p.device_type == DeviceType.DRUM)
    actual_cones = sum(1 for p in mainline_placements if p.device_type == DeviceType.CONE)
    # #96 — downstream-taper cones sit at negative stations (past the
    # downstream end of the work zone): a fixed 2 from the shoulder
    # generators, a computed count (typically 4) from the flagger layout.
    # The bill/XLSX count them, so the derivation must account for them
    # too or its only visible cone total disagrees with the bill.
    ds_cone_stations = [
        p.station_ft
        for p in mainline_placements
        if p.device_type == DeviceType.CONE and p.station_ft < 0.0
    ]
    n_ds_cones = len(ds_cone_stations)

    if is_flagger:
        taper_label = "one-lane two-way taper"
        in_taper_text = (
            f"{in_taper:g} ft spacing in the one-lane two-way taper "
            "(MUTCD Sec 6B.08: approximately 20 ft, taper-specific "
            "guidance overriding the Sec 6K.01 speed-based rule)"
        )
    else:
        taper_label = "L" if is_lane else "L/3"
        in_taper_text = (
            f"{speed} mph -> {in_taper:g} ft spacing "
            "(MUTCD Sec 6K.01: spacing equals speed in feet)"
        )
    spacing_section = {
        "speed_mph": speed,
        "in_taper_text": in_taper_text,
        "on_tangent_text": (
            f"{speed} mph -> {on_tan:g} ft spacing "
            "(MUTCD Sec 6K.01: spacing equals 2x speed in feet)"
        ),
        "taper_count_text": (
            f"{taper_label} = {_ft(L_required)} ft / {in_taper:g} ft max spacing "
            f"-> {n_taper_drums} drums at {taper_interval:.1f} ft intervals"
        ),
        "tangent_count_text": (
            f"{wz_len:g} ft / {on_tan:g} ft max spacing "
            f"-> {n_tangent_cones} cones at {tangent_interval:.1f} ft intervals"
        ),
        # ``_required`` field name retained for backwards compatibility
        # with verify scripts and the Streamlit panel.  Value is now the
        # ``pick_device_count`` output (what the layout deploys), not
        # the old naive ``ceil`` (what a strict reading of §6K.01 would
        # demand).  Rename is a separate concern; see commit history.
        "n_taper_drums_required": n_taper_drums,
        "n_taper_drums_actual": actual_drums,
        "n_tangent_cones_required": n_tangent_cones,
        # NOTE (#96): despite the name, this counts ALL cone placements —
        # including the downstream-taper run — not just the tangent line.
        # Kept as-is (verify scripts and snapshots read this key); the
        # honestly-named total is ``n_cones_placed_total`` below.
        "n_tangent_cones_actual": actual_cones,
        "source": (
            "MUTCD 11th Ed. Sec 6B.08 (one-lane two-way taper) + Sec 6K.01 (tangent)"
            if is_flagger
            else "MUTCD 11th Ed. Sec 6K.01"
        ),
        # #97 — §6K.01 is the channelizing-device-spacing section in both
        # branches; the flagger in-taper §6B.08 override is named in the
        # body text above (in_taper_text), not the footer chip.
        "citation": _CITATION_SPACING,
    }
    # #96 — downstream-taper derivation line + honestly-named placed total,
    # emitted only when the layout actually places downstream cones (the
    # gated no-cone scenarios stay untouched).  Components are placement-
    # derived so the sum equals the bill/XLSX count by construction.
    if n_ds_cones:
        ds_len = -min(ds_cone_stations)
        ds_spacing = ds_len / n_ds_cones
        n_tangent_actual = actual_cones - n_ds_cones
        spacing_section["downstream_count_text"] = (
            f"Downstream taper: {ds_len:g} ft at ~{ds_spacing:g} ft spacing "
            f"-> {n_ds_cones} cones (MUTCD Sec 6B.08: 50-100 ft downstream taper); "
            f"{n_tangent_actual} tangent + {n_ds_cones} downstream = "
            f"{actual_cones} cones total"
        )
        spacing_section["n_downstream_taper_cones"] = n_ds_cones
        spacing_section["n_cones_placed_total"] = actual_cones

    # ------------------------------------------------------------------
    # 4. Advance warning sign placement
    # ------------------------------------------------------------------
    rt_for_lookup = params.road_type if params.road_type in _TABLE_6B_1_CATEGORIES else None
    spacing_abc = advance_warning_spacing(speed, rt_for_lookup)
    a_ft = spacing_abc["A"]
    b_ft = spacing_abc["B"]
    c_ft = spacing_abc["C"]
    # #55: the displayed Table 6B-1 category is exactly the value fed to the
    # lookup above (single source of truth, no parallel inference).  For every
    # valid scenario road_type is a Table 6B-1 category, so rt_for_lookup ==
    # params.road_type; the canonical raise at the lookup already governs the
    # 55+ / non-category case, so no lenient fallback is needed here.
    resolved_category = rt_for_lookup

    taper_end_station = wz_len + buf
    taper_start_station = taper_end_station + L_required
    sign_a_station = taper_start_station + a_ft
    sign_b_station = sign_a_station + b_ft
    sign_c_station = sign_b_station + c_ft
    if ni is not None:
        # Far-side geometry can pull the taper further upstream than the
        # midblock anchoring (§6N.12.12 companion closure) — read the
        # stations the generator actually used so the distances below
        # match the layout.
        taper_end_station = ni["taper_end"]
        taper_start_station = ni["taper_start"]
        sign_a_station = ni["sign_a"]
        sign_b_station = ni["sign_b"]
        sign_c_station = ni["sign_c"]

    # Flagger W3-4 anchor — only meaningful on the flagger series; kept
    # outside the branch so _position_label can reference it untyped.
    sign_w3_4_station = 0.0

    if is_flagger:
        # Flagger-controlled alternating-traffic series (MUTCD Fig.
        # 6P-10, PR 2 B-11 correction): ONE LANE ROAD AHEAD (W20-4) is
        # the B-position sign; BE PREPARED TO STOP (W3-4) is an
        # optional addition between W20-4 and W20-7 (TA-10 notes 4/8),
        # emitted by default.  Anchor stations come from the shared
        # flagger_chain_stations helper (same source the generator and
        # narrative use), so the A gap anchors on the flagger station
        # and W20-1 follows the R2-10 chain insertion when the
        # work-zone speed is reduced (fixtures:
        # tests/fixtures/ta10_flagger/).
        sign_codes = {"A": "W20-7", "B": "W20-4", "C": "W20-1"}
        _chain = flagger_chain_stations(params)
        sign_a_station = _chain["w20_7_r"]
        sign_w3_4_station = _chain["w3_4_r"]
        sign_b_station = _chain["w20_4_r"]
        sign_c_station = _chain["w20_1_r"]
    elif is_lane:
        sign_codes = {"A": "W4-2R", "B": "W20-5R", "C": "W20-1"}
    else:
        sign_codes = {"A": "W21-5aR", "B": "W20-2", "C": "W20-1"}

    # Sign table — derived from the placement list (audit honesty, B-02).
    #
    # Every upstream SIGN_GENERIC placement (station > taper start) gets
    # a row, so the audit JSON cannot silently omit a sign the layout
    # ships — W5-1 (G2) was the observed omission under the previous
    # hand-assembled table; the cross-surface invariant test pins the
    # rest.  Conventions match the PDF off-page table: left/right mirror
    # pairs dedupe to one row per (label, station); ordering is
    # driver-encounter (furthest upstream first); plaques sort after
    # their parent sign at the same station.  Position labels are
    # matched against the computed anchor stations above so the
    # established A/B/C vocabulary is preserved.
    #
    # The W21-5aR-pair anchor (G1): second W21-5aR at the midpoint
    # between sign_a_station and the W5-1-would-be station
    # (taper_start + 500), independent of whether W5-1 actually emits —
    # preserves geometric consistency across routings.
    w21_5aR_downstream_st = (sign_a_station + (taper_start_station + 500.0)) / 2.0

    def _position_label(label: str, station_ft: float, w3_5_step: int) -> str:
        if ni is not None and label == "R2-10" and abs(station_ft - ni["r2_10"]) <= 0.5:
            return "1/2 C inside the outermost sign (Case 18)"
        if label == sign_codes["C"] and abs(station_ft - sign_c_station) <= 0.5:
            return "C (furthest)"
        if label == sign_codes["B"] and abs(station_ft - sign_b_station) <= 0.5:
            return "B (middle)"
        if label == sign_codes["A"] and abs(station_ft - sign_a_station) <= 0.5:
            return "A (nearest)"
        if is_flagger and label == "W3-4" and abs(station_ft - sign_w3_4_station) <= 0.5:
            return "between A and B (TA-10 note 8)"
        if label == "W16-2a" and abs(station_ft - sign_a_station) <= 0.5:
            return "A plaque"
        if label == "W21-5aR" and abs(station_ft - w21_5aR_downstream_st) <= 0.5:
            return "A2 (second W21-5aR)"
        if label == "W7-3a" and abs(station_ft - w21_5aR_downstream_st) <= 0.5:
            return "A2 plaque"
        if label == "W5-1":
            return "Supplemental (W5-1)"
        if label.startswith("W3-5"):
            return f"W3-5 step {w3_5_step}"
        return f"Advance ({label})"

    upstream_signs = [
        p
        for p in mainline_placements
        if p.device_type == DeviceType.SIGN_GENERIC
        and p.label
        and p.station_ft > taper_start_station
    ]
    _seen_rows: set[tuple[str, int]] = set()
    unique_upstream: list[DevicePlacement] = []
    for p in upstream_signs:
        row_key = (p.label or "", round(p.station_ft))
        if row_key in _seen_rows:
            continue
        _seen_rows.add(row_key)
        unique_upstream.append(p)
    unique_upstream.sort(
        key=lambda p: (
            -p.station_ft,
            (p.label or "").split("(", 1)[0] in PLAQUE_CODES,
            p.label or "",
        )
    )

    sign_table_rows: list[dict[str, str]] = []
    if unique_upstream:
        w3_5_step = 0
        for p in unique_upstream:
            label = p.label or ""
            if label.startswith("W3-5"):
                # Encounter-order step number (most upstream = step 1).
                w3_5_step += 1
            if label in ("W16-2a", "W7-3a"):
                # Plaque value via the shared substitution helper (same
                # number the PDF / XLSX / narrative print), annotated
                # with the host sign for the verification panel.
                _, plaque_value = substitute_sign_description(
                    label, p.station_ft, params, taper_start_station=taper_start_station
                )
                host = "W21-5aR at A" if label == "W16-2a" else "second W21-5aR"
                distance_text = f"{plaque_value} (under {host})"
            else:
                distance_text = f"{p.station_ft - taper_start_station:,.0f} upstream"
            sign_table_rows.append(
                {
                    "Position": _position_label(label, p.station_ft, w3_5_step),
                    "Code": label,
                    "Station (ft)": f"{p.station_ft:,.0f}",
                    "Distance from Taper (ft)": distance_text,
                }
            )
    else:
        # Prescriptive fallback — direct callers (unit tests, ad-hoc
        # scripts) pass empty or sign-free placement lists; the panel
        # still documents the computed A/B/C prescription so the audit
        # keeps describing the prescribed plan.
        # Distances derived from the anchor stations so the flagger
        # 4-sign chain (W20-1 at A+B+2C) and the standard 3-sign chain
        # both report correctly.
        sign_table_rows = [
            {
                "Position": "C (furthest)",
                "Code": sign_codes["C"],
                "Station (ft)": f"{sign_c_station:,.0f}",
                "Distance from Taper (ft)": (
                    f"{sign_c_station - taper_start_station:,.0f} upstream"
                ),
            },
            {
                "Position": "B (middle)",
                "Code": sign_codes["B"],
                "Station (ft)": f"{sign_b_station:,.0f}",
                "Distance from Taper (ft)": (
                    f"{sign_b_station - taper_start_station:,.0f} upstream"
                ),
            },
            {
                "Position": "A (nearest)",
                "Code": sign_codes["A"],
                "Station (ft)": f"{sign_a_station:,.0f}",
                "Distance from Taper (ft)": (
                    f"{sign_a_station - taper_start_station:,.0f} upstream"
                ),
            },
        ]
        if is_flagger:
            # W3-4 (emitted by default per the locked OQ-2 decision)
            # sits between W20-4 (B) and W20-7 (A) — TA-10 note 8.
            sign_table_rows.insert(
                2,
                {
                    "Position": "between A and B (TA-10 note 8)",
                    "Code": "W3-4",
                    "Station (ft)": f"{sign_w3_4_station:,.0f}",
                    "Distance from Taper (ft)": (
                        f"{sign_w3_4_station - taper_start_station:,.0f} upstream"
                    ),
                },
            )
        # G1 — second W21-5aR + W16-2a / W7-3a plaques per CDOT S-630-1
        # Sheet 7 Case 11 positions 5/6 (and Sheet 14 Cases 26/27
        # positions 4/6).  Prescription gate matches the layout
        # generator (freeway shoulder), uniform across Cases
        # 11 / 11b / 26 / 27.
        if params.closure_type == "shoulder" and params.road_type == "freeway":
            _, w16_2a_value = substitute_sign_description(
                "W16-2a", sign_a_station, params, taper_start_station=taper_start_station
            )
            _, w7_3a_value = substitute_sign_description(
                "W7-3a", w21_5aR_downstream_st, params, taper_start_station=taper_start_station
            )
            sign_table_rows.extend(
                [
                    {
                        "Position": "A plaque",
                        "Code": "W16-2a",
                        "Station (ft)": f"{sign_a_station:,.0f}",
                        "Distance from Taper (ft)": (f"{w16_2a_value} (under W21-5aR at A)"),
                    },
                    {
                        "Position": "A2 (second W21-5aR)",
                        "Code": "W21-5aR",
                        "Station (ft)": f"{w21_5aR_downstream_st:,.0f}",
                        "Distance from Taper (ft)": (
                            f"{w21_5aR_downstream_st - taper_start_station:,.0f} upstream"
                        ),
                    },
                    {
                        "Position": "A2 plaque",
                        "Code": "W7-3a",
                        "Station (ft)": f"{w21_5aR_downstream_st:,.0f}",
                        "Distance from Taper (ft)": (f"{w7_3a_value} (under second W21-5aR)"),
                    },
                ]
            )

    advance_section = {
        "road_type_text": (
            f"Speed {speed} mph, road_type = '{params.road_type}' "
            f"-> Table 6B-1 category: {resolved_category}"
        ),
        "spacing_text": f"A = {a_ft:g} ft, B = {b_ft:g} ft, C = {c_ft:g} ft",
        "sign_table": sign_table_rows,
        "source": "MUTCD 11th Ed. Table 6B-1",
    }

    # ------------------------------------------------------------------
    # 5. Colorado Supplement requirements
    # ------------------------------------------------------------------
    sign_left = sum(
        1
        for p in mainline_placements
        if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft < 0
    )
    sign_right = sum(
        1
        for p in mainline_placements
        if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft > 0
    )
    both_sides_pass = sign_left == sign_right and sign_left > 0 if params.is_divided else True
    both_sides = {
        "pass": both_sides_pass,
        "label": "Signs on both sides of divided highway",
        "citation": "CO Supplement Sec 6C.04(A)",
        "detail": (
            f"Required: {params.is_divided}. Signs placed: {sign_left} left, {sign_right} right."
        ),
    }

    plaques_right = sum(
        1
        for p in mainline_placements
        if p.device_type == DeviceType.SIGN_GENERIC and p.label == "G20-5P" and p.offset_ft > 0
    )
    total_signed_length = sign_c_station
    plaques_required = co_construction_plaques(total_signed_length)
    plaques_section = {
        "pass": plaques_right >= plaques_required,
        "label": "G20-5P construction plaques every 2,640 ft",
        "citation": "CO Supplement Sec 6C.06(A)",
        "detail": (
            f"Zone length: {total_signed_length:,.0f} ft. "
            f"Required: {plaques_required}. Placed: {plaques_right}."
        ),
    }

    # Work-zone speed reduction (CO Supplement §2B.13(A)).
    #
    # ``pass`` now reflects actual placement compliance: the layout
    # engine emits W3-5 advisory-speed sign(s) on every reduction
    # (V1-Wide G5), so the check counts deployed W3-5 placements
    # against the §2B.13(A) required count from
    # ``co_speed_reduction_signs`` and passes iff placed ≥ required.
    # Flagger scenarios flow through the same computation (Item 3
    # retroactive correction): §2B.13(A) carries no road-class
    # scoping, so a reduced-speed flagger plan with zero W3-5
    # placements honestly reports pass=False until the flagger
    # layout emits the reduced-speed signing package; the
    # pending_verification item carries the V1-limitation context.
    speed_reduction_section: dict[str, Any]
    if not is_reduced:
        speed_reduction_section = {
            "pass": True,
            "label": "Speed reduction <= 15 mph per sign installation",
            "citation": "CO Supplement Sec 2B.13(A)",
            "detail": (
                f"No work-zone speed reduction. Posted speed {speed} mph "
                f"applies throughout the zone."
            ),
        }
    else:
        delta = speed - wz_speed
        n_signs_required = co_speed_reduction_signs(speed, wz_speed)
        n_w3_5_placed = sum(
            1
            for p in mainline_placements
            if p.device_type == DeviceType.SIGN_GENERIC
            and (p.label or "").upper().startswith("W3-5")
            and p.offset_ft > 0
        )
        if delta <= COLORADO_OVERRIDES.max_speed_reduction_per_sign_mph:
            detail = (
                f"Work-zone speed reduced {speed} → {wz_speed} mph "
                f"(Δ{delta} mph). Required: {n_signs_required}. "
                f"Placed: {n_w3_5_placed}."
            )
        else:
            detail = (
                f"Work-zone speed reduced {speed} → {wz_speed} mph "
                f"(Δ{delta} mph). Required: {n_signs_required} stepped "
                f"sign installations per CO Supplement §2B.13(A) "
                f"(max 15 mph per sign). Placed: {n_w3_5_placed}."
            )
        speed_reduction_section = {
            "pass": n_w3_5_placed >= n_signs_required,
            "label": "Speed reduction <= 15 mph per sign installation",
            "citation": "CO Supplement Sec 2B.13(A)",
            "detail": detail,
        }

    # Flagger-station lighting (CO Supplement §6E.02(A) / S-630-1
    # Sheet 2 Note 22): flood lighting is required at night only.
    # PR 3 B5 correction — the prior check was inverted
    # (``pass = params.is_night``): daytime plans failed a check that
    # did not apply, and night plans passed despite the layout
    # emitting no lighting equipment.  Now: daytime passes
    # (not required); night fails honestly (required, placed 0 — V1
    # does not emit lighting placements) and audit_projection mirrors
    # the gap as a flagger_lighting_manual_handling pending item.
    n_flaggers = sum(1 for p in mainline_placements if p.device_type == DeviceType.FLAGGER_STATION)
    if n_flaggers == 0:
        flagger_lighting_section = {
            "pass": True,
            "label": (
                f"Flagger station lighting "
                f"{COLORADO_OVERRIDES.flagger_station_light_watts}W "
                f"@ {COLORADO_OVERRIDES.flagger_station_light_height_ft} ft"
            ),
            "citation": "CO Supplement Sec 6E.02(A)",
            "detail": "Not applicable (no flaggers).",
        }
    elif not params.is_night:
        flagger_lighting_section = {
            "pass": True,
            "label": (
                f"Flagger station lighting "
                f"{COLORADO_OVERRIDES.flagger_station_light_watts}W "
                f"@ {COLORADO_OVERRIDES.flagger_station_light_height_ft} ft"
            ),
            "citation": "CO Supplement Sec 6E.02(A)",
            "detail": (
                f"{n_flaggers} flagger station(s); lighting not required "
                "(daytime operation; S-630-1 Sheet 2 Note 22 applies to "
                "night flagging)."
            ),
        }
    else:
        flagger_lighting_section = {
            "pass": False,
            "label": (
                f"Flagger station lighting "
                f"{COLORADO_OVERRIDES.flagger_station_light_watts}W "
                f"@ {COLORADO_OVERRIDES.flagger_station_light_height_ft} ft"
            ),
            "citation": "CO Supplement Sec 6E.02(A)",
            "detail": (
                f"{n_flaggers} flagger station(s) at night. Required: "
                f"flood lighting "
                f"({COLORADO_OVERRIDES.flagger_station_light_watts}W min "
                f"@ {COLORADO_OVERRIDES.flagger_station_light_height_ft} ft "
                "min) at each station per S-630-1 Sheet 2 Note 22. "
                "Placed: 0 (V1 does not emit lighting equipment "
                "placements)."
            ),
        }

    aadt_section = {
        "info": True,
        "label": (
            f"AADT threshold for mobile operations "
            f"(<= {COLORADO_OVERRIDES.mobile_operation_aadt_threshold:,})"
        ),
        "citation": "CO Supplement Sec 6G.02(A)",
        "detail": "Not applicable (not a mobile operation).",
    }

    co_checks = [both_sides, plaques_section, speed_reduction_section, flagger_lighting_section]
    co_section = {
        "checks": co_checks,
        "info_items": [aadt_section],
        "all_pass": all(c["pass"] for c in co_checks),
        # Engine-removal PR B: the panel's "N of M FAIL" verdict was the
        # last frontend-derived Colorado number (AuditTrail.tsx counted
        # failing checks itself).  Additive; PR C reads it.
        "fail_count": sum(1 for c in co_checks if not c["pass"]),
    }

    # ------------------------------------------------------------------
    # 6. Fines Double envelope (V1-Wide Item 3 — CO Supplement §2B.13 +
    #    S-630-1 Sheet 12).
    # ------------------------------------------------------------------
    # Three shapes, structurally distinct:
    #   A. Speed reduced AND layout emits the envelope → applicable=True
    #      with envelope geometry + Sheet 12 operational notes.
    #   B. Speed reduced AND scenario is flagger → applicable=True with
    #      gating + v1_limitation, NO envelope key (Item 3 retroactive
    #      correction: Sheet 12 carries no road-class scoping and lists
    #      LANE CLOSURE as a qualifying hazard, so the envelope IS
    #      required; V1's flagger layout does not yet emit it — the
    #      audit_projection appends a pending_verification item keyed
    #      off the v1_limitation field).
    #   C. No reduction → section entirely absent from the audit dict.
    #      Preserves byte-identity of pre-Item-3 no-reduction baselines.
    fines_double_section: dict[str, Any] | None
    # Same gate as the S1 case routing — single source of truth via the
    # hoisted `is_reduced` predicate (audit.py top of build_audit_trail).
    if not is_reduced:
        fines_double_section = None
    elif _is_flagger_scenario(params):
        env = flagger_chain_stations(params)
        fines_double_section = {
            "applicable": True,
            "citation": ("CO Supplement Sec 2B.13 + S-630-1 Sheet 12 Fines Double Signing Notes"),
            "gating": (
                "S-630-1 Sheet 12 gates Fines Double signing on worker "
                "presence in the roadway/clear zone or hazards in the "
                "travelway/shoulders/clear zone; LANE CLOSURE is a "
                "listed qualifying hazard and Sheet 12 carries no "
                "road-class scoping. A reduced-speed flagger lane "
                "closure on a 2-lane undivided road meets the gating."
            ),
            "envelope": {
                # Primary-direction stations; the opposing direction
                # carries a mirrored set (per-direction chains per CDOT
                # Cases 17/42 — see *_opposing fields).
                "r2_10_station_ft": env["r2_10_r"],
                "r2_11_station_ft": env["r2_11_r"],
                "length_ft": env["envelope_length"],
                "n_assemblies": env["n_assemblies"],
                "entrance_r2_1_station_ft": env["entrance_r2_1"],
                "entrance_r2_1_label": f"SPEED LIMIT {wz_speed}",
                "downstream_r2_1_station_ft": env["ds_r2_1_r"],
                "downstream_r2_1_label": f"SPEED LIMIT {speed}",
                "mirrored_per_direction": True,
                "r2_10_station_ft_opposing": env["r2_10_l"],
                "r2_11_station_ft_opposing": env["r2_11_l"],
                "downstream_r2_1_station_ft_opposing": env["ds_r2_1_l"],
                "geometry_note": (
                    "CDOT Case 42 chain-insertion geometry: R2-10 sits "
                    "260 ft upstream of W20-4 in each approach chain "
                    "(W20-1 moves to R2-10 + C); exit per Case 17 — "
                    "500 ft past the downstream taper end to R2-11, "
                    "500 ft further to the restoration R2-1. The "
                    "Case-11 generic formula (wz_start + 500) is not "
                    "used for flagger: it would collide with the "
                    "flagger station and violate Sheet 12 note 4's "
                    "250 ft sign spacing."
                ),
            },
            "operational_notes": _SHEET_12_OPERATIONAL_NOTES,
            "source": "CDOT S-630-1 Standard Plan, Sheet 12",
        }
    else:
        wz_start_st = wz_len
        wz_end_st = 0.0
        r2_10_st = wz_start_st + 500.0
        r2_11_st = wz_end_st - 500.0
        ds_r2_1_st = wz_end_st - 1000.0
        env_len = r2_10_st - r2_11_st
        n_asm = max(1, math.ceil(env_len / 2640.0))
        # G4 entrance R2-1 station — mirrors the layout's anchor on the
        # upstream-most §6C.06(A) construction plaque so the audit field
        # tracks whatever the generators emit.  Re-derive ``n_plaques``
        # against the same ``total_signed_length`` (= sign_c_station)
        # the layout uses; ``sign_c_station`` was computed at the
        # advance-warning section above.
        n_plaques_for_entrance = co_construction_plaques(sign_c_station)
        entrance_r2_1_st = (n_plaques_for_entrance - 0.5) * wz_len / n_plaques_for_entrance
        fines_double_section = {
            "applicable": True,
            "citation": ("CO Supplement Sec 2B.13 + S-630-1 Sheet 12 Fines Double Signing Notes"),
            "envelope": {
                "r2_10_station_ft": r2_10_st,
                "r2_11_station_ft": r2_11_st,
                "length_ft": env_len,
                "n_assemblies": n_asm,
                "entrance_r2_1_station_ft": entrance_r2_1_st,
                "entrance_r2_1_label": f"SPEED LIMIT {wz_speed}",
                "downstream_r2_1_station_ft": ds_r2_1_st,
                "downstream_r2_1_label": f"SPEED LIMIT {speed}",
            },
            "operational_notes": _SHEET_12_OPERATIONAL_NOTES,
            "source": "CDOT S-630-1 Standard Plan, Sheet 12",
        }

    # ------------------------------------------------------------------
    # 7. S-630-1 case reference
    # ------------------------------------------------------------------
    # V1-Wide S1 two-routing model (shoulder only): the shoulder branch
    # splits on the hoisted `is_reduced` predicate so reduced-speed
    # scenarios surface their Sheet 14 Case 26/27 routing instead of
    # silently masquerading as Case 11. Flagger and lane-closure
    # branches are unchanged — they have their own case structure.
    case_routing: str | None
    trigger_condition: str | None = None
    # ``narrative_2`` default (below) claims the plan follows the same
    # device layout as the reference case — true for every other kind,
    # deliberately false for near_intersection, which overrides it with
    # its disclosure (the #103 posture: name the generalization).
    case_narrative_2: str | None = None
    if is_near:
        case_routing = None
        case_label = (
            "Case 18: Traffic control around a work area near an intersection, one lane closed"
        )
        case_narrative = (
            "This scenario follows CDOT Standard Plan S-630-1, Case 18 "
            "(Sheet 10) — traffic control around a work area near an "
            "intersection, one lane closed — applied to an undivided "
            "highway with single-side mainline signing per CO Supplement "
            "§6C.04(A), plus a cross-street advance-warning set on each "
            "approach leg per MUTCD §6N.12 and the Sheet 10 "
            "advance-signing key."
        )
        case_narrative_2 = (
            "Three disclosed departures from the plate: (1) the Case 18 "
            "plate typifies corner-quadrant work with a full cross-street "
            "closure train; this plan confines the work space to the "
            "mainline and places cross-street advance signing only — "
            "corner-quadrant support is tracked at "
            "https://github.com/rtmakatura/conestruct/issues/128. "
            "(2) The opposing mainline direction is not signed "
            "(single-side undivided convention; the plate signs both "
            "directions). (3) The plate typifies rural sign placement; "
            "urban applications require block-based placement per Sheet "
            "10 Note 1. The plate's Type III corner barricade (work "
            "lasting more than 3 days) encloses the corner work area and "
            "is not placed, per departure (1)."
        )
    elif is_flagger:
        case_routing = None
        case_label = "MUTCD TA-10: Flagger one-lane two-way"
        case_narrative = (
            "This scenario matches MUTCD 11th Ed. Part 6 TA-10 (the federal "
            "standard for flagger-controlled alternating one-way traffic on "
            "a 2-lane undivided highway). CDOT S-630-1 does not include a "
            "general flagger one-lane two-way case; Case 17 (lane closure "
            "at a curve) is the closest CDOT analog but is curve-specialized."
        )
    elif is_lane:
        case_routing = None
        case_label = "Case 10: One Lane Closed - 4-Lane Divided Highway"
        case_narrative = (
            "This scenario matches CDOT Standard Plan S-630-1, Case 10: "
            "one lane closed on a 4-lane divided highway (Sheet 7)."
        )
    elif is_supplement_case:
        # Exact Case 26/27 mandated step-down (65->60, 75->65) — gated on
        # the same predicate as the buffer citation so case identity tracks
        # the buffer source.
        case_routing = "shoulder_reduced_speed"
        if speed == 65:
            case_label = "Case 26 at 65 mph: Shoulder closure with reduced work-zone speed"
            # Verbatim from Sheet 14 Case 26 diagram trigger callout
            # (tests/fixtures/cdot_s630_typicals/case_26.json:trigger_condition).
            trigger_condition = (
                "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) "
                "ARE WITHIN 8 FT OF TRAVEL WAY"
            )
        else:  # speed == 75 — the only other supplement-case speed
            case_label = "Case 27 at 75 mph: Shoulder closure with reduced work-zone speed"
            # Verbatim from Sheet 14 Case 27 diagram trigger callout
            # (tests/fixtures/cdot_s630_typicals/case_27.json:trigger_condition).
            trigger_condition = (
                "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) "
                "ARE WITHIN 10 FT OF TRAVEL WAY"
            )
        case_narrative = (
            f"This scenario matches CDOT Standard Plan S-630-1 shoulder closure "
            f"typical applications with a reduced work-zone posted speed "
            f"(Cases 26/27, Sheet 14). Posted speed reduced from {speed} → "
            f"{wz_speed} mph; Fines Double envelope applies per CO Supplement "
            f"§2B.13 and S-630-1 Sheet 12."
        )
    elif is_reduced:
        # Reduced work-zone speed but NOT the Case 26/27 mandated step-down
        # (e.g. 65->55, or any reduction at a non-65/75 speed): generic
        # Case 11 with a reduction marker, matching the buffer citation
        # (federal posted-speed value, Sheet 7 Case 11).  No Sheet 14
        # trigger text — that is tabulated only for the 65/75 step-downs.
        case_routing = "shoulder_reduced_speed"
        if params.is_divided:
            case_label = "Case 11 (reduced work-zone speed): Shoulder closure on divided highway"
            case_narrative = (
                f"This scenario matches CDOT Standard Plan S-630-1, Case 11: "
                f"shoulder closure on a divided highway, with a reduced work-zone "
                f"posted speed ({speed} → {wz_speed} mph) that does not match the "
                f"Case 26/27 mandated step-down. Fines Double envelope applies per "
                f"CO Supplement §2B.13 and S-630-1 Sheet 12."
            )
        else:
            # Case 11 is CDOT's general shoulder-work typical, drawn for
            # freeway/expressway; Conestruct applies its device chain to
            # undivided roads with single-side signing (Refs #103).
            case_label = "Case 11 (reduced work-zone speed): Shoulder closure on undivided highway"
            case_narrative = (
                f"This scenario follows CDOT Standard Plan S-630-1, Case 11 — "
                f"the general shoulder-work typical (drawn for "
                f"freeway/expressway) — applied to an undivided highway with "
                f"single-side signing per CO Supplement §6C.04(A), with a "
                f"reduced work-zone posted speed ({speed} → {wz_speed} mph) "
                f"that does not match the Case 26/27 mandated step-down. "
                f"Fines Double envelope applies per CO Supplement §2B.13 and "
                f"S-630-1 Sheet 12."
            )
    else:
        case_routing = "shoulder_no_reduction"
        if params.is_divided:
            case_label = "Case 11: Shoulder closure on divided highway"
            case_narrative = (
                "This scenario matches CDOT Standard Plan S-630-1, Case 11: "
                "shoulder closure on a divided highway."
            )
        else:
            case_label = "Case 11: Shoulder closure on undivided highway"
            case_narrative = (
                "This scenario follows CDOT Standard Plan S-630-1, Case 11 — "
                "the general shoulder-work typical (drawn for "
                "freeway/expressway) — applied to an undivided highway with "
                "single-side signing per CO Supplement §6C.04(A)."
            )
    case_section: dict[str, Any] = {
        "case": case_label,
        "url": (
            "https://www.codot.gov/safety/traffic-safety/assets/"
            "s-standard-plans/s-630-1/S-630-01%20(19-Page%20Set).pdf"
        ),
        "narrative": case_narrative,
        "narrative_2": (
            case_narrative_2
            if case_narrative_2 is not None
            else (
                f"The generated plan follows the same device layout as the "
                f"reference case with spacing computed for {speed} mph."
            )
        ),
    }
    # Routing + trigger_condition surface only when populated (shoulder
    # routing only). Absent on flagger/lane to preserve byte-identity of
    # those snapshots.
    if case_routing is not None:
        case_section["routing"] = case_routing
    if trigger_condition is not None:
        case_section["trigger_condition"] = trigger_condition

    # ------------------------------------------------------------------
    # 8. Flagger placement (only meaningful when flaggers are present)
    # ------------------------------------------------------------------
    flagger_placements = [
        p for p in mainline_placements if p.device_type == DeviceType.FLAGGER_STATION
    ]
    flagger_rows = [
        {
            "Label": p.label or f"FLAGGER_{i + 1}",
            "Station (ft)": f"{p.station_ft:,.0f}",
            "Offset (ft)": f"{p.offset_ft:+.1f}",
            "Side": "right shoulder" if p.offset_ft > 0 else "left shoulder",
        }
        for i, p in enumerate(flagger_placements)
    ]
    flagger_section = {
        "applicable": is_flagger or len(flagger_placements) > 0,
        "count": len(flagger_placements),
        "required": 2 if is_flagger else 0,
        "table": flagger_rows,
        "source": (
            "MUTCD 11th Ed. Chapter 6D (Flagger Control) and Chapter 6E "
            "(One-Lane, Two-Way Traffic Control)."
        ),
        "narrative": (
            "Two flagger stations are required for alternating one-way "
            "operations: one 100 ft upstream of the one-lane two-way "
            "taper (MUTCD Fig. 6P-10 50-100 ft band) to stop "
            "right-direction traffic, one 300 ft past the work-area end "
            "(CDOT S-630-1 Case 17 \"200' TO 300'\" standoff) to stop "
            "opposing traffic.  Flagger stations should be visible to "
            "approaching drivers from the full advance-warning distance."
        )
        if is_flagger
        else "Not applicable for this scenario.",
    }
    if is_flagger:
        # Engine-removal PR B: the flagger station sight-distance value
        # was 100% frontend-invented (AuditTrail.tsx carried its own
        # copy of Table 6B-2 under a wrong-subject §6E.06 / nonexistent
        # "Table 6E-1" citation).  Backend-sourced here; PR C deletes
        # the frontend table and renders these fields.  Citation
        # verified by SUBJECT against the local MUTCD 11th-ed PDF:
        # §6D.06 "Flagger Stations" ¶03 (PDF p.22) points to Table 6B-2
        # (PDF p.11).  Keys present only for the flagger kind — every
        # other kind's flagger section stays byte-identical.
        flagger_section["sight_distance_ft"] = _ft(stopping_sight_distance_ft(speed))
        flagger_section["sight_distance_citation"] = {
            "cite": "MUTCD § 6D.06",
            "footer": "MUTCD § 6D.06 · TABLE 6B-2 · STOPPING SIGHT DISTANCE",
        }

    # ------------------------------------------------------------------
    # 9. Corridor / aerial validation (best-effort OSM check)
    # ------------------------------------------------------------------
    # When the caller supplied site coords AND a corridor bearing, run a
    # soft check against OSM ground truth: warns if the anchor isn't on
    # a major road, or if the declared bearing diverges from the road's
    # actual heading.  Skipped silently when coords/bearing are missing
    # or Overpass is unreachable — never blocks the audit trail.
    if (
        site_lat is not None
        and site_lng is not None
        and getattr(params, "bearing_deg", None) is not None
    ):
        # Deferred import keeps the audit-trail module's import graph
        # free of httpx/Overpass code unless this branch runs.
        from src.rules.site_detection import validate_corridor_against_osm

        corridor_validation = validate_corridor_against_osm(site_lat, site_lng, params.bearing_deg)
    else:
        corridor_validation = {"checked": False, "warnings": []}

    # ------------------------------------------------------------------
    # 10. Geometry validation (work zone vs taper / buffer)
    # ------------------------------------------------------------------
    # Pre-generation sanity check.  When the work zone is shorter than
    # the required taper, the layout is geometrically impossible; the
    # render API blocks plan generation on this rule.  The buffer-vs-
    # work-zone soft rule is informational.
    geo_violations = validate_corridor_geometry(params)
    geo_section = {
        "speed_mph": speed,
        "work_zone_ft": wz_len,
        # Display-only whole-feet rounding (see _ft); validate_corridor_geometry
        # above ran on full-precision params, so the pass/fail is unaffected.
        "taper_ft": _ft(L_required),
        "taper_label": L_required_label,
        "buffer_ft": buf,
        "violations": [
            {
                "rule_id": v.rule_id,
                "severity": v.severity,
                "message": v.message,
                "mutcd_section": v.mutcd_section,
            }
            for v in geo_violations
        ],
        "all_pass": all(v.severity != "error" for v in geo_violations),
        "source": "MUTCD 11th Ed. Sec 6B.06 (buffer) and Sec 6B.08 (taper)",
    }

    # ------------------------------------------------------------------
    # 11. Cross-street approaches (near_intersection only, Refs #117)
    # ------------------------------------------------------------------
    # One entry per approach leg, with the Sheet 10 advance-signing key
    # math shown per that leg's OWN speed/road type.  Stations come from
    # near_intersection_stations — the generator's single source — so
    # the audit and the layout agree by construction.  Nested uniform
    # array (the sign_table/checks shape) so the AuditTrail UI and the
    # audit PDF can carry it with existing machinery.
    approaches_section: dict[str, Any] | None = None
    if ni is not None:
        approach_rows: list[dict[str, Any]] = []
        for a in approaches or []:
            a_st = ni["approaches"][a.id]
            approach_rows.append(
                {
                    "id": a.id,
                    "speed_mph": a.speed_mph,
                    "road_type": a.road_type,
                    "signalized": a.signalized,
                    "a_dist_ft": a_st["a_dist"],
                    "key_text": (
                        f"Sheet 10 advance-signing key: A = {a_st['a_dist']:g} ft "
                        f"at {a.speed_mph} mph ({a.road_type})"
                    ),
                    "sign_table": [
                        {
                            "Code": "W20-1",
                            "Station (ft from curb line)": f"{a_st['w20_1']:,.0f}",
                            "Placement rule": (f"2 x A = {2 * a_st['a_dist']:g} ft, approach side"),
                        },
                        {
                            "Code": "R2-10",
                            "Station (ft from curb line)": f"{a_st['r2_10']:,.0f}",
                            "Placement rule": f"A = {a_st['a_dist']:g} ft, approach side",
                        },
                        {
                            "Code": "R2-11",
                            "Station (ft from curb line)": f"{a_st['r2_11']:,.0f}",
                            "Placement rule": "100 ft, departure side (Case 18)",
                        },
                    ],
                }
            )
        approaches_section = {
            "side": ni["side"],
            "along_station_ft": ni["along_station_ft"],
            "narrative": (
                "Each cross-street leg receives its own advance set "
                "(W20-1, R2-10, R2-11), computed from that leg's own "
                "speed and road type; stations are measured along the "
                "leg from the intersection curb line, increasing away "
                "from the intersection."
            ),
            "source": ("MUTCD §6N.12; CDOT S-630-1 Sheet 10, Cases 18/19 (advance-signing key)"),
            "approaches": approach_rows,
        }

    out: dict[str, Any] = {
        "taper": taper_section,
        "buffer": buffer_section,
        "spacing": spacing_section,
        "advance": advance_section,
        "colorado": co_section,
        "case": case_section,
        "flagger": flagger_section,
        "corridor_validation": corridor_validation,
        "geometry_validation": geo_section,
        # Engine-removal PR B: the corridor-preview zone lengths,
        # backend-computed so PR D can delete the corridor-spacing.ts
        # mirror.  These are the audit's OWN numbers (single source):
        # the kind-appropriate taper (L_required), the CDOT-aware
        # buffer, the Table 6B-1 A+B+C sum, and the layout's actual
        # downstream-taper run when it placed one (the §6B.08 50-ft-
        # per-lane floor otherwise).  Geometry (anchor/bearing) stays
        # with the client — this block is lengths only.
        "corridor_spec": {
            "taper_ft": _ft(L_required),
            "buffer_ft": _ft(buf),
            "advance_warning_ft": _ft(a_ft + b_ft + c_ft),
            "downstream_taper_ft": _ft(
                -min(ds_cone_stations) if n_ds_cones else downstream_taper_length(1)
            ),
            "road_category": resolved_category,
        },
    }
    # Additive key, near_intersection only — every other kind's audit
    # dict stays byte-identical (rule #5).
    if approaches_section is not None:
        out["approaches"] = approaches_section
    # Conditional inclusion of fines_double — when the section is None
    # (no work-zone speed reduction in effect), the key is entirely
    # absent so the audit dict stays byte-identical to pre-Item-3
    # baselines for the common no-reduction case.
    if fines_double_section is not None:
        out["fines_double"] = fines_double_section
    return out


# ---------------------------------------------------------------------------
# Audit projection — scenario-kind → TA/CDOT sheet mapping
# ---------------------------------------------------------------------------

# Mirrors the per-file `TA` + `CDOT_SHEET` constants the TS estimators used
# to surface (e.g. shoulder.ts: TA-2 / S-630-1).  This is the single Python-
# side source while the TS estimators are still on disk; once they're
# deleted in PR 3 this stays the only copy.
_SCENARIO_TA_CDOT: dict[str, tuple[str, str]] = {
    # Shoulder TA is road-type-aware (TA-3 generally, TA-5 on a freeway,
    # Refs #100) — audit_projection overrides the TA half of this entry
    # via rules.validators.shoulder_ta_reference; only the CDOT sheet is
    # read from here.  "TA-3" is the general-case value, never the old
    # TA-2 (the Blasting Zone typical — a transcription error).
    "shoulder": ("TA-3", "S-630-1"),
    # Flagger cites S-630-1 (PR 3 correction): the validated fixtures
    # and match rules come from S-630-1 Sheet 9 Case 17 / Sheet 25
    # Case 42 (tests/fixtures/ta10_flagger/).  The earlier "S-630-2"
    # value referenced a CDOT safety standard this layout was never
    # verified against.
    "flagger_lane_closure": ("TA-10", "S-630-1"),
    # near_intersection (gated, Refs #117): verified by SUBJECT against
    # the local MUTCD PDF — TA-21 "Lane Closure on the Near Side of an
    # Intersection" is the typical for the situation (§6N.12.08's own
    # text names Fig. 6P-21, p. 849); the figure draws a center-lane
    # variant, and the emitted right-lane train is Fig. 6P-22's
    # near-side approach (p. 903, note 3).  audit_projection overrides
    # to TA-22 ("Right-Hand Lane Closure on the Far Side of an
    # Intersection") for far-side work.  CDOT anchor: S-630-1 Sheet 10,
    # Cases 18/19.
    "near_intersection": ("TA-21", "S-630-1"),
    # NOTE: the gated kinds below carry UNVERIFIED citations — they
    # triage with their respective enablement work (PR 3 Q3).
    "lane_closure_divided": ("TA-19", "S-630-3"),
    "work_beyond_shoulder": ("TA-1", "S-630-1"),
    "mobile_op_2lane": ("TA-35", "S-630-1"),
    "mobile_op_multilane": ("TA-26", "S-630-3"),
}


# Tracking issue for the placeholder Case # references in this module
# (the three TODO markers in the taper/case sections).  Until the
# references are verified against the 26-sheet S-630-1 set (issued July 1, 2026), the audit
# projection scrubs the TODO text from user-facing fields and surfaces
# this URL on the rollup so a reviewer can see what's pending.
AUDIT_PENDING_VERIFICATION_ISSUE: str | None = "https://github.com/rtmakatura/conestruct/issues/19"

# Tracking issue for the intersection/interchange support gap (Phase 0
# honesty, #117): the adjacent_intersection / adjacent_interchange site
# adjustments add the S-630 minimum signing only; the pending items keyed
# to this URL disclose that the cross-street / per-ramp layout and the
# signal-operation review are not generated.
INTERSECTION_SUPPORT_ISSUE: str | None = "https://github.com/rtmakatura/conestruct/issues/117"

# Tracking issue for lane-count trust (#120): when detection relays OSM
# lane tags that contradict each other (lanes != lanes:forward +
# lanes:backward + lanes:both_ways), the pending item keyed to this URL
# tells the reviewer the plan was sized to a lane count the map data
# itself disputes.  Non-blocking on the enabled kinds; the
# near_intersection kind hard-gates on the same predicate instead
# (render_api._ensure_lane_confidence).
LANE_CONFIDENCE_ISSUE: str | None = "https://github.com/rtmakatura/conestruct/issues/120"


def _ts_merging_taper_length(lane_width_ft: float, speed_mph: int) -> int:
    """Port of ``mergingTaperLength`` from conestruct/site/lib/scenarios/shared.ts.

    Returns the merging taper L in feet, rounded to the nearest integer
    (matching the TS ``Math.round`` behavior).  Used by ``_compute_step_count``
    for the shoulder heuristic's cones-count derivation — kept bit-exact
    with TS so the step_count migration is behavior-preserving on a
    user-visible number.

    Speed >= ``TAPER_LENGTH_FORMULA_THRESHOLD_MPH``: L = W x S  (linear, MUTCD §6B.08).
    Speed below the threshold:                       L = W x S² / 60  (quadratic).

    The threshold routes through the shared ``TAPER_LENGTH_FORMULA_THRESHOLD_MPH``
    (#67) rather than a hardcoded 40, so this estimator agrees with the placed
    taper at 40 mph.  This helper is a surviving TS-estimator remnant: it should
    fold into the flagger-path TS retirement (#67) — until then its bit-exact
    cone derivation is preserved deliberately.
    """
    if speed_mph < TAPER_LENGTH_FORMULA_THRESHOLD_MPH:
        return round(lane_width_ft * speed_mph * speed_mph / 60)
    return round(lane_width_ft * speed_mph)


def _compute_step_count(scenario: Any) -> int:
    """Port of the per-scenario step-count heuristics from
    ``conestruct/site/lib/scenarios/{shoulder,flagger,lane-closure-divided,
    work-beyond-shoulder,mobile-2lane,mobile-multilane}.ts`` at SHA e75cfbb.

    Returns the integer step count the OutputCards "Crew instructions"
    stat card surfaces.  Pure function of the input Scenario — does not
    consult placements, the validator, or the audit trail.  Pinned by
    behavior-preservation tests in ``tests/test_audit_endpoint.py`` so
    a future refactor cannot drift away from the TS-era values without
    a failing test.

    The shoulder branch derives ``cones`` from the input parameters using
    the same TS formulas (``mergingTaperLength`` + ``deviceSpacing``)
    rather than the actual Python placement count, because the heuristic's
    ``cones > 30`` threshold is calibrated against the TS calculation.
    """
    # Deferred import: keeps audit.py's module-level import graph free of
    # the schema layer's generator imports.  ``audit.py`` is imported by
    # build_audit_trail callers that don't need Scenario at all.
    from src.api.schemas import (
        FlaggerLaneClosureScenario,
        LaneClosureDividedScenario,
        MobileOp2LaneScenario,
        MobileOpMultilaneScenario,
        NearIntersectionScenario,
        ShoulderScenario,
        WorkBeyondShoulderScenario,
    )

    if isinstance(scenario, ShoulderScenario):
        # Duration-independent: CDOT S-630 has no reduced short-duration
        # stationary shoulder case (Cases 11/26/27 are the layout regardless
        # of duration; General Note 28 makes the typical cases minimums), and
        # the layout/devices/narrative ignore duration entirely.  The step
        # count derives from the actual cone-derived device set so the
        # "Crew instructions" stat stays consistent with the plan it counts.
        L = _ts_merging_taper_length(scenario.laneWidth, scenario.speed)
        spacing = scenario.speed  # TS deviceSpacing = posted speed
        taper_cones = max(4, math.ceil(L / spacing))
        tangent_cones = math.ceil(scenario.workLen / spacing)
        cones = taper_cones + tangent_cones
        return 14 if cones > 30 else 11

    if isinstance(scenario, FlaggerLaneClosureScenario):
        # Duration-independent: CDOT S-630 has no reduced short-duration
        # flagger case (General Note 28 makes the typical cases minimums; a
        # flagger is the control itself, with nothing to substitute), and the
        # layout/devices/narrative ignore duration entirely.  Base 16 (the
        # former long-term value) plus the optional-equipment modifiers, so
        # the "Crew instructions" stat no longer swings on a flag that changes
        # nothing else in the plan.
        steps = 16
        if scenario.pilotCar:
            steps += 2
        if scenario.pedestrianAccess:
            steps += 1
        return steps

    if isinstance(scenario, LaneClosureDividedScenario):
        steps = 14 if scenario.duration == "short" else 18
        if scenario.truckMountedAttenuator:
            steps += 2
        return steps

    if isinstance(scenario, WorkBeyondShoulderScenario):
        return 4 if scenario.duration == "short" else 6

    if isinstance(scenario, NearIntersectionScenario):
        # Duration-independent (same S-630 General Note 28 reasoning as
        # shoulder/flagger): 8 setup + 8 takedown steps in the
        # increment-3 narrative — the mainline lane-closure sequence
        # plus the mainline regulatory step and one cross-street step.
        return 16

    if isinstance(scenario, MobileOp2LaneScenario):
        return 6  # constant — mobile 2-lane has fixed lean setup

    if isinstance(scenario, MobileOpMultilaneScenario):
        return 8 if scenario.secondTMA else 6

    # Fail loud (audit fix D-03): a silent 0 here would ship a wrong
    # "Crew instructions" stat for a scenario type this port doesn't
    # know.  Unreachable for any member of the Scenario union — only a
    # new scenario kind added without extending this heuristic lands
    # here, and that must fail the build, not degrade quietly.
    raise TypeError(
        f"_compute_step_count: unknown scenario type {type(scenario).__name__!r}; "
        "extend the step-count heuristic when adding a scenario kind."
    )


def _site_citation(rule: str) -> str:
    """Discrete panel citation derived from a site-adjustment ``rule``.

    #104 — the React panel's citation chip displays ``MUTCD § 6B.04`` style
    strings while the record's ``rule`` carries the full prose
    (``MUTCD §6B.04 — increased advance warning ...``). Deriving the chip
    from the prose (prefix before the em-dash, ``§`` spaced) keeps
    site_adjustments.py's ``rule`` the single source: a citation fix there
    propagates to the panel with no second table to update.
    """
    return rule.split(" — ")[0].replace("§", "§ ")


def audit_projection(
    audit: dict[str, Any],
    scenario_kind: str,
    step_count: int = 0,
    road_type: str | None = None,
    site_records: list[dict[str, Any]] | None = None,
    lane_count_suspect: bool = False,
) -> dict[str, Any]:
    """Wrap a raw audit-trail dict in the shape the /render/audit endpoint returns.

    Two transforms on top of ``build_audit_trail``:

    1. **Summary header** — surfaces the per-scenario TA / CDOT sheet,
       the math primitives (taper, buffer, spacings) the frontend
       AuditTrail and math display previously computed in TypeScript,
       and the OutputCards crew-instructions step count.
    2. **Pending-verification scrubbing** — replaces ``(TODO: verify ...)``
       markers in ``case.case`` and ``taper.cdot_reference`` with neutral
       placeholder text, and emits a top-level ``pending_verification``
       rollup with a count + tracking-issue link.  Visible "TODO" text in
       a production audit erodes trust; the rollup preserves transparency
       without exposing partial references.

    ``step_count`` is passed in rather than derived here because the
    helper that produces it (``_compute_step_count``) needs the full
    Scenario object, while this projection only sees the post-pipeline
    audit dict.  The render-API caller threads both through.

    The original audit dict is not mutated — fields are copied as we
    transform them.  ``sections`` is the unmodified body the existing UI
    expects under each top-level key (``taper``, ``buffer``, etc.).
    """
    # Fail loud (audit fix D-03): an unknown kind silently mapping to
    # empty TA / CDOT-sheet strings would ship an audit summary with no
    # citations — the worst place for quiet degradation.  The public
    # path can't reach this (Pydantic's discriminated union only admits
    # known kinds); only a renamed/new kind that skipped this table can.
    try:
        ta, cdot_sheet = _SCENARIO_TA_CDOT[scenario_kind]
    except KeyError:
        raise ValueError(
            f"audit_projection: unknown scenario_kind {scenario_kind!r}; "
            f"expected one of {sorted(_SCENARIO_TA_CDOT)}."
        ) from None
    if scenario_kind == "shoulder":
        # Road-type-aware TA (Refs #100): TA-3 generally, TA-5 on a
        # freeway.  Same fail-loud posture as the kind lookup above — a
        # missing road_type would silently ship the wrong typical.
        if road_type is None:
            raise ValueError(
                "audit_projection: road_type is required for the shoulder "
                "kind (TA-3 vs TA-5 splits on the Table 6B-1 category)."
            )
        ta = shoulder_ta_reference(road_type)
    # Side-aware near_intersection TA (both verified by subject): TA-21
    # is the near-side figure, TA-22 the far-side one.  ``side`` derives
    # from the approaches section build_audit_trail emitted.
    if scenario_kind == "near_intersection" and audit.get("approaches", {}).get("side") == "far":
        ta = "TA-22"

    taper = dict(audit["taper"])
    case = dict(audit["case"])
    items: list[dict[str, str | None]] = []

    case_label = case.get("case", "")
    cdot_case_pending = "(TODO" in case_label
    if cdot_case_pending:
        case["case"] = "CDOT S-630-1 case reference — verification pending"
        items.append(
            {
                "kind": "cdot_case_number",
                "label": (
                    "CDOT S-630-1 case # is pending verification against the "
                    "26-sheet typical-application set (S-630-1, issued July 1, 2026)."
                ),
                "tracking_issue": AUDIT_PENDING_VERIFICATION_ISSUE,
            }
        )

    cdot_ref = taper.get("cdot_reference", "")
    if "(TODO" in cdot_ref:
        taper["cdot_reference"] = "CDOT S-630-1 case reference — verification pending"
        # Same underlying case-number question as ``case.case`` — only
        # appended to ``items`` once above, so the rollup reads
        # "1 reference pending," not "2."

    # (Item 3 retroactive correction PR 2: the interim
    # fines_double_manual_handling pending item is gone — the flagger
    # generator emits the envelope, so fines_double carries real
    # geometry and there is no gap to surface.)

    # PR 3 B5: night flagger lighting gap — mirrors the PR 1
    # manual-handling pattern.  The colorado lighting check reports the
    # failure honestly (Required ... Placed: 0); this item surfaces the
    # V1 generator gap on the pending rollup.  Keyed off the check's
    # own pass state (audit_projection has no ``params``), which is the
    # same night+flagger condition by construction — the check only
    # fails when flaggers are present at night.
    _lighting_check = next(
        (
            c
            for c in audit.get("colorado", {}).get("checks", [])
            if str(c.get("label", "")).startswith("Flagger station lighting")
        ),
        None,
    )
    if _lighting_check is not None and not _lighting_check.get("pass", True):
        items.append(
            {
                "kind": "flagger_lighting_manual_handling",
                "label": (
                    "Flagger station lighting is required for night "
                    "operations per CDOT S-630-1 Sheet 2 Note 22. V1's "
                    "flagger generator does not emit lighting equipment "
                    "placements; the traffic control supervisor must add "
                    "flood lights per project requirements until generator "
                    "support ships."
                ),
                "tracking_issue": AUDIT_PENDING_VERIFICATION_ISSUE,
            }
        )

    # Phase 0 intersection honesty (#117): the adjacent_intersection /
    # adjacent_interchange flags add NO devices (the legacy two-sign
    # gesture and the W20-3+PCMS stamp are retired) and no layout is
    # generated.  Disclose the gap as a pending item so the plan reads
    # amber honestly instead of green (rule #10).  Keyed off the fired
    # site-adjustment records threaded through by the render-API caller
    # — the same source #104 uses for sections.site_adjustments — so
    # no-flag plans are byte-identical.
    _fired_site_flags = {str(rec.get("flag", "")) for rec in (site_records or [])}
    if "adjacent_intersection" in _fired_site_flags:
        items.append(
            {
                "kind": "intersection_layout_not_generated",
                "label": (
                    "An adjacent intersection is flagged, but Conestruct "
                    "does not generate the cross-street approach layout "
                    "or evaluate traffic-signal operation, and adds no "
                    "devices for it. Cross-street control design and the "
                    "signal-operation review (MUTCD §6N.12; Part 4 for "
                    "signal-head visibility) remain with the traffic "
                    "control supervisor. Intersection support is tracked "
                    "at issue #117; corner-quadrant work at issue #128."
                ),
                "tracking_issue": INTERSECTION_SUPPORT_ISSUE,
            }
        )
    if "adjacent_interchange" in _fired_site_flags:
        items.append(
            {
                "kind": "interchange_layout_not_generated",
                "label": (
                    "An adjacent interchange is flagged, but Conestruct "
                    "does not generate the per-ramp layout and adds no "
                    "devices for it. Ramp-specific control design and "
                    "the ramp-access and coordination review (MUTCD "
                    "§6N.16) remain with the traffic control supervisor. "
                    "Tracked at issue #117."
                ),
                "tracking_issue": INTERSECTION_SUPPORT_ISSUE,
            }
        )

    # Signals flag-and-cite (near_intersection kind, Refs #117): any
    # signalized approach requires a signal-operation review that is an
    # engineering-judgment duty, not a formula — same honest posture as
    # the flagger-lighting gap above.  Keyed off the approaches section
    # build_audit_trail emitted (audit_projection has no params), so
    # every other kind — and every unsignalized intersection plan — is
    # byte-identical.
    _signalized_ids = [
        str(a.get("id"))
        for a in audit.get("approaches", {}).get("approaches", [])
        if a.get("signalized")
    ]
    if _signalized_ids:
        _ap_word = "approach" if len(_signalized_ids) == 1 else "approaches"
        items.append(
            {
                "kind": "signal_operation_review_required",
                "label": (
                    f"Signalized {_ap_word} ({', '.join(_signalized_ids)}): "
                    "Conestruct places cross-street advance signing only "
                    "and does not evaluate traffic-signal operation. The "
                    "signal-operation review — phasing, timing, and "
                    "signal-head visibility per MUTCD §6N.12 (items 04 "
                    "and 05) and MUTCD Part 4 — remains with the traffic "
                    "control supervisor and the operating agency."
                ),
                "tracking_issue": INTERSECTION_SUPPORT_ISSUE,
            }
        )

    # Lane-count consistency caution (#120, Ruling B) — the NON-blocking
    # half of the lane-confidence split: the render-API caller computes
    # ``lanes_arithmetic_mismatch`` over the scenario's relayed OSM lane
    # tags and threads the verdict here (audit_projection has no
    # scenario, same convention as ``road_type``/``site_records``).  The
    # single emission point: this item rides ``pending_verification``
    # into ``plan_flags`` and every surface that prints audit blocks, so
    # the strip, the panel, and the deliverables cannot disagree
    # (the #93 drift class).  The near_intersection kind never reaches
    # here with a mismatch — it is refused 400 at the chokepoint.
    if lane_count_suspect:
        items.append(
            {
                "kind": "lane_count_low_confidence",
                "label": (
                    "Low confidence — verify lane count. The map data's "
                    "lane tags contradict each other (the total doesn't "
                    "match the per-direction counts), so the detected "
                    "count this plan was sized to may include turn "
                    "pockets or reflect a mapping error. Confirm the "
                    "through-lane count in the field or on imagery "
                    "before deploying."
                ),
                "tracking_issue": LANE_CONFIDENCE_ISSUE,
            }
        )

    # #82: the corridor rule (validate_corridor_against_osm) emits rich
    # diagnostic dicts — anchor_lat/lng, detected_highway, bearing values,
    # detected_way_id, etc.  Slim each warning to the displayed/styling
    # shape {flag, level, message} so (a) the PDF renders the composed
    # ``message`` line instead of str()-ing the whole dict, and (b) the
    # internal diagnostics stop leaking onto the public /render/audit JSON.
    # Display-only: the detection rule is untouched and still emits the
    # full dict for other callers/logging — only the projection slims it.
    # The ``message`` sentence is the single composed display string every
    # surface renders.  No-warning baselines are left byte-identical.
    corridor = audit.get("corridor_validation")
    if isinstance(corridor, dict) and corridor.get("warnings"):
        corridor = {
            **corridor,
            "warnings": [
                {
                    "flag": w.get("flag"),
                    "level": w.get("level"),
                    "message": w.get("message"),
                }
                for w in corridor["warnings"]
            ],
        }

    sections = {**audit, "taper": taper, "case": case}
    if isinstance(corridor, dict):
        sections["corridor_validation"] = corridor

    # #104 — attach the fired site-adjustment records (from
    # apply_site_adjustments, threaded through by the render-API caller)
    # so the panel's per-flag citations read the backend instead of a
    # hardcoded frontend copy. Each record passes through verbatim plus a
    # derived discrete ``citation`` display string (the #97 pattern).
    # Attached only when a flag fired, so every no-flag projection — and
    # every existing corpus snapshot without site flags — stays
    # byte-identical (additive key, rule #5).
    if site_records:
        sections["site_adjustments"] = [
            {**rec, "citation": _site_citation(str(rec.get("rule", "")))} for rec in site_records
        ]

    speed = audit["spacing"]["speed_mph"]
    summary: dict[str, Any] = {
        "ta": ta,
        "cdot_sheet": cdot_sheet,
        "case_id": case["case"],
        # Already whole-feet from build_audit_trail; _ft here is idempotent
        # and pins the display contract at the summary boundary too.
        "taper_length_ft": _ft(taper["L_required_ft"]),
        "taper_label": taper["L_required_label"],
        "buffer_space_ft": audit["buffer"]["buffer_ft"],
        # Flagger taper spacing is the §6B.08 ~20 ft taper-specific
        # value (PR 2), not the §6K.01 speed-based rule — mirror the
        # spacing-section branch so summary and section agree.
        "device_spacing_taper_ft": (
            one_lane_two_way_device_spacing()
            if scenario_kind == "flagger_lane_closure"
            else device_spacing_in_taper(speed)
        ),
        "device_spacing_tangent_ft": device_spacing_on_tangent(speed),
        "step_count": step_count,
    }
    # V1-Wide S1: surface the routing label and Sheet 14 trigger text
    # (when applicable) as flat siblings of `case_id`. Absent on
    # flagger/lane scenarios where `case.routing` is never set.
    if "routing" in case:
        summary["case_routing"] = case["routing"]
    if "trigger_condition" in case:
        summary["trigger_condition"] = case["trigger_condition"]

    # ``note`` / ``tracking_issue`` carry items[0] for back-compat with the
    # existing AuditTrail.tsx renderer.  The new ``items`` array carries
    # the full structured list; renderer iterates that.  When no items
    # are pending, both flat fields preserve the pre-Item-1 shape
    # (empty note, AUDIT_PENDING_VERIFICATION_ISSUE URL).
    if items:
        flat_note = items[0]["label"] or ""
        flat_tracking = items[0]["tracking_issue"]
    else:
        flat_note = ""
        flat_tracking = AUDIT_PENDING_VERIFICATION_ISSUE

    # When ``items`` is empty, omit the key entirely so the
    # ``pending_verification`` shape stays byte-identical to the
    # pre-Item-1 baseline for the common no-reduction / no-TODO case.
    # When items are present, include the array for the richer renderer.
    pending_verification: dict[str, Any] = {
        "count": len(items),
        "note": flat_note,
        "tracking_issue": flat_tracking,
    }
    if items:
        pending_verification["items"] = items

    # ------------------------------------------------------------------
    # Plan-flags rollup (#60) — one derived verdict both surfaces read.
    # ------------------------------------------------------------------
    # The StatusBar strip used to show full-green "READY FOR TCS REVIEW"
    # on any plan with zero validation warnings, even when the audit
    # panel surfaced a failing compliance check or a known V1 limitation.
    # This rollup is the single source for the strip's clean/not-clean
    # verdict and its per-category breakdown, so the strip and the audit
    # panel can never disagree on "is this plan clean" (the #93 drift
    # class).  It is DERIVED on top of the existing sections /
    # pending_verification — those arrays are untouched, so AuditTrail's
    # current rendering is unchanged.  Three distinct categories, kept
    # separate because they have different lifecycles (fix-your-input vs
    # Conestruct-doesn't-do-X-yet):
    #
    #   * validation_warnings — geometry violations + (when the OSM check
    #     ran) corridor warnings.  Mirrors StatusBar.collectValidationWarnings
    #     exactly so the strip's count and the rollup never diverge.
    #   * compliance_fails — colorado.checks entries with pass == False.
    #   * v1_limitations — pending_verification.count (capability gaps).
    geo_violations = sections.get("geometry_validation", {}).get("violations", [])
    validation_warnings = len(geo_violations)
    corridor_section = sections.get("corridor_validation", {})
    if isinstance(corridor_section, dict) and corridor_section.get("checked") is True:
        validation_warnings += len(corridor_section.get("warnings", []))
    colorado_checks = sections.get("colorado", {}).get("checks", [])
    compliance_fails = sum(1 for c in colorado_checks if not c.get("pass", True))
    v1_limitations = pending_verification["count"]
    plan_flags = {
        "validation_warnings": validation_warnings,
        "compliance_fails": compliance_fails,
        "v1_limitations": v1_limitations,
        # Clean only when every category is empty — the green-READY gate.
        "is_clean": (validation_warnings == 0 and compliance_fails == 0 and v1_limitations == 0),
    }

    return {
        "summary": summary,
        "sections": sections,
        "pending_verification": pending_verification,
        "plan_flags": plan_flags,
    }
