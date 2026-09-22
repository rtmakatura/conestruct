# S1–S3 on a local build — a probe, not the evidence leg

**Run:** 2026-09-22, `next dev` at `http://localhost:3999/sandbox`, headless Chromium.
**NOT SHA-GATED, DELIBERATELY.** The branch is not shipped, so gating on prod's `healthz`
would assert something true of a machine this run never touched — leg 5's lesson from #288,
applied rather than restated. The evidence leg is step 6 of the ruling's commit order and
runs on prod.

**Scripts:** `shoot.js` (the walk + the shots), `targets.js` (rule 15's floors),
`order.js` (§1.2's source order and rule 26's gaps). **Output:** `rows.json`, four PNGs.

The walk: load `/sandbox`, read S1, open the manual fallback, type the E Bayaud pin
(39.71466, −104.94071), read S3. No picker — the modal needs a Mapbox token and a network
round trip, and the pin is what the column reacts to.

## What it measured

| | 1440 × 1000 | 380 × 800 |
|---|---|---|
| **S1** open band | WHERE, `STEP 1 OF 4` | WHERE, `STEP 1 OF 4` |
| step question (role 5) | **22 px** | **19 px** |
| pending fact lines | 1 (`◌ What's the job? … pending — find the work first`) | same, 85.19 px tall |
| kind chips | 3, with the gate note naming the other 4 | 3 |
| the gate sentence | on the disabled primary's `cta-reason`, once | once |
| **S3** open band | WHAT, `STEP 2 OF 4`, "Anything we got wrong?" | same |
| WHERE fact line | **60.00 px** | **97.56 px** |
| grid cells | 6, each with a provenance line (rule 137) | 6 |
| field heights | 44, 44, 44, 44, 44, 44 (rule 136) | same |
| `.tr-step` tags on screen | **1** | 1 |
| **rule 15**: under the floor | **0** (32 px floor) | **0** (44 px floor) |
| **pageerror** | **0** | **0** |

## The three things it caught that a test suite could not

1. **The verdict strip was below the band stack.** Part 1 §1.2 puts it second in source
   order, in every state; it was still where the panel era left it, under the setup zone.
   Moved, and measured: strip ends 262 → stack starts 280 at 1440, which is **rule 26's
   18 px**. It was 24 before — a figure that predates Part 2.
2. **Eight sub-floor targets inside the column**, all carried surfaces rather than the band's
   own: the project-details and manual-entry toggles (16 px), #222's pending summary (26 px),
   the suggestion slot's Confirm / Dismiss (24 px — under at BOTH widths), the street-class
   pills (33 px) and the schedule chips (37 px). Floored in `globals.css`; re-measured at
   **0 under** at both widths. The band's own controls cleared by rule from the start.
3. **Panel step numbers with nothing behind them.** The kind sections, the schedule and the
   site conditions still carried `STEP 4` / `STEP 5` / `STEP 6` tags from the panel's
   seven-section numbering, beside a column that counts to four (ruling 198). Dropped —
   rule 12's instinct applied to a number: a figure that traces to nothing does not render.

## And one it confirmed

**R9's measurement holds on the real surface.** The WHERE fact line renders **60.00 px at
1440** and **97.56 px at 380** — against rule 56's stated 44 and `--fact-min-h`'s corrected
48. The prototype predicted 60.00 / 130.63 for #281's own longer S5 string; this line is
shorter (no confirmed road at this pin), and it still clears the floor by 12 px at 1440.
