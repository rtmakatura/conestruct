# Arc 11 phase 9 — near_intersection integration verification at HEAD (Refs #117)

Reading (i), per the master-plan GO: "the per-approach build" is the
whole built-and-gated NI feature; phase 9 is its final integration
verification at HEAD — no new §6N.12.02 scope (the genuinely new
decomposition work is #128, parked by its own terms).  Verified
2026-08-03 at branch `issue-117-enablement` (`8f571d4`), on top of the
phase 1–8 changes.

## Spike-anchor re-check — the hand-checked Case 18 stations hold

`tests/test_near_intersection_generator.py::TestCase18Anchor` (4 tests,
green) pins the design spike's worked example exactly, at HEAD:

- Mainline advance train (Sheet 10 key, URBAN >= 45 → A/B/C = 350):
  W4-2R at 1,550 · W20-5R at 1,900 · W20-1 at 2,250 · R2-10 at 2,075
  (½C inside the outermost sign, Case 18).
- Merging taper: L = 540 at 45 mph × 12 ft, 13 drums at 45-ft spacing,
  stations 660 → 1,200, lateral run 24 → 12 ft.
- Cross-street set (URBAN <= 40 → A = 100): R2-10 at 100, W20-1 at 200,
  R2-11 at 100 departure-side — signs on the correct sides.
- Near-side corner termination (Fig. 6P-21 / Case 18) when the
  reopening does not fit the curb gap.

The corpus tier (`tests/corpus/test_near_intersection.py`, in the 599
passing corpus tests) re-asserts the anchor on the internal call path
and locks the four multi-factor grid snapshots byte-stable:
`ni-grid-near-35x45-2ap` · `ni-grid-near-midblock-rural` ·
`ni-grid-far-buffer-anchor` · `ni-grid-far-curb-anchor`.

## The full NI test surface at HEAD — all green

Backend (151 tests, one run):

| File | Tests run | Covers |
|---|---|---|
| test_near_intersection_generator.py | 23 | anchor, stations, per-approach validate_layout partition (increment-2 seam) |
| tests/corpus/test_near_intersection.py | 10 | anchor + grid snapshots + boundary (422/gated-400) |
| test_near_intersection_voice.py | 20 | narrative/audit voice, three disclosed departures, signals flag-and-cite |
| test_intersection_schema.py | 32 | schema bounds, same-along rule, approach ids |
| tests/s630/test_cross_surface_near_intersection.py | 5 | cross-surface agreement |
| test_near_intersection_endpoints.py | 19 | every render endpoint serves NI (phase 2), honest 400s (phase 3), #26 default check (phase 6), #176 note (phase 7) |
| test_lane_confidence_block.py | 21 | #120 predicate + NI-only hard gate + caution |
| test_layout_validation_gate.py | 9 | production validate_layout incl. NI approach_params threading |
| test_ped_bike_emergency_narrative.py | 12 | phase-4 sections incl. NI open-lane fact |

(23+10+20+32+5+19+21+9+12 = 151 — one combined run, all green.)

Frontend (83 tests, one run): GeneratorShell.near-intersection (picker →
form → payload incl. the #174 no-tag hold), GeneratorForms.confirm-undo
(#179 confirmed-note/undo — the second dark item, verified by mounted
tests; the smoke verifies it live post-flip), GeneratorForms.
lane-confidence (#120 recovery), GeneratorForms.override-provenance
(#177 markers), AuditTrail.approaches (panel builder),
validation.near-intersection (the 422 + ValueError mirror), and
auto-apply (the #180 matcher incl. the phase-7 ni_lane_confidence entry).

Full suites at this HEAD (diff-verifier-run, phase-4 re-verification):
backend 1,830 passed / 2 skipped; frontend 613 passed; tsc clean.

## Integration deltas closed by this arc (phases 1–8), restated

The build was complete since 2026-07-11; what integration verification
plus the phase work actually closed: the never-wired approaches
threading (five endpoints + snapshot would have 500'd on NI), the three
geometry ValueErrors escaping as 500s, validate_layout absent from the
production path (and its taper tie-break misread at 20–35 mph), the
#120 400's phantom "Approaches" section, the missing #180 matcher
entry, and the #174 substituted-count silent hold.  Each is fixed and
regression-pinned in the files above.

## Conclusion

No stub, TODO, or unwired seam remains on the NI path at HEAD.  The
remaining pre-flip items are phase 10 (Case 18/19 typicals-match
fixture + harness — the amended Rule-8 bar) and the flip + smoke behind
the flip-GO.
