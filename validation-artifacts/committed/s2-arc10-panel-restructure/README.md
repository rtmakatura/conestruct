# s2-arc10 — #227 setup-panel restructure (closes #214)

Arc evidence folder. Refs #227, #214.

The design source of record is the arc-9 committed PDF
(`../s2-arc9-type-system/Conestruct—Setup-Panel-Design-Recommendations.pdf`,
sha256 `3289…9067`); the structural rulings are the 2026-08-27 GO
(all seven checkpoint questions accepted as recommended). The adopted
rules live in `conestruct/site/DESIGN-SPACING.md` under
"Panel structure + glyph vocabulary (issue #227)".

## Rulings applied (GO, 2026-08-27)

1. Fact strip renders **pinned state only** (pre-pin keeps the pick
   CTA + manual fallback per #222; empty-state deviation recorded).
2. **No inline bold** in the four promoted #198 disclosure sentences —
   single text nodes; `handoff-provenance` suite passes unmodified.
3. Resolution records are **shell state** — cleared on pin move, never
   on the payload; byte-identity with/without records asserted.
4. Two CHOSEN tokens: `--glyph-cell: 16px`, `--bar-seg-min: 6px`
   (single-sourced in `lib/design/tokens.ts`, mirror-tested).
5. The corridor rows' hard-prefixed ✓ **dropped** (no verdict, no ✓).
6. Schedule per-row verdicts = **display-only join** of the backend
   `hours_eval` onto the window rows; no client time arithmetic.
7. #214 bearing disclosure in **both places**: the Road-step block and
   the picker's bearing field note; no handler changes.

## Contents

- `red-proof-commit1-disclosure.txt` — the disclosure-container +
  token-mirror tests failing against pre-arc source (7 failed /
  1 passed; the pure token-table half green). Turned green by commit 1.
- `red-proof-commit4-resolved-records.txt` — the two reshaped Dismiss
  cases (suggest-contract / class-suggest) failing against the pre-#227
  clear-the-slot behavior (2 failed / 11 passed). Turned green by
  commit 4.
- `probes/contrast-measure.py` → `contrast-measurements.txt` — WCAG
  ratios for every ink the restructure puts on `--canvas` and
  `--canvas-tint` (warn / pass / none / ink-on-dark / white / faint):
  12/12 PASS, floor 5.61:1 (Rule 13, measured not asserted).
- `live-checks/s2a10-live-checks.js` + `outS2A10LC/` — the local
  before/after run (BEFORE = main checkout dev at pre-arc HEAD
  `793a3f1` on :3111, AFTER = this branch on :3112; the prod re-run
  happens after ship). **ALL PASS** (`assertions-raw.md`, 21/21):
  - L1 captures: `before-/after-{shoulder,flagger,near-intersection}.png`,
    `after-*-gray.png` (CSS `grayscale(1)`), `after-prepin.png` (the
    empty states: band pending, no strip).
  - L2 fact strip: five labeled cells; jurisdiction cell answers
    "None — baseline"; absent pre-pin.
  - L3 band: a full-width sibling of Location (`.jctl` left the
    Location body), pending pre-pin (inert + aria-hidden body).
  - L4 resolved records at the Denver pin, live suggest endpoint:
    `record-1-proposal.png` (⌁ + two buttons) →
    `record-2-dismissed.png` (×-record + TIGER evidence + Undo) →
    undo re-arms → `record-3-confirmed.png` (✓-record naming old and
    new); confirm wrote the select.
  - L5 corridor bar: five segments in row order at rendered widths
    `[266,38,114,71,9]` px — the 9 px downstream segment proves the
    6 px floor engages the flex layout honestly; aria-hidden; no ✓
    prefix on the rows.
  - L6 schedule block: Denver's REAL class-scoped row ("Arterial /
    Collector · Weekday") ◌ unevaluated (`schedule-1-unevaluated.png`),
    then — after picking Arterial and a weekday 09:00–15:00 schedule,
    with the evaluated `hours_eval` off the live Modal backend — the
    same row, same label, ✓ "clear" (`schedule-2-evaluated.png`);
    no-jurisdiction shows the one-row answer.
  - L7 the #214 repro on the REAL picker (Overpass detection at
    39.71466 / −104.94071): picked the East Bayaud Avenue candidate
    (way 39508704), typed bearing 90 over detected 85; the picker's
    role note stood beside the field (`214-1-picker-bearing-90.png`),
    and after Save & Close the Road step's block showed detected 85° ·
    applied 90° · "road geometry governs the drawing — the typed
    bearing sets the travel-direction sign only"
    (`214-2-detected-vs-applied.png`).
  - L8 axe (arc16 injection idiom): violation-id sets unchanged —
    `[region]` pre-pin, `[label, region]` pinned, before == after
    (`axe-before.json` / `axe-after.json`) — the predicted baseline
    held exactly.
