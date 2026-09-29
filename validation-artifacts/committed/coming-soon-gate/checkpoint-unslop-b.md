# 📋 Checkpoint: R37, Part B (unslop the platform copy)

2026-09-29. Branch `copy/unslop-platform`, stacked on `copy/unslop-public` (eece922). Nothing built yet. The row list is `unslop-platform-inventory.md` (224 rows), corrected by §4 below.

## 1. What gets built, in order

**Commit 1: backend strings and the two splits, together.**
- Separator rule (R37): `": "` between a label and its value, `" · "` between two names. No em dash in user-facing copy.
- `src/api/audit.py:1709` `_site_citation`: `rule.split(" — ")[0]` becomes `rule.split(": ", 1)[0]`. Its 7 inputs (`src/rules/site_adjustments.py:69, 103, 136, 151, 182, 203, 234`) change in the same commit. No left or right part contains a colon today. `split(…, 1)` stays right if a right part ever gains one; `rsplit` would be wrong.
- `src/rules/validators.py:392` `scenario_display_name_short`: splits on whichever separator Q1 picks. Its 7 titles (`validators.py:350-364`) change in the same commit.
- **New test, split parity:** for all 7 site rules and all 7 titles, the new split yields exactly the parts the old split yielded. The old strings are frozen in the test as the baseline. The existing guard `tests/test_audit_endpoint.py:2590-2616` (citation byte-equals the panel chip) stays and must pass unchanged.
- The rest of the backend rows: `site_scan.py`, `audit.py`, `audit_blocks.py`, `boundaries.py`, `jurisdiction.py`, `render_api.py`, `schemas.py`, `layout.py`, `plan_sheet.py`, `crew_narrative.py`, `devices.py`, `device_list.py`, `quote_generator.py`, plus `src/narrative/templates/base.md.j2` if Q4 says yes.
- 10 active snapshots rebaselined with `tests._snapshot_helper.write_snapshot` (the repo has no regen command): `tests/snapshots/corpus/grid_site_{adjacent_interchange, adjacent_intersection, bicycle_facility, driveways_present, limited_sight_distance, pedestrian_facility, school_zone}.json`, `corpus/grid_undivided.json`, `audit_shoulder_urban25_quadratic.json`, `audit_flagger_reduction_fines_double_required.json`. The 8 archived `_pre_*` snapshots stay as they are (no test reads them).
- About 20 string pins across 12 Python test files are updated.

**Commit 2: frontend copy, pins and mocks.**
- The app UI, audit panel and validation rows.
- `C/AuditTrail.tsx:84, 93` stay byte-identical to `site_adjustments.py:94, 128`. A new test asserts the pair, since today nothing checks it.
- **The negative tests (R37), 10 not 3.** Each is rewritten to assert the new string is present:
  - The three named: `C/GeneratorShell.refusal-voice.test.tsx:177-181, 208-212` and `C/LocationPickerModal.state-contract.test.tsx:270-273`.
  - Also em-dash strings, which the inventory missed: `C/JurisdictionSection.density.test.tsx:78, 99, 107, 114` and `C/GeneratorForms.confirm-undo.test.tsx:197`.
  - Python, which the contraction rewrite at `render_api.py:200` would leave vacuous: `tests/corpus/test_near_intersection.py:247` and `tests/test_lane_confidence_block.py:218`.
- **Positive pins the inventory missed** (these fail loudly, not silently): `C/JurisdictionSection.test.tsx:88`, `density.test.tsx:103, 121`, `notset.test.tsx:50`, `handoff-provenance.test.tsx:340`, `C/GeneratorShell.rail-vocabulary.test.tsx:91` (`startsWith("Location — ")` on the aria label from `L/scenarios/rail.ts:382`), and `tests/test_crew_narrative_pdf.py:102`.
- **Mock copies of backend strings** are updated in the same commit, so they stay equal to what the backend sends:
  - `NOT_CHECKED_DISCLOSURE`: 6 files.
  - `_VERIFY`: 2 files.
  - "Operator asserted": 3 files.
  - "is moot": 2 files.
  - `SITE_SCAN_UNAVAILABLE_MESSAGE`: 7 files.
  - `render_api.py:350`: 3 files.
  - Half-road: 2 files.
  - `jurisdiction.py:291`: 1 file.

**Commit 3: evidence.**
- Before and after `plan.pdf`, `crew.pdf` and `crew.md` in `unslop-b/{before,after}/`, from `render_pair.py`. It runs offline with the network blocked, on `tests/fixtures/pdf_worst_case/control-typical.json`.
- The before files are already committed with this checkpoint. Their text has 11 em dashes in the plan sheet and 7 in the crew sheet. After should be 0, apart from any "—" placeholders Q3 keeps.
- A sweep of the rendered after PDFs catches strings no source grep found, such as the crew sheet's "(MUTCD §6G.10 — the plain R9-9 legend …)".

**Not touched:**
- `data/jurisdictions/*.json` stays verbatim (R37). Its text shows through the panel and the PDF with dashes intact.
- The S-630-1 Case 18 plate title stays verbatim, inside quotes (`audit.py:1144`).
- The MUTCD §6N.12 and §6N.16 section titles stay verbatim. Only our separator changes: "MUTCD §6N.12 p. 848: Work within the Traveled Way at an Intersection (11th Ed.)".
- **R36 hold:** the reviewer wording on the footer and Terms isn't touched. The same PE claim shows in the app's draft notice (`GeneratorShell.tsx:2408`) and on the PDF ("DRAFT FOR PE REVIEW", `plan_sheet.py:3308, 3817`). Those rows get punctuation only, with no rewording of who reviews, until the lawyer's wording comes back.

**Rule held on every row:** no new claim. Some inventory rewrites add words: "Not deployed." at `AuditTrail.tsx:400`, and "Not a sealed engineering document." at `plan_sheet.py:3817`. Each is checked against the full current string. Anything the string doesn't already say is dropped.

## 2. Rule 5: churn, predicted

| What moves | How much | Why |
|---|---|---|
| Plan sheet PDF text | 11 → 0 em dashes | separators and sentences |
| Crew sheet PDF text | 7 → 0 | same (Q4 decides the template's 21) |
| Snapshots | 10 files | backend strings in the audit payload |
| Frontend tests | about 72 files, about 186 lines | pins and mocks |
| Python tests | 12 files, about 20 lines | pins |
| `citation` field on `/render/audit` | **no change** | split parity; the existing byte-equal guard proves it |
| PDF short name (PARAMETERS "Closure") | **no change** | split parity |
| Device counts, geometry, verdicts, wire fields | **no change** | copy only |

## 3. Ship
- The ship is **`frontend-only: no`**, because backend strings change, so `ship.ps1` runs `modal deploy`. The prod hand-check stays in.
- The order is fixed: Part A (`copy/unslop-public`) ships first, then this branch, rebased onto main right before its ship.
- Nothing breaks while the two sides differ, because the frontend matches refusals by code, never by text (`L/scenarios/auto-apply.ts:126`).

## 4. Inventory corrections (R34: middle dot only between two names)

| Row (inventory) | Was proposed | Now |
|---|---|---|
| `JurisdictionSection.tsx:1387` | "Courtesy reference, FYI · fees are never quote line items" | "FYI: courtesy reference. Fees are never quote line items." |
| `JurisdictionSection.tsx:1613` | "· worst: {rate}" | "{n} hazards, worst: {rate}" |
| `NeedsYouConditions.tsx:241, 243` | "dismiss · other: {note}" | "dismiss: other ({note})" / "dismiss: {reason}" |
| `StatusBar.tsx:371` | "VERIFICATION PAUSED · too many updates…" | "VERIFICATION PAUSED: too many updates in the last minute. Generate in a moment to check again" |
| `PricingCard.tsx:34` | "FYI · contractor estimate, not a permit fee" | see Q6 |
| "Not set (MUTCD + CDOT only)" | parentheses | "Not set: MUTCD + CDOT only" |
| "operator correction (moot)" | parentheses | "operator correction: moot" |
| `audit_blocks.py:103-104` | "Device spacing (taper)" | "Device spacing: taper" |
| `device_list.py:95` | "Jurisdiction-required ({doc})." | "Jurisdiction-required: {doc}." |
| `NearIntersectionForm.tsx:378` | "Cross-street lanes, direction A" | "Cross-street lanes: direction A" |
| `LocationPickerModal.tsx:2121` | "{cross}, marked at your last save." | "{cross}: marked at your last save." |
| `audit_blocks.py:387` | "DETECTED, dismissed by operator ({reason})" | "DETECTED: dismissed by operator ({reason})" |
| `plan_sheet.py:2132` | "DRAFT, NOT FOR STAMPING" | "DRAFT: NOT FOR STAMPING" |

## 5. Questions (a recommendation for each)

**Q1. Scenario titles: ": " or " · "?** The 7 titles are the value of a label on every surface: "MHT TYPE", "Closure type", and the XLSX "Closure" cell. With ": " the sheet reads "MHT TYPE: SHOULDER CLOSURE: 4-LANE UNDIVIDED".
- **Recommend " · "**: "Shoulder Closure · 4-Lane Undivided". Kind and road are two names side by side, which is the " · " case in R37, and it avoids the double colon. `validators.py:392` splits on " · ".

**Q2. Road-type labels (about 14 files): "Rural — undivided".**
- **Recommend a plain comma, "Rural, undivided".** It's one phrase, not a label with a value, and not two names.
- Alternative: " · ".

**Q3. A lone "—" standing for a missing value** (legend CODE column, COORDINATES, the TA reference cell, the XLSX pay item; pinned in 6 test files).
- **Recommend keeping them.** They're the blank glyph Rule 10 asks for ("absence renders as absence"), not prose, and R37's "copy" reads as sentences and separators.
- Alternative: "n/a", which would need a ruling on each surface.

**Q4. The crew-sheet template `src/narrative/templates/base.md.j2`** has 21 em dashes on 16 rendered lines, which the inventory missed. They include the heading "Method of Handling Traffic — Crew Instructions" (pinned at `test_crew_narrative_pdf.py:102`) and the `**{{ adj.flag }}** — {{ adj.action }}` lines.
- **Recommend in scope**, because R37 names the crew sheet.
- Heading: "Method of Handling Traffic: Crew Instructions".
- Flag lines: "**{flag}**: {action}".

**Q5. Recorded fixtures** (`tests/fixtures/tiering/*.json` ×6, `C/__fixtures__/audit-shoulder-full.json`). They go stale but never fail.
- **Recommend updating only the backend-owned strings in them, in the same commit.** They're test inputs meant to match the wire. Jurisdiction text inside them stays verbatim.

**Q6. `PricingCard.tsx:34`, "FYI · contractor estimate — not a permit fee".** The code comment calls it "§8.11's framing, kept verbatim" (an internal spec, not MUTCD or CDOT).
- **Recommend "FYI: contractor estimate, not a permit fee".** It keeps §8.11's meaning and changes only the separators.

## 6. Checks before the report
- `uv run pytest` (2355 tests) and `npm test` (182 files).
- The PDF pair before and after, with em-dash counts.
- One headless run on the preview: `/sandbox` generates a plan, and the audit panel's site-adjustment chips read "MUTCD § 6N.12 p. 848", as today.
- The diff-verifier on `copy/unslop-public...HEAD`.
