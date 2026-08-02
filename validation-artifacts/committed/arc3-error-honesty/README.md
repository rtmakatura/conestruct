# Arc 3 verification evidence — error-honesty pair (#184 + #182)

Third tenant of `validation-artifacts/committed/` (tracked per the #160
ruling). Branch `issue-184-error-honesty`, five code commits + this
evidence.

| File | What it proves |
|---|---|
| `defect-repro-at-eeee27f.test.tsx` | The Step-2 mounted defect captures, written to PASS on the defective behavior at `eeee27f` (pre-arc HEAD): #184 a proxied 422 (502) rendering as VERIFICATION UNAVAILABLE + "Audit trail failed: HTTP 502" with a Retry that re-fires the byte-identical doomed request; #182 the request timeline running 1:1 with edits (a 12-notch slider drag dispatching 13 audit + 13 device-breakdown requests against two 30/min/IP buckets) and a 429 rendering as the outage voice with nothing naming the throttle. HISTORICAL — run against `eeee27f`, not post-arc HEAD (the fixes invert these assertions; the in-tree regression suites below are the ongoing proof). |
| `defect-repro-output.txt` | Its 3/3 PASS run output at `eeee27f` (a pass = a reproduction). |
| `live-422-capture.py` | #184 evidence generator (read-only, no DB writes): the deployed backend's actual 422 for the issue's 4-lanes-x-14-ft shoulder repro, direct to Modal `/render/audit`; then the same scenario through the prod proxy `/api/render/audit`; then the identical request re-POSTed (the Retry button's exact behavior). |
| `live-422-captures.txt` | Its output, run 2026-08-02 @ healthz `eeee27f` (pre-arc deploy): Modal answers **422** with the actionable sentence "4 lanes x 14.0 ft + 8 ft shoulder = 64.0 ft exceeds the plan sheet's drawable half-road (52 ft) — use a lane width of 11.0 ft or less, or reduce the lane count."; the prod proxy discards it and serves **502 "Audit trail failed"**, identically on retry. The same 422 body is the committed fixture in `render-proxy.validation.test.ts`. |

Regression pins (in-tree):
- `conestruct/site/lib/render-proxy.validation.test.ts` (#184, proxy layer — 422→400 translation with the live fixture, 400 forward incl. quote-breakdown, 5xx/unparseable stay 502)
- `conestruct/site/components/GeneratorShell.error-honesty.test.tsx` (#184 + #182, mounted — mirrored combo → INVALID INPUT agreeing with the form; non-mirrored translated 422 → PLAN DECLINED no-affordance shape, no Retry; 429 → VERIFICATION PAUSED voice)
- `conestruct/site/components/DeviceBreakdown.test.tsx` (#184 + #182, chip — 400 declined line no Retry; 429 paused line; 5xx/network keep Retry)
- `conestruct/site/components/GeneratorShell.debounce.test.tsx` (#182, request timeline with fake timers — burst → leading + one trailing pair; discrete edit immediate; VERIFYING through the deferred window; Retry bypasses)

Frontend-only arc: no backend change, no wire-field change, no
deploy-order constraint. The live captures above show the PRE-fix prod
behavior; the post-fix live checks follow the ship (Arc 1/2 pattern —
the 422 and 429 paths are route-interceptable read-only).
