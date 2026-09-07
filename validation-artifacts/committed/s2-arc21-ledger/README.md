# s2-arc21 — #249 the variation-4 "leader-dot ledger" for the site conditions block

Branch `issue-249-ledger` off `e34a1c0` (the s2a20 evidence merge; healthz ==
origin/main confirmed at session start, 2026-09-06). Frontend-only: wire,
backend, fixtures, snapshots, payload senders **0**.

Commits: `1d44487` ledger rows/record/picker/footer · `aa019a5` the re-map
against spec A–D · `334ffab` the results-head lockup · `4803922` spec 34
in-flight disable · this commit, evidence.

## Spec provenance

The 82-rule build spec is Claude Design's (issue body, 2026-09-06). Sections
A–D (rules 1–23) were missing from the body paste and reached the issue as a
comment (2026-09-06T15:11Z) **after commit 1** shipped on a reconstruction
from the cross-references; `aa019a5` is the re-map. The reference HTML/CSS
("Site Conditions Block - Variations.html", `site-conditions-variations.css`)
are not in the repo; nothing here cites them.

## Rulings applied (GO 2026-09-06) and what they became

| ruling | in the build |
|---|---|
| a · tokens | reuse `--canvas --rule-soft --rule --ink-on-dark --ink-on-dark-faint/--none --act --act-bright --pass --on-act`; detected hue = `--dim` (symbol, word, lockup figure); three scoped values on `.workbench .site-corrections`: `--sc-leader #4a6280`, `--sc-act-wash rgba(52,169,232,.14)`, `--sc-disabled rgba(147,160,176,.35)`; rejected `#e0a63c #8a97a7 #5d6b7c #8fd2f6 #a9dcf8 #bde3f9 #3c5069` (the grid-tokens test sweeps the block's declarations for them) |
| b · no radius | absent evidence cell empty (`.sc-evidence:empty` collapses); footer `corridor scan · {stamp} · a correction re-generates the plan` with `mode` from the wire; no "within N ft" / "0 in scan" (the browser leg R5 greps for them) |
| c · moot | `⚠ --warn`, word "moot" via the `.sys-event.warn` record variant — unchanged from arc 18 |
| d · lockup | `deriveResultsHead → wait \| scanned{count,total} \| null`; `total` counted from the keyed buckets served; 0 renders (declared); `unavailable+proceeded`, refused, `not_run`, error, pre-generate ⇒ null; below `.zone-head` |
| e · (a′) | `fmtScanStamp`: `d mon · hh:mm utc` by slicing the UTC ISO; anything else verbatim; full ISO on `<time title datetime>` |
| f · K80 / K82 | leader `#4a6280` (2.63:1, decoration, **exempt** from 4.5:1 — stated here); Dismiss border stays `--rule` |
| spec 34 | `scanInFlight` derived once in the shell (= the wait state); the strip renders the last ready scan with every button disabled + `aria-busy`; the block no longer unmounts on a correction |
| spec 46 | `dismissAllowed(buckets, flag)` gates `openPicker` |
| spec 7b | names wrap; at 380 "Adjacent interchange (highway ramps)" is the one that does (name height 38 vs 19, `outS2A21Local/rows-380x800.json`) |
| spec 66 | `container-type: inline-size` on the block root; `@container (max-width: 420px)` — the first `@container` in `globals.css` |
| K74 | → #153 (touch targets), not this arc |
| K75 / 77 / 78 / 79 / 81 | accepted: no row rules; symbol leads; none word body ink (10.68); record rows taller (a "3 corrections" collapse is a future issue trigger if the block doubles); two-line lockup |

## Deviations, each with the rule that forced it

| spec | built | why |
|---|---|---|
| 1 "no border of its own" | the band root keeps `border-top: 1px dashed --rule` | the `.jbar-suggest` frame is the strip's band rule and is pinned byte-identical |
| 7b ellipsis | names wrap | rule 10 (truncation hides signal) |
| 9 leader `#3c5069` | `--sc-leader #4a6280` | K80 ruled |
| 11 name 13px `#eef3f8` | `tr-field` (sans 12 / 500 / `--ink-on-dark`) | ruled; #226 four-role table |
| 12/13 word 11 / evidence 10.5 | as spec (commit 1b) | — |
| 16 footer sans 11.5 | `tr-prov` (mono 10) | ruled; 21 sizes snapped |
| 17/18 footer label `#8a97a7`, stamp underline `#5d6b7c` | `tr-prov` ink; the role's dotted underline moved to the stamp alone | ruled; the two hexes have no role (5.54 / 3.03) |
| 19 record sentence 12.5 | sans 12 / 400 / lh 1.55 / `text-wrap: pretty` | 21 sizes snapped |
| 20 buttons 9.5 / 56 line 2 9.5 / 57 link 9.5 0.14em | 10px mono family; link = `tr-signpost` (0.06em) | 21 sizes snapped; role table |
| 23 asserted "▲ gray, no word" | `✓ --pass` (the #227 confirmed variant), no word | vocabulary: ✓ = confirmed, ▲ = count-affecting delta; the arc-18 record tests pin the glyph. **Open for ruling** if Ryan wants ▲ |
| 23 amber; moot ◌ | `--dim`; `⚠` | ruled a, c |
| 27/63/76 radius | nothing printed | ruled b (rule 12: the thresholds are three different tests) |
| 30 amber DISMISS border | `--rule` | ruled f (K82) |
| 31/44/51/57 hover `#8fd2f6` | `--act-bright` | ruled a |
| 33/41/42 washes .12/.14/.16 | one `--sc-act-wash` .14 | ruled a (CHOSEN) |
| 39 label "REASON" | the legend keeps "Reason for dismissing <label>", styled in the step register | the #245 accessible name is load-bearing |
| 41 `aria-pressed` | native radio `:checked` | ruled (C5); a radio carries its own state |
| 42 Confirm ink `#bde3f9` | `--act-bright` on the wash (6.15) | `--act` on the wash measured 4.97 in local run 1 — above the floor but thin; same pair as the chosen chip. **Deviation from ruling a's "existing button.confirm pair"** for a measured reason; Ryan can veto |
| 43 disabled Confirm act·.35 | `--sc-disabled` | one disabled ink for the block |
| 48 record symbol `#93a0b0` | the vocabulary's per-state color (`--none` ×, `--pass` ✓, `--warn` ⚠) | glyph colors are fixed by the table |
| 56 "OF FIVE CHECKED" | `of {total} checked`, digits | rule 12 |
| 59 lockup on non-ok | null for `not_run` / `unavailable` / refused | rule 10; ruled d |
| 60 lockup above the section header | below `.zone-head` | ruled d (#152 E landing) |
| 64 "older than 24h → date" | date always | ruled e (a′): no clock, no arithmetic |
| arc-20 ruling e (column heads) | none | a ledger has no heads; K77 |
| arc-20 ruling f (Confirm in the sub-row's action cell) | Confirm last in the flex line | spec 42, ruled |
| 73 chips 9.5 at narrow | 10px, padding 4×7 | 21 sizes snapped |

## Measured pairs (both viewports, `outS2A21Local/pairs-*.json`; rule 13 — measured, never asserted)

| pair | fg on bg | ratio |
|---|---|---|
| lockup figure (`--dim`) | `#ff8a2e` on `#14202e` | 7.00 |
| lockup line 1 / condition name (`tr-field`) | `#c8d1dd` | 10.68 |
| lockup line 2 / evidence / legend / footer label / stamp (`--ink-on-dark-faint`) | `#93a0b0` | 6.19 |
| lockup link / Cancel (`--act`) | `#34a9e8` | 6.26 |
| ▲ symbol + detected word (`--dim`) | `#ff8a2e` | 7.00 |
| ✓ symbol (`--pass`) | `#4fd787` | 8.94 |
| none word (body ink) | `#c8d1dd` | 10.68 |
| chip unselected / ghost button | `#c8d1dd` | 10.68 |
| chip chosen / Confirm on the wash (`--act-bright`) | `#56bcf2` on `#183348` (the wash composited) | 6.15 |
| note ink | `#ffffff` | 16.46 |
| leader — decoration, exempt | `#4a6280` | 2.63 (reported, not graded) |
| disabled ink — inactive control, WCAG 1.4.3 exempt | `rgba(147,160,176,.35)` ≈ `#3f4c5b` | 1.91 (from the probe; the `disabled` attribute is the second channel) |

## Local run — ALL PASS 51/51 (+5 info) (`outS2A21Local/`)

Stack: the arc-20 stand-in (`../s2-arc20-scanned-block/local-stack/`:
Overpass mock on 8766 held `A20_DELAY_S=8`, stubbed uvicorn on 8765 from the
working tree, `next dev` with `MODAL_RENDER_URL=http://127.0.0.1:8765`),
Lakewood pin 39.7113 / −105.0815. Honesty note: the local scan is real
backend code over a recorded payload; the prod run scans live. Run 1 (not
kept) found two things fixed before run 2: the footer's leader stopped at half
the block (the band root is `align-items: flex-start`; `.sc-foot` now
`align-self: stretch`) and Confirm's ink on the wash measured 4.97.

| leg | 1440×1000 | 380×800 |
|---|---|---|
| W1 wait line in view while pending (Generate) | 232/232 after 600 ms | 73/73 |
| W2 / W3 | wait gone on settle, lockup present; 0 co-present | same |
| L3 lockup = the block | `3` · "Site conditions detected" · "of 5 checked" · link; 3 detected rows of 5 | same |
| R1 one action edge (rows / picker / record) | right 1252 for Dismiss · Assert · Cancel · Undo | right 338 |
| R2 no wrap | none | none |
| R3 row heights | 46 × 5 | 85/92/85/85/58 — **reported**: the ledger line wraps (spec 68–72); the 92 is the wrapped interchange name |
| L1 leader | display block, widths 515–692, `rgb(74,98,128)` | display none (block w 332 ≤ 420) |
| L2 right group one line-box | 1/1/1/1/1, h 18 | reported: 1 box each, h 44 on detected rows (word + evidence wrapped to two lines) |
| R4 picker | 5 → 6 rows; [Confirm dismiss] in the flex line; condition row [Cancel] | same |
| R5 no `details[0]` / radius phrase | absent | absent |
| L5 footer | `scan` · leader · "corridor scan · 6 sep · 15:29 utc · a correction re-generates the plan"; `<time title>` = `2026-09-06T15:29:25+00:00` | same |
| R6 axe (picker open / chosen / other+note) | 0 in block or lockup; total **0** (baseline 2) | 0 in block; total 2 = the two named pre-existing (`scrollable-region-focusable .gap-8`, `target-size .strip-edit-all`) |
| R7 pairs | table above, all ≥ 4.5 | same |
| L4 in-flight disable (Assert) | 78/78 pending samples: block mounted, `aria-busy`, 5/5 disabled, wait line up, no lockup; settled: not busy, 0 disabled | 78/78; same |
| W1 assert | 73/73 in view (936..953) | **FINDING, reported not graded** — see below |
| R8 record | sentence 1 node, no result word, no leader, [Undo]; sans 12px `#c8d1dd`; Undo → 5 rows, 0 records | same |

### Finding — spec 34 moves the in-flight signal at 380

Arc-20's block UNMOUNTED on a correction, so the page collapsed under the
operator and the Zone 2 wait line scrolled up into view (arc-20 W1 assert at
380: 174..220). Spec 34 keeps the block mounted, so nothing collapses: mid
re-generation at 380 the block is in view (98..630, busy, 5/5 disabled) and
both the status bar (877..945) and the wait line (1045..1090) sit below the
800 px fold. The only in-view in-flight signal is the disabled block. Options
for ruling: (a) accept — the disabled state is spec 34's own signal and the
strip's polite region still announces VERIFYING to assistive tech; (b) a
one-line in-block status while busy (new copy, not in the spec). Not built.

## Prod runs on `4443ccf` (healthz == origin/main, sha-gated; www.conestruct.com, Denver pin 39.7269 / −104.9873, live scan)

Rulings before the run (2026-09-07): the 380 in-flight finding accepted as-is
(not this arc); the Confirm ink change accepted; the asserted record keeps ✓.

**Run 2 — ALL PASS 51/51 (+5 info) (`outS2A21Prod/`).** Live scan: 4 of 5
detected on this corridor (intersection, sidewalks, bike, interchange), no
refusal. Generate settled 5.1 s / 1.6 s; Assert 16.1 s / 18.4 s.

| leg | 1440×1000 | 380×800 |
|---|---|---|
| W1 wait line in view (Generate) | 41/41 after 600 ms; landing 789 → 654, wait line 137..154 | 8/8 |
| L3 lockup | `4` · "Site conditions detected" · "of 5 checked" · link | same |
| R1 one action edge (rows / picker / record) | 1252 | 338 |
| R3 | 46 × 5 | 85/119/85/85/58 reported (the 119 is the wrapped interchange name plus a wrapped evidence line) |
| L1 / L2 | leader shown (467–692 wide), right group one line-box | leader hidden (block w 332) |
| L5 footer | "corridor scan · 7 sep · 05:5x utc · a correction re-generates the plan", `<time title>` the ISO | same |
| R6 axe | total 0 (baseline 2) | 2, the two named |
| R7 pairs | as the local table, all ≥ 6.15; leader 2.63 exempt | same |
| L4 in-flight | 148/148 pending samples held, busy, 5/5 disabled, wait line in view (926..943) | held, busy, 5/5 disabled; wait line 1071..1117 below the fold (the accepted finding) |
| R8 | record one node, no word, [Undo]; Undo → 5 rows | same |

**Run 1 — 50/51 (`outS2A21Prod-run1/`), kept as a finding.** Identical on
every leg except `W1 generate` at 1440: the post-Generate landing put
`scrollY` at 851 and it never moved — the scroll anchoring that follows the
sidebar's unmount (arc-20 prod: 789 → 654 by 220 ms; this arc's local run:
984 → 654; run 2: 789 → 654) did not fire, so the status bar sat at −170..−123
and the wait line at −60..−43 under the fixed nav for the whole 9.2 s scan
(`outS2A21Prod-run1/generate-1440x1000-samples.json`, 85 pending samples,
0 in view). The wait-state markup is byte-identical to arc-20 (`ResultsHead`
wait branch unchanged; the block is absent during a first Generate), so this
is not something the ledger changed: it is the #152 E landing racing the DOM
swap — Chrome suppresses scroll anchoring for a frame in which a programmatic
scroll occurred, and whether the swap lands in that frame depends on when the
breakdown answers. Intermittent (1 of 2 prod runs; 0 of 2 arc-20 prod runs; 0
of 3 local). **#247's fix relied on the anchoring, so when the race goes the
other way the original defect is back for that generate.** For a follow-up
issue on the landing (`.zone` scroll margin / #152 E), out of this arc's scope
by the GO.

## Rule 5 churn — predicted vs actual

| surface | predicted (GO) | actual |
|---|---|---|
| `SetupStrip.corrections.test.tsx` | 4 rewritten +3 | 4 rewritten (50, 177, 251, 284) +2 (verbatim stamp; spec 34 held scan) |
| `SetupStrip.grid-tokens.test.tsx` | 3 rewritten, 51 kept | 3 rewritten (+ the 1b pins), 51 kept byte-identical |
| `lib/scenarios/site-corrections.test.ts` | — | +2 (`dismissAllowed`, `fmtScanStamp`) |
| `GeneratorShell.results-head.test.tsx` | 137 rewritten, 153 inverted, +5 | 137 rewritten, 153 inverted, +3 (total-from-wire; rule-10 truth table; spec 34 Assert flight), the two #247 cases re-pointed (one fixture corrected to production truth: the pre-generate audit is `not_run`) |
| vitest | 937 → ~946 | 937 → **944** (129 files) |
| pytest · fixtures · snapshots · wire · payload senders | 0 | 0 (2036 passed, 2 skipped) |
| `tokens.test` · `type-roles.test` · `ProgressRail.*` · `StatusBar.*` | 0 | 0 |
| axe 1440 / 380 | 2 → 2 / 2 → 2 named | 2 → **0** / 2 → 2, the two named |
| behavior changes stated | block re-laid; 0 ⇒ lockup; block held in flight; Confirm placement; separators removed | all five, plus: no column heads; the footer's stamp form |

## Contracts

- #198 — the record sentence is one text node (corrections test 284; browser R8 `disclosureNodes 1`); wraps only (`text-wrap: pretty`).
- Rail untouched (#228) — `ProgressRail.single-voice` green in the full run; the lockup is results content.
- Suggest-never-set — only Dismiss / Assert / Confirm / Cancel / Undo write; disabled clicks write nothing (corrections test, spec 34 case).
- Rule 3 — `fmtScanStamp` is a regex slice: no `Date`, no clock, `Number()` only strips the day's leading zero and indexes the month table.
- Rule 10 — lockup null in every non-`ok` state (truth-table case); empty evidence on absent rows; `not_run` renders no block; a held outage never re-announces.
- Rule 12 — N and T counted from the wire (`of 3 checked` case); no literal five.
- Rule 13 — glyph + word every state; pairs measured above.
- Citation counter — 19, unchanged (no MUTCD citation added).
- `getByText` direct text nodes — every assertion.
- Band byte-identical — grid-tokens case 4 green; the verifier confirmed the three rules sit outside every hunk.

## Files

- `s2a21-lc-prod.js` — the browser leg (header lists W1–W3, L1–L5, R1–R8).
- `outS2A21Local/` — log, samples, axe, pairs, geometry JSON, screenshots.
- `red-run-c1-ledger.txt` (10 failed on baseline), `red-run-c2-lockup.txt` (5 of 6), `red-run-c3-inflight.txt` (2 of 2).
- `test-accounting.txt` — vitest 129/944, pytest 2036 + 2 skipped.
