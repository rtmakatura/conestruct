"""Lane-closure audit, session 5: write index.md (the gallery) from results.json.

Adapted from audit-shoulder/build_index.py.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent


def cell(s: str) -> str:
    return str(s).replace("|", "\\|").replace("\n", " ")


def check_key(name: str) -> tuple[int, str]:
    m = re.match(r"C(\d+)", name)
    return (int(m.group(1)) if m else 0, name)


def main() -> None:
    res = json.loads((HERE / "results.json").read_text("utf-8"))
    rows = res["rows"]
    sha = res["healthz"].get("sha", "?")
    built = [e for e in rows if "checks" in e]
    refusals = [e for e in rows if "refusal" in e]
    errors = [e for e in rows if "error" in e]

    per: defaultdict[str, Counter[str]] = defaultdict(Counter)
    for e in built:
        for c in e["checks"]:
            per[c["check"]][c["status"]] += 1
    ref_counts = Counter(e["refusal"]["status"] for e in refusals)

    L = []
    L.append("# Lane-closure audit: gallery")
    L.append("")
    L.append(f"Production `{sha[:7]}` (healthz `{sha}`), fetched 2026-10-22 through the gate with paced requests, one site scan per plan, its signed token reused for the downloads.")
    L.append(f"{len(built)} plans built, {len(refusals)} refusal cases, {len(errors)} plan {'row' if len(errors) == 1 else 'rows'} refused.")
    L.append("")
    L.append("- **Findings for review:** [findings.md](findings.md)")
    L.append("- **Plan and rulings:** [checkpoint.md](checkpoint.md), [rulings.md](rulings.md), [pins.md](pins.md)")
    L.append("- **Oracle:** [oracle-sources.md](oracle-sources.md) (L1–L20, quotes and pages), [oracle-check.md](oracle-check.md) (the independent page check), [oracle.py](oracle.py)")
    L.append("- **Harness:** [matrix.json](matrix.json), [fetch.py](fetch.py), [check.py](check.py), [results.json](results.json); each plan's request, audit JSON, crew sheet, spreadsheets and page-1 text are under `runs/<id>/`")
    L.append("")
    L.append("PASS means the plan meets the source. FLAG means it doesn't, or two surfaces disagree. INFO is recorded, not scored (rulings R8).")
    L.append("")
    L.append("## Counts per check")
    L.append("")
    L.append("| Check | PASS | FLAG | INFO |")
    L.append("|---|---|---|---|")
    for k in sorted(per, key=check_key):
        c = per[k]
        L.append(f"| {k} | {c['PASS']} | {c['FLAG']} | {c['INFO']} |")
    L.append(f"| Refusals (C15) | {ref_counts['PASS']} | {ref_counts['FLAG']} | {ref_counts['INFO']} |")
    L.append("")

    L.append("## Refusals")
    L.append("")
    L.append("| Row | Pin | Why it should refuse | Result | HTTP | Message | Note |")
    L.append("|---|---|---|---|---|---|---|")
    for e in refusals:
        rf = e["refusal"]
        L.append(f"| `{e['row']['id']}` | {e['pin']['place']} | {cell(e['row'].get('why', ''))} | **{rf['status']}** | {rf['http']} | {cell(rf['message'][:220])} | {cell(rf['why'])} |")
    L.append("")
    if errors:
        L.append("## Rows that expected a plan and were refused")
        L.append("")
        for e in errors:
            L.append(f"- `{e['row']['id']}` ({e['pin']['place']}): {cell(e['error'][:400])}")
        L.append("")

    L.append("## Plans")
    L.append("")
    for e in built:
        row, x = e["row"], e["ctx"]
        flags = [c for c in e["checks"] if c["status"] == "FLAG"]
        L.append(f"### `{row['id']}`: {e['pin']['place']}")
        L.append("")
        L.append(f"{x['kind']} · {x['road']} ({x['class']}) · {x['roadType']}, {'divided' if x['divided'] else 'undivided'}, "
                 f"{x['lanes']} lanes × {x['laneWidth']} ft · {x['speed']} mph (work zone {x['wz_speed']}) · {x['lane']} lane · "
                 f"{x['workLen']:g} ft · {'night' if x['night'] else 'day'} · {x['jurisdiction']} · {x['category']} · "
                 f"{x['ta']}, {x['case']}")
        L.append("")
        L.append(f"**{len(flags)} FLAG** · pin {e['pin']['lat']}, {e['pin']['lng']}")
        L.append("")
        L.append(f"![page 1](runs/{row['id']}/page1.png)")
        L.append("")
        L.append("| Check | Result | Oracle | Plan | Source | Note |")
        L.append("|---|---|---|---|---|---|")
        for c in e["checks"]:
            st = f"**{c['status']}**" if c["status"] == "FLAG" else c["status"]
            L.append(f"| {c['check']} | {st} | {cell(c['oracle'])} | {cell(c['plan'][:400])} | {cell(c['source'])} | {cell(c['note'][:400])} |")
        L.append("")
    (HERE / "index.md").write_text("\n".join(L) + "\n", "utf-8")
    print("index.md:", len(built), "plans,", len(refusals), "refusals,", len(errors), "refused plan rows")


if __name__ == "__main__":
    main()
