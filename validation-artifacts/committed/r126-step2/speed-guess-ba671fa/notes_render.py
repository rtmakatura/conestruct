"""R127 Q7 evidence: the plan sheet's notes box with and without the speed guess.

N Cherry St as the site sends it after R126: a shoulder plan at 25 mph with
guesses.speed {highwayClass: residential}; the same plan without the record.
Renders page 1 through the API (TestClient, no network), crops the NOTES box.
Usage: python notes_render.py <repo-root> <out-dir>
"""
import os
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
OUT = Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "probe"

import fitz  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from src.api.render_api import app  # noqa: E402

body = {
    "kind": "shoulder",
    "meta": {"project": "N Cherry St", "address": "N Cherry St, Denver"},
    "roadType": "urban_arterial",
    "speed": 25,
    "lanes": 1,
    "laneWidth": 12.0,
    "divided": False,
    "workType": "utility_locate",
    "duration": "short",
    "workLen": 500.0,
    "night": False,
}
c = TestClient(app)
for name, b in [("guessed", {**body, "guesses": {"speed": {"highwayClass": "residential"}}}), ("not-guessed", body)]:
    r = c.post("/render/pdf", json=b, headers={"Authorization": "Bearer probe"})
    assert r.status_code == 200, r.text[:300]
    doc = fitz.open(stream=r.content, filetype="pdf")
    page = doc[0]
    hits = page.search_for("NOTES & SIGN SCHEDULE")
    text = " ".join(page.get_text().split())
    print(name, "notes line present:", "SPEED GUESSED FROM THE ROAD CLASS. CONFIRM THE POSTED SPEED ON SITE." in text)
    if hits:
        box = hits[0]
        clip = fitz.Rect(box.x0 - 10, box.y0 - 6, box.x0 + 330, page.rect.y1 - 4)
        page.get_pixmap(clip=clip, dpi=220).save(str(OUT / f"notes-{name}.png"))
