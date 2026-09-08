# s2-audit-1 — P2 leg: the site-conditions table and the cover line in the
# rendered PDFs against the screen (block-rows.json from the walk).
import json, sys, re, io
from pathlib import Path
from pypdf import PdfReader
import openpyxl

out = Path(sys.argv[1])
dl = out / "downloads"
report = []
def text_of(p):
    r = PdfReader(str(p))
    return [(i + 1, (pg.extract_text() or "")) for i, pg in enumerate(r.pages)]

for pdf in sorted(dl.glob("*.pdf")):
    pages = text_of(pdf)
    full = "\n".join(t for _, t in pages)
    hits = []
    for pat in ["Site conditions", "SITE CONDITIONS", "NOT CHECKED", "not checked", "detected", "none along the corridor", "Adjacent at-grade", "interchange", "sidewalk", "Bike", "School zone", "corridor scan", "dismissed", "asserted", "scan budget", "OpenStreetMap", "memoised"]:
        for pno, t in pages:
            for m in re.finditer(pat, t):
                s = t[max(0, m.start() - 80): m.end() + 120].replace("\n", " ⏎ ")
                hits.append((pno, pat, s))
    report.append(f"## {pdf.name} — {len(pages)} page(s)")
    # cover / title lines: first 12 lines of page 1
    report.append("first lines p1: " + " | ".join(l.strip() for l in pages[0][1].splitlines()[:14] if l.strip()))
    seen = set()
    for pno, pat, s in hits:
        key = (pno, s[:60])
        if key in seen: continue
        seen.add(key)
        report.append(f"- p{pno} [{pat}] …{s}…")
    iso = re.findall(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d", full)
    report.append(f"raw ISO timestamps in the PDF: {len(iso)} {iso[:3]}")
    report.append("")

for x in sorted(dl.glob("*.xlsx")):
    wb = openpyxl.load_workbook(str(x), data_only=True)
    report.append(f"## {x.name} — sheets {wb.sheetnames}")
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        report.append(f"### {ws.title} — {len(rows)} rows")
        for r in rows[:14]:
            report.append("  " + " | ".join("" if v is None else str(v) for v in r))
    report.append("")

for md in sorted(dl.glob("*.md")):
    t = md.read_text(encoding="utf-8")
    report.append(f"## {md.name} — {len(t)} chars; site-condition mentions: " + " ; ".join(m.group(0) for m in re.finditer(r"[^\n]{0,60}(site condition|NOT CHECKED|detected)[^\n]{0,60}", t, re.I))[:600])

# the screen's block rows per run
for br in sorted(out.glob("*block-rows.json")):
    d = json.loads(br.read_text(encoding="utf-8"))
    report.append(f"## screen {br.name}: " + " ; ".join(f"{r['name']['t'] if r['name'] else '?'} → {r['result']['t'] if r['result'] else '?'}" for r in d["rows"]) + f" ; foot \"{d['foot']['t'] if d['foot'] else ''}\"")

(out / "pdf-check.md").write_text("\n".join(report), encoding="utf-8")
print("\n".join(report)[:12000])
