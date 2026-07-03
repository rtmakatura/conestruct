# CDOT S-630-1 Cases

Reference for the CDOT S-630-1 case identities that the Conestruct plan
generator actually emits. This table mirrors the case labels assigned in
`src/api/audit.py` (the audit-trail case section) and the layouts in
`src/generation/layout.py`. It is the single source for what the tool
claims — NOT an index of every case in the standard-plan sheet set.

> **Verification status:** the case→sheet and case→condition mappings below
> mirror what the code emits. They are NOT yet verified against the S-630-1
> PDF — that manual check is tracked under #30 (case table) and #51 (W16-2a
> "NEXT XXX FT" on Case 11). Treat every sheet/condition citation as
> "claimed by code, pending PDF confirmation."

Source: CDOT M&S Standard Plan S-630-1 (19-page set, 2019; revised 01/14/26)
URL: https://www.codot.gov/safety/traffic-safety/assets/s-standard-plans/2019/s-630-1/S-630-01%20(19-Page%20Set).pdf

---

## S-630-1 shoulder cases (V1 enabled)

These are the cases the production V1 shoulder-closure path emits. Case
identity is assigned in `src/api/audit.py` (~922-998), branching on
`is_flagger` → `is_lane` → `is_supplement_case` → `is_reduced` → base.
This is the table #30/#51 verify against the PDF.

| Case label (verbatim) | Trigger | Generator effect | Code ref |
|---|---|---|---|
| `Case 11: Shoulder closure on divided highway` | Shoulder closure, no work-zone speed reduction | Federal Table 6B-2 buffer; `routing=shoulder_no_reduction` | `audit.py:992-998` |
| `Case 11 (reduced work-zone speed): Shoulder closure on divided highway` | Shoulder, WZ speed reduced but NOT a 65→60 / 75→65 step-down (e.g. 65→55) | Federal posted-speed buffer; Fines Double envelope (§2B.13 / Sheet 12); `routing=shoulder_reduced_speed` | `audit.py:977-991` |
| `Case 26 at 65 mph: Shoulder closure with reduced work-zone speed` | Shoulder, posted 65 → WZ 60 (mandated step-down) | CDOT Sheet 14 buffer floor; trigger "WHEN HAZARDS … ARE WITHIN 8 FT OF TRAVEL WAY"; Fines Double | `audit.py:954-961` |
| `Case 27 at 75 mph: Shoulder closure with reduced work-zone speed` | Shoulder, posted 75 → WZ 65 (mandated step-down) | CDOT Sheet 14 buffer floor; trigger "WHEN HAZARDS … ARE WITHIN 10 FT OF TRAVEL WAY"; Fines Double | `audit.py:962-969` |

The buffer step-down predicate (`is_supplement_case`) is gated identically to
the buffer citation and case routing so case identity, buffer source, and
taper citation cannot drift (`CDOT_BUFFER_STEPDOWN = {65:60, 75:65}` in
`tables.py`; `_cdot_buffer_or_none` in `spacing.py`). Cases 26/27 fire only on
the exact mandated step-down; any other reduction routes to the Case 11
reduced variant.

## Gated scenarios — outside V1 verification (built, not enabled)

These case labels are emitted only when their scenario kinds are enabled
(currently gated off via `ENABLED_SCENARIO_KINDS = ["shoulder"]`). They are
grouped here by enablement, not by standard plan — each row keeps its own
plan citation (the flagger label is S-630-1 Sheets 9/25; only Case 10 is
S-630-3). They are NOT part of the S-630-1 shoulder table above and sit
outside the #30/#51 PDF pass; the flagger's S-630-1 citations are separately
unverified under #71. Listed for completeness so the reference matches the
code's full vocabulary.

| Case label (verbatim) | Trigger | Standard plan (per code) | Code ref | Scenario kind |
|---|---|---|---|---|
| `Case 10: One Lane Closed - 4-Lane Divided Highway` | `closure_type=lane` and divided | **Conflict — see note** | `audit.py:942-948` | `lane_closure_divided` |
| `MUTCD TA-10: Flagger one-lane two-way` (not a CDOT case) | `closure_type=lane` and not divided | S-630-1 Sheets 9 & 25 (analogs 17/42) | `audit.py:932-941` | `flagger_lane_closure` |

> **Case 10 plan conflict (code, not this doc — flag for resolution):** the
> audit narrative labels Case 10 as "S-630-1 … Sheet 7" (`audit.py:944-948`),
> but the title-block standard-plan helper returns **S-630-3** for a divided
> lane closure (`plan_sheet.py:1767-1768`, marked UNVERIFIED), matching
> `schemas.py:8` (TA-19 / S-630-3). These disagree on the standard plan for
> the same scenario. Resolve when `lane_closure_divided` is enabled; left
> code-untouched here.

## Referenced analogs (not emitted as case IDs)

These appear in layout/narrative comments to justify dimensions on the gated
flagger path, but the tool never labels a plan with them:

| Case | Sheet | Used for | Code ref |
|---|---|---|---|
| Case 17 | Sheet 9 | Flagger curve lane closure — supplies the "200'–300'" opposing-flagger standoff | `layout.py:1127-1451`, `spacing.py:117-118` |
| Case 42 | Sheet 25 | Pilot-car operation — reuses the Case 17 standoff; pilot-vehicle mounting per Sheet 26 | `layout.py:1269-1435` |

## Scenario → standard-plan mapping

| Scenario kind | Standard plan (per code) | Emitted case(s) |
|---|---|---|
| `shoulder` (TA-3, TA-5 on freeways) | S-630-1 | Case 11 / 11-reduced / 26 / 27 |
| `flagger_lane_closure` (TA-10) | S-630-1 Sheets 9 & 25 | TA-10 (analogs 17/42) |
| `lane_closure_divided` (TA-19) | S-630-3 (see Case 10 conflict above) | Case 10 |

Source: `src/api/schemas.py:6-8`, `src/rendering/plan_sheet.py:1755-1768`.

## Pending PDF verification

| Item | Tracking | What to confirm against the PDF |
|---|---|---|
| Case 11 ↔ Sheet 7 layout & "NEXT XXX FT" W16-2a value | #51 | Sheet 7 Case 11 plaque semantics |
| Full emitted-case ↔ sheet/condition mapping | #30 | Sheets 7, 12, 14 vs the S-630-1 shoulder table above |
| Cases 26/27 trigger text (8 ft / 10 ft) | #30 | Sheet 14 diagram callouts |
