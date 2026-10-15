# Rule 5 prediction: TA-23's far side (the left-turn bay), wired

Base: `main` `de6a0f5` + this branch's field commits (`d888df8`, `90fb84f`, `40a0308`, `361c78f`). Written before any backend code. Sources: `checkpoint.md` (TA-23 notes p. 904 and figure p. 905, read at 3x). Rulings: `rulings.md` (R152 Q1, R153, Ryan's review, and the self-ruled S1 to S8).

## What changes

**The wire.** `NearIntersectionScenario.turnBayStorageFt: float | None`, with `gt=0` and `le=WORK_LEN_MAX_FT` (S8). It defaults to None and is passed through to `ScenarioParams.turn_bay_storage_ft`.

**The refusal.** A left plan whose cross street comes before the work, with no storage entered, gets a 400.
- **Code:** `detail.error` is `turn_bay_storage_missing`. It was `generator_rejected`.
- **Message:** it names the field: "Enter the left-turn bay storage length under Cross street: …".
- **Removed:** `LEFT_LANE_FAR_SIDE_MESSAGE` is deleted, since nothing reaches it any more.
- **Frontend:** `matchRefusalCode` maps the new code to a pointer at the Cross street step. The rail routes the refusal there.

**The layout (`near_intersection_stations` / `generate_near_intersection`), for a left far-side plan only:**
- **Taper end:** `max(wz + buffer, upstream curb + storage + 100)` (S2). The taper start, A/B/C, W4-2L, W20-5L, W20-1 and R2-10 follow from it, by the same code.
- **The bay:** lane-line channelizers (cones) from `upstream curb + storage` down to the upstream curb, at the tangent spacing (S1). Nothing stands in the opening between the taper end and the bay.
- **What it replaces:** the continuous taper-to-curb channelizers the right far side takes from Fig. 6P-22 Note 7.
- **R3-7L, twice (S4):** on the island at the taper end, at the closed lane's center offset, and on the far curb.
- **Arrow board (S5):** `RIGHT_ARROW` at the work space's upstream end (station = work zone length), not at the taper start.
- **No centerline channelizers (S3).**
- **Unchanged:** past the intersection, the lane-line cones from the far curb to the work zone stay (S6), and so does the downstream end (S7).

**The surfaces:**
- **Sign code:** `R3-7L` "LEFT LANE MUST TURN LEFT" in `sign_codes.py`.
- **TA:** TA-23 on the plan sheet's MUTCD row and in the audit projection (it was TA-22 for every far side).
- **Plan sheet NOTES:** a left far-side plan adds one line: "LEFT-TURN BAY STORAGE N FT, ENTERED BY OPERATOR (MUTCD TA-23 NOTE 5); NOT CHECKED BY THIS TOOL."
- **Audit:**
  - a `turn_bay` block on the approaches section: the storage, `provenance: "entered by operator"`, the opening length, and the stations of the bay and the R3-7L pair;
  - the case reference names TA-23;
  - a `left_turn_bay` pending-verification item citing TA-23 Notes 4/5 (p. 904), the figure (p. 905) and S1 to S7;
  - it replaces `left_lane_mirrored` on a far-side plan, because TA-23 draws the left lane itself, so nothing is mirrored.
- **Crew sheet:** one line naming the bay and its entered length, and the R3-7L pair.
- **Device list and quote:** follow the placements (R3-7L x2 on a one-way street, the bay's cones). No code change.

## What must not change (byte-identical)

`parity323f.py` runs the #323 harness's bodies over 9 routes, plus:
- **(a)** the left far-side plan with no storage;
- **(b)** the same plan with 300 ft entered;
- **(c)** a right far-side plan carrying `turnBayStorageFt` (ignored);
- **(d)** a left near-side plan carrying it (ignored).

Predicted:
- **Unchanged:** every corpus case, the Broadway shoulders, the right near and far plans, and **(c)** and **(d)**. Byte-identical, with (c) and (d) also equal to the same plans without the field.
- **Changes in (a):** still a 400 on every route, but the code and message change (above).
- **Changes in (b):** a 400 before (the field was ignored, so it was refused); 200 after, on every route.

## Tests

- A new `tests/test_left_turn_bay_ta23.py`, payload-level (Rule 11):
  - the refusal names the field;
  - the station arithmetic (the bay's cones span exactly the entered storage; taper end = curb + storage + 100 when the buffer doesn't reach further);
  - the R3-7L pair;
  - the arrow at the work zone;
  - no channelizers in the opening;
  - TA-23 in the title block and the audit;
  - "entered by operator" in the audit and the plan sheet's text;
  - containment 0/0/0 on page 1.
- The existing test that pins the far side's refusal (`tests/test_left_lane_near_intersection.py`) flips to the storage refusal.
- Vitest: the code-to-pointer mapping and the rail routing.

## Not in this arc

#327, the frontend's left-side mirror that covers refusals on a left plan with the generic pointer. It follows on a branch stacked on this one, so that the browser shows this arc's refusal. Both ship together.
