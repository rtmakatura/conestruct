# Arc 3 live-site verification — #184 + #182 on production

Headless Chromium (Playwright) against `https://www.conestruct.com/sandbox`,
run 2026-08-02. **Read-only**: no accounts, no DB writes, no plan saves.
Synthetic failures via route interception only — the 502 and 429 checks
fulfill responses client-side; **no real 429 was induced** against the
shared limiter buckets. The 422 checks use the real backend path (a 422
is a stateless validation answer). Script: `arc3-live-checks.js`; raw
log: `assertions-raw.md`.

## Build confirmation

| Source | sha |
|---|---|
| `/healthz` (Modal) | `a1f5f71cf6a25f3de9f44c65e0b87b065d4d9341` |
| `git rev-parse origin/main` | `a1f5f71cf6a25f3de9f44c65e0b87b065d4d9341` |
| Served bundle (`/_next/static` chunk grep) | `a1f5f71cf6a25f3de9f44c65e0b87b065d4d9341` |

Gate passed; all three match the Arc 3 tip.

## Results — 23/23 PASS (22 checks + build gate), 0 failures

**#184 (Refs #184):**

| # | Assertion | Result | Evidence |
|---|---|---|---|
| 1a–d | Mirrored 4×14 combo → strip **INVALID INPUT** carrying the form's own message; inline error agrees (2 voices, same sentence); no VERIFICATION UNAVAILABLE; no Retry anywhere | PASS ×4 | `01-mirrored-422-invalid-input.png` |
| 2a–d | **Real non-mirrored 422** (workZoneSpeed 70 > posted 65, typed past the input's advisory `max`) → **PLAN DECLINED · "workZoneSpeed (70) must be <= posted speed (65)."** — the deployed proxy's 422→400 translation live; sentence rendered exactly once; no Retry; no outage voice | PASS ×4 | `02-nonmirrored-422-plan-declined.png` |
| 3a–b | Device chip under a declined state (real geometry 400 via strip "Edit Work zone" → 50 ft): **"Device schedule unavailable while generation is declined"**, zero Retry buttons on the whole page | PASS ×2 | `03-device-chip-declined.png` |
| 4a–b | Control — synthetic 502 (route-fulfilled): VERIFICATION UNAVAILABLE + "Audit trail failed" + Retry still render (honest path unchanged) | PASS ×2 | `04-synthetic-502-unavailable-retry.png` |

**#182 (Refs #182):**

| # | Assertion | Result | Evidence |
|---|---|---|---|
| 5a–c | Scripted 12-step slider drag (~150 ms cadence, ~1.8 s): **audit=2, device-breakdown=2** requests (leading + trailing; pre-fix: 12 + 12); trailing body carries the final value (`"speed":55`) | PASS ×3 | request-count log below |
| 6 | Discrete edit after a quiet period dispatches within 150 ms (leading edge — no 350 ms wait) | PASS | log |
| 7a–d | Synthetic 429 (route-fulfilled): strip **VERIFICATION PAUSED · "too many updates in the last minute"**; panel "Audit trail paused"; outage voice nowhere; Retry present | PASS ×4 | `07-synthetic-429-paused.png` |
| 8a–b | Intercept lifted, Retry clicked: re-fetch within 200 ms (debounce bypassed) and full recovery to **VERIFIED · READY FOR TCS REVIEW** | PASS ×2 | `08-retry-recovery.png` |

## Request-count log (check 5, verbatim)

```
request counts for the 12-step drag: audit=2, device-breakdown=2 (pre-fix: 12 + 12)
```

## Deviations from the check list as prompted

1. **Check 2 needed no interception fallback** — the workZoneSpeed 422 is
   UI-reachable (the number input's `max` attribute is advisory; onChange
   has no clamp), so the strongest capture (real backend, real proxy
   translation) was taken.
2. **Check 3's declined state is driven by a real geometry 400** (strip
   "Edit Work zone" → 50 ft, WORK_ZONE_SHORTER_THAN_TAPER), not a 422:
   post-generate the setup form collapses to the strip, so the lane-width
   slider that produces the 4×14 combo is unmounted. The device chip's
   declined arm is status-based (any 400) — the same shipped code path.
3. Two script iterations before the clean run, both mechanical: (a) the
   first draft tried the lane-width slider post-generate (see above) and
   was restructured; (b) the chip assertion initially raced the device
   fetch (the audit chip's declined line settles first) — replaced with an
   explicit wait for the device line. No assertion was weakened.

## Blocked

Nothing. No auth wall was met (all checks on the public generator); no
selector drift beyond deviation 3a.
