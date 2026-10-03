"""#292 R72/R76 acceptance: refusal rate and median scan time on prod.

Read-only.  Reads every out/window-accept-*.jsonl (written by
measure_window.py through run_window.ps1; UTF-16 when Windows PowerShell
5.1 redirected it, so the BOM decides) and prints, per window and overall:
cold scans, refusals, the refusal rate, the median scan time (the audit's
own site_scan.duration_ms), and which mirror answered.

  python summarize_accept.py
"""

from __future__ import annotations

import codecs
import json
import statistics
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parent / "out"


def rows(path: Path) -> list[dict]:
    raw = path.read_bytes()
    bom = raw[:2] in (codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)
    text = raw.decode("utf-16" if bom else "utf-8-sig")
    return [json.loads(line) for line in text.splitlines() if line.strip().startswith("{")]


def line(label: str, prods: list[dict]) -> str:
    cold = [p for p in prods if not p.get("memo_hit")]
    refused = [p for p in cold if p.get("scan") != "ok"]
    times = [p["duration_ms"] / 1000 for p in cold if p.get("duration_ms") is not None]
    median = f"{statistics.median(times):.1f} s" if times else "n/a"
    mirrors = dict(Counter(p.get("mirror") or "none" for p in cold))
    rate = f"{len(refused)}/{len(cold)}" if cold else "0/0"
    return f"{label:<24} refused {rate:<6} median scan {median:<8} mirrors {mirrors}"


def main() -> None:
    every: list[dict] = []
    for path in sorted(OUT.glob("window-accept-*.jsonl")):
        data = rows(path)
        head = data[0] if data else {}
        skipped = [r["skipped"] for r in data if "skipped" in r]
        if skipped:
            print(f"{path.stem:<24} SKIPPED: {skipped[0]}")
            continue
        sha = (head.get("healthz") or {}).get("sha", "?")
        prods = [r["prod"] for r in data if "pin" in r]
        every += prods
        print(line(path.stem, prods) + f"  (prod {str(sha)[:7]}, {head.get('start')})")
        for r in data:
            if "pin" in r and r["prod"].get("scan") != "ok":
                print(f"    refused: {r['pin']}: {r['prod'].get('error')}")
    print(line("overall", every))


if __name__ == "__main__":
    main()
