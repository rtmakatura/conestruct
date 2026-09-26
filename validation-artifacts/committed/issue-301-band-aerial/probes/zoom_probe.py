"""Zoom ruling (2026-09-26) — the band's picture at each zoom step, real Mapbox.

Posts the Broadway SB and Lafayette flagger fixtures (tests/fixtures/corridor)
to THIS branch's ``POST /render/corridor-map`` via TestClient, laid out, at
600x300 (1440) and 348x250 (380), for every step -1..+3, and saves the PNGs
beside this file.  Step 0 is Mapbox's own ``auto``; the others are the
backend's fit (static_aerial.fit_view) stepped — the pictures show whether
the fit agrees with ``auto`` and where a step in looks (the work).

    python zoom_probe.py > zoom-probe.txt

Needs MAPBOX_TOKEN (read from the repo root's .env if unset; never printed).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
if not os.environ.get("MAPBOX_TOKEN"):
    for env in (ROOT / ".env", ROOT.parents[2] / ".env"):
        if env.exists():
            for line in env.read_text(encoding="utf-8").splitlines():
                if line.startswith("MAPBOX_TOKEN="):
                    os.environ["MAPBOX_TOKEN"] = line.split("=", 1)[1].strip().strip('"')
os.environ.setdefault("RENDER_API_SECRET", "zoom-probe")

from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402

client = TestClient(app)
H = {"Authorization": f"Bearer {os.environ['RENDER_API_SECRET']}"}
OUT = Path(__file__).parent / "zoom"
OUT.mkdir(exist_ok=True)
for name in ("broadway-sb", "lafayette-flagger"):
    scenario = json.loads((ROOT / "tests/fixtures/corridor" / f"{name}.json").read_text(encoding="utf-8"))
    for w, h in ((600, 300), (348, 250)):
        for zoom in (-1, 0, 1, 2, 3):
            r = client.post(
                "/render/corridor-map",
                headers=H,
                json={"scenario": scenario, "stage": "laid_out", "width": w, "height": h, "zoom": zoom},
            )
            f = OUT / f"{name}-{w}x{h}-z{zoom:+d}.png"
            if r.status_code == 200:
                f.write_bytes(r.content)
            print(f"{name} {w}x{h} zoom {zoom:+d}: {r.status_code} {len(r.content)} bytes -> {f.name}")
