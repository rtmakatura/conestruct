"""The plan's reference line: the standards a deliverable is built against.

#265: one producer for the sentence page 1 and the crew instructions both
print.  They used to be two literals, and they disagreed on a fact: page 1
attached the effective date to MUTCD Part 6, the crew header to the Colorado
Supplement.  The date is the Supplement's ("Colorado Supplement to MUTCD
(effective 2026-01-18)", the source line every rules module carries), so this
is the crew header's sentence.

Which MUTCD edition a jurisdiction that pins a different one should name
(Denver's record pins MUTCD 2009 R2) is a ruling #265 leaves open; this line
names the 11th for every plan, as both deliverables did.
"""

REFERENCE_LINE = (
    "Reference: CDOT S-630-1, MUTCD 11th Edition Part 6, "
    "Colorado Supplement (effective January 18, 2026)."
)
