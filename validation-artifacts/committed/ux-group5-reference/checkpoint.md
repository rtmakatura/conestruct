# #443 UX group 5: checkpoint (investigation, before code)

Nothing here is on the park list, so the build runs under R145. Calls X1–X22 are in `rulings.md`.

## 1. Today's sections

| Section (today) | Container | Nesting |
|---|---|---|
| Checked & passed | `CheckedDisclosure` → `DisclosureRow` → `TieredReference bare` | row → `ItemAccordion`/`AuditItem` → body → `CheckRow` list (3) |
| Pending / not verified | `PendingDisclosure` → same | row → pending list or hours verdict (2) |
| Reference | `ReferenceDisclosure` → `TieredReference` tiers changed, attention, reference | row → `ReferenceChip` tier → `ReferenceChip` (hours, permit, hazard, devices) → `Section` / table (4) |

## 2. Where each row's text comes from

| Row | Field | Producer |
|---|---|---|
| Taper, Buffer, Spacing, Warning signs | `sections.{taper,buffer,spacing,advance}.result_text`, `formula_text`, `citation` | `src/api/audit.py` via `AuditTrail.tsx` item builders |
| Standard plan | `summary.case_id`, `summary.ta`, `sections.case.narrative`, `narrative_2`, `url` | `referenceItem` |
| Rule checks | `sections.colorado.checks[]`, `info_items[]` `{label, detail, citation}` | `deriveTierSources` |
| Met rules | `applied_deltas[]` with `raised === false`, through `lib/delta-words` | `deriveTierSources` |
| Scan passes, measured buckets | `sections.site_scan.buckets`, `corrections` | `TieredReference.tsx:256-321` (moves to the model) |
| Not checked yet | `pending_verification.items[]`, `hours_eval` | `pendingVerificationItem`, `HoursVerdictBlock` |
| Rules to keep in mind | `chips.personnel`, `chips.device`, conditional and unknown deltas | `jurisdiction` block |
| Fines and hazards | `chips.hazard[].meter` | `HazardChip` logic (worst-of is display, as today) |
| Permit | `permit.*`, `fees.*` | `PermitFYI` (lead range is display, as today) |
| Device schedule | `breakdown.devices[]`, `unique_types`, `total_devices` | `DeviceBreakdown` |
| Zone geometry | `breakdown.zone_geometry` | `ZoneGeometryGroup` |

Row count and ledger: every checked row is one `assignTiers` fact (`lib/tiering.ts:222-353`), and pending likewise, so the rows of those two sections equal `ledger.checked` and `ledger.pending`. A test pins it on the fixtures.

## 3. Design

- `lib/reference-sections.ts(x)`: `buildReferenceSections(sources, …)` → `RefSection[]` of `RefRow { id, glyph, title, result, resultMono, detail: { sentences, pairs, list, source, extra, actions } }`. Plain strings except `extra` and `actions`, which search doesn't read.
- `ItemSpec.body: ReactNode` → `ItemSpec.detail: RowDetail`. One renderer, `RowDetailView`.
- `lib/reference-search.ts`: pure. `searchSections(sections, query)` returns hits per row with field-level flags.
- `lib/reference-nicknames.ts`: the one table.
- `components/ReferenceSections.tsx`: search box, sections, rows. Replaces `CheckedDisclosure`, `PendingDisclosure`, `ReferenceDisclosure` + `TieredReference` at `GeneratorShell.tsx:2397-2429`.
- `id="reference"` stays on section 3 (`lib/next-steps` chip jump and #193 focus).

## 4. Rule 5 churn prediction

**Byte-identical:** every backend file, the audit wire, the PDF and XLSX, `assignTiers`, the ledger, `tier_ledger.py`, NEEDS YOU's items and copy, "Your plan", downloads, WHERE and WHAT.

**Changes on purpose (user-visible, /sandbox results only):**
- The three sections' names, order unchanged; one row style; flat details.
- Search box and its states.
- All fee lines draw (X16).
- Sidewalks and other site adjustments group under ALONG THE ROAD (X13).
- ~~"See the pending-verification disclosure." reworded (X22).~~ Withdrawn: it's backend wire text.

**Code that retires:** `ResultsDisclosures.tsx`, `ReferenceDisclosure.tsx`, `TieredReference.tsx`, `ReferenceChip` usage in these sections, `HazardChip`, `PermitFYI`, `WorkHoursCard`'s chip shell (its bars are extracted), `DeviceBreakdown`'s chip shell and `ItemAccordion`/`AuditItem`, with their now-dead CSS.

**Tests that change:**
- Rewritten against the new rows: `TieredReference.*` (7), `tiered-test-utils`, `GeneratorShell.disclosures`, `GeneratorShell.disclosure-container`, `DeviceBreakdown`, `DeviceBreakdown.phone`, `rule-168`, `rule-169`, `severity-ramp`.
- `spec.body` → `RowDetailView` render, mechanical: `AuditTrail.test`, `.approaches`, `.corridor`, `.ni-parity`, `.declined-stale`.
- Name lookups only ("Checked & passed", "Reference"): shell suites that open a section (grep at build time; each listed in the report).
- New: `reference-search.test`, `reference-nicknames.test`, `ReferenceSections.test` (mounted flow, Rule 11).

**Predicted miss to watch:** honesty suites from #180, #182, #184, #187, #196 and #152 D reach Retry through the third section. If any fails, the fix is in the section's open logic, not the test.

### Amended before the second commit (Rule 5)

- **Dead CSS doesn't retire on this branch.** `refchip`, `chip-sum`, `audit-item`, `audit-head`, `check-list`, `sign-table` and `device-table` have no component left, but they share selectors with live rules and the census and `check-list-grid` / `rule-169` read them. A follow-up issue removes them. The prediction's "with their now-dead CSS" is withdrawn.
- **Also retired, not predicted by name:** `ReferenceChip`, `ZoneGeometryGroup`, `DeltaRowView`, `HoursVerdictBlock`, `ConflictFootnote`, `ProvisionalBadge`, `FactRows`, `DeviceBreakdown` the component (its types stay).
- **Tests retired with them:** `DeviceBreakdown.test`, `DeviceBreakdown.phone.test`; their claims that still hold moved to `ReferenceSections.test`. `JurisdictionSection.test`, `.density`, `.notset`, `.boundaries`, `.schedule-overnight`, `.per-direction-388`, `GeneratorShell.needs-you`, `.scan-refusal`, `.hit-targets`, `check-list-grid`, `lib/design/type-census` change too; the checkpoint named only some. Census pins: CSS 186 -> 198, tsx sites 57 -> 47, uses 199 -> 134, files 25 -> 22; the scanner's floor 50 -> 40.
- **Behaviour added by the parity pass:** X25 and X27.

### Amended after the walk (Rule 5)

The first walk (2026-11-05) found X28-X34. Changes: `globals.css` (`.rs.is-dim`, `.rr-pair`, `.rr-code`, the first row's rule, the placeholder's ellipsis), `ReferenceSections.tsx` (`Hl`'s code span, the `sr-only` status), one sentence in `lib/reference-sections.tsx` and the two `JurisdictionSection` tests that pin it, new tests in `ReferenceSections.test.tsx`, the walk and its evidence. Backend, wire, section counts and search matching stay byte-identical. No new font size or hex, so the census and ink-literals pins don't move.

## 5. P1–P22 on the changed surfaces

- **P1/P15:** clearing restores state; search overlays, never writes (X20).
- **P2:** one row per fact and one renderer; the rows and search read one model.
- **P5:** two levels at most.
- **P19:** closed by default, and "Show N more" holds the long tail.
- **P14:** search is on the page, with no pinned chrome.
- **Rule 13:** glyph plus words on every row; the mark has an underline as a second channel beyond its background.
- The rest don't touch these surfaces.

## 6. Evidence plan

`validation-artifacts/committed/ux-group5-reference/evidence/`: local walk with Overpass stubbed at 1440 and 390, covering the prompt's states, axe, and a 44 px measurement; crops for Ryan's hand check.
