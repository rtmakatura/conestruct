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