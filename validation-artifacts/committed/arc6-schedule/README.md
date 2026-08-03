# Arc 6 evidence — schedule pair (#188 overnight, #199 "Not set", #206 composition)

Five scenarios POSTed to the local `/render/device-breakdown` seam by
`capture_hours_eval.py`, once at `cdf0373` (pre-fix, before any edit)
and once after the three fix commits. Each JSON records the request
schedule, the HTTP status, and the returned `hours_eval` (or the error
body). The pre/post diff is the evidence.

| Case | Scenario | Pre-fix (cdf0373) | Post-fix |
|---|---|---|---|
| A | Denver arterial, 20:00–05:00 Wed (the night shift Denver's night window permits) | **422** "overnight schedules are not supported yet" (#188) | **200 `inside`**, note "overnight shift — evaluated across midnight" |
| B | Denver arterial, 9:00–15:00 Wed (compliant day shift) | **`outside`** — two false violations, 21 phantom hours vs Denver's own night-window pair (#206) | **`inside`**, no violations |
| C | Thornton arterial, `date_mode: "tbd"` + residual times 4:00–6:00 | **`outside`** 4.5 h — a live verdict for a schedule the user un-set (#199) | **`unknown`**, "schedule marked Not set — hours not evaluated" |
| D | Denver arterial, no schedule (control) | `unknown`, "no work schedule provided" | unchanged |
| E | Denver arterial, 10:00–16:00 Wed (genuinely 0.5 h past close) | `outside` — but polluted by the #206 false violations | **`outside` with exactly the real 0.5 h**, violation names the full alternative-window set |

Frontend halves (mounted tests, not capturable at this seam): overnight
entry via "(next day)" options, stranded-end clearing, strip
writes-what-displays, "Not set" default pin, null==tbd card copy,
residual-date lead-table dash. Post-ship live checks will capture the
production renders.
