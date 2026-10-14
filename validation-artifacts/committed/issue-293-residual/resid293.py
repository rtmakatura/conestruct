"""#293: the residual statistics of each committed acceptance run, as
accept-256.js computed them (every ok cold row) and as it computes them now
(fresh scans only, memo hits omitted and counted)."""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
A = Path(sys.argv[1])


def stats(vals):
    v = sorted(vals)
    if not v:
        return "n=0"
    q = lambda f: v[min(len(v) - 1, int(f * len(v)))]  # noqa: E731
    return f"n={len(v)} min={v[0]} median={q(0.5)} p90={q(0.9)} max={v[-1]}"


for run in ("run2-5d569d7", "run3-2e5a647", "run4-cc820bf"):
    rows = json.loads((A / run / "rows.json").read_text(encoding="utf-8"))
    print(run)
    for pin in ("denver", "lakewood"):
        ok = [r for r in rows if r["pin"] == pin and r["leg"] == "cold" and r["http"] == 200]
        before = [r["residual_ms"] for r in ok if isinstance(r.get("residual_ms"), int)]
        fresh = [r for r in ok if r.get("memo_hit") is False]
        after = [r["residual_ms"] for r in fresh if isinstance(r.get("residual_ms"), int)]
        hits = [f"c{r['cycle']} memo_hit={r['memo_hit']} res={r['residual_ms']}" for r in ok if r.get("memo_hit") is not False]
        print(f"  {pin:9s} before: {stats(before)}")
        print(f"  {pin:9s} after:  {stats(after)}   omitted {len(ok) - len(fresh)}: {'; '.join(hits) or '-'}")
