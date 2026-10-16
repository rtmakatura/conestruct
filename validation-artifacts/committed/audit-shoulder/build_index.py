"""Shoulder-work audit, phase 3: write index.md (the gallery) from results.json."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent


def cell(s: str) -> str:
    return str(s).replace("|", "\\|").replace("\n", " ")


def main() -> None:
    res = json.loads((HERE / "results.json").read_text("utf-8"))
    rows = res["rows"]
    sha = res["healthz"].get("sha", "?")
    built = [e for e in rows if "checks" in e]
    refusals = [e for e in rows if "refusal" in e]
    errors = [e for e in rows if "error" in e]

    per = defaultdict(Counter)
    for e in built:
        for c in e["checks"]:
            per[c["check"]][c["status"]] += 1
            if c["note"].startswith("QUESTION"):
                per[c["check"]]["QUESTION"] += 1
    ref_counts = Counter(e["refusal"]["status"] for e in refusals)

    L = []
    L.append("# Shoulder-work audit: gallery")
    L.append("")
    L.append(f"Production `{sha[:7]}` (healthz `{sha}`), fetched 2026-10-16 through the gate with paced requests, one site scan per plan, its signed token reused for the downloads.")
    L.append(f"{len(built)} plans built, {len(refusals)} refusal cases, {len(errors)} rows not run.")
    L.append("")
    L.append("- **Findings for review:** [findings.md](findings.md)")
    L.append("- **Oracle:** [oracle-sources.md](oracle-sources.md) (quotes and pages), [oracle-check.md](oracle-check.md) (the independent page check), [oracle.py](oracle.py)")
    L.append("- **Harness:** [matrix.json](matrix.json), [fetch.py](fetch.py), [check.py](check.py), [results.json](results.json); each plan's request, audit JSON, crew sheet, spreadsheets and page-1 text are under `runs/<id>/`")
    L.append("")
    L.append("PASS means the plan meets the source. FLAG means it doesn't, or two surfaces disagree. INFO is recorded, not scored. A QUESTION is a Lakewood-only difference for Ryan (ruling e).")
    L.append("")
    L.append("## Counts per check")
    L.append("")
    L.append("| Check | PASS | FLAG | INFO | of which QUESTION |")
    L.append("|---|---|---|---|---|")
    for k in sorted(per, key=lambda s: (int(''.join(ch for ch in s.split()[0][1:] if ch.isdigit()) or 0), s)):
        c = per[k]
        L.append(f"| {k} | {c['PASS']} | {c['FLAG']} | {c['INFO']} | {c['QUESTION'] or ''} |")
    L.append(f"| Refusals (C14) | {ref_counts['PASS']} | {ref_counts['FLAG']} | | |")
    L.append("")

    L.append("## Refusals")
    L.append("")
    L.append("| # | Case | Pin | Result | HTTP | PDF | Message | Why flagged |")
    L.append("|---|---|---|---|---|---|---|---|")
    for e in refusals:
        rf = e["refusal"]
        L.append(f"| {e['row']['n']} | `{e['row']['id']}` | {e['row']['pin']} | **{rf['status']}** | {rf['http']} | {rf['pdf']} | {cell(rf['message'][:220])} | {cell(rf['why'])} |")
    L.append("")
    if errors:
        L.append("## Rows not run")
        L.append("")
        for e in errors:
            L.append(f"- {e['row']['n']} `{e['row']['id']}`: {cell(e['error'][:300])}")
        L.append("")

    L.append("## Plans")
    L.append("")
    for e in built:
        row, x = e["row"], e["ctx"]
        flags = [c for c in e["checks"] if c["status"] == "FLAG"]
        L.append(f"### {row['n']}. `{row['id']}`: {e['pin']['place']}")
        L.append("")
        L.append(f"{x['road']} ({x['class']}, oneway={x['oneway']}) · {x['roadType']}, {'divided' if x['divided'] else 'undivided'}, "
                 f"{x['lanes']} lanes × {x['laneWidth']} ft · {x['speed']} mph · {x['side']} shoulder · {x['workLen']} ft · "
                 f"{'night' if x['night'] else 'day'} · sight distance {'limited' if x['lsd'] else 'normal'} · {x['jurisdiction']} · "
                 f"{x['ta']}, {x['case']} · scan {x['scan']} {sorted(k for k, v in (x['scan_flags'] or {}).items() if v)}")
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
    print("index.md:", len(built), "plans,", len(refusals), "refusals,", len(errors), "errors")


if __name__ == "__main__":
    main()
