# #465 evidence

Worktree `.claude/worktrees/issue-465`, branch `issue-465-held-tap-bar`, base origin/main b3e84577.

## Baseline (before any change)
- Backend: `3908 passed, 3 skipped in 380.31s`
- Frontend: `Test Files 274 passed | 1 skipped (275)`, `Tests 2966 passed | 1 skipped (2967)`

## Red proof (new tests, old BandAerial.tsx)
`npx vitest run components/bands/BandAerial.test.tsx`: `Tests 3 failed | 21 passed (24)`
- on the tap question, the bar and its live region stay through a zoom step's load: `expected 'Tap the intersection nearest the work' to be 'Drawing the corridor…'`
- #465: a tap during the held load is not read; the next tap on the new picture is: `expected 'Tap the intersection nearest the work' to be 'Drawing the corridor…'`
- #465: the armed fallback (no bar prop) stays mounted as the wait through a held load: `expected null to be <div class="a-aerial-bar" …>` (the old fallback unmounted the bar)

## After the fix
- Affected: `components/bands/` + `GeneratorShell.cross-street-tap.test.tsx`: `Test Files 18 passed (18)`, `Tests 243 passed (243)`
- Full frontend: `Test Files 274 passed | 1 skipped (275)`, `Tests 2968 passed | 1 skipped (2969)`
- `npx tsc --noEmit`: clean
- `python scripts/cosmetic_lane_check.py` (re-run 2026-11-08 with the evidence files present): `IN LANE: all 4 paths are frontend look-only`

## axe (the issue's acceptance: "axe clean")
Ran 2026-11-08 as a temporary vitest probe in the worktree (happy-dom, `axe-core` from `conestruct/site/node_modules`, `axe.run(document.body)` with `color-contrast` disabled because happy-dom computes no layout or colours). It mounted `BandAerial` on the tap question (`pinFrame armed onTap bar={{kind:"armed"}} onBigMap`, inside `<main>`), ran axe on the armed state, pressed Zoom in with the picture request held open, checked the bar read `AERIAL_WAIT`, and ran axe on the waiting state. Output: `AXE armed=[] waiting=[]`, `Tests 1 passed (1)`. The probe file was deleted after the run and is not committed. A copy is in the session scratchpad only (not cited as evidence).
Not covered: colour contrast, and a real-browser axe run. The waiting bar reuses the armed bar's element, class and text colour (`.a-aerial-bar`; no `data-bar="waiting"` CSS rule exists), so its contrast is the armed bar's. Whether earlier walks measured that bar's contrast was not checked here.

## Churn, predicted vs actual
Predicted: `BandAerial.tsx` about 15 lines; `BandAerial.test.tsx` line 544's assertion flips plus one new test; GeneratorShell tests unchanged.
Actual: `BandAerial.tsx` +15/-3; `BandAerial.test.tsx` +67/-1 with two new tests, not one (the second pins W5's fallback, which the plan already stated). GeneratorShell tests unchanged and green. No backend, payload or device-count change.
