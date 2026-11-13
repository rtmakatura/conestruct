# #535 production check: PASS (main af6fc7b)

Run 2026-11-13 after SHIP VERIFIED (healthz sha and the served frontend both `af6fc7b`). https://www.conestruct.com, the real backend, no stubs, read-only: nothing was saved. The fix and Undo change only the page's own state. Headless Chromium, DPR 1, at 1440x900, 1198x930 and 390x844. The gate token was sent as a header only and never printed. Script: `script/walk-535-prod.mjs`. Results: `crops/prod-walk.json`, `run.log`. Crops: `crops/prod-*.png`.

Flow: pin 1550 E Colfax Ave, Denver (by search), Shoulder, the first side, confirm. Dates Mon Nov 16 to Sun Nov 22, 2026; hours 7 am to 5 pm (outside). The fix, then a hand edit of the start back to 7 am, then the dates changed to Mon Nov 23 to Fri Nov 27, then the row's Undo.

| Check | 1440 | 1198 | 390 |
|---|---|---|---|
| Fix offered at 7 am to 5 pm | "Change my hours to 8:30 am to 3:30 pm" | same | same |
| After the fix | 8:30 AM to 3:30 PM, record "Hours changed to 8:30 am to 3:30 pm. Undo" | same | same |
| R2: hand edit to 7 am, window reopened | record and "Change my hours to 8:30 am to 3:30 pm" both show; fix below the record, no overlap | same | same |
| axe on the window with both showing | 0 violations | 0 | 0 |
| Dates changed to Nov 23 to 27 | record stays (pin unchanged) | same | same |
| R1: Undo | times back to 7:00 AM to 5:00 PM; dates stay "Mon Nov 23 to Fri Nov 27"; record gone | same | same |
| Console errors | 4, all `net::ERR_NAME_NOT_RESOLVED` | 4, same | 4, same |

The console errors are `events.mapbox.com` (Mapbox's telemetry host) not resolving from this machine. A one-size probe listed the failed hosts: `events.mapbox.com net::ERR_NAME_NOT_RESOLVED`, plus aborted (cancelled) requests to `api.mapbox.com` and `www.conestruct.com`. #535 adds no request. #526's check on 2026-11-12 logged 0, so the lookup failure is this machine's network today, not the site.

Not checked in production: a second fix while the record stands (R145 S1). The unit test covers it (`WorkHoursDialog.test.tsx` "#535: the fix comes back while the record stands…").
