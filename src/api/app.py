"""
MHT/MOT Traffic Control Plan Generator — Streamlit UI.

Launch:
    uv run streamlit run src/api/app.py
"""

from __future__ import annotations

import os
import sys
import tempfile
from collections import Counter
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

import pandas as pd  # noqa: E402
import streamlit as st  # noqa: E402

from src.api.audit import build_audit_trail  # noqa: E402
from src.export.device_list import export_device_list  # noqa: E402
from src.generation.layout import generate_shoulder_closure_divided  # noqa: E402
from src.narrative.crew_narrative import generate_crew_narrative  # noqa: E402
from src.rendering.plan_sheet import render_plan_sheet  # noqa: E402
from src.rules.validators import ScenarioParams, validate_layout  # noqa: E402

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
    ["urban_low", "urban_high", "rural", "expressway", "divided_highway"],
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
project_name = st.sidebar.text_input("Project name (optional)", value="")

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
    if closure_type != "shoulder" or road_type != "divided_highway":
        st.warning(
            "V1 supports shoulder closure on divided highways only. "
            "Other scenarios coming soon. Generating with shoulder closure "
            "defaults."
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
    )

    try:
        placements = generate_shoulder_closure_divided(params)
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
        )
        export_device_list(placements, params, output_path=xlsx_path)
        generate_crew_narrative(placements, params, output_path=md_path)

        with open(pdf_path, "rb") as f:
            pdf_bytes = f.read()
        with open(xlsx_path, "rb") as f:
            xlsx_bytes = f.read()
        with open(md_path, "rb") as f:
            md_bytes = f.read()
        crew_narrative_content = md_bytes.decode("utf-8")

        unique_type_count = len({p.device_type for p in placements})

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

        audit = build_audit_trail(placements, params)

        st.subheader("Verification & Audit Trail")
        st.caption(
            "Every calculation traced to its MUTCD or Colorado Supplement "
            "source. Verify before stamping."
        )

        t = audit["taper"]
        with st.expander(f"Taper Length Calculation (L/3 = {t['L_third_ft']:.1f} ft)"):
            st.write(
                f"**Inputs:** speed = {t['speed_mph']} mph, offset = {t['shoulder_width_ft']:g} ft"
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
        with st.expander(f"Colorado Supplement Requirements ({co_summary})"):
            for check in co["checks"]:
                icon = "✅" if check["pass"] else "❌"
                st.write(f"{icon} **{check['label']}** ({check['citation']}) — {check['detail']}")
            for item in co["info_items"]:
                st.write(f"ℹ️ **{item['label']}** ({item['citation']}) — {item['detail']}")

        cs = audit["case"]
        with st.expander(f"S-630-1 Case Reference ({cs['case']})"):
            st.write(cs["narrative"])
            st.write(f"Download the official CDOT S-630-1 PDF to compare: [link]({cs['url']})")
            st.write(cs["narrative_2"])

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
                st.success("All MUTCD and Colorado Supplement checks passed.")

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
