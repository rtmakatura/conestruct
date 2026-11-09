# #456 walk evidence (2026-11-07, local)

Setup: `next dev` on the issue-456 worktree (port 3456) started by `script/launch.cjs`, which reads the main checkout's `.env.local` into the child environment (no copy into the worktree) and sets a walk-only render secret and gate token. Backend: `script/serve_stub.py` (port 8456): Overpass **stubbed**, replaying `ux-group3-where/evidence/overpass-fixture/` from a scratchpad copy; an unrecorded ask fails, none goes live. `/api/road-bearing` stubbed in the walk from the same fixture. The aerial images are live Mapbox (the backend's token). Chromium, DPR 2. The gate header went through `scripts/gate.cjs` `newGatedContext` (the local site's own host only). Script: `script/walk.mjs`; summaries: `walk/{before,after}/summary.txt`; raw: `walk/{before,after}/*.json`.

`before/` ran on the unchanged tree (base `2cd6d72`) at 1198x930 and 390x844; `after/` on the final diff at all five sizes. Pin: 1550 E Colfax Ave (desktop), 1600 E Colfax Ave (390), as #446's walk.

## Results

| Check | Before | After |
|---|---|---|
| Layout at 1440x900, 1198x930, 1024x768 | one column, band 846 px | two columns, aerial 411x560 left, card right |
| Layout at 390x844, 390x664 | one column | 150 px strip pinned at the nav while a question is open (frame top 52, under the 52 px nav, on the kind and side questions at 390x844 and on the side question at 390x664; at 390x844 after Show map (`10`, `11`) the page sits higher and the strip's top is 60.8, the whole strip in view). At 390x664 on the first question the page sits past the card (y=869, the picker's focus scroll, #460), so the stack is ending and the strip is carried up with it: frame top 11.8, 110 of 150 px in view |
| Aerial in view, first CONFIRM question, 1198x930 | 0 px (frame -343..-43) | 440 of 560 px; question heading in view (`questionInView`, measured from the nav's bottom) |
| Aerial in view, side question, 1198x930 / 390x844 | 35 px / 0 px | 441 px / 150 px (the whole strip) |
| Time to new map, answering a side (1198 / 390x844) | 817 / 828 ms, blank box with "Drawing the corridor…" | 42 / 33 ms (repair re-walk; 27-42 ms over all five sizes), no blank, 0 aerial and 0 geometry requests |
| Kind answered before the side (flagger, then shoulder) | 833-1019 ms blank each (1198x930 and 390x844), 1 aerial request each | picture never changes (the pin picture is the same picture), 0 aerial requests. The first kind answer (flagger, and near-intersection on the second page) still makes 1 geometry read (`g=1`) although its geometry was loaded ahead; the second (shoulder, back to a state already read) makes 0. Explained in Repair 2 below ("The kind's `g=1`, explained"): the click hits the remembered scenario, and the one read is the next load-ahead. No Mapbox, no Overpass |
| Undo the side, then the side again | 346-376 ms blank, 1 geometry read each | Undo 29-36 ms, side again 40-52 ms (repair re-walk, five sizes), no blank, 0 requests |
| Intersection tap | as #446 | Opening the question brings the map into view once (M8): armed, the map is wholly on screen at every size (frame 51.5..611.5 at desktop, 51.8..301.8 at 390) with the question and its line under it. Found: desktop doesn't move (205 -> 205); 390x844 214 -> 227; 390x664 214 -> 421, #446's reveal as shipped (T19 B: 43 px of the map left at 390x664) |
| Hide map / Show map (390x844, 390x664) | n/a | Hide 95.8x44, Show 102.1x44; hidden holds through the side's Undo (`09`; a change to another question while hidden is neither walked nor tested); Show brings the 150 px strip back; focus moves to the other button |
| axe (band), every measured state | n/a | 0 violations at all five sizes |
| Targets under 44 px | n/a | none new. The zoom + / − are 32x32 at desktop widths, unchanged (rule 133's 32/44 pair; 44 below 481 px) |
| Layout shift without recent input (last page of each walk: the near-intersection plan) | 0.0067 (1198) / 0.000 (390) | first build (its JSON was replaced by the repair re-walk; not kept): 0.0062 / 0.0067 / 0.0329 / 0.0001 / 0.0002 (1440 / 1198 / 1024 / 390x844 / 390x664). Repair walk (`walk/after/`; the 390 sizes re-walked in session 2 after M21): 0.0075 / 0.0110 / 0.0359 (none from the band at 1024) / 0.0986 / 0.0001 (390x664 was 0.0692 before M21). At 390x844 almost all of it (0.0677) lands 2 ms after the `16-held` picture swaps in, which the walk forces 4 s late: the key and the line under the strip appear with it and move the card. On the straight path the picture is loaded ahead and swaps within the click's 500 ms input window; 0.031 at 390x844 is around the tap's found answer |
| Horizontal overflow | 0 | 0 |
| Page errors | 0 | 0 |

## The landing scroll (seen, not changed here: #460)

After Save & Close the page sits at its maximum scroll (1198x930: y=324 = max). Probe: the picker modal's cleanup calls a plain `focus()` on the open band's wrapper (`LocationPickerModal.tsx:658-659`), which scrolls the page. That's Ryan's "the aerial is mostly scrolled off". With the card beside the map, the first question now shows (repair re-walk, `walk/after/summary.txt`, step `01-kind-question`, nav bottom 52): 1440x900 410 of 560 px of the aerial (73 %; its top 150 px under or above the nav), 1198x930 440 of 560 px (79 %; 120 px), 1024x768 278 of 560 px (50 %; 282 px); before, 0 px at 1198. At 390x844 the whole 150 px strip; at 390x664 110 of 150 px (the strip carried up, below). The picker modal is out of scope (group 8), so it is filed: https://github.com/rtmakatura/conestruct/issues/460 (about one line, `preventScroll`).

## What depends on #460 (seen, not fixed here)

The picker's focus scroll (#460) leaves the page past the first question on arrival:
- First question not wholly in view: 1024x768 (card -101..284 at y=505), 390x844 (card -89..296 at y=689), 390x664 (card -269..116 at y=869). Later questions are not always in view either (`walk/after/summary.txt`, `qInView=false`): 1024x768 on the flagger kind answer, the side's Undo, the side again, the strings step and the near-intersection kind; 390x664 on `09-hidden-after-undo` and `10-map-shown`. The `questionInView` measure counts from the nav's bottom and ignores the 150 px strip, so it reads `true` where the strip covers the heading: at 390x844 the strip covers the side question's heading and sentence in `03`-`06`, and at 390x664 in `10`. Filed: https://github.com/rtmakatura/conestruct/issues/461.
- On the first question the aerial's top 150 px (1440x900), 120 px (1198x930) and 282 px (1024x768) are under or above the 52 px nav, Edit on map and the zoom + with them.
- At 390x664 on the first question the strip is carried up with the ending stack (frame top 11.8).
None is in this item's reach without changing the picker modal (group 8); #460 is about one line.

## Ruling 3 trace: Mapbox images and Overpass reads

Per walk (two plans: a shoulder plan through the side's Undo, and a near-intersection plan through the tap), aerial requests:

- Before: 6 (1198) / 6 (390): every kind answer asked for a new pin picture of the same pin.
- After (the committed repair re-walk, `walk/after/summary.txt`; 390 sizes re-walked after M21): 5 at every size. Before M21 the 390 sizes asked for 6: the strip drew its picture 2 px taller than the full-height picture, so opening the tap question asked for a second pin picture and taps waited for it (session 2 re-walk order at 390x844: `pin work work pin work`; before M21: `pin work work pin pin work`). Geometry reads: 21 at every size. Request order at 1198 (`walk/after/1198x930.json`): shoulder page `a:p` (the pin picture), then `a:w` loaded ahead for the side question's one built option ("North side"), used by the answer, then `a:w` loaded ahead for the flagger kind when the walk went back to the kind question with the side set, never used; near-intersection page `a:p`, then `a:w` in the `16-held` step: the side's picture loaded ahead (held 4 s by the walk) and used by that answer. That last request is a step the before walk didn't have. The 390 sizes now match (M21).

Per plan, then (1198): the shoulder plan 4 before (pin, pin, pin, work) and 3 after (pin, work used, work unused); the near-intersection plan 2 before (it stopped at the tap) and 2 after (pin, the side's work, used). The same at 390 since M21.

Restated per plan, by path (images loaded ahead and not used, minus images no longer asked for):
- Kind left as is (the starting kind), two-sided road: **+1** (the side not chosen, loaded ahead). One-sided road: 0.
- Kind changed before the side: the pin picture is remembered, saving the 1 image the kind answer used to ask for; with a two-sided road that cancels the side's +1 (net 0), with a one-sided road net -1.
- Going back to the kind question with a side set: up to +1 per other live kind whose geometry is laid out (2 other live kinds today; the near-intersection kind with no crossing is the pin picture, already remembered), and the side question reopened after a kind change loads its unchosen side again.
- So at most +3 on a two-sided road (the unchosen side plus two kinds) for a plan that goes back to its kind once after its side; each further back-and-forth to a state not yet seen adds up to the same again. Against the free 50,000 a month, with the plan's own 3-4 images and #447's ~2, a plan costs about 6-9 images, so roughly 5,500-8,000 plans a month before the free tier is reached.

Geometry reads (Modal compute, no Mapbox, no Overpass): 12 before -> 20 in the first after walk -> 21 in the repair re-walk (its `16-held` step answers one more question); about +4 per plan, one per choice loaded ahead. The geometry read makes no Overpass call: `render_corridor_geometry` lays out from the relayed centerline (`src/api/render_api.py` 1667-1813); Overpass is called only from `site_detection`, `site_scan` and `nearest_intersection`. So ruling 3's Overpass condition never stops a load-ahead.

Overpass reads per state: the nearest-intersection read is 1 per state before and after (2 per walk before; 3 after, the third is the tap's own read, which the before run's tap didn't reach). Road-bearing (stubbed) the same. The load-ahead sent no nearest-intersection or road-bearing request (request order in `walk/after/1198x930.json`: `a:w g g a:w` on the side question, no `n`).

## The two strings, every state (M14)

| State | WHAT row | Generate hint |
|---|---|---|
| No pin, no road | Opens after you find the work | Type an address or pick on map first, then Generate turns on. |
| No pin, a confirmed road | road facts prefill from <road> (unchanged, Part 1 §2.2) | not changed by this branch (not walked) |
| A pin, no kind chosen | pending: kind of work not chosen | Choose the kind of work |
| A pin, kind chosen, WHERE not confirmed | **Opens after you confirm where** (was "pending: kind of work not chosen") | **Confirm where the work is first** (was "Choose the kind of work") |
| WHERE confirmed | the job's value, CHANGE | the next rank of the blocker chain (side, speed, … unchanged) |

Walked: `11-strings-kind-picked` at every size reads the new pair; `01-kind-question` reads the not-chosen pair. Unit-pinned in `lib/where-map-in-view.test.ts`. The verdict strip in the same states (#459, https://github.com/rtmakatura/conestruct/issues/459): a pin, no kind chosen, "◌ AWAITING KIND OF WORK" (unchanged); a pin, kind chosen, WHERE not confirmed, "◌ AWAITING WHERE CONFIRMATION" (was "◌ AWAITING KIND OF WORK"); every other strip state unchanged. Mounted in `components/GeneratorShell.no-location.test.tsx`; evidence in `validation-artifacts/committed/missions/ux-followups-465-461-459/issue-459/`.

## New strings and sources

"Hide map", "Show map" (ruling 2); "Opens after you confirm where", "Confirm where the work is first" (ruling 4). The held picture's corner line reuses `AERIAL_WAIT` ("Drawing the corridor…").

## Crops (`crops/`)

Crops are DPR 1: `before/` shot at DPR 2 and halved with Pillow; `after/` shot at DPR 1 by the repair re-walk. Text and the strip stay legible; the folder is about 11 MB.
- `before/1198x930-01-01-kind-question.png`: the reported state, aerial wholly above the nav. `before/1198x930-04-04-side-answered.png`, `before/390x844-*`.
- `after/{1440x900,1198x930,1024x768}-*`: the two columns on the kind and side questions, after the side answer, the armed tap and the found crossing.
- `after/*-16-held.png` (all sizes) were taken before repair 2: the held picture shows no zoom buttons there; the final code keeps them (M20, `after/*-zoom-mid-load.png`).
- `after/{390x844,390x664}-*`: the strip on each question, pinned while scrolled (`07`), hidden (`08`), shown again (`10`), the tap question at full height (`12`, `13`).

## Tests

- Red proof: `lib/where-map-in-view.test.ts` on the unchanged code: 8 of 8 failed (`red-vitest-first.txt`, the run's summary lines, kept from the scratchpad). Repair 2: the two mid-load tests in `BandAerial.test.tsx` fail with the pre-fix line (`const shown = current;`) and pass with the fix (`red-vitest-repair2.txt`).
- Full vitest run 1: 2 failures, both `lib/design/type-census.test.ts` (`vitest-failures-1.txt`): the new `.a-aerial-toggle` font-size site. Not flaky: the census exception and pins were added (an existing token, as #439 and #440 did) and both pass alone and in run 2.
- Final: vitest `2943 passed | 1 skipped` (`vitest-final.txt`); the two repair-2 tests passing by name: `vitest-repair2-pass.txt`. Counted (+14: 8 in `lib/where-map-in-view.test.ts`, 4 in `components/bands/WhereBand.map-in-view.test.tsx`, 2 in `components/bands/BandAerial.test.tsx`).
- `WhereBand.kind-proposal.test.tsx` (lines 174-183) was loosened from "every geometry request carries the plan's kind" to "some request carries it, and only the plan's kind is checked": load-ahead reads carry each other kind on purpose (ruling 3), so "every" no longer tests what the test is for (the proposal never writes the kind); the radio state now asserts that directly.

## Repair 1 (independent reviewer, 2026-11-07)

Code: the held picture's line now shows in the strip (bottom-left, beside Hide map); "on the map above" -> "on the map" (M18); Hide map applies only while the card is open (M19, `mapHiddenNow`, unit-tested); the tap question's map unpins and opening the question brings it into view once (M8 amended). Write-up corrections in this file, checkpoint.md, rulings.md (M8, M11, M11a) and the commit message.

**Re-walked on the repaired code**, all five sizes, one at a time (one `next dev`, one backend, one headless browser per size, DPR 1; `next build` failed in `next/font`, so dev). Two earlier attempts left nothing: the slow-map route bypassed the gate helper (`route.continue()`, now `route.fallback()`), then the memory guard stopped the servers. The re-walk found one more fault and fixed it: unpinned, the tap question's map sat wholly above the screen when the question opened (390x844: frame -351..-101, from a walk before this fix whose JSON was replaced; not in the committed walk), so a tap had nothing to land on. Opening the tap question now brings the map into view once, with #446 T24's own least scroll (`scrollAerialPartIn`; nothing moves when it is already in view). Results:
- Tap question, armed: the map wholly on screen at every size, the question and "Tap where the two streets cross on the map." under it (`crops/after/*-cross-question-armed.png`). Found: as #446 (table above).
- Held line in the strip (`16-held`, taken before repair 2: these crops show no zoom buttons on the held picture, which the final code keeps (M20; `*-zoom-mid-load.png`); the side answered with the aerial slowed 4 s): "Drawing the corridor…" visible at every size, 25.8 px tall; at 390x844 at 167-193, inside the 52-202 strip (`crops/after/*-16-held.png`).
- Hide map / Show map: unchanged results (Hide 95.8x44, Show 102.1x44; hidden through the Undo; Show restores the strip); the card then closes on Confirm and the band collapses.
- axe 0 in every measured state at every size; no new target under 44 px (the zoom + / − stay 32x32 at desktop, as before).
- Answers: side 27-42 ms, Undo 29-36 ms, side again 40-52 ms, no blank box, no aerial or geometry request, at every size.
- Crops and `walk/after/` are this re-walk (DPR 1); `walk/before/` is unchanged.

## Repair 2 (independent reviewer round 3)

- **Held load keeps the controls.** `shown` now means "a picture is on screen, this state's or a held one", so the zoom buttons and #446's bar and live region stay through a held load (as #301's zoom hold kept them before this branch, `BandAerial.tsx:314` at `2cd6d72`); taps, the ring and the box still wait for this state's own picture. Walked (`script/zoomwalk.mjs`, `walk/zoom/*-zoom.json`, `crops/after/*-zoom-mid-load.png`) at 1440x900 and 390x844 on the tap question, Zoom in pressed from the keyboard with the aerial held back: mid-load the zoom buttons are there, focus stays on Zoom in, the bar keeps role `status` and its words, the frame is `aria-busy`, and the tap waits (`is-armed` off); when the picture lands the step is 1, focus is still on Zoom in and the tap re-arms.
- **The kind's `g=1`, explained.** A mounted test (`WhereBand.map-in-view.test.tsx`, "the kind question's answers are loaded ahead") shows the kind click reads no new geometry for its own scenario: the loaded-ahead scenario matches. The one read after a kind answer is the NEXT load-ahead: the card stays on the kind question until Next, so the other kinds are built again from the new scenario (shoulder-from-flagger is a new scenario; the near-intersection one is unchanged and remembered). That is the walk's `g=1` on the first kind answer, and why the second (back to shoulder) reads nothing.
- **WHERE folds to one row after Confirm (ruling 1).** `crops/after/1198x930-where-folded.png` and `390x844-where-folded.png` (`walk/zoom/*-folded.json`): the WHERE fact line, "✓ Where East Colfax Avenue Westbound · 170 ft W of Park Avenue · 1,000 ft · shoulder work CHANGE", 58 px at 1198 (140.6 px at 390, wrapped), no aerial on the page. The earlier `*-12-confirmed.png` crops land on WHAT with WHERE above the screen.
- **More crops committed:** `*-02-02-kind-answered.png`, `*-05-05-side-undone.png`, `*-06-06-side-again.png` at every size (DPR 1). The folder is about 16 MB.

## Session 2 (2026-11-08): the strip's picture size (M21)

The last review's blocking finding: at 390 the strip drew its picture at `--aerial-h`, 2 px taller than the full-height picture (the frame's content box, 1 px border top and bottom), so the two asked Mapbox for different sizes. Fix: `height: calc(var(--aerial-h) - 2px)` on the strip canvas (`app/globals.css`). Rebased onto `origin/mission-458-prod-check` first (one conflict in `globals.css`: #457's Undo block and this branch's block, both kept). Re-walked 390x844 and 390x664 only (one `next dev`, one stubbed backend, one browser; same scripts, same pins), replacing `walk/after/390x*.json`, `crops/after/390x*` and `walk/after/summary.txt`:
- Aerial requests: 6 -> 5 at both sizes; the second pin picture before the tap question is gone (order above).
- Every other measure at 390 holds: strip 150 px at the nav, tap question 51.8..301.8 at full height, found 214 -> 227 (390x844) and 214 -> 421 (390x664), Hide 95.8x44 / Show 102.1x44, axe 0, answers 35-52 ms with no requests, page errors 0.
- Band layout shift: 0.0986 (390x844, unchanged) and 0.0001 (390x664, was 0.0692).
- Desktop sizes are not re-walked: the change is inside the narrow container query only.

## Known limits

- A tap while a held picture is loading (M9, M20) does nothing, and the independent reviewer reports the bar still reading "Tap the intersection nearest the work". The ring and box wait for this state's picture by design; the bar doesn't say so. Not walked. Filed: https://github.com/rtmakatura/conestruct/issues/465. #460's body quoted 411-485 px of the aerial at desktop from an earlier walk; corrected on #460 to the committed 278-440 px.

- In two columns the aerial's `position: sticky` (M3) does nothing when the right column is shorter than the 560 px aerial: the stack is no taller than the aerial, so the aerial scrolls with the page. On the first question its top 150 px (1440x900), 120 px (1198x930) and 282 px (1024x768) are under or above the nav. #460 puts the page there, but the sticky doesn't hold it either. Filed with the strip case: https://github.com/rtmakatura/conestruct/issues/461.
- At 390 the strip covers the CONFIRM card's question heading when the page is scrolled to the card (crops `390x844-03`..`06`, `390x664-10`). Filed: https://github.com/rtmakatura/conestruct/issues/461.
- After a refusal or failure the box shows its sentence and no picture; the next load holds the picture from before the refusal (the last one drawn), marked "Drawing the corridor…", until the new one lands.
- In the strip the key and the line under the picture flow with the page (M5), so the key scrolls away under the strip while the work line on the picture is still shown.

- The strip crops the picture vertically to its middle 150 px. The work picture is framed on the corridor by the backend, not centred on the pin (390x844 `04`: the pin sits at the right edge), so on a north-south road the work segment runs top to bottom and its ends can fall outside the 150 px band; the strip then shows only the middle of the work. Not walked on a north-south road.

- The tap-map scroll (`components/bands/WhereBand.tsx:603-607`, `scrollAerialPartIn` when the tap question opens) also runs when a saved plan mounts straight onto the tap question, alongside BandStack's band landing (`scrollIntoView`). Not walked.
- The aerial cache's 24-entry cap (#301, CHOSEN) revokes the oldest object URL; if that is the picture being held while a new one loads, the held `<img>` loses its source. The cap is unchanged; load-ahead fills it a little faster, so this is slightly more likely than before. Not seen in the walk.

- The pin and road are the recorded Colfax answers; a real failed Overpass read wasn't walked (no load-ahead path reads Overpass).
- 390x664 and 390x844 are Chromium window sizes, not phones.
- A saved plan's kind is already confirmed, so answering its side fires the checks and the column folds under the write lock (existing behaviour); the Hide map choice resets with the band in that case. Fresh plans (the walked flow) keep it.
