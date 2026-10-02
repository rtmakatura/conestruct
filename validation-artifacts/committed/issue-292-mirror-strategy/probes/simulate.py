"""#292: replay mirror strategies on the measured per-mirror answer times.

Input: out/window-{morning,midday,evening}.jsonl (measure_window.py; the
first is UTF-8, the other two UTF-16 from the Windows task's redirect).
Each pin in each window gives every mirror's real outcome when asked at the
same moment: success at t seconds (HTTP 200, JSON, no remark), or failure at
t (5xx, timeout, remark).

Strategies replayed on those outcomes:
  chain(order, cap, budget)  ask in order; a mirror is abandoned at min(cap,
                             time left); a failure moves on at its own time.
                             Refused when the budget is spent.  (Models the
                             cap as total time -- prod's read timeout is per
                             read, so a slow trickle can run longer.)
  parallel(budget)           ask all at once; the first success wins.
Each pin-window: the answer time, or "refused".

Caveat, stated: these times are this PC's view of the mirrors.  Prod asks from
Modal's network; midday showed the primary failing prod's chain on pins it
answered here (e-colfax 3.2 s direct).  Strategies that don't lean on the
primary are the least exposed to that difference.

  python simulate.py > simulate.txt
"""

from __future__ import annotations

import codecs
import json
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent
WINDOWS = ("morning", "midday", "evening")
DE, KUMI, FR = "overpass-api.de", "overpass.kumi.systems", "overpass.openstreetmap.fr"


def load(window: str) -> list[dict]:
    raw = (HERE / "out" / f"window-{window}.jsonl").read_bytes()
    enc = "utf-16" if raw[:2] in (codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE) else "utf-8-sig"
    rows = [json.loads(line) for line in raw.decode(enc).splitlines() if line.strip()]
    return [r for r in rows if "pin" in r]


def outcome(m: dict) -> tuple[bool, float]:
    ok = m.get("http") == 200 and not m.get("error") and not m.get("remark") and "not_json" not in m
    return ok, float(m["seconds"])


def chain(mirrors: dict, order, cap: float, budget: float):
    t = 0.0
    for name in order:
        left = budget - t
        if left <= 0:
            return None
        ok, s = mirrors[name]
        if ok and s <= min(cap, left):
            return t + s
        t += min(s, cap, left)
    return None


def parallel(mirrors: dict, budget: float):
    wins = [s for ok, s in mirrors.values() if ok and s <= budget]
    return min(wins) if wins else None


STRATEGIES = {
    "today: de, kumi, fr; 7 s caps; 20 s": lambda m: chain(m, (DE, KUMI, FR), 7, 20),
    "today, 25 s budget": lambda m: chain(m, (DE, KUMI, FR), 7, 25),
    "today, 30 s budget": lambda m: chain(m, (DE, KUMI, FR), 7, 30),
    "no kumi: de, fr; 7 s; 20 s": lambda m: chain(m, (DE, FR), 7, 20),
    "fr first: fr, de, kumi; 7 s; 20 s": lambda m: chain(m, (FR, DE, KUMI), 7, 20),
    "fr first, no kumi: fr, de; 7 s; 20 s": lambda m: chain(m, (FR, DE), 7, 20),
    "all at once, first answer; 20 s": lambda m: parallel(m, 20),
}


def main() -> None:
    cases = []
    for w in WINDOWS:
        for r in load(w):
            m = {x["mirror"]: outcome(x) for x in r["mirrors"]}
            cases.append((w, r["pin"], m, r["prod"]))
    print(f"{len(cases)} pin-windows ({', '.join(WINDOWS)}), 9 Denver pins each\n")
    print("Per mirror, asked directly:")
    for name in (DE, KUMI, FR):
        oks = [m[name][1] for _w, _p, m, _r in cases if m[name][0]]
        print(f"  {name:<28} answered {len(oks):>2}/{len(cases)}"
              + (f"; median {statistics.median(oks):.1f} s, max {max(oks):.1f} s" if oks else ""))
    print("\nProd as measured (its own chain, from Modal):")
    prod_ok = [r for *_x, r in cases if r.get("http") == 200]
    durs = [r["duration_ms"] / 1000 for r in prod_ok if r.get("duration_ms")]
    print(f"  answered {len(prod_ok)}/{len(cases)}; scan median {statistics.median(durs):.1f} s, "
          f"over 15 s: {sum(d > 15 for d in durs)}, over 20 s: {sum(d > 20 for d in durs)}")
    print("\nReplayed on the direct times:")
    print(f"  {'strategy':<40} {'refused':>7} {'median':>7} {'p90':>6} {'max':>6}  per window (refused)")
    for label, fn in STRATEGIES.items():
        res = [(w, fn(m)) for w, _p, m, _r in cases]
        got = sorted(t for _w, t in res if t is not None)
        ref = sum(t is None for _w, t in res)
        per = ", ".join(f"{w} {sum(t is None for ww, t in res if ww == w)}" for w in WINDOWS)
        p90 = got[int(0.9 * (len(got) - 1))] if got else float("nan")
        print(f"  {label:<40} {ref:>7} {statistics.median(got):>6.1f}s {p90:>5.1f}s {max(got):>5.1f}s  {per}")


if __name__ == "__main__":
    main()
