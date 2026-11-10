# Production check: mission ux-token-map-load-edit (#486) on fe57324

Date: 2026-11-10.  `/healthz` sha = `fe573241d6f5683660ee6e0190eba5550b1f497d` = `origin/main`.
Site: https://www.conestruct.com/sandbox, headless Chromium (Playwright), DPR 1, pin 1600 E Colfax Ave, Denver, live road data
(no road stub), road "East Colfax Avenue, eastbound".  The walks loaded the page, picked answers on it and pressed Generate.
Nothing was saved, no one signed in.  The gate header went only to www.conestruct.com, through `scripts/gate.cjs`; the token was read
from the main checkout's `conestruct/site/.env.local` into the process environment at run time.

| Item | Result |
|---|---|
| #481 the permanent check runs on prod with no `--require` guard; the token never prints | **PASS**: both runs (HOLD_MS=0 and 4000) finished, exit 0, no crash.  Token scan of every run output from this check (all stdout/stderr logs, walk JSON, scripts and crops, the extra folder and the scratchpad copies included; 150+ files): **0** hits of the token value, **0** lines naming the gate header.  Re-run on the final folder: token 0; the header name appears only in this outcome.md's prose |
| #482 past 14 s only the strip speaks; gap 24 | **PASS**: at 14.5 s the strip reads the 14 s sentence (`status-bar wait-line caution is-slow`), the NEEDS YOU outline's note is "" (its line kept, 41 px), "20 seconds" is nowhere on the page.  Outline gap 24 at all three widths; settled gap 24 at all three (see the note in § 2) |
| #479 NEEDS YOU Details floats | **PASS**: card and section heights equal open vs closed at all three widths, no box moved, no layout shift on open, panel `position: absolute`, on top, inside the viewport (390: x 31-359, page width 390), Esc closes it and returns focus to the toggle |
| #483 each NEEDS YOU map soft then sharp | **PASS**: 3 questions x 3 widths = 9 maps, each soft then sharp with the same box (846x423 / 360x270), figure and `data-frame`; label "Loading the map of this spot" (12.5px); soft filter `blur(14px) saturate(0.7)`.  The permanent check's soft→sharp line: PASS at all three widths in both runs |
| #484 the cross street as a dashed line with its name tag | **PASS**: live intersection question ("Is there an intersection next to the work?") at all three widths: dashed line on Franklin Street, tag "Franklin Street" (Inter 12.5px/600), inside the frame, clear of the zoom buttons and the street-level link, no tag on the soft image, no chip, no ring; key "The work · The cross street the map knows about · Imagery may be a few years old".  First full image fetch: **1061 / 1468 / 504 ms** (1440 / 1198 / 390; first run 3865 ms at 1198, 1470 at 390) |
| #485 Edit and the questions take turns | **PASS** for A, B and D: band 762.5 px and aerial frame 411x624.3 at dy 97.5 in every step at 1440 and 1198; panel 584 and waiting row 48 ("◌ Questions wait while you edit · 2 of 2 answered", not a control); B's Done re-asks nothing (length 600).  **Step C (Move to another address) NOT CHECKED on prod**, see § 6 |
| axe / 44 px / console / Generate CLS | **PASS**: axe 0 at every step (WHERE band x 27 steps, NEEDS YOU and results x 18 map states, Details closed/open x 3).  Under 44 px: only the WHERE aerial's zoom `+`/`−` (32x32) at 1440 and 1198, the known rule-133 exception; 0 in NEEDS YOU and the results.  Console errors 0 and page errors 0 in the final runs.  Generate CLS 0 at all three widths, HOLD_MS 0 and 4000 |

## 1. The permanent check (#481, #483, CLS)

`SITE=https://www.conestruct.com HOLD_MS=<0|4000> GATE_BYPASS_TOKEN=... node scripts/verify-generate-cls.mjs`, unmodified, **no `--require`**.
Logs: `logs/verify-generate-cls-hold0.txt`, `logs/verify-generate-cls-hold4000.txt` (stdout and stderr together, exit code appended).

| Width | CLS (0 / 4000) | Outline check (4000) | NEEDS YOU delta | Outlines left | soft→sharp |
|---|---|---|---|---|---|
| 1440x900 | 0 / 0 | PASS | +91 (sections +89, refs +88) | 0 / 0 | PASS 846x423, frame 39.739914,-104.968447,18.00 |
| 1198x930 | 0 / 0 | PASS | +91 | 0 / 0 | PASS 846x423 |
| 390x844 | 0 / 0 | PASS | +53 | 0 / 0 | PASS 360x270 |

The live scan had 3 questions, so NEEDS YOU grew downward from its one-question reserve (#477 answer 1): reported, not failed, the same
+91 / +53 as #478's check.  No WARN line, no crash, no guard needed.

## 2. #482 (`script/walk-results-prod.mjs`, HOLD_MS=16000, log `logs/walk-results-prod.txt`, JSON `walk/results-extra.json`)

At 14.5 s from the press, all three widths: strip "⚠ This is taking longer than usual. The first plan after a quiet spell can take up to 30 seconds.",
outline note text "" at 41 px, `/20 seconds/` absent from the page.  Outline gap (`[data-outline=refs]` top − `[data-outline=downloads]` bottom): 24 / 24 / 24.

**Settled gap: 24 / 24 / 24**, read at the end of the walk.  The first read, taken the moment the strip settled, gave 30 at every width.  The
element dump shows why: at that moment the results wrapper and `section.dl-sec` were still mid entry animation (the wrapper 7 px above its
final place, `.dl-sec` 6 px below `#downloads`' top), and `.dl-sec`'s own bottom was already 24 px above the reference group.  Read again
once the animation had finished, `#downloads` bottom to `.results-disc` top is 24 at every width (`gapDetailAtSettle` and `gapDetailLater` in the JSON).
The permanent check agrees: Downloads +89 and refs +88 against their outline, so the settled gap equals the outline's within 1 px.
Crops: `crops/<size>-482-strip-14s.png`; `crops/{1440x900,390x844}-482-reference-gap.png` (taken at the settle, so the fade is still dim).

## 3. #479 (same walk, question 1 "Are there sidewalks along the work zone?")

| | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| NEEDS YOU closed / open | 1024.8 / 1024.8 | 1024.8 / 1024.8 | 1135.3 / 1135.3 |
| card closed / open | 792 / 792 | 792 / 792 | 886.3 / 886.3 |
| boxes moved / shifts on open | none / none | none / none | none / none |
| in-flow `.nyq-details` | 0 | 0 | 0 |
| panel x, width, height | 297-657, 360, 59.5 | 176-536, 360, 78.3 | 31-359, 328, 78.3 |
| in view / on top / page width | yes / yes / 1440 | yes / yes / 1198 | yes / yes / 390 |
| axe closed / open, under 44 px | 0 / 0, none | 0 / 0, none | 0 / 0, none |
| Esc closes, focus on toggle | yes | yes | yes |

The 1440 panel is 59.5 tall here vs 78.3 in the local walk: the live Details text is one line shorter at 360 px wide.  Crops: `crops/<size>-479-details-{closed,open}.png`.

## 4. #483 and #484 (same walk)

Each full image was held 2.5 s in the browser after it arrived, so the soft image could be read.  Per question and width (log lines `q1`-`q3`):
phase soft → sharp, box and figure SAME, `data-frame` SAME, axe 0/0, under 44 px 0/0.  Frames: sidewalks 39.739914,-104.968447,18.00;
bike lane 39.739842,-104.968454,18.00; intersection 39.739906,-104.968453,18.00 (live; the local stub's was 39.739969,-104.968354).

Map requests (`maps` lines; fetch time of each request, before the hold):

| Width | q1 soft / full | q2 soft / full | q3 soft / full (intersection) | q3 `x-map-cross-street` / tag place |
|---|---|---|---|---|
| 1440x900 | 416 / 2574 ms | 775 / 645 | 800 / **1061** | Franklin Street / 434,329 |
| 1198x930 | 444 / 1392 | 463 / 488 | 405 / **1468** | Franklin Street / 434,329 |
| 390x844 | 402 / 353 | 293 / 1331 | 438 / **504** | Franklin Street / 26,17 |

Tag: "Franklin Street", 110x30, at 434,329 in the frame at 1440/1198 and 26,17 at 390, inside the frame, meets neither the zoom buttons nor the link;
ground rgb(16, 28, 41), border 1px rgb(63, 211, 168).  The q1 and q2 maps carry no cross-street header and no tag.
Crops: `crops/<size>-q1-{soft,sharp}.png`, `crops/<size>-q3-{soft,sharp}.png` (the dashed Franklin line and tag; no circle).

## 5. #485 (`script/walk-485-prod.mjs`, `SKIP_C=1`, log `logs/walk-485-prod.txt`, JSON `walk/485-<size>.json`)

Steps: A the questions answered (Confirm on screen) → Edit → Cancel; B Edit → length 600 → Done; D Confirm (WHAT opens) → WHERE reopened → Edit → Cancel.

- **1440x900 / 1198x930:** band 762.5 in all 9 steps; aerial frame 411x624.3 at dy 97.5 in the band in all 9 (left 297 / 176).  Right column 648 with the card
  or the panel (245.5 with WHERE's closed card after Confirm).  Panel 584, waiting row 48, text "◌ Questions wait while you edit · 2 of 2 answered", not a control.
  After B's Done: no re-ask line, the side answer kept, length 600.  After D's Confirm, reopening WHERE and Edit open the panel the same way.
- **390x844:** the frame is the pinned 328x150 strip (`sticky`) in every question and panel state; the band follows its content (E8, by design):
  862.3 with the card, 866.8 with the panel and the 66.5 waiting row; after Confirm 642.5 (the 250 px picture), 900.8 with the panel open, 714.8 after Cancel.
- axe 0 in all 27 steps; under 44 px only the zoom `+`/`−` 32x32 at 1440/1198 (known); console errors 0, page errors 0.
- Crops: `crops/485-<size>-{02-A-edit-panel,04-B-length-typed,08-D-edit-after-confirm}.png`.

## 6. Not checked, and what went wrong on the way

- **#485 step C (Edit → Move → another address → Save & Close → Done, the side re-asked) was not walked on prod.**  In three runs, the picker opened by Move
  searched 1600 E Colfax and listed 4 roads, but the click on the East Colfax row (the walk's `button` with "Colfax", then a click on the row's text) didn't select it, so Save & Close
  stayed disabled ("PICK A ROAD TO CONTINUE") and the walk timed out (`logs/walk-485-prod-run2-with-C.txt`, `logs/walk-485-prod-run3-with-C-1198.txt`; error crops in the extra folder).
  The local walk never hit this click: its stubbed road answer has one road, which the picker takes by itself.  Not investigated further.  It may be the walk's selector or a real
  picker problem in Move mode.  It needs a hand check, or a follow-up.  The A, B and D steps the brief named ran and passed.
- **The first runs collided.**  The first results walk and #485 walk ran at the same time as the permanent check.  Together they passed the site's
  30-requests-a-minute limit: 429s in the console at 1198 and 390, and the 1440 results walk timed out.  Both walks were rerun one at a time (the final logs above);
  the collided logs are kept as `logs/*-run1-concurrent.txt`.  The final runs have 0 console errors.
- The soft-image sentence reads "The scan found an intersection 73.2 ft from the work"; once the full image shows, it reads "The map shows an intersection …".  Seen, not judged (no ruling on it in this mission).

## Files

- `script/walk-results-prod.mjs`: issue-484's walk plus the #482 reads, #479's Details measure, map timings and console errors, all marked `#486:`.
  `script/walk-485-prod.mjs`: issue-485's walk with live roads, the site and token from the environment, console errors, and `SKIP_C`.
- `logs/`: every run's stdout and stderr.  `walk/`: per-width JSON.  `crops/`: 32 crops.  The rest (93 crops, including the collided runs and error shots) are in
  `C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts-extra/mission-486-prod-check/`, outside any worktree.
