# #382 rulings

## R1 (ruled by Ryan, 2026-10-24): (d), gated on a check, with (c) as the fallback

Ryan's words: "(d)-gated exactly as you laid it out. Run the source search for a stated minimum work-area length (quote it, or record that none exists), then render page 2, the device list and the crew sheet at the short lengths (50 ft flagger, 50 ft near-intersection at 45 and 55 mph, a short shoulder zone). If all clean, drop the limit for every kind and keep the short-vs-buffer warning. If a non-flagger kind breaks, fall back to (c) and file the rest. Correct the docstring and audit text either way."

Steps:
1. Source search: MUTCD 11th Ed. Ch. 6B/6N and the S-630-1 case sheets, for a stated minimum work-area length or a work-area-to-taper relation. Quote it with a page cite, or record that none exists.
2. Render check at the short lengths: page 2, the device list and the crew sheet for a 50 ft flagger zone, a 50 ft near-intersection zone at 45 and 55 mph, and a short shoulder zone.
3. All clean: drop `WORK_ZONE_SHORTER_THAN_TAPER` for every kind and keep `WORK_ZONE_SHORT_VS_BUFFER`. A non-flagger kind breaks: drop the limit for flagger only (c), and file the rest.
4. Either way, correct the validator docstring and the `audit.py` text that claim geometric impossibility.

## R1 outcome (2026-10-24)
- **Step 1:** no minimum work-area length exists in the MUTCD 11th Ed. Part 6 or S-630-1 (`source-search.md`).
- **Step 2:** clean on every kind at 50 ft: page 2, device list, crew sheet and audit (`render-check/README.md`).
- **Step 3:** so the limit is dropped for every kind (not the (c) fallback). `WORK_ZONE_SHORT_VS_BUFFER` stays.
- **Step 4:** the validator docstring and the `audit.py` geometry comment now describe the generators' stacking, not geometric impossibility.

## R2 (R145 self-ruled): the frontend's mentions of the rule are filed, not folded
`conestruct/site/` names `WORK_ZONE_SHORTER_THAN_TAPER` in comments: `lib/scenarios/validation.ts`, `lib/scenarios/index.ts`, `components/GeneratorShell.tsx`, `components/FlaggerForm.tsx`, `components/StatusBar.tsx`, `lib/render-proxy.ts`. About ten vitest fixtures also use its message as a mocked 400. None computes or calls the rule; the 400 gating path they describe still carries the freeway lane-width and speed-domain refusals. They are outside the files this branch touches, so under R154 they are filed as #386, not folded, and this branch stays backend-only.

## Rule 5 churn prediction
The branch starts at `44b5af4`, #378's production-check evidence, on main `777e3e7`. That commit ships with this fix.

**Changes (deliberate):**
- `validate_corridor_geometry` no longer emits `WORK_ZONE_SHORTER_THAN_TAPER`. A fixed-taper plan (shoulder, lane closure, near-intersection, flagger) with a work zone shorter than its taper now builds on every render route instead of answering 400. Its audit `geometry_validation` keeps `taper_ft` and `taper_label`. `violations` loses the error, and `all_pass` turns true unless another error fires.
- The validator docstring and the `audit.py` step-10 comment change (no runtime effect).

**Byte-identical:**
- Every request that built before builds the same.
- `WORK_ZONE_SHORT_VS_BUFFER` (still a warning, same message), `LANE_WIDTH_BELOW_FREEWAY_MIN` and `SPEED_OUTSIDE_TABLE_DOMAIN` are unchanged, as is the mobile/off-road exemption.
- No generator, drawing, device count, crew text or frontend file changes.

**Tests:**
- `tests/test_flagger_taper_refusal.py` becomes `tests/test_short_work_zone.py`, a payload-level suite covering audit and PDF for flagger, near-intersection at 45 and 55, and shoulder at 50 ft.
- Three `test_rules.py` tests become two.
- The corpus boundary case flips from 400 to 200 (`..._accepted`).
- `test_near_intersection.py::test_valid_body_renders_200_post_enablement` now expects 200.
- `test_replication_snapshot.py::test_snapshot_invalid_geometry_survives_as_refused` takes its refused case from the freeway lane width.
- Net count −1: 3555 → 3554.
