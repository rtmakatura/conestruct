# s2-arc24 — #257 deliverables disagree with the screen

Branch `issue-257-one-voice` off `main d6bd79d` (the s2-audit-1 merge; healthz ==
d6bd79d at the start). GO rulings: Ryan's message of 2026-09-08 against the 📋
checkpoint — all five recommendations adopted, the folds included. Backend-first:
commits 1–2 shipped (healthz == `196c116`, Ryan's hand-check passed) before the
frontend commit.

## The defect

Two facts printed differently on the screen and in the files the crew is handed
(s2-audit-1 rank 1, rows F-S6-2 / F-S6-3). The device-list XLSX Summary said
"Jurisdiction | CDOT" on a Denver plan while the strip, the band and the crew header
said Denver. The plan sheet's CORRIDOR DETAILS said "Downstream 100 ft · Total
corridor 3,462 ft" while the sidebar, the audit PDF and the crew's step 3 said 50 and
3,412.

Why two producers existed:

- **Jurisdiction.** `ScenarioParams.jurisdiction` is the engine's buffer-table
  switch ("CDOT" | "federal", `spacing.py:210`), hard-set by the seven
  `schemas.py` literals. It is not an authority. The XLSX (`device_list.py:241`),
  the audit's buffer block (`audit.py:445` → `audit_blocks.py:155`) and the crew
  header's fallback (`crew_narrative.py:827`) printed it as one. The record name
  ("Denver") lived only in a kwarg thread to the crew narrative.
- **Downstream.** Two computations of one word: the layout builds the MUTCD §6B.08
  floor (`downstream_taper_length(1)`, 50 ft, two cones at 25 ft) and the audit's
  corridor block reads those cones; the plan sheet printed a `build_corridor` frame
  whose `downstream_taper_use_max` defaulted to the ceiling (chosen for the site-scan
  bbox), and the picker's `/render/corridor-spec` computed `numLanesClosed` × ceiling
  — a length no surface built and a parameter no client ever sent.
  1,500 + 217 + 645 + 1,000 = 3,362; + 50 = 3,412 (sidebar), + 100 = 3,462 (sheet).

## What shipped

| commit | what |
|---|---|
| `8408fec` | **one jurisdiction name** — `ScenarioParams.jurisdiction_name` (appended with a default), bridged from `jurisdiction_key` in `scenario_to_call`; the XLSX Summary and the crew header read it, None prints "Not set"; the audit's buffer line relabels to "Buffer table: CDOT supplement" (wire key unchanged); `_jurisdiction_display_name` and the narrative kwarg thread retire; a bad key is the same honest 400 from `_placements_for`. Proof T-04 (13 red on d6bd79d → 17 green). |
| `196c116` | **one downstream taper** — `placed_downstream_taper_ft(placements)` in `src/rules/corridor.py`; the audit's corridor_spec, the plan sheet (new `downstream_taper_ft` override on `build_corridor`) and the corridor-spec preview read it; the builder default flips to the floor; the scan passes the ceiling explicitly under a CHOSEN marker; `numLanesClosed` retires. Proof T-05 (8 red on 8408fec → 10 green). |
| — | **ship** — Ryan: `ship.ps1 -Branch issue-257-one-voice`; healthz `196c116`; hand-check passed. |
| `f36960d` | **the folds** — the bundle relays the centerline at the proxy like every single-file POST (red on the unpatched proxy: `expected undefined`); "Not set" on the setup strip and the fact strip; `road_type_display` / `ROAD_TYPE_DISPLAY` move to `validators.py` and the quote header prints "Road: Rural" not the enum; one work-zone format ("1,000 ft") on the plan sheet's callout and PARAMETERS box and the quote header (the XLSX Summary keeps its numeric cell, unit in the label). Proof T-06 (3 red → green). |
| this | **evidence** — README, live check, the two audit corrections, the follow-ups drafted. |

## Values on the Denver run (39.7269, −104.9873, 65 mph shoulder, divided, 1,000 ft)

| surface | prod d6bd79d (audit) | prod 196c116 (live, `outS2A24Prod/api-leg.txt`) | after f36960d (local) |
|---|---|---|---|
| XLSX Summary Jurisdiction | CDOT | **Denver** | Denver |
| crew MD / PDF header | Denver | Denver | Denver |
| plan p.2 Downstream / Total corridor | 100 ft / 3,462 ft (0.66 mi) | **50 ft / 3,412 ft (0.65 mi)** | same |
| picker legend Downstream (`/render/corridor-spec`) | 100 by code | **50** (B3, `b3-picker.png`) | 50 |
| sidebar corridor block | 50 / 3,412 | 50 / 3,412 (B2, `b2-pinned.png`) | same |
| crew step 3 station | −50 ft | −50 ft | same |
| audit PDF buffer line (step-down runs) | "Jurisdiction: CDOT" | "Buffer table: CDOT supplement" | same |
| quote header road | "Road: rural" | "Road: rural" | **"Road: Rural"** |
| plan p.1 callout / quote work zone | "WORK ZONE = 1000 ft" / "Work zone: 1000 ft" | same | **"1,000 ft"** both |
| zipped plan sheet p.2 Centerline row | absent | absent (`zip-before.txt`: direct True · zipped False) | present (proxy test) |
| fact strip, no key | "None — baseline" | "None — baseline" (B4a) | **"Not set"** |
| setup strip cell, no key | "None" | mounts post-generate, not observed | **"Not set"** |

Same scenario with no jurisdiction key on prod 196c116: XLSX Summary "Not set", crew
MD and PDF "Jurisdiction: Not set", corridor figures identical (api-leg.txt).

## Live check (`s2a24-lc-prod.js`, `outS2A24Prod/`)

Sha-gated on healthz == `196c116`. B1 gate PASS · B2 sidebar Downstream 50 ft ·
Total 3,412 ft PASS · B3 picker legend Downstream 50 ft PASS · B4a fact strip with
no key "None — baseline" (main today; f36960d is not deployed — expected) · B4b after
Confirm "Denver" PASS. The API leg (`api-leg.txt`) is the table above. The frontend
fold's prod measurement (strip words, the zipped Centerline row) is a post-merge
re-run: `zip_before.py` expecting "direct: True · zipped: True", and B4a expecting
"Not set".

## The CHOSEN markers (Rule 12)

`src/generation/layout.py` (the first downstream site; the five siblings make the
same choice):

> 7. Downstream taper. CHOSEN (#257): MUTCD §6B.08 gives 50–100 ft per lane closed
> and the designer picks within the range; the plan builds the 50 ft floor
> (`downstream_taper_length(1)` — one lane, lower bound), the shortest compliant run,
> kept short (2 cones) so the merging taper upstream is unambiguously the longest
> monotonic-offset run and `_extract_taper_indices` selects it rather than this one.
> This placed run is the ONE downstream length every surface prints
> (`placed_downstream_taper_ft`); the site scan's 100 ft ceiling is a search frame
> and is never displayed.

`src/api/site_scan.py` (the corridor build):

> CHOSEN (#257): this corridor is the scan's search FRAME, not a printed length — it
> takes the MUTCD §6B.08 ceiling (100 ft per lane closed) so the detection bbox
> reaches past the longest downstream taper a designer could choose. Every printed
> "Downstream" reads `placed_downstream_taper_ft` (the 50 ft floor the plan builds);
> this value is never displayed.

## Audit corrections (s2-audit-1/findings.md, in place, marked "Corrected in s2-arc24")

- **F-S6-2** said the plan sheet carries Denver. It prints no jurisdiction row at all
  (title block p. 1: PROJECT · LOCATION · COORDINATES · MHT TYPE · MUTCD · CDOT · DATE).
- **F-S6-3** attributed the sidebar's 50 ft to `/api/render/corridor-spec`. The
  sidebar reads the audit's `sections.corridor_spec`; that endpoint is the picker
  legend's, and it said 100 ft by code — the picker and the sidebar disagreed on
  screen too.

## Rule 5 churn (predicted → actual)

| surface | predicted | actual |
|---|---|---|
| backend files | ~10 | 10 (commits 1–2) + 4 (commit 4: validators, crew_narrative, quote_generator, plan_sheet) |
| tests flipped | crew null-key header · corridor-spec 100→50 · cross-street pins (count) | crew null-key header ("Not set") · corridor-spec 100→50 · `test_corridor` builder-default pins 100→50, totals 3,078.33→3,028.33 and 2,460→2,410 · `test_classification_frame` Lookout corridor passes the ceiling explicitly (it models the scan frame) · cross-street / frontend 100 ft pins **0** (six files, all self-supplied mock spec values) · `SetupStrip.jurisdiction.test` and `GeneratorSidebar.fact-strip.test` words |
| new tests | cross-surface invariants · helper · bundle relay | T-04 ×5, T-05 ×2, T-06 ×2 (+1 parametrized) in `tests/s630/test_cross_surface.py`; `render-proxy.bundle.test.ts` ×2 |
| audit snapshots · pin fixtures · request wire | 0 | 0 (the `buffer.jurisdiction` pins in 3 snapshots hold; corridor_spec already carried the placed run) |
| corridor-spec response | value 100→50, shape same; `numLanesClosed` removed | as predicted; no reader in `src/` or the site |
| payload senders | bundle gains the relay (server side) | the bundle's four Modal part fetches relay `meta.centerline` at the proxy; the browser wire is unchanged (the client's single-file senders never relayed either, and the bundle route caps the body at 32 KB — relaying a 121-vertex road in the browser would be the one sender shipping geometry over the public wire). Enumerated: `GeneratorShell.tsx:706` → `/api/render/bundle` → `fetchAllRenderParts` → `fetchPartFromModal` ×4 |
| containment | text changed, counts 0 | zero on all eight; p.2 text changed on the four pinned fixtures (commit 2), the p.1 callout text changed on every fixture (commit 4) |
| pytest | — | 2001 → 2065 → **2073 passed**, 2 skipped |
| vitest | — | 968 → **970 passed** (133 files); tsc clean; ESLint clean |
| frontend | strip words · bundle relay | as predicted (commit 4 only, after the ship) |

## Findings for follow-up (drafted in house style — Ryan posts)

**1. The edition string has two literals, and Denver's record pins a different edition**
Labels: bug, priority-medium, backend, pdf-rendering, p2, p11
> Plan p.1 prints "Reference: CDOT S-630-1, MUTCD 11th Ed. Part 6 (effective
> 2026-01-18), Colorado Supplement." (`plan_sheet.py:3158`); the crew header prints
> "Reference: CDOT S-630-1, MUTCD 11th Edition Part 6, Colorado Supplement (effective
> January 18, 2026)." (`base.md.j2:128`). One fact, two literals (P2, P11). Underneath
> it a Rule 9 question: `data/jurisdictions/denver.json` pins "MUTCD 2009 R2 (pinned
> by PT-116.1, April 2022)" while both deliverables cite the 11th for a Denver plan.
> One producer for the reference line; the edition it names for a jurisdiction that
> pins another is a ruling, not a refactor. Measured on the s2-audit-1 Denver run
> (`out-run1/downloads/1440x1000-denver-plan.pdf` p. 1, `…-crew.pdf` p. 2).

**2. The audit PDF's Colorado heading hard-codes S-630-1**
Labels: bug, priority-medium, backend, pdf-rendering, p2
> `audit_blocks.py:204` prints "Colorado Requirements (CDOT S-630-1)" for every kind;
> the screen picks S-630-1 / S-630-3 per scenario (`AuditTrail.tsx:230/411`) and the
> plan sheet resolves it (`_cdot_standard_reference`). Agrees on shoulder plans,
> disagrees on the divided lane-closure kinds: the audit PDF and the plan sheet of one
> plan cite different standard sheets. Read the summary's `cdot_sheet` (already on the
> audit JSON) — one producer.

**3. The picker preview's taper uses default lane and shoulder widths**
Labels: bug, priority-medium, frontend, backend, p2, p7
> `render-proxy.ts:291` posts kind, speed, roadType only; the backend fills
> `laneWidth=12`, `shoulderWidth=10` (`render_api.py:904-905`) while the plan uses the
> scenario's lane width and `10.0 if divided else 8.0` (`schemas.py:891`). The legend's
> taper equals the plan's only at 12 ft lanes on a divided road (the Denver run: 217).
> An 11 ft lane or an undivided road makes the preview a length the plan does not
> build — preview ≠ applied, #198's family. Send the scenario's widths (payload
> sender: the picker modal; the corridor-spec body cap is 4 KB).

**4. Four formats for the generated stamp**
Labels: priority-low, backend, p11
> XLSX Summary "Generated | 2026-09-08 16:07:35" (`device_list.py:242`, server clock,
> no zone), crew "Generated: 2026-09-08" (`crew_narrative.py:905`), plan DATE
> "2026-09-08" (`plan_sheet.py:2115`), quote row 3 (`quote_generator.py:592`). One
> formatter, one field; the time-of-day with its zone or not at all. (#212 covers the
> screen's ISSUED; this is the files'.)

Remaining voices recorded, not in this arc: the jurisdiction band's record sentence
and option still say "None — baseline" (`JurisdictionSection.tsx:234/376/670`;
`b4-confirmed.png`: "Confirmed Denver — was None — baseline.") — the strips and the
deliverables say "Not set". A ruling on whether the band's phrase is the same word.

## Contracts

- Rule 3 — one producer per printed value: `jurisdiction_name` on params,
  `placed_downstream_taper_ft`, `road_type_display`; the frontend prints
  (`GeneratorSidebar`, `SetupStrip` words only; no MUTCD math added).
- Rule 10 — "Not set", never "CDOT", when no key: tested at the export level
  (`test_xlsx_summary_prints_not_set_without_a_record`) and through the API on the
  five fixtures naming no record (T-04); live on prod 196c116 (api-leg.txt).
- Rule 11 — the bundle relay tested at the proxy layer; the export tests at the
  export layer.
- Rule 12 — two CHOSEN markers, both citing §6B.08, quoted above.
- Rule 9 — no edition string touched; follow-up 1.
- #198 — nothing picker→form; follow-up 3 names the picker's widths.
- Citation counter 19 — unchanged; the buffer relabel is a label, the §6B.08 cites
  pre-exist (`spacing.py:131`).
- Expectation-JSON pins 0 · audit snapshots 0 · PDF containment zero on all eight ·
  request wire 0 (the corridor-spec value changed, its shape did not; `numLanesClosed`
  was never sent).
- `getByText` direct text nodes — the "Not set" assertions (`getAllByText`, both
  strips).
- Verifier — commits 1–2: PASS on `main...HEAD` (19 claims verified, no forbidden
  action, 2065 passed); commits 4–5: see the stop-point 2 report.
- The untracked `validation-artifacts/check_cross_surface_agreement.py` is not
  committed: T-04/T-05/T-06 supersede it through the real API; it sits in the main
  checkout outside this worktree — Ryan deletes it.

## Principles

- **P2** (the arc) — one voice per fact across the screen and the files: jurisdiction,
  downstream taper, road name, work-zone length.
- **P16 / P14** — "Not set" is a state word, not a placeholder; the Summary row, the
  header line and both strip cells stay present with it (the row count never changes;
  the precedent is the plan sheet's "Not specified" bearing row).
- **P11** — the same word on the setup strip, the fact strip, the XLSX and the crew
  header; the same "1,000 ft" on every surface that prints the length.
- **P1 / P4 / P6 / P9** — n/a: no layout, edge, sizing or glyph changed.

## Files

- `s2a24-lc-prod.js` — the browser leg (B1–B4); `outS2A24Prod/log.txt`,
  `b2-pinned.png`, `b3-picker.png`, `b4-confirmed.png`.
- `outS2A24Prod/api-leg.txt` — the API leg on prod 196c116, with and without a key.
- `zip-before.txt` — the bundle centerline "before" on prod 196c116.
