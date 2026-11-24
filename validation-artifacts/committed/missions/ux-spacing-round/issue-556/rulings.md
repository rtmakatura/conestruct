# #556 rulings

Mission `ux-spacing-round` (tracking issue #558), item 2. Base: `issue-555-six-to-six-chart` at `d46b0914`.

## Ryan's ruling (2026-11-24), word for word

From `docs/prompts/cc-prompt-ux-spacing-round.md`, "Item 2: three fixes in the work-hours window (board 2)":

> - **a.** The key gains "No closures allowed", with a small striped swatch matching the striped days. It shows only when the week has a no-closures day.
> - **b.** When no street class is set, your hours draw as a dashed outline (not checked yet), not the solid "inside" ink. A notice at the top of the chart reads "Pick a street class on the page and we'll check your hours against it." This covers the rest of #535.
> - **c.** At 390, the week note under the chart must never be cut off.
>   - Shorter wording: "Your dates: <Mon Dec 7> to <Fri Dec 11>. <Sat and Sun> aren't in them." (and "the whole week" when they are).
>   - The window body scrolls when it still runs long, with the last line fully visible. This closes the first part of #534.

And "All items":

> Inter only, group 1's sizes, tokens only, no new hex, 44 px targets (apart from #505's exception), axe clean. Rows and columns don't change height (#469, #490). List every new string with its source. Unslop.

## R145 self-ruled

### a. The key

- **R145 self-ruled S1. The entry shows exactly when stripes are drawn.** The stripes are drawn in the whole-week view on every day whose day kind the backend marks `no_closures` (`WorkHoursDialog.tsx:553` on the base, in the job or not). The key entry uses the same test, so it shows in the whole-week view when at least one of the seven days is striped, and never in the weekday view (which draws no stripes). This follows the "No record" entry's rule (#526 round 2, R145 S10: it "joins the key only when a day shows it"). It is appended after "No record", so the entries already there keep their order.
- **R145 self-ruled S2. The swatch (CHOSEN, Rule 12).** The same two tokens and the same 135 degree angle as the days' stripes (`.whd-closed`: `--da-ground` and `--pri-off`), in the key's 14 x 10 px box, with a 1 px `--rule-soft` border (the day column's own border). The stripes are 3 px wide where the days' are 6 px: CHOSEN, because one 12 px stripe pair doesn't fit a 10 px tall box, and at 3 px two pairs do. No new hex.

### b. No street class

- **R145 self-ruled S3. "Not checked" is read from the backend's answer.** A day kind's `allowed` is null "when a class-scoped window needs a street class" (`conestruct/site/lib/jurisdiction.ts:76`, the wire type's own comment). The window already reads that field for the day's screen-reader sentence ("Needs a street class."). So on a day with a record whose `allowed` is null, your hours take the not-checked look. Nothing is scored in the frontend (Rule 3). A no-record day keeps taking it, as #531 S24 left it.
- **R145 self-ruled S4. One look for "not checked".** The dashed outline is the hollow bar #531 S24 already gave no-record days (`.whd-yours.is-unchecked`: no fill, a 1 px dashed `--ink-faint` border). Both states mean "these hours weren't checked", so they share it. It differs from the inside and outside bars by shape (hollow and dashed against solid), not by hue alone (Rule 13).
- **R145 self-ruled S5. The notice replaces the old line.** "Pick a street class on the page to see its hours here." (`SET_CLASS_TO_SEE`, `why-lines.ts:848` on the base) is replaced by the ruled sentence, and the constant is removed. I found no reason to keep both: the new sentence names the same action, and the window's subtitle already says the hours aren't known ("Street class not set, so the hours for it aren't known."). In the weekday view the notice sits where the old line sat, above the ruler. In the whole-week view it is a new line above the columns, shown when a day with a record needs a street class. It is plain text in the window's existing line role (`.whd-line`), read by screen readers in order.
- **R145 self-ruled S6. Outside spans are still drawn as the backend sends them.** With no street class the backend sends no outside spans, so no bar takes the outside ink. The window doesn't hide or add any.
- **R145 self-ruled S7. No key entry for the dashed outline in this item.** The ruling gives the dashed outline its words in the notice. A key entry for it would also appear in every week with a no-record day in the job (any Denver job that includes a weekend), which is a change to a shipped state the ruling doesn't name. Filed as a follow-up (see the end of this file).

### c. The week note

- **R145 self-ruled S8. The strings.** Dates are written by `shortDate()` ("Mon Nov 16", `why-lines.ts:941` on the base). Each case:
  - Part of one week (ruled): "Your dates: Mon Dec 7 to Fri Dec 11. Sat and Sun aren't in them."
  - The whole week (ruled: `and "the whole week" when they are`): "Your dates: Mon Dec 7 to Sun Dec 13, the whole week."
  - A one-day job: "Your date: Wed Dec 9. No work on the other days." One date, so "date"; six day names in a row would be a list, not a sentence. Reworded in gate round 2: round 1 had "The other days aren't in it.", and days "in" a date reads oddly.
  - More than one week: "Your dates: Mon Nov 16 to Fri Dec 4. This is the first week; every week has the same hours." The second sentence is unchanged; only the opening takes the ruled form, so every case starts the same way.
  - No dates: "Pick work dates on the page to see your days here." Unchanged.
- **R145 self-ruled S9. Naming the days that aren't in the dates.** Days are named Mon to Sun in week order. Three or more in a row are written as a range ("Mon to Wed"); one or two are named singly. The list joins with commas and a final "and". One day takes "isn't", more take "aren't". So: "Sat and Sun aren't in them.", "Sun isn't in them.", "Mon, Tue, Sat and Sun aren't in them.", "Mon to Wed, Sat and Sun aren't in them.", "Mon to Fri aren't in them." Which days are in the job is the backend's `in_job`, per day.
- **R145 self-ruled S10. Room for the note at 390 (CHOSEN, Rule 12).** The ruled wording is two lines at 390, as the old wording was (the body is 324 px wide there), so wording alone doesn't end the cut: on the base the body is 342 px tall and the week view with a two-line note is 357 px (`issue-555/measures-390.json`, `555-day` week). No row inside the window can give 15 px back without changing a height the rules hold fixed. So at widths of 600 px and under (the file's own phone breakpoint) the window is 640 px tall, not 600. CHOSEN: 40 px is two more lines of the note at 13.5 px and 1.45 line height (39.15 px), so a three-line note also fits. #526's ruling 4 ("It is one fixed size in both views.") holds: at any one width both views are the same size. Above 600 px wide nothing changes (560 x 600). On a screen shorter than 672 px the window is still `100vh - 32px` and the body scrolls.
  - Measured after the change (`walk.md`): at 390x844 the body is 382 px and the week view with a two-line note ends at 357 px, so 25 px to spare, with the longest note wordings and the longest subtitle a set street class gives (two lines). The 640 px is room for the common states, not the guarantee: with no street class the subtitle is three lines, the body is 388 px and the week view is 408 px, so it runs 20 px long. S12 is what holds the ruling there.
- **R145 self-ruled S11. When it still runs long, it scrolls.** The body already scrolls (`.whd-body`, `overflow-y: auto`), so no code changes for the scroll itself. The ruling asks for the scroll, not for a "more below" sign, so none is added here; filed as a follow-up (below).
- **R145 self-ruled S12. The note stays whole at the bottom of the body (added in gate round 2).** Round 1 measured the no-street-class week at 390 with the subtitle still reading "arterial" (two lines) and found the note 2.31 px inside the body. The reviewer pointed out that the real subtitle is longer. Walked for real in round 2 (`walk.md`): it is three lines, the body is 388 px and the view 408 px, so without a fix the note's last line would sit at about 390 to 406 px, below the body's edge (computed from those two measures, not walked on the round-1 code). A fit that hangs on one wording isn't the ruling ("must never be cut off … with the last line fully visible"). So the note is `position: sticky; bottom: 0` on the window's ground (`.whd-note`): when a view is taller than the body, the note sits at the body's bottom edge, every line whole, and the chart scrolls behind it; scrolled to the end, it sits under the chart as before. When the view fits, nothing moves. This doesn't depend on the wording, the subtitle's length, the key's lines or the screen's height. Measured in 48 worst-case readings and the 34 of the first walk: the note is whole and on top at rest in every one.
  - What it costs: while a view runs long, the note covers the bottom of the chart until you scroll (8.13 px of the empty caption row at 390x844 with no street class; 13.13 px at 390x667 with none; 35.56 px at 390x600 with a class; 80.13 px at 390x600 with none). The chart is cut where the note starts, which reads as "more here", not as a finished sentence.

## Out of scope, left alone

- Item 3 (#557): the Where row's Change link, the aerial zoom, the hours link's focus ring, the Default links, the stale "R145 S9" comment at `WorkHoursDialog.tsx` `fixed`, and the clip marks.
- The backend: no file under `src/`, `data/` or `tests/` changes.

## Follow-ups

- https://github.com/rtmakatura/conestruct/issues/561: two lows this item's ruling doesn't cover. The hollow dashed "not checked" bar has no key entry (S7), and a scrolling body shows no "more below" sign (S11; #534's first part asked for one, the ruling chose shorter wording and the scroll). Both need a design ruling before code.
