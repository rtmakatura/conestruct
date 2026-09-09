"""#255 re-baseline — additive fields only, proven single-leaf.

Every audit snapshot carries ``sections.site_scan.corrections`` (all empty
on HEAD): each gains ``corrections_advisory: null`` (one leaf).  The two
corrected tiering fixtures gain ``record_clause`` on their one record and
``corrections_advisory`` on the provenance — the values the live route
serves, asserted by the full pytest run after this script.  Every file is
round-tripped through its own serializer first and the round-trip must be
byte-identical, so the diff can contain nothing but the inserted leaves.
"""
import glob, json, sys
from pathlib import Path
sys.path.insert(0, ".")
from tests._snapshot_helper import serialize_snapshot, write_snapshot

VERIFY = " The plan is built to the correction — verify it in the field or on imagery before deploying."
changed = 0
for p in sorted(glob.glob("tests/snapshots/**/*.json", recursive=True)):
    raw = Path(p).read_text(encoding="utf-8")
    d = json.loads(raw)
    ss = d.get("sections", {}).get("site_scan") if isinstance(d, dict) else None
    if not isinstance(ss, dict) or "corrections" not in ss:
        continue
    assert serialize_snapshot(d) == raw, f"round-trip drift: {p}"
    assert ss["corrections"] == [], p
    assert "corrections_advisory" not in ss, p
    ss["corrections_advisory"] = None
    write_snapshot(Path(p), d)
    changed += 1
print("snapshots re-baselined:", changed)

def ordered_insert(d: dict, after: str, key: str, value):
    items = list(d.items()); out = {}
    for k, v in items:
        out[k] = v
        if k == after: out[key] = value
    assert key in out
    d.clear(); d.update(out)

for name in ("scanned-dismissed", "scanned-asserted"):
    p = Path(f"tests/fixtures/tiering/{name}.json")
    raw = p.read_text(encoding="utf-8")
    d = json.loads(raw)
    rt = json.dumps(d, indent=2, ensure_ascii=False) + "\n"
    assert rt == raw, f"round-trip drift: {p}"
    ss = d["audit"]["sections"]["site_scan"]
    [c] = ss["corrections"]
    assert c["status"] == "applied" and c["disclosure"].endswith(VERIFY)
    ordered_insert(c, "disclosure", "record_clause", c["disclosure"][: -len(VERIFY)])
    ordered_insert(ss, "corrections", "corrections_advisory", VERIFY.strip())
    p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    print("fixture re-baselined:", name)
