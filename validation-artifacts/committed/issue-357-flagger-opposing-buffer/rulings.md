# #357 rulings: does the flagger's opposing approach need buffer devices?

Checks #342's S3 (`validation-artifacts/committed/issue-342-buffer-devices/rulings.md`) against the source figures. Branch `issue-357-flagger-opposing-buffer`, built on the pending evidence branch `issue-358-prod-check` (`9ddb692`). No code changes.

## R1 (R145 self-ruled): S3 holds. The opposing approach gets no buffer devices.

All three figures draw the same thing at the opposing end: the closed lane's downstream taper starts at the end of the work space, and the space between it and the opposing flagger sits in the open lane with no devices along it.

### MUTCD 11th Ed. Fig. 6P-10, TA-10 (p. 879; notes p. 878)
Crop: `mutcd-fig6p10-p879.png` (from `validation-artifacts/ta10_flagger/mutcd_part6.pdf`, file p. 115).
- **Approach whose lane is closed.** The flagger, then the 50 to 100 ft one-lane two-way taper, then a long run of channelizing devices along the centerline through the curve to the work space. This is the buffer. Note 6 (p. 878) is the only buffer text, and it covers this end only:
  > 6. The buffer space should be extended so that the two-way traffic taper is placed before a horizontal (or crest vertical) curve to provide adequate sight distance for the flagger and a queue of stopped vehicles.
- **Opposing end.** Zoom: `mutcd-fig6p10-p879-opposing-end-zoom.png` (300 dpi; the full-page crop is too small to show it). The centerline devices run to the end of the work space. From the last one, four more devices step across the closed lane to the edge line. The figure's "50 to 100 ft" dimension spans that taper: its extension lines meet the last centerline device and the device at the edge line. So the taper starts at the work space, with no buffer space before it. No devices are drawn past the taper toward the opposing flagger.
- The notes (p. 878) say nothing about devices on the opposing approach.

### CDOT S-630-1 (July 2026), Sheet 9 Case 17, "Lane Closure, Two-Lane Highway, At Curve"
Crop: `s630-1-2026-sheet9-case17.png` (`validation-artifacts/s630-1-2026.pdf`, PDF p. 157, "Standard Sheet No. 9 of 26").
- **Opposing end.** A downstream taper dimensioned "100' MAX." starts at the end of the work area. The opposing flagger stands "200' TO 300'" past it, in the open lane. That space has no devices.
- The case's only note on that end is about the upstream taper: "THIS TAPER MUST BE SHORT ENOUGH TO NOT BE MISTAKEN FOR A TRANSITION."

### CDOT S-630-1 (July 2026), Sheet 25 Case 42, "Pilot Car - Lane Closure, Two-Lane Undivided Highway"
Crop: `s630-1-2026-sheet25-case42.png` (PDF p. 173, "Standard Sheet No. 25 of 26").
- This is the pilot-car case. The sheet points back to Case 17 for its standards: "Follow applicable standards as shown in Case No. 17 on Sheet 9 …"
- **Opposing end.** Two devices taper out right after the work area. The space up to the opposing flagger is labelled "200-300' BUFFER / PILOT TURNAROUND". It sits in the open lane, where the pilot car turns around (the P vehicle is drawn there). It has no devices along it.
- This is the one figure that names a buffer on the opposing end. It's a 200–300 ft standoff in the open lane, not a closed-lane buffer.

### Sheet 2 General Note 18b
> 18. Channelizing device spacing, in feet, shall be as follows: … b. For tangents along the buffer space or work area, spacing may not be greater than two times the speed limit.

(Text as quoted in #342 S1. Re-read in the July 2026 Sheet 2, `s630-1-2026.pdf` PDF p. 150: "b. For tangents along the buffer space or work area, spacing may not be greater than two times the speed limit.") Note 18b sets how far apart devices go along a device tangent. It doesn't add a tangent where the figure draws none. The opposing-end standoff has no tangent, and a line of devices there would narrow the only open lane.

### The generator agrees
`src/generation/layout.py` `generate_flagger_alternating_2lane`: § 9 starts the downstream taper at the work-zone end (`station = wz_end_station - t * ds_taper_len`). § 7 puts flagger #2 200–300 ft past the work-area end, with the comment "Case 42 reuses this standoff as the pilot-car turnaround space", and places no devices in it. So S3's geometry matches the figures, and S3's open flag ("that comparison wasn't re-read") is now closed.

## R2 (R145 self-ruled): nothing goes into 02-JURISDICTION-DATA.md
The issue says to record only a new fact. The file doesn't exist in the repo (no path matches `*JURISDICTION-DATA*`, and `origin/main` has none), so there's nothing to append to. The facts used here (Case 17's 200–300 ft standoff and 100 ft max taper, Case 42 reusing it) are already recorded in `validation-artifacts/s630-2026-verification.md` row V6 and in `layout.py`. The missing file goes in the report as a flag. Creating it is out of scope for this issue.
