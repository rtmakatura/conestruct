# #446 checkpoint: the investigation, the churn prediction, the principles

Base: `origin/issue-443-prod-check` at `618f7ba`. The branch carries that commit, the #443 production-check evidence (docs only, no code), so it ships with this fix.

## Investigation (the prompt's item 1)

- **Where the lookup's states live.** `lib/cross-street-mark.ts` (`useCrossStreetMark`, owned by `GeneratorSidebar`): `phase` (`idle`, `resolving`, `none`, `error`), `rearmed`, and `pixel` (the found tap, shown as the box). The tap's pixel wasn't kept while the lookup ran, so nothing could draw at it before an answer.
- **How the card and aerial share them.** `WhereBand` holds the mark and hands it to both. It computes `armed` and `aerialMark` for `BandAerial`, and passes `crossMark` to `WhereQuestions`, which renders the finding, ✓, none and failed rows. Before this change the bar existed only while `armed`, with `AERIAL_TAP_BAR` as its one text (`BandAerial.tsx:75`, `:279`), so it vanished the moment a tap was made.
- **Can the scroll fight the band's layout?**
  - The page scrolls on the window. No pane in the workbench has its own vertical scroll (`overflow-y` appears nowhere in `globals.css` for it), and the frame's `overflow: hidden` only clips the picture.
  - `BandStack`'s scroll (`components/BandStack.tsx:187-202`) runs on band transitions only, and a tap isn't one. `lib/landing.ts`'s re-issues belong to Generate and to that transition.
  - The aerial doesn't change height across the bar's states: the frame is fixed (300 px, 250 at 480 and under) and the bar sits over the picture.
  - The finding row and the ✓ row share `min-height: 68px` (#440 ruling 6). The row's second line and the summary line both lengthen when the nearest-intersection read answers; in the first walk, on code since changed, that moved the button 37.5 px at 390 after the scroll was computed, so the scroll waits for that read (T15).
  - The mark's write re-reads geometry, and #440 X5 already keeps the pin picture still through that.
  - The scroll runs once per found tap, keyed on `foundCount`, after the commit that has the row. Later reads of the same mark can't re-fire it (mounted test).
  - `html { scroll-behavior: smooth }` applies only under `.cs-page` (`globals.css:7404`), so the jump isn't smoothed by it; the code asks for `instant` anyway, since `auto` would defer to that CSS.
- **Motion.** `lib/design/motion.test.ts` (R10) fails any new `@keyframes`: T1. The scroll itself is ruled (ruling 3) and sits under the same reduced-motion check as `BandStack`'s.

## Rule 5 churn prediction (made before the diff)

**The branch carries `618f7ba`** (#443's production-check evidence, docs only).

**Changes:**
- `lib/cross-street-mark.ts`: adds `ring` and `foundCount` to the mark; the lookup itself is untouched.
- `components/bands/BandAerial.tsx`: the bar gets five states, `role="status"`, the ring and a bar Try again. The big-map button shows whenever the bar does (T5).
- `components/bands/WhereBand.tsx`: computes the bar and ring.
- `components/bands/WhereQuestions.tsx`: the scroll and focus effect; the row's name becomes an `h4`; `role="status"` leaves the three card lines (T3).
- `lib/cross-street-reveal.ts` (new): the least-scroll helper and the `CHOSEN` margin.
- `app/globals.css`: the found and warn looks, the ring, the bar's 44 and 64 px heights, the steps under it. No new hex, no new size, no `@keyframes`.
- `components/GeneratorShell.cross-street-tap.test.tsx`: four existing assertions now read the bar's words: three said it was absent (at Try again's finding, at found, after Cancel), and Move's `not.toBeNull()` now reads the re-armed text. The rest of the file only gains tests.

**Amended before the diff that made them (R154's fold test; both from the first walk at 390):** the row's layout at 480 and under (`globals.css`, T16), and the scroll waiting for the nearest-intersection read (`WhereQuestions.tsx`, `lib/cross-street-reveal.ts`, T15). The first bar height (64 px in every state) is replaced by T10's.

**Amended before the repair's diff (review cycle 1, findings 1-2):**
- `lib/cross-street-reveal.ts`: the scroll also reads the aerial's top and never pushes it past the nav, so the bar's words stay readable (T8, T19). `--pin-h` leaves the row's `scroll-margin-top`; only the nav is pinned on this page.
- `components/bands/WhereQuestions.tsx`: the explanation paragraph leaves the card once the card has a finding or ✓ row (T18; withdrawn in cycle 2, below).
- The summary row stays: #439 ruling 1 orders it there, and hiding it would reverse a Ryan ruling. The gap it leaves is recorded as a departure (T8).
- `globals.css`: the row's budget, and two comment corrections. Tests: the mounted stub gains the frame's rect; new tests for the cap and the paragraph.

**Amended before the second repair's diff (review cycle 2):**
- `lib/cross-street-mark.ts` and `components/GeneratorSidebar.tsx`: a picker save, or the pin or crossing changing, clears the tap's failed or "no street" answer (T20). `GeneratorSidebar.tsx` joins the diff, 1 line.
- `components/bands/WhereQuestions.tsx`: T18 is withdrawn, so the paragraph is back in every state it had in #440. That line returns to #440's text.
- `lib/cross-street-reveal.ts`: the cap reads the bar's words rather than the frame's top, and doesn't apply once the words are already under the nav (T19). The row's `scroll-margin-top` is the nav's height alone.
- Tests: T18's come out; the mounted stub's rect moves to the bar's words; new tests for T20 and the cap.

**Stays byte-identical:**
- Everything on the wire: no new field, no new request, no plan output change. The mark's writes, Undo's byte-for-byte restore and the picker's Save are the same code.
- The backend (no file under `src/`).
- The aerial's image requests: the frame's size doesn't change.
- `QuestionSteps.tsx`, so #437's NEEDS YOU card doesn't move.

**Visible to anyone not tapping:** the armed bar is 8 px taller (36 to 44), with Edit on map and zoom stepped down to match (T10). The picture under it is the same. At 480 and under the ✓ row's buttons sit on their own line (T16).

## Principles (`DESIGN-PRINCIPLES.md`), for the bar, the ring, the scroll and the ✓ row

Surface: FLOW.md's setup step, for the rep or estimator placing the work at a crossing, often on a phone.

| Rule | State | How |
|---|---|---|
| P1 | Deviates by ruling, and honours the rest | Ruling 3's scroll is movement the user asked for only indirectly; Ryan ruled it, it's the least that shows both, and it fires once per found tap. Everything else stays still: the ring and bar sit over the picture, Edit and zoom don't move across the bar's states (measured). Recorded: the finding, failed and none lines appear in the card and move its button when they do (#440), so the button moves when they do. `BandAerial.tsx` ring and bar; `globals.css` `.a-aerial-bar`. |
| P2 | Honours, one recorded overlap | The bar is the one live region (T3). The bar and the card both show the state by ruling, read from one `phase`, so they can't disagree. |
| P3 | Honours | This is the issue: the answer is on the map at the tap, and found brings the next step into view. |
| P4 | Honours | The bar's button shares the bar's right edge; the ring and box centre on the tap's pixel. |
| P5 | Honours | 13.5/600 as #440's bar; no new size. |
| P6 | Honours | The long sentences wrap in the bar, over the picture, clear of the buttons (T10). |
| P7 | Not applicable | Nothing new writes; the tap's write is #440's. |
| P8 | Deviates by ruling | P8 says to say a wait once, in one place. "Finding the street name…" shows in the bar (ruling 1) and in the card's row (#440 ruling 6), so it's said twice on screen; the bar alone is live (T3). Nothing is covered but the bar's own strip; zoom and scrolling stay live. |
| P9 | Honours | ✓ and ⚠ with words; the outline's hue is never alone. The arc goes with the words "Finding the street name…". |
| P10 | Honours | Try again 44 px; big map, Edit and Move/Undo unchanged. Measured in the walk. |
| P11 | Honours | Tokens only: `--act-bright`, `--pass`, `--warn`, `--vd-ready-ground`, `--vd-flag-ground`, `--act`, `--on-act`, `--ink`, `--da-ground-rgb`. |
| P12 | Ryan's hand check | Crops committed. |
| P13, P14 | Not applicable | |
| P15 | Honours | Undo unchanged, byte-identical; the ring clears with it. |
| P16 | Honours | One busy signal to assistive tech. The card's visible finding line stays #440's (ruling 6) and the bar says the same fact, as ruled; recorded under P2. |
| P17 | Honours | FLOW.md setup, the rep or estimator at a crossing. |
| P18 | Honours | Next question stays the card's primary; Try again is primary only when it's the one thing to do. |
| P19-P20 | Not applicable | |
| P21 | Honours | What they tap is where the answer appears. |
| P22 | Not applicable | |

Rule 3: nothing computes a plan value; the scroll is layout. Rule 10: a failure says so on the map; no box is drawn before a street is named. Rule 13: glyph plus word in every state.

## Prediction against what happened

Files and stay-identical list as predicted, with the amendments above. Before the repair: tracked code 6 files, +609/-38 (about 280 of the additions are the test file), plus `lib/cross-street-reveal.ts` and its test. Existing tests changed: four assertions (the prediction first said three; Move's tightened assertion was the fourth). No other test needed a change; the type census caught one undeclared `font-size`, fixed in the CSS (T17), so the census file is untouched. No file under `src/`. The repairs changed what their amendments named and nothing else: the scroll's cap (T19), the row's budget, T20's clear, comments, and tests. T18 went in during cycle 1 and came out in cycle 2, so `WhereQuestions.tsx`'s explanation line is #440's again. After cycle 2: tracked code 7 files, +706/-40, plus `lib/cross-street-reveal.ts`, its test and `lib/cross-street-mark.answer.test.ts`.
