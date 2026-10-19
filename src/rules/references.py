"""The plan's reference line: the standards a deliverable is built against.

#265: one producer for the sentence page 1 and the crew instructions both
print.  They used to be two literals, and they disagreed on a fact: page 1
attached the effective date to MUTCD Part 6, the crew header to the Colorado
Supplement.  The date is the Supplement's ("Colorado Supplement to MUTCD
(effective 2026-01-18)", the source line every rules module carries), so this
is the crew header's sentence.

#348 (Ryan, 2026-10-18): every plan names the 11th, including a jurisdiction
that pins another edition (Denver's PT-116.1 pins MUTCD 2009 R2).  Colorado's
state manual is the 11th plus the Colorado Supplement, effective 2026-01-18,
and C.R.S. 42-4-105 has local devices conform to it.  A pin is a fact about
the jurisdiction, shown in its chain, never a second edition for the plan.
Sources: validation-artifacts/committed/issue-348-denver-edition/rulings.md.
"""

REFERENCE_LINE = (
    "Reference: CDOT S-630-1, MUTCD 11th Edition Part 6, "
    "Colorado Supplement (effective January 18, 2026)."
)
