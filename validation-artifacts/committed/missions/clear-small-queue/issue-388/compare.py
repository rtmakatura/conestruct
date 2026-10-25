"""#388: compare churn-base.json with churn-branch.json -> churn.json.

Usage: python compare.py <item folder>
Strips the render logs printed before the JSON, lists per surface the
bodies whose hash moved (and any that aren't Thornton), and the Advance
Warning Signs count each surface prints on the Thornton bodies.
"""

import collections
import json
import sys

F = sys.argv[1]


def load(name):
    t = open(f"{F}/{name}", encoding="utf-8", errors="replace").read()
    t = t[t.index("\n{") + 1 :] if not t.startswith("{") else t
    open(f"{F}/{name}", "w", encoding="utf-8", newline="\n").write(t)
    return json.loads(t)


a, b = load("churn-base.json"), load("churn-branch.json")
moved = collections.defaultdict(list)
for k in a:
    for s in a[k]:
        if a[k][s] != b[k][s]:
            moved[s].append(k)
out = {"bodies": len(a), "thornton_bodies": sum("-thornton-" in k for k in a)}
out["moved"] = {
    s: {"count": len(v), "not_thornton": [x for x in v if "-thornton-" not in x]}
    for s, v in sorted(moved.items())
}
out["unmoved_surfaces"] = sorted(set(next(iter(a.values()))) - set(moved))


def counts(d):
    return sorted(
        {
            k.split("-")[0]
            + " "
            + json.dumps({s: d[k][s][1] for s in ("xlsx", "quote", "breakdown", "md")})
            for k in d
            if "-thornton-" in k
        }
    )


out["thornton_counts_base"] = counts(a)
out["thornton_counts_branch"] = counts(b)
out["non_200_branch"] = sorted(
    {
        f"{k} {s}"
        for k in b
        for s in b[k]
        if not str(b[k][s][0] if isinstance(b[k][s], list) else b[k][s]).startswith("200")
    }
)
json.dump(out, open(f"{F}/churn.json", "w"), indent=1)
print(json.dumps(out, indent=1))
