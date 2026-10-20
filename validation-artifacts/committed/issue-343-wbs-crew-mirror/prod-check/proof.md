# #343 production check of 170f262

**PASS 2/2.** Run 2026-10-20 against www.conestruct.com through the site proxy. `healthz.txt` shows the backend sha is `170f262`. `prodcheck343.py` is the script, and `replay.txt` is its full output.

1. **Divided shoulder, live (Case 11 body, 55 mph), `/render/markdown` 200.** All four mirror lines and #337's "by choice" Safety line are present. "signs go on the right side only" is absent. This divided plan's sheet is unchanged, as predicted (its placements mirror every sign and plaque).
2. **Work beyond shoulder, divided freeway, `/render/markdown` 400**: "This scenario type isn't available yet." The kind stays gated (Rule 8), so prod can't show the fixed sheet itself. That fix is proven by `tests/s630/test_wbs_crew_mirror_343.py` on the shipped sha (`../outcome.md`).
