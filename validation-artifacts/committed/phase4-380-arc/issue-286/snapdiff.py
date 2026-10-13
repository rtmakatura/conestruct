"""Key-by-key diff of tests/snapshots before (tmp/snap-before) vs. now.

Reports per file: added key paths, removed key paths, changed values.
Exit 1 if anything other than additions appears.
"""
import json
import sys
from collections import Counter
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
B = Path(r"C:/Users/rtmak/.claude/jobs/4c5d582f/tmp/snap-before")
A = Path(r"C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/issue-286-formula-fields/tests/snapshots")


def walk(b, a, path, out):
    if isinstance(b, dict) and isinstance(a, dict):
        for k in a.keys() - b.keys():
            out["added"].append(f"{path}.{k}")
        for k in b.keys() - a.keys():
            out["removed"].append(f"{path}.{k}")
        for k in a.keys() & b.keys():
            walk(b[k], a[k], f"{path}.{k}", out)
    elif isinstance(b, list) and isinstance(a, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(b, a)):
            walk(x, y, f"{path}[]", out)
    elif b != a:
        out["changed"].append(path)


bad = 0
changed_files = 0
unchanged = []
pattern = Counter()
for fb in sorted(B.rglob("*.json")):
    rel = fb.relative_to(B)
    fa = A / rel
    b = json.loads(fb.read_text(encoding="utf-8"))
    a = json.loads(fa.read_text(encoding="utf-8"))
    out = {"added": [], "removed": [], "changed": []}
    walk(b, a, "", out)
    if not any(out.values()):
        unchanged.append(str(rel))
        continue
    changed_files += 1
    pattern[tuple(sorted(set(out["added"])))] += 1
    if out["removed"] or out["changed"]:
        bad += 1
        print("NOT ADDITIONS ONLY:", rel, out["removed"][:5], out["changed"][:5])
print(f"changed files: {changed_files}; unchanged: {len(unchanged)}")
for u in unchanged:
    print("  unchanged:", u)
for keys, n in pattern.items():
    print(f"{n} files add: {', '.join(keys)}")
sys.exit(1 if bad else 0)
