# #83 byte-compare — single-source migration is behavior-preserving

Method: `dump_audit_matrix.py` posts six scenarios to `/render/audit`
(TestClient, in-process) covering every Colorado-section branch —
shoulder divided no-reduction, shoulder divided 65→60 (Case 26
step-down + Fines Double shape A), shoulder undivided 55→45
(non-step-down prose), flagger day, flagger night 45→35 (lighting fail
+ Fines Double shape B), near_intersection (NI case_narrative) — and
dumps the full JSON (`indent=2, sort_keys=True`).

- `audit_matrix_before_83.json` — captured at `62fd955` (pre-migration),
  35 rendered "CO Supplement" strings across the matrix.
- `audit_matrix_after_83.json` — captured after the `CO_CITATIONS`
  migration (tables.py single source, audit.py derives).

Result: `cmp` reports the two dumps **byte-identical** (2026-08-04).
Zero audit churn — the #83 acceptance proof.

Standing pin: `tests/test_citation_single_source.py` — (1) no
`CO_CITATIONS` value may reappear as a string literal in `audit.py`
(AST scan), (2) the rendered Colorado checks/info/fines-double
citations equal the `CO_CITATIONS` fields. Both value-agnostic so
#70's recite passes through them unchanged.
