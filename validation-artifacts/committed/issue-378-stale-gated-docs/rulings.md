# #378 rulings

Issue: https://github.com/rtmakatura/conestruct/issues/378 (#370 finding G8).

## R1 (R145 self-ruled, 2026-10-24): keep refusing the wire's `divided: true` on a near-intersection plan, and name the carriageway path in the refusal

- **Question:** should the near-intersection kind accept `divided: true` now that #312 builds divided plans, or keep refusing it?
- **Ruling:** keep refusing it. #312 R134 Q1 (a) builds a divided plan from the carriageway facts, and the wire's own `divided` stays False (`src/api/schemas.py`, the #312 comment above `roadType`). `src/rules/carriageway.py` is the one producer of the verdict (R83, `carriageway_verdict` rule 1: the operator's `confirmed` answer wins). Accepting the flag would give a second producer of the same fact.
- **Change:** only the words. The new text says the flag must be false and names what to send instead: the road's carriageway facts in `carriageway` (what /sandbox relays from detection), or `carriageway.confirmed` set to `"divided"` (the operator's answer, which wins).
- **Why R145 fits:** no new design direction, no number, no scope change. It applies the existing #312 and R83 rulings to an error string.
