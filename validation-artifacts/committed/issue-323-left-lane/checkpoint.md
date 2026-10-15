# issue-323-left-lane — 📋 checkpoint

**Base:** `main` at `ab250c23` (prod). Investigation only: no product code, no prod requests.
**Sources:** MUTCD 11th Ed. Part 6 (`validation-artifacts/ta10_flagger/mutcd_part6.pdf`) and CDOT S-630-1, July 2026 (`validation-artifacts/s630-1-2026.pdf`). Both are untracked (#160), so every quoted page is committed under `sources/`, named by its printed page (MUTCD: the page's own "Page NNN" header, checked for each file; S-630-1: the PDF page). The figures read from drawings are rendered beside them.

## The answer, in brief

1. **Three shapes, three answers.**

   | shape | what blocks it today | governs it | mirror or new? | this arc |
   |---|---|---|---|---|
   | **near side** of an intersection, left lane | `left_side_built` admits shoulder only (`src/api/schemas.py:1263-1292`, R79); near_intersection never sets `work_side` (`schemas.py:1634-1657`); its codes are right-only literals (`layout.py:1518-1519`, `audit.py:791-792`) | §6N.12 ¶08, TA-21 Notes 1–2, TA-33 Note 1, §6H.07 ¶02, S-630-1 Note 8 | **a mirror; every length from the same tables** | **build (R145 self-ruled)** |
   | **far side** of an intersection, left lane | as above, plus the far-side branch's only source is TA-22 Note 7 (right lane) | TA-23 (p. 904–905), drawn with a left-turn bay and R3-7L | **a different layout**, not a mirror | **stop: Q1** |
   | **mid-block**, left lane | no mid-block lane-closure kind is live on either side: the only one, `lane_closure_divided`, is gated, hard-coded for a 4-lane divided highway, and its own citation ("TA-19 · S-630-3 Case 3A") is recorded UNVERIFIED | TA-33 Note 1, S-630-1 Case 5 / Case 10 | **no right path to mirror**; it's an enablement | **stop: Q2** |

2. **Near side, the evidence for a mirror.** No figure in either manual draws a near-side left-lane closure on a one-way street (#300's search, repeated here for the near side). But each element the mirror changes is sourced, and the lengths don't depend on the side:
   - **MUTCD §6N.12 ¶08 (Support), p. 849:** "Near-side work spaces, as depicted in Figure 6P-21, are simply handled as a midblock lane closure."
   - **Notes for Fig 6P-21 (TA-21, Lane Closure on the Near Side of an Intersection), Note 1 (Standard), p. 900:** "The merging taper shall direct vehicular traffic into either the right-hand or left-hand lane, but not both." **Note 2 (Guidance):** "In this typical application, a left taper should be used so that right-turn movements will not impede through motor vehicle traffic. However, the reverse should be true for left-turn movements." Fig 6P-21 (p. 901, *drawing*) is a two-way street with an interior lane closed.
   - **Notes for Fig 6P-33 (TA-33), Note 1 (Standard), p. 924:** "This information also shall be used when work is being performed in the lane adjacent to the median on a divided highway. In this case, the LEFT LANE CLOSED signs and the corresponding Lane Ends signs shall be substituted." This is the manual's own substitution rule for a left lane on a one-direction roadway: same layout, L signs.
   - **§6H.07 ¶02 (Standard), p. 805** (#300 `sources/`): "For a single lane closure, the Lane Closed (W20-5) sign … shall use the legend RIGHT (LEFT) LANE CLOSED."
   - **S-630-1 Sheet 2, General Note 8, PDF p. 150:** "All warning and regulatory signs shall be posted on both sides of the roadway on divided highways, multi-lane ramps, one-way streets, … except where only one shoulder is closed". Already built for one-way near-intersection plans (#309), and side-symmetric in the offset model.
   - **The lengths:** the taper L (Table 6B-4), the sign spacings A/B/C (Table 6B-1), the buffer and the device spacings are tabled by speed, with no side term. #300 found no left-specific length in either manual. **No new value enters.**
3. **Far side: TA-23 is a different layout** (Fig 6P-23, "Left-Hand Lane Closure on the Far Side of an Intersection", notes p. 904, figure p. 905, *drawing*).
   - **What TA-23 draws:** on a two-way street, the left lane is tapered closed before the intersection (W20-1, W20-5L, W4-2L, with A/B/C spacing). Then the closed lane reopens as a **left-turn bay** signed **R3-7L "LEFT LANE MUST TURN LEFT"**, with a **100 ft** dimension, and an arrow board stands on the far side.
   - **Note 4 (Option):** "...the left-hand lane may be reopened as a turn bay for left turns only, as shown."
   - **What the tool builds on the right:** the far side rests on TA-22 Note 7 (p. 902): "If dimension "A" is not available to create a temporary right-turn lane, continuous channelizers may be installed from the end of the taper to the intersection and, as a result, the RIGHT LANE MUST TURN RIGHT signs would not be installed." **TA-23 has no such note.** So a left far side either takes TA-23's turn bay (a new device, R3-7L, and new geometry), or mirrors the right's continuous channelizers with no left source.
4. **Mid-block: nothing to mirror yet.** `scenario_to_call` routes a multi-lane one-direction lane closure to `lane_closure_divided` (`schemas.py:1547-1554`). That kind is outside `ENABLED_SCENARIOS` (`render_api.py:141-143`), its generator is "hard-coded for a 4-lane divided highway" (`layout.py:942-944`), and its TA-19 / S-630-3 Case 3A citation is listed UNVERIFIED (`validation-artifacts/committed/arc11-117-enablement/phase5-citations.md:34`). A left mid-block plan therefore needs that kind enabled under Rule 8 first, for both sides. That's a new enablement arc with its own evidence bar, not #323's mirror.

## What the near-side build changes (the code map)

**Gate**
- `left_side_built` also admits `NearIntersectionScenario` under the same conditions: the one-way-street verdict, a one-way tag, and a confirmed road. **Near side only:** when the cross street lies past the work (far side), left work is refused with a message naming the fix.
- The refusal messages stop saying "shoulder work only".
- `scenario_to_call` sets `work_side` for near_intersection, as it does for shoulder.
- Frontend `leftSideBuilt` (`lib/scenarios/auto-apply.ts:191-197`) mirrors the predicate, commented as a mirror (Rule 3).

**Generator**
- `layout.py:1518-1519`: `W4-2L` / `W20-5L` when the work side is left.
- `layout.py:1554`: the arrow board points right (`plan_sheet._arrow_board_display` already maps a non-left label to right).
- The offsets don't change: in the offset model a left plan's numbers equal the right plan's, and page 1 mirrors them (#300).

**Sign descriptions**
- `sign_codes.py` gains `W20-5L` "LEFT LANE CLOSED AHEAD" (§6H.07 ¶02) and `W4-2L` (TA-23's figure, TA-33 Note 1's "corresponding Lane Ends signs"), so no surface prints a bare code.
- `site_adjustments._ADVANCE_SIGN_LABELS` gains the L codes, and `W21-5aL`, which #300 missed.

**Audit**
- `audit.py:791-792` codes follow the side.
- The Case 18 `cdot_reference` gets a mirrored wording like the shoulder's Case 11 one (`audit.py:448-456`): "Case 18 (right-lane closure near an intersection), mirrored to the left lane of a one-way street".
- A `left_lane_mirrored` pending-verification item states that no figure draws it, citing the sources above. This follows the #300 pattern (`audit.py:1509-1510`, `2144-2158`).

**Crew sheet**
- `base.md.j2` lines 41, 53 and 63 ("right lane", "LEFT ARROW … merges left") follow the side.
- The Note 8 lines 48, 74 and 83 ("left curb") name the curb opposite the work.

**Page 1**
- Already mirrored by `work_side` (#300's `_PAGE_MIRRORED`).
- The TA chip stays TA-21, since the near side is this arc's only shape.

## Rule 5 (predicted with the build, in `prediction.md`)

- **Right-side plans of every kind are byte-identical.** `work_side` defaults to `"right"`, so no fixture, snapshot or corpus case moves.
- **Expected churn:**
  - `tests/test_left_side_oneway.py`'s near_intersection refusal case (`:137-169`) flips to a plan;
  - the frontend's `left-side.test.ts:58-60, 80-86` and `WhereBand.left-side.test.tsx:53` near_intersection-refused assumptions flip.

## Questions for Ryan

**Q1. Far side, left lane** (TA-23):
- **(a) Recommended:** build TA-23's layout as its own branch after this one. That means the left-turn bay with R3-7L, the 100 ft dimension, both-sides signing per Note 8, and the TA chip and citation at TA-23.
- **(b)** Refuse left far-side plans and keep it parked.
- **(c)** Mirror the right's continuous channelizers. Not recommended: TA-23 has no Note 7, so there's no left source.

**Q2. Mid-block, left lane:**
- **(a) Recommended:** split mid-block lane closures on one-way streets, both sides, into their own Rule 8 enablement issue. The likely sources are S-630-1 Case 5 / Case 10 and TA-33 Note 1, and `lane_closure_divided`'s unverified citation gets fixed first.
- **(b)** Fold it into #323 now (a much larger arc).
- **(c)** Leave it parked.

Until you answer, I'll build the near side under R145. Every number in it is sourced, and it's a mirror the sources describe element by element.
