# cc-prompt: UX: keep the WHERE map in view, make it feel instant, and fix the "kind of work not chosen" text

Ryan ruled this on 2026-11-07 on the "Tool page: tap feedback and aerial help" canvas (https://claude.ai/artifact/UnXwW9LvUDmFLDwraGXqKA), bottom row:
- **Desktop:** Option B (`MapSideB.dc.html`).
- **Phone:** the pinned strip (`MapSticky390.dc.html`).
- `MapStickyA` was not chosen.

This builds on #439, #440 and #446 (the WHERE band, the CONFIRM card and the armed aerial). Platform UI arc, mission rules: file the issue yourself (R146), commit `rulings.md` and `checkpoint.md`, and do a local walk with Overpass stubbed and crops for Ryan's hand check before the ship go. Send the gate header only to the site's own origins (#450's walk helper).

## Why

Ryan's report, 2026-11-07, at 1198x930:
- When the CONFIRM questions open, the page sits so the aerial is mostly scrolled off. He has to scroll up to see the map the question is about.
- Every answer, before and after, waits for a new aerial to load, which feels clunky.

## Rulings (quote verbatim into rulings.md)

1. **Desktop layout (Option B):** while the WHERE band is open on a wide screen, the aerial sits on the left at full band height and the road row and CONFIRM card sit on the right, so the map never scrolls away while you answer.
   - Pick the width where two columns start, record it, and reason from the page's real column width (today about 788 px). Below that width, use ruling 2.
   - The aerial keeps everything #440 and #446 put on it: the tap bar, ring, box and label, Edit on map, Use the big map instead and zoom.
   - Once WHERE is confirmed, the band goes back to its collapsed one-row look.
2. **Narrow layout (the pinned strip):** below that width, while the CONFIRM card is open, the aerial pins under the site's top bar as a short strip (about 150 px at 390), above the card. It has a 44 px "Hide map" button that collapses it to a "Show map" row.
   - Hidden or shown, the choice holds until WHERE is confirmed.
   - The strip unpins when the card closes.
   - When a question needs a tap (the intersection), the strip grows to the full aerial height and #446's tap feedback applies unchanged.
   - Check how the strip and #446's scroll-into-view work together, and record it (P1: nothing jumps on its own).
3. **No waiting between answers:**
   - **Keep the old map:** the current aerial stays on screen until the next one has fully loaded, then swaps in one step. There's never a blank box or a reserved empty space.
   - **Load ahead:** when a CONFIRM question opens, request in the background the aerials its answers would produce (each side choice, each kind of work), at most one per choice, and never for a tap question.
   - **Remember:** an aerial already shown for a given state comes back from cache straight away (e.g. after Undo).
   - Trace how many extra Mapbox images loading ahead costs per plan and record it against the free 50,000 a month (#447 already adds about 2).
   - If loading ahead would add a backend Overpass read per choice, don't load ahead for that state, and record it. Road data stays at one read per state.
4. **Fix the wrong status text:** while the kind of work is chosen but WHERE isn't confirmed yet, the WHAT row reads "pending: kind of work not chosen" and the Generate hint reads "Choose the kind of work". Both are wrong. The row becomes "Opens after you confirm where" and the hint becomes "Confirm where the work is first". Trace every state of both strings, make each one true, and list them.
5. Group 1's rules: 44 px targets, only the ruled sizes, no new hex, unslop copy, and every new string listed with its source.

## Out of scope

A live Mapbox GL map (the parked `issue-162-mapbox-browser-token` branch), the picker modal (group 8), Undo links and #448–#451.

## Evidence

Run locally with Overpass stubbed, at 1440x900, 1198x930 (Ryan's screen), 1024x768, 390x844 and 390x664:
- each CONFIRM question with the map in view
- the intersection tap in both layouts
- Hide map and Show map
- answering a side, a kind and Undo, with time-to-new-map before and after (network log)
- the two fixed strings in each state

Also run axe and the 44 px measure, and measure layout shift for the band. Commit the crops.
