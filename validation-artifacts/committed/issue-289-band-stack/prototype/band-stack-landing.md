# #289 checkpoint probe (f) — every band transition, measured

**Run:** 2026-09-22, headless Chromium via Playwright, on `band-stack.html` (the spec's own
numbers — see that file's header for what it is and is not). **Raw:** `landing.txt`,
`landing.json`. **Shots:** `proto-s3-1440.png`, `proto-s7-1440.png`, `proto-s3-380.png`,
`proto-s7-380.png`. **0 pageerrors at both widths.**

This is not a reading of the product: nothing in the build renders a band. It is a reading of
**#281 Part 2**, built to its own rules, which is the only thing there is to read before the
ruling. Where the stand-in results stack is what moved rather than the real one, it says so.

---

## 1. The displacement every transition produces (ruling 184)

`stackShift` is how far the bottom of the band stack moved — so it is also how far the draft
notice, and everything else under the column, moved. Positive = down.

| transition | 1440 | 380 | what moves |
|---|---:|---:|---|
| S1 → S2 | **+367** | **+571** | WHERE grows: aerial 296→300, move ledger, chips, confirm |
| S2 → S3 | **−288** | **−97** | WHERE collapses to a fact line; the 104 px corridor strip and the WHAT band replace it |
| S3 → S4 | **−324** | **−745** | both setup bands collapse and lock; the placeholder mounts |
| S4 → S5 | **+500** \* | **+490** \* | the settle: the results stack forms |
| S5 → S7 | **+590** | **+827** | CHANGE ONE THING re-opens one band in place |
| S7 → S5 | **−590** | **−827** | DISCARD / APPLY re-collapses it |

\* the stand-in results stack, not Phase 1's. The real stack is taller, so the real S4 → S5
number is larger at both widths. Every other row is pure band stack and is faithful.

Part 1 §7.1 estimated "300–430 px" for a collapse. Measured, the range is **97–827 px**, and
the largest single displacement in the flow is not a collapse at all — it is **S5 → S7 at 380
(827 px)**, the revision open. Ruling 184 accepts user-initiated movement, and every row above
is user-initiated. What it does not do is make the movement small, and at 380 the re-open is
more than a viewport.

---

## 2. The landing residual — and the finding

`residual` is how far the target sat from its computed spot (`--nav-h + 8`, globals.css:1454)
after `scrollIntoView({block:"start"})`. arc-28's tolerance is 1 px.

| transition | target | 1440 residual | 380 residual |
|---|---|---:|---:|
| S1 → S2 | `.a-open` | 0 | 0 |
| S2 → S3 | `.a-open` (WHAT) | **276** | 0 |
| S3 → S4 | `.ph` | **369** | **448** |
| S4 → S5 | `.results` | **166** \* | 0 |
| S5 → S7 | `.a-open.rev` | 0 | 0 |
| S7 → S5 | `.a-fact` | **80** | 0 |

**Four of six transitions at 1440 cannot land, and the reason is not the machinery.** In each
failing row the document is shorter than, or barely taller than, the viewport: S3 `docH 1000`
in a 1000 px viewport is **zero scrollable pixels**, so no scroll call can move the target
anywhere. `scrollIntoView` does what it can — nothing — and the element stays 276 px below its
computed spot.

This matters because `armLandingCheck` (GeneratorShell.tsx:165) treats `offBy() > 1` as a
landing that needs correcting. On these transitions it would re-issue, measure the same
number, re-issue again, hit `LANDING_MAX_REISSUES = 2`, and end 276 px off — having spent its
whole counted cap on a target that was never reachable. Nothing breaks; the check just reports
a failure that is arithmetic, not behaviour.

**Ruling 184 says "every collapse lands the next band at a computed spot". At 1440 the column
in S3 and S4 is too short for that spot to exist.** Three ways out, none of them free:

- **(a) The landing is conditional.** When `scrollHeight − innerHeight < margin − currentTop`
  the target cannot reach the spot, so the transition lands at the top of the page instead and
  the check is not armed. Honest, cheap, and it means "every collapse lands counted" in #289's
  acceptance becomes "every collapse lands counted **or is recorded as unreachable**".
- **(b) The column reserves bottom room** so the target can always reach its spot. That is
  ruling 184's rejected option (reserved heights) wearing different clothes, and it puts empty
  space at the bottom of exactly the states Part 1 §7.1 complained about.
- **(c) The landing measures success differently** — target at its spot **or** the page scrolled
  to its maximum, whichever comes first. This is the smallest change to `armLandingCheck` and
  the only one that needs no layout decision.

**Recommendation: (c)**, with (a)'s recording. It is one predicate in `armLandingCheck`, it
makes the existing arc-28 legs keep meaning what they mean, and it stops the check reporting a
product failure for a page that is simply short. **RULING NEEDED** — it changes what
`armLandingCheck` asserts, which is arc-28 machinery a ruling already fixed.

At 380 the same transitions land at 0 px, because the column is always taller than an 800 px
viewport there. The failure is a 1440 failure only, which is why it has not been seen: the
arc-28 legs all measured the post-generate results stack, which is long.

---

## 3. The fact line is not 44 px, and rule 28's reserve is short

Measured with #281's own strings (Part 1 §2.5 item 3 for the S5 setup line), `padding 13px
16px` and rule 8's `13.5px/1.45` body value, exactly as rules 56–58 specify:

| fact line | 1440 | 380 |
|---|---:|---:|
| rule 56's stated height | 44.00 | 44.00 |
| "◌ Generate · pending" (the shortest line there is) | **45.50** | 67.25 |
| "◌ What's the job? — kind of work, extent, side" | **47.56** | 69.31 |
| "✓ Where …… E Colfax Ave EB · 210 ft N of W 38th Ave · 1,000 ft · right shoulder" | **60.00** | 130.63 |
| "✓ Setup …… Shoulder work · E Colfax Ave EB · 1,000 ft · right shoulder · 30 mph · Denver" | **60.00** | 130.63 |

Two separate problems, and they want separate answers.

**The arithmetic one.** 13 + 13 padding + a 19.58 px line box (13.5 × 1.45) + 2 px of border is
**47.58 px**. Rule 56 says "Total row height 44 px at one line" and its own padding and rule 8's
own line-height cannot produce that number at any font size — the shortest line measurable is
45.50 px. So rule 56 is off by ~3.6 px against itself, before any content.

**The content one, and it is the bigger one.** The line rule 28 reserves for is the **setup fact
line**, whose value rule 119 fixes as "the whole scenario in one string, ordered: kind · road and
direction · extent · side · speed · jurisdiction". #281's own example of that string wraps to
**60 px at 1440 and 131 px at 380**. `--fact-h: 44px` (globals.css:772) under-reserves it by
**16 px at 1440 and 87 px at 380** — and 87 px is two thirds of the thing it is reserving for.

Phase 1 set `--fact-h` to 44 px deliberately and said why (ResultsHead.tsx: "`--strip-h` was a
MEASUREMENT … `--fact-h` is read off rule 56, which fixes the setup fact line's row height at
44 px at one line — a rule, not a measurement, so it cannot drift"). The reasoning is right and
the premise is wrong: rule 56's 44 px is not a rule about *this* line, because *this* line is
never at one line. Restoring the reserve at 44 px in Phase 2 would reserve the wrong amount and
the results would still shift at the settle — which is the exact defect rule 28 exists to
prevent.

Three options:

- **(a) Reserve two lines at 380, one at 1440** — `--fact-h: 60px`, `--fact-h: 131px` below 520.
  Correct for #281's own string; wrong the moment a longer road name arrives, so it is a
  measurement again, with all of `--strip-h`'s problems.
- **(b) Reserve `min-height` and let the line grow**, accepting that a long scenario shifts the
  stack once, at the settle, by the overflow only. Smallest shift that is still honest.
- **(c) Shorten the line so it fits 44 px** — drop fields from rule 119's six, or move the
  overflow to a second, unreserved provenance row.

**Recommendation: (b)**, with `--fact-h` renamed to what it is (a floor) and rule 56's 44 px
corrected to 48 px so the token and the rule agree arithmetically. **RULING NEEDED** — (a) and
(c) both change a #281 rule, and (b) changes what #288's Phase 1 deviation said it would
restore.

---

## 4. Everything else the run confirms

- **Role 5 switches on cue.** `.tr-question` computes 22 px at 1440 and 19 px at 380 (ruling
  180 / rule 162), from `--fs-step-question` alone. #283's token does what Phase 2 needs with
  no further work.
- **S4's verdict slot holds its height.** `visibility:hidden` per rule 117; the two fact lines
  below it did not move between S3 and S4 beyond the collapse itself.
- **The 380 arc restructures nothing.** Same component stack at both widths, per rule 173 —
  the only structural switches are the ones rules 164/166/170 name.
- **The before/after panel's six rows all survive at 380** (rule 95.15 / departure 187
  withdrawn), at the 1fr / 58 / 16 / 96 track widths, with the deferred phrase on one line.
