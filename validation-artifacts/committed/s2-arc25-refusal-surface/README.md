# s2-arc25 — #258 the refusal surface

Branch `issue-258-refusal-surface` off `main 231a707` (healthz == 231a707 at the
start). GO rulings: Ryan's message of 2026-09-08 against the 📋 checkpoint — all eight
recommendations adopted. Backend-first: commit 1 shipped (healthz == `67bf9a0`)
before the frontend commits.

## The defect

s2-audit-1 rank 2, rows F-S5-1 … F-S5-10: a declined plan looked half-generated. With
the strip reading PLAN DECLINED the results zone still showed hero counts or "—"
placeholders, four live download buttons and a screen-reader sentence "Plan generated
— 39 devices, 12 types." The refusal was stated three times (strip sentence, pill,
container). One natural refusal settled with the container under the top bar. The two
recovery actions were a 94×18 text link and a 596×28 two-line bordered button (304×63,
four lines, at 380). The provenance line printed a raw ISO stamp. And the proceed
button promised "the plan will say SITE CONDITIONS NOT CHECKED" while a warm memo let
the re-generation scan fine and print no disclosure (F-S5-7).

Why: `showResults` (`GeneratorShell.tsx:746`) was keyed on the breakdown request, and
the breakdown and the audit answer independently — the breakdown can succeed (memo)
while the audit refuses, or both can 400; the announcement fired at the breakdown's
`post` (`:776-782`); `OutputCards` rendered its cards and buttons for any `generated`
regardless of the breakdown state. The strip's pointer restated the reason and both
remedies. The stamp formatter existed (`lib/scenarios/site-corrections.ts:163`,
`fmtScanStamp`) but two containers bypassed it. And the promise lived in two places:
the button label and the wire sentence itself (`src/api/site_scan.py:274`).

## What shipped

| commit | what |
|---|---|
| `67bf9a0` | **backend** — `SITE_SCAN_UNAVAILABLE_MESSAGE` states the input, not the outcome: "… Retry, or generate anyway — the plan says whether the scan ran." String only; wire 0. Shipped alone; healthz == 67bf9a0 confirmed before commit 2. |
| `20c9c9a` | **the gate** — `planDeclined = auditDeclined \|\| (!auditSettled && prevSettled400)`; `resultsVisible = showResults && !planDeclined`. Hero, OutputCards `generated`, PricingCard, the zone-note and `.zone.dominant` read it; both stale ribbons are suppressed under declined; `OutputCards` gains `declined` (the empty state's headline alone); the #193 announcement moves onto its own arming (Generate / Retry / proceed), consumed at the pair's settle, "Plan generated — …" only when the stamped audit is clean. Red-proved: 6 new cases fail on HEAD's components. |
| `e15768f` | **one voice + the stamp** — the strip pointer is "see the notice in the Results zone."; `fmtScanStamp` in the refusal container and the strip's NOT-CHECKED container, ISO on `<time dateTime title>`. Red-proved: 2 flipped cases. |
| `99f6bf5` | **the actions** — both `.dl-btn` inside `.scan-actions`, Retry first, "Generate anyway" with "tries the scan once more · the plan says whether it ran" beneath; two scoped layout rules + one ≤ 480 px query in `globals.css`; both disabled under `inFlight`. Red-proved: 8 cases (label pins + the CSS pin). |
| `9681276` | **the declined-pair landing (ruling c2)** — the error branch of the #152 E effect waits for the stamped audit, scrolls when the pair is declined, focuses either way; the `post` branch byte-identical. Red-proved: 1 case. |
| `7c52c67` | **evidence** — README, `s2a25-lc.js`, the local run, the replay body. |
| this | **prod evidence** — the sha-gated run on `www.conestruct.com` at 7c52c67 (`outS2A25Prod/`), a docs commit on its own branch cut from `main` after the ship. |

## The rulings recorded

- **Ruling c2 (#152 E re-read).** *The no-yank rule stands for errors that carry no
  action; a refusal carries two.* On `genState === "error" && auditDeclined` with the
  arming set, the results zone lands exactly as `post` does; the `post` path is
  unchanged (the commit-5 diff removes no line of it — the only removed lines are the
  moved `auditSettled` / `stripAudit` / `auditDeclined` declarations and the old
  dependency list). #250's measurements on the ready-breakdown path remain valid.
- **Ruling (a).** The audit's verdict gates the results, never the breakdown's arrival.
  The breakdown's answer is held (#192 carry, `GeneratorShell.tsx:315-325`), never
  shown under declined; downloads return the moment the stamped audit is ready.
- **Ruling f.** (6a) plus the backend sentence. (6b) — skipping the scan when
  `proceed_if_unavailable` is set — rejected: a new `SiteScanReason`, a new disclosure
  string ("service unavailable at generation" would be false), its consumers on the
  audit PDF, crew narrative, plan sheet and section 03, ~12 test files, and the
  product cost of discarding a scan the warm memo would have supplied for free.
- **Ruling d.** "Generate anyway", not "Generate without waiting for the scan": under
  (a) the scan runs again (up to the 20 s budget) and is merely tolerated on failure,
  so "without waiting" is true only under the rejected (b).

## A correction to the checkpoint's finding 1

The checkpoint said the under-the-nav refusal (F-S5-3 #2) "was not #250's race" because
a breakdown-400 pair never scrolls. That holds for a **re-generate** (Reopen → Generate,
Retry): the pre-generate refire is pending at the click, the landing waits for the
generated answer, and on `error` it never fired. On a **first Generate** the
pre-generate breakdown is already ready, so `genState` is `post` at the click and the
scroll fires immediately — before either answer, before the container exists — and the
container's final position is then #250's anchoring race (the sidebar swap in the
scroll frame). The post-generate-scroll suite's first case pins that click-time scroll;
the c2 case pins the re-generate path. Both mechanisms are real; c2 closes the second,
#250 owns the first. The live check reports the landing count per branch so the two
are not conflated.

## Live check (`s2a25-lc.js`, `outS2A25Local/`)

The local run: the dev server on this branch (commits 1–5) proxying to the deployed
backend, healthz gate == `67bf9a0` (B1 PASS). Denver pin 39.7269, −104.9873, bearing
180, 1,000 ft. 1440×1000 and 380×800. **ALL PASS 172/172** (`log.txt`,
`results.json`). The prod run after the ship is the section below.

Natural vs replayed: neither viewport's first Generate refused naturally (D0: a clean
plan, hero, 4/4 downloads, "Plan generated — 39 devices, 12 types." written once), so
every declined leg below is a **replay** of the captured 400 (`refusal-replay.json`) on
the Generate's own request(s) — branch A fulfils the audit only (the breakdown runs for
real), branch B fulfils both. 3 runs per branch per viewport. The Retry / proceed legs
run against the live backend and no natural refusal occurred on them either.

| leg | 1440×1000 (A1..A3, B1..B3) | 380×800 (A1..A3, B1..B3) |
|---|---|---|
| D1 no plan | hero false; download `.dl-btn` 0; cards 0; sr ""; zone-note false; dominant false; ribbons 0 / 0 — 6 of 6 | same — 6 of 6 |
| D2 empty state | "No package yet" alone | same |
| D3 one voice | the wire sentence ×1; PLAN DECLINED ×1; strip "PLAN DECLINED · see the notice in the Results zone." + pill SERVICE UNAVAILABLE | same |
| D4 landing (P3) | container 213..404 (h 191), results top 174, nav-h 52, innerH 1000 — **A: 3 of 3, B: 3 of 3** | container 230..590 (h 360), results top 191 — **A: 3 of 3, B: 3 of 3** |
| D5 actions (P11/P10/P4) | "↻ Retry scan" 99×40 at x 185..284, "Generate anyway" 125×40 at x 296..421, both y 331, both `1px solid rgb(31,123,176)`, both `.dl-btn`, one line each; the row starts on the section label's left (185) | both 304×44, x 39..343 (the label's left), stacked at y 441 / 497, same border, one line each |
| D6 consequence | "tries the scan once more · the plan says whether it ran" | same |
| D7 stamp (P12) | "corridor scan · scan budget exceeded (20 s) · attempted 8 sep · 16:14 utc · budget 20 s"; no ISO in the container's text; `<time title>` = the ISO | same |
| D8 co-frame (spec 31) | 0 samples with band + refusal on every run (the band sampled on the A runs; a replayed B pair can settle inside one 100 ms interval — recorded) | same |
| D9 contrast (P9) | 8 pairs in the container, lowest 5.61 (the provenance role); the buttons `#56bcf2` on `#14202e` 7.74 | same |
| D10 targets | 2 targets, 40 / 40 (≥ 32) | 2 targets, 44 / 44 (≥ 44) |
| D11 axe (wcag2a/aa/21aa/22aa) | 0 nodes (baseline 0) | 4 nodes, all pre-existing and outside the container: `scrollable-region-focusable .gap-8`, `target-size` on `Edit Lane W`, `Edit Work zone`, `.strip-edit-all` — the audit's own F-S5-10 count on this surface (the setup strip's 380 wrap, F-S3-7); the arc-23 "2 named" was a settled ok plan. Retry at 44 retires none, as predicted |
| R0 band (proceed, B1) | "RE-GENERATING · without the site check" | same |
| R1 recovered | container gone; hero; 4/4 downloads enabled; strip VERIFIED · 3 plan flags — every run (1 click each; no natural refusal on the way) | same |
| R2 announced once | sr writes during the settle: "Plan generated — 39 devices, 12 types." exactly once — every run | same |
| NOT-CHECKED (proceed, B1) | absent: the re-run scan succeeded — F-S5-7's honest outcome, which the label and the sentence no longer contradict | same |

Live regions under declined (info): the strip's polite wrapper "PLAN DECLINED · see
the notice in the Results zone. SERVICE UNAVAILABLE", the sr-only `role=status` "",
the container `role=alert` with the sentence — two speakers, two facts.

Landing, read honestly: every replayed pair here settled within ~0.1–10 s of the click
on a **first Generate**, where the #152 E scroll fires at the click (the pre-generate
breakdown is ready) and the zone lands at 174 / 191 before the container mounts — so
3 of 3 per branch measures the current landing plus the container's mount inside the
zone, not the c2 branch (a re-generate path; pinned by the mounted case) and not
#250's race (which needs the sidebar swap to coincide with the scroll frame — no run
here hit it; the prod re-run reports its own count).

Two harness defects were found and fixed between the three local runs, none of them
product findings: the "lines" heuristic divided the button's full height by the
line-height (one line read as two); the settle detector fired on the stale container
in the first sample after a Retry click (recovery legs now require the band to have
been seen and gone); and the one-edge rule accepted only a shared left or right (a row
shares its top). Runs 1–2 are not committed (their substance matched run 3).

## Prod run (`outS2A25Prod/`)

Ship: `main` fast-forwarded to `7c52c67` (the branch's tip); healthz `sha` ==
`7c52c67c6927b640442808d1e6a812dac0238dfd` == `origin/main` before the run. The harness
against `https://www.conestruct.com`, same pin, same viewports, 3 runs per branch.
**ALL PASS 172/172** (`log.txt`, `results.json`), first attempt. The harness's sha gate
compares the full 40-char sha — a first invocation with the short sha failed the gate
by design (`SHA GATE FAILED`, exit 2) before any page was opened; nothing else changed.

Natural vs replayed: the same as local — neither viewport's first Generate refused
naturally (D0: clean plan, 4/4 downloads, "Plan generated — 39 devices, 12 types."
once), so all 12 declined legs are replays of `refusal-replay.json`; the 12 recovery
legs (10 Retry, 2 proceed) ran on the live backend and none refused. 14 Generates,
0 natural refusals.

Every measured figure equals the local table: D1 six-of-six on every run; D3 one voice;
D4 container 213..404 / 230..590, results top 174 / 191, **A: 3 of 3, B: 3 of 3 at
both viewports**; D5 buttons 99×40 + 125×40 on one row at y 331, 304×44 stacked at
y 441 / 497, `.dl-btn`, one line each; D7 "attempted 8 sep · 16:14 utc", no ISO on the
surface, `<time title>` = the ISO; D8 0 band+refusal co-frames on every run (up to 209
samples on A1); D9 lowest pair 5.61, buttons 7.74; D11 axe 0 at 1440 and the audit's
own four at 380; R1 recovered on every run with one click; R2 the announcement written
exactly once per recovery; NOT-CHECKED absent after the proceed (the re-run scan
succeeded on prod too).

Landing count, honestly: 12 of 12 replayed pairs on prod settled between 13 ms and
21 s after a first Generate's click, where the scroll fires at the click — so the
count measures the current landing plus the container mounting inside the zone.
#250's race did not occur in any run (prod or local); it is measured absent here, not
fixed, and stays open under #250.

## Rule 5 churn (predicted → actual)

| surface | predicted | actual |
|---|---|---|
| `scan-refusal.test.tsx` | 6 flips + 3 new | 7 flips (213 stamp; 217-218 label + promise → its negation; 245 / 259 / 273 / 358 label regex ×4; literal 71) + 3 new (rule-10 cases) + 1 new (CSS-rule pin) ; the `OutputCards` mock removed so the buttons are counted for real |
| `scan-disclosure.test.tsx` | 2 flips | 2 (35 literal, 143 label) |
| `results-head.test.tsx` | 1 literal flip | 1 (112) |
| `SetupStrip.disclosure.test.tsx` | 1 flip | 1 (53 → the sliced stamp, ISO on `<time>`) |
| `a11y-announce.test.tsx` | +2 | +2, **+1 flip beyond the table**: "announces … with the counts the hero renders" asserted "Plan generated" at the click, before the generated wire's audit had answered — the pre-verdict announcement itself; it now flushes the pair first |
| `WorkingBand.test.tsx` | 0 | **2 flips beyond the table**: the old sentence literal (:75, a stub body) and the `/Generate without site check/` pin (:297); "↻ Retry scan" (:276) unchanged |
| `OutputCards.test` | +1 | +1 (`declined` empty state) |
| `post-generate-scroll.test` | +1; existing 0 | +1; existing 5 unchanged (the broken-breakdown case still asserts no scroll) |
| CSS-rule test | +1 | +1 (in `scan-refusal.test`: `.scan-actions`, `.scan-refusal .dl-btn`, the ≤ 480 query, no hex) |
| `StatusBar.*` · `ProgressRail.single-voice` · write-lock honesty | 0 | 0 |
| pytest | 0 flips | 0 (the equality pin re-reads the constant; 45 site-scan tests) |
| backend wire · pin fixtures · snapshots · payload senders | 0 | 0 |
| vitest | 970 → ~978 | 970 → **978 passed** (133 files); tsc clean; pre-commit ESLint + tsc passed on every commit |
| axe 1440 / 380 | 0 → 0 · 2 named → 2 named | 0 → 0 · under DECLINED at 380 the baseline is the audit's own 4 (F-S5-10: `.gap-8` + `target-size` ×3, all in the setup strip's wrap) → 4, the same four; none in the container; Retry at 44 retired none |
| behavior changes stated | results gated on the audit verdict; ribbons suppressed under declined; strip sentence; backend sentence; proceed label; Retry treatment; declined-pair landing (c2); recovered-plan announcement; sliced stamps in two containers; declined empty-state variant | all of those, plus: the announcement waits for the pair on every Generate (not the breakdown alone); a breakdown error that settles before the audit answers now disarms (and focuses) at the pair's settle; the ≤ 480 px media query is the first at that width (house queries are 900 / 980); `inFlight` on both actions (uniformity — unreachable while the container is mounted) |
| flaky, not this arc | — | `GeneratorSidebar.manual-pin-move.test.tsx` "typing a new latitude drops siteConditionOverrides" failed 3× in a row (also on the untouched main checkout at 67bf9a0) around 03:36 UTC, then passed on the next full run; "Unable to find … 'Edit manually'" after Reopen — timing in the mount helper, pre-existing |

## The #261 case named

The "—" placeholders in `OutputCards.tsx` (`statFromBreakdown`, `step_count ?? "—"`)
remain reachable when a **clean audit** meets a **broken breakdown** (a 502 or a network
error: `genState === "error"`, `planDeclined` false). That is #261's P16 item; this arc
removes the declined case only.

## Follow-up (drafted in house style — Ryan posts)

**1. The band's proceed-anyway object says "without the site check"; under (6a) the scan runs**
Labels: bug, frontend, ux, p2, priority-low
> `lib/working-band.ts:108` names the flight opened by `proceed_if_unavailable` "RE-GENERATING · without the site check". Under the semantics kept by #258 ruling f the scan is tried once more (memo or Overpass, up to the 20 s budget) and only tolerated on failure — F-S5-7 measured an 8.6 s scanned re-generation under that band. The object states an outcome the request does not guarantee, the same class as the retired button label.
> Proposed: "after a proceed-anyway" — the input, not the outcome (the same rule as "Generate anyway"). One string; `WorkingBand.test` pins it (2 cases); the arc-23 harness expects it (`object: "without the site check"`, evidence only). Band rules otherwise untouched (#252).
> Acceptance: the band's object under proceed-anyway names the acknowledgement, not the scan's fate; the block / NOT-CHECKED container then say what happened.

Found by s2-arc25 (#258) — `validation-artifacts/committed/s2-arc25-refusal-surface/README.md`, "Follow-up".

## Contracts

- Rule 10 — `resultsVisible` false under any stamped 400, not only the scan code; the
  sr-only region "" under declined; nothing on the page says "generated" (mounted:
  `scan-refusal.test` rule-10 cases; live: D1 on every declined run).
- Rule 5 — every row above declared before the diff; the `post` landing path
  byte-identical (commit 5's removed lines listed under the rulings).
- P2 — the reason stated once: `messageCount === 1`, `PLAN DECLINED ×1` (live D3;
  mounted `scan-refusal` "message verbatim once").
- P16 — no "—" under declined (mounted `OutputCards` declined case: no "—" in the body);
  the 502 case named as #261's above.
- P8 — the band still owns the wait; the container mounts only after the pair settles
  (spec 31 test in `WorkingBand.test` unchanged; live D8 / R3 co-frame 0).
- P3 — c2 measured: live D4 per branch.
- P11 — one `.dl-btn`; one `fmtScanStamp` (already in `lib/`; no new formatter).
- P10 — live D5 / D10 (≥ 32 at 1440, ≥ 44 at 380).
- P12 — live D7 (`/\d{4}-\d\d-\d\dT/` false on the container's text; the ISO on the
  `<time>` title) and the NOT-CHECKED container on the proceed run.
- #198 — the `.sys-event` handoff strings in `GeneratorSidebar.tsx:907-916` untouched;
  the refusal container's text is the wire sentence.
- Rail untouched (#228) · suggest-never-set (the proceed acknowledgement stays per
  object, `GeneratorShell.tsx:305-311`) · `role=alert` on the container unchanged ·
  write-lock declarations unchanged (both actions `data-write`; the honesty test
  green) · citation counter 19 unchanged · backend wire 0 (a string) · `getByText`
  direct text nodes (the new assertions use exact names / `textContent`).
- Verifier — see the stop-point 2 report.

## Principles

| | verdict | how |
|---|---|---|
| P1 | honoured | the actions row is a fixed-height row per viewport; the empty state → results swap happens only on the operator's Retry / proceed; rects in the live check |
| P2 | honoured (the arc) | three statements → two facts (verdict on the strip, reason in the container), each once |
| P3 | honoured on the re-generate path (c2); the first-Generate path is #250's | live D4 counts per branch |
| P4 | honoured | both actions on the section label's left edge at 1440 (±1), both edges at 380 (D5) |
| P5 | n/a | |
| P6 | honoured | `white-space: nowrap` on the buttons; the row wraps, never a label (D5 `lines === 1`) |
| P7 | n/a | |
| P8 | honoured | no new wait signal; the band is the voice; no co-frame (D8) |
| P9 | honoured | ⚠ + words and ↻ + words unchanged; the container's pairs re-measured with `.dl-btn` inside `--canvas-tint` (D9) |
| P10 | honoured | 40 at 1440 / 44 at 380, measured (D5, D10) |
| P11 | honoured | `.dl-btn` reused; one formatter; two scoped layout rules and one query, no new hex (CSS-rule test) |
| P12 | honoured | no raw ISO on either container; Ryan's hand-check |
| P13 | n/a | |
| P14 | honoured | the declined empty state shows the shape of the answer ("No package yet") with no fake numbers |
| P15 | n/a | |
| P16 | honoured | no "—" under declined; the remaining 502 case is #261's |

## Files

- `s2a25-lc.js` — the harness (D0 natural, A×N breakdown-ready, B×N breakdown-400,
  each with a recovery leg); `refusal-replay.json` — the replay body (the s2-audit-1
  capture, `detail.message` updated to the 67bf9a0 constant).
- `outS2A25Local/` — the local run: `log.txt`, `results.json`, per-run samples,
  measures, pairs, axe, screenshots.
- `outS2A25Prod/` — the prod run at 7c52c67: the same set.
