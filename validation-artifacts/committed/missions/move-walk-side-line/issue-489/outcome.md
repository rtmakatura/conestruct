# #489 outcome: the Move walk picks the road on live data

Date: 2026-11-10.  `/healthz` sha = `8c1f69d8267f55aa1b8ccccd9b8b3af8a1763829` (= `origin/main`), read before the runs and again at review; no log records the readings.
Site: https://www.conestruct.com/sandbox, headless Chromium (Playwright), DPR 1, live road data, E Colfax (1550 / 1600 E Colfax Ave,
Denver).  Read-only: answers picked on the page, nothing saved, no one signed in.  The gate header went only to www.conestruct.com through
`scripts/gate.cjs`; the token was read from the main checkout's `conestruct/site/.env.local` into the process environment at run time.
Runs one at a time (the NEEDS YOU map cap).  Each walk ran once.

| Item | Result |
|---|---|
| Cause | **Check-tool bug, proven** (probe, § 1).  The product is not at fault, matching Ryan's hand check |
| #490's 6 Move states (`verify-columns-end-together.mjs`, fixed) | **PASS 36 / 36**: each of `edit-moved`, `edit-done-side-reasked`, `side-answered-after-move`, `reopened-after-confirm`, `edit-after-confirm`, `cancelled-after-confirm` at 1024x768, 1198x930, 1440x900, each at 100% and 200% text: frame↔last 0 px, column↔column 0 px, 0 overlaps, 0 past the band.  The whole states phase: 23 states x 6 runs, `RESULT PASS`, exit 0, no ERRORS line |
| #485 Edit → Move → another address → Done, before Confirm (step C) | **PASS** at 1440, 1198, 390: after the Move the waiting row reads "1 of 2 answered"; after Done the side question is back, unticked, with "Your edit changed the road or the work start, so this is asked again." (`edit-reasked-note`); the kind answer kept (1 record), the typed length 600 kept |
| #485 after Confirm: WHERE reopened → Edit → Move → another address → Done (step E, Ryan's hand check) | **PASS** at 1440, 1198, 390: the same as C: side cleared and asked again with the line, "What kind of work is it: Shoulder work" kept, length 600 kept, road "East Colfax Avenue eastbound" |
| axe / console | axe 0 at every step of the #485 walk, console errors 0 and walk errors 0 at all three sizes |

## 1. The cause (probe before the fix)

`script/probe-move-pick.mjs`, log `logs/probe-move-pick-before.txt`, 1198x930.  It runs the check's old `search()` with a snapshot of the
dialog over time.  Times are ms from the Move's picker opening:

- t=1505: the picker opens with the old road picked: `road-picked` shown, Save & Close **enabled**.
- t=1594 SEARCH clicked; t=1596 the old wait ("the road list, or an enabled Save & Close") **returned**, on the stale enabled button.
- t=1794 the road lookup (`/api/road-bearing`) is sent; the old pick clears, Save & Close goes disabled.
- t=3099 the check looks for a Colfax row: **0 found**, so it clicks nothing (and its `.catch(() => {})` would have hidden a failed click too).
- t=4575 the answer arrives; t=5113 "PICK THE ROAD · 4 FOUND" with the East Colfax eastbound row, unticked, Save & Close disabled, to the end.

So the row was never clicked; the click on Save & Close then timed out (the `locator.click: Timeout 30000ms exceeded` of the #494 and #486
checks).  The first pin doesn't hit this, because nothing is picked when the picker first opens.  Crop: `crops/probe-1198-before-fix-stuck.png`.

## 2. The fix (check tooling only)

`scripts/verify-columns-end-together.mjs` `search()`: it waits for this search's own `/api/road-bearing` response (set up before the SEARCH
click) and then the existing wait; it picks the first Colfax road row by `role=radio` and fails by name if Save & Close is still disabled
5 s later.  No reading, state, log format or PASS rule changed.  `script/walk-485-move-prod.mjs` is #486's `walk-485-prod.mjs` copied
forward (the archived copy is unchanged) with the same `search()` fix, step C always on, and step E added (rulings.md 4).

## 3. Runs

- `STUB_ROAD=0 SITE=https://www.conestruct.com ONLY=states OUT=<extra> node scripts/verify-columns-end-together.mjs` (default sizes and zooms):
  `logs/verify-columns-end-together-states.txt`, readings `walk/columns-readings.json`.  Only the `states` phase was run: it holds all 6
  states #494's check missed; the variant phases (long name, two-option side, sides unavailable, aerial failed, results) passed on prod in
  #494's check and were not re-run, to stay under the map cap.
- `SITE=https://www.conestruct.com node script/walk-485-move-prod.mjs <extra>` (1440x900, 1198x930, 390x844):
  `logs/walk-485-move-prod.txt`, per-size JSON in `walk/`.

## Seen, not judged

- The #485 walk's under-44 px count is 7 per step at 1440 and 1198, except 5 at 1440's D-reopened-after-confirm step (2 on #486's check): the zoom `+`/`−` (32x32, the rule-133 exception)
  and, new since #490 put Mapbox's marks on the frame, the Mapbox logo and the four attribution links (14 px tall).  These are Mapbox's
  own marks; #490's check covers their placement.  Not a #489 finding.

## Files

- `script/`: the probe and the forward-copied #485 walk.  `logs/`: the probe and both runs.  `walk/`: the JSON.  `crops/`: 8 crops
  (the stuck picker before the fix; columns 1198 `edit-moved`, `edit-done-side-reasked`, `edit-after-confirm`; #485 walk 1198 C done,
  E moved and E done, 390 E done).
- The rest (139 columns crops, 45 walk crops, the probe crop) are in
  `C:/Users/rtmak/Documents/traffic-control-tool/validation-artifacts-extra/move-walk-side-line/`, outside any worktree.

Token scan of this folder, the extra folder and the scratchpad: **0** hits of the token value, **0** lines naming the gate header in this
folder's outputs.
