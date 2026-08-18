# s2-arc2 byte-compare — served output vs local at `c76dc9c` (2026-08-18)

Claim under test: #176 changed no rendered output. Method: POST the
identical NI payload (the DEFAULT_NEAR_INTERSECTION shape) to the
production proxy AND to a local TestClient at the same commit; compare
bytes. (The base-vs-HEAD half of the byte-identical claim is carried by
the committed equality tests + unchanged snapshot suites; this compare
proves the SERVED surface matches the code those tests pin.)

- `/render/audit` JSON: **byte-identical**, 7037 == 7037 bytes.
- `/render/markdown` narrative: equal after exactly two environmental
  normalizations, both named:
  1. line endings — the local Windows run emits CRLF on 101 lines, the
     served response LF (7166 vs 7065 bytes; the whole delta);
  2. the `**Generated:** <date>` stamp — server UTC date (2026-08-18)
     vs local date (2026-08-17).
  With CRLF→LF and the Generated line masked: **equal**.
- The served narrative carries the #176 note verbatim ("Closed lane:
  this plan draws the closure on the RIGHTMOST lane. That is a modeling
  assumption, not an MUTCD rule — …"), now driven by the single-sourced
  predicate (also asserted as N1 in the runner; served copy saved as
  `ni-narrative-served.md`).
