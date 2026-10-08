"""Shoulder arrow board (R119 Q1) — before/after capture through the real API.

Two live shoulder plans, through FastAPI's TestClient on THIS checkout
(Overpass stubbed, no network, no prod request):

  * ``broadway`` — N Broadway SB (39.7337, -104.98753), a one-way street
    after #308 (``tests/fixtures/corridor/broadway-sb.json`` with the
    carriageway facts the site relays), the undivided shoulder generator.
  * ``adv-shoulder`` — the #216 adversarial divided shoulder fixture
    (``tests/fixtures/pdf_worst_case/adv-shoulder.json``), the divided
    shoulder generator.

For each it records the arrow board placements' labels (``/render/quote``'s
device list is not label-bearing, so the generator is called through the
same scenario mapping the API uses), the crew sheet's step-1 line
(``/render/markdown``), and page 1 of ``/render/pdf`` as a PNG.

Run from the repo root:
  python validation-artifacts/committed/shoulder-arrow-caution/probes/capture.py <tag>
Writes ``<tag>/`` beside itself: ``summary.txt`` and ``<plan>-page1.png``.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))
os.environ["RENDER_API_SECRET"] = "test-secret-do-not-deploy"
AUTH = {"Authorization": "Bearer test-secret-do-not-deploy"}

import fitz  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from pydantic import TypeAdapter  # noqa: E402

from src.api.render_api import app  # noqa: E402
from src.api.schemas import Scenario, scenario_to_call  # noqa: E402
from src.rules import site_detection as sd  # noqa: E402
from src.rules.devices import DeviceType  # noqa: E402

sd._overpass_request_with_fallback = lambda *_a, **_kw: ({"elements": []}, None)  # type: ignore[assignment]

tag = sys.argv[1]
out = Path(__file__).with_name(tag)
out.mkdir(exist_ok=True)


def broadway() -> dict:
    b = json.loads((ROOT / "tests/fixtures/corridor/broadway-sb.json").read_text(encoding="utf-8"))
    m = b["meta"]
    cand = m["confirmedRoad"]["candidate"]
    m["centerline"] = cand["geometry"]
    m["roadDirection"] = {"osmBearingDeg": cand["bearing"] % 360, "oneway": cand["tags"]["oneway"]}
    m["work"] = {"side": "right", "travel": "with_geometry"}
    b["carriageway"] = {
        "oneway": "yes",
        "highwayClass": "primary",
        "twinDistanceM": None,
        "twinSearched": True,
    }
    b["divided"] = False
    return b


def adv_shoulder() -> dict:
    raw = json.loads(
        (ROOT / "tests/fixtures/pdf_worst_case/adv-shoulder.json").read_text(encoding="utf-8")
    )
    return raw.get("scenario", raw)


client = TestClient(app)
sha = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True, cwd=ROOT).stdout.strip()
lines = [f"HEAD {sha}", ""]

for name, body in (("broadway", broadway()), ("adv-shoulder", adv_shoulder())):
    params, generator, kwargs = scenario_to_call(TypeAdapter(Scenario).validate_python(body))
    boards = [
        p.label for p in generator(params, **kwargs) if p.device_type == DeviceType.ARROW_BOARD
    ]
    lines.append(f"[{name}] generator={generator.__name__} arrow boards={boards}")

    r = client.post("/render/markdown", headers=AUTH, json=body)
    step1 = next(
        (ln for ln in r.text.splitlines() if "arrow board" in ln.lower() and "Position" in ln),
        f"(no step-1 line; status {r.status_code})",
    )
    lines.append(f"[{name}] crew sheet: {step1.strip()}")

    r = client.post("/render/pdf", headers=AUTH, json=body)
    if r.status_code != 200:
        lines.append(f"[{name}] pdf -> {r.status_code} {r.text[:200]}")
        continue
    doc = fitz.open(stream=r.content, filetype="pdf")
    page = doc[0]
    page.get_pixmap(dpi=110).save(out / f"{name}-page1.png")
    legend = [
        ln for ln in page.get_text().splitlines() if ln.strip().lower().startswith("arrow board")
    ]
    lines.append(f"[{name}] page 1 legend rows: {legend}")
    lines.append("")

(out / "summary.txt").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\r\n")
print("\n".join(lines))
