"""#345 production check: the lane note on www.conestruct.com (via the site proxy)."""

import io, json, os, sys, urllib.request

import pypdfium2 as pdfium

root, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
tok = next(
    l.split("=", 1)[1].strip().strip('"')
    for l in open(os.path.join(root, "conestruct/site/.env.local"), encoding="utf-8")
    if l.startswith("GATE_BYPASS_TOKEN=")
)
base = "https://www.conestruct.com/api/render/"


def post(kind, body):
    req = urllib.request.Request(
        base + kind,
        data=json.dumps(body).encode(),
        method="POST",
        headers={"content-type": "application/json", "x-conestruct-gate": tok},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{kind} {e.code}: {e.read()[:400]!r}") from e


FREEWAY = (
    "Drawn as 3 lanes per direction; the road has 4. Freeway lanes must be at "
    "least 11 ft (CDOT S-630-1 Sheet 7 Case 11), and at that width 4 lanes and "
    "the 10 ft shoulder overrun the 52 ft half-road this plan can draw, so the "
    "device offsets are measured against 3 lanes."
)
ENTERED = (
    "Drawn as 3 lanes per direction (entered); the road has 4. "
    "Device offsets are measured against 3 lanes."
)
LIMIT = (
    "Drawn as 4 lanes per direction; the road has 5. Plans draw at most 4 lanes "
    "per direction, so the device offsets are measured against 4 lanes."
)
# #341's recorded I-25 run (freeway, divided, 3 lanes, road 4).
ROW = "i25-r-65-night-3lanes"
CASES = [
    ("I-25 3 x 11 ft, road 4 (#345 repro)", {"laneWidth": 11}, FREEWAY),
    ("I-25 3 x 12 ft, road 4 (recorded run)", {}, FREEWAY),
    ("Rural divided 3 x 11, road 4 (#341 control)", {"roadType": "rural_divided", "speed": 55, "laneWidth": 11}, ENTERED),
    ("Rural divided 4 x 10.5, road 5 (#310 control)", {"roadType": "rural_divided", "speed": 55, "lanes": 4, "laneWidth": 10.5, "roadLanesPerDirection": 5}, LIMIT),
]
lines, ok = [], True
for i, (name, over, want) in enumerate(CASES):
    body = json.load(open(os.path.join(root, "validation-artifacts/committed/audit-shoulder/runs", ROW, "request.json"), encoding="utf-8"))
    body["scenario"].update(over)
    _, raw = post("audit", body)
    items = {it["kind"]: it for it in json.loads(raw)["pending_verification"].get("items") or []}
    audit_label = items.get("lanes_drawn_below_road", {}).get("label")
    _, md = post("markdown", body)
    md = md.decode("utf-8")
    _, pdf = post("pdf", body)
    page = pdfium.PdfDocument(io.BytesIO(pdf))[0]
    text = " ".join(page.get_textpage().get_text_range().split())
    page.render(scale=2).to_pil().save(os.path.join(out, f"page1-case{i + 1}.png"))
    checks = {
        "audit item": audit_label == want,
        "crew narrative": f"- Lanes: {want}" in md,
        "page 1": " ".join(want.upper().split()) in text,
        "no \"SHEET'S\" on page 1": "SHEET'S" not in text,
    }
    good = all(checks.values())
    ok &= good
    lines.append(f"{'PASS' if good else 'FAIL'}  {name}")
    lines += [f"      {k}: {'ok' if v else 'MISSING'}" for k, v in checks.items()]
    lines.append(f"      audit label: {audit_label}")
lines.append("ALL PASS" if ok else "FAILURES")
open(os.path.join(out, "replay.txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines))
