# #333 rulings

The arc was ordered by Ryan's audit review (2026-10-16): F3, second in the order, self-ruled under R145. Stacked on #332 (`issue-332-trunk-twoway`).

## S1 (R145 self-ruled): shoulder plans channelize the buffer at ≤ 2S
- **Source.** CDOT S-630-1 Sheet 2 General Note 18:
  > 18. Channelizing device spacing, in feet, shall be as follows: … b. For tangents along the buffer space or work area, spacing may not be greater than two times the speed limit.

  MUTCD 11th Ed. §6K.01 ¶04 (p. 815) gives the same 2× limit.
- **The convention it replaces.** The code's "# 4. Buffer space — intentionally empty." dates from the first scaffolding commits (phase 3, `bc20c8cf`). It's a convention, not a recorded ruling, so this isn't a reversal.
- **Scope.** The two shoulder generators only. The lane closure (`layout.py:1059`) and flagger (`:2104`) generators carry the same convention. Changing them widens the scope, so they're named in the report for a follow-up.

## S2 (R145 self-ruled): the buffer cones' stations
`buffer_cone_stations(wz_len, buf_len, speed)` in `layout.py` is the one producer. The generators, the audit and the crew sheet all read it (Rule 3).
- **Interval count:** the fewest equal intervals with spacing ≤ 2S, `n = ceil(buf_len / 2S)`.
- **Stations:** the interior points `wz_len + k·buf_len/n` for k = 1..n−1. The ends already hold a device: the last work-zone cone at `wz_len`, and the last taper drum at `wz_len + buf_len`.
- **Offset:** the work-zone tangent's (the lane edge).
- **When there are none:** a buffer of 2S or less needs no cones.

## S3 (R145 self-ruled): page 1 names the buffer cones; it doesn't draw them
Page 1 compresses the buffer to 80 visual ft (`plan_sheet.py` `BUFFER_VISUAL_FT`), so at highway scale the cones would pile up on the scale-break mark.
- **The precedent:** TA-23 (#328/#330) drops cones and drums from its compressed stretch and names them on the dimension line.
- **The rule here:** the same. Page 1 leaves out cones inside the buffer, and the buffer label reads `BUFFER = N ft (NTS) · K CONES`.
- **Everything else lists them in full:** the device summary, the XLSX, the quote, the crew sheet and the audit.
- Before/after page-1 images go in the report for Ryan's look.
