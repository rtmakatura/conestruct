"""#372 churn: base.json vs fix.json (both written by check.py)."""
import json
from pathlib import Path

here = Path(__file__).resolve().parent
base = json.loads((here / "base.json").read_text(encoding="utf-8"))
fix = json.loads((here / "fix.json").read_text(encoding="utf-8"))
out = {}
for name in base:
    b, f = base[name], fix[name]
    names = lambda d: [r.rsplit(" | ", 1)[0] for r in d["page1"]["rows"]]
    out[name] = {
        "page1_text_identical": b["page1"]["page1_text_sha"] == f["page1"]["page1_text_sha"],
        "page1_outside_summary_identical": b["page1"]["page1_text_sha_outside_summary"]
        == f["page1"]["page1_text_sha_outside_summary"],
        "summary_row_names_identical": names(b) == names(f),
        "xlsx_identical": b["xlsx"] == f["xlsx"],
        "total": [b["page1"]["total"], f["page1"]["total"]],
        "changed_rows": [[x, y] for x, y in zip(b["page1"]["rows"], f["page1"]["rows"]) if x != y],
        "agree_before_after": [b["agree"], f["agree"]],
    }
(here / "churn.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
