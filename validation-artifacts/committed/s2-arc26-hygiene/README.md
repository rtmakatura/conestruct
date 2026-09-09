# s2-arc26 bucket D — #263 type/ink hygiene · #268 one generated stamp

Two stacked branches off `main 224feb9` (= `a88caad` prod + the DESIGN-PRINCIPLES
docs commit; healthz == `a88caad` at start and at every run below):

- **`batch-d-hygiene` at `8245b7f`** — commits 1–5, the token slice (ships first
  among the four buckets: `--ink-bright` is what A/B/C cite — cross-bucket ruling 3).
- **`batch-d-hygiene-2` at this commit** — commits 6–7, stacked on 8245b7f so the
  token slice ships unchanged.

## The rulings (GO 2026-09-09, bucket D — quoted)

> (1) Static vitest census (`lib/design/type-exceptions.ts` + `type-census.test.ts`
> parsing `globals.css` font-sizes and component `text-*` classes); exceptions
> 76/28/24/20/17/16/14/9 as named; everything else declared debt; **63 → 63, zero
> folds this round**; Playwright census evidence-only. (2) Stamp = `YYYY-MM-DD`, UTC,
> zone omitted; `generated_at()`/`generated_stamp()` in `src/rules/validators.py`;
> XLSX real datetime cells `yyyy-mm-dd`; quote A3 "Generated" + B3 datetime; crew +
> plan DATE via the helper; Rule 3 formatting only; containment BASELINE untouched
> (10-char string). (3) Churn as tabled; no snapshot/fixture moves.
>
> #263: delete `.honesty` opacity (5.61:1 measured on `--canvas-tint`, contrast test
> composited); `--ink-bright: #ffffff` after :732; `type-roles.ts` → `var(--ink-bright)`;
> :2419/:1632/:1657 → token; :1800 → `var(--on-act)` (6.25:1, declared ink change);
> :1054/:1935 declared decorative; TaperViz/PlanSheet declared decorative landing
> illustrations (header comment + `ink-literals.test.ts` pinning 18/36);
> `PIN_COLOR === token(--dim-deep)`, `CROSS_PIN_COLOR === ZONE_COLOR.work_zone`,
> `#06222F === --on-act` pinned; Mapbox style declared decorative. **Hand-offs
> untouched:** :1054, :1452, :1894, :2673, :2710, :2865.
>
> Cross-bucket ruling 3: … D's seven `#fff` literals outside its ranges are swapped by
> their owners (B :1452; C :2865; A :1894/:2673/:2710) — each owner cites `--ink-bright`
> from D, so **D's commit 5 (the token) ships first among the four**.

## What shipped

| commit | branch | what |
|---|---|---|
| `5e1258d` | 1 | **#268 helper** — `_utcnow()` seam, `generated_at()` (naive UTC to the second), `generated_stamp()` (`YYYY-MM-DD`); `tests/test_generated_stamp.py` (7, pure). Red: ImportError. |
| `386d89d` | 1 | **#268 four surfaces** — XLSX Summary "Generated" → real datetime cell `yyyy-mm-dd`; quote A3 "Generated" + B3 datetime cell; crew `generation_date` and plan-sheet DATE → `generated_stamp()`. `tests/test_generated_stamp_surfaces.py` (6, payload-level through the real API, `_utcnow` pinned to 2026-09-08 16:07:35 UTC; openpyxl + regex + pypdfium2; all five print `2026-09-08`). Red: all six (every surface printed the local `2026-09-09`, XLSX cell was `str`, quote A3 held the date). Full suite 2086 passed / 2 skipped; no snapshot or fixture moved. |
| `ebd3e08` | 1 | **#263 declare** — `type-exceptions.ts` (7 named exceptions, 10 owned debt groups, `CENSUS_PINS`) + `type-census.test.ts` (12) + DESIGN-SPACING addendum. Pins: 103 `font-size` declarations on 20 values; 325 Tailwind size-class uses at 109 sites in 37 files. Red as a gate: a probe `font-size: 7px` and a duplicated `text-[14px]` failed three tests by name, then reverted. |
| `2df417a` | 1 | **#263 honesty** — `.honesty` loses `opacity: 0.85`; `quiet-band-contrast.test.tsx` +2 (composited over `--canvas-tint` ≥ 4.5 and ≈ 5.61; mounted caveat). Red: 4.474306. |
| `8245b7f` | 1 | **#263 token** — `--ink-bright: #ffffff` in the `.workbench` block after `--ink`; `.tr-section`, `.jbar-slot-hint b`, `.chain .seg.local` → the token; confirm hover `#0b1420` → `var(--on-act)` (**declared ink change 7.04 → 6.25:1**, still AA); `type-roles.ts:73` → `var(--ink-bright)` (mirror test follows, no edit); `tokens.test.ts` +3. Red: three tests. |
| `a6b5618` | 2 | **#263 ink literals** — `ink-exceptions.ts` + `ink-literals.test.ts` (11): globals.css outside `:root`/`.workbench` = decorative `#1a1200` (caution stripe) + `--sc-leader #4a6280`, plus the five owner-swap `#fff` as an allow-list the owners delete rows from (stale row fails); code literals per file by exact set + count — TaperViz 18 / PlanSheet 36 DECORATIVE (header comments), picker 4 (`PIN_COLOR === --dim-deep`, `CROSS_PIN_COLOR === ZONE_COLOR.work_zone` by value; Mapbox paint decorative), spinner `#06222F === --on-act` by value, `ZONE_COLOR` palette source (5), Clerk theme (3). Red: two tests before the comments. |
| this | 2 | **evidence** — this README, `type-census.mjs`, `out-local/` (run 2) and `out-local-run3/` (run 3). |

## Live measurement (`type-census.mjs`, local dev server on 3004 → prod Modal backend)

Frontend sha **`a6b5618`**, backend healthz **`a88caad`** (the prod backend; the #268
backend commits are not deployed yet — this leg measures the frontend). Denver pin
39.7269 / −104.9873, bearing 180, 1,000 ft, entered manually; no natural refusal in any
run (#256 retry armed, unused). **ALL PASS 10/10** in runs 2 and 3 (`log.txt`,
`rows.json` in each out dir).

| probe | 1440×1000 | 380×800 |
|---|---|---|
| T2 `.honesty` pair, pinned (`PAIRS` over `.jbar-suggest`) | `#93a0b0` / `#1b2838` **5.61** (opacity 1) | **5.61** (opacity 1) |
| T2b other `.jbar-suggest` pairs < 4.5 | none | none |
| T3a axe `color-contrast`, pinned | **0** | **0** |
| T3 axe `color-contrast`, settled | **0** | **0** |
| T3b axe full run, settled | heading-order×1, region×1 | heading-order×1, region×1, scrollable-region-focusable×1, target-size×3 (the audit's named set; no new) |
| T4 `.tr-section` computed colour | `rgb(255, 255, 255)` | `rgb(255, 255, 255)` |
| T1 distinct type tuples, settled (`TYPE` over `main`) | **60** (runs 2, 3); 63 in run 1 | **60** (runs 2, 3) |
| T1 sizes | 16: 9 9.5 10 10.5 11 11.5 12 12.5 13 14 16 17 20 24 28 76 | 16 (60 in place of 76) |

**The tuple count, honestly.** The ruling's figure is 63 → 63. Run 1 (not kept — its
directory was overwritten before the state difference was understood) measured 63 at
1440; runs 2 and 3 measured 60, identical key sets. Diffing run 2 against the audit's
63 (`s2-audit-1/out-run1/1440x1000-denver-type-tuples.json`): four tuples present in
the audit are absent here — the `·` and `◌ checking against the updated…` transient
lines and the confirmed-jurisdiction rows (`TCP 'must be prepared by a cer…'` 12/400,
`2024 Fee Sched.` 11.5/700 white — the breadcrumb's local override) — and one tuple
present here is absent there (`2 changes · 1 needs attention` 11/700 uppercase, the
strip's current wording). The audit walk **confirmed** the Denver suggestion before
generating; this harness does not, so the jurisdiction rows never mount. **No size was
folded** — the static census pins that: 103 → 103 declarations, 325 → 325 uses, both
asserted equal to the parsed sources in CI. The rendered figure is state-dependent and
is reported per state; 63 is reproducible with the audit's confirm step.

`span.sep "›" 1.37` (the breadcrumb separator glyph) shows in a `.jbar` pair scan as
under 4.5 — decorative punctuation, `aria-hidden`; not a finding of this arc (it was in
the audit's page too), recorded here so nobody re-finds it.

## Churn — actual vs predicted

| item | predicted | actual |
|---|---|---|
| `type-roles.test.ts` | passes via `expectedDeclarations`, no edit | no edit — passes |
| DESIGN-SPACING row | doc edit | edited + the "Type census (#263)" section |
| `test_replication_snapshot…crew_narrative_embedded_verbatim` | unchanged | unchanged, green |
| `test_pdf_containment.py` BASELINE | unchanged | unchanged, green |
| `tests/s630/test_cross_surface*.py` | unchanged | unchanged |
| quote row 3 | no test pins it | none did; the new surface test pins it |
| snapshots / fixtures | none move | none moved (verifier: empty diff-stat) |

**Declared (unpredicted) churn:**
1. `lib/design/tokens.test.ts` +1 describe (3 tests) — not in the plan's file list;
   test-only. Left there in commit 6 rather than moved, so the token slice's files
   are not rewritten.
2. `60px` at `.hero-cell .num` (≤480) was missing from the plan's size list —
   declared under the hero-numerals exception, not a new register.
3. Plan line corrections: the table literal is `type-roles.ts:73` (":98" was the field
   role); commit 4's comment shifted `globals.css` by +2 (swaps at :1637/:1662/:1805/
   :2428; hand-offs at :1457/:1904/:2683/:2720/:2875 on the tip, untouched).
4. **The census consequence for A/B/C (by design):** any add/remove/resize of a
   `font-size` or Tailwind size class fails `type-census.test.ts` by name — C's
   `.dl-card h4 → h3` and A's block rules update the matching row in
   `type-exceptions.ts` in the same commit. Likewise each owner's `#fff →
   var(--ink-bright)` swap **deletes its row** from `CSS_OWNER_SWAPS` in
   `ink-exceptions.ts` (a stale row fails).
5. Commit 6's four comments (TaperViz, PlanSheet, LocationPickerModal ×3 sites,
   GeneratorFormPrimitives) are comment-only; no behaviour.

## Contracts

#198 n/a · Rail n/a · Suggest-never-set honoured · Rule 3 honoured (formatting only;
wire unchanged — `schemas.py` / `render_api.py` untouched) · Rule 10 honoured (the
helper raises; no silent default) · Rule 12: every number traced — 5.61 / 4.47 / 6.25 /
7.04 computed in-test from the tokens and re-measured live; the stamp from the UTC
clock · Rule 13 measured, not asserted · Expectation-JSON n/a · Containment unchanged ·
Citation counter 19 untouched · Payload senders none · Band rules byte-identical
(`WorkingBand.tsx`, `.sugg-row/.sys-event/.sugg-name` unedited; the census file only
names those selectors as data) · write-lock / spec 31 / `getByText` n/a.

## Principles

| P | status | where |
|---|---|---|
| P1 | n/a | no layout change |
| P2 | honoured | one stamp producer, one format on five surfaces |
| P3, P7, P8, P10, P13–P16 | n/a | |
| P4 | n/a | |
| P5 | honoured-by-declaration / deviates-with-ruling | 63 → 63 ruled, zero folds; gate `type-census.test.ts`; rendered 60 on this harness's state (above) |
| P6 | n/a | |
| P9 | honoured, measured | `globals.css:1819-1825` `.honesty` 5.61:1 live at both viewports; confirm hover 6.25:1 in-test; axe color-contrast 0 pinned + settled at both |
| P11 | honoured | `--ink-bright`; four literals removed, none added; every remaining hex declared and gated (`ink-literals.test.ts`) |
| P12 | honoured | the XLSX date is a real date cell; one stamp everywhere |

## Ship order

`batch-d-hygiene` (8245b7f) first — backend-first: Modal + healthz == the merge sha,
then Vercel; hand-check dates across XLSX / crew / plan / quote and the caveat's ink.
Then `batch-d-hygiene-2` (stacked on 8245b7f; frontend + docs only). Prod census and
axe at the shipped sha are Ryan's run: `node type-census.mjs <out> <sha>
https://www.conestruct.com`.
