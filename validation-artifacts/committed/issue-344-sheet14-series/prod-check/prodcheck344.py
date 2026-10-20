"""#344 production check: Sheet 14 series on www.conestruct.com (via the site proxy)."""

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


runs = os.path.join(root, "validation-artifacts/committed/audit-shoulder/runs")
SHEET_14 = {"Second W21-5aR (Sheet 14)": 530, "First W21-5aR (Sheet 14)": 1320,
            "R2-10 (Sheet 14)": 1580, "Furthest (Sheet 14)": 2640}
# One recorded I-25 run (#341's), its speeds set per case.
ROW = "i25-r-65-night-3lanes"
CASES = [
    ("I-25 at 65->60 (Case 26)", 65, 60, "sheet14"),
    ("I-25 at 75->65 (Case 27)", 75, 65, "sheet14"),
    ("I-25 at 65, no reduction (Case 11 control)", 65, None, "case11"),
]
lines, ok = [], True
for name, speed, wz, want in CASES:
    body = json.load(open(os.path.join(runs, ROW, "request.json"), encoding="utf-8"))
    sc = body["scenario"]
    sc["speed"] = speed
    sc.pop("workZoneSpeed", None)
    if wz is not None:
        sc["workZoneSpeed"] = wz
    st, raw = post("audit", body)
    audit = json.loads(raw)
    adv = audit["sections"]["advance"]
    table = [(r["Position"], r["Code"], r["Distance from Taper (ft)"]) for r in adv["sign_table"]]
    dist = {p: int(d.split()[0].replace(",", "")) for p, _, d in table if d.split()[0].replace(",", "").isdigit()}
    codes = {c for _, c, _ in table}
    if want == "sheet14":
        checks = {p: dist.get(p) == ft for p, ft in SHEET_14.items()}
        checks["no W20-2"] = "W20-2" not in codes
        checks["source Sheet 14"] = adv["source"].startswith("CDOT S-630-1 Sheet 14")
    else:
        checks = {"Furthest (Case 11) 5200": dist.get("Furthest (Case 11)") == 5200,
                  "source Case 11": adv["source"] == "CDOT S-630-1 Sheet 7 Case 11"}
    checks["validation_warnings 0"] = audit["plan_flags"]["validation_warnings"] == 0
    st2, pdf = post("pdf", body)
    page1 = " ".join(pdfium.PdfDocument(io.BytesIO(pdf))[0].get_textpage().get_text_range().split())
    checks["pdf 200, no W20-2 on page 1"] = st2 == 200 and ("W20-2" not in page1 or want == "case11")
    passed = all(checks.values())
    ok &= passed
    lines.append(f"{name}: audit {st}, pdf {st2} -> {'PASS' if passed else 'FAIL'}")
    lines.append(f"  source: {adv['source']}")
    lines += [f"  {p} | {c} | {d}" for p, c, d in table]
    lines += [f"  check {k}: {v}" for k, v in checks.items()]
lines.append("OVERALL " + ("PASS" if ok else "FAIL"))
open(os.path.join(out, "replay.txt"), "w", encoding="utf-8").write("\n".join(lines) + "\n")
print("\n".join(lines))
