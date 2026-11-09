# #477 evidence: Ryan's answers to #470's open questions

Branch `issue-477-generate-wait-answers` on `issue-469-band-one-height` `a239a0e`. Rulings and self-rulings: `rulings.md`. Plan and churn prediction (written before the diff; amended before R145-8's line and again before repair cycle 1): `checkpoint.md`. Every walk number and log below is from the final CSS, re-run in repair cycle 1; the only older files are the three `crops/*-slow-strip-pre-final-css.png` pictures (before R145-8's withdrawal; only `--ro-dl-h` differed), and `walk/probe-downloads.txt` records both sessions on purpose.

## What changed, per answer

1. **One-question room.** `--ro-needs-h` 1025 / 1135 → 934 / 1082 (R145-1). With no question the outline closes at the swap; the permanent check now fails on any `[data-outline]` left after the settle. (R145-8, a Downloads reserve change, was made and then withdrawn in repair cycle 1; `--ro-dl-h` is #470's 340.)
2. **No bar, no count.** `WaitLine` is the spinner (or ⚠) and the step name. The count and bar spans, their CSS and the 600 px rules for the count's row are gone.
3. **The 14 s line.** `WAIT_ROAD_SLOW` = "This is taking longer than usual. The first plan after a quiet spell can take up to 30 seconds." (byte for byte, pinned by the generate-wait test).
4. **Map frame.** Until the NEEDS YOU map is shown, `.nyq-map-frame` holds `OutlineAerial`, the outline's own placeholder: the WHERE aerial for this pin at 35 % and partly grey under the sheen, or the grey block with none remembered. Decorative, frame `aria-busy`.
5. **Spacing.** 14 → `--space-block` (2 px out of the reserve), 38 → `calc(--space-section + --space-block)` (40), 10 → `--space-tight`, 24 removed with the count, 12 → 16 px spinner, 16 → `--space-block`. A CSS test fails on any other px in a margin, padding or gap in the block.
6. **#152 E settle scroll removed.** The post and declined branches move focus only. `GeneratorShell` no longer arms `armLandingCheck` (BandStack still does).
7. **#452 stays open.** GitHub closed it when #470 shipped, because ff7b9a26's body quoted ruling 8's close keyword and GitHub read it inside the quote. This mission reopened it on 2026-11-09, with a comment. This commit's text has no close keyword for any issue, quoted or not (R145-7).

## The permanent check (`scripts/verify-generate-cls.mjs`, stub backend, Overpass replayed)

Local `next dev` on this worktree (:3477) against `scripts/verify-generate-cls-stub.py` (:8477), launched by `script/launch.cjs`, run by `script/run-verify.cjs` (the gate token is read from the scratch secrets file, never printed). Audit held 4 s (the script's default).

### Generate layout shift, next to #470's numbers

| Fixture | Before #470 | #470 (after) | **#477** 1440x900 | **#477** 1198x930 | **#477** 390x844 | Source |
|---|---|---|---|---|---|---|
| recorded Colfax (3 questions) | 0.554 / 0.344 / 0.866 | 0 / 0 / 0 | **0** | **0** | **0** | `walk/verify-generate-cls-recorded.txt` |
| signals (1 question) | — | 0 / 0 / 0 | **0** | **0** | **0** | `walk/verify-generate-cls-signals.txt` |
| empty (no question) | — | 0 / 0 / 0 | **0** | **0** | **0** | `walk/verify-generate-cls-empty.txt` |
| signals, `REDUCED=1` | — | recorded: 0.0017 (1440), 0.0007 (390) | 0.0019 | 0.0024 | 0.0007 | `walk/verify-generate-cls-signals-reduced.txt` |
| signals, held 16 s (the 14 s line) | — | slow: 0 (1440), 0.0003 (390) | 0 | 0.0001 | 0.0002 | `walk/slow-and-frame.txt` |

All under 0.1; every run passes the outline check and "outlines left after the settle: 0". The reduced-motion entries are, as in #470, the map key's note settling (`span.nyq-map-key-note`); reduced motion: no animation on the 6 settled elements at all three widths.

### Where NEEDS YOU lands against its outline (top / height delta, px)

| Fixture | 1440 and 1198 | 390 |
|---|---|---|
| **1 question** (the reserve) | NEEDS YOU 0 / +2 (936 vs 934); other, Setup, Your plan, Downloads 0 / 0; reference group −2 / 0; map 0 / 0. **Outline check PASS, every top checked.** | NEEDS YOU 0 / +2 (1084 vs 1082); Downloads −1 / 0; reference group −1 / 0; map 0 / 0. PASS. |
| 3 questions (recorded) | NEEDS YOU 0 / +91 (1025 vs 934); the sections under it land 89 px lower, a downward growth (other, Setup, Your plan, Downloads +89 / 0; reference group +87 / 0; map 0 / 0); layout shift 0 because they mount new. PASS. | NEEDS YOU 0 / +53 (1135 vs 1082); sections +51 / 0; reference group +50 / 0. PASS. |
| **No question** (empty) | NEEDS YOU 0 / −818 (116 px: one ledger row, no card); sections land 820 px higher (reference group 867); map absent. **No outline left after the settle.** | NEEDS YOU 0 / −934 (148 px); sections 936 higher (reference group 1003). No outline left. |

At this pin the empty scan still leaves one NEEDS YOU row, so a NEEDS YOU of zero height isn't reachable here (as in #470).

The check script logs "N visible question card(s)": the card shows one question at a time, so the recorded fixture logs 1 while its answer has 3 questions (the strip says "Answer 3 quick questions").

**Downloads' height varied between dev-server sessions** (`walk/probe-downloads.txt`). In the first session the settled Downloads measured 359 px at 1440 and 1198 on both question fixtures, on the base sources and on this branch alike: the four cards' grid was 201 px tall. That failed the one-question outline check (Downloads +19, reference group +17), and R145-8 raised `--ro-dl-h` to 359. In the re-walk on a fresh dev server the same fixtures measured 340 (grid 182 px, same words), so 359 failed the other way. R145-8 is withdrawn; `--ro-dl-h` is #470's 340, and every fixture passes at it (tables above). The cause of the 19 px wasn't isolated (open for Ryan, below).

### The 14 s line (held 16 s, `walk/slow-and-frame.txt`; pictures `crops/*-slow-strip-pre-final-css.png`, pre-final CSS, only `--ro-dl-h` differed)

At 14.5 s the line reads "⚠ This is taking longer than usual. The first plan after a quiet spell can take up to 30 seconds." with `caution is-slow`. Height: 57 px at 1440 and 1198 (`--status-h` 57, one line), 80 px at 390 (two lines, inside `--status-h` 80). The slot measured the same, so the line never grows the strip.

### The map frame (answer 4, `walk/axe-44px.txt`, `walk/slow-and-frame.txt`, `crops/*-frame-standin.png`)

Read in the first evaluate after the outline left, at all three widths: the stand-in is in the frame (`blob:` WHERE aerial, opacity 0.35), no map image yet. With `/api/needs-you-map` held 4 s (the axe run, `walk/axe-44px.txt`: `SWAP` and `SETTLED map img false` lines), the frame still shows it 2.5 s after the settle (the crops, shot in that run); without the hold the map is in by then (`SETTLED map img true`). No frame was blank or dark at any reading.

## Open for Ryan

- **The reference group's margin** (`.ro-refs`) is 40 px = `--space-section` + `--space-block`, a token composite, CHOSEN (R145-4). The group lands 2 px above its outline, inside the check's 8 px.
- **Under reduced motion** the map-frame stand-in shows "loading" only by dimming (no sheen), with `aria-busy` on the frame for screen readers. That matches the outline under reduced motion.
- **Past 14 s two slow sentences show together:** "This is taking longer than usual. The first plan after a quiet spell can take up to 30 seconds." in the strip, and "The road check stops after 20 seconds. If it does, the page will say so and offer a retry." in the outline's note (R145-3 kept the note).
- **The S7 APPLY path is unmeasured** (R145-6): its no-scroll settle is reasoned from the code (`GeneratorShell.tsx:833`), not walked; APPLY's flight is still open as #470 R145-10 / #475.
- **Downloads' 19 px between dev-server sessions** (card grid 201 vs 182 px, same words), cause not isolated. `--ro-dl-h` stays 340; the post-ship production check would show which height production draws.

## axe and the 44 px measure (`walk/axe-44px.txt`)

One-question fixture, `section.results`, at 1440x900, 1198x930 and 390x844, twice each: with the stand-in in the frame (the map held) and after the map loaded. axe: 0 violations in all six; targets under 44 px: 0 in all six.

## Device counts unchanged (park item: none hit)

No backend file, request body or device logic changed (the diff is CSS, the status line, the outline, the map frame's loading state, the settle's scroll, tests and the check script). This walk didn't read Your plan's counts; the strips match #470's for each fixture ("Answer 1 quick question" / "Answer 3 quick questions" / "1 item above and 2 under Not checked yet").

## Every changed user-facing string and its source

| String | Where | Source |
|---|---|---|
| "This is taking longer than usual. The first plan after a quiet spell can take up to 30 seconds." | status line, warn, past 14 s | #477 answer 3, verbatim |
| "Step 1 of 1" | removed | #477 answer 2 |

The WHERE aerial stand-in carries no words (alt ""). The outline's notes are unchanged (R145-3).

## Tests

- **Red proof** (`red-vitest.txt`): the new and changed tests run against the base sources (the site files checked out from `a239a0e`, the tests from this branch): 13 failed, 79 passed. Two new cases pass on base by design, as guards: a failed generation scrolled nothing before either, and a failed map shows no stand-in. Sources then restored byte-identical (diff compared).
- **The #152 E tests, updated, with the reason:** `GeneratorShell.post-generate-scroll.test.tsx`'s six #152 E cases kept their shapes and now pin that the settle scrolls nothing (`scrollIntoView` and `window.scrollTo`) and still moves focus (#193), because Ryan removed the settle scroll (answer 6). StatusBar is mocked in that file, so the press's own scroll can't fire there; it stays pinned with the real StatusBar in `GeneratorShell.generate-wait.test.tsx`. The `armLandingCheck` unit cases import from `@/lib/landing`, since GeneratorShell no longer re-exports it; they stay because BandStack arms it. `GeneratorShell.a11y-focus.test.tsx` "scroll still fires" now expects no settle scroll, for the same reason.
- **Full run 1** failed 2 (saved in `full-run-1-failures.txt` before any re-run). Each failed alone too, both real pins of the removed behaviour: the a11y-focus case above, and `lib/design/motion.test.ts`'s animation list (the bar's `ro-sheen` is gone). Both updated.
- **Full run 2:** `Test Files 277 passed | 1 skipped (278)`, `Tests 2994 passed | 1 skipped (2995)` (baseline 2989 passed | 1 skipped). tsc clean; eslint clean on the four changed components. No backend change, so no pytest.
- **Repair cycle 1:** the six affected files `Tests 107 passed (107)`; full run 3 `Test Files 277 passed | 1 skipped (278)`, `Tests 2994 passed | 1 skipped (2995)`; tsc clean.

## Rule 5: predicted against actual

| File | Predicted | Actual (+/−) |
|---|---|---|
| StatusBar.tsx | count and bar out, sentence, comments | 11 / 14 |
| ResultsOutline.tsx | `OutlineAerial` extracted, outline markup the same | 19 / 7 |
| NeedsYouMap.tsx | stand-in while loading | 12 / 1 |
| GeneratorShell.tsx | settle scroll and landing check out, focus kept | 27 / 66 |
| globals.css | #470 block only | 36 / 52 (R145-8 made, then withdrawn) |
| verify-generate-cls.mjs | outline-left check, comments; repair 1: the visible-card label | 15 / 5 |
| StatusBar / generate-wait / NeedsYouMap / post-generate-scroll tests | as predicted | 6/3, 42/11, 41/0, 59/75 |
| GeneratorShell.a11y-focus.test.tsx | "possibly" | 4 / 2 |
| lib/design/motion.test.ts | **not predicted** | 1 / 1 (its list of animation declarations named the bar's sheen) |

Byte-identical as predicted: backend, request bodies, device counts, `lib/corridor-aerial.ts`, `lib/landing.ts`, BandStack, WorkingBand.

## Lane

`python scripts/cosmetic_lane_check.py`: "OUT OF LANE: 1 of 116 paths fall outside" (`scripts/verify-generate-cls.mjs`).
