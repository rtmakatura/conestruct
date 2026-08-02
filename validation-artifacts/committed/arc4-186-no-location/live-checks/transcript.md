# Arc 4 live-site verification — #186 against production

Run: 2026-08-02, headless Chromium (Playwright) against
https://www.conestruct.com/sandbox. READ-ONLY: no accounts, no DB
writes, no plan saves. The single Generate click (check 6) is the
sandbox's client-side stage flip — nothing persisted (same posture as
the Arc 3 run's check 3).

**Result: 23/23 assertions PASS** (`assertions-raw.md` is the raw
timestamped log; exit code 0. Count: build gate + 1a–1g + 2a–2b +
3a–3d + 4a–4b + 5a–5e + 6a–6b.)

## Build gate

| Surface | SHA |
|---|---|
| `git rev-parse origin/main` | `c9eebe92b36686b3d91ffdcdebccacb7d957c82b` |
| backend `/healthz` | `c9eebe92b36686b3d91ffdcdebccacb7d957c82b` |
| served `_next/static` bundle | `c9eebe92b36686b3d91ffdcdebccacb7d957c82b` |

All three match — the checks ran against the shipped #186 fix.

## Checks

### 1. Fresh-load honesty (`01-fresh-load-awaiting.png`)
Cold context, no storage. Strip renders the AWAITING LOCATION copy
verbatim with the chromeless no-verdict treatment
(`status-bar idle unavail`); READY appears nowhere in the DOM; no
verdict voice anywhere (no VERIFIED / INVALID INPUT / PLAN DECLINED).
Generate is disabled, carrying "Set a location first — pick on map or
enter manually." as both the title attribute and the visible line under
the CTA. This is the exact surface that pre-fix certified
"VERIFIED · READY FOR TCS REVIEW" about the 0/0 default
(`../defect-repro-output.txt`).

### 2. Disabled Generate fires nothing
A forced mouse click on the disabled CTA produced **zero** API requests
(render/PDF included) and no post-generate package (results hero
absent). The only traffic in the observation window was Next.js's own
`?_rsc=` prefetch of the footer's /terms and /privacy links —
background chrome unrelated to the click, filtered accordingly (the
check as specified is "no render/PDF POST"; no `/api/` request of any
kind subsumes it).

### 3. Pre-pin liveness (`03a`, `03b`)
Without a pin, the 4-lane × 14 ft combo flips the strip to
INVALID INPUT with the form's own message — Arc 3's chain still
outranks AWAITING LOCATION. Restoring lane width returns the strip to
AWAITING LOCATION; the settled clean audit never surfaces as a verdict
(READY/VERIFIED nowhere). Verification stays live pre-pin, exactly the
approved nuance.

### 4. Set-location-enables via the picker (`04-colfax-saved-downstream.png`)
E Colfax (39.73997, -104.96632) through the picker; candidate list
appeared and "East Colfax Avenue eastbound (primary, 90°) · 5 m from
pin" was chosen; Save & Close. The strip left AWAITING LOCATION for a
real verification state. Downstream at this pin the detection produced
no gate for the default **shoulder** scenario: strip
"VERIFIED · 0 validation warnings · READY FOR TCS REVIEW", Generate
enabled with no disabled reason — the verdict↔enabled arm of the
either-is-correct branch (the #86 multilane refusal is a flagger-lane
gate; it does not arm on shoulder work).

### 5. Manual-entry hole (`05a`, `05b`)
Fresh reload; latitude alone (39.73997) via "Enter manually": the strip
**stays** AWAITING LOCATION and Generate stays disabled with the
location reason — the both-coordinates rule, live. (The Location
section itself flips to the summary "39.739970, 0.000000" on the first
coordinate — the pre-existing `lat !== 0 || lng !== 0` hasPin spelling,
untouched this arc and already flagged for consolidation.) Adding
longitude flips the strip to VERIFIED and enables Generate.

### 6. Post-pin unchanged (`06-quiet-pin-generated.png`)
Quiet residential pin (39.7266, -104.9532 — manual coordinates, no
detection facts, away from the refusal spot): verdict renders
(VERIFIED · READY FOR TCS REVIEW) and Generate produces the package as
before (results hero with Total devices). Post-pin behavior is the
pre-#186 behavior.

## Notes

- Nothing was blocked; no drift encountered. The one mid-run script
  correction was to check 2's own assertion (it originally counted the
  unrelated `?_rsc=` footer prefetches as click traffic); the product
  behaved correctly in both runs.
- `arc4-live-checks.js` is the exact script that produced this log.
