# Arc 1 — live-site verification of checks 2 (#189) and 3 (#190)

Run 2026-08-01, headless Chromium (Playwright 1.62.1) against the
production sandbox `https://www.conestruct.com/sandbox`. Script:
`arc1-live-checks.js` (in this directory; run with `node` after
`npm i playwright` + `npx playwright install chromium`).

**Read-only run:** the script opens the picker, watches button state,
and edits form fields. Generate was never clicked, nothing was saved to
the database, no account was created or signed in — `/sandbox` is the
public unauthenticated generator.

## Deployed-build confirmation (all three stamps agree)

| Surface | Evidence | Value |
|---|---|---|
| git | `git rev-parse origin/main` | `5416976faebcf9ce0379f3cb806dd445b3e4a74a` |
| Backend | `GET /healthz` (Modal) | `{"status":"ok","sha":"5416976faebcf9ce0379f3cb806dd445b3e4a74a"}` |
| Frontend | `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` inlined in the served bundle (`/_next/static/chunks/720-8f241c33c6f483f8.js` and two sibling chunks contain the full sha) | `5416976faebcf9ce0379f3cb806dd445b3e4a74a` |

`5416976` is the #190 commit — the tip of the three-commit Arc 1 stack
(`62efc5d` #189 → `f4dcbea` #181 → `5416976` #190), fast-forwarded onto
main by ship.ps1. Behavioral cross-check: the "Detecting road…" footer
note asserted below exists only in the post-fix build.

## Method notes

- Check 2 throttles `**/api/road-bearing` by 3000 ms via Playwright route
  interception so the resolving window is long enough to observe; the
  request then continues to the real service untouched.
- Pin: the standing test spot 39.73997, -104.96632 (E Colfax near Race
  St), entered through the modal's manual-coordinate fields. The live
  detection returned two candidates; the script picked "East Colfax
  Avenue eastbound (primary, 90°) · way 600545947". Detected picker
  speed at this pin: 30 mph.
- Zero-candidate settle: 39.7312, -104.9665 (Cheesman Park lawn) — "No
  road detected within 30 m".
- The form speed slider (`#sh-speed`) is set via the native value setter
  + input/change events (React-controlled range input).

## Assertion log (verbatim from the run)

## Check 2 (#189) — Save disabled mid-detection

- `2026-08-01T07:38:45.206Z` intercepted /api/road-bearing — delaying 3000 ms
- `2026-08-01T07:38:45.213Z` **PASS** — 2a: 'Detecting road…' footer note visible while resolving
- `2026-08-01T07:38:45.221Z` **PASS** — 2b: Save & Close disabled while resolving
- `2026-08-01T07:38:45.322Z` screenshot: check2-mid-resolve.png
- `2026-08-01T07:38:52.881Z` classification settled (note gone)
- `2026-08-01T07:38:52.959Z` candidate picker shown; picked: "East Colfax Avenue eastbound (primary, 90°)5 m from pin · way 600545947"
- `2026-08-01T07:38:52.959Z` note: Save was additionally gated by the #139 pick requirement until a road was chosen — expected, separate from #189
- `2026-08-01T07:38:53.264Z` **PASS** — 2c: Save & Close enabled once detection settled (after candidate pick)
- `2026-08-01T07:38:53.419Z` screenshot: check2-settled-enabled.png
- `2026-08-01T07:38:53.431Z` intercepted /api/road-bearing — delaying 3000 ms
- `2026-08-01T07:38:53.460Z` intercepted /api/road-bearing — delaying 3000 ms
- `2026-08-01T07:39:11.220Z` **PASS** — 2d: zero-candidate settle reached (park pin)
- `2026-08-01T07:39:11.224Z` **PASS** — 2e: Save & Close stays enabled on a settled failure (only in-flight blocks)
- `2026-08-01T07:39:11.227Z` **PASS** — 2f: note gone on settled failure
- `2026-08-01T07:39:11.415Z` screenshot: check2-settled-error-saveable.png

## Check 3 (#190) — re-save preserves manual edits

- `2026-08-01T07:39:26.273Z` candidate picker shown; picked: "East Colfax Avenue eastbound (primary, 90°)5 m from pin · way 600545947"
- `2026-08-01T07:39:26.276Z` detected/current picker speed value: "30"
- `2026-08-01T07:39:26.444Z` screenshot: check3-picker-override-40.png
- `2026-08-01T07:39:26.538Z` **PASS** — 3a: after first save, form speed is the picker override 40 (form value: 40)
- `2026-08-01T07:39:26.615Z` screenshot: check3-form-after-save-40.png
- `2026-08-01T07:39:26.635Z` **PASS** — 3b: manual form edit lands (speed 25)
- `2026-08-01T07:39:26.703Z` screenshot: check3-form-manual-25.png
- `2026-08-01T07:39:26.804Z` reopened picker shows restored override: "40" (expected 40)
- `2026-08-01T07:39:26.940Z` screenshot: check3-picker-reopened.png
- `2026-08-01T07:39:26.992Z` **PASS** — 3c: THE assertion — no-change re-save preserves the manual 25 (pre-fix build reverted to 40) (form value: 25)
- `2026-08-01T07:39:27.109Z` screenshot: check3-form-preserved-25.png
- `2026-08-01T07:39:27.385Z` screenshot: check3-picker-override-35.png
- `2026-08-01T07:39:27.515Z` **PASS** — 3d: control — a CHANGED override still applies (form reads 35) (form value: 35)
- `2026-08-01T07:39:27.571Z` screenshot: check3-form-control-35.png
- `2026-08-01T07:39:27.571Z` no Generate click occurred at any point (read-only run)

**Result: ALL PASS** (10/10 assertions)

## Screenshot index

| File | Shows |
|---|---|
| check2-mid-resolve.png | "CLASSIFYING ROAD…" in flight; footer "DETECTING ROAD… — SAVE ENABLES WHEN DETECTION SETTLES"; Save & Close dimmed/disabled |
| check2-settled-enabled.png | Detection settled, road picked, Save enabled |
| check2-settled-error-saveable.png | Park pin: "No road detected within 30 m", note gone, Save enabled |
| check3-picker-override-40.png | Picker speed override set to 40 |
| check3-form-after-save-40.png | Form speed 40 after first save |
| check3-form-manual-25.png | Manual form refinement to 25 |
| check3-picker-reopened.png | Reopened picker restoring override 40 (zero re-detection) |
| check3-form-preserved-25.png | **After no-change re-save: form still 25** — the #190 fix, live |
| check3-picker-override-35.png | Picker override changed to 35 (control setup) |
| check3-form-control-35.png | Changed override 35 applied — negative control |
