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
