"""
MHT/MOT Traffic Control Plan Generator — Streamlit UI.

Launch:
    uv run streamlit run src/api/app.py
"""

import streamlit as st

st.set_page_config(
    page_title="MHT/MOT Generator",
    page_icon="🚧",
    layout="centered",
)

st.title("Coming Soon — MHT Generation Tool")

st.markdown(
    """
    Generate complete Maintenance of Traffic (MHT/MOT) plan packages from a
    simple work zone description. Describe the jurisdiction, speed limit, lane
    count, closure type, and duration — and receive three files:

    1. **PDF plan sheet** rendered in CDOT S-630-1 typical style on schematic
       road geometry
    2. **Excel device list** with CDOT Section 630 pay items and quantities
    3. **Crew narrative** with setup instructions, flagger positions, and
       takedown sequence

    *Primary market: Colorado (CDOT state highways). V1 in development.*
    """
)

st.info("This application is under active development. Check back soon.")
