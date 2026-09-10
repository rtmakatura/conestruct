# s2-arc26-landing — bucket B evidence: #250 · #240 · #260 · #253

*Local live check, 2026-09-09. Frontend under test: worktree `batch-b-strip` at **`f8c1744`** (commits 6–7 on top of main `b72e358`, which carries B's slice 1–5 `ddf44bc…62eeda1` as `ca0b9fe`) served by `next dev` on :3002; backend: the deployed Modal at healthz sha **`b72e358580aac0246804352cf0cb754df31b4dbd`** (gated by the harness, B1). Harness `s2a26-lc.js`; output `outS2A26Local/` (log, results.json, per-run samples / measure / pairs / axe JSON, screenshots). **RESULT ALL PASS 294/294.** A prod run is Ryan's after ship, sha-gated.*

## Rulings this evidence answers (verbatim in `GO-rulings.md`)
- **Ruling 1 (136):** "Post-generate landing target = 136 ±1 (`calc(var(--nav-h) + 8px + var(--status-h) + 24px)`), not 98. Reason: 98 puts the verdict strip at 22..74, under the nav. … Pre-generate stays 98." **Ruling 4 (380 = 154):** the same formula with the measured `--status-h: 70px` at ≤480 — the acceptance is "136 at 1440 / 154 at 380".
- **Ruling 2 (caption):** chip 3 "✓ 4 FILES READY" is the one voice for the file count; the OutputCards caption is "MHT PACKAGE" from the same commit (`f8c1744`); the zip stays 4 parts.
- **Ruling 3 (hand-offs):** B leaves `SetupStrip.tsx:678` to A (done by A); `.zone-title` `#fff` → `var(--ink-bright)` swapped by B, its `CSS_OWNER_SWAPS` row deleted (ruling 6).
- **Checkpoint B rulings:** move (not collapse) the context block below Results (B1); un-pin the strip below 520 px of its own width with 44 px chips (B2); two reserved slots, no zone min-height (B3); the strip pins **within the results zone only** (deviation from spec 3, ruled); chips stay `data-read` clickable under the band at opacity .45 (#252 doctrine over spec 21); `jumpToAnchor` kept over spec 10; "◌ NOT SCANNED" on `not_run`/`unavailable` is a declared change from the lockup's null; "NOT YET EVALUATED" never renders (conflict 3); the type rides the four `.tr-*` roles with the glyph's 11 px the one chosen size (ruling 7).

## Re-baselines (the three live-check figures ruling 1 moves)
The historical scripts are archives and stay as written; `s2a26-lc.js` carries the successors.
| baseline | was (arc, sha) | now (this run, `f8c1744`) |
|---|---|---|
| s2a23 B6 — results zone top after Generate | 174 (1440) / 173 (380) at `2e0b25e` | **136.47 / 154.11**, 10 of 10 at each viewport |
| audit-walk S2-settle (F-S2-3) | 174 / 173; one refused generate at −104 | 136.47 / 154.11; the declined pair 136.47 / 153.83, 3 of 3 each |
| s2a25 D4 — declined container inside [nav-h, innerH] | 3 of 3 per branch, zone top unmeasured | container 175.66..366.84 (1440) / 193.02..552.98 (380), zone at target, 3 of 3 |

## Measurements (both viewports; every run unless noted)
| id | what | 1440×1000 | 380×800 |
|---|---|---|---|
| S0 | one live speaker for the location gate (load) | `cta-reason` only; 3 live regions (alert · polite · status); blocker `aria-hidden=true`; quiet band not live | same |
| S0 | pick CTA bottom ≤ innerH (load) | **661** ≤ 1000 (was 1004) | **728** ≤ 800 (was 1307) |
| S0 | strip voice / "None — baseline" | "AWAITING LOCATION · no site chosen", h 52; ×0 | same, h 70; ×0 |
| L1 | results zone top after Generate (target ±1) | **136.47**, 10/10 | **154.11**, 10/10 |
| L2 | verdict strip inside [nav-h, innerH] | 60.47..112.47, 10/10; status slot 52 = `--status-h` | 60.11..130.11, 10/10; slot 70 |
| L3 | jumps > 40 px after the click | smooth run ≈ 570 ms (1089 → 976 → 619 → 427 → 344 → 310 → 286 → 279 → 278 …); **1 instant scrollY step at the pair's settle (+381, the zone moved 0 — Chrome's anchoring compensating the corrections block mounting above); 0 visible jumps; 0 after settle + 100 ms**, 10/10 | smooth ≈ 810 ms (2488 → … → 447); 1 instant step (+639, zone moved 0); 0 visible; 0 after settle, 10/10 |
| L4 | band seen every flight | 10/10 | 10/10 |
| N1 | strip: 3 chips, label "NEXT — 3 STEPS", no lockup, all `data-read`, hrefs `#site-corrections,#reference,#downloads` | 10/10 | 10/10 |
| N2 | counts vs the audit wire (chip 1 open of keyed; chip 2 `pending_verification.count`; chip 3 4) | "4 OPEN/5 · 2 OPEN · 4 FILES READY" = wire, 10/10 | same |
| N3 | vocabulary: never done/complete/NOT YET EVALUATED; caption "MHT PACKAGE" | 10/10 | 10/10 |
| N5 | the pin | slot `sticky` at **52** (= nav-h) after +600 with the zone at −463 — pinned within the zone; slot 82 = `--strip-h`, strip 81.19 | slot `static` at −370 after +600 — un-pinned; slot 192 = `--strip-h` = strip |
| N6 | chips at 380 | — | 332×**44**, one edge 24..356, 3 of 3, 10/10 |
| N7 | slot = strip = token (P1) | 82 / 81.19 / 82 | 192 / 192 / 192 |
| N8 | anchor jumps land at their scroll-margin, focused | `#site-corrections` 60.28 vs 60; `#reference` 60.45 vs 60; `#downloads` **142.22 vs 142** (`--pin-h` = `--strip-h` 82) | 60.08 / 59.95 / 60.42 vs 60 (`--pin-h` 0 under the un-pin) |
| N9 | contrast in the strip on the composited .97 surface | 16 pairs, lowest **6.6** (`.ns-count.tr-step`), 10/10 | same |
| N10 | axe (WCAG 2.x A/AA) | **0** (baseline 0) | **2** — the named `scrollable-region-focusable .gap-8` + `target-size .strip-edit-all` (baseline 4); none in `.ns-*` |
| C1–C3 | the c2 declined pair (both requests replayed with the arc-25 400) | zone 136.47; container 175.66..366.84 in view; no strip, no slot, no hero, "PLAN DECLINED · see the notice in the Results zone." + SERVICE UNAVAILABLE, 3/3 | zone 153.83; container 193.02..552.98; same, 3/3 |
| — | natural refusals (#256) | **0 of 10** (first scan 20.8 s, then memoised 1.2–5.8 s) | 0 of 10 |

Pre-change figures for the same probes (dev server at `224feb9`, `..\tmp\B\measure-heights.out.txt`): strip 46.8 / 51.59 (no pill / pill) at 1440, 67.59 / 69.19 at 380 → `--status-h` 52 / 70; lockup 37.19 → the strip 81.19 / 192 → `--strip-h` 82 / 192.

## Churn — actual vs predicted (bucket B, all eight commits)
| test | predicted | actual |
|---|---|---|
| shell-chrome:51-55 | formula flip | flipped (`--pin-h`), + 136 rule, f2 token/slot, ≤480 pins, `--strip-h` 38 → 82/192, `.status-bar` min-height — 6 cases beyond the table, declared |
| post-generate-scroll | +2 | +6 (5 unit cases on `armLandingCheck` with mocked rects, 1 stage case) |
| StatusBar.test:241-268 · no-location:145,162 | AWAITING string | pinned; **StatusBar.test:158** empty wrapper carries the slot class (unpredicted, declared) |
| StatusBar.a11y | slot | +1 |
| suggest-contract:203 · suggestion-records:140 | "Not set" | flipped |
| results-head (8 cases) | rewritten, `expectStrip` | rewritten, 9 cases (A's Apply case absorbed) |
| a11y-announce:319 · regenerate-mounted:227 · WorkingBand:318 | unchanged | unchanged |
| live-check scripts | 174/173 → 136 | re-baselined **here** (136 / 154); archives untouched |
| axe | 0 / the named four | 0 / the named two seen (of the four) |
| *unpredicted* | — | `OutputCards.test:82-91` (ruling 2); `ink-literals.test` 5 → 4 and B's row gone from `ink-exceptions.ts`; `type-census.test`'s ruled-size list drops 24 and `type-exceptions.ts` drops the lockup exception, adds the glyph debt row, `CENSUS_PINS.cssSizes` 20 → 19; `WriteLock.test`'s lock-selector list +1 (`.ws-locked .ns-chip`, opacity only); new `GeneratorShell.next-steps.test.tsx` (5), `ns-strip-tokens.test.tsx` (9), `lib/next-steps.test.ts` (12), `GeneratorShell.live-speakers.test.tsx` (4); the scan-refusal #258 CSS test drove commit 1's rule order (untouched itself) |

## Contracts
#198 honoured (`.sys-event` strings untouched); rail #228 derivation untouched (`aria-hidden` is presentation; the entry keeps its `aria-label`); suggest-never-set honoured; Rule 3 lookups only; Rule 10 — the strip null pre-generate / declined (c2 included) / before the pair's first settle, ◌ only on wire states, a response without `pending_verification` renders nothing; Rule 12 — 52/70/82/192 measured, 136/154 four tokens, totals counted from the wire, 4 from `BUNDLE_PART_KINDS`; Rule 13 measured on the composited .97 surface, the open border decorative; expectation-JSON / containment / citation counter untouched; payload senders unchanged (bundle, audit, breakdown); `getByText` direct nodes; write-lock — chips `data-read`, 0 new `data-write`; spec 31 honoured incl. c2; band rules and `WorkingBand.tsx` untouched; `.jbar-suggest.quiet` CSS untouched; backend 0; snapshots 0.

## Principles
P1 honoured — `StatusBar.tsx:191` slot (52/70), `ResultsHead.tsx` slot (82/192, = strip ±1), landing a computed coordinate (10/10 at target), 0 visible jumps, `#downloads` lands at 142 below the pinned strip · P2 honoured — one gate speaker (3 live regions), the lockup deleted, the caption's numeral dropped (ruling 2) · P3 honoured — CTA 661/728 in view on load; three ordered chips at the landing · P4 honoured — chips one edge 24..356 at 380 · P5 honoured — the four roles; the glyph the one chosen size (declared debt row) · P6 honoured — `flex: 1 1 150px; min-width: 0`, the name ellipsises · P7 n/a · P8 honoured — the band the one voice; the strip never speaks the flight · P9 honoured — ▲/✓/◌ + words, `--warn`/`--pass`/`--none`, lowest pair 6.6 · P10 honoured — 44 px chips at 380 (desk 37, spec's density) · P11 honoured — tokens only (`ns-strip-tokens.test`), 0 new hex · P12 hand-check · P13 n/a · P14 honoured — "Not set", "◌ NOT SCANNED" · P15 n/a · P16 honoured — empty slots are room, counts hold under the band. Deviations (ruled/declared): spec 3 page-wide pin → within the zone; spec 4's 18 px → the slot's 14; spec 16-17 sizes/inks → the roles; spec 21 pointer-events → clickable; spec 10 → `jumpToAnchor`.

## Residuals / findings
- 380: the cold-start VERIFYING copy wraps to three lines (88.39) and exceeds the 70 px strip while it shows (declared at commit 1).
- The one instant scrollY step at the pair's settle is Chrome's anchoring compensating the corrections block mounting **above** the results zone (+381 / +639); the zone itself moves 0 — recorded, not a P1 shift. The block's own room is bucket A's surface.
- No natural Denver refusal in 20 generates this run (#256 unchanged; the retry-once path is in the harness, unexercised).

## Prod run at 3fa7d18 (2026-09-10, `outProd-3fa7d18/`)
*Sha gate: healthz `3fa7d18c66c0dcc67d3a31ea84a2e28ad39559a9` == `git rev-parse HEAD` (first log line, B1). Frontend confirmed live first: `.ns-strip` served in `/_next/static/css/9280ba3164178e47.css` at 03:09:06Z (`prod-live-note.txt`). Same harness, same leg set: 10 natural + 3 declined per viewport against `https://www.conestruct.com`.* **RESULT FAIL 280/294 — 14 fails, three findings, none of them harness tuning:**

| id | 1440×1000 | 380×800 |
|---|---|---|
| S0 one voice / CTA / strip voice | `cta-reason` only, 3 live regions; CTA 661 ≤ 1000; "AWAITING LOCATION · no site chosen" h 52 | same; CTA 728 ≤ 800; h 70 |
| L1 landing | **136.47, 10/10** | **154.11, 9/10** — L10 at **793.11** (finding 2) |
| L2 verdict strip in view | 60.47..112.47, 10/10 | 60.11..130.11, 10/10 |
| L3 jumps | 1 instant scrollY step at the settle (+381, zone moved 0), 0 visible, 0 after, 10/10 | 9/10 as local; L10: 2 steps (+618 at 705 ms, zone moved 21; **−648 at 764 ms, zone moved 648**) — finding 2 |
| L4 band | 10/10 | 10/10 |
| N1–N4 strip, counts vs wire, vocabulary, anchors | 10/10 ("4 OPEN/5 · 2 OPEN · 4 FILES READY" = wire; caption "MHT PACKAGE") | 10/10 |
| N5 pin | sticky at 52, slot 82 = strip 81.19, 10/10 | static, 9/10 (L10's page sat at scrollY 447 — consequence of finding 2) |
| N6 chips 44, one edge | — | 332×44 at 24..356, 10/10 |
| N8 anchor jumps | `#site-corrections` 60.28, `#downloads` 142.22 (10/10); **`#reference` 67.45 vs 60, 10/10** (finding 1) | 60.08 / 60.42; `#reference` 59.95–**61.69** (L4 only, finding 1) |
| N9 contrast (.97 surface) | 16 pairs, lowest 6.6, 10/10 | same |
| N10 axe | 0, 10/10 | 2 (the named `.gap-8` + `.strip-edit-all`; baseline 4), 10/10 |
| C1–C3 declined pair | 136.47; container 175.66..366.84; no strip, 3/3 | 153.83; 193.02..552.98, 3/3 |
| natural refusals (#256) | 0 of 10 (settles 0.7–6.4 s) | 0 of 10 (0.7–7.1 s) |

**Finding 1 — `#reference` lands at 67.45 at 1440 (10/10): a scroll clamp, not a jump defect.** `probe-reference.js` (one Generate per viewport, `probe-reference.out.txt`): at 1440 the jump ends at `scrollY 1727 == maxScroll 1727` (docH 2727, innerH 1000) — the Reference zone (763) + footer (65) are shorter than the viewport below the margin, so the document cannot place the zone at 60; it sits at 67.45, the document's end. At 380 the probe lands 59.69 (docH 4636, not clamped); L4's 61.69 is a one-off 1.7 px overshoot at the 900 ms sample. The local run did not show it because the merged tip carries C's shorter cards/audit rows. Not a P1 shift (nothing moved); the harness's ±1 expectation does not know about the clamp — left as a FAIL by rule, for a ruling (accept the clamp as the landing when `scrollY == maxScroll`, or pad the page end).

**Finding 2 — 380 L10: the pair settled mid-smooth-scroll and the landing ended at 793 (1 of 10).** Samples (`380x800-L10-samples.json`): the memoised scan settled at 705 ms, while the smooth landing scroll (which ran to 752–812 ms in the other runs) was still animating; the DOM grew above the zone by 1296 (docH 3340 → 4636 — the corrections block mounting in Setup) and anchoring moved scrollY 477 → 1095 (zone at 145); at 764 ms scrollY was 447 — the running animation's pre-settle destination — and the zone sat at 793 for the rest of the run; the check's single re-issue did not restore it. Chrome does not re-target a running smooth scroll after an anchoring adjustment; `armLandingCheck` merges the settle into the landing check (`settleWanted`) and caps re-issues at one, so a settle that lands inside the animation window can spend the one re-issue before the stale animation finishes. Candidate fix for a ruling: on `settle()` while the landing scroll is still running, wait for its `scrollend` and then check with a fresh re-issue budget (the "never twice" cap was written for the good-path race, not for a settle inside the animation). Operator cost: the results head at the bottom edge of an 800 px viewport once in ten memoised generates; the verdict strip (699..769) is still in view. #250-class, P1/P3; the local run's 10/10 at 380 did not hit the window (settles 0.79–1.86 s).

**Finding 3 — none new otherwise:** every other probe equals the local run at `f8c1744`, figure for figure (S0, L1–L2 at 1440, N1–N7, N9–N10, C1–C3).

