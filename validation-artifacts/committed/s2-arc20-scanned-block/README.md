# s2-arc20 — the scanned block's grid (#248) + the results-head wait line (#247)

Branch `issue-247-248-scanned-block` off `main` `0e4b4a1`. Frontend only:
wire, backend, fixtures, snapshots **0** (no file under `src/`, `tests/`,
or any fixture directory is in the diff; `pytest` unchanged at 2036 passed
+ 2 skipped — `test-accounting.txt`).

Commits:

| # | sha | what |
|---|---|---|
| 1 | `e79f699` | #248 — the block is a four-column grid (Condition · Result · Evidence · Action), subgrid rows, one shared action edge; `details[0]` leaves this surface |
| 2 | `628d691` | #247 — `deriveResultsHead()` + `<ResultsHead>`: one derived slot, the wait line while a fetch for the generated scenario is in flight, the #246 jump line on settle |
| 3 | (this) | evidence: local run ALL PASS 44/44 at both viewports; the prod run lands here after the ship |

## What was measured on prod `0e4b4a1` (investigate, 2026-09-05)

`investigate/a20-measure.js`, Denver repro pin from #247 (39.7269, −104.9873),
headless Chromium, sha-gated.

**#248 — the block as prose** (`investigate/prod-run2/rows-*.png`, `log.txt`):

| | 1440×1000 | 380×800 |
|---|---|---|
| detected rows with the button wrapped under the prose | 3 of 4 (row h 52 vs 24) | 4 of 4 (h 108) |
| distinct action x-positions | 3 (x 188 / 477 / 1147) | 1, every button under its prose |
| picker open | Cancel wraps (h 58); with "other", Confirm + Cancel wrap (h 61) | chips on 3 lines, buttons on a 4th (h 161 / 198) |
| record row | h 120 — glyph, sentence, Undo on three lines | h 175 |
| `details[0]` printed | yes (`unnamed at 39.7256, -104.9875 [work_zone @ 460 ft]`) | yes |

**#247 — where the status line is** (`investigate/prod-run2/generate-*-samples.json`):

| t after Generate | 1440×1000 | 380×800 |
|---|---|---|
| ~0 ms (sidebar unmounts, scroll clamps) | status bar −61..−14 | −1067..−979 |
| ~260–540 ms (scroll anchoring settles) | **27..74** "COMPUTING · scanning…" | **7..95** |
| 2.6 s (`verifySlow`) | 27..74 "VERIFYING · scanning site conditions along the c…" | — |
| fixed nav | 0..52 | 0..52 |

The bar is inside the viewport by rect and **under the fixed nav** in
fact: the `.zone` scroll margin is `nav-h + rail-h + 8 = 98px`, budgeted
for the pre-generate sticky rail — which unmounts with the sidebar — so
the 46 px between the nav and the results top holds only the bottom of
the bar. `investigate/prod-run1-refused/landed-1440x1000.png` shows the
PLAN DECLINED bar clipped the same way. The issue's "landing scrolls
past" reading was close but not the cause; option (b) alone would not
have made the bar visible.

**Finding — refusals on the Denver corridor.** Run 1 was refused at both
viewports (`scan budget exceeded (20 s)`, `investigate/prod-run1-refused/`).
Run 2 settled in 3.4 s (1440) and 21.6 s (380) with no Retry. Whether
the backend caches the corridor between requests is not established
here; recorded as observed. The live-check script clicks Retry scan
through the refusal container (≤ 3) so the block can render — a refusal
is a finding first (logged as `FINDING:`), a script bug second.

## Rulings applied (GO 2026-09-05)

- **(a) Grid** — block-scoped `.sc-*` classes inside the existing
  `.jbar-suggest live` root; `.sugg-row` / `.sugg-name` /
  `.jbar-suggest .sys-event` / `button.confirm|ghost` rules
  byte-identical (`SetupStrip.grid-tokens.test` pins the three rule
  bodies). Row mechanics from `.sched-window-row` (baseline-aligned grid
  rows; PDF p. 2 / p. 4 "same rows, same widths, only glyph and value
  change"), heads / gap / numerals from `.dva-grid` (PDF p. 3
  detected-vs-applied), dashed `--rule-soft` separators (the gen2
  `.checkline` idiom, `design/generator_redesign/1-source/gen2-styles.css:390`).
  Type roles per PDF p. 3: Condition `tr-field`, Result mono glyph +
  word, Evidence mono 11px faint tabular, Action the unchanged buttons.
  **Result glyphs mirror section 03's tiers** — `▲ detected` (`--dim`),
  `✓ none along the corridor` (`--pass`), `× dismissed` (`--none`),
  `✓ asserted` (`--pass`), `⚠ moot` (`--warn`); words trace to the audit
  PDF's Result column (`src/rendering/audit_blocks.py:380,382`). The
  issue's ●/○ are not in the reconciled vocabulary (DESIGN-SPACING
  §#227: ● not adopted, ○ → ◌ = unevaluated).
- **(b) `details[0]` leaves this surface** — `scanEvidence(b, { details:
  false, anchorSuffix: false })`; defaults keep the section-03 / PDF
  string byte-identical (`lib/tiering.test.ts` untouched, green).
- **(c) ≤480 px** — CHOSEN, not designed (PDF p. 5; #153 open): two
  tracks, facts stacked in column 1, the action spanning them in column
  2. An empty Evidence cell keeps one line (`min-height: 1lh`) so
  detected and absent rows stand the same height; it prints nothing.
- **(d) #247 = option (a)** — `deriveResultsHead()` in
  `GeneratorShell.tsx`, `<ResultsHead>` renders it verbatim. `wait` while
  `genState === "generating"` or the stamped audit is `loading` for the
  generated scenario; `detected {count}` from the settled scan; null
  otherwise. Slot order: wait/jump line → refusal container (unchanged)
  → the plan. Copy CHOSEN: "Scanning site conditions along the corridor
  — up to 20 s · the plan settles here". `StatusBar` copy and tests
  untouched; #152 E landing and #193 focus untouched. Not a rail entry
  (#228): the rail is unmounted post-generate and the line is results
  content, not navigation.
- **(e) Header/footer kept** (`tr-section` / `tr-prov`); `tr-step`
  column heads added, hidden ≤480.
- **(f) Picker** — exactly one extra row; legend + chips + note span the
  three fact columns; Confirm alone in the action cell; **Cancel takes
  the condition row's action slot**. The record row keeps `sys-event
  confirmed|dismissed|warn` + `.sys-glyph`; the sentence is ONE text node
  in the Evidence cell (#198), wrapping allowed.

### Recorded deviations (Rule 5, stated before the diff where they were predictable)

1. **Evidence track is `minmax(0, 1fr)`, not `auto`.** Measured locally on
   the first pass: with `auto`, the record row's sentence sized the track
   to its max-content and starved the `1fr` Condition track to zero (the
   label wrapped per word and overlapped the Result column). Recorded in
   the CSS comment.
2. **Chips at 380 px stack one per line**, not 2×2: the Confirm column
   (121 px) leaves ≈190 px for the picker cell. Confirm stays in column 2
   as ruled; the sub-row is still exactly one grid row.
3. `scanEvidence` gained two options (`details`, `anchorSuffix`) rather
   than the one the ruling named, so the cell reads `N found · nearest X
   ft` as specified without changing the wire-literal "from anchor" phrase
   anywhere else.

## Local run — ALL PASS 44/44 (`outS2A20Local/`)

Stack: `local-stack/a20-overpass-mock.py` (serves the recorded Lakewood
Overpass payload, held `A20_DELAY_S=8` seconds per request so the scan
is visibly slow) + `local-stack/a20-uvicorn-stubbed.py` (the working
tree's backend with `OVERPASS_MIRRORS` pointed at the stand-in) + `next
dev` with `MODAL_RENDER_URL=http://127.0.0.1:8765`. Lakewood pin
(39.7113, −105.0815) because the stand-in answers every corridor with the
Lakewood payload. Honesty note: the local scan is real backend code over
a recorded payload; the prod run scans live.

Per viewport (1440×1000 · 380×800), legs W1–W3 (generate and assert),
W2b, R1–R8: see the header of `s2a20-lc-prod.js` for the leg contract
and `outS2A20Local/log.txt` for every PASS line. Highlights:

| leg | 1440×1000 | 380×800 |
|---|---|---|
| W1 wait line in `[nav-h, innerH]` while pending | 117/117 samples after 600 ms (first in-view rect 137..154) | 38/38 (174..220) |
| W2 / W3 | wait gone on settle, jump line present; 0 co-present samples | same |
| R1 one action edge | right 1252 for Dismiss / Assert / Cancel / Confirm / Undo | right 338 |
| R2 no wrap | none | none |
| R3 row heights | 37 × 5 | 71 × 5 |
| R4 picker | 5 → 6 rows; picker row [Confirm dismiss]; condition row [Cancel] | same |
| R5 `details[0]` | absent | absent |
| R6 axe (picker open / chosen / other+note) | 0 in block; total **0** (baseline 2) | 0 in block; total 2 = the two named pre-existing (`scrollable-region-focusable .gap-8`, `target-size .strip-edit-all`) |
| R8 record | `✓asserted`, sentence 1 node, [Undo]; undo → 5 rows, 0 records | same |

R7 measured pairs (both viewports, on `--canvas #14202e`): ▲ `#ff8a2e`
**7.00** · ✓ `#4fd787` **8.94** · Result word / Condition / legend
`#c8d1dd` **10.68** · Evidence / column head / chip unselected / ghost
`#93a0b0` **6.19** · chip chosen / Confirm `#34a9e8` **6.26** · note ink
`#ffffff` **16.46**. All ≥ 4.5:1 (AA). The arc-19 picker figures are
unchanged.

`outS2A20Local/wait-generate-1440x1000.png` shows the mechanism in one
frame: the COMPUTING bar clipped under the nav at the top, the wait line
at y≈145 in the results head.

## Prod run

Pending — runs on `s2a20-live-checks` after the ship, sha-gated on
healthz == origin/main:

```
node validation-artifacts/committed/s2-arc20-scanned-block/s2a20-lc-prod.js <outDir> <sha>
```

## Churn — predicted (GO) vs actual

| surface | predicted | actual |
|---|---|---|
| `SetupStrip.corrections.test.tsx` | 2 rewritten, +3 | **1 rewritten** (the "wire's words" case), +3 |
| `SetupStrip.corrections-tokens.test.tsx` | 0 | 0 |
| `GeneratorShell.site-jump.test` → `results-head.test` | renamed; 2 kept, +2 | as predicted |
| new grid CSS-rule test | +2 | **+4** (`SetupStrip.grid-tokens.test`: grid, tokens, ≤480, band rules byte-identical) |
| `TieredReference.*`, `StatusBar.*`, `scan-refusal`, `scan-disclosure`, `SetupStrip.focus`, `ProgressRail.single-voice`, `lib/tiering.test` | 0 | 0 |
| band `.sugg-row` / `.sys-event` / `.sugg-name` rule blocks | byte-identical | byte-identical (pinned by test) |
| vitest | 928 → ~934 | 928 → **937** |
| pytest · fixtures · snapshots · backend · wire | 0 | 0 |
| axe 1440 | 2 → 2 | 2 → **0** with the picker open (the local run has a live breakdown; the arc-19 figure was measured under dimmed stale results) |
| axe 380 | 2 → 2 (named) | 2 → 2, exactly the two named |
| behavior changes | block DOM restructured; `details[0]` leaves this surface; wait line in the results head | as predicted, plus the three recorded deviations above |

## Contracts

- **#198** — the four disclosure strings are untouched and the block's
  record renders `c.disclosure` as one text node in one `<span>`
  (`SetupStrip.corrections.test` "#248: the open picker…" asserts
  `childNodes.length === 1`; R8 in the browser).
- **Rail** — `ProgressRail.single-voice.test` green; the results head is
  results content (the rail is unmounted post-generate).
- **Suggest-never-set** — only Dismiss → Confirm, Assert, Undo write
  `meta.siteConditionOverrides`; the derivation writes nothing.
- **Rule 3** — no new frontend math; the Evidence cell prints the wire's
  count and nearest distance.
- **Rule 10** — wait line only while a fetch for the generated scenario is
  in flight; the absent row's Evidence cell is empty; the slot is null
  when nothing applies.
- **Rule 13** — every Result glyph rides beside a word; pairs measured
  above.
- **Citation counter** stays at 19 (no citation added).
- `getByText` reads direct text nodes: labels, result words, and
  disclosures are each one text node.
- The corrections sentinel (`TieredReference.corrections.test.tsx:75`, no
  button in a tier row) is untouched.
- **#235 boundary** — this arc takes the "Site conditions — scanned"
  block out of #235's scope; #235 keeps Surfaces A–D, the riders #240 /
  #234, and the section-03 OPERATOR rows.

## Files

- `s2a20-lc-prod.js` — the live check (local + prod modes).
- `outS2A20Local/` — the local run (log, samples, axe, pairs, geometry
  JSON, screenshots).
- `red-run-c1-grid.txt` — 8 failed on the baseline sources (commit 1).
- `red-run-c2-results-head.txt` — the two #247 cases failed without the
  shell change (commit 2).
- `test-accounting.txt` — vitest 937 / pytest 2036 + 2 skipped.
- `investigate/` — `a20-measure.js`, prod run 1 (refused) and run 2
  logs, samples, screenshots on `0e4b4a1`.
- `local-stack/` — the Overpass stand-in (with `A20_DELAY_S`) and the
  stubbed uvicorn launcher.
