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

from src.generation.layout import device_count_floors, flagger_chain_stations
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
    one_lane_two_way_device_spacing,
    one_lane_two_way_taper_length,
    pick_device_count,
    shoulder_taper_length,
    taper_length,
)
from src.rules.tables import (
    COLORADO_OVERRIDES,
    TAPER_LENGTH_FORMULA_THRESHOLD_MPH,
)
from src.rules.validators import (
    DevicePlacement,
    ScenarioParams,
    _is_flagger_scenario,
    validate_corridor_geometry,
)

_TABLE_6B_1_CATEGORIES: frozenset[str] = frozenset(
    {"urban_low", "urban_high", "rural", "expressway", "freeway"}
)

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


def _resolve_road_category(speed_mph: int, road_type: str) -> str:
    """Mirror the auto-inference in advance_warning_spacing."""
    if road_type in _TABLE_6B_1_CATEGORIES:
        return road_type
    if speed_mph <= 35:
        return "urban_low"
    if speed_mph < 45:
        return "urban_high"
    return "rural"


def build_audit_trail(
    placements: list[DevicePlacement],
    params: ScenarioParams,
    shoulder_width_ft: float | None = None,
    site_lat: float | None = None,
    site_lng: float | None = None,
) -> dict[str, Any]:
    """Recompute every audit-trail intermediate the verification UI needs.

    Branches on ``params.closure_type``:

    * ``"shoulder"`` — taper offset is the closed shoulder width and the
      required taper run is L/3 (MUTCD §6C.08(B)).
    * ``"lane"`` — taper offset is one lane width and the required taper
      run is the full merging taper L (MUTCD §6C.08).

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
    is_flagger = is_lane and not params.is_divided
    offset_ft = params.lane_width_ft if is_lane else shoulder_width_ft
    offset_label = "lane width" if is_lane else "shoulder width"
    # Single source of truth for "work-zone speed is reduced from the
    # posted speed". Drives both the S1 case routing
    # (shoulder_no_reduction vs shoulder_reduced_speed) and Item 3's
    # Fines Double envelope gate — same predicate, deduplicated.
    wz_speed = params.work_zone_speed_mph
    is_reduced = wz_speed is not None and wz_speed < speed

    # ------------------------------------------------------------------
    # 1. Taper length
    # ------------------------------------------------------------------
    threshold = TAPER_LENGTH_FORMULA_THRESHOLD_MPH
    if speed >= threshold:
        formula_choice = f"Speed {speed} mph >= {threshold} mph threshold -> using L = W x S"
        formula_latex = r"L = W \times S"
        L_full = float(offset_ft * speed)
        L_calc_text = f"L = {offset_ft:g} x {speed} = {L_full:g} ft"
        if speed == threshold:
            # B-05 disclosure — at exactly 40 mph MUTCD §6C.08 prescribes
            # the quadratic formula (L = W x S^2 / 60 applies *through*
            # 40; linear starts at 45).  The plan deliberately applies
            # the longer linear taper as a conservative deviation; the
            # L value itself is the settled behavior — only the audit
            # text discloses the choice instead of asserting it as the
            # MUTCD formula selection.
            formula_choice = (
                f"Speed {speed} mph: MUTCD Sec 6C.08 prescribes L = W x S^2 / 60 "
                f"at {threshold} mph; plan applies the longer L = W x S as a "
                "deliberate conservative deviation (longer taper, more transition room)"
            )
    else:
        formula_choice = f"Speed {speed} mph < {threshold} mph threshold -> using L = W x S^2 / 60"
        formula_latex = r"L = \frac{W \times S^2}{60}"
        L_full = taper_length(speed, offset_ft)
        # B-03 — the displayed arithmetic must match the formula that
        # produced the number (the linear-format text shown here used
        # to contradict the quadratic result at speeds below 40).
        L_calc_text = f"L = {offset_ft:g} x {speed}^2 / 60 = {L_full:g} ft"
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
    elif is_lane:
        L_required = L_full
        L_required_label = "L (full merging taper)"
        L_required_calc_text = f"Required: L = {L_full:g} ft (full taper for lane closure)"
        source_text = (
            "MUTCD 11th Ed. Sec 6C.08, Table 6B-3. Lane closures use the "
            "full merging taper length L."
        )
        cdot_reference = "CDOT S-630-1 Case 10 (one lane closed on 4-lane divided highway, Sheet 7)"
    else:
        L_required = L_third
        L_required_label = "L/3 (shoulder taper)"
        L_required_calc_text = f"L/3 = {L_full:g} / 3 = {L_third:.1f} ft"
        source_text = (
            "MUTCD 11th Ed. Sec 6C.08, Table 6B-3. Shoulder closures use L/3 per Sec 6C.08(B)."
        )
        # Routing-aware taper cdot_reference (V1-Wide S1). Reduced
        # work-zone speed at 65/75 mph maps to the Sheet 14 Case 26/27
        # parametric typicals; other speeds with reduction stay on
        # Case 11 with a reduction marker; no reduction is plain Case 11.
        if is_reduced and speed == 65:
            cdot_reference = (
                "CDOT S-630-1 Case 26 (shoulder closure on freeway/expressway, "
                "65 mph posted with reduced work-zone speed; Sheet 14)"
            )
        elif is_reduced and speed == 75:
            cdot_reference = (
                "CDOT S-630-1 Case 27 (shoulder closure on freeway/expressway, "
                "75 mph posted with reduced work-zone speed; Sheet 14)"
            )
        elif is_reduced:
            cdot_reference = (
                "CDOT S-630-1 Case 11 (right-shoulder closure on divided "
                "highway, reduced work-zone speed)"
            )
        else:
            cdot_reference = "CDOT S-630-1 Case 11 (right-shoulder closure on divided highway)"

    if speed == threshold and not is_flagger:
        # B-05 — mirror the formula_choice disclosure on the citation
        # line.  Skipped for flagger: the one-lane two-way taper is a
        # fixed band, so the 40-mph formula-selection deviation does
        # not arise.
        source_text += (
            " Note: at exactly 40 mph the plan deviates conservatively from "
            "the Table 6B-3 quadratic formula (L = W x S^2 / 60) by applying "
            "the longer linear L = W x S."
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
        "L_full_ft": L_full,
        "L_third_calc_text": L_required_calc_text,
        "L_third_ft": L_required,
        "L_required_ft": L_required,
        "L_required_label": L_required_label,
        "source": source_text,
        "cdot_reference": cdot_reference,
    }

    # ------------------------------------------------------------------
    # 2. Buffer space — jurisdiction-aware (V1-Wide Item 2).
    # ------------------------------------------------------------------
    # Three cases:
    #   A. CDOT + speed posts a hard minimum (Sheet 14 Cases 26/27 at
    #      65/75 mph) — divergent from MUTCD; emit full annotation with
    #      structured fields for parseable downstream consumption.
    #   B. CDOT + speed not in supplement (silent fallback) — falls
    #      back to federal MUTCD value per Sheet 2 General Note 23;
    #      flag the silence in lookup_text.
    #   C. federal jurisdiction — pure MUTCD baseline.
    # Structured divergence fields (jurisdiction/cdot_value_ft/
    # mutcd_value_ft/divergence) appear only in case A so non-divergent
    # speeds stay byte-identical to pre-Item-2 modulo the citation +
    # silent annotation.
    buf = buffer_space(speed, jurisdiction=params.jurisdiction)
    cdot_value = _cdot_buffer_or_none(speed)
    is_divergent = params.jurisdiction == "CDOT" and cdot_value is not None

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
                f"CDOT supplement: {buf:g} ft. MUTCD Table 6C-2: {mutcd_value:g} ft. "
                f"Plan uses CDOT supplement value. Note: CDOT supplement permits "
                f"shorter buffer than federal table. Verify against project-specific "
                f"engineering judgment."
            ),
            "buffer_ft": buf,
            "source": (
                f"CDOT S-630-1 Standard Plan, Sheet 14 ({_supplement_row_label}). "
                f"MUTCD 11th Ed. Sec 6C.06, Table 6C-2 (federal baseline)."
            ),
            "jurisdiction": params.jurisdiction,
            "cdot_value_ft": int(buf),
            "mutcd_value_ft": int(mutcd_value),
            "divergence": True,
        }
    elif params.jurisdiction == "CDOT":
        buffer_section = {
            "speed_mph": speed,
            "lookup_text": (f"MUTCD Table 6C-2: {buf:g} ft (CDOT supplement silent at this speed)"),
            "buffer_ft": buf,
            "source": "MUTCD 11th Ed. Sec 6C.06, Table 6C-2 (stopping sight distance)",
        }
    else:  # jurisdiction == "federal"
        buffer_section = {
            "speed_mph": speed,
            "lookup_text": f"MUTCD Table 6C-2: {buf:g} ft",
            "buffer_ft": buf,
            "source": "MUTCD 11th Ed. Sec 6C.06, Table 6C-2 (stopping sight distance)",
        }

    # ------------------------------------------------------------------
    # 3. Channelizing device spacing
    # ------------------------------------------------------------------
    # Flagger one-lane two-way taper uses the §6B.08 ¶14 ~20 ft device
    # spacing (taper-specific guidance overrides the speed-based §6C.09
    # rule); all other tapers use §6C.09 speed-in-feet.  Tangent spacing
    # is §6C.09 2x-speed everywhere.
    in_taper = one_lane_two_way_device_spacing() if is_flagger else device_spacing_in_taper(speed)
    on_tan = device_spacing_on_tangent(speed)

    # Deployed counts mirror the layout engine
    # (``src/generation/layout.py`` calls the same helper).  Naive
    # ``ceil(length / spacing)`` was wrong on two counts: it returned
    # the interval count (= devices - 1) and ignored the §6C.09
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

    actual_drums = sum(1 for p in placements if p.device_type == DeviceType.DRUM)
    actual_cones = sum(1 for p in placements if p.device_type == DeviceType.CONE)

    if is_flagger:
        taper_label = "one-lane two-way taper"
        in_taper_text = (
            f"{in_taper:g} ft spacing in the one-lane two-way taper "
            "(MUTCD Sec 6B.08: approximately 20 ft, taper-specific "
            "guidance overriding the Sec 6C.09 speed-based rule)"
        )
    else:
        taper_label = "L" if is_lane else "L/3"
        in_taper_text = (
            f"{speed} mph -> {in_taper:g} ft spacing "
            "(MUTCD Sec 6C.09: spacing equals speed in feet)"
        )
    spacing_section = {
        "speed_mph": speed,
        "in_taper_text": in_taper_text,
        "on_tangent_text": (
            f"{speed} mph -> {on_tan:g} ft spacing "
            "(MUTCD Sec 6C.09: spacing equals 2x speed in feet)"
        ),
        "taper_count_text": (
            f"{taper_label} = {L_required:.1f} ft / {in_taper:g} ft max spacing "
            f"-> {n_taper_drums} drums at {taper_interval:.1f} ft intervals"
        ),
        "tangent_count_text": (
            f"{wz_len:g} ft / {on_tan:g} ft max spacing "
            f"-> {n_tangent_cones} cones at {tangent_interval:.1f} ft intervals"
        ),
        # ``_required`` field name retained for backwards compatibility
        # with verify scripts and the Streamlit panel.  Value is now the
        # ``pick_device_count`` output (what the layout deploys), not
        # the old naive ``ceil`` (what a strict reading of §6C.09 would
        # demand).  Rename is a separate concern; see commit history.
        "n_taper_drums_required": n_taper_drums,
        "n_taper_drums_actual": actual_drums,
        "n_tangent_cones_required": n_tangent_cones,
        "n_tangent_cones_actual": actual_cones,
        "source": (
            "MUTCD 11th Ed. Sec 6B.08 (one-lane two-way taper) + Sec 6C.09 (tangent)"
            if is_flagger
            else "MUTCD 11th Ed. Sec 6C.09"
        ),
    }

    # ------------------------------------------------------------------
    # 4. Advance warning sign placement
    # ------------------------------------------------------------------
    rt_for_lookup = params.road_type if params.road_type in _TABLE_6B_1_CATEGORIES else None
    spacing_abc = advance_warning_spacing(speed, rt_for_lookup)
    a_ft = spacing_abc["A"]
    b_ft = spacing_abc["B"]
    c_ft = spacing_abc["C"]
    resolved_category = _resolve_road_category(speed, params.road_type)

    taper_end_station = wz_len + buf
    taper_start_station = taper_end_station + L_required
    sign_a_station = taper_start_station + a_ft
    sign_b_station = sign_a_station + b_ft
    sign_c_station = sign_b_station + c_ft

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
        for p in placements
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
        1 for p in placements if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft < 0
    )
    sign_right = sum(
        1 for p in placements if p.device_type == DeviceType.SIGN_GENERIC and p.offset_ft > 0
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
        for p in placements
        if p.device_type == DeviceType.SIGN_GENERIC and p.label == "G20-5P" and p.offset_ft > 0
    )
    total_signed_length = sign_c_station
    plaques_required = co_construction_plaques(total_signed_length)
    plaques_section = {
        "pass": plaques_right >= plaques_required,
        "label": "G20-5P/R2-6P construction plaques every 2,640 ft",
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
            for p in placements
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
    n_flaggers = sum(1 for p in placements if p.device_type == DeviceType.FLAGGER_STATION)
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

    co_section = {
        "checks": [both_sides, plaques_section, speed_reduction_section, flagger_lighting_section],
        "info_items": [aadt_section],
        "all_pass": all(
            c["pass"]
            for c in (
                both_sides,
                plaques_section,
                speed_reduction_section,
                flagger_lighting_section,
            )
        ),
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
    if is_flagger:
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
    elif is_reduced:
        case_routing = "shoulder_reduced_speed"
        if speed == 65:
            case_label = "Case 26 at 65 mph: Shoulder closure with reduced work-zone speed"
            # Verbatim from Sheet 14 Case 26 diagram trigger callout
            # (tests/fixtures/cdot_s630_typicals/case_26.json:trigger_condition).
            trigger_condition = (
                "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) "
                "ARE WITHIN 8 FT OF TRAVEL WAY"
            )
        elif speed == 75:
            case_label = "Case 27 at 75 mph: Shoulder closure with reduced work-zone speed"
            # Verbatim from Sheet 14 Case 27 diagram trigger callout
            # (tests/fixtures/cdot_s630_typicals/case_27.json:trigger_condition).
            trigger_condition = (
                "WHEN HAZARDS (WORKERS, EQUIPMENT, OR TEMPORARY BARRIER) "
                "ARE WITHIN 10 FT OF TRAVEL WAY"
            )
        else:
            # Sheet 14 only tabulates trigger text at 65/75 mph. Verbatim
            # or nothing: stay silent rather than fabricate a paraphrase.
            case_label = "Case 11 (reduced work-zone speed): Shoulder closure on divided highway"
        case_narrative = (
            f"This scenario matches CDOT Standard Plan S-630-1 shoulder closure "
            f"typical applications with a reduced work-zone posted speed "
            f"(Cases 26/27, Sheet 14). Posted speed reduced from {speed} → "
            f"{wz_speed} mph; Fines Double envelope applies per CO Supplement "
            f"§2B.13 and S-630-1 Sheet 12."
        )
    else:
        case_routing = "shoulder_no_reduction"
        case_label = "Case 11: Shoulder closure on divided highway"
        case_narrative = (
            "This scenario matches CDOT Standard Plan S-630-1, Case 11: "
            "shoulder closure on a divided highway."
        )
    case_section: dict[str, Any] = {
        "case": case_label,
        "url": (
            "https://www.codot.gov/safety/traffic-safety/assets/"
            "s-standard-plans/2019/s-630-1/S-630-01%20(19-Page%20Set).pdf"
        ),
        "narrative": case_narrative,
        "narrative_2": (
            f"The generated plan follows the same device layout as the "
            f"reference case with spacing computed for {speed} mph."
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
    flagger_placements = [p for p in placements if p.device_type == DeviceType.FLAGGER_STATION]
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
            "MUTCD 11th Ed. Sec 6E (Control of Traffic Through Temporary "
            "Traffic Control Zones — Flagger Control) and Sec 6C.13 "
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
        "taper_ft": L_required,
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
        "source": "MUTCD 11th Ed. Sec 6C.06 (buffer) and Sec 6C.08 (taper)",
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
    }
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
    "shoulder": ("TA-2", "S-630-1"),
    # Flagger cites S-630-1 (PR 3 correction): the validated fixtures
    # and match rules come from S-630-1 Sheet 9 Case 17 / Sheet 25
    # Case 42 (tests/fixtures/ta10_flagger/).  The earlier "S-630-2"
    # value referenced a CDOT safety standard this layout was never
    # verified against.
    "flagger_lane_closure": ("TA-10", "S-630-1"),
    # NOTE: the gated kinds below carry UNVERIFIED citations — they
    # triage with their respective enablement work (PR 3 Q3).
    "lane_closure_divided": ("TA-19", "S-630-3"),
    "work_beyond_shoulder": ("TA-1", "S-630-1"),
    "mobile_op_2lane": ("TA-35", "S-630-1"),
    "mobile_op_multilane": ("TA-26", "S-630-3"),
}


# Tracking issue for the placeholder Case # references in this module
# (the three TODO markers in the taper/case sections).  Until the
# references are verified against the 19-page S-630-1 set, the audit
# projection scrubs the TODO text from user-facing fields and surfaces
# this URL on the rollup so a reviewer can see what's pending.
AUDIT_PENDING_VERIFICATION_ISSUE: str | None = "https://github.com/rtmakatura/conestruct/issues/19"


def _ts_merging_taper_length(lane_width_ft: float, speed_mph: int) -> int:
    """Port of ``mergingTaperLength`` from conestruct/site/lib/scenarios/shared.ts.

    Returns the merging taper L in feet, rounded to the nearest integer
    (matching the TS ``Math.round`` behavior).  Used by ``_compute_step_count``
    for the shoulder heuristic's cones-count derivation — kept bit-exact
    with TS so the step_count migration is behavior-preserving on a
    user-visible number.

    Speed ≥ 40 mph: L = W × S  (linear regime, MUTCD §6C.08).
    Speed < 40 mph: L = W × S² / 60  (quadratic regime).
    """
    if speed_mph >= 40:
        return round(lane_width_ft * speed_mph)
    return round(lane_width_ft * speed_mph * speed_mph / 60)


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
        ShoulderScenario,
        WorkBeyondShoulderScenario,
    )

    if isinstance(scenario, ShoulderScenario):
        if scenario.duration == "short":
            return 8
        L = _ts_merging_taper_length(scenario.laneWidth, scenario.speed)
        spacing = scenario.speed  # TS deviceSpacing = posted speed
        taper_cones = max(4, math.ceil(L / spacing))
        tangent_cones = math.ceil(scenario.workLen / spacing)
        cones = taper_cones + tangent_cones
        return 14 if cones > 30 else 11

    if isinstance(scenario, FlaggerLaneClosureScenario):
        steps = 12 if scenario.duration == "short" else 16
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


def audit_projection(
    audit: dict[str, Any],
    scenario_kind: str,
    step_count: int = 0,
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
                    "19-page typical-application set."
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

    sections = {**audit, "taper": taper, "case": case}

    speed = audit["spacing"]["speed_mph"]
    summary: dict[str, Any] = {
        "ta": ta,
        "cdot_sheet": cdot_sheet,
        "case_id": case["case"],
        "taper_length_ft": taper["L_required_ft"],
        "taper_label": taper["L_required_label"],
        "buffer_space_ft": audit["buffer"]["buffer_ft"],
        # Flagger taper spacing is the §6B.08 ~20 ft taper-specific
        # value (PR 2), not the §6C.09 speed-based rule — mirror the
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

    return {
        "summary": summary,
        "sections": sections,
        "pending_verification": pending_verification,
    }
