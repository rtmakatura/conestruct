# Arc 16 live checks — production, 2026-08-14

Runner: `arc16-live-checks.js` (headless Playwright, read-only — one
transient plan generated, nothing saved). Raw log: `out16/assertions-raw.md`.
Ship note: the first `ship.ps1` attempt failed at push (the known
credential-prompt hang); resolved by setting the repo-local
`credential.helper` to the `gh` bridge, then SHIP VERIFIED at `8c45d27`.

## Gate

healthz `8c45d27…` == `git rev-parse origin/main` == served-bundle sha
(found in the served `_next/static` chunks). Passed first probe; no
mid-propagation retry needed.

## Results — 13 PASS, 2 FAIL (one pre-existing node), 2 stated-unreachable

| # | check | result |
|---|---|---|
| 1 | junction rule in the served CSS (12px row step) | PASS |
| 2a | jurisdiction strip inside the select's `.jctl-field`, after it | PASS |
| 2b | strip computed `margin-top: 12px`, `padding-left: 0` | PASS |
| 3a | generate footer computed 24/24 | PASS |
| 3b | scenario-picker block `padding-bottom: 16px` | PASS |
| 3c | `.empty-state` 24/24/24, DOM-measured (mounted pre-generate) | PASS |
| 3d | quote-settings grid `margin-bottom: 16px`, post-generate | PASS |
| 3e | delta-legend gap | **unreachable** — legend not rendered at this pin/scenario; stated, covered by diff + mounted suite |
| 4a | modal header gutter `padding-x: 24px` (was 20) | PASS |
| 4b | coord-grid gutter ancestor `padding-left: 24px` | PASS |
| 5a/5b | axe wcag2a/aa/21aa/22aa, generator + open modal | **FAIL — one finding, same node both scans** (below) |
| 6a | moved strip carries glyph (◌) + text channels, never hue alone | PASS |

Screenshots: `01/02` jctl strips color + grayscale (Rule 13 pair — the
placement fix legible without hue), `03` open modal at the 24px gutter,
`04` post-generate page, `05` Flagger Road section at the Lakewood pin
with two armed confirm rows — the #200 junction live (symmetric 12px
re-entry above Speed limit).

Also exercised in passing: the plan-sheet width gate fired honestly at
the Lakewood relays (4×12 ft + 10 ft shoulder → GENERATION BLOCKED with
the recovery sentence); following its recovery (lane width → 10.5
through the real form) unblocked Generate. The #136/#158-family gate
chain behaves on prod exactly as the mounted suite says.

## The axe finding — pre-existing, newly surfaced, Ryan's disposition

`color-contrast` (serious) on `.jbar-suggest > span:nth-child(2)` — the
quiet band's "Drop a site pin for a jurisdiction suggestion" text.
Measured: `rgb(147,160,176)` at strip `opacity: 0.7` over `.jctl`
canvas `rgb(20,32,46)` → effective ≈ **3.8:1** against the 4.5:1 AA
floor (Rule 13: measured, not asserted).

Why this is pre-existing and not an arc16 regression:
- The arc's diff contains **zero color or opacity lines**
  (diff-verifier confirmed className/position-only changes); the quiet
  band rendered with these exact styles before the move, over the same
  `.jctl` background.
- Every prior axe pass (Arc 7/9/11 baselines) ran **post-generate**,
  where the quiet band never renders — this run's pre-pin scan is the
  first time any axe pass has seen this state. The Arc 7 zero-violation
  baseline on its scanned states still holds (the modal itself scanned
  clean; the one target in `axe-modal.json` is the same page-behind
  node).

Left FAILING in the log rather than exempted in the script — the
disposition is Ryan's, not the runner's. Recommended: a one-line coda
(brighten the quiet band's text or drop the 0.7 opacity, re-measure to
≥4.5:1); alternative: record on the a11y triage pile with the other
parked contrast items. **This is also triage-candidate input**: the
quiet/faint register (`--ink-on-dark-faint` at reduced opacity) likely
fails AA anywhere it renders on canvas.

## Verdict

Arc 16 is live and verified at `8c45d27`: gate green, every reachable
spot-measurement at its token value, both placement changes visible and
legible in grayscale, the modal on the 24px gutter, and one honest FAIL
on record awaiting disposition. Refs #200, #201, #166.
