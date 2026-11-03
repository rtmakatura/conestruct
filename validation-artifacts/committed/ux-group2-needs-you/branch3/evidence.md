# #437 branch 3: pre-go walkthrough (local), 2026-11-03

Run on `ux-group2-results` with G9 (`638434d`) and G10 (this commit) applied. Local `next dev` on the worktree. `MODAL_RENDER_URL` points at the local backend (`script/serve_replay.py`), which serves branch 1's confirm and not_there. Overpass is the real answer for the Denver Colfax pin, recorded once and replayed (`overpass-fixture/`). `/api/road-bearing` is stubbed with the three roads earlier missions used. The script is `script/walk.mjs` and the raw record is `walk/walk.json`.

The live Colfax answer asks **3 questions**, not the 2 the prompt expected: sidewalks (changed the plan), a bike lane, and an intersection. Ruling 4's order holds: sidewalks first.

| Check | 1440 | 390 |
|---|---|---|
| Order (ruling 1): NEEDS YOU, other conditions, Setup, Your plan, Downloads, disclosures | PASS | PASS |
| Strip: "Plan ready. Answer 3 quick questions before you send it." | PASS | PASS |
| Each question answered Yes and No; Next question | PASS (3/3) | PASS (3/3) |
| Undo Q1 and Q2 from their records; clicking the row reopens each | PASS | PASS |
| Apply answers: `/api/render/audit` requests per Apply | 1 | 1 |
| Device total before → after (sidewalks Yes, bike lane No, intersection Yes) | 40 → 38 | 40 → 38 |
| Downloads enabled at every step; a real file downloaded before answering and after Apply | PASS | PASS (behind the phone fold) |
| Warning row present until Apply, gone after (N = 0) | PASS | PASS |
| N = 0 strip after Apply: today's verdict wording ("VERIFIED · 4 PLAN FLAGS") | PASS | PASS |
| Setup line "… · 30 mph · 2 × 12 ft lanes · Urban street · Denver" (G9) | PASS | PASS |
| Gap from Setup to YOUR PLAN (G10): 153 / 285 px before the fix | 33 px (91 while staged) | 33 px (110 while staged) |
| Targets under 44 px in the results stack | 0 | 0 |
| axe | 1: `heading-order` on `#needs-you-h` | 1: same |

**The staged gap is content, not space.** From the first answer until Apply, the existing #254 staging row ("Previous answer: 1 correction staged, not yet applied.") sits between Setup and YOUR PLAN, which adds 58 px at 1440 (crop `1440-03-q1-no.png`). It repeats what the Downloads warning row says, in older wording, so it's a candidate for a later copy pass. It's not changed here.

**axe is not 0.** The NEEDS YOU `<h3>` follows the page's sr-only `<h1>` with no `<h2>` between them. That's the same on `main` (NeedsYou was already an `<h3>`), so this chain didn't introduce it. It's not folded in here: it's a page-wide heading-structure fix with its own churn.

**Not done:** the N = 1 render. Colfax gives 3 questions, and getting exactly one needs a different pin or a modified wire. The singular strings ("1 quick question", "before your answer") are pinned by unit tests on branches 2 and 3. Side-by-side composites with `OptionB.dc.html` weren't built; the crops in `walk/` are for Ryan's hand-check against the artboard.
