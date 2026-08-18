# s2-arc2 — detection facts and gates (#173 + #176)

Sequence 2, Arc 2. Branch `issue-173-gates`, base `30b3a5c`, three code
commits: `858997c` (Refs #176), `e415267` (Refs #173 backend),
`cf77584` (Refs #173 frontend).

## Pre-fix (at the branch base, before any change)

- `pre-fix-gate-passthrough.txt` — the #173 gap proven payload-level:
  self-contradicting mainline lane relays (the exact
  `lanes_arithmetic_mismatch` shape the NI kind refuses) pass all three
  gates on shoulder AND flagger and generate full plans (22 / 33
  placements).
- `live-signal-capture.txt` — the geometric fact measured on prod
  (read-only detection POST): the E Colfax reference pin's primary
  candidate carries `signal_distance_m: 26.84` — the value that today
  dies at the frontend as a checkbox default.
- `pre-fix-176-refutation.txt` — the triage's residual-(b) claim
  ("the note predicate misses the moving-operation path") REFUTED by
  subject: `mobile_op_multilane` maps to `num_lanes=2 /
  closure_type="lane"`, the predicate fires, and the rendered narrative
  carries the note. The #176 residual is centralization + comment
  truth, not a predicate gap (the #175 lesson applied to our own
  triage).
- `source-scan-negative.txt` — the SIGNAL_GATE_NEARBY_M sourcing
  record: MUTCD Part 6 and S-630-1 scanned (case-insensitive, U+2011
  normalized); NO held source assigns a distance to the subject.
  S-630-1 Sheet 2 Note 21 quoted as qualitative authority only. The
  30.0 m CHOSEN disposition (GO ruling 1, 2026-08-17) is recorded in
  the file and on the backend constant.

## Post-fix

- `post-fix-captures.txt` — both kinds' refusal sentences verbatim from
  the mounted endpoint (each states the measured distance: 26.84 m →
  "about 88 ft", and its kind's recovery); each fact alone passes
  (mismatch-only → 200, signal-only → 200); the boundary inclusive
  (30.00 → 400, 30.01 → 200). Full-suite state: backend 1878 passed +
  2 pre-existing skips (base: 1850 + 2 — zero churn, +28 new); frontend
  670 vitest green (base 662, +8 new), tsc clean, lint carrying only
  the pre-existing `restoreFallbackRef` warning.

#176's byte-identical claim is carried by the committed test suites,
not a capture: `tests/test_closed_lane_lateral.py` pins the helper to
the old inline constants and the generators' emitted offsets, and the
device-count snapshot suites (`test_generators.py`) ran unchanged.
