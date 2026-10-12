# Rulings: #317 (no crossing marked) and #316 (approach speed)

## R129 (Ryan, 2026-10-11), verbatim

> R128 polish accepted; no browser check needed for a cosmetic fix you verified on prod.
>
> R129, #317/#316 rulings (all as you recommended):
> - Q1: Before the crossing is marked, the side control shows the ⚠ line and Mark on map only, with no side chips.
> - Q2: The aerial uses the same backend line.
> - Q3: The cross-street speed becomes a select with "Not set", labelled "Cross-street speed".
> - Q4: WHAT's header counts the cross-street speed's ⚠.
> - Q5: One guess record per cross street.
> - Q6: The plan sheet NOTES gets the guessed-speed line. If the box would overflow, stop and report.
> Build issue-317-no-crossing, then issue-316-approach-speed stacked on it. Each reports before ship with screenshots at 1440 and 390 on N Broadway SB at E 11th Ave (39.73370, -104.98753): #317 before and after marking the crossing; #316 with an untagged residential cross street and a tagged one.
>
> R130: make the verifier's marker diff against main, so it covers the whole branch and not just uncommitted files. Small separate branch. If .claude/hooks is untracked or gitignored, say "needs a foreground session" instead.

**On the record:**
- **R130:** `.claude/` is gitignored (`.gitignore:76`), so `.claude/hooks/verdict_hook.py` is
  untracked: it needs a foreground session. No branch.
- **The checkpoint** these rule on is `checkpoint.md` beside this file (`4afebab`).

## R131 (Ryan, 2026-10-12), verbatim

> R131: fix the second voice on issue-317-no-crossing before ship. Until the crossing is marked, WHERE's "Which side is occupied?" row reads the same backend line ("Mark the cross street on the map to lay out the sides."), with no separate rail.SIDE_BLOCKER text. Add a test that the row and the side control show the same line. Re-run the verifier, update before-1440/390 screenshots, and give me the go.
>
> R130 is parked for a foreground session along with the CLAUDE.md R126 line and the handoff.md / execution-sequence.md updates.

**On the record:**
- **"No separate rail.SIDE_BLOCKER text"** is applied to both places that print it for this state.
  - **WHERE's side row** (`move-ledger.ts`).
  - **The rail's side rank** (`rail.ts`), which also feeds the disabled primary's reason once the
    kind is confirmed. That second place would otherwise have said "Say which side is occupied…" too.
- **A stored side doesn't answer the row** while the crossing isn't marked. The side control shows
  no chips then (R129 Q1), so a ticked row would be a second, contradicting voice.

## R132 (Ryan, 2026-10-12), verbatim

> R132, #316 NOTES: option (a). When both the road speed and the cross-street speed are guessed, the plan sheet prints one combined line: "ROAD AND CROSS-STREET SPEEDS GUESSED FROM THE ROAD CLASS. CONFIRM THEM ON SITE." When only one is guessed, print only that one's line. All 4 sign-schedule rows stay on the sheet in every case; add a test for that.
>
> Finish issue-316-approach-speed (tests, then the frontend per R129 Q3–Q5). Report before ship with screenshots at 1440 and 390 on N Broadway SB at E 11th Ave, plus an untagged-residential-meets-untagged-residential case, and the plan-sheet NOTES crops for all three guess combinations.

**On the record:** the stop that R132 answers is the WIP commit `2239658`, with its crops in
`notes-box/` (`probes/notes_render_probe.*`). With both lines, two SIGN SCHEDULE rows left the sheet.

## R133 (Ryan, 2026-10-12), verbatim

> #316 accepted on your prod check.
>
> R133, small polish branch (no checkpoint):
> - The cross-street speed marker matches every other row: "⚠ from the road" when guessed, "✓ measured" when tagged. The detail (OSM highway=…, not confirmed) moves to the row's details line, the same as the mainline speed.
> - The cross-street speed select starts at 20 mph, matching the mainline.
> Screenshots at 1440 and 390 on the three #316 cases, the verifier, and the go.
>
> Then #312 (lane closure near an intersection on a divided road signs one side only; S-630-1 Note 8). Investigate first, with a 📋 checkpoint before code: a payload-level repro, Note 8 quoted with its cite, the options, and the Rule 5 churn. Reuse #309's approach where it fits.

**On the record:**
- **The marker:** built (`r133-cross-speed-marker`). The row is the same `FieldCell` the mainline
  speed uses: one marker by the label, and the full line in its details.
- **20 mph: not built, raised for a ruling.** On a near-intersection plan the mainline select already
  starts at 25 (`what-cells.ts:173`, `speedMin: 25`), so the cross-street select (25–55) matches it.
  The backend floors both at 25: the mainline `NearIntersectionScenario.speed` (`schemas.py:882`,
  `ge=25`) and `IntersectionApproach.speed` (`:804`, `ge=25`). Offering 20 means lowering both
  floors, a spec change to the kind's speed range, not polish.
