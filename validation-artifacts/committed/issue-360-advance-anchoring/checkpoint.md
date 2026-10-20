# #360 checkpoint: where R2-10, the entrance R2-1 group and W3-5 go on a reduced-speed shoulder plan

Branch `issue-360-advance-anchoring`, on `3f92e6a` (#355's production-check evidence, `issue-355-prod-check`).

## What the probe found (bigger than the issue says)
`probes/probe_r2_10_w3_5.py` runs both shoulder generators over 4 road classes x 9 speed pairs x 2 work lengths (144 plans). Output: `probes/probe-3f92e6a.txt`.

- **R2-10 sits at or past the taper start on 136 of 144 plans.** Every plan except the 8 Sheet 14 (Case 26/27) plans has it there. `fines_double_envelope` puts it at work zone + 500 ft (`src/generation/layout.py:385`), and the buffer plus the taper is longer than 500 ft at every speed. Example: urban_high 45->35, 500 ft of work. The taper starts at 1,010 and R2-10 is at 1,000.
- At 75 mph the first W3-5 is past the taper start too (the issue's case: W3-5 at 3,030 with the taper starting at 3,070).
- The entrance G20-5P / R2-1 group sits inside the work area on those 136 plans (`layout.py:387`).
- This includes the freeway Case 11 plans (`case_11_freeway_series`). The issue asks to keep them byte-identical, but they have the same defect.

## What the sources say
- **S-630-1 Sheet 26, R2-10** (`issue-300-left-side-oneway/sources/s630-1-2026-pdf174.txt:46-47`): "Sign is placed at the beginning of the advanced warning area of the traffic control zone."
- **S-630-1 Sheet 12, Case No. 24** (`sources/s630-1-2026-pdf160-sheet12.txt:40-45`): "R2-10 SHALL BE PLACED NOT MORE THAN 500' BEFORE THE FIRST SPEED LIMIT SIGN ARRAY." The drawing runs W20-1, then R2-10, then the G20-5P / R2-1(XX) array.
- **S-630-1 Sheet 7, Case No. 11** (the rendered sheet, `issue-300-left-side-oneway/sources/s630-1-2026-pdf155-sheet7-cases10-11.png`): measured upstream from the taper, the signs run W5-1 at 500, W21-5aR at 1,000, W21-5aR at 2,000, G20-5P / R2-1(XX) at 3,000, then R2-10 "500' (MIN.)" further, then W20-1 2,200 ft upstream of the R2-1 group (5,200; already `CASE_11_FREEWAY_SIGN_FT["C"]`). There's no W3-5 on Case 11.
- **Nothing in S-630-1 or the MUTCD gives these stations for a non-freeway shoulder plan** (urban_high, rural, expressway). Those plans use the Table 6B-1 A/B/C series. The W3-5's "R2-10 + 530 ft" comes from Sheet 14, which is drawn for freeways only.

## Questions for Ryan (R145 stops: a scope change, and unsourced station values)
**Q1. Freeway Case 11 plans: should they move too?** This changes the issue's acceptance criteria.
- Recommended: yes. Use Case 11's drawn stations. The R2-1 group goes at taper + 3,000 and R2-10 at taper + 3,500 (Sheet 12's 500 ft "not more than" and Case 11's 500 ft "MIN." give exactly 500). W3-5 stays at R2-10 + 530 (the house rule, unchanged). Every number is sourced except the W3-5's.
- Alternative: keep them byte-identical as the issue says, and file their R2-10-in-taper as a separate issue.

**Q2. Non-freeway plans (urban_high, rural, expressway): which station rule?** No source gives one, so the number is CHOSEN (Rule 12) either way.
- Recommended (a): put the speed group upstream of W20-1, in Case 11's order. The R2-1 group goes at sign C + the road class's Table 6B-1 sign spacing, R2-10 500 ft upstream of that (Sheet 12), and W3-5 530 ft upstream of R2-10. The advance series and the taper stay where they are, and nothing can land in the buffer or the taper at any speed or work length. Cost: R2-10 is upstream of W20-1, so it marks the start of the advance warning area itself (that satisfies Sheet 26's wording, but Sheet 12 draws W20-1 first).
- (b): put the speed group between the advance signs (W20-1 first, as Sheet 12 draws it). This doesn't fit. At urban_high the A/B/C spacing is 350 ft, less than Sheet 12's 500 ft from R2-10 to R2-1, so R2-10 would collide with an advance sign or the order would break.
- (c): refuse reduced-speed shoulder plans off the freeway class until a source is found (Rule 8). That takes a live feature away.

**Self-ruled (R145), regardless of Q1/Q2:** the audit's advance table lists every placed advance sign. It names any it can't place, and it no longer drops a W3-5 silently (Rule 10). Sheet 14 (Case 26/27) plans stay byte-identical.

## Rule 5 churn prediction (if Q1 = yes, Q2 = (a))
- Changes: on every reduced-speed shoulder plan off Sheet 14, the stations of R2-10, the entrance G20-5P / R2-1, the G20-5P / R2-6P assemblies (the envelope gets longer) and W3-5. Also their stations in the audit, PDF and crew sheet, and the corpus snapshots `grid_reduced_55_45`, `_55_50`, `_65_60`, `_75_65`, `_75_70` plus the reduced-speed audit snapshots.
- Byte-identical: posted-speed plans (no Fines Double), Sheet 14 Case 26/27 plans, lane closures, flagger plans (#361 owns lane closures), and the taper, buffer and advance series on every plan.
- The branch also carries #355's evidence commit `3f92e6a` (docs only).

## Proof plan
A station-ordering test over the full 144-plan grid: R2-10, W3-5 and the entrance R2-1 are all upstream of the taper start, and R2-10 is exactly 500 ft upstream of the R2-1 group. A payload-level `/render/audit` test on `grid_reduced_75_70` checks that the advance table lists W3-5(70). A red proof on base. A probe re-run is committed to `probes/`.
