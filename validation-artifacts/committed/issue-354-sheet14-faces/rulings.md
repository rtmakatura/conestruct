# #354 rulings — the W20-1 and G20-5P faces match the sheets the plan cites

Sources and quotes: `checkpoint.md` in this folder.

## S1 (R145 self-ruled): a Case 26/27 plan prints W20-1 as "ROAD WORK ½ MILE"
- `substitute_sign_description` gives W20-1 the face "ROAD WORK ½ MILE" when `sheet_14_freeway_series(params)` is true. It is the issue's proposed solution and the #51 pattern: one producer, every surface.
- Sheet 14 shows that face on both Case 26 and Case 27. #344 put the sign at 2,640 ft from the taper on exactly these plans, so the face states the plan's own distance. A test pins that distance, so the face can't outlive it.
- Case 11 keeps "ROAD WORK AHEAD" in this arc (#334 rulings S5; the issue's acceptance).

## S2 (R145 self-ruled): G20-5P reads "WORK ZONE plaque" on every plan
- `SIGN_DESCRIPTIONS["G20-5P"]` becomes `"WORK ZONE plaque"`.
- Every plan's G20-5P, not only Case 26/27. Sheet 2 General Note 4 names the plaque "Work Zone (G20-5p)" with no case scope. MUTCD 11th Ed. §6G.08 ¶01 (p. 795) names the same plaque "WORK ZONE (G20-5aP)" for plans outside CDOT. No source in the repo names a "CONSTRUCTION ZONE" plaque.
- The crew sheet already tells every crew "Place G20-5P WORK ZONE plaque(s)" (`base.md.j2:60`). A Case 26/27-only fix would leave every other crew sheet contradicting itself.
- The churn is predicted in `checkpoint.md`: faces only, no placement, count or verdict moves.
- The code stays "G20-5P", the caption Sheet 14 uses. MUTCD's "G20-5aP" designation is not adopted here.
- Code comments and the identifier `construction_zone_plaque_interval_ft` keep their old wording. Nothing user-facing reads them, and renaming them is churn outside this issue.

## S3 (R145 self-ruled): "½" is U+00BD on every surface
- One character, U+00BD, not "1/2". Sheet 14 draws the fraction.
- Page 1 draws text in Helvetica, whose WinAnsi encoding carries "½". The XLSX and the crew sheet's Markdown are Unicode. The proof extracts the character from each surface (`outcome.md`).
