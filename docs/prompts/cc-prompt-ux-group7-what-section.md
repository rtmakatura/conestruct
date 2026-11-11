# cc-prompt: UX group 7: the What section, guesses first

Ryan ruled this on 2026-11-11, on the "Tool page: What's the job" design canvas (https://claude.ai/artifact/Lp2LFXvNu8Muog9Bmn3ZFm).
- Boards: `B` (the pick: guesses first) and `D` (dropdown, why line, dates; these apply to B).
- `Main` shows today. `A` was not picked.
- Field values and the Denver hours text on the boards are placeholders. Real values and wording come from the backend (Rule 3, Rule 12).

This is one large mission item. Follow the mission rules in CLAUDE.md: two gate rounds at most, gates one at a time, targeted tests locally, and stop only for the park list or any change to a device count. File the issue yourself (R146). Commit the crops for Ryan's hand check.

## Why

- All ten fields carry the same weight, so the three guesses (Road type, Street class, Jurisdiction) get lost.
- Source labels are mono, dotted and jargon-heavy ("✓ measured", "⚠ from the road", tooltips like "OSM · 30 mph · measured").
- The header line "3 guesses marked ⚠ · change any that are wrong" is mono.
- The bottom row mashes two things into one mono line ("Denver windows · set dates to check   File details · ○ 2 not set   OPEN ›").
- The dropdowns are native OS lists (the jurisdiction list shows a serif system font), and the date field is a native "mm / dd / yyyy" input.

## Rulings (quote verbatim into rulings.md)

1. **The section's order and look follow `B`.**
   - The heading is "What's the job?" (19/600), with the line "We filled this in from the road you confirmed. Check our <n> guesses, then tell us about the work." The number comes from the backend's guess count. With zero guesses, the line drops its second clause and the guesses box doesn't show.
   - Then the "Check these <n> guesses" box (warn border, `--vd-flag-ground`). One row per guess: its label, a reason line, and its dropdown on the right.
   - Then "About the work": Type of work, Work hours, Speed reduction and Work dates, in a 2-column grid. The rows end together (#490's column rule).
   - Then one row, "Measured from the map", listing the measured values on one line (e.g. "30 mph · 2 lanes each way · 12 ft lanes · Divided") with a "Change" button. It opens in place to the measured fields as dropdowns.
   - Then one row, "File details (optional)": "Project name and location description. They print on the plan's title block. <n> not set." with "Show".
   - Inter throughout, sizes from group 1's scale, tokens only. No mono, no caps labels. Every control 44 px. The rule lines inside the guesses box use an existing token: no new hex (the mock's #3a3420 is not allowed).
2. **Guess reasons are real and come from the backend.**
   - Trace where each guess is made today and what it's based on. Each reason states that basis in plain words (e.g. "Based on the road's map tag", "Based on where your pin is").
   - Rule 12: no reason line without a source. Rule 10: if the backend has no basis to state, show "Our guess" alone. Never invent a reason.
3. **A checked guess stays put (P1).** When the user changes a guess or opens and confirms it, the row stays in the box. Its reason line becomes "Checked" with a check mark. Nothing moves or collapses by itself. Record how "confirmed" is stored, and whether it should survive reload (trace what saves today).
4. **The measured row and group 8.** Trace the Carriageway (One-way / Divided) field against group 8's road pick and side question. If the map window now sets it, it shows only in the measured row, read from that answer, and changing it there must agree with the map window (one voice per fact, P2). Record what you found and what you did.
5. **The why line (`D`, part 2).**
   - Each field's source line is plain Inter 12.5: "Measured from the map" (pass check), "Our guess. Check it." (warn triangle), "Default", "Not set yet".
   - Tapping it shows a plain-words reason, e.g. "The road's map record says the posted speed is 30 mph. If the sign on site says otherwise, change it here." It opens on tap and on keyboard focus plus Enter, and closes on Esc or a tap outside.
   - Remove "OSM" and every other piece of jargon from these tips. List each old string and its new one.
6. **Our own dropdown list (`D`, part 1).** Replace the native lists in this section with one shared listbox component. It uses Inter at 15, options at least 44 px, the selected option on `--pri-off` with a check, and keyboard support (arrows, Enter, Esc, type-ahead). Trace whether the page already has a listbox. Reuse it if so, and record it. axe must pass.
7. **Work dates (`D`, part 3).**
   - The native "mm / dd / yyyy" input becomes a 44 px button: "Pick start and end dates" (unset) or "Mon Nov 16 to Fri Nov 20" (set). It opens a styled date picker. Trace whether one exists; if none does, record what you used.
   - The line under it (unset) reads "Optional. We check them against Denver's work hours." Take the jurisdiction name from the data.
   - Once dates are set, the Denver hours result shows right under the dates, with a link "See all of <jurisdiction>'s work hours" that opens today's windows list. Every hour, day and reason in it comes from the backend's windows data (Rule 12). The board's wording is a placeholder.
   - The old "Denver windows · set dates to check" bottom row goes away.
8. **The rest stays.** Group 8's map window, Move, Edit on map, #469's band height and #490's column rule all stay as they are. Add this section's states to the permanent checks: band and columns, 44 px, and axe.
9. Every new string is listed with its source. No new hex. Unslop.

## Out of scope

The spacing round, and #292.

## Evidence

Capture at 1440, 1198x930 and 390:
- the section with 3 guesses, with 1 guess, and with none
- a guess changed (the "Checked" line, nothing moved)
- the measured row closed and open
- a why tip open, for a measured field and for a guess
- the dropdown open (jurisdiction)
- work dates unset, set and inside the hours, and set and outside the hours
- File details closed and open

Run axe and the 44 px measure, and commit the crops.
