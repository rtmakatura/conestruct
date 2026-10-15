# Rule 5 prediction: issue-323-left-lane, near side (written before any code)

Base: `3ad7d503` (the checkpoint) on `main` `ab250c23`. Scope: the near side only (checkpoint §1). Far side (Q1) and mid-block (Q2) wait on Ryan.

## Behavior

- **Offered:** a near_intersection plan on a confirmed one-way street (the same three conditions `left_side_built` uses for shoulder: the one-way-street verdict, a one-way tag, a confirmed road) can take the left side. The side control offers it, as it does for shoulder.
- **Refused:** a left near_intersection plan whose marked cross street lies upstream of the work (far side) gets an honest 400 from the existing `CrossStreetStationError` path. Its message names the fix: pick the right-side curb, or mark the cross street the work ends at.
- **The left near-side plan:**
  - the same devices, stations and offsets as the right plan for the same inputs (the offset model);
  - signs `W4-2L` / `W20-5L` in place of `W4-2R` / `W20-5R`, with descriptions "LEFT LANE ENDS" and "LEFT LANE CLOSED AHEAD";
  - the arrow board points right;
  - page 1 mirrored (#300's `_PAGE_MIRRORED`), TA chip TA-21;
  - Note 8 signs on both curbs, as today (the mirrored set lands on the right curb);
  - audit: the advance rows read the L codes; the taper's `cdot_reference` reads "Case 18 … mirrored to the left lane of a one-way street"; a new pending item `left_lane_mirrored` cites §6N.12 ¶08, TA-21 Note 1, TA-33 Note 1 and §6H.07 ¶02 and says the mirror is CHOSEN;
  - crew sheet: "left lane", the arrow merging right, and the Note 8 line naming the right curb.
- **The shoulder's left plan is unchanged** (the `left_shoulder_mirrored` marker stays shoulder-only). `site_adjustments._ADVANCE_SIGN_LABELS` gains W20-5L / W4-2L / W21-5aL. That affects only plans that carry those codes, and no plan carries W21-5aL's label path today except left shoulder. Verify by test.
- **Refusal wording:** `SIDE_REFUSAL_MESSAGES` stops saying "shoulder work only". The `not_shoulder` cause becomes the flagger's (the only live kind left without a left side).

## Byte-identity

Every right-side plan of every kind, and every left-shoulder plan, is byte-identical: `work_side` defaults to `"right"`, and the codes, words and markers change only on `work_side == "left"` with near_intersection. No corpus snapshot or fixture moves. Evidence: the #208 parity harness (`validation-artifacts/committed/issue-208-mypy-ratchet/parity208.py`) before (`ab250c23`) and after, plus the left-shoulder fixture (`broadway-left.json`) through `/render/audit`, `/render/pdf` and `/render/markdown`, hashed both sides.

## Tests

- **Flips (predicted churn):**
  - `tests/test_left_side_oneway.py` near_intersection refusal case (`:137-169`) becomes "offered, and the plan builds";
  - frontend `lib/scenarios/left-side.test.ts:58-60, 80-86`, `components/bands/WhereBand.left-side.test.tsx:53` (near_intersection no longer refused).
- **New `tests/test_left_lane_near_intersection.py`:**
  - offered on a one-way street, not on two-way;
  - the near-side plan's codes, arrow and stations equal the right plan's except codes and arrow;
  - Note 8 both curbs;
  - audit codes, reference and pending item;
  - crew words;
  - far side → 400 with the message;
  - page 1 renders mirrored with zero containment overflow.
- **Suites:** green; mypy 0.
