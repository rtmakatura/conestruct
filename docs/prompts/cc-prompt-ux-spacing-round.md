# cc-prompt: UX spacing round: night work on a 6 am to 6 am chart, three work-hours window fixes, four page fixes

Ryan ruled this on 2026-11-24, on the "Tool page: spacing round" design canvas (https://claude.ai/artifact/8ZWjnqTf5Xvx2RvgHzrZtS). He picked option B on board 1 and made no other changes.
- The "before" shots are in `validation-artifacts-extra/spacing-round-before/` (see its `index.md`). Re-run its `script/` for the "after" set.

Three mission items: item 1 is the large one. Follow the mission rules in CLAUDE.md: two gate rounds at most, gates one at a time, targeted tests locally, and stop only for the park list or any change to a device count. File the issues yourself (R146). Build on the newest evidence branch (`issue-554-prod-check` unless a newer one exists) so it ships with this. Commit the crops for Ryan's hand check.

## Item 1: night work is drawn on a 6 am to 6 am day (board 1, option B)

- **Why:** an 8 pm to 5 am shift is almost invisible today. The week view and the weekday ruler run 5 am to 9 pm, so only tiny marks show at the bottom edge.
- **Ruling:**
  - Both the week view and the weekday ruler always run from 6 am to 6 am the next morning (24 hours), for every job.
  - Ticks at 6 am, noon, 6 pm, midnight and 6 am. "Midnight" is set slightly stronger, with a faint dashed line across each day.
  - Allowed windows and your hours that cross midnight draw as one continuous band or bar.
  - The colors, states and the inside/outside split stay exactly as #526 and #535 left them (C2).
  - Hours before 6 am belong to the day they're scored against, per the overnight note #526 recorded. Trace that, and record how the 6 am edge is handled.
  - Leave #533 (Castle Rock scoring) alone.
- Add the night shift (8 pm to 5 am) and a day shift (9 am to 3 pm) to the walk, in both views.

## Item 2: three fixes in the work-hours window (board 2)

- **a.** The key gains "No closures allowed", with a small striped swatch matching the striped days. It shows only when the week has a no-closures day.
- **b.** When no street class is set, your hours draw as a dashed outline (not checked yet), not the solid "inside" ink. A notice at the top of the chart reads "Pick a street class on the page and we'll check your hours against it." This covers the rest of #535.
- **c.** At 390, the week note under the chart must never be cut off.
  - Shorter wording: "Your dates: <Mon Dec 7> to <Fri Dec 11>. <Sat and Sun> aren't in them." (and "the whole week" when they are).
  - The window body scrolls when it still runs long, with the last line fully visible. This closes the first part of #534.

## Item 3: four page fixes (board 3)

- **d.** The closed Where row's "CHANGE" becomes "Change": Inter 13.5/600 in `--act`, a 44 px target. No mono, no caps.
- **e.** The small aerial's + and − become 44 x 44, matching the map window's.
- **f.** "See <jurisdiction>'s work hours": 8 px more space above it, so its focus ring clears the line above (#534's second part).
- **g.** The three "Default" links in About the work reach 44 px wide by padding only, with nothing else moving.
- Also from #534 and #535: fix the stale "R145 S9" comment in `WorkHoursDialog.tsx`, and make the ▾ marks at the bottom of the week columns readable. If they're no longer needed with the 6 am to 6 am chart, remove them and record that.

## All items

Inter only, group 1's sizes, tokens only, no new hex, 44 px targets (apart from #505's exception), axe clean. Rows and columns don't change height (#469, #490). List every new string with its source. Unslop.

## Evidence

Re-run `validation-artifacts-extra/spacing-round-before/script/` for the matching "after" shots at 1440 and 390, plus 1198x930 for the new states. Add the night and day shifts in both views. Run axe, the 44 px measure and the columns check, and commit the crops.
