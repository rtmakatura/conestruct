# Rule 5 outcome: issue-323-left-lane, near side

Prediction: `prediction.md`, committed in `8504f737` before any code. Base: `main` `ab250c23` + the checkpoint `3ad7d503`.

## Predicted and found

| Predicted | Outcome |
|---|---|
| near_intersection on a confirmed one-way street offers the left side | `left_side_built` admits `NearIntersectionScenario` under the same three conditions. Pinned: side options are `["right", "left"]`; an untagged road gets no left |
| far side → honest 400 naming the fix | `LEFT_LANE_FAR_SIDE_MESSAGE` through `CrossStreetStationError`. Pinned with the cross street marked upstream (E 14th Ave); the right-side far plan still builds |
| left plan = right plan's devices, stations and offsets; `W4-2L` / `W20-5L`; arrow board right | pinned: every sign's (station, offset) equals the right plan's with only R→L; every other device identical; arrow `RIGHT_ARROW` |
| sign descriptions | `W20-5L` "LEFT LANE CLOSED AHEAD", `W4-2L` "LEFT LANE ENDS" (`sign_codes.py`) |
| Note 8 both curbs | pinned: `W20-5L` on both sides of the offset zero |
| page 1 mirrored, inside its boxes | containment 0 / 0 / 0 (pinned). `page1/ni-left-lane-page1.png`: the closed lane against the left curb, the taper off it, the right arrow, signs on both curbs |
| audit: L codes; "Case 18 … mirrored to the left lane of a one-way street"; `left_lane_mirrored` pending item with the cites | pinned: no R lane code anywhere in the audit; the item cites §6N.12 ¶08, Fig. 6P-21 Note 1, §6H.07 ¶02, Fig. 6P-33 Note 1, Note 8 and #323; no `left_shoulder_mirrored` on a lane plan |
| crew sheet words | pinned: "closed left lane … RIGHT ARROW mode (traffic merges right", "closing the left lane.", "on the right curb at each location", "LEFTMOST lane". The right plan keeps "closed right lane … LEFT ARROW", "left curb" |
| every right plan and left-shoulder plan byte-identical | `parity323.py` before (`ab250c23`) and after: 102 scenarios × 9 routes = 918 responses, 855 answered 200, **identical** (`p323-before.json` = `p323-after.json`). This covers every corpus case, the Broadway left and right shoulders, and the right near-intersection plan near side and far side |
| test flips | `test_left_side_oneway.py`'s near_intersection refusal case moved into the new file as "builds"; `left-side.test.ts`'s "fails for any kind but shoulder" now asserts a one-way near_intersection passes and the flagger fails |
| suites green; mypy 0 | pytest 2880 passed, 2 skipped (2869 + 12 new − 1 moved); mypy 0 (49 files); vitest 2303 passed; tsc clean |

## Not predicted

- **`W21-5aL` was not added to `site_adjustments._ADVANCE_SIGN_LABELS`.** The prediction said it would be. Adding it changes left-shoulder plans whenever limited sight distance relocates advance signs (#300's left-shoulder sign would start relocating), which contradicts this arc's byte-identity for left-shoulder plans. It's a #300 gap, filed as #325. The lane codes `W20-5L` / `W4-2L` were added.
- **Refusal wording kept the shoulder's exact text.** The prediction expected only the kind-cause message to change. A first draft reworded the 400 message for every kind, which broke three shoulder refusal tests. Now:
  - `_ensure_pin_model_complete` keeps #300's message for shoulder and other kinds and adds a lane message for near_intersection;
  - `SIDE_REFUSAL_MESSAGES` take the kind's noun (`{work}` → "shoulder work" / "lane work"), so every shoulder refusal is byte-identical;
  - `test_stale_left_side.py`'s two comparisons format the template.

  Only the `not_shoulder` cause (the flagger's) reads differently, as predicted.
- **The frontend pointer text changed** (`auto-apply.ts` `matchRefusalAffordance`): "laid out only for shoulder work" → "laid out for shoulder work and for lane closures near an intersection". This is UI copy, with no plan output behind it.
- **The `RIGHTMOST` lane note on both surfaces** (plan sheet footer, crew sheet) reads `LEFTMOST` on a left plan. Without it the note would describe the wrong lane (Rule 10).
- **One-way crew line "Offsets are measured from the left edge"** now reads `{{ offset_origin }}`, which is "the left edge of the roadway" on every right plan (identical) and the right edge on a left lane plan. The line is lane-only, so left-shoulder plans don't reach it.
