"""
MHT/MOT Traffic Control Plan Generator — Streamlit UI.

Launch:
    uv run streamlit run src/api/app.py
"""

from __future__ import annotations

import os
import sys
import tempfile
import urllib.parse
from collections import Counter
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import httpx  # noqa: E402
import pandas as pd  # noqa: E402
import streamlit as st  # noqa: E402

from src._dotenv import load_dotenv  # noqa: E402
from src.api.audit import build_audit_trail  # noqa: E402
from src.export.device_list import export_device_list  # noqa: E402
from src.export.quote_generator import QuoteBreakdown, generate_quote  # noqa: E402
from src.generation.layout import (  # noqa: E402
    generate_flagger_alternating_2lane,
    generate_lane_closure_divided,
    generate_shoulder_closure_divided,
)
from src.narrative.crew_narrative import generate_crew_narrative  # noqa: E402
from src.rendering.plan_sheet import render_plan_sheet  # noqa: E402
from src.rules.night_adjustments import apply_night_adjustments  # noqa: E402
from src.rules.site_adjustments import apply_site_adjustments  # noqa: E402
from src.rules.site_detection import detect_site_conditions  # noqa: E402
from src.rules.validators import ScenarioParams, validate_layout  # noqa: E402

load_dotenv()

st.set_page_config(page_title="MHT Generator", layout="wide")

st.title("Method of Handling Traffic — Plan Generator")
st.caption(
    "Generate CDOT-compliant MHT packages: PDF plan sheet, device list, and crew instructions."
)

st.sidebar.header("Scenario Parameters")

speed_mph = st.sidebar.select_slider(
    "Speed Limit (mph)",
    options=[25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75],
    value=55,
)
num_lanes = st.sidebar.selectbox("Lanes per direction", [1, 2, 3], index=1)
lane_width_ft = st.sidebar.number_input(
    "Lane width (ft)", value=12.0, min_value=10.0, max_value=14.0, step=1.0
)
closure_type = st.sidebar.selectbox(
    "Closure type", ["shoulder", "lane", "full_road", "mobile"], index=0
)
road_type = st.sidebar.selectbox(
    "Road type",
    ["urban_low", "urban_high", "rural", "expressway", "freeway"],
    index=4,
)
work_zone_length_ft = st.sidebar.number_input(
    "Work zone length (ft)",
    value=800.0,
    min_value=100.0,
    max_value=5000.0,
    step=100.0,
)
is_divided = st.sidebar.checkbox("Divided highway", value=True)
is_night = st.sidebar.checkbox("Night operation", value=False)
st.sidebar.divider()
st.sidebar.header("Project Information")

project_name = st.sidebar.text_input(
    "Project name",
    value="",
    placeholder="e.g., I-25 NB MP 144.5–146",
    help="Surfaced on the title block (top banner + lower-right block)",
)
location_description = st.sidebar.text_input(
    "Location description",
    value="",
    placeholder="e.g., Colorado Springs",
    help="Shown on the LOCATION row of the title block",
)

st.sidebar.divider()
st.sidebar.header("Location (optional)")

site_address = st.sidebar.text_input(
    "Street address or intersection",
    value="",
    placeholder="e.g., US-85 & Bromley Ln, Brighton, CO",
)
site_lat = st.sidebar.number_input(
    "Latitude", value=0.0, format="%.6f", help="Leave at 0 to skip aerial embed"
)
site_lng = st.sidebar.number_input(
    "Longitude", value=0.0, format="%.6f", help="Leave at 0 to skip aerial embed"
)
bearing_deg_input = st.sidebar.number_input(
    "Road bearing (° from N, optional)",
    value=0.0,
    min_value=0.0,
    max_value=360.0,
    step=5.0,
    help=(
        "Compass direction the road runs, in degrees clockwise from "
        "north (0 = N, 90 = E, 180 = S, 270 = W). E.g., a north-running "
        "stretch of I-25 ≈ 0°. Leave at 0 to default to ↑ = North."
    ),
)
# 0.0 doubles as the "no bearing supplied" sentinel — matches the
# pattern used for site_lat/site_lng above so the UI stays consistent.
bearing_deg = bearing_deg_input if bearing_deg_input > 0.0 else None

_mapbox_token = os.environ.get("MAPBOX_TOKEN", "")
_location_provided = bool(site_address) or site_lat != 0.0 or site_lng != 0.0
if _location_provided and not _mapbox_token:
    st.sidebar.warning("Set MAPBOX_TOKEN in .env to enable aerial imagery")


def _geocode_address(address: str, token: str) -> tuple[float, float] | None:
    """Resolve a street address to (lat, lng) via the Mapbox Geocoding API.

    Returns ``None`` on any failure (network error, empty result, bad token).
    """
    query = urllib.parse.quote(address, safe="")
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json"
    try:
        r = httpx.get(url, params={"access_token": token, "limit": 1}, timeout=10.0)
        r.raise_for_status()
        feats = r.json().get("features", [])
        if not feats:
            return None
        lng, lat = feats[0]["center"]
        return float(lat), float(lng)
    except Exception as exc:  # noqa: BLE001
        print(f"[mapbox] geocoding failed: {type(exc).__name__}: {exc}")
        return None


with st.sidebar.expander("Quote Settings"):
    include_quote = st.checkbox("Generate pricing quote", value=False)
    if include_quote:
        project_duration = st.number_input(
            "Project duration (days)", value=1, min_value=1, max_value=365
        )
        num_flaggers = st.number_input("Number of flaggers", value=0, min_value=0, max_value=20)
        delivery_distance = st.number_input(
            "Delivery distance one-way (miles)", value=20.0, min_value=0.0, step=5.0
        )
    else:
        project_duration = 1
        num_flaggers = 0
        delivery_distance = 20.0


if site_address and site_lat == 0.0 and site_lng == 0.0 and _mapbox_token:
    resolved = _geocode_address(site_address, _mapbox_token)
    if resolved is not None:
        site_lat, site_lng = resolved
        st.sidebar.caption(f"Resolved: {site_lat:.6f}, {site_lng:.6f}")
    else:
        st.sidebar.caption("Could not resolve address — leaving coordinates at 0.")

# Adjustment-flag → human label. Keys match apply_site_adjustments() flags so
# the checkbox dict can be passed straight through to the rules layer.
_SITE_CONDITION_LABELS: dict[str, str] = {
    "limited_sight_distance": "Limited sight distance (curve, hill crest)",
    "adjacent_intersection": "Adjacent at-grade intersection (signal/stop/etc.)",
    "adjacent_interchange": "Adjacent interchange (highway ramps)",
    "driveways_present": "Driveways present within work zone",
    "pedestrian_facility": "Pedestrian sidewalks present",
    "bicycle_facility": "Bike lane / cycleway present",
    "school_zone": "School within proximity",
}

# Map detection categories from site_detection.detect_site_conditions() into
# the adjustment-flag keys above. Categories with no rule-engine action
# (railroad_crossings, hospitals) are surfaced in the audit expander but do
# not auto-check anything. limited_sight_distance and driveways_present have
# no detection counterpart yet — they remain manual-only.
_DETECTION_TO_FLAG: dict[str, str] = {
    "intersections": "adjacent_intersection",
    "interchanges": "adjacent_interchange",
    "sidewalks": "pedestrian_facility",
    "bike_facilities": "bicycle_facility",
    "schools": "school_zone",
}

with st.sidebar.expander("Site Conditions"):
    detection_radius_m = st.number_input(
        "Scan radius (m)", value=500, min_value=100, max_value=2000, step=100
    )
    has_coords = bool(site_lat) and bool(site_lng)
    detect_clicked = st.button(
        "Detect Site Conditions",
        disabled=not has_coords,
        help="Requires latitude and longitude. Queries OpenStreetMap (Overpass API).",
        use_container_width=True,
    )
    if detect_clicked:
        with st.spinner("Scanning area via OpenStreetMap…"):
            result = detect_site_conditions(site_lat, site_lng, radius_m=float(detection_radius_m))
        st.session_state["site_detection"] = {
            "lat": site_lat,
            "lng": site_lng,
            "radius_m": float(detection_radius_m),
            "result": result,
        }
        # Seed checkbox state so detection results pre-fill the manual flags.
        # Without this, Streamlit's widget state (keyed) wins over the value=
        # arg on the next rerun, and prefill is silently ignored.
        if "error" not in result:
            for det_key, flag_key in _DETECTION_TO_FLAG.items():
                st.session_state[f"site_cond_{flag_key}"] = bool(
                    result.get(det_key, {}).get("detected")
                )

    detection = st.session_state.get("site_detection")
    if detection and "result" in detection:
        result = detection["result"]
        if "error" in result:
            st.warning(f"Detection failed: {result['error']}. Using manual input only.")
        else:
            st.caption("Auto-detected from OpenStreetMap:")
            any_detected = False
            for det_key, flag_key in _DETECTION_TO_FLAG.items():
                bucket = result.get(det_key, {})
                if bucket.get("detected"):
                    any_detected = True
                    label = _SITE_CONDITION_LABELS.get(flag_key, flag_key)
                    nearest = bucket.get("nearest_distance_m")
                    nearest_txt = f", nearest ~{nearest:.0f} m" if nearest else ""
                    sample = bucket["details"][0] if bucket.get("details") else "unnamed"
                    st.write(f"✅ **{label}** — {bucket['count']} found{nearest_txt} ({sample})")
            if not any_detected:
                st.write("No flagged features detected within scan radius.")
            st.caption("Manual overrides:")

    site_conditions: dict[str, bool] = {}
    detection_result = (detection or {}).get("result") or {}
    flag_to_detection = {flag: det for det, flag in _DETECTION_TO_FLAG.items()}
    for flag_key, label in _SITE_CONDITION_LABELS.items():
        det_key = flag_to_detection.get(flag_key)
        prefill = bool(det_key and detection_result.get(det_key, {}).get("detected"))
        site_conditions[flag_key] = st.checkbox(label, value=prefill, key=f"site_cond_{flag_key}")

generate_button = st.sidebar.button(
    "Generate MHT Package", type="primary", use_container_width=True
)


def _device_breakdown_df(placements) -> pd.DataFrame:
    counts = Counter((p.device_type.value, p.label or "") for p in placements)
    rows = [
        {"Device Type": dt, "Label": lbl, "Count": n} for (dt, lbl), n in sorted(counts.items())
    ]
    return pd.DataFrame(rows)


if generate_button:
    is_flagger_scenario = closure_type == "lane" and num_lanes == 1 and not is_divided
    is_divided_scenario = closure_type in ("shoulder", "lane") and is_divided
    supported = is_divided_scenario or is_flagger_scenario
    if not supported:
        st.warning(
            "V1 supports: (1) shoulder or lane closure on a divided "
            "highway, and (2) flagger-controlled alternating traffic on a "
            "2-lane undivided road (lane closure with 1 lane per direction "
            "and divided highway unchecked). Other scenarios coming soon. "
            "Generating with shoulder closure defaults."
        )

    params = ScenarioParams(
        speed_mph=speed_mph,
        num_lanes=num_lanes,
        closure_type=closure_type,
        road_type=road_type,
        work_zone_length_ft=work_zone_length_ft,
        lane_width_ft=lane_width_ft,
        is_night=is_night,
        is_divided=is_divided,
        jurisdiction="CDOT",
        project_name=project_name or "Untitled Project",
        location_description=location_description or site_address or "",
        bearing_deg=bearing_deg,
    )

    try:
        if is_flagger_scenario:
            placements = generate_flagger_alternating_2lane(params)
        elif closure_type == "lane" and is_divided:
            placements = generate_lane_closure_divided(params)
        else:
            placements = generate_shoulder_closure_divided(params)
        placements, site_adj = apply_site_adjustments(placements, params, site_conditions)
        placements, night_adj = apply_night_adjustments(placements, params)
        violations = validate_layout(placements, params)
        errors = [v for v in violations if v.severity == "error"]
        warnings = [v for v in violations if v.severity == "warning"]

        if errors:
            st.error(f"{len(errors)} validation error(s) — review before field use:")
            for v in errors:
                st.write(f"- **{v.rule_id}** ({v.mutcd_section}): {v.message}")
        elif warnings:
            st.info(f"{len(warnings)} validation warning(s). See details below.")

        tmpdir = tempfile.mkdtemp(prefix="mht_")
        pdf_path = os.path.join(tmpdir, "plan_sheet.pdf")
        xlsx_path = os.path.join(tmpdir, "device_list.xlsx")
        md_path = os.path.join(tmpdir, "crew_narrative.md")

        render_plan_sheet(
            placements,
            params,
            output_path=pdf_path,
            project_name=project_name,
            site_lat=site_lat if (site_lat or site_lng) else None,
            site_lng=site_lng if (site_lat or site_lng) else None,
            site_address=site_address,
            site_flags=site_conditions,
        )
        export_device_list(placements, params, output_path=xlsx_path)
        generate_crew_narrative(
            placements,
            params,
            output_path=md_path,
            site_adjustments=site_adj,
            night_adjustments=night_adj,
        )

        quote_bytes: bytes | None = None
        quote_breakdown: QuoteBreakdown | None = None
        if include_quote:
            quote_path = os.path.join(tmpdir, "quote.xlsx")
            _, quote_breakdown = generate_quote(
                placements,
                params,
                output_path=quote_path,
                project_name=project_name or "Untitled Project",
                project_duration_days=int(project_duration),
                num_flaggers=int(num_flaggers),
                delivery_distance_miles=float(delivery_distance),
            )
            with open(quote_path, "rb") as f:
                quote_bytes = f.read()

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        with open(xlsx_path, "rb") as f:
            xlsx_bytes = f.read()
        with open(md_path, "rb") as f:
            md_bytes = f.read()
        crew_narrative_content = md_bytes.decode("utf-8")

        unique_type_count = len({p.device_type for p in placements})

        if include_quote and quote_bytes is not None and quote_breakdown is not None:
            col1, col2, col3, col4 = st.columns(4)
        else:
            col1, col2, col3 = st.columns(3)

        with col1:
            st.subheader("Plan Sheet")
            st.download_button(
                "Download PDF",
                data=pdf_bytes,
                file_name="plan_sheet.pdf",
                mime="application/pdf",
                use_container_width=True,
            )
            st.metric("Devices", len(placements))

        with col2:
            st.subheader("Device List")
            st.download_button(
                "Download Excel",
                data=xlsx_bytes,
                file_name="device_list.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                use_container_width=True,
            )
            st.metric("Unique Types", unique_type_count)

        with col3:
            st.subheader("Crew Instructions")
            st.download_button(
                "Download Markdown",
                data=md_bytes,
                file_name="crew_narrative.md",
                mime="text/markdown",
                use_container_width=True,
            )

        if include_quote and quote_bytes is not None and quote_breakdown is not None:
            with col4:
                st.subheader("Quote")
                st.download_button(
                    "Download Quote",
                    data=quote_bytes,
                    file_name="quote.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    use_container_width=True,
                )
                st.metric("Total Estimate", f"${quote_breakdown.total:,.0f}")

        if include_quote and quote_breakdown is not None:
            st.divider()
            st.subheader("Quote Breakdown")
            st.caption(
                "Click any category to drill into the line items that make up "
                "the cost. The downloaded workbook holds the same numbers."
            )

            qb = quote_breakdown
            with st.expander(f"Equipment Rental — ${qb.equipment_total:,.2f}"):
                if qb.equipment_lines:
                    eq_df = pd.DataFrame(
                        {
                            "Item": [line.item_number for line in qb.equipment_lines],
                            "Device Type": [line.device_type for line in qb.equipment_lines],
                            "Label": [line.label for line in qb.equipment_lines],
                            "Description": [line.description for line in qb.equipment_lines],
                            "Qty": [line.qty for line in qb.equipment_lines],
                            "Unit": [line.unit for line in qb.equipment_lines],
                            "Daily Rate": [
                                f"${line.daily_rate:,.2f}" for line in qb.equipment_lines
                            ],
                            "Days": [line.days for line in qb.equipment_lines],
                            "Extended": [f"${line.extended:,.2f}" for line in qb.equipment_lines],
                            "Notes": [line.note for line in qb.equipment_lines],
                        }
                    )
                    st.dataframe(eq_df, use_container_width=True, hide_index=True)
                else:
                    st.write("No equipment placed.")

            with st.expander(f"Labor — ${qb.labor_total:,.2f}"):
                lab_df = pd.DataFrame(
                    {
                        "Role": [line.role for line in qb.labor_lines],
                        "Personnel": [line.personnel for line in qb.labor_lines],
                        "Hours/Day": [line.hours_per_day for line in qb.labor_lines],
                        "Days": [line.days for line in qb.labor_lines],
                        "Rate ($/hr)": [f"${line.rate:,.2f}" for line in qb.labor_lines],
                        "Extended": [f"${line.extended:,.2f}" for line in qb.labor_lines],
                    }
                )
                st.dataframe(lab_df, use_container_width=True, hide_index=True)
                if qb.is_night:
                    st.caption(
                        f"Night differential applied: all labor lines × {qb.night_multiplier:.1f}x."
                    )
                st.caption(
                    "Standard shift: 10 hours including mobilization. "
                    "Overtime billed at 1.5x after 8 hours per Colorado labor law."
                )

            with st.expander(f"Delivery & Logistics — ${qb.delivery_total:,.2f}"):
                del_df = pd.DataFrame(
                    {
                        "Item": [line.item for line in qb.delivery_lines],
                        "Trips": [line.trips for line in qb.delivery_lines],
                        "Distance (mi)": [line.distance_miles for line in qb.delivery_lines],
                        "Rate ($/mi)": [
                            f"${line.rate_per_mile:,.2f}" for line in qb.delivery_lines
                        ],
                        "Min Charge": [
                            f"${line.min_trip_charge:,.2f}" for line in qb.delivery_lines
                        ],
                        "Extended": [f"${line.extended:,.2f}" for line in qb.delivery_lines],
                    }
                )
                st.dataframe(del_df, use_container_width=True, hide_index=True)

            with st.expander(
                f"Markup — ${qb.overhead + qb.profit:,.2f} "
                f"(overhead {qb.overhead_pct * 100:.0f}%, profit {qb.profit_pct * 100:.0f}%)"
            ):
                markup_df = pd.DataFrame(
                    [
                        ("Subtotal (pre-markup)", f"${qb.subtotal:,.2f}"),
                        (f"Overhead ({qb.overhead_pct * 100:.0f}%)", f"${qb.overhead:,.2f}"),
                        (f"Profit ({qb.profit_pct * 100:.0f}%)", f"${qb.profit:,.2f}"),
                        ("TOTAL ESTIMATE", f"${qb.total:,.2f}"),
                    ],
                    columns=["", "Amount"],
                )
                st.dataframe(markup_df, use_container_width=True, hide_index=True)
                st.caption(
                    "Profit is calculated on subtotal + overhead, the standard "
                    "Colorado vendor convention."
                )

        audit = build_audit_trail(
            placements,
            params,
            site_lat=site_lat if (site_lat or site_lng) else None,
            site_lng=site_lng if (site_lat or site_lng) else None,
        )

        st.subheader("Verification & Audit Trail")
        st.caption(
            "Every calculation traced to its MUTCD or CDOT standard-plan "
            "source. Verify before stamping."
        )

        t = audit["taper"]
        with st.expander(
            f"Taper Length Calculation ({t['L_required_label']} = {t['L_required_ft']:.1f} ft)"
        ):
            st.write(
                f"**Inputs:** speed = {t['speed_mph']} mph, "
                f"{t['offset_label']} = {t['offset_ft']:g} ft"
            )
            st.write(f"**Formula selection:** {t['formula_choice']}")
            st.latex(t["formula_latex"])
            st.code(t["L_calc_text"], language="text")
            st.code(t["L_third_calc_text"], language="text")
            st.write(f"**Source:** {t['source']}")
            st.write(f"**CDOT reference:** {t['cdot_reference']}")

        b = audit["buffer"]
        with st.expander(f"Buffer Space Calculation ({b['buffer_ft']:g} ft)"):
            st.write(f"**Input:** speed = {b['speed_mph']} mph")
            st.code(b["lookup_text"], language="text")
            st.write(f"**Source:** {b['source']}")

        sp = audit["spacing"]
        with st.expander(
            f"Channelizing Device Spacing "
            f"({sp['n_taper_drums_required']} drums + "
            f"{sp['n_tangent_cones_required']} cones required)"
        ):
            st.code(f"In taper:    {sp['in_taper_text']}", language="text")
            st.code(f"On tangent:  {sp['on_tangent_text']}", language="text")
            st.code(f"Taper:       {sp['taper_count_text']}", language="text")
            st.code(f"Tangent:     {sp['tangent_count_text']}", language="text")
            if sp.get("downstream_count_text"):
                st.code(f"Downstream:  {sp['downstream_count_text']}", language="text")
            st.write(
                f"Actual placed: {sp['n_taper_drums_actual']} drums, "
                f"{sp['n_tangent_cones_actual']} cones."
            )
            st.write(f"**Source:** {sp['source']}")

        a = audit["advance"]
        with st.expander(f"Advance Warning Sign Placement ({len(a['sign_table'])} signs per side)"):
            st.write(f"**Road type determination:** {a['road_type_text']}")
            st.write(f"**Spacing:** {a['spacing_text']}")
            st.table(a["sign_table"])
            st.write(f"**Source:** {a['source']}")

        co = audit["colorado"]
        co_summary = "all checks pass" if co["all_pass"] else "review required"
        with st.expander(f"Colorado Requirements — CDOT S-630-1 ({co_summary})"):
            for check in co["checks"]:
                icon = "✅" if check["pass"] else "❌"
                st.write(f"{icon} **{check['label']}** ({check['citation']}) — {check['detail']}")
            for item in co["info_items"]:
                st.write(f"ℹ️ **{item['label']}** ({item['citation']}) — {item['detail']}")

        fl = audit["flagger"]
        if fl["applicable"]:
            with st.expander(
                f"Flagger Placement ({fl['count']} placed, {fl['required']} required)"
            ):
                if fl["table"]:
                    st.table(fl["table"])
                st.write(fl["narrative"])
                st.write(f"**Source:** {fl['source']}")

        cs = audit["case"]
        with st.expander(f"S-630-1 Case Reference ({cs['case']})"):
            st.write(cs["narrative"])
            st.write(f"Download the official CDOT S-630-1 PDF to compare: [link]({cs['url']})")
            st.write(cs["narrative_2"])

        if site_adj:
            adj_total = sum(a.get("devices_added", 0) for a in site_adj)
            with st.expander(f"Site Adjustments ({adj_total} devices added)"):
                for adj in site_adj:
                    st.write(f"**{adj['flag']}** — {adj['action']}")
                    st.caption(adj["rule"])

        if night_adj:
            night_total = sum(a.get("devices_added", 0) for a in night_adj)
            with st.expander(f"Night Operation Adjustments ({night_total} devices added)"):
                for adj in night_adj:
                    st.write(f"**{adj['flag']}** — {adj['action']}")
                    st.caption(adj["rule"])

        cv = audit.get("corridor_validation") or {}
        cv_warnings = cv.get("warnings") or []
        if cv.get("checked") and cv_warnings:
            with st.expander(
                f"Corridor / Aerial Validation ({len(cv_warnings)} warning"
                f"{'s' if len(cv_warnings) != 1 else ''})"
            ):
                for warning in cv_warnings:
                    st.warning(f"**{warning['flag']}** — {warning['message']}")

        detection_state = st.session_state.get("site_detection")
        if detection_state and "result" in detection_state:
            det_result = detection_state["result"]
            detected_keys = [
                k for k, v in det_result.items() if isinstance(v, dict) and v.get("detected")
            ]
            with st.expander(f"Site Condition Detection ({len(detected_keys)} flagged)"):
                st.write(
                    f"**Scanned:** lat {detection_state['lat']:.6f}, "
                    f"lng {detection_state['lng']:.6f}, "
                    f"radius {detection_state['radius_m']:.0f} m"
                )
                if "error" in det_result:
                    st.write(f"❌ Detection failed: {det_result['error']}")
                elif not detected_keys:
                    st.write("No flagged features within scan radius.")
                else:
                    for key in detected_keys:
                        bucket = det_result[key]
                        label = _SITE_CONDITION_LABELS.get(key, key)
                        nearest = bucket.get("nearest_distance_m")
                        nearest_txt = f" (nearest ~{nearest:.0f} m)" if nearest else ""
                        st.write(
                            f"✅ **{label}** — {bucket.get('count', 0)} feature(s){nearest_txt}"
                        )
                        for detail in bucket.get("details", [])[:3]:
                            st.write(f"  - {detail}")
                st.write("**Source:** OpenStreetMap via Overpass API")
                st.caption(
                    "Auto-detection is approximate. OSM coverage varies by area; "
                    "verify site conditions with field inspection before field use."
                )

        st.divider()
        st.subheader("Plan Details")

        with st.expander("Preview: Crew Instructions"):
            st.markdown(crew_narrative_content)

        with st.expander("Validation Results"):
            if violations:
                for v in violations:
                    icon = "🔴" if v.severity == "error" else "🟡"
                    st.write(f"{icon} **{v.rule_id}** ({v.mutcd_section}): {v.message}")
            else:
                st.success("All MUTCD and Colorado (CDOT S-630-1) checks passed.")

        with st.expander("Device Breakdown"):
            st.dataframe(_device_breakdown_df(placements), use_container_width=True)

    except Exception as exc:
        st.error(f"Generation failed: {type(exc).__name__}: {exc}")

st.divider()
st.caption(
    "MHT Tool v0.1 — For review purposes only. A certified Traffic Control "
    "Supervisor (TCS) must approve all plans before field implementation. "
    "Reference: CDOT S-630-1, MUTCD 11th Ed., Colorado Supplement (Jan 2026)."
)
