# s2-arc28-landing-recheck — #271 evidence: the landing re-check, re-measured

*Local live check, 2026-09-10. Frontend under test: worktree `issue-271-landing-recheck` at **`1f7b060`** (commit 1 of this branch, on `49273e4` = origin/main) served by `next dev` on :3005; backend: the deployed Modal at healthz sha **`49273e47ae42c4dabfb75d8bafd244d38c83c837`** (= `49273e4`, gated by the harness's first log line). Harness `s2a28-lr.js`; output `outLocal-1f7b060/` (log, results.json, per-run samples / measure / **scrolls** / axe JSON, screenshots).*

> ## RESULT: FAIL 233/251 — and the FAIL is the finding. **The fix as ruled does not repair #271.**
> A natural warm run (`380x800-L12`) and every counted forced run landed the results zone at **793.11** — arc 26's prod figure to the pixel — with commit `1f7b060` in place. The acceptance ("20 consecutive Generates at 380 land at 154 ±1") is **NOT met: 19 of 20.** No harness leg was tuned to make this pass. Ryan's ruling is needed before anything else is built; see **The finding** below.

## Rulings this evidence answers (verbatim, Ryan, 2026-09-10)
1. **Cap:** "one extra re-issue per settle-inside-flight, at most two `scrollIntoView` re-issues per Generate, never re-granted (no round 3)." The "chase loop" alternative is rejected.
2. **"In flight" = `!checked`.** "No explicit scroll-in-progress ref."
3. **New arc-28 harness** "with the landing legs plus the forced leg, in `validation-artifacts/committed/s2-arc28-landing-recheck/`. Arc-26's harness and `outProd-3fa7d18/` stay untouched as the record that produced the finding."
4. "Round 2 is **not** gated on smooth behaviour. **Add the one-line `done` flag** so the user-scroll disarm wins after the helper finishes (declared as one line beyond the ruled text). **One** new test carrying both halves. **Twenty fresh pages**, not twenty regenerates. The forced-window leg **counts as acceptance evidence** alongside the twenty natural warm runs, provided each forced run is counted only when it actually entered the window (`settledAt < smoothEnd`) and the jump census **prints the recovering re-issue explicitly** rather than passing inside a tolerance."

All four are implemented as written. Ruling 4's "prints the recovering re-issue explicitly" is what produced the finding: the census reads `scrollIntoView` and `scrollend` off the live page instead of inferring them from a scrollY tolerance.

## The finding — the ruled gate never fires, because `checked` is spent at ~70 ms
The plan assumed the pair's settle (≈ 700 ms) arrives with the landing check un-spent (`checked === false`), so `settle()` could grant round two. It does not. Chrome fires a **`scrollend` about 30 ms after the landing `scrollIntoView`, while the zone is still ~1939 px (380) / ~552 px (1440) from its margin** — the first smooth scroll is cancelled almost immediately (the stage swap re-lays the page out) and the browser reports the sequence as ended. The check treats that as the landing settle, spends `checked` **and** its one re-issue at ~70 ms, and the *re-issue's* animation is the one that actually runs to ~810 ms. So by the time the pair settles at 700–750 ms, `checked` is already `true`: `settle()` takes the pre-existing `checked === true` branch, `reissued` is already `true`, and nothing is issued. Round two — the whole of commit 1 — is unreachable on this path.

The census, straight from the log (`380x800-L12`, a natural warm run, FAIL):

```
L1 landing — results zone top 793.11 vs 154 ±1 ... scrollY 447; docH 4636; settled 742 ms
L3 jumps + re-issue census — smooth run to 803 ms;
   scrollIntoView on the zone: 2 (landing@32ms smooth (zone -1939 px off) ;
                                  re-issue 1@63ms smooth (zone -1939 px off)) → 1 re-issue(s), cap 2;
   scrollend: @-4111ms y=92 ; @-4055ms y=565 ; @63ms y=2540 ; @849ms y=447;
   instant scrollY steps > 40 px: 0 (none); visible zone jumps: 0; after settle+100 ms: 0;
   scrollY 2585 → 2496 → 2263 → 1771 → 1198 → 907 → 769 → 643 → 559 → 504 → 477 → 455 → 447 → 447…
```

`scrollend @63ms y=2540` with the zone 1939 px off is the whole story: that event, not the landing, is what armed and spent the check. The scroll that mattered ended at `@849ms`, 107 ms after the settle.

The scrollY sequence is arc 26's prod L10 (`2585 → 2496 → 2263 → 1771 → 1198 → 907 → …`) sample for sample, and the endpoint is identical (`scrollY 447`, zone `793`), so this local reproduction is the prod case and not a look-alike. Corroborated independently by `probe-scrollend.js` (tracked here, same tip, `probe-scrollend.out.txt`): `CLICK 0 ms · scrollIntoView 83 ms (top=-1998) · scrollend 85 ms (y=2599) · scrollIntoView 85 ms · scrollend 880 ms (y=447) · rAF-6-stable 930 ms` — the second scrollend, 795 ms after the first, is the scroll that actually landed. The rAF fallback is **not** implicated (rAF measured at 16.7 ms median in this Chromium, headless and headed alike — six stable frames is ~100 ms and it never wins the race); the spurious early `scrollend` is.

**What this means for the ruling.** "In flight" cannot be `!checked`, because `checked` flips before the scroll the operator sees has moved 1 px. The honest predicate is about the scroll, not the check. Two directions, neither built (Rule 5 — no improvised redesign):
- **(a) Don't accept a settle that isn't one.** A `scrollend` that arrives with the zone still more than the tolerance off is a *cancelled* scroll, not a landing; the check could re-issue and keep waiting rather than spend `checked`. Cap still two.
- **(b) Grant the extra round off the re-issue instead of off the settle.** Round 1 re-issued → wait for that scroll's settle → check once more if a settle arrived meanwhile. Same two-scroll cap, same no-round-three, but keyed on "we started a second animation" rather than "a settle beat the check".
Both stay inside ruling 1's cap of two re-issues per Generate. (a) is the smaller diff and the one this run's evidence points at directly.

## Measurements (frontend `1f7b060`, backend `49273e4`)
| id | what | 1440×1000 | 380×800 |
|---|---|---|---|
| B1 | sha gate | healthz `49273e47…c837` == expected, first log line | same |
| L1 | results-zone top after Generate (target ±1) | **136.47, 9 of 10** — L1 is the #256 refusal-and-retry run at **166.47** (finding 2) | **154.11, 19 of 20** — **L12 at 793.11** (the finding) |
| L1 | forced window (leg F), runs that entered | **0 of 3 at target — 517.47 ×3** | **0 of 4 at target — 793.11 ×4** |
| L2 | verdict strip inside [nav-h, innerH] | 60.47..112.47, 10/10 | 60.11..130.11 on the 19 good runs; **699.11..769.11 on L12** — in view, at the bottom edge |
| L3 | re-issue census (every run, both viewports) | landing@32–53 ms + **exactly one** re-issue@63–88 ms, always with the zone still 552 / 1939 px off; the real scrollend at 546–857 ms; 0 visible zone jumps; 0 after settle+100 ms | same |
| L3 | instant scrollY steps > 40 px | ≤ 1 (the anchoring compensation at the settle, zone moved 0) | ≤ 1 |
| L4 | band seen every flight | 10/10 | 20/20 |
| N5 | the pin | slot `sticky` at **52** = nav-h after +600, slot 82 = `--strip-h`, strip 81.19 — 10/10 | slot `static`, un-pinned — 19/20 (L12's page sat at scrollY 447, a consequence of the finding) |
| N6 | chips at 380 | — | 332×**44**, one edge 24..356, 3 of 3, 20/20 |
| N10 | axe (WCAG 2.x A/AA) | **0** (baseline 0), 10/10 | **2** — the named `.gap-8` + `.strip-edit-all` (baseline 4) on 19 of 20; **L7 read 19** (finding 3) |
| F | window entry | held 350 ms; entered on 3 of 5 (F3/F5 missed 3 attempts each — the 1440 smooth run is only ~250 ms when the memo is hot) | held 700 ms (the prod settle to the millisecond); entered on 4 of 5 |
| — | natural refusals (#256) | 1 of 10 (retried once, the retry produced a plan) | 0 of 20 |

Forced-leg hold, declared: 700 ms at 380 is arc 26's prod settle exactly; **350 ms at 1440** because that viewport's landing run is ~500 ms (often ~250 ms warm) and a 700 ms hold lands after it, so no run would ever enter the window. The gate is unchanged and measured either way — `settledAt < smoothEnd`, printed per run, and a run that missed is re-run (three attempts) rather than counted.

## Residuals / findings
- **Finding 1 (the subject):** above. `380x800-L12` natural + 7 forced runs.
- **Finding 2 — `1440x1000-L1` landed at 166.47 (30 px low).** The one #256 natural refusal of the run: the scan refused, "↻ Retry scan" was clicked, the retry produced a plan, and that retried flight's landing settled 30 px below the margin. A different shape from the finding (which is 380/657 px), on the retry path, seen once. Recorded, not diagnosed.
- **Finding 3 — `380x800-L7` axe read 19 WCAG nodes instead of 2.** Every extra is `color-contrast` on the downloads/price surface, and the node list includes `.stale-ribbon` — the page was in its "previous answer" dimmed state when axe ran (a background refetch in flight), which is exactly where reduced-opacity text fails contrast. The other 19 runs at that viewport read the named 2. Recorded as a state the axe leg should exclude, not asserted as a new a11y regression.
- **Two harness defects were found and fixed during this arc, before the recorded run** (the voided first run is not kept): (i) the forced leg's capture took its wire from the *first* natural run, which at 380 had been a #256 refusal — so leg F replayed a 400 and a declined pair, whose document never grows above the zone, and the leg passed 5/5 while testing nothing; the capture is now committed only from a run that produced a plan (audit 200). (ii) after "↻ Retry scan" the refusal container is still mounted for a beat, and sampling immediately read the stale refusal as the settle, measuring a page still in flight (three bogus FAILs). Both fixes are in `s2a28-lr.js` with the reason in the comment.
- Arc 26's `s2a26-lc.js` and `outProd-3fa7d18/` are untouched (ruling 3).

## Churn — actual vs predicted
| file | predicted | actual |
|---|---|---|
| `components/GeneratorShell.tsx` | `armLandingCheck` restructured into rounds (`waitForSettle`, `round2`, `grantExtra`, `done`); the `:71-85` doc comment extended | as predicted (+87 / −22 lines); both call sites unchanged |
| `components/GeneratorShell.post-generate-scroll.test.tsx` | +1 case in the `#250 (a)` describe, 12 existing unedited | +1 case (13 in the file), **12 existing unedited** |
| `validation-artifacts/committed/s2-arc28-landing-recheck/` | new harness + README + out dir | as predicted |
| *unpredicted* | — | **none in product code.** Harness-only: the `scrollend` census (added mid-arc — it is the evidence for the finding), the per-viewport forced hold, and the two harness-defect fixes above, all declared here |

Backend: 0. Snapshots: 0. `WorkingBand.tsx` / the band CSS rules: untouched. Arc-26 artifacts: untouched.

## Contracts
`#198` `.sys-event` strings untouched · rail `#228` derivation untouched · suggest-never-set honoured · Rule 3 — no frontend MUTCD math (this arc computes no plan values) · Rule 10 — nothing here presents a stale answer as current; the FAIL is reported as a FAIL · Rule 11 — the new case is a mounted-flow/helper case on the real `armLandingCheck`, and the browser leg tests where the bug lives (rendered output on a live page) · Rule 12 — every figure in this file is a measurement from `outLocal-1f7b060/log.txt`, none chosen · Rule 13 / P9 — untouched · write-lock: 0 new `data-write` · payload senders unchanged (bundle, audit, breakdown) · expectation-JSON / containment / citation counter untouched · `#152 E` no-yank and `#258` c2 declined paths unchanged (both call sites byte-identical).

## Principles (P1–P16)
| | verdict |
|---|---|
| **P1** nothing moves unasked | **deviates — the finding.** `GeneratorShell.tsx:71-170`. The zone is meant to land at a computed coordinate; on the failing path it ends 639 px low and stays there. 19/20 at 380, 10/10 at 1440 honour it; the twentieth is why this arc exists |
| **P3** next thing visible | partially — on the failing run the verdict strip is still in view (699..769) but at the bottom edge; the results head is off-screen |
| **P4** edges | honoured — chips one edge 24..356 at 380, 20/20 (`s2a28-lr.js` N6) |
| **P10** targets | honoured — chips 332×44 at 380, 20/20 |
| **P9 / P13 / P14 / P16** | n/a — no surface changed; the arc is behaviour of the landing scroll only |
| **P2 / P5 / P6 / P7 / P8 / P11 / P15** | n/a — no copy, type, grid, request, lock, token or undo changed |
| **P12** polish | Ryan's hand-check; the failing landing is precisely the "cheap" impression P12 names |

## How to re-run
```
cd conestruct/site && npx next dev -p 3005          # frontend = the branch tip; .env.local proxies to the deployed Modal
node validation-artifacts/committed/s2-arc28-landing-recheck/s2a28-lr.js \
     <outDir> <expected backend sha> http://localhost:3005
```
Optional `[runs] [forcedRuns]` override the 10/20 natural and 5 forced runs for a smoke run. A prod run is Ryan's, after ship, sha-gated.
