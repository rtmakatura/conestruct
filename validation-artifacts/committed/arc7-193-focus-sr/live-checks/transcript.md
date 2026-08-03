# Arc 7 live-site verification — #193 (production, headless + axe)

Run 2026-08-03T04:29Z (UTC; 2026-08-02 evening local) against
`https://www.conestruct.com/sandbox`, Playwright headless Chromium with
@axe-core/playwright (both installed to job tmp — no repo package.json
churn). Read-only: no accounts, no DB writes, no plan saves; the only
synthetic failures are route-intercepted 500s on the page's own
device-breakdown and bundle POSTs.

## Build gate

| Surface | SHA |
|---|---|
| `git rev-parse origin/main` | `384c9c80631e76fa2b3b8f8b441dd7d703d44b63` |
| Modal `/healthz` | `384c9c80631e76fa2b3b8f8b441dd7d703d44b63` |
| Served Vercel bundle (`/_next/static` chunk scan) | `384c9c80631e76fa2b3b8f8b441dd7d703d44b63` |

Gate PASSED — all three equal. Frontend-only arc; deploy ordering was
irrelevant, both surfaces at the same sha regardless.

## Results — 19/19 PASS, 0 failures (18 checks + gate)

**Focus policy (keyboard-only where stated).**
- **Check 1, keyboard Generate:** Enter on the focused Generate button
  lands `document.activeElement` on the results `<section>`
  (`tabindex="-1"`, zone title "MHT package"); the next Tab proceeds to
  "↓ All (.zip)" inside the package, not the nav logo.
  `01-post-generate-focus.png`.
- **Check 2, armed error settle:** with the breakdown settled to a
  synthetic 500, reopen → Generate lands focus on the results zone —
  which now holds the alert ribbon — and the scrollIntoView spy count
  is unchanged (2 → 2): no scroll on error, exactly the #152 E ruling.
  `02-error-focus-alert.png`.
- **Check 3, strip editor round-trip:** the speed editor opens focused
  (`#strip-speed`, autoFocus in); closing via selection restores the
  "Edit Speed" cell button. Deliberate-move control: with the
  work-zone editor open, clicking the Speed cell leaves focus in the
  newly opened speed editor — never yanked back. `03-strip-restore.png`.
- **Check 4, Reopen:** "Edit full setup" lands focus on the Setup zone
  section ("01 Setup — Describe the work zone"). `04-reopen-focus.png`.
- **Check 5, picker detached-opener:** from a fresh unset page, "Pick
  Location on Map" → map-click pin → detection settles → "Save & Close"
  (the first save, which swaps the opener away). Focus lands on the
  location block fallback (`<div tabindex="-1">` holding the pin
  summary "39.127821, -105.620850 · Road properties…"), not `<body>`.
  `05-picker-fallback-focus.png`.
- **Check 6, background settle:** with focus in the strip work-zone
  input, the debounced refetch settles and focus stays in the input.

**Announcements.**
- **Check 7, status region:** after Generate the `role="status"` region
  reads "Plan generated — 31 devices, 9 types." — byte-equal to the
  rendered hero counts [31, 9]. After reopen → repeat Generate it
  re-announces ("Plan generated — 170 devices, 9 types." — the counts
  moved with the check-6 work-zone edit, proving re-derivation, not a
  cached string). Full region serialization before/after:
  `regions-before-after-generate.json`.
- **Check 8, failure alerts:** the background 500 settle renders the
  "⚠ Device breakdown failed" ribbon with `role="alert"` (and moves no
  focus — the strip cell keeps it); the ribbon is still on screen at
  the armed error settle; an intercepted bundle 500 renders
  "Bundle failed (500)" with `role="alert"`.

**Measured WCAG (axe-core, tags wcag2a/2aa/21a/21aa/22aa).**
- **Check 9, scans:** pre-generate: **1 rule** — `label` (critical,
  WCAG 4.1.2), 2 nodes: the sidebar's manual lat/lng fallback inputs
  (`input[step="0.000001"]`). **Pre-existing, outside this arc's
  touched surfaces** (form-labels pass was flagged-not-fixed in the
  approved scope) — triage input, not an arc failure.
  Post-generate: **0 violations** — the surfaces this arc touched
  (results zone, strip, status region, ribbons) scan clean.
  `axe-pre-generate.json` / `axe-post-generate.json`.
- **Check 10, tab-walk:** 23 stops logged post-generate
  (`tab-walk.json`); never two consecutive `<body>` stops (no
  dead-end), no trap, package content reachable (>1 stop inside the
  results zone).

## Run notes

- Two runs. Run 1 failed only its own probe (2b/8a): intercepting the
  breakdown route and then clicking Generate never produced an error —
  the breakdown was already settled ready, so the armed click
  legitimately staged to post (the "failed" scroll was the correct
  success scroll). Fixed by settling the error BEFORE the armed click
  (strip edit under interception), which also yielded the two
  background-failure assertions (8a-i/8a-ii). Run 2 (this one): 19/19.
  No production behavior differed across runs — every product
  assertion that executed passed identically in both.
- Full timestamped assertion log: `assertions-raw.md`.
- Script: `arc7-live-checks.js` (run with
  `EXPECTED_SHA=$(git rev-parse origin/main) NODE_PATH=<tmp>/pw/node_modules node arc7-live-checks.js`;
  outputs land in `out7/`).
