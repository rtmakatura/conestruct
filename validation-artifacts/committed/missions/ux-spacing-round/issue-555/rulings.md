# #555 rulings

Mission `ux-spacing-round` (tracking issue #558), item 1. Base: `prompt-ux-spacing-round` at `aca2d8bd`.

## Ryan's ruling (2026-11-24), word for word

From `docs/prompts/cc-prompt-ux-spacing-round.md`, "Item 1: night work is drawn on a 6 am to 6 am day (board 1, option B)":

> - **Why:** an 8 pm to 5 am shift is almost invisible today. The week view and the weekday ruler run 5 am to 9 pm, so only tiny marks show at the bottom edge.
> - **Ruling:**
>   - Both the week view and the weekday ruler always run from 6 am to 6 am the next morning (24 hours), for every job.
>   - Ticks at 6 am, noon, 6 pm, midnight and 6 am. "Midnight" is set slightly stronger, with a faint dashed line across each day.
>   - Allowed windows and your hours that cross midnight draw as one continuous band or bar.
>   - The colors, states and the inside/outside split stay exactly as #526 and #535 left them (C2).
>   - Hours before 6 am belong to the day they're scored against, per the overnight note #526 recorded. Trace that, and record how the 6 am edge is handled.
>   - Leave #533 (Castle Rock scoring) alone.
> - Add the night shift (8 pm to 5 am) and a day shift (9 am to 3 pm) to the walk, in both views.

And "All items":

> Inter only, group 1's sizes, tokens only, no new hex, 44 px targets (apart from #505's exception), axe clean. Rows and columns don't change height (#469, #490). List every new string with its source. Unslop.

This ruling replaces #526's ruling 4 scale ("A ruler from 5 am to 9 pm") and #526's R145 S6 (clipped ends with arrows) for both views. Nothing else of #526 or #535 changes.

## The trace: which day the hours before 6 am are scored against

Read on this base (`src/rules/jurisdiction.py`, unchanged by this item):

- `evaluate_hours_days` scores each day kind once: `:601`, `kinds = {k: _day_kind_eval(windows, ctx, k) for k in _DAY_KINDS}`.
- Inside `_day_kind_eval`, the shift is split at midnight (`:537`, `segments = _schedule_segments(sched.start_time, sched.end_time)`; `_schedule_segments` at `:241-251` turns 20 to 5 into `[(20, 24), (0, 5)]`), and every piece is checked against that one day kind's allowed spans (`:538-543`). The outside spans it returns (`:544-545`) are clock hours 0 to 24 for that day kind.
- A work date's day kind is the date the shift starts on: `:618`, `k = _day_kind_of(d)` for each work date, and each week entry carries `"day_kind": _day_kind_of(d)` (`:641`) and `"in_job": first <= d <= last` (`:642`).
- `hours_eval` uses the same convention (`:320-325`: "Both segments evaluate against the work date's OWN day-kind").
- #526's S27 (`validation-artifacts/committed/missions/ux-group7b-guesses-hours/issue-526/rulings.md:115`) recorded the same trace: "a Fri 8 pm to Sat 5 am shift is checked against weekday windows only, Sat's 0-5 included" and "The dialog's ruler and week view draw the whole shift on the start day's column, which matches."

So every hour of a shift, the hours after midnight included, is scored against the day the shift starts on. No hour is scored against the next calendar day.

## R145 self-ruled

- **R145 self-ruled S1. Hours before 6 am are drawn on the day the shift starts.** The backend scores them there (the trace above), and Rule 3 says the chart draws the backend's answer. In the week view the column "Mon" is Monday 6 am to Tuesday 6 am, and it carries Monday's shift, Monday's allowed spans and Monday's outside spans, all three from `days.kinds[<Monday's day_kind>]`. A Fri 8 pm to Sat 5 am shift is one bar in Friday's column, against Friday's (weekday) band. Nothing is moved to the next day's column, and the frontend scores nothing.
- **R145 self-ruled S2. The 6 am edge.** The scale is cut at 6 am, the only cut. A clock hour `h` from the backend or the page sits at `h` when `h >= 6` and at `h + 24` when `h < 6`, on a scale that runs 6 to 30. So:
  - A span that ends at or before 6 am after midnight (8 pm to 5 am, 8 pm to 6 am) is one piece. Its two backend halves (20 to 24 and 0 to 5) meet at midnight and are joined there (S3). 8 pm to 6 am ends exactly on the scale's last tick.
  - A span that starts at 6 am starts on the first tick. No piece has zero length: a span ending at 6 am lies wholly before the cut, a span starting at 6 am wholly after it.
  - A span that crosses 6 am (a 4 am to 2 pm shift, or an allowed window of 5 am to 9 am) is drawn in two pieces on the same day: the part from 6 am on at the start of the scale, the part before 6 am at the end of it. It stays on that day because the backend scores it against that day (`:537-543` scores the single segment 4 to 14 against the start day's kind). Moving the 4 am to 6 am part to the day before would put it on a day it isn't scored against, sometimes a different day kind (a Monday early start would land on Sunday's weekend band). The window's subtitle still gives the times in words ("Your hours: 4 am to 2 pm.").
  - Records on file whose allowed hours cross 6 am (read from `data/jurisdictions/*.json` on this base): Lakewood (bans 7 to 9 and 3:30 to 6 pm leave midnight to 7 am allowed) and Loveland (bans 7 to 8:30 and 4:30 to 5:30 pm, the same shape). Their night window draws from the evening to the last tick, and its last hour, 6 to 7 am, at the start of the scale (`crops/555-labels-lakewood-day-*.png`). E-470's night window ends exactly at 6 am, on the last tick. Castle Rock's bans end at 7 and 8 am, so its allowed span starts after the cut and is one piece. Denver's and Centennial's night windows end at 5 am, one piece.
  - Walked for the page's hours: 4 am to 2 pm at all three sizes (`crops/555-early-start-*.png`). Denver's backend answered one outside span, 5 am to 8:30 am (the day's screen-reader sentence reads "Outside: 5 am to 8:30 am."). The chart draws it as the backend sent it, cut at 6 am: 6 to 8:30 am at the start of the scale and 5 to 6 am at the end, both in `--dim`; 4 to 5 am sits inside the night window, in `--ink`.
- **R145 self-ruled S3. Pieces are joined only at midnight.** A piece ending at midnight and a piece starting at midnight, of the same kind (allowed, your hours, or outside), draw as one. That is the ruling's "one continuous band or bar". Nothing else is merged, so every other span is drawn exactly as the backend sent it, as in #526.
- **R145 self-ruled S4. A band's end label appears only at a real end of the window.** The base's code comment at `conestruct/site/components/WorkHoursDialog.tsx:355-356` (`aca2d8bd`) reads "A clipped end (S6) takes no label: the ruler's edge is not the window's start or end." That is a comment in the code, not the text of #526's S6 (S6 itself rules the 5 am to 9 pm ruler and the arrows at clipped ends). The comment's rule carries over to the 6 am cut: an end made by the cut takes no label. Denver's night window is now labelled "8 pm" and "5 am" (both were clipped away before). An all-day window gets no labels, as before.
- **R145 self-ruled S5. The tick words are `clock()`'s: "6 am", "noon", "6 pm", "midnight", "6 am".** The ruler already wrote "noon" in lower case through `clock()` (`conestruct/site/lib/scenarios/why-lines.ts:677`, "the ruling's own clock words"), and the window's sentences say "midnight" the same way. No new string is minted; `lib/` is untouched.
- **R145 self-ruled S6. "Slightly stronger" (CHOSEN, Rule 12).** The midnight tick is `--ink-on-dark` at weight 600; the other ticks stay `--ink-faint` at 400. Same size (`--fs-field-label`). The dashed line is `1px dashed var(--ink-faint)`: a vertical line across the ruler's track, a horizontal line across each day's column, drawn over the allowed band and under your hours. The first walk tried `--rule`; it couldn't be made out over the allowed band (`--rule` on `--pri-off`), so the line uses the ticks' own ink. All are existing tokens; no hex is added. The line is decoration (`aria-hidden` with the rest of the chart); the tick word is the label.
- **R145 self-ruled S7. Room for the end ticks and for "midnight" (CHOSEN).** A tick now sits on each end of the weekday ruler, so the ruler's side margin goes from 6 px to 16 px: half of "6 am" (29.25 px wide, measured) fits inside the scrolling body, and the ticks stay centred on their hours. (The checkpoint planned edge-aligned end ticks; the margin is simpler and keeps every tick centred.) The week view's tick column goes from 44 px to 60 px: "midnight" at weight 600 measures 53.14 px, plus the 4 px gap. At 390 that makes each day's column 33.7 px wide (it was about 36); the heights don't change.
- **R145 self-ruled S8. Sizes hold.** The ruler's track stays 28 px tall and the week's columns 240 px (so 10 px an hour, was 15). The window stays 560 x 600. No row or column changes height.
- **R145 self-ruled S9. The clip arrows can no longer show; the code stays for #557.** On a 24-hour scale nothing is clipped, so `◂ ▸ ▴ ▾` never render. The mission's item 3 (#557) owns removing them ("If they're no longer needed with the 6 am to 6 am chart, remove them and record that"), so this item leaves the marks' markup and CSS in place and only makes their condition honest (it reads the placed spans, which never leave the scale). The four tests that pinned the arrows now pin that none render.
- **R145 self-ruled S10. Screen-reader text is unchanged.** Each day's sentence still lists the backend's spans as sent (the walk recorded, for a Denver weekday, "Allowed midnight to 5 am, 8:30 am to 3:30 pm, 8 pm to midnight."; `measures-390.json`). Joining them in words would be a copy change outside this item.
- **R145 self-ruled S11. A start label close after the window before it is set from its start (fold-in, CHOSEN).** The new scale is 24 hours wide where the old one was 16, so labels sit closer. The first walk showed Lakewood's labels overlapping at 390: "7 am" over "9 am" by 4.86 px and "3:30 pm" over "6 pm" by 9.83 px (measured; `measures-labels.json` holds the after values). On the old scale the nearest pair was about 9 px apart (computed from the measured label widths, not walked). Fix: when a window starts less than 4 hours after the window before it ends, its start label begins at the window's start, not centred on it (`.whd-cap.is-near`). 4 hours is CHOSEN: at 390 the track is 292 px, 12.2 px an hour, and two centred labels as wide as "3:30 pm" (50 px) need about 4 hours between them. After: Lakewood's nearest pair is 5.27 px apart at 390 and 26.31 px at 1440; Centennial's 17.44 px and 46.9 px. Denver's labels don't move (3:30 pm to 8 pm is 4.5 hours); a test pins that. The churn prediction was amended before this diff (`checkpoint.md`).
  - Left over, filed: Loveland's 4:30 pm and 5:30 pm labels are one hour apart and still overlap (about 13 px at 390 and 4 px at 1440, computed). They overlap on the live 5 am to 9 pm ruler too (about 30 px and 18 px, computed), so this isn't new. Loveland isn't in the jurisdiction list, so it wasn't walked. Follow-up: https://github.com/rtmakatura/conestruct/issues/559.

## Out of scope, left alone

- #533 (Castle Rock scoring) and `hours_eval`: no backend file changes.
- Items 2 and 3 (#556, #557): the key entry, the class-unset outline, the week note, the page fixes, the "R145 S9" comment at `WorkHoursDialog.tsx` `fixed`, and removing the clip marks.
