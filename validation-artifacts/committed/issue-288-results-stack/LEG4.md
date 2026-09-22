# issue-288 leg 4 — the Phase 1 push, all ten acceptance lines, at `f44377e`

**Run:** 2026-09-21. **Base:** `https://www.conestruct.com`. **Sha-gated both ends** —
`healthz` = `f44377e3bd96f18e0413fa52fbeab3069800b7e9` = `origin/main`. **Output:**
`%TEMP%\i288p1`, outside the repo, copied here. **Probe:** `i288-p1-probe.js`. **Poll:**
`i288-p1-poll.js`.

**113 rows · 7 FAIL, at 1440×1000 and 380×800.** Four of the seven are the S5-with-none pin
attempts; the three that are the product are all acceptance line 7, and both defects behind
them are fixed on this branch.

## The bundle poll

25 markers, all correct. Every clause's new surface present (`ny-cond`, `ny-apply`,
`site-condition-manual`, `--fs-hero-numeral`, `.pri`, `--fs-primary`, `dl-all-count`,
`results-disc`, the two promoted row names, `quote-total`, `results-stack`, `min-h-[32px]`)
and every retired one absent (`sc-grid`, `sc-leader`, the hero's ticks, `price-head`, the
intro, `zone-note`, `ns-strip`).

**Two poll markers were my probe's fault and are recorded because they nearly became a false
report.** `/tick tl/` matched the workbench FRAME's `ftick tl` — a different element that
stays. `/MHT package/` matched the working band's render label (`"MHT package ZIP"`) and the
sr-only announcement (`"Plan generated — MHT package ready."`), neither of which is the zone
heading. A static bundle grep cannot tell a heading from a string that merely contains the
same words; that claim moved to the rendered DOM, where the leg asserts it (and it passes at
both widths).

## #288's acceptance, line by line

| # | line | verdict |
|---|---|---|
| 1 | Every S5/S6/S8 state at both widths | **PASS for S5-with-items, S6, S8**; S5-with-none not reached on prod (below) |
| 2 | One primary per state at both widths | **PASS** — S5-with-items: 0 rule-130 primaries + 1 filled action, NEEDS YOU owns it, the zip is `act tr-step`; 4 cards stay flat (ruling 182) |
| 3 | NEEDS YOU always expanded; ledger the only sorter | **PASS** — no caret, header "3" = 3 tier rows (ruling 185), decomposition in words |
| 4 | File count stated once, from the served bundle | **PASS** — `"4 files"` appears exactly 1× at both widths, from `BUNDLE_PART_KINDS` |
| 5 | Reserved first row holds at the settle | **PASS** — 44 px at both widths |
| 6 | Ribbon ≥ 4.5:1 mid-flight on the composited surface | **PASS — 11.16:1 at both widths**, measured on pixels (below) |
| 7 | Left edges ±1; TARGETS 0 under 32/44; axe `target-size` 0 at 380 | **FAIL at 1440-pass / 380-fail** — 1440: 38 interactive, 0 under 32. 380: 2 under 44, 1 axe violation. Both fixed on this branch (below) |
| 8 | Zero `pageerror`; nav citation carries no date | **PASS** — 0 pageerror, 0 hydration-shaped, both widths; nav reads `TA-3 · S-630-1 · MUTCD 2023 · CDOT`, no date |
| 9 | Nothing in §8 KEPT changes behaviour | **PASS by construction**, and measured where it renders: the draft notice, the refusal container, the announcement region and the four download cards all present and unchanged |
| 10 | Ryan hand-check on a hard-refreshed tab | **OUTSTANDING** |

**Eight of ten closed**, against five at leg 3. Line 7 is measured and fixed-not-yet-shipped;
line 10 is yours.

## Line 6 — measured on composited pixels, not computed

**11.16:1 at both widths.** Text `rgb(200,209,221)` = `#c8d1dd` — rule 102's own colour — on
`rgb(16,28,41)` = `#101c29`.

Method, because the method is the point: the viewport is screenshotted mid-flight (a strip
edit provokes the refetch; the audit/breakdown responses are delayed 9 s so the in-flight
window is long enough to capture — the delay is instrumentation of *timing*, the pixels are
the ones the page actually composited), the PNG is decoded onto a canvas **in the page**, and
the ribbon's own rect is sampled. Nothing reads a token. Computing this from tokens is
exactly what let 2.39:1 ship for as long as it did (#259).

**Two probe defects found on the way, both of which produced a plausible wrong number:**

1. **The first sample read the BORDER, not the text.** It reported `1.57:1` at 1440 with
   `rgb(44,62,83)` — `#2c3e53`, which is `--rule`, the ribbon's 1 px border. On a wide, short
   ribbon the border covers more pixels than the antialiased glyphs do. Fixed by insetting
   the sample 4 px past the border. A number that looks like a failure is as dangerous as one
   that looks like a pass: I would have reported a contrast defect that does not exist.
2. **The share threshold excluded the text.** At ≥0.25% the glyph body (0.293% of a 39,312 px
   box at 1440) fell under it. Lowered to 0.05%, and the top five candidates are now reported
   so the reading can be audited: `11.16:1@0.293% 11.06:1@0.056% 10.9:1@0.079% …` — a tight
   cluster at ~11:1 is the glyph body and its antialiasing, not a stray.

**And a third guard, added after the run because two wrong numbers is enough.** The sampler
now asserts the winning colour against a **declared token allowlist**, read off the live
`.workbench` at runtime so it cannot go stale against the sheet. A colour matching no token
is reported `UNCONFIRMED` rather than passed — it is a failure to confirm what was sampled,
not a verdict on the ribbon.

This is Rule 12 applied to a measurement ("every load-bearing number traces to a source"),
and it is the check that would have caught the border defect on the first run with no
threshold tuning at all: `--rule` and `--ink-on-dark` are different declared tokens, and a
sampler reporting the border is reporting `--rule`. Suggested by the diff-verifier, which
flagged that "highest ratio above a 0.05% floor" has no guarantee the winner is the glyph
rather than a rare fringe colour.

Re-measured at 1440 with the hardened probe: **11.16:1, `rgb(200,209,221)` = `--ink-on-dark`**
— same figure, now with the colour confirmed against the sheet rather than merely plausible.
Artefacts in `outProd-f44377e/token-confirm-1440/`. The main run's rows predate the guard;
the figure is unchanged and the re-run is the confirmation.

Screenshots: `ribbon-1440.png`, `ribbon-380.png` (the sampled rects), `*.midflight.png`.

## Line 7 — two real defects, measured and fixed on this branch

**1440: 38 interactive elements, 0 under 32 px.** Footer included (`Terms` 35×32, `Privacy`
49×32).

**380: two under 44 px.**

| element | measured | why it failed |
|---|---|---|
| `a` "Terms" (footer) | **35 × 44** | 44 tall — and 35 wide. Rule 15 measures "the smaller dimension", and clause 7 set a min-**height** only |
| `button.strip-edit-all` "Edit full setup ⤢" | **130 × 19** | the setup strip's control; also the single `axe target-size` violation |

Both fixed on this branch, with the same rule-134 idiom (the hit box grows, the type does
not move):

- the footer links gain `min-w-[32px]` / `max-[480px]:min-w-[44px]`;
- `.strip-edit-all` joins the ≤480 floor block.

**The strip is Phase 2's surface, and the finish ruling leaves those untouched.** The footer's
own precedent governs the exception: §8.14 called the footer "unchanged" and #288 answered
"rule 15 admits no exemption" — unchanged in CONTENT is not a claim about the tappable area,
and a min-height moves no type. The same sentence covers the strip's control.

**The suite passed the build that failed this line, and that is the finding.** The clause-7
tests checked `min-h-[32px]` on the footer links — a class that encodes only a height, while
rule 15 measures both dimensions. happy-dom lays nothing out, so the suite could never have
caught a width. It now asserts `min-w` too, and `.strip-edit-all` is in the CSS-contract
list.

Red-proved, **each fix separately**: reverting the footer's `min-w` fails 1 of the 8 (the
footer test); reverting `.strip-edit-all` fails 1 of the 8 (the single-block contract test);
reverting both fails 2. An earlier draft of this file said "removing either fix fails 2 of
the 8", which was the both-at-once figure wearing the word "either" — the diff-verifier
caught the imprecision and the numbers above are the measured ones.

**One more correction the verifier caught, and it is the kind this arc keeps producing.** The
first draft of the footer fix added `justify-center` alongside the min-width, while the
comment beside it claimed "the type does not move". Centring text in a widened box shifts
each glyph by (box − text)/2 — about 4.5 px for "Terms" at 380. `justify-center` is gone: the
box grows rightward from `flex-start` and the words stay exactly where they were, which is
what the comment always said. No test measures a glyph's x, so only reading the diff against
its own claim would have found it.

The other two axe findings at 380 are `region` and `scrollable-region-focusable`, unchanged
from leg 3 and outside clause 7 (they are rule 30 / landmark structure, not hit targets).

## S5 with none — still NOT REACHED on prod, with three pins tried

The ruling asked for a second clean pin if the fixture pin would not give one. Three were
tried, at both widths:

| pin | result |
|---|---|
| US-40 near Cheyenne Wells, CO (39.0361, −102.2807) | **0 candidates** — no OSM way the picker would offer |
| CO-71 south of Ordway, CO (38.4783, −103.7930) | **0 candidates** |
| US-40 west of Craig, CO (40.4850, −107.9500) | 1 candidate, plan generated — **2 tier rows, not clean** |

So the state is still unreached, and it is still not faked: a clean plan is a property of a
corridor, and suppressing rows would measure the probe. It **is** covered at the mount by
`GeneratorShell.needs-you.test.tsx` ("S5 with none: a clean plan mounts NO block at all") and
by `GeneratorShell.primary.test.tsx`, which drives the real shell with a clean audit AND with
the harder `AUDIT_CLEAN_SCANNED` case — count 0 with the block still mounted for its
condition rows, the only state where two primaries could appear.

What remains unmeasured is that state **on prod**, and closing it needs a corridor whose scan
is genuinely empty. Recorded as the one acceptance gap this leg could not close by trying
harder.

## An unreplayed S6, by accident

The first 380 run hit a real backend refusal: the Overpass API timed out
(`ReadTimeout … budget 20 s`) and the plan was declined for real. That invalidated the run as
an S5 measurement and it was re-run — but it is worth recording what it showed, because it is
the only S6 in this arc that was **not** a replay:

the refusal container rendered, "No package yet" replaced the cards, NEEDS YOU was correctly
absent beside it (spec 31), and **the reference disclosure was OPEN** — clause 4's
`defaultOpen` fix holding in the wild, on an error nobody staged. That is the rule-10 contract
working: the verdict strip's "retry below" landed on a panel that existed.

Screenshot kept as evidence of the transient, not of the build.

## What the harness got wrong this time

Four, kept for the same reason legs 2 and 3 keep theirs.

1. **Two bundle-poll markers matched the wrong thing** — `ftick tl` for the hero's `tick tl`,
   and two legitimate strings for the dropped heading. Moved the heading claim to the DOM.
2. **The contrast sampler read the border.** `1.57:1` looked exactly like a real #259
   regression.
3. **The share threshold hid the text.** Two independent bugs in one measurement, either of
   which alone produces a confident wrong answer.
4. **A vacuous pass.** The nav-citation check read `.nav-right`, a class that does not exist,
   got `undefined`, and PASSED on it. The nav's own text is captured now and the check refuses
   to run on an empty string. A check that cannot fail is worse than no check: it reports
   coverage it does not have.

The pattern across all four: **three of them produced a confident number or a green row that
was not about the thing named.** None was a defect in the arc; all four were defects in how it
was measured.
