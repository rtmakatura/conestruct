"""Compare two byteid.py runs: which surfaces moved, on which plans."""
import collections, json, sys
a, b = (json.load(open(p)) for p in sys.argv[1:3])
moved = collections.Counter(); lines = []
for k in sorted(a):
    if a[k] == b[k]: continue
    if not isinstance(a[k], dict):
        lines.append(f"{k}: {a[k]} -> {b[k]}"); continue
    surf = [s for s in a[k] if a[k][s] != b[k].get(s)]
    moved[(a[k]["note"], tuple(surf))] += 1
    lines.append(f"{k} (note={a[k]['note']}): {', '.join(surf)}")
print("\n".join(lines))
print("plans:", len(a), "| with the note:", sum(1 for v in a.values() if isinstance(v, dict) and v["note"]))
for (note, surf), n in moved.items(): print(f"moved: note={note} surfaces={list(surf)} x{n}")
print("unmoved:", sum(1 for k in a if a[k] == b[k]))
