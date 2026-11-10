# cc-prompt: UX group 6 (the Generate wait) and a WHERE band that keeps one height

Ryan ruled this on 2026-11-08 on the "Tool page: Generate wait" design canvas: https://claude.ai/artifact/BA8AoGwLRmqCtrDxwFPiDm
- **Part 1, the Generate wait.** Option B as drawn on the board `LiveMotion.dc.html` ("On the live page"), plus the slow-step message from `A2Slow.dc.html` and the in-place update from `Updated.dc.html`. The traffic-cone animation is out: the map placeholder is the dimmed aerial with the sheen, as on `LiveMotion`.
- **Part 2, the WHERE band keeps one height.** From Ryan's screenshots on 2026-11-08: on desktop the band's box changes height between question 1 (kind) and question 2 (side).

Build this as two branches, one issue each, and ship Part 2 first, since it's small. Use the Platform UI arc mission rules: investigate first; commit `rulings.md` and `checkpoint.md`; stop only for the park list or any change to a device count. File the issues yourself (R146). Do a local walk with Overpass stubbed, and commit crops for Ryan's hand check. Send the gate header only to the site's own origins.

## Why

- **The wait:** after Generate, the results area reads "02 · RESULTS No package yet. The plan is being built." Then the sections appear and change size as each part arrives. #452 measured layout shift at 0.96 at 1440 and 1.73 at 390; under 0.1 is good. The free road service also makes some waits long, with no word on why.
- **The band:** P1 says nothing moves on its own. #456's walk measured shift on load but not between questions, so the band's outline jumps when the card's height changes.

## Part 1 rulings (quote verbatim)

1. **The outline of the real results.** The moment Generate is pressed, the results area draws an outline of every section the finished results will show, at its real size and in its real place:
   - the strip
   - NEEDS YOU
   - "N other conditions checked"
   - Setup
   - Your plan
   - Downloads
   - the search and reference sections

   Each outline matches its section's height closely enough that the swap moves nothing. Trace the heights from the real components and record how each one is known before its data arrives. If a section's height can't be known ahead, record the call, for example reserving the common height and letting it grow only downward, below the fold of what's in view.
2. **Each section swaps in as soon as its own data arrives**, in place. There is no remount, no height change and no jump. The order follows the real calls; trace them and record which call fills which section.
3. **The status line sits where the strip will be.** It has a spinner, the current step's name, "Step N of M" and a thin progress bar under it.
   - The steps are the real backend calls the page waits on, named in plain words, e.g. "Laying out the taper, buffer and devices…" and "Checking the road for sidewalks, bike lanes and intersections…". Trace each one (Rule 12), and show no step the page can't observe.
   - When everything is in, the real strip ("Plan ready…") replaces the status line in the same space.
4. **Placeholder look:**
   - Grey blocks (`--pri-off` or the nearest existing token) carry a soft sheen that sweeps across in about 1.4 s.
   - The map placeholder inside NEEDS YOU shows the WHERE aerial already loaded for this pin, at about 35% opacity and partly greyscale, with the same sheen over it and a small label, "Checking this stretch of road".
   - No traffic cones and no other moving icons.
5. **Arrival:** each section fades in over about 420 ms with a 6 px rise. With `prefers-reduced-motion`, there's no sheen, no fade and no rise; sections swap at once.
6. **A slow step (`A2Slow`):**
   - When a step runs past a threshold, its status turns to the warn look and says plainly what's slow, e.g. "The road data service is slow right now." Trace the threshold from today's timings and record it.
   - The cold-start case reuses today's honest copy (`SLOW_VERIFY_MS`), worded per group 1.
   - **"Finish without it"** goes in only if the backend can finish a plan without the scan and still ask every question the scan would have answered, with nothing guessed (Rule 10). Investigate. If it can't be done safely, leave the button out, record why, and file it.
7. **After an answer (`Updated`), Your plan changes in place:**
   - Each changed number shows its change and the reason, e.g. "+4" and "Was 39 · 4 added for sidewalks".
   - Unchanged groups say "Unchanged".
   - The header reads "Updated with your answers".
   - Every delta and reason comes from the backend (Rule 3). There's no remount and no jump.
8. **Target:** layout shift across the whole Generate, from press to "Plan ready", is under 0.1 at 1440, 1198 and 390. Measure it in the walk and keep the measurement as a permanent check (closes #452).
9. Follow group 1's rules: 44 px targets, only the ruled sizes, no new hex, unslop copy, and every string listed with its source.

## Part 2 rulings (quote verbatim)

1. **At two-column widths, the WHERE band is one height for every CONFIRM state.** That height is the tallest of its questions or the map's minimum, whichever is larger. Trace each question's height and record the tallest.
   - The aerial fills the left column at that height.
   - The CONFIRM card stretches to the same height. Its content stays at the top and its action row (Next question / Confirm) is pinned to the card's bottom.
2. **Moving between questions, undoing, and the found/failed tap states change nothing outside the card.** The band's outline, the aerial and the road row keep their size and place.
3. **The phone strip** (#456) is unchanged.
4. **Add a permanent check:** the band's height is identical (0 px change) across every CONFIRM state at 1440 and 1198.

## Out of scope

Group 7 (the What section), group 8 (the map window) and the spacing round.

## Evidence

Capture at 1440, 1198x930 and 390:
- **Part 1:** a frame sequence of one Generate (outline, each swap, the slow step forced, "Plan ready"), the layout-shift number before and after, reduced motion, and an answer changing Your plan in place.
- **Part 2:** the band at every CONFIRM state, with its measured height.

Run axe and the 44 px measure, and commit the crops.
