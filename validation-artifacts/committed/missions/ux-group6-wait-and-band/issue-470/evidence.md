# #470 evidence: the Generate wait (UX group 6, Part 1), after repair cycle 2

Branch `issue-470-generate-wait` off `origin/mission-466-prod-check` (385b6c0).

## How it was measured

- **Servers:** local `next dev` on this worktree (port 3470) and the local backend through `script/serve_stub.py` / `scripts/verify-generate-cls-stub.py` (port 8470).
- **Overpass:** stubbed and replayed only, from ux-group3-where's and ux-site-map's recorded answers. `walk/overpass-asks.txt` lists the asks: all replays, no misses, no live call. `/api/road-bearing` was stubbed from the same fixture.
- **The walk:** pin 1600 E Colfax Ave, Denver; shoulder work; the first side. Chromium at DPR 1.
- **The gate header** went only to the site's own origin: `newGatedContext`, and the held audit's own fetch guarded by `isSiteRequest`.
- **The hold:** a local audit answers in about 0.2 s, inside the 500 ms input window, where no shift is counted. So the audit's answer is held 4 s. That's shorter than any measured warm production Generate (4.7–8.4 s; cited by file and line in checkpoint.md § The trace), so it's a lower bound on production's wait, not a match for it. The forced slow step holds it 15 s.

### The permanent check (ruling 8)

`scripts/verify-generate-cls.mjs`, with `scripts/verify-generate-cls-stub.py`. The command, from the repo root:

```
# 1. backend, Overpass replayed (optional: WALK_SCAN_MODE=empty | signals)
uv run --extra dev python scripts/verify-generate-cls-stub.py . "validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture;validation-artifacts/committed/ux-site-map/evidence/overpass-fixture" 8000
# 2. the site against it (MODAL_RENDER_URL=http://127.0.0.1:8000), then:
node scripts/verify-generate-cls.mjs
# production:
SITE=https://www.conestruct.com HOLD_MS=0 GATE_BYPASS_TOKEN=... node scripts/verify-generate-cls.mjs
```

It exits 1 when any width reaches 0.1, or when the outline box check fails.

**Its limits** (documented, not changed in this round):
- The outline box check runs only when `HOLD_MS >= 2000`. The production command (`HOLD_MS=0`) measures layout shift only and skips the box check without saying so.
- The `REDUCED=1` pass reads `animation-name` on 6 elements after the settle: the strip, NEEDS YOU, other conditions, Your plan, the Downloads cards and the reference group. It doesn't cover the Setup row, or the in-flight sheen and spinner. The vitest cascade test (`GeneratorShell.generate-wait.test.tsx`) covers every animated selector in the #470 block.

### The outline box check (cycle 2)

Layout shift can't see an outline of the wrong size or place, because the sections mount new at the swap. So the check records each outline block's box while the call is in flight, and its section's box after the settle. Tolerance is 8 px, CHOSEN (`--space-tight`).
- **Fails on:**
  - a height difference in the fixed-layout sections: the map frame when present, Setup, Your plan, the reference group;
  - any top difference, and Downloads' height, when NEEDS YOU came in at its reserve.
- **Reports only:** NEEDS YOU's own delta. Its height is unknowable before the scan answers, a known open question for Ryan.

| Fixture | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|
| recorded (3 questions) | all top/height deltas 0 (map 0/0), PASS | all 0, PASS | all 0 except refs 1/0 (top +1 px), PASS |
| recorded, reduced motion | all 0, PASS, no animation on the 6 settled elements | all 0, PASS | all 0 except refs 1/0, PASS |
| signals-only (1 question) | NEEDS YOU −89 px (reported); sections below follow it; map 0/0, heights 0; PASS | the same | NEEDS YOU −51; PASS |
| empty (no question, 1 row) | NEEDS YOU −909 px (reported); map absent (no question); Downloads −46 px (its header carries the question count); PASS | the same | NEEDS YOU −987; Downloads −65; PASS |

- **The check found two real errors**, fixed in cycle 2: the map placeholder was 9 px high at desktop and 55 px high at 390, and the reference group's outline sat 26 / 27 px too high.
- **The map** now takes the frame's CSS size and a measured top: `--ro-map-top` 157 / 221, R145-14.
- **On the no-question fixture the sections land higher than their outlines stood: up to 1052 px at 390 and 954 px at 1440 and 1198 (the reference group; NEEDS YOU's own delta is 909 / 987).** Layout shift reads 0 only because they mount new. That's the open question for Ryan: how much room to reserve for a NEEDS YOU whose size the page can't know.

`script/walk470.mjs` is the evidence harness: frames, crops, the answer leg and the contrast probe. It measures the same number.

## Layout shift (#452's measure: `layout-shift` with `hadRecentInput` false, from the press to the settled strip)

| Fixture (scan replay) | NEEDS YOU after | 1440x900 | 1198x930 | 390x844 |
|---|---|---|---|---|
| Before #470, recorded Colfax (3 questions) | 1025 / 1135 px | 0.554 | 0.344 | 0.866 |
| **After**, recorded Colfax (3 questions) | 1025 / 1135 px | **0** | **0** | **0** |
| **After**, scan replayed with signal nodes only (1 question) | 936 / 1084 px | **0** | **0** | **0** |
| **After**, scan replayed empty (no question; 1 ledger row) | 116 / 148 px | **0** | **0** | **0** |
| After, first build of this branch, scan empty | 116 / 148 px | 0.219 | 0.317 | 0.377 |

- **Sources:** `walk/no-question/verify-generate-cls-{recorded,signals,empty}.txt` and `walk/after/summary-*.txt` (one file per mode).
- **The other modes:**
  - `frames`: 0 at every width.
  - `slow`: 0 at 1440 and 0.0003 at 390.
  - `reduce`: 0.0017 at 1440 and 0.0007 at 390. That's `span.nyq-map-key-note` settling, and the same entry was in the before run.
- **The empty case:** at this pin, an empty scan still leaves one NEEDS YOU row (a tier item), so a NEEDS YOU of zero height wasn't reachable here.
- **What fixed the first build's 0.22–0.38** (R145-3, repaired): the results' wrapper div stood through the wait and moved up into view when NEEDS YOU came in short. Now nothing that stands through the wait sits among the outlines: Setup, Your plan, Downloads and the reference group are outline blocks, and their real sections mount at the swap. **This is a fact about the metric.** On a clean road, Your plan appears higher than its own outline stood, where NEEDS YOU's outline was. Ryan's hand check should look at that frame (it's the swap, not a slide).
- **The answer** (#474, ruling 7 open): Apply answers measures 0.2465 / 0.3606 / 0.6427 after, total per run (before #470: 0.3829 / 0.5591 / 0.7711, total per run). That's NEEDS YOU collapsing after its questions are answered, plus the "Previous answer" ribbon leaving.

## The trace (ruling 2): one call fills every section

| Section | Filled by | Height before the data |
|---|---|---|
| The strip | the audit's `plan_flags` | `--status-h` (57 / 80). The status line measured the same. |
| NEEDS YOU | `sections.site_scan` | `--ro-needs-h` 1025 / 1135, CHOSEN, the measured common case |
| N other conditions checked | the scan | `--ro-other-h` 46, measured |
| Setup | the scenario | `--setup-box-h`, rule 28's row (the outline's own block, R145-12) |
| Your plan | `breakdown` | `--ro-plan-h` 203 / 344, measured |
| Downloads | `breakdown` | `--ro-dl-h` 340 / 283, measured |
| Search and reference | the audit ledger | `--ro-refs-h` 257 / 284, measured |

After Generate the page waits on one call: `POST /api/render/audit` (scan + layout + check + device list, #306). `/api/needs-you-map` fires only once a question with a map has mounted, inside its fixed frame, and the quote waits for the operator. So the status line shows one step (R145-1).

## The status line in view (ruling 3, R145-11)

- The press scrolls the strip's slot under the nav (`window.scrollTo`, scroll only).
- At 1440, scrollY went from 181 at the press to 18. At 390 it went from 1360 to 8.
- Focus still lands at the settle (#193), and the settle's landing (#152 E) still fires once. Every pin passes as written.

## Frames (`crops/`, half size unless noted)

- **The status line and outline in view after the press, with the map placeholder where the map lands (cycle 2):** `after/1440x900-frames-f02-717ms.png`, `after/390x844-frames-f02-509ms.png`.
- **The swap** (sections fading in, then settled): `after/1440x900-frames-swap-13-4471ms.png` then `-swap-16-5228ms.png`; `after/390x844-frames-swap-16-4104ms.png`, `-swap-19-4679ms.png`.
- **The blank map frame:** right after the swap, the NEEDS YOU map frame is a blank dark box. `after/1440x900-frames-swap-13-4471ms.png` shows it: the sections are fading in and the frame has no picture. That holds until `/api/needs-you-map` answers, and `-swap-16-5228ms.png` shows the frame once the picture has landed. During the wait the outline showed the dimmed WHERE aerial in that place. After the swap the real frame starts empty, so the picture goes from the aerial to blank to the map. This is an open question for Ryan.
- **1198x930** (run after cycle 2, `walk/after/1198x930-frames.json`, `1198x930-slow.json`, summaries `summary-frames-1198.txt` / `summary-slow-1198.txt`; Generate CLS 0 in both):
  - `after/1198x930-frames-f02-764ms.png`: the status line and outline after the press, with the dimmed aerial where the map lands.
  - `after/1198x930-frames-swap-13-4513ms.png`: the swap.
  - `after/1198x930-frames-settled.png`: Plan ready.
  - `after/1198x930-slow-f60-14091ms.png`: past 14 s, the warn note in the outline.
  - Full size: `strip/1198x930-slow-strip-48ms.png` (the status line) and `strip/1198x930-slow-strip-14091ms.png` (the warn look).
- The other slow-step crops (`after/1440x900-slow-*`, `after/390x844-slow-*`, and the 1440 and 390 `strip/*` crops) are from cycle 1, before fix 3 moved the map placeholder. The copy and the warn look are unchanged.
- **The slow step (past 14 s):**
  - `after/1440x900-slow-f62-14156ms.png` and `after/390x844-slow-f81-14117ms.png`. The 390 crop shows the warn strip and the note, "The road check stops after 20 seconds. If it does, the page will say so and offer a retry."
  - Full size: `strip/1440x900-slow-strip-37ms.png` and `strip/390x844-slow-strip-24ms.png` (spinner, the step, STEP 1 OF 1, the bar); `strip/*-slow-strip-141*ms.png` (the warn look).
- **Reduced motion (cycle 2, after fix 1):** `after/1440x900-reduce-f00-36ms.png`, `-reduce-swap-01-4141ms.png`, `after/390x844-reduce-f00-27ms.png` and `-reduce-swap-02-4359ms.png`. In the first frame after the swap, the strip ("Plan ready…") and the sections are at full opacity with no rise. Cycle 1's crops showed the strip mid-fade, because its reset lost on specificity. The permanent check's reduced pass reads `animation-name: none` on 6 settled elements, not Setup: the strip, NEEDS YOU, other conditions, Your plan, the Downloads cards and the reference group (`walk/no-question/verify-generate-cls-recorded-reduced.txt`). The vitest cascade test covers every animated selector.
- **An answer:**
  - `after/1440x900-real-plan-before.png` and `-plan-after.png` are identical: Your plan reads 40 devices and 12 types before and after. No delta or reason is drawn because ruling 7 is deferred to #474.
  - `after/1440x900-real-answer-inflight.png` shows the NEEDS YOU card during the re-build: the map, the two answer rows, Next question, and the WorkingBand ("RE-GENERATING after 3 corrections"). Neither Your plan nor the status line is in view.
  - The two grey circles over the answer rows are unexplained. Nothing I found in the code draws a round element on those rows (the only `border-radius: 50%` rules are the WHERE aerial's tap ring, the landing's dots and the spinner).
- **Today's wait:** `before/1440x900-real-f00-59ms.png` and `before/390x844-real-f00-26ms.png` (the locked band stack and "02 · RESULTS No package yet").
- **Today's settled page:** `before/1440x900-real-settled.png` and `before/390x844-real-settled.png`, the plan after the 0.554 and 0.866 shifts, with the band stack collapsed and the results moved up.

## Contrast (Rule 13; rendered computed colours on the nearest opaque ground, from the walk's probe in `walk/after/1440x900-slow.json` `contrast`)

| Text | Colour on ground | Ratio | WCAG AA (4.5 body text) |
|---|---|---|---|
| "Checking this stretch of road", on its `--panel-ground` chip | #c8d1dd on #0f1c29 | 11.18 | pass |
| The same label on the bare 35% aerial (before the chip; worst case is a white pixel at 35% over `--pri-off`, #6c7680) | #c8d1dd on #6c7680 | 3.0 | fail, which is why the chip was added |
| The cold-start note | #c8d1dd on #14202e | 10.68 | pass |
| The warn note | #f4c020 on #14202e | 9.73 | pass |
| The step count (idle) | #93a0b0 on #101c29 | 6.47 | pass |
| The step count (warn) | #93a0b0 on #221e10 | 6.26 | pass |
| The step words (idle) | #c8d1dd on #101c29 | 11.16 | pass |
| The step words (warn) | #f4c020 on #221e10 | 9.84 | pass |

## axe and the 44 px measure (settled results, `real` mode)

At 1440x900, 1198x930 and 390x844: axe on `section.results` found 0 violations, and 0 targets are under 44 px.

## Device counts unchanged (park item: none hit)

For the same inputs, the walk's Your plan text is identical before and after at all three widths, on Generate and after Apply answers. Each reads "TOTAL DEVICES 40 … DEVICE TYPES 12". See `walk/before/*.json` and `walk/after/*-real.json` (`planBefore`, `planAfter`). No request body changes and no Python changes.

## Every user-facing string and its source

| String | Where | Source |
|---|---|---|
| "Checking the road and laying out the taper, buffer and devices…" | status line (`StatusBar.tsx` `WAIT_STEP`) | ruling 3's two example names, joined for the one observed call (R145-1) |
| "Step 1 of 1" | status line | ruling 3 ("Step N of M"); group 1 ruling 2 (a mono caps label) |
| "The road data service is slow right now." | status line, warn, past 14 s | ruling 6, verbatim example |
| "The road check stops after 20 seconds. If it does, the page will say so and offer a retry." | outline note, past 14 s | the coordinator's wording (cycle 1). True in code: `SCAN_BUDGET_S = 20.0`, a wall-clock deadline (`src/api/site_scan.py:66-73`). A scan that runs out is `unavailable` and refuses with a 400 (`site_scan.py:17-21`), which the page shows as the refusal container with "Retry scan" (`GeneratorShell.tsx`, `scanRefusal`). |
| "The first plan after a quiet spell can take a few extra seconds while the server wakes up." | outline note, past 2 s | today's SLOW_VERIFY_MS copy, as a sentence (group 1 ruling 2) |
| "Checking this stretch of road" | NEEDS YOU map placeholder | ruling 4, verbatim |

Removed: "02 · RESULTS" and "No package yet. The plan is being built." (rule 117's placeholder; ruling 1). The `.results-placeholder` CSS stays, because the type census pins its font-size site (`lib/design/type-exceptions.ts:428`). It's a small cleanup for later.

## Rule 5: predicted against actual

- **The first build:** see checkpoint.md. It wasn't predicted that `lib/design/motion.test.ts` would need to admit the three ruled animations.
- **Cycle 1:** the churn was added to checkpoint.md before the diff. It wasn't predicted that three pins would change:
  - `GeneratorShell.results-head.test.tsx`: rule 28's reservation is now also held by the outline's Setup block (R145-12).
  - `GeneratorShell.near-intersection.test.tsx` and `GeneratorSidebar.manual-pin-move.test.tsx`: these now wait for the Downloads stub to appear with the plan.
- Byte-identical: request bodies, the backend, the settled sections' markup and the WorkingBand.

## Tests

See `tests.txt`.
- `red-vitest.txt`: the new test, red before the first build.
- `full-run-1-failures.txt` and `full-run-2-failures.txt`: failures saved before any re-run. tests.txt has a table of each failure's cause and resolution, and says which were re-run on their own.
- `red-vitest-cycle2.txt`: the reduced-motion cascade test, red before fix 1.
- `announce-10-runs.txt`: the flaky case, 10 of 10 green after R145-10.

## Calls and follow-ups

R145-1 to R145-15 are in `rulings.md`. Filed:
- #473: "Finish without it".
- #474: ruling 7 and the answer's shift.
- #475: the S7 mid-flight unmount race behind R145-10.

Open questions for Ryan:
1. NEEDS YOU's reserve when its height is unknowable. On the empty scan the sections land up to 1052 px at 390 and 954 px at 1440 and 1198 (the reference group; NEEDS YOU's own delta is 909 / 987); on one question, 89 px (50–52 at 390). Layout shift reads 0 only because they mount new.
2. The bar's indeterminate sheen against #281 rule 14 (R145-1).
3. The 14 s threshold against the unexplained 12.2 s cold scan (R145-4).
4. Ruling 7 deferred to #474 (R145-7, OPEN; scope: needs new backend fields).
5. The blank map frame between the swap and the map's load (§ Frames).
6. The raw px spacing values against ruling 9 (§ Ruling 9 below).
7. **R145-10, OPEN:** an S7 APPLY re-build keeps the old band-stack swap, its layout shift unmeasured, until #475.
8. **R145-11:** the scroll at the press leaves #152 E's settle scroll nothing to do. It still fires once, onto the place the viewport already is. Ryan may want the press scroll or the settle scroll, not both.
9. **The spinner's 0.9 s turn**, CHOSEN: the LiveMotion board's spinner turns once every 900 ms (`spinDeg: (ms / 900) * 360`).
10. **#452:** Ruling 8 says "(closes #452)"; this branch does not close it (after-answer shift via #474, prod measurement pending). Close #452 now, or keep it open?

**This does not close #452.** Its after-answer acceptance still reads 0.2465 / 0.3606 / 0.6427 (target under 0.1), carried by #474. Its production measurement is the post-ship prod check.

## Ruling 9: raw px spacing in the #470 CSS (for Ryan to rule)

Group 1's three gaps are tokens: `--space-tight` 8, `--space-block` 16, `--space-section` 24. These values in the #470 block are raw px instead:

| Value | Selector | Property | Reason |
|---|---|---|---|
| 14px | `.workbench .ro-needs` | margin-bottom | matches `.workbench .needs-you { margin-bottom: 14px }` (the section it outlines), so the swap lands in place |
| 38px | `.workbench .ro-refs` | margin-top | measured by the outline check: the reference group stands 38 px under Downloads (the cards' own bottom room plus `.results-disc`'s 12) |
| 10px | `.workbench .ro-refs` | gap | matches `.results-disc { gap: 10px }` (#288 rule 27's in-group gap) |
| 24px | `.workbench .status-slot > .status-bar.wait-line > span.wait-count` (at 600 px and below) | margin-left | lines the count up under the step words: the 12 px spinner plus the strip's 12 px gap. It isn't `--space-section`, though the number is the same. |
| 12px | `.workbench .wait-spin` | width, height | the spinner's size, matching the status glyph's column. It's a size, not a gap, listed for completeness. |
| 16px | `.workbench .ro-setup` | margin-bottom | matches `.results-head-slot { margin-bottom: 16px }`. Equal to `--space-block` but written raw. |

Sizes that aren't spacing: 44px (`.ro-head`, the 44 px header row), 20px (`.ro-line`), 2px (the bar's height and the spinner's border). The 1px in `.ro-map`'s margin is the card's border.
