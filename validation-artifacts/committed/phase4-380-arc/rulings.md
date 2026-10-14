# Rulings: Phase 4, the 380 arc

## R137 (Ryan, 2026-10-12), verbatim

> R137, Phase 4 rulings:
> - Q1: yes. Rule 168 is open, narrowed to hiding the four cards at the narrow width, with a "4 files" line under the zip.
> - Q2: yes. #286 first, inside Phase 4.
> - Q3: the honest minimum-width message, yes, and the plan sheet and map on a phone get their own issue (draft it for the chat). But many Android phones are 360 px wide, so before you set the floor, measure what breaks at 360 and report it. If it's small, the floor is 360; if not, 380, and say why.
> - Q4: one phone size everywhere (screenshots, verify-jbar, docs), set by the Q3 answer: 360×800 or 380×800.
> - Q5: yes, inside Phase 4, measured first.
> Five branches in your order, each reporting before ship. Start with sizes and tooling once #314 is out.

**On the record:** the plan sheet and map on a phone went up as #318 (from my draft).

## R137 Q3's measurement: what breaks at 360 that doesn't at 380

Production's `/sandbox` on main `0eee1a7`, N Broadway SB (39.73370, -104.98753), shoulder work, at
360×800 and 380×800 (a mobile, touch context at 2× density). Four stages: the empty page, the
picker, WHERE with the road and kind chosen, WHAT after Confirm, and the results after Generate.
Script and outputs: `m360/` (`measure360.cjs`, `measure-360.json`, `measure-380.json`, full-page
screenshots).

| Measure, per stage | 360 | 380 |
|---|---|---|
| Horizontal scroll (scrollWidth vs viewport) | none, at every stage | none |
| Elements past the right edge (not inside a scroller) | 0 at every stage | 0 |
| Clipped text | only the screen-reader-only headings, which are hidden by design (a false positive) | the same |
| Interactive targets under 44 px | picker 12, WHAT 11 | picker 12, WHAT 11: **the same list, item for item** |
| Page height: WHAT | 4536 px | 4536 px (no extra wrapping) |
| Page height: WHERE / results | 4790 / 5494 px | 4758 / 5464 px: one extra wrapped line each (16 / 15 CSS px) |
| Page errors | none | none |

**Nothing breaks at 360 that doesn't already at 380.**
- **The under-44 px targets are existing deviations at both widths,** for the arc to fix at whichever
  width it uses:
  - the segmented chips are 42 px tall (Street class, Carriageway, Hours, Speed reduction);
  - the footer's windows line is 32 px, and its OPEN is 42 px wide;
  - in the picker: Close (34×26), the coordinate toggle (30 tall), the map controls (32, 24), Re-detect
    roads (24 tall), Cancel (36 tall).
- **By eye at 360,** the chip labels ("Collector", "Arterial"), the row markers and the footer line all
  fit on one line.

**What was not covered:**
- the other kinds' forms (flagger, near-intersection's cross-street group);
- the results disclosures opened;
- the picker's map interaction.

Branch 1 measures those at the chosen size before setting the floor message.

**Recommended floor: 360 px** (R137 Q3: "If it's small, the floor is 360"). Under Q4, the one phone
size everywhere becomes **360×800**.

## R138 (Ryan, 2026-10-12), verbatim

> R138: floor 360 px; one phone size everywhere, 360×800 (screenshots, verify-jbar alongside 1440×1000, DESIGN-SPACING.md, the light lane's convention). Rename "the 380 arc" in the docs you touch.
>
> Add a tap-target branch to Phase 4, after branch 1: every control on WHERE, WHAT, the footer and the picker reaches 44 px in its smaller dimension (R107 already ruled 44 px for WHAT's controls; the 42 px chips miss it). That covers the chips, the windows line, OPEN, Close, the coordinate toggle, the map controls, Re-detect roads and Cancel. Mapbox's own map buttons: fix if we can style them; if not, say so.
>
> Finish branch 1 at 360×800, including the surfaces you haven't measured yet (other kinds' forms, the results disclosures opened, the picker's map). Report before ship.

**The remaining surfaces at 360×800** (R138: other kinds' forms, results disclosures opened, the
picker's map), in `m360-more/`. Overflow is measured against the screen width, because a phone widens
its layout to fit wide content.

| Surface | 360 | 380 |
|---|---|---|
| WHAT, flagger | no overflow, no scroll | — |
| WHAT, near-intersection with E 11th Ave marked (cross-street group) | no overflow, no scroll | — |
| The picker after zoom ×2, a pan and a tap moving the pin | no overflow, no scroll | the same |
| Results, all 10 disclosures opened | **the device table is 421.4 px wide**; the page widens to 421 | **the same: 421.4 px; the page widens to 422** |

- **The device table** (`table.device-table`) is an existing defect, not a 360 one. The phone arc fixes
  it.
- **More under-44 px targets** from the forms, present at 380 as well, for the tap-target branch:
  - the cross-street speed and lane-width range sliders (the element box is 2 px tall);
  - the cross-street type select (43 px);
  - "Lane count is right" (28 px).

**On the record:**
- **The arc's new name:** "the phone arc (360 px)" in the docs this branch touches. This folder keeps
  its name, `phase4-380-arc`, because commits and rulings already cite it.
- **Phase 4's branches are now six:**
  1. sizes and tooling;
  2. tap targets (R138);
  3. the floor message;
  4. #286 and rule 169;
  5. rule 168's cards;
  6. #280.

## R139 (Ryan, 2026-10-12), verbatim

> Branch 1 accepted on your prod check. Go on branch 2 (tap targets, R138) as listed. Report before ship with 1440 and 360 screenshots, and a before/after table of every control's size. R139: add a Phase 4 branch after tap targets for the results page's device table, which is 421 px wide at 360 and widens the page. It must fit 360 with no sideways page scroll: stack or wrap the columns, or scroll inside its own box with a visible cue. Propose which in that branch's report, with screenshots, before building.

**Phase 4's branches are now seven:**
1. sizes and tooling (shipped);
2. tap targets (R138);
3. the device table (R139): fits 360 with no sideways page scroll; the choice (stack/wrap vs.
   scroll in its own box with a visible cue) is proposed with screenshots before building;
4. the floor message;
5. #286 and rule 169;
6. rule 168's cards;
7. #280.

## R140 (Ryan, 2026-10-13), verbatim

> Tap targets accepted on your prod check.
>
> R140: raise the near-intersection chip rows ("One (T-intersection)/Both", lanes "1–4") to 44 px at every width, per R107. The other desk sizes under 44 stay under rule 15. Fold this into branch 3 or ship it as its own light-lane branch, whichever is smaller.
>
> Mapbox wordmark: investigate only, no code. Find out why Mapbox's logo control set display:none (the style JSON, the token's account flags, or a Mapbox-side change since yesterday), and whether our plan with Mapbox still requires the wordmark under its terms. Quote the source. Report what you find.
>
> Then Phase 4 branch 3, the device table (R139): your stack/wrap vs scroll-in-box proposal with 360 screenshots, before building.

**R140 is its own light-lane branch** (`r140-ni-chips`, one CSS rule): branch 3 is proposal-first, so
folding R140 in would have held a finished change behind a ruling.

## R141 and R142 (Ryan, 2026-10-13), verbatim

> R140 accepted on your prod check.
>
> R141, device table (Phase 4 branch 3): A. Stacked blocks on phones only: name and quantity on the first line, then the labelled MUTCD code, then the function. MUTCD codes never break mid-code. The desk table stays as it is. Also fold in the nested-frame fix if it's phone-only CSS: give the disclosure content its width back at 360 so the 65 px isn't wasted. If that touches anything beyond the results disclosures, split it into its own branch. Report with 360 and 1440 screenshots of the results page, all disclosures open, and the go.
>
> R142, Mapbox wordmark: always show it, whatever the style data says. Mapbox's terms require the logo. Smallest change that keeps the logo control visible at every width, with a test. The wordmark is Mapbox's and is exempt from our 44 px rule. Light-lane branch, separate from branch 3; screenshots at 1440 and 360 with the satellite style, and the go.

**Order:** `r142-mapbox-wordmark` (light lane) first from main; `phase4-device-table` (R141) stacks
on its tip.

## R143 (Ryan, 2026-10-13), verbatim

> R143, the floor (supersedes R137 Q3's message and R138's floor):
> - Make the audit calculation row wrap at phone width: the MUTCD cite drops under the title, and the row fits 320 with nothing past the edge. Phone-only CSS.
> - With that, the supported floor is 320 px. No floor message: nothing below 320 is common enough to need one. 360×800 stays the one test size; add 320 as a fit check (no horizontal scroll at any stage) in the tooling and DESIGN-SPACING.md.
> - Fold in the results-page tap targets you found: the 8 pricing inputs and "Download Quote (XLSX)" reach 44 px at phone width.
> One branch. Report with 320 and 360 screenshots of results with all disclosures open, the before/after sizes, and the go.
>
> Then continue: #286 and rule 169, rule 168's cards, #280.

**Phase 4's branches now:** 1 sizes and tooling, 2 tap targets, 3 device table (all shipped);
4 the floor at 320 (`phase4-floor-320`, this ruling; replaces "the floor message"); 5 #286 and
rule 169; 6 rule 168's cards; 7 #280.

## R144 (Ryan, 2026-10-13), verbatim

> R144, #286 / rule 169 rulings:
> - Q1: (a). result_text on every calculation section, formula_text where there's a formula, and a citation object on the advance-sign section. The frontend renders only wire fields; its labels and the nDrums + nCones sum go (Rule 3).
> - Q2: keep the 11th-edition numbers and record #281 §2.8's 2009 numbers as superseded. The "MUTCD § 6B-1" footer counts as a found defect, so the citation counter goes to 20; record it in the rulings file. Check every citation the branch touches against its subject, with a page cite.
> - Q3: the calculation rows stay in "Checked & passed".
> - Q4: (a). A "Zone geometry" group in Reference, and the hero's geometry cell is not rendered at ≤480.
> - Q5: yes. The sight-distance text comes from the wire, using the audit's speed. The fixed "≥45 mph uses L=W·S" line stays.
> - Q6: two stacked branches as proposed. Rule 5 prediction committed first, and the 16 audit snapshots and 74 corpus files are listed in it. Each branch reports before ship.
> Add the CLAUDE.md counter (15 → 20) to the foreground-session list.

**#281 §2.8 is superseded (Q2).** #281 §2.8 cites the 2009 edition: §6C.08 (tapers), §6C.06
(buffer), Table 6C-1 (advance sign spacing). The 11th-edition numbers govern, each verified by
subject in `validation-artifacts/ta10_flagger/mutcd_part6.pdf` (untracked; the main checkout's local copy): §6B.08 Tapers with
Tables 6B-3 and 6B-4 (printed p. 775), §6B.06 with Table 6B-2 (pp. 773, 775), Table 6B-1
"Recommended Advance Warning Sign Minimum Spacing" (p. 773). Evidence, with every other citation
this branch touches: `issue-286/citations.md`.

**Citation counter: 19 → 20.** The defect: the audit panel's advance warning sign footer read
"MUTCD § 6B-1 · ADVANCE WARNING SIGN SPACING" (`conestruct/site/components/AuditTrail.tsx:853` at
`3fdf074`). 6B-1 is a table; the 11th edition has no § 6B-1. The previous count, 19, is recorded in
`../s2-arc13-demo-fixes/p775-verification.md`. `CLAUDE.md:32` still says 15; changing it (15 → 20)
needs a foreground session.

**Branches (Q6):** A, `issue-286-formula-fields`, from main `3fdf074`; B, `rule-169-geometry-home`,
stacks on A's tip.

## #286 A accepted; branch B's fold-in (Ryan, 2026-10-13), verbatim

> #286 A accepted on your prod check.
>
> Go on branch B (rule-169-geometry-home), from main c109778. Fold in the advance row's sign table at 360: it's cut off at the right edge, and its codes break mid-code ("W20-" / "1"). Make it fit 360 and 320 with codes kept whole, phone-only. Report before ship with 320, 360 and 1440 screenshots of results with all disclosures open, and the Reference "Zone geometry" group close up.
>
> Separately, draft an issue for the chat to repost: the sight-distance row's "Stations: 2 flagger station(s)" is counted by the panel from the form's AFAD switch, which is Rule 3 math in the frontend. Backend should send it.

**Branch B starts from main `c109778`** (A shipped and its branch was cleaned up), so it no longer
stacks on a live branch. Prediction and measurement: `rule-169/`.

## Ship hold (Ryan, 2026-10-13), verbatim

> Noted. Keep building rule 168's cards (and #280 after) in your worktrees, but don't ship anything until I tell you DESK is done and the main checkout is back on main. The stations issue: I'll post it from the chat.

## Rule 168 (Phase 4 branch 6): R145 self-ruled

R137 Q1 (verbatim above): "Rule 168 is open, narrowed to hiding the four cards at the narrow
width, with a "4 files" line under the zip."

**Found when measuring** (`rule-168/measure-before/`): the cards and the zip don't hold the same
files. The cards offer five downloads (plan sheet PDF, device list XLSX, crew PDF, crew .md,
audit PDF); the zip holds four parts (`BUNDLE_PART_KINDS`: plan PDF, XLSX, crew .md, quote). The
crew PDF and the audit PDF are not in the zip, and the zip renders only in the public sandbox
(`OutputCards.tsx`: `mode.kind === "public" && onDownloadAll`). Hiding the cards outright would
take two downloads off the phone, and every download off a saved plan's phone view (Rule 10).

**R145 self-ruled:** at ≤480 px, where the zip renders, the "4 files" line under the zip is a
disclosure; opening it shows the four cards. Closed by default. Where no zip renders (a saved
plan), the cards stay. The desk is unchanged.

Why this fits existing rules: rule 168's own text makes the line a disclosure ("plus a "✓ 4 files
ready" disclosure"); #288 clause 3 declined to build it only because then it would have restated
a count already on screen, and here it holds the cards. Rule 169 (R144 Q4) set the precedent that
what the phone hides stays reachable.
## #280 (Phase 4 branch 7): R145 self-ruled, not shortened

R137 Q5: "yes, inside Phase 4, measured first." Measured on production `72a602a`
(`issue-280/README.md`): "Freeway / interstate" wraps only in the setup box's value at 320
(+14 px, a clean break at the "/"), fits at 360 and 1440, and appears in no deliverable.
**R145 self-ruled:** not shortened; #280 closes as ruled-against, the outcome its own acceptance
names. Reasons in `issue-280/README.md`.
