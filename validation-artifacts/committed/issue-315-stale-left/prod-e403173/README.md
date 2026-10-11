# #315 on prod `e403173` (2026-10-10)

The r120-prod repro re-run after the ship (`../after-4c21cd9/capture_315.cjs`, `AUDIT_SITE=https://www.conestruct.com/sandbox`):
N Broadway SB, Shoulder work, East side (left), then Flagger lane closure, at 1440 and 390.

| | Before (prod `60bbe09`, `../../issue-300-left-side-oneway/r120-prod/`) | After (prod `e403173`) |
|---|---|---|
| Side control | no options; "the road's sides are unavailable. Reopen the map to retry" | West offered; "⚠ Left-side work is laid out for shoulder work only. Pick a right-side curb, or switch back to Shoulder work." |
| Aerial | "The aerial didn't load." | the pin picture (`data-stage="pin"`), "Say which side is occupied to lay out the work" |
| After picking West | | the line gone, West checked |

No sideways scroll and no page errors at either width (`facts-<w>.json`). Ryan's browser check passed the same day.
