# #443 walk evidence (2026-11-05)

Local `next dev` on this worktree, against the local backend (`ux-group3-where/evidence/script/serve_replay.py`, Overpass replayed; `/api/road-bearing` stubbed from the recorded fixture). 1600 E Colfax Ave, Denver, kind Shoulder, Generate through the page. Chromium, DPR 2, 1440x900 and 390x844. Script: `script/walk.mjs`. Crops and numbers: `walk/`, `walk/walk.json`. This is a local walk; the production check follows the ship.

## Result on the final code (both widths unless named)

| Check | Result |
|---|---|
| Default state (X2) | All three sections closed |
| Summaries from the ledger | "13 checks, each cited", "3 items for the TCS", "For reference, never blocks the plan" |
| Rows, with everything open | At least 48 px; search box 48 px; group labels mono 10; nothing nested inside a detail (0) |
| Targets in the sections | None under 44 px, in every state measured |
| axe, scoped to the sections | 0 violations: idle, opened, every search state, no match, failed audit |
| No backend call while searching | 0 `/api/` requests in every search state, and for the chip tap |
| Search counts | sidewalk 5 lines, 6B 4, cone 3, sign 11, $500 2, taper 4, flagger 1 |
| No match | Heading, the sentence, 5 chips (taper, buffer, sidewalk, work hours, fines), the clear link |
| Mark | `rgb(41, 64, 86)` (`--raise-hi`), `inset 0 -2px 0` in `--act` |
| Restore (P15) | × , Escape, emptied box and "Clear search and show everything" each return the exact state from before the search; × returns focus to the box |
| Failed audit (Rule 10) | Section 3 opens with "Audit trail failed: HTTP 500" and Retry; Retry brings back all three with the same counts |
| Page errors | 0 |
| Horizontal overflow at 390 | 0 |

The walk's `$500` and other search rows are in `walk/walk.json` under `steps`.

## What the walk found, and where it went

The first run failed two measured checks and the crops showed more. All were fixed and re-walked. Calls are in `../rulings.md`.

- X28: axe `color-contrast` on "No matches" under the mock's `opacity: 0.6`.
- X29: "R9-9" broke at its hyphen at 390.
- X30: the label and value rows ("10 days" alone on a line; formula lines aligned by length).
- X31: the no-match status repeated the card.
- X32: "The windows above" sat above the chart.
- X33: the placeholder cut off at 390, now an ellipsis.
- X34: a stray rule above "Not checked yet"'s first row.
- X35, not a defect: the line across the label in tall crops is the fixed `.workbench-frame`.
- X36: the Retry link was 34.9 px wide. The walk recorded it, its console line didn't print it, and the diff-verifier caught it.

The failed vitest runs on the way to X29's final form are in `vitest-failures-5-code-span.txt`.

## Known limits

- At 390, "S-630-1" in one detail sentence still wraps at a hyphen (`walk.json`, `allOpen.hyphen`). Sign and device codes don't. Pinned detail text can't take the span (X29).
- The other two sections leave while Retry runs, then return (`steps.sectionsWhileRetrying`, `steps.afterRetry`). An earlier run read them during the refetch, so the walk now waits for them.
- axe ran on the states in the table, not on the restored states, the chip tap or after Retry.
- Each walk overwrote the last, so the first run's raw output is gone. The X28 axe failure, the X29 break and the other first-run findings rest on this file and `../rulings.md`; the crops and numbers here are the final code's.
- The Overpass answers are replayed and the road lookup stubbed, so this doesn't prove live detection. The production check does.
