"""#299: summary of probe299's rows: per case x mirror x shape, answers, median /
p90 seconds of answered requests, median bytes and element count."""
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
rows = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
g = defaultdict(list)
for r in rows:
    g[(r["case"], r["mirror"], r["shape"])].append(r)


def p90(v):
    v = sorted(v)
    return v[min(len(v) - 1, int(0.9 * len(v)))]


print("| Case | Mirror | Shape | Answered | Median s | p90 s | Median KB | Elements |")
print("|---|---|---|---|---|---|---|---|")
for (case, mirror, shape), rs in sorted(g.items()):
    ok = [r for r in rs if r["status"] == 200]
    secs = [r["s"] for r in ok]
    print(
        f"| {case} | {mirror} | {shape} | {len(ok)}/{len(rs)} | "
        f"{statistics.median(secs):.2f} | {p90(secs):.2f} | "
        f"{statistics.median([r['bytes'] for r in ok]) / 1024:.0f} | "
        f"{statistics.median([r['count'] for r in ok]):.0f} |"
        if ok
        else f"| {case} | {mirror} | {shape} | 0/{len(rs)} | - | - | - | - |"
    )
fails = defaultdict(int)
for r in rows:
    if r["status"] != 200:
        fails[(r["mirror"], r["shape"], str(r["status"]))] += 1
print("\nNon-200:", dict(fails))
