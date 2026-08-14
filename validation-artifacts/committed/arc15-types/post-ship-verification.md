# Arc 15 — post-ship verification (2026-08-14)

Ryan shipped `issue-35-34-types` via `ship.ps1` on 2026-08-14. This
record is the ruled honest minimum (no Playwright leg — the GO scoped
it out), run in a fresh session after a **nine-day gap** (last session
activity 2026-08-05, verification 2026-08-14); nothing from the prior
session was trusted — repo state, gate, suites, and wire were all
re-established from scratch below.

## Repo state (gap check)

`git fetch` → `origin/main` tip is `6e2062b` (the arc15 evidence
commit), with `c34bc2d` (#35) and `3458bcc` (#34) directly beneath it
on top of `34c283d` (the arc14 tip). **Nothing unexpected landed on
main during the gap** — the three arc15 commits are the only delta
since the last verified state.

## Gate

- `/healthz` → `{"status":"ok","sha":"6e2062b9190772ebb7eaf13f9614d10caf882cc4"}`
- `git rev-parse origin/main` → `6e2062b9190772ebb7eaf13f9614d10caf882cc4`
- **Equal — gate passes** on first probe (no mid-propagation retry
  needed).
- **No served-bundle leg**: this arc touched `site_detection.py` and
  `render_api.py` only; the frontend is byte-untouched by all three
  commits, so the Vercel bundle carries no arc15 delta to verify.
  Stated per the standing triple-gate rule rather than silently
  skipped.

## Suites at the shipped sha (local HEAD == `6e2062b`)

- `uv run pytest -q` → **1850 passed, 2 skipped in 14.11s** — exactly
  the expected tally; the wandering suite-ordering flake did not fire.
- `uv run mypy` → **`Found 63 errors in 10 files (checked 38 source
  files)`** — exactly the pre-existing baseline (#208), no new errors.
- `site_detection.py`: **0 mypy errors** (zero lines of the mypy
  output mention it).

## Prod wire check

One POST to the shipped backend with the tests' `_POINT_BODY`
(Lakewood pin `39.7113, -105.0815`, `radius_m: 500`, point mode),
routed through the public proxy `www.conestruct.com/api/render/detect-site`
(the Next.js route holds the bearer secret server-side and forwards to
the Modal handler verbatim; the Modal secret was deliberately not
extracted for a direct curl). HTTP 200; full body saved as
`detect-site-lakewood-point-2026-08-14.json`. Asserted on the body:

- `road_curvature` carries the **standard bucket shape**:
  `{"detected": false, "count": 0, "details": ["Road curvature
  analysis not implemented; assume straight."]}` — `details` is a
  **list**, `count: 0` present (the #34 wire corner, live).
- `mode: "point"` present at top level (the #35 spread-constructed
  response, live).

## Verdict

Arc 15 is live and verified at `6e2062b`: gate green, suites at
expected tallies, and the declared response-direction wire corner
(`details` str→list, `+count: 0`) observed on production. Refs #34, #35.
