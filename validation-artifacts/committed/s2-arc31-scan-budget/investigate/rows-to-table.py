"""s2-arc31 — turn s2a31-prod.js rows.json into the distribution tables.

    python rows-to-table.py <outDir>

Reports the DISTRIBUTION, not the mean: #256 is a tail defect, and a
mean over a bimodal set (1.3 s memo hits and 20.2 s budget refusals)
describes neither mode.

!!  TWO COLUMNS THAT DO NOT MEAN WHAT THEY LOOK LIKE  !!
!!
!!  residual_ms = wall_ms - duration_ms.  On a memo HIT, duration_ms is
!!  the STORED original fetch's duration, not this request's, so the
!!  subtraction is meaningless and can go negative (it did: -557 ms on
!!  c5 denver warm).  Residual is therefore reported ONLY over
!!  memo_hit == false rows, where it really is "everything the request
!!  did except the site scan" — layout plus the corridor bearing check.
!!
!!  A "warm" row with memo_hit == false is NOT a broken memo.  The memo
!!  is per container (site_scan.py:71-76) against max_containers=8
!!  (modal_app.py:132) with no declared concurrency, so the second
!!  request simply landed on another container.  That count is reported
!!  as a fan-out measurement under its own heading.
"""

from __future__ import annotations

import json
import statistics
import sys
from pathlib import Path

OUT = Path(sys.argv[1])
rows = json.loads((OUT / "rows.json").read_text(encoding="utf-8"))


def pct(n: int, d: int) -> str:
    return f"{n}/{d} ({100.0 * n / d:.0f} %)" if d else "0/0 (n/a)"


def dist(vals: list[float]) -> str:
    if not vals:
        return "no rows"
    s = sorted(vals)
    q = lambda p: s[min(len(s) - 1, int(round(p * (len(s) - 1))))]  # noqa: E731
    return (f"n={len(s)} min={s[0]:.0f} p25={q(.25):.0f} median={statistics.median(s):.0f} "
            f"p75={q(.75):.0f} p90={q(.90):.0f} max={s[-1]:.0f}")


lines: list[str] = []
w = lines.append
w(f"# s2-arc31 — prod distribution, {len(rows)} served audits")
w("")
for line in (__doc__ or "").splitlines():
    if line.startswith("!!"):
        w(line)
w("")

for pin in sorted({r["pin"] for r in rows}):
    for leg in ("cold", "warm"):
        sub = [r for r in rows if r["pin"] == pin and r["leg"] == leg]
        if not sub:
            continue
        refused = [r for r in sub if r["http"] == 400]
        ok = [r for r in sub if r["http"] == 200]
        other = [r for r in sub if r["http"] not in (200, 400)]
        w(f"## {pin} / {leg}")
        w(f"- served: {len(sub)}   refused (HTTP 400, scan budget): {pct(len(refused), len(sub))}"
          + (f"   other non-200: {len(other)}" if other else ""))
        w(f"- wall ms, all rows:      {dist([r['wall_ms'] for r in sub])}")
        w(f"- scan duration_ms, ok:   {dist([r['duration_ms'] for r in ok if r.get('duration_ms') is not None])}")
        miss = [r for r in ok if r.get("memo_hit") is False and r.get("residual_ms") is not None]
        w(f"- residual ms (memo MISS rows only — layout + corridor check): {dist([r['residual_ms'] for r in miss])}")
        hits = [r for r in ok if r.get("memo_hit")]
        w(f"- memo hits among ok rows: {pct(len(hits), len(ok))}"
          + ("   <- on the 'warm' leg this is the container fan-out measurement" if leg == "warm" else ""))
        cv: dict[str, int] = {}
        for r in ok:
            cv[str(r.get("corridor"))] = cv.get(str(r.get("corridor")), 0) + 1
        w(f"- corridor check on ok rows: {cv}")
        unav = sum(v for k, v in cv.items() if "check_unavailable" in k)
        w(f"- corridor check_unavailable: {pct(unav, len(ok))}")
        w("")

w("## the acceptance bars in #256, against these rows")
for pin in sorted({r["pin"] for r in rows}):
    cold = [r for r in rows if r["pin"] == pin and r["leg"] == "cold"]
    ref = [r for r in cold if r["http"] == 400]
    w(f"- {pin}: refusals on cold runs {pct(len(ref), len(cold))} — bar is <= 1 in 20")
    ok = [r for r in rows if r["pin"] == pin and r["http"] == 200]
    unav = [r for r in ok if "check_unavailable" in str(r.get("corridor"))]
    w(f"- {pin}: corridor check_unavailable on ok audits {pct(len(unav), len(ok))} — bar is <= 1 in 20")
w("")

mirrors: dict[str, int] = {}
remarks: dict[str, int] = {}
for r in rows:
    mirrors[str(r.get("mirror"))] = mirrors.get(str(r.get("mirror")), 0) + 1
    if r.get("remark"):
        remarks[str(r["remark"])] = remarks.get(str(r["remark"]), 0) + 1
w("## which server answered, and what it said")
w(f"- mirror recorded: {mirrors}")
w(f"- overpass remarks (#251: a remark is a mirror failure, never ok): {remarks or 'none in this run'}")
sizes = {str(r.get("response_bytes")): 0 for r in rows}
for r in rows:
    sizes[str(r.get("response_bytes"))] += 1
w(f"- response_bytes seen: {sizes}")
w("  (695 B is overpass-api.de's 504 Gateway Timeout page — identified this arc by")
w("   catching it with an HTTP-status-aware probe; arc 22 recorded the size but not")
w("   the cause, s2-arc22-scan-honesty/README.md:120.)")

text = "\n".join(lines) + "\n"
(OUT / "table.md").write_text(text, encoding="utf-8")
print(text)
