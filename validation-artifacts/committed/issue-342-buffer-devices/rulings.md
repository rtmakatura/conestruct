# #342 rulings

#333's follow-up, which its S1 Scope named. It carries #333's S1–S3 over to the flagger, lane-closure and near-side near-intersection plans, self-ruled under R145. Branch `issue-342-buffer-devices`, built on the pending evidence branch `issue-345-prod-check` (`73d2833`).

## S1 (R145 self-ruled): the three generators channelize the buffer at ≤ 2S
- **Source.** CDOT S-630-1 Sheet 2 General Note 18:
  > 18. Channelizing device spacing, in feet, shall be as follows: … b. For tangents along the buffer space or work area, spacing may not be greater than two times the speed limit.

  MUTCD 11th Ed. §6K.01 ¶04 (p. 815) gives the same 2× limit. This is the same source and reading as #333 S1.
- **The convention it replaces.** "# 4. Buffer space — intentionally empty." is the scaffolding convention #333 S1 already found to be unruled, so this isn't a reversal.
- **Scope.** `generate_flagger_alternating_2lane`, `generate_lane_closure_divided` (gated), and `generate_near_intersection` on the near side only.
- **Left as they are:**
  - **Far side.** The §6N.12.12 companion tangent already runs from the taper down to the work zone, so there's no bare buffer.
  - **TA-23's opening (left-turn bay).** TA-23 draws no device in the opening on purpose (#323 R153).
  - **Mobile and work beyond the shoulder.** Neither has a buffer tangent of this shape.

## S2 (R145 self-ruled): one producer, one gate
- **Stations.** `buffer_cone_stations(wz_len, buf_len, speed)`, unchanged from #333 S2: the fewest equal intervals at ≤ 2S, interior points only.
- **Offset.** Each generator's own work-zone tangent line, which is also where its taper ends: the lane line (lane closure, near side) or the centerline (flagger, offset 0).
- **Gate.** A new `buffer_carries_cones(params, approaches)` in `layout.py` decides which plans channelize the buffer. It's true for shoulder and lane closures, and false for far-side near-intersection plans. The audit, the crew sheet and page 1 read it in place of their three `closure_type == "shoulder"` checks (Rule 3).

## S3 (R145 self-ruled): the flagger's opposing approach needs nothing added
- In this layout the opposing approach has no buffer. Its open lane is never closed. The closed lane's downstream end runs from the last work-zone cone at station 0 straight into the downstream taper (station 0 to −`ds_taper_len`, `layout.py` § 9), with no gap between them.
- So no stretch along the closed lane's edge on that side goes uncovered.
- This rests on the generator's own geometry. The issue asked for a check against Fig. 6P-10 / Case 42; that comparison wasn't re-read in this session, and the flag stays in the report.

## S4 (R145 self-ruled): page 1 and the crew sheet follow #333 S3
- **Page 1.** Same as #333 S3: the compressed buffer draws no cones, and its label reads `BUFFER = N ft (NTS) · K CONES`.
- **Crew sheet.** Step 3 adds #333's "continue the line through the buffer space" sentence to the flagger and near-intersection branches, at each branch's own offset wording. The near-intersection companion count now counts the far side only, so the near side's buffer cones aren't described as the §6N.12.12 companion closure.
