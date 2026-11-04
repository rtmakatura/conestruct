# #438 local browser walk: verdict strip after Apply, answered rows, labels, headings

Run on 2026-11-04 on `issue-438-results-after-apply`, measuring the uncommitted working-tree edits on top of `617025d0`. `next dev` ran from this worktree's `conestruct/site` on port 3438. The main checkout's `conestruct/site/.env.local` was loaded into the process environment (nothing was copied into the worktree), and `MODAL_RENDER_URL` pointed at a local backend on port 8438 (`script/serve_replay.py`, copied from #439). That backend replays the recorded Overpass answers in `overpass-fixture/`, copied from `ux-group3-where/evidence/overpass-fixture`. `script/launch.ps1` starts both servers. Both were killed by process tree afterwards, and `python scripts/orphan_dev_servers.py` found 0 left.

`/api/road-bearing` is stubbed through a Playwright route with #437 branch 3's three roads, and the westbound East Colfax candidate is picked. The flow: pin "1600 E Colfax Ave, Denver" through the picker; the CONFIRM card (#439) with the first side option, then Next, then shoulder, then Confirm; then One-way (the map can't tell); then Generate. The walk answered the three NEEDS YOU questions with their first option (Yes each time), then pressed Apply answers. Apply made one render request at each width. The browser was Playwright Chromium at DPR 2, at 1440x900 and 390x844, with axe-core from `conestruct/site/node_modules/axe-core`.

Run 1 used a stub candidate with real way geometry (#439's pin B). Its corridor Overpass query was not in the recording, the live mirrors answered 403/502, and the plan declined (`walk/run1-1440-error.png`). Run 2, the one recorded here, uses the #437 stub, whose queries are recorded.

Files: `script/walk.mjs`, `script/launch.ps1`, `script/serve_replay.py`, the raw record `walk/walk.json`, the console log `walk/run.log`, and crops `walk/<width>-<state>-strip.png` and `walk/<width>-<state>-results.png` for the generated, staged and applied states, plus `walk/<width>-full-applied.png`.

## Results

| Check | 1440 | 390 |
|---|---|---|
| Strip after Apply matches A and P | PASS. A = 1, P = 3, and the sentence says 1 and 3. | PASS. A = 1, P = 3, and the sentence says 1 and 3. |
| Strip has no pill after Apply | PASS | PASS |
| Answered rows read "<Topic>: <answer>" | PASS | PASS |
| KEY DISTANCES label styled like TOTAL DEVICES | PASS. Both are JetBrains Mono, 10px, letter-spacing 1.8px, uppercase, rgb(147,160,176), weight 500. | PASS, same values. `.hero-meta` is shown at 390, not `display:none`; see the note below. |
| `.ny-prov` is Inter | PASS (`__Inter_176161`) | PASS |
| `.ny-cite` is mono | PASS (`__JetBrains_Mono_5f34dc`) | PASS |
| Heading outline in order, no skipped level | PASS | PASS |
| axe, generated state | PASS, 0 violations | PASS, 0 violations |
| axe, staged state | PASS, 0 violations | PASS, 0 violations |
| axe, applied state | PASS, 0 violations | PASS, 0 violations |
| Targets under 44 px in `.results-stack` and `.status-slot` | PASS, none at any state | PASS, none at any state |

## Strip text

- Generated: "⚠ Plan ready. Answer 3 quick questions before you send it."
- Staged (all three answered, not applied): the same sentence. The questions stay open until Apply.
- Applied, both widths: **"⚠ Plan ready. 1 item above and 3 under Pending need a check before field use."**

After Apply, A is the number of `#site-corrections .ny-items > li` rows that are not `.nyq-row`. There is one: "⚠ Site corridor validation · needs attention · OpenStreetMap". P is the leading number of the Pending row's `.disc-count`, which reads "3 not verified yet", so P = 3.

## Answered rows (`.nyq-row`)

- Staged: "✓ Sidewalks: yes, they're there · not applied yet", "✓ Bike lane: yes, it's there · not applied yet". The third question was still the open card.
- Applied: "✓ Sidewalks: yes, they're there", "✓ Bike lane: yes, it's there", "✓ Intersection: yes, it's there". Each row has an UNDO button.
- Not exercised: every answer was Yes, so the "no" wordings (such as "Intersection: no, there isn't one") were not seen in the browser.

## Note on 390

The brief expected `.hero-meta` to be `display:none` at 390. In this build it is shown: KEY DISTANCES appears under the TOTAL DEVICES and DEVICE TYPES cells, listing Taper 40 ft, Buffer 200 ft, Device spacing 30 ft o.c. and Work zone 1,000 ft (`walk/390-applied-results.png`). Its label's computed style matches TOTAL DEVICES at 390 too.

In the staged state, all three labels share a dimmer ink, rgb(126,139,154), at both widths. KEY DISTANCES still equals TOTAL DEVICES there.

## Heading outline (visible headings, in document order)

- 1440, generated: h1 "Method of Handling Traffic plan generator", h2 NEEDS YOU, h3 "Are there sidewalks along the work zone?", h2 YOUR PLAN, h2 DOWNLOADS, h3 Plan sheet, h3 Device list, h3 Crew instructions, h3 Audit trail.
- 1440, applied: the same without the question h3, because no question is open.
- 390: the same order. The four Downloads card h3s sit behind the "6 files, quote included" fold and are not rendered until it opens.

## axe

There were 0 violations at every state (generated, staged, applied) at both widths. The earlier `heading-order` violation on `#needs-you-h` no longer appears.
