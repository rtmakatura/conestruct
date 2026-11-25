# #561 production check

Run 2026-11-25 against `https://www.conestruct.com`, after the ship of `739b1032` (healthz sha `739b10322e36b306c0272d6e2e610c4b458722bd`; the ship reported the served frontend built at `739b103`). Headless Chromium, read-only: nothing saved, nothing downloaded, no sign-in.

- Script: `script/walk-561-prod.mjs`, the branch's `script/walk-561.mjs` with only the helper import path changed, run with `WALK_SITE=https://www.conestruct.com`. Checks: `script/summary-prod.mjs`, the branch's `script/summary.mjs` with only the path to #556's measures changed.
- The same one browser edit as the local walk for the "unset" states: the road lookup's answer has every `highway_class` rewritten to `road`, so the page sets no street class. Nothing else is edited.
- Sizes: 390x844, 390x600, 390x480 and 1440x900, street class set and unset, both states, both views.

## Result

- `run.log`: all 8 runs, errors: none.
- `measures-summary.txt`: 309 checks, 0 failed. It is the same, line for line, as the local walk's `../measures-summary.txt`.
- The key has "Not checked" exactly when a hollow bar is drawn. The five-entry key is one line at 1440.
- The fade is drawn exactly where more than 1 px of the body is under its bottom edge, and gone at the end.
- The body is as tall as in #556's walk in all 12 shared readings.
- axe 0 violations, no control under 44 px, in every reading.
- 30 crops in `crops/`. The one to open first: `561-class-unset-night-week-390x600.png`.
- Token scan: the gate token appears in no file in this folder (0 files matched).
