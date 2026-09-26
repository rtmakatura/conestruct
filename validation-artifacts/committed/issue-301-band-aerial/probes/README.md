# #301 checkpoint probes (2026-09-25, at `eed4c29`)

Every number in `../checkpoint.md` comes from one of these probes. Run them with the main venv from
the worktree root. None of them writes the Mapbox token: URLs are printed with it stripped.

| Probe | Output | What it answers |
|---|---|---|
| `static_cost.py` | `static-cost.txt`, `*-600x250.png`, `*-348x220.png` | (b): page 2's own overlay string for the two prod-captured fixtures. Its length against the 8,192 limit, Mapbox latency (3 runs), PNG bytes and cache headers at page-2 and band sizes. |
| `lengths_agree.py` | `lengths-agree.txt` | (a), (d): the picker's lengths (the geometry endpoint), page 2's (the approaches it is handed) and the band's (the audit's `corridor_spec`). The fixtures plus eight variants. Two buffer rows disagree, at 65→60 and 75→65. |
| `geometry_latency.py` | `geometry-latency.txt` | (b): prod `/api/render/corridor-geometry`, three reads per fixture. |
| `strip_104.py` | `strip-104.txt`, `*-strip-600x104-pad10.png` | (c): S3's 104 px strip under `auto` framing. Mapbox refuses padding 60 with a 422; padding 10 gives a sliver. |

The fixtures are the bodies the picker sent on prod after #290 shipped:
`issue-290-picker-draws/prod-after/{broadway,lafayette-flagger}-prod-after-sided-request.json`.

Note: the variant `lafayette @ 65 mph, work-zone speed 55` returns 422 from all three endpoints: the
schema caps the flagger's speed at 55 ("Input should be less than or equal to 55"). It is kept
because it shows the buffer defect cannot reach a flagger plan.
