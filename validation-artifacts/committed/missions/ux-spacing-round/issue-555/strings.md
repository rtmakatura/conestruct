# #555 user-facing strings

Ruling ("All items"): "List every new string with its source."

No string is minted. `conestruct/site/lib/` is untouched, so every sentence the window shows (title, subtitle, verdict, fix button, record, weekend line, week note, key, source, the screen-reader sentences) reads as it did.

What changes on screen is which clock words appear, and where. All of them are written by `clock()` (`conestruct/site/lib/scenarios/why-lines.ts:677`, unchanged; #526's "the ruling's own clock words", with a non-breaking space before am/pm).

| On screen | Where | Before | Source |
|---|---|---|---|
| `6 am`, `noon`, `6 pm`, `midnight`, `6 am` | The tick row under the weekday ruler, and the tick column left of the week | `6 am`, `9 am`, `noon`, `3 pm`, `6 pm` | Ryan, 2026-11-24, item 1: "Ticks at 6 am, noon, 6 pm, midnight and 6 am." Lower case as `clock()` writes them and as the ruler already wrote "noon" (R145 S5). |
| `8 pm`, `5 am` (Denver; the hours are the backend's `allowed`) | End labels over the night window on the weekday ruler | No label: both ends were past the 5 am to 9 pm ruler | The same label every window's end already had (#526 ruling 4's ruler); the night window's ends are on the scale now (R145 S4). |
| `midnight` as an end label | Over a window that starts or ends at midnight and isn't joined to another there | Not shown (the old ruler ended at 9 pm) | `clock(24)`. No record on file has such a window today (Denver's, Centennial's, Lakewood's, Loveland's and E-470's night windows all continue past midnight). |

Gone from the screen: the clip arrows `◂ ▸ ▴ ▾` (decorative, `aria-hidden`), which can't show on a 24-hour scale (R145 S9).
