# #377 rulings: one-way flagger refusal answers before the lane count

## Standing ruling this settles
#86 Amendment 1 (Ryan, 2026-07-27, issue #86 plan approval comment):
> **Amendment 1 — no gate reorder.** Keep `_ensure_lane_eligible` before `_ensure_direction_eligible` as it stands. [...] If the answer-first question deserves settling, it gets its own issue with its own reasoning.

#377 is that issue. Ryan confirmed #370 finding G7 and filed #377 with the action "Check one-way before the lane count on a flagger request, and refuse with a message that names it (TA-10 needs two-way traffic). Keep the lane-count message for two-way roads."

## R1 (R145 self-ruled): one-way answers before both lane-count branches
`_ensure_direction_eligible` (#158) now runs before `_ensure_lane_eligible` (#86 high, #136 single-lane) at the `_placements_for` chokepoint. Both lane remedies tell the operator to confirm one lane in each direction, which is wrong on a one-way road whether it has five lanes or one, so the one-way gate goes ahead of both, not only the #86 ceiling.

The reasoning #86 asked for: the one-way fact is what makes the flagger template wrong. The lane remedy can't fix it, because confirming one lane each way clears the lane relays and then the one-way refusal fires anyway. With one-way first, the operator gets the refusal whose remedy works ("Road carries two-way traffic"). If the road really is two-way, confirming that clears `oneway`, and the lane gate then answers with its own remedy, the same as today.

No message string changes. The existing #158 one-way 400 already names the reason (TA-10 alternates between two opposing directions).

## R2 (R145 self-ruled): the frontend pointer follows the backend order
`matchRefusalAffordance` (`conestruct/site/lib/scenarios/auto-apply.ts`) must replicate the backend gate order (#180), so its `flagger_oneway` row moves above `flagger_multilane` and `flagger_single_lane`. The FlaggerForm confirm rows are untouched. Both rows still show when both signals are present, and the banner pointer now names the two-way row.
