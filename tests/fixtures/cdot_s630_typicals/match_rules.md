# Match rules for S-630-1 typical application validation

Phase 2 decisions, locked June 5 2026.

## Speed handling
- Case 11: substitute 55 mph as the representative test speed
- Cases 26, 27: use diagram-posted speeds (65 / 75)

## Diamond marker (♦)
- Sign emitted only when input specifies work-zone speed reduction
- No speed reduction in input → sign omitted from BOM and layout

## W20-1 vs W21-5 (Case 11 leftmost stack)
- Validation accepts either; assertion is `sign_code in {W20-1, W21-5}`
- Phase 4 documents which Conestruct picks for the test record

## VAR distances (Case 11)
- Validation asserts total advance-warning span is preserved
- Internal VAR splits not asserted; pass-through allowed

## Numeric tolerance
- Table lookups (advance warning, buffer, frequency notes): exact match
- Computed values (L, L/3, derived counts): ±10 ft absolute

## Device counts
- Diagram device counts: informational only, never asserted
- Conestruct's actual count: must comply with §6C.09 max spacing
  - Taper: count ≥ ceil(taper_length / S) + 1, where S = speed in mph
  - Tangent: count ≥ ceil(tangent_length / 2S) + 1

## Sign annotations
- Sunburst (flashing beacon): assert presence in BOM as billable device
- Star (Fines Double): not asserted (operational note)
- Triangle (optional): not asserted (contractor judgment)
- Diamond (speed-reduction-mandatory): handled per Decision 2 above

## Buffer space (CDOT vs MUTCD)
- Conestruct emits CDOT supplement value when jurisdiction = "CDOT"
- Audit trail flags the deviation: "CDOT supplement: N ft. MUTCD Table 6C-2: M ft. Plan uses CDOT supplement value."
- Validation harness asserts CDOT value when jurisdiction = "CDOT"

## Default for Phase 4 findings
- Pin by default
- Exceptions require explicit reason (genuinely variable, hard to encode, low-value)

## Fines Double envelope geometry (V1-Wide Item 3, June 6 2026)
- Conestruct emits **Case 11 generic** geometry uniformly across all speeds
  when the Fines Double envelope is triggered (work-zone posted speed
  below nominal posted speed)
- R2-10 placed at `wz_start + 500 ft`, R2-11 at `wz_end - 500 ft`,
  downstream R2-1 at `wz_end - 1000 ft`
- G20-5P/R2-6P assemblies distributed at 2,640 ft intervals between
  R2-10 and R2-11 (assembly count = `max(1, ceil(envelope_len / 2640))`)
- Sheet 12 explicitly permits engineer adjustment of these distances;
  Case 26 (65 mph: 530/530/260/260/530/530) and Case 27 (75 mph: same)
  fixture distances are diagram-illustrative refinements, not deployment
  specs
- **Validation harness should NOT assert against Case 26/27 specific
  distances** — emit/assert only against the Case 11 generic envelope
  formula. The fixture diagrams remain reference documents for the
  sign-code presence, plaque-pair structure, and 2640 ft frequency note
- Flagger-controlled alternating-flow (TA-10) scenarios are exempt from
  the envelope per Sheet 12 scope (freeway/expressway only); the audit
  trail surfaces a carve-out reason rather than silently omitting

## Phase 5 harness design (added 2026-06-06)

- Validation harness reads `_placements_for(scenario)` directly when asserting sign-code presence, station, or count. The audit dict's `advance.sign_table` only enumerates the three A/B/C upstream warning signs and is not a complete placement-list source.
- Audit dict is the authoritative source for derived values (taper L, buffer space, divergence wording, envelope geometry, CO §2B.13 reporting, operational-notes presence).
- Harness convention: one helper `_placements_and_audit(scenario)` returns both, and each per-case test function decides which surface to read per assertion.

## Phase 5 scenario classes — corridor validation (added 2026-06-06)

- The four S-630-1 test scenarios (`case_11_general`, `case_11b_reduction_5mph`, `case_26_65mph`, `case_27_75mph`) omit `meta.lat` / `meta.lng` intentionally. `audit.corridor_validation` short-circuits to `checked=false` for these scenarios; that's the expected state, not a finding.
- Corridor-validation behavior (OSM ground-truth check, bearing divergence detection) is a separate scenario class with its own fixtures and harness. Not in scope for S-630-1 typical-application validation.

## W16-2a plaque label (V1-Wide G1, June 7 2026)

- Sheet 7 Case 11 position 5 prescribes literal "1500 FT" plaque text. Conestruct emits `sign_a_station - wz_start_station` (1678 / 1787 / 1900 ft at 55 / 65 / 75 mph respectively per Table 6B-1 freeway A=1000 plus speed-dependent taper + buffer).
- Match: code-level (W16-2a family). Variance: literal plaque text vs geometric-distance text.