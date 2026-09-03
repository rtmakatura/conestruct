# s2-arc16 — #224 phase 2: the honest Generate flow (+ #241 rider)

Arc of record. Branch `issue-224-phase2-honest-generate` from main `0ca5c33`.
Rulings: Ryan's GO of 2026-09-03 (all nine checkpoint questions accepted as
recommended). Seven commits; the ship line is
`.\scripts\ship.ps1 -Branch issue-224-phase2-honest-generate`.

## What shipped, per commit

1. `2d6bda1` — **#241 rider (backend-first).** `CORRIDOR_CHECK_BUDGET_S = 20.0`
   (CHOSEN: 20 + 20 (site scan) + layout < 60 s proxy) threaded
   `validate_corridor_against_osm → detect_road_bearing →
   _overpass_request_with_fallback`, positional-when-None so single-arg stubs
   stay green; past the budget the existing `check_unavailable` reason carries
   `scan budget exceeded (20 s)`. Callers: `audit.py`, `plan_sheet.py`. Tests +3
   (`red-run-c1-rider.txt`).
2. `0812684` — **audit PDF NOT-CHECKED block** (`_site_scan_blocks`, after
   Corridor Validation, before Site Adjustments; renders only for
   `unavailable + proceeded_anyway`; the backend `disclosure` verbatim) and the
   **two scanned-path containment fixtures** at the Lakewood control
   (`scanned-ok` with the phase-1 recorded payload; `scanned-not-checked` with
   the stub down + proceed). BASELINE +2 at zero; a Rule-11 pin proves each
   fixture really scanned (`red-run-c2-pdf-block.txt`).
3. `6d3baee` — **Generate sets `site_scan` on the wire.** One memoised
   `wireScenario` feeds the debounce, the bundle, the per-file downloads, the
   quote and the audit PDF; the #197 stamp compares against it (the
   permanently-VERIFYING risk is pinned mounted). Copy: empty state, strip
   COMPUTING/slow variants, and the #192 recomputing ribbon name the scan
   (`red-run-c3-wire.txt`).
4. `cfd73fe` — **the first code-keyed refusal.** `matchRefusalCode(code)` —
   one entry on `detail.error === "site_scan_unavailable"`, no message
   sniffing; `matchRefusalAffordance(scenario)` untouched. The Results-zone
   PLAN DECLINED container (`.sys-event warn scan-refusal`, `role=alert`):
   backend message as one text node (renders exactly once), provenance line,
   Retry, and the consequence-stating proceed-anyway. `proceedFor` = per-input
   acknowledgement (ruling 1). Strip pill SERVICE UNAVAILABLE (ruling 2)
   (`red-run-c4-refusal.txt`).
5. `a0ef25a` — **NOT-CHECKED on the panel and in section 03.** SetupStrip
   `.sys-event warn site-not-checked` from the STAMPED audit; section 03 an
   uncounted attention item (`siteScanNotCheckedItem`, the
   `corridorValidationItem` precedent) — the rendered ledger on the recorded
   control fixture equals the shared expectation with and without it
   (`red-run-c5-disclosures.txt`).
6. `24f79ff` — **the manual detect section retires.** Button, scan copy,
   point-mode note, `N flag(s) auto-checked`, the detection maps and the #16
   evidence lines go; the seven checkbox rows survive (ruling 6); one
   provenance sentence replaces the button; #186 doctrine re-pinned
   (`red-run-c6-retirement.txt`).
7. this commit — evidence: this README, `s2a16-lc-prod.js`, the local run, and
   two rendering fixes the browser run surfaced (below).

## Live-check discoveries folded into commit 7 (code)

- **Refusal container was inside the `results-stale` wrapper** (#192 dims the
  stale results on `genState === "error"`), so its text inherited the dim and
  axe flagged the message, provenance and both buttons for contrast. Moved
  OUTSIDE the wrapper: the stale results are the previous answer, the refusal
  is current and keeps its measured contrast (rule 13). After the move, no
  target inside the container appears in any axe capture.
- **Section 03's item sat in a collapsed tier.** The attention chip
  auto-expands on `ledger.attention > 0`; an uncounted item (ruling 9) inside a
  closed chip is a footnote — the Rule-10 failure mode. The chip now also
  auto-expands when the item exists (a rendering decision; `assignTiers` and
  `tiering-expectations.json` remain untouched, and the mounted test pins the
  open state).

## Local run — `outS2A16Local/` — ALL PASS 25/25 (+1 INFO)

`next dev` on the working tree at `24f79ff` (+ the two fixes above, uncommitted
at run time) with `MODAL_RENDER_URL` pointed at a local uvicorn of the same
tree; every leg through the Next proxy routes; Playwright drives the real
`/sandbox`. Overpass was slow from this machine at 17:12–17:40 UTC, which
handed the run what prod can't be made to do on demand: **a live budget
refusal.** Captured, in order: the wire 400 (`B-scanned-audit.json`), the
proceed-anyway audit with the exact disclosure (`C-proceed-audit.json`), the
audit PDF text carrying `SITE CONDITIONS NOT CHECKED` (`D-proceed-audit.pdf`),
the pre-generate panel without the button (`E-pre-generate.png`), the Generate
click sending `site_scan` on both fetches, the wait copy on strip + ribbon, the
PLAN DECLINED container with SERVICE UNAVAILABLE (`F-refused.png`), Retry
refused again after a full 20.9 s, proceed sending the acknowledgement on both
fetches, and the proceeded plan with the disclosure on the panel and in section
03 (`F-proceeded.png`). Axe: refused state 1 violation (`color-contrast`, 18
targets — all in the dimmed download cards / pricing of the pre-existing #192
error-state dim, none in this arc's containers); proceeded state 0; the
s2-arc11 prod baseline is 2 (`label`, `region`).

Latencies under that stall, local: plain audit 22.4 s (the #241 budget doing
its job — the corridor check gave up at 20 s and the audit completed instead
of hanging), scanned audit refusal 20.7 s, proceed-anyway audit 41.4 s
(20 s corridor budget + 20 s scan budget + layout — under the 60 s proxy, as
the constant's arithmetic predicts, but close; noted for the post-ship table).

The SIZE line in this run compares a plain audit to a 400 body (the scan
refused), so it is not the growth number; the s2-arc15 prod numbers stand
(5256 → 11602 B, +6346 B) and the post-ship run re-measures.

## Decisions recorded

- `/api/render/detect-site` (Next proxy route) and its 4 tests are KEPT
  through phase 3 (ruling 5): the s2-arc15 prod live check's parity legs post
  through it. Retire with the checkbox rows in phase 3.
- Checkbox rows untouched; `manual_flags_discarded` not rendered this arc
  (ruling 6). Sheet + crew narrative disclosure = phase 3 (ruling 7).
- The rows' #16 evidence lines retired with the button (they were computed
  from the button's result, which carried the two input drifts recorded in
  the s2-arc15 README); evidence returns as phase-3 tier rows.
- Pointer / button labels are UI affordance strings of the same class as the
  existing refusal pointers; the backend `message` and `disclosure` are the
  only reason sentences and render verbatim, once per surface.

## Rule 5 — churn predicted vs actual

| where | predicted | actual |
|---|---|---|
| SiteConditionsField.detect.test.tsx | deleted (3) | deleted (3) |
| SiteConditionsField.rows.test.tsx | 4 deleted, 2 adapted | rewritten: 3 tests (the two #186 pins + rows still write meta) |
| GeneratorShell suites pinning post-Generate bodies/ribbon | ≤ 5 files | **0** — the ribbon reworded to keep "Recomputing" so the four `/Recomputing/` pins stayed unmodified; no body-equality assertion existed |
| StatusBar tests (pill) | churn if vocabulary changed | **0** — the pill changes only for the new code; existing suites unmodified; new StatusBar.scan-copy (4) |
| test_pdf_containment BASELINE | +2 | +2 (+1 Rule-11 pin) |
| test_audit_pdf | +1 dedicated test | new file test_audit_blocks_site_scan (6); `_SKIP_KEYS` unchanged |
| rider tests | +3 | +3 (+1 positional pin, green at baseline) |
| snapshots | none | none |
| #228 sentinel / rail suites · #198 byte-identity · #227 container test · tiering expectation JSON | unmodified | unmodified |

Visible changes (exactly the ruled set): the detect button → one provenance
sentence; the Generate wait names the scan (empty state, ribbon, strip
COMPUTING and slow variants); the PLAN DECLINED container with Retry +
proceed-anyway; NOT-CHECKED on the panel, in section 03 and in the audit PDF;
the pill word SERVICE UNAVAILABLE. Not a sixth: the ribbon discovery is the
same "scan-naming wait copy" applied to the surface a first Generate actually
shows (the pre-generate loop already holds a breakdown, so the empty state is
never reached on a normal first Generate).

## Prod runs — `outS2A16Prod/` — ALL PASS 19/19 (+3 INFO) on `9046f1c`

Shipped 2026-09-03; `/healthz` == `origin/main` == `9046f1c` (gate line in
`s2a16-lc.md`). Two runs, minutes apart, both sha-gated:

- **Run 1** (`s2a16-lc-run1-superseded.md`, 18:00Z): leg C's scan was refused
  on prod and the proceed-anyway audit carried the EXACT disclosure on the
  wire (C2 PASS). Its single FAIL was a script defect: D2 judged the PDF by
  leg C's outcome, but a refused scan is never memoised and the PDF's own
  request landed on a container whose scan succeeded (the PDF prints the
  scanned Site Adjustments rows, no disclosure — the honest output for that
  request). Fixed: D2 now judges the PDF by its own content.
- **Run 2** (`s2a16-lc.md`, 18:03Z): ALL PASS 19/19. A natural budget
  refusal landed in the BROWSER: PLAN DECLINED · SERVICE UNAVAILABLE, the
  backend message once in the container, no generic ribbon, Retry + the
  consequence-stating proceed-anyway offered (F1–F4; `F-refused.png`). The
  retry then succeeded, so proceed-anyway itself was not exercised on prod
  (INFO; captured live in `outS2A16Local/`). Axe: post-generate 0, refused 0
  (baseline 2). Sizes: plain 5256 B, scanned 11500 B, +6244 B.

#241 on prod (`latency-241-prod.txt`): under a slow Overpass, three plain
audits completed at 20.9–21.4 s with `check_unavailable` — the same condition
that measured as three ~61 s 504s in the s2-arc15 after-table. None over 45 s.

## Post-ship (next prompt)

Prod run of `s2a16-lc-prod.js` on the evidence branch `s2a16-live-checks`
(dies in this arc's janitorial, #238 convention); the natural-refusal wait
with the honest INFO fallback; Ryan's hand-confirm of the visible flow; then
the #241 close and the #224 phase-2 re-scoping comment, both chat-drafted.
