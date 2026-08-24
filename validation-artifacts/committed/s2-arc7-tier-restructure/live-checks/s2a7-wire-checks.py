"""s2-arc7 live checks, wire half (Refs #219/#220/#223) — READ-ONLY.

W1  fixture scenarios POSTed to prod: the locally-computed tier ledger
    over the SERVED audit+jurisdiction responses equals the committed
    expectation (statuses deterministic for these scenarios).
W2  the SERVED audit PDF cover carries "Plan status: <that same line>"
    — cross-surface equality live.
W3  containment: the served audit PDFs (adversarial trio + control)
    keep every char inside the flowing margins (s2-arc6 method).
W4  hours-outside at Denver: a schedule inside a ban → served
    hours_eval outside → the tier classifier puts jur:hours in
    attention (the ⚠ auto-open's driving fact; the browser half
    exercises the rendered auto-open).
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path("C:/Users/rtmak/Documents/traffic-control-tool")
sys.path.insert(0, str(ROOT))

from src.rendering.tier_ledger import ledger_line, tier_facts, tier_ledger  # noqa: E402

import pypdfium2 as pdfium  # noqa: E402

BASE = "https://www.conestruct.com"
FIXDIR = ROOT / "tests/fixtures/tiering"
OUT = Path(__file__).parent / "outS2A7"
OUT.mkdir(exist_ok=True)
EXPECT = json.loads((FIXDIR / "tiering-expectations.json").read_text(encoding="utf-8"))

failures = 0
lines = []


def log(msg):
    stamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    lines.append(f"- `{stamp}` {msg}")
    print(f"{stamp} {msg}")


def check(name, cond, extra=""):
    global failures
    if not cond:
        failures += 1
    log(f"{'**PASS**' if cond else '**FAIL**'} — {name}{f' ({extra})' if extra else ''}")


def post(route, scenario, timeout=120):
    req = urllib.request.Request(
        BASE + route,
        data=json.dumps({"scenario": scenario}).encode(),
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, r.read()


def pdf_text(pdf_bytes, path):
    path.write_bytes(pdf_bytes)
    doc = pdfium.PdfDocument(str(path))
    try:
        page = doc[0]
        tp = page.get_textpage()
        return tp.get_text_range(0, tp.count_chars())
    finally:
        doc.close()


# ── W1 + W2 ──────────────────────────────────────────────────────────
for name in ("control-lakewood", "adv-ni-denver"):
    fx = json.loads((FIXDIR / f"{name}.json").read_text(encoding="utf-8"))
    sc = fx["scenario"]
    s, body = post("/api/render/audit", sc)
    check(f"W1. {name}: /api/render/audit serves", s == 200, f"HTTP {s}")
    audit = json.loads(body)
    s, body = post("/api/render/device-breakdown", sc)
    check(f"W1. {name}: /api/render/device-breakdown serves", s == 200, f"HTTP {s}")
    jur = json.loads(body).get("jurisdiction")
    served_ledger = tier_ledger(audit, jur)
    check(
        f"W1. {name}: served responses classify to the committed expectation",
        served_ledger == EXPECT[name]["ledger"]
        and tier_facts(audit, jur) == EXPECT[name]["facts"],
        f"served {served_ledger} vs expected {EXPECT[name]['ledger']}",
    )
    s, body = post("/api/render/audit-pdf", sc)
    check(f"W2. {name}: /api/render/audit-pdf serves", s == 200, f"HTTP {s}")
    text = pdf_text(body, OUT / f"{name}-audit-served.pdf")
    line = ledger_line(served_ledger)
    check(
        f"W2. {name}: served PDF cover carries the screen ledger line",
        "Plan status" in text and line in text,
        line,
    )

# ── W3: containment on the served audit PDFs (s2-arc6 method) ────────
for name in ("adv-shoulder", "adv-near-intersection", "adv-flagger", "control-typical"):
    sc = json.loads(
        (ROOT / f"tests/fixtures/pdf_worst_case/{name}.json").read_text(encoding="utf-8")
    )["scenario"]
    s, body = post("/api/render/audit-pdf", sc)
    if s != 200:
        check(f"W3. {name} audit-pdf serves", False, f"HTTP {s}")
        continue
    p = OUT / f"{name}-audit-served.pdf"
    p.write_bytes(body)
    doc = pdfium.PdfDocument(str(p))
    bad = 0
    try:
        margin = 0.7 * 72.0
        for page in doc:
            pw = page.get_width()
            tp = page.get_textpage()
            for i in range(tp.count_chars()):
                box = tp.get_charbox(i)
                if box[2] > pw - margin + 2.0 or box[0] < margin - 2.0:
                    bad += 1
    finally:
        doc.close()
    check(f"W3. {name}: served audit PDF chars inside margins", bad == 0, f"{bad} outside")

# ── W4: hours-outside at Denver (wire fact for the ⚠ auto-open) ──────
sc = json.loads((FIXDIR / "adv-ni-denver.json").read_text(encoding="utf-8"))["scenario"]
sc["schedule"] = {
    "date_mode": "single",
    "work_date": "2026-08-26",
    "start_time": 6.0,
    "end_time": 8.0,
}
s, body = post("/api/render/device-breakdown", sc)
jur = json.loads(body).get("jurisdiction")
hours = (jur or {}).get("hours_eval", {})
check(
    "W4. Denver 06:00–08:00 weekday: served hours_eval is OUTSIDE",
    hours.get("status") == "outside" and len(hours.get("violations", [])) > 0,
    f"status={hours.get('status')} violations={len(hours.get('violations', []))}",
)
facts = tier_facts(None, jur) if jur else {}
check(
    "W4. the outside verdict classifies to ⚠ (the auto-open's driving fact)",
    facts.get("jur:hours") == "attention",
    str(facts.get("jur:hours")),
)
s, body = post("/api/render/audit-pdf", sc)
text = pdf_text(body, OUT / "denver-outside-audit-served.pdf")
audit_resp = json.loads(post("/api/render/audit", sc)[1])
line = ledger_line(tier_ledger(audit_resp, jur))
check(
    "W4. the served PDF cover counts the outside verdict in attention",
    line in text,
    line,
)

(OUT / "s2a7-wire-raw.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"\nDONE — failures: {failures}")
sys.exit(1 if failures else 0)
