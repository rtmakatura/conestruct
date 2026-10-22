# #368 rulings: W20-1's floor on freeway Case 11 reduced-speed shoulder plans

Built on #362's production-check evidence `f66c8dd` (`issue-362-prod-check`), which ships with this branch.

## Rulings

- **R1 (Ryan, 2026-10-22; issue comment): option (b).** On freeway Case 11 reduced-speed shoulder plans, W20-1 = max(5,200 ft, last W3-5 + 1,000 ft), measured from the taper start.
  - Source for 1,000 ft: Case 11's own sign-to-sign spacing (S-630-1 Sheet 7, Case No. 11, PDF p. 155: W21-5aR at 1,000 and 2,000 ft, the G20-5P / R2-1 group at 3,000 ft) and MUTCD 11th Ed. Table 6B-1, Expressway / Freeway distance A, 1,000 ft (p. 773).
  - The 30 short pairs move (2 / 3 / 4 steps → 5,560 / 6,090 / 6,620 ft). The 13 one-step pairs keep 5,200 ft, a partial change to #360 Q1.
  - Out of scope: the 530 ft W3-5 step and the 530 ft R2-10 → W3-5 gap (#360 Q1, CHOSEN off Sheet 14).
- **R2 (R145 self-ruled):** the 1,000 ft comes from the existing Table 6B-1 producer, `advance_warning_spacing(speed, "freeway")["A"]` (1,000 ft at every freeway speed), not a new literal. One producer per number (Rule 12).
- **R3 (R145 self-ruled, under #360 R3 "the in-zone G20-5P series is still counted from W20-1's former station"):** on a Case 11 reduced-speed plan, `construction_plaque_zone_length` keeps counting the in-zone G20-5P series from taper + 5,200 ft, the station W20-1 had before this fix. Without it, the longer signed length could add an in-zone plaque on plans where nothing else about the work zone changed. Both generators and the audit's plaque check read the same producer, so they stay in step. The advance-area plaques (`_fill_plaques`) don't read W20-1 and are unchanged.

## Rule 5 prediction (before the diff)

Grid (`byteid.py`): every freeway shoulder plan, posted 55/60/65/70/75, work-zone speed 20 to posted − 5 and none, divided and undivided, 1,000 and 5,000 ft (200 plans), plus #362's non-freeway reduced-speed grid (126 plans). Surfaces: audit JSON, audit PDF text, plan PDF text, crew markdown, XLSX cells.

- **Move:** the 30 two-, three- and four-step Case 11 speed pairs × divided/undivided × 1,000/5,000 ft = **120 plans**. W20-1 moves to 5,560 / 6,090 / 6,620 ft. Expected on every surface that prints W20-1's distance or station: audit JSON, audit PDF, plan PDF, crew sheet, XLSX. The in-zone G20-5P count does not change (R3).
- **Byte-identical:** the 13 one-step pairs (52 plans), Sheet 14 (65→60, 75→65; 8 plans), freeway with no reduced speed (20 plans), and all 126 non-freeway plans.
- Not covered by the text hashes: page 2's corridor map and the scan box grow with the furthest sign on the 120 moved plans (one producer, `src/rules/corridor_layout.py`). That is the intended effect of a farther W20-1.
- Tests: pins that assert W20-1 = 5,200 on a one-step plan stay green (`test_case11_spacing_334.py` reduced-65-55, `test_advance_anchoring_360.py`). A pin on a two-or-more-step Case 11 plan's W20-1 would move; none found by grep.
