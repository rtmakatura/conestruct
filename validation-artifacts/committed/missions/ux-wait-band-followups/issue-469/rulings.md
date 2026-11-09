# #469 rulings (resumed): Details on the kind question is a tooltip

Issue: https://github.com/rtmakatura/conestruct/issues/469. Mission `ux-wait-band-followups`, tracking https://github.com/rtmakatura/conestruct/issues/478.

The parked build's rulings stand as written: Ryan's Part 2 rulings 1-4 and B1-B8 in `validation-artifacts/committed/missions/ux-group6-wait-and-band/issue-469/rulings.md`. The one open item there was **B4b**, Details open on the kind question. Ryan answered it 2026-11-09, below.

## Ryan's answer to B4b (2026-11-09, via the mission brief, verbatim)

> **Details on the kind question is a tooltip per Part 2 ruling 5: reuse step 2's "from the road" tooltip component/pattern; it floats over the page; the band height never changes when it opens.** Also **confirm rulings 6–8 (one map frame, the mono line, the checks) are built**; if any is not, build it.

The full text of Part 2 rulings 5-8 is not in the repo. `cc-prompt-ux-group6-wait-and-band.md` § Part 2 rulings lists 1-4, and neither #469 nor #478 quotes 5-8. The brief names them by their subject only, so the status below goes by those subjects (R6).

This answer supersedes the parked B4b options (a), (b) and (d). None of them is built. Option (d)'s two CSS rules are removed.

## R145 self-rulings

- **R1 (R145 self-ruled). "Step 2's 'from the road' tooltip" is the WHAT band's details popover.** WHAT is the sandbox's step 2. Its "⚠ from the road" marker is the trigger of FieldCell's popover (`components/bands/FieldCell.tsx`: the `a-info a-pop` panel overlays the page, "nothing below it moves (P1)", opens on click / tap / Enter / Space and never on hover (rules 141, 142), and closes on a click outside or Esc, which returns focus to the trigger (R101)). The same pattern is already shared outside FieldCell as `useDetailsToggle` + the `a-info a-pop` panel (`components/InfoToggle.tsx`, #435 C3 / #436 D3: InfoToggle and the picked-road row's Details). The kind question reuses that hook and those classes. It doesn't build a parallel one.
- **R2 (R145 self-ruled). The toggle keeps its look and word: "Details", `nyq-details-btn`, 44 px.** The pattern being reused is the behaviour and the floating panel. The trigger stays the card's own text button: its 44 px floor is CONFIRM's (#437), and FieldCell's "i details" / marker triggers are 32 px on desktop. Changing the word would be a copy change no ruling asks for.
- **R3 (R145 self-ruled). Scope: the WHERE band's kind question, at every width.** `QuestionSteps` is shared with NEEDS YOU, so the floating Details is a prop (`detailsTip`) that only the WHERE adapter sets. NEEDS YOU's Details keeps its in-flow text, because the ruling names the kind question and nothing else. Whether it should float too is filed as https://github.com/rtmakatura/conestruct/issues/479. The ruling has no width limit, so the panel floats at 390 too. That makes the 390 card one height with Details open as well. It doesn't touch #456's strip (ruling 3): the strip is the aerial, and this changes only the card's text.
- **R4 (R145 self-ruled). The panel opens downward from the toggle (`.a-pop`'s own `top: 100%`, `left: 0`), over whatever is below the action row.** That is step 2's direction. Opening upward would cover the answers the details explain. In two columns, the action row is pinned at the card's bottom, so the panel floats over the band's foot and the page under it. No ancestor clips it (measured in the walk). The panel is a `<span>`, because the foot is a `<p>` (phrasing content). `.a-info`'s `display: grid` lays it out as InfoToggle's `<div>`.
- **R5 (R145 self-ruled). The panel closes when the question changes** (it is keyed by question id), matching the in-flow Details, which QuestionSteps closed on every move.
- **R6 (R145 self-ruled). Rulings 6-8, by the subjects the brief names, are built in the parked work and re-measured here:**
  - **6, one map frame.** In two columns the aerial frame is one box on every CONFIRM state (B2, B3: `--wq-band-h - --wq-line-slot`, 624.3 px at the same top). It is the same node throughout (no remount, the mounted test).
  - **7, the mono line.** The one line under the aerial (`p.a-aerial-line.tr-prov`, mono 10.5 px: the kind-owed sentence or the approach words) sits in the reserved slot under the frame (B2: `--wq-line-slot`), so its arrival or departure moves neither the frame nor the column.
  - **8, the checks.** The permanent check (ruling 4, B6): `WhereBand.one-height.test.tsx` (mounted states and CSS pins) and the re-runnable walk `script/walk469.mjs`. A CI layout check is #472.
  - If a ruling's full text asks for more than these subjects cover, this is the place it would differ. The coordinator holds the text.

Nothing here changes a device count, a wire field, a plan value or backend math (Rule 3). No new hex, no new type size, no new copy.
