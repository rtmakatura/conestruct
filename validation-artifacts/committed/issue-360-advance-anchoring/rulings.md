# #360 rulings

## Sources, quoted
- MUTCD 11th Ed., Table 6B-1, p. 773, title: "Recommended Advance Warning Sign Minimum Spacing". §6B.04 ¶07, p. 771: "The distances contained in Table 6B-1 are approximate, are intended for guidance purposes only, and should be applied with engineering judgment. These distances should be adjusted for field conditions, if necessary, by increasing or decreasing the recommended distances." (`sources/mutcd11-p773.txt`, `sources/mutcd11-p771.txt`; the table prints as "Table 6B1" in the text layer.) So a W20-1 farther out than Table 6B-1's spacing is allowed.
- MUTCD 11th Ed. §6H.02 ¶02, p. 798: "the ROAD WORK AHEAD (W20-1) sign should be the first advance warning sign encountered by road users." (`sources/mutcd11-p798.txt`)
- S-630-1 Sheet 12, Case No. 24, PDF p. 160 (`sources/s630-1-2026-pdf160-sheet12.txt`): "R2-10 SHALL BE PLACED NOT MORE THAN 500' BEFORE THE FIRST SPEED LIMIT SIGN ARRAY."
- S-630-1 Sheet 12, Fines Double Signing Note 4, PDF p. 160: "Placement of "Double Fines" signing may be adjusted as needed to provide a minimum 250' spacing between other signing required for the specific work zone setup."
- S-630-1 Sheet 2, General Note 4, PDF p. 150: "Work Zone (G20-5p) and Fines Double (R2-6p) signs shall be provided every 2640' between R2-10 and R2-11 signs. The spacing of these signs may be changed as directed by the Engineer." The Sheet 12 drawing (PDF p. 160) repeats it. (`issue-300-left-side-oneway/sources/s630-1-2026-pdf150.txt:40-42`)
- S-630-1 Sheet 26, R2-10, PDF p. 174: "Sign is placed at the beginning of the advanced warning area of the traffic control zone."
- S-630-1 Sheet 7, Case No. 11, PDF p. 155, read on the rendered sheet: upstream from the taper start, the G20-5P / R2-1(XX) group sits at 3,000 ft (1,000 ft past the first W21-5aR at 2,000), R2-10 "500' (MIN.)" upstream of the group, and W20-1 2,200 ft upstream of the group (5,200).
- Checked: W20-1 is the farthest sign in every current non-Sheet-14 shoulder series (urban_high 1,050 ft, rural 1,500, expressway 5,140, freeway Case 11 5,200 from the taper start; divided and undivided).

## Rulings
- **R1 (R145 self-ruled):** the audit's advance table lists every placed advance sign and names any it can't place. A W3-5 is never dropped silently (Rule 10). Sheet 14 (Case 26/27) plans stay byte-identical.
- **Q1 (ruled by Ryan, 2026-10-20): option 1.** Freeway Case 11 reduced-speed shoulder plans take Case 11's drawn stations. The G20-5P / R2-1 group sits at taper + 3,000 ft and R2-10 at taper + 3,500 ft (Case 11's "500' (MIN.)" and Sheet 12's "not more than 500'" leave exactly 500). W20-1 stays at 5,200. W3-5 stays at R2-10 + 530 ft per sign step (the house rule, borrowed from Sheet 14; CHOSEN off Sheet 14).
- **Q2 (ruled by Ryan, 2026-10-20): option (d), Case 11's order, on non-freeway reduced-speed shoulder plans (urban_low, urban_high, rural, expressway).**
  - Every advance sign except W20-1 keeps its Table 6B-1 station.
  - The G20-5P / R2-1 group goes at W20-1's former station (taper + A + B + C).
  - R2-10 goes 500 ft upstream of the group (Sheet 12 Case 24).
  - W3-5 goes 530 ft upstream of R2-10, plus 530 ft per extra step (CHOSEN).
  - W20-1 goes one Table 6B-1 C spacing upstream of the farthest W3-5 (CHOSEN; Ryan agreed to C, the spacing W20-1 has today).
- **Q3 (ruled by Ryan, 2026-10-20): option (i), the fill.**
  - The in-zone G20-5P / R2-6P assemblies keep today's stations.
  - While some gap between consecutive plaques is over 2,640 ft (R2-10 counts as one end; Sheet 2 Note 4), add a plaque at the midpoint of the widest gap between signs in that span. The midpoint rule is CHOSEN.
  - A plaque may go only where it's at least 250 ft from every other sign (Sheet 12 Note 4) and upstream of the taper start, never in the buffer or the taper.
  - Repeat until every gap is at most 2,640 ft or no legal spot is left. Then print an engineer note for each gap that remains (Sheet 2 Note 4: "The spacing of these signs may be changed as directed by the Engineer").
- **Scope:** shoulder plans only (both shoulder generators). Lane closures (#361), flagger plans and near-intersection plans place their envelope elsewhere and are untouched.

## Rule 5 churn prediction (written before the diff)
- **Changes**, on every reduced-speed shoulder plan except Sheet 14 Case 26/27 and near-intersection plans:
  - The stations of R2-10, the entrance G20-5P / R2-1 group (which now carries its own G20-5P), every W3-5 and W20-1 (non-freeway only).
  - Added G20-5P / R2-6P plaques upstream of the taper. In-zone plaque stations stay as they are.
  - The audit's fines_double envelope (r2_10, length, n_assemblies, entrance R2-1), its sign-table rows and positions, and the crew sheet's R2-10 / entrance R2-1 distance text. An engineer-note line appears where a gap is left over.
- **Snapshots predicted to change:** `tests/snapshots/corpus/grid_reduced_55_45.json`, `_55_50`, `_65_60`, `_75_65`, `_75_70` (rural_divided), `tests/snapshots/audit_shoulder_reduction_10.json` and `_25.json`.
- **Snapshots predicted byte-identical:**
  - `audit_shoulder_reduction_65mph_envelope.json` (freeway 65→60, Sheet 14).
  - `audit_flagger_reduction_fines_double_required.json`.
  - The NI corpus snapshots and every posted-speed (no-reduction) snapshot.
  - Every lane-closure and flagger plan.
- **Tests predicted to fail and be updated:** any test pinning R2-10 at work zone + 500 ft, or the entrance R2-1 inside the work zone, on a non-Sheet-14 shoulder plan. Each is listed in outcome.md with the reason.
- The branch also carries #355's evidence commit `3f92e6a` (docs only).

## Self-rulings made during the build (R145)
- **R2 (R145 self-ruled):** the fill never puts a plaque between R2-10 and the G20-5P / R2-1 group. Case 11 (Sheet 7, PDF p. 155) and Sheet 12 Case 24 (PDF p. 160) both draw nothing in that 500 ft. With it excluded, Case 11's first plaque lands in its drawn "VAR." slot (2,500 ft), as Q3 expects.
- **R3 (R145 self-ruled, under Q3 "in-zone plaques keep today's stations"):** the in-zone G20-5P series (generator step 5) is still counted from W20-1's former station (`construction_plaque_zone_length`), in both generators and the audit's plaque check. Without this, moving W20-1 out grew the series (expressway 65→55: 3 → 5 plaques, 200 ft apart in 1,000 ft of work).
- **R4 (R145 self-ruled):** the page-1 two-column advance table no longer overlaps its own text. The DESCRIPTION column starts at least 4 pt past the widest code ("W21-5aR" ran into its description), and a description wider than its column shrinks until it clears its distance by 4 pt, floored at 5.5 pt ("SPEED LIMIT XX (work-zone speed posting)" ran into its distance). Both overlaps already shipped on Case 26/27 sheets; #360 puts the R2-1 off-page on every reduced-speed shoulder plan. A table whose rows already fit is drawn as before.
- **R5 (R145 self-ruled):** the entrance R2-1 validator bounds the entrance by R2-10 on every shoulder plan except near-intersection plans. When R2-10 is missing it falls back to "anywhere upstream", so MISSING_R2_10 isn't doubled by MISSING_R2_1_ENTRANCE. The Sheet 14 branch is unchanged.
