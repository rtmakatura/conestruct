# s2-arc7 live checks — production at `1af433d` (Refs #219, #220, #223)

Read-only, headless, 2026-08-24.  Triple gate re-asserted first:
origin/main == healthz == `1af433d3…`; the served bundle carries the
`tier-ledger` marker (background probe, exit 0 after Vercel propagation).

## Tally — 25 PASS, 0 open FAIL

**Wire half (`s2a7-wire-checks.py` → `outS2A7/s2a7-wire-raw.md`), 17/17:**

- W1 ×2 fixtures: the SERVED /api/render/audit + device-breakdown
  responses classify (via the committed `tier_ledger`) to the committed
  expectation exactly — control-lakewood `1/3/10/1`, adv-ni-denver
  `3/4/12/4`, fact-level equal.
- W2 ×2: the SERVED audit-PDF cover carries "Plan status: <the same
  ledger line>" — cross-surface equality live.
- W3 ×4: served audit PDFs for the s2-arc6 adversarial trio + control —
  **zero chars outside the flowing margins** with the new cover row.
- W4 ×3: Denver + weekday 06:00–08:00 → served `hours_eval` OUTSIDE
  (1 violation) → classifies ⚠ → the served cover counts it
  ("3 changes · **5 needs attention** · 12 checked · 3 pending").

**Browser half (`s2a7-browser-checks.js` + `-rerun.js`), all scoped
assertions green at the final run:**

- Typical control (shoulder @ 39.7113,−105.0815 + Lakewood): ledger
  renders all four counted tokens + reference; **open-state contract
  holds** (▲ absent at 0, ⚠ open at 3, ✓/◌/i collapsed); ◌ isolation
  (no pending detail rendered while collapsed); ✓ expand reveals the
  five trace heads + the Audit-PDF download (R1-control-checked-open.png).
- Heavy NI (Race∩Colfax + Denver, signal detected, hold confirmed):
  ledger renders; the signalized approaches item reads in the auto-open
  ⚠ with no click; **#223 parity SERVED** — 4/4 trace heads + the
  side-aware case row inside ✓ (B2-ni-tiers.png).
- Hours-outside rendered: Denver + Arterial + single-day 06:00–08:00 →
  the ⚠ tier auto-opens with the conflict text, no clicks; ◌ drops to 0
  as the hours fact moves tiers (R2-hours-outside.png; ledger
  `0 · 4 · 10 · 0`).
- Axe, both cases: exactly **one** violation each — `color-contrast` at
  the known-baseline `.opacity-80` node (the deferred pile's standing
  FAIL, the same scope-line element relocated).  **Zero new violations.**

## Runner defects (disclosed; none were product defects)

1. First-pass B1/R1 "✓ expand" FAIL: the assert's regex was
   case-sensitive while the chrome renders uppercase via CSS and
   Chromium `innerText` reflects `text-transform` — the diagnostic dump
   showed the chip open with every trace head present.  Fixed `/i`.
2. First-pass B3 FAIL: the schedule is Setup-panel state — the runner
   tried to set it post-generate (the panel had swapped to the strip).
   Moved pre-generate.
3. Second-pass R2 FAIL ×2, both honest product behavior the runner
   mis-anticipated: a Modal cold start outlasted the poll while the
   tiers held the stale answer under the "(refreshing…)" cue (the
   sanctioned #187 presentation, screenshotted); and with street class
   "Not set", Denver's class-scoped windows evaluate to an honest
   UNKNOWN — ◌ held the hours fact until Arterial was set.  Both are
   the disclosure machinery working as ruled.

## Incidental live observation (no action, on record)

The R2 walk also caught a live corridor-validation warning at the
E Colfax pin rendering as its own ⚠ row ("Site corridor validation ·
⚠ 1 warning · OPENSTREETMAP") — the tier placement working on
organically-arising data, not just fixtures.

Refs #219, #220, #223.
