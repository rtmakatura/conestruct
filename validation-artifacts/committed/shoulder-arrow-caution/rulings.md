# shoulder-arrow-caution — the rulings this arc is built under

**Issue:** not yet filed. The draft is in `checkpoint.md` for the chat to repost; this branch and folder are renamed to the issue number only if Ryan asks (the #308 precedent renamed the branch once filed).
**Arc:** split out of #300 by R119 Q1; built and shipped before #300.
**Base:** `aa6dcaa` = `main` = prod `/healthz` (read 2026-10-08).

This file is the arc's authority; every commit on this branch cites it.

---

## R119 (Ryan, 2026-10-08), rulings on the #300 build checkpoint (`d2437f0`), verbatim

> R119 (Ryan, 2026-10-08), rulings on the #300 checkpoint:
> Q1: Separate issue, fixed first. Draft it for the chat to repost, then build it: every shoulder arrow board in caution mode, crew sheet and page 1 to match, quoting MUTCD 11th Ed. §6L.06 ¶18 (p. 833) and S-630-1 Note 26. #300 builds after it ships.
> Q2: Yes, flip page 1 together, text upright, dimension labels to the open side, yellow line stays on the top lane edge. Marked CHOSEN under R81.
> Q3: Yes, "Case 11 (right-shoulder closure, mirrored to the left shoulder of a one-way street)", mirror marked CHOSEN, plus a pending-verification note.
> Q4: Yes, backend refuses with a message naming the fix; the side picker shows it; no frontend reset.
> Q5: Yes, offer left only when the verdict is one-way street AND the road is tagged one-way.

Q1 is this arc. Q2-Q5 are #300's and are recorded in `issue-300-left-side-oneway/rulings.md`.

## The finding, as tabled (`issue-300-left-side-oneway/checkpoint.md`, build checkpoint, item 4 and Q1)

Both shoulder generators place an arrow board labelled `RIGHT_ARROW` (`src/generation/layout.py:381`, `:746`), page 1 draws it as a right arrow, and the crew sheet says "Set to RIGHT ARROW mode (for right shoulder closure)" (`src/narrative/templates/base.md.j2:43`). MUTCD 11th Ed. §6L.06 ¶18 (Standard, p. 833) and CDOT S-630-1 Sheet 2 General Note 26 allow only caution mode for shoulder work.
