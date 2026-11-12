# cc-prompt: UX group 7b: guesses box look, a steady Work dates row, the work-hours window, and a duplicate road in the map window

Ryan ruled this on 2026-11-11, on the "Tool page: What's the job" design canvas (https://claude.ai/artifact/Lp2LFXvNu8Muog9Bmn3ZFm), after his hand check of #517.
- The board to build from is `Demo` (it works: open it full-size and click through). `Colors2` 3c and `TimelineColors` C2 show the picked looks.
- Every hour, day and rule on the boards is a placeholder. Real ones come from the backend's work-window data (Rule 3, Rule 12).

Two mission items: item 1 is the large one. Follow the mission rules in CLAUDE.md: two gate rounds at most, gates one at a time, targeted tests locally, and stop only for the park list or any change to a device count. File the issues yourself (R146). Commit the crops for Ryan's hand check.

## Why

- Ryan dislikes the mustard fill on the guesses box.
- Setting work dates makes the middle row of "About the work" taller, and opening "See all of Denver's work hours" makes it taller again. Rows must not change height (P1, #490).
- With dates set (and start and end time "Not set"), the line still said "set dates to check".
- The hours list is hard to read in that small space.
- Separately, at 39.7401, -104.9811 the map window lists "Pennsylvania Street" twice (3 m and 26 m from the pin).

## Item 1 rulings (quote verbatim into rulings.md)

1. **The guesses box is 3c.**
   - A 3 px `--warn` strip along the top edge.
   - The heading row ("Check these <n> guesses") sits on `--pri-off`, with "<k> of <n> checked" on its right in `--ink-mute`.
   - The rows sit on `--da-ground` with hairline rules. There's no mustard fill (`--vd-flag-ground` is no longer used here).
   - Unchecked reason lines are `--ink-mute` with the small warn triangle. Checked lines read "Checked" in `--pass` with a check mark.
   - Everything else from #517 stays: real reasons, nothing moves when a guess is checked, and the shared dropdown.
2. **The Work dates row never changes height.**
   - The Work dates cell holds the date button and one result line, with room reserved for two lines in every state. Write each state's text to fit in two lines at 390.
   - The result line says exactly what's missing or what's wrong, in one of these states:
     - no dates: "Optional. We check your dates and times against <jurisdiction>'s work hours."
     - dates, no times: "Add a start and end time to finish the check."
     - fits: check mark, "Fits <jurisdiction>'s work hours on every day."
     - outside: an orange (`--dim`) mark and a plain sentence naming the problem, e.g. "Starts before 9 am on weekdays." and/or "Nov 7 and 8 are a weekend: no closures."
     - no data for that jurisdiction: "We don't have <jurisdiction>'s work hours yet, so we can't check your dates." (Rule 10)
   - All the times, days and wording come from the backend's window data.
   - The inline windows list goes away. A row of its own under the grid reads "<jurisdiction> limits when you can close a lane." with the link "See <jurisdiction>'s work hours". With no data for the jurisdiction, the row says so and has no link.
   - Add these states to #490's columns check.
3. **The "set dates to check" bug.** Trace why the check didn't run with dates set. If it was waiting on start and end times, the fix is ruling 2's "Add a start and end time" line. If it's something else, fix it, and add a test that fails on the old code. Record the cause.
4. **The work-hours window (`Demo`, opened from the link).**
   - A real dialog: focus moves in, Tab stays inside, Esc and Close close it, and focus returns to the link. It is one fixed size in both views.
   - The title is "<jurisdiction>'s work hours". The line under it gives the street class and, when set, "Your hours: <start> to <end>."
   - A two-option switch: "A weekday" and "The whole week".
   - **A weekday (T6):**
     - A ruler from 5 am to 9 pm.
     - The allowed window is a band on `--pri-off` with an `--act` border, labelled with its start and end above.
     - Your hours are a line on top: `--ink` inside the window, `--dim` outside it.
     - A plain verdict sentence.
     - When your hours fall outside, a button "Change my hours to <window start> to <window end>". It sets the page's start and end times and shows group U's Undo link (P15).
     - One line for weekends.
   - **The whole week (T7):**
     - Days across and hours down, for the job's first week.
     - Each day shows its allowed band and your hours, colored the same way.
     - Days with no closures allowed are striped (`--da-ground` / `--pri-off`).
     - Days outside your dates are dimmed.
     - A line under the grid says how the job's dates relate to the week.
   - A legend ("Allowed", "Your hours", "Outside what's allowed") and a "Source: <rule name and date>" line from the backend.
   - Trace and record:
     - night work and an end before the start (past midnight)
     - jobs longer than a week
     - whether the backend has holidays (show them only if it does)
     - changing Street class or Jurisdiction while the window is closed (the window and the line must use the new values)
5. Inter only, group 1's sizes, tokens only, 44 px targets, axe clean. List every new string with its source. No new hex. Unslop.

## Item 2: one road listed twice (file it first)

At 39.7401, -104.9811 (Colfax and Pennsylvania), the map window lists "Pennsylvania Street" twice, 3 m and 26 m from the pin. Group 8's ruling 2 said one entry per street.
- Trace which OSM ways make the two rows, and why one reads 26 m when the pin sits at the intersection.
- Check whether "Traffic both ways" is right for Pennsylvania there (Rule 12).
- **Ruling:** the backend groups every way with the same name that connects or runs along the same line into one entry, at the distance of its nearest way (Rule 3). When the pin is at an intersection with that street, the line under it adds "at <cross street>".
- If the plan needs to know which way the work runs from the corner, record where that's decided today. Don't guess.
- Add a test with this pin.

## Out of scope

The spacing round, #523, #522, #514, #292.

## Evidence

Capture at 1440, 1198x930 and 390:
- the guesses box with 0, 1 and 3 checked
- the Work dates row in all five states, with #490's check reading 0 px
- the hours window in both views: fits, outside (with the fix button, then after it and the Undo link), a weekend in the dates, and night work
- a jurisdiction with no data
- the map window at 39.7401, -104.9811 before and after

Run axe and the 44 px measure, and commit the crops.
