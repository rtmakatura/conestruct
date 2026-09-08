# s2-audit-1 — Part 2: principle comments for the open UI issues

Drafted 2026-09-08 against prod `2e0b25e` (healthz = origin/main). Measurements cite `findings.md` rows (F-numbers) and screenshots under `out-run1/` and `out-followup/`. Each section is one comment, ready to paste; the issue bodies are untouched. Ryan posts.

The `p1`…`p16` labels are proposed; every comment names the labels it would carry.

---

## #253 — post-generate next steps (sticky three-chip strip)

```
## Principles
Violates (today, the lockup it replaces): P3 (next thing visible) — the #249 lockup "4 · Site conditions detected · of 5 checked · correct in setup ↑" is a fact, not a step; measured at settle it sits at 218..255 in a 1000 px viewport, in view but unread as step one (findings F-S2-4). P2 (one voice) — the lockup and the block header both state the detected count today (F-S3-3: lockup "4 … of 5 checked", block rows 5 with 4 detected).
Fix honours: P3 — three ordered chips name the steps; P2 — the lockup is deleted, chip 1 is the one surface for that field (conflict 1, ruled); P9 — every chip is symbol + word from the vocabulary; P16 — counts hold the last server value under the band, no placeholder, no "done".
Fix would violate, unless adjusted: P1 — spec 3 makes the strip `position: sticky` under the nav. The moment it pins, every anchor jump lands 34–52 px lower than today (spec 10's 120 px scroll-margin vs the current 98), and the first pin changes the visible position of whatever is under it. Adjustment: reserve the strip's height in normal flow from the moment it mounts (it does — it is in the results head) AND bind `scroll-margin-top` on every `.zone` / `.jump-anchor` to `calc(var(--nav-h) + var(--strip-h) + 8px)` from the same mount, so the landing target is the same whether or not the strip has pinned. #250's option (c) is the same rule; land them together. P8 — a second pinned surface plus the band brackets a 380 viewport (spec 34: ~130 px of 800). At 380 today the band alone is 80 px in flight (F-S2-1); the strip un-pins below 520 px (spec 34's fallback) or it is a P8 deviation to rule.
P10 — spec 13 says chip height 34 px single-line. Under 44 px on a phone; at 1440 acceptable as desk density, at 380 the chips are full-width rows (spec 25) so pad them to 44.
Overlaps: #249 (closed — the lockup this replaces); #250 (landing race — same scroll-margin rule, #250 owns it); #254 (chip counts must include staged-not-applied corrections, #254 owns the wording); #153 (the 380 un-pin ruling); #235 (the strip is a new surface for the design round — #235 does not re-design it).
Labels: p3 p2 p1 p8 p10
```

## #254 — batch corrections (stage, apply once)

```
## Principles
Violates (today): P7 (reversible before irreversible; batch before commit) — one Confirm dismiss opened one request and locked the page for 4.1 s at Denver and 22.8 s at Lakewood (F-S4-6: band "RE-GENERATING · after a correction to Adjacent at-grade intersection", 37 and 209 samples); Undo opened a second request (F-S4-8). Four corrections = four to eight locked cycles.
Fix honours: P7 — Dismiss/Assert stage; only APPLY opens a request; Undo on a staged row is free. P15 — staged rows keep ◌ + "staged — not yet applied" + Undo; applied rows keep the #249 record shape. P16/P8 — the plan on screen is honestly the previous answer while corrections are staged; say so once, on the block footer (P2: one place — and the #253 chip, which reads the same field, is the second surface for the same count, so bind both to one derivation).
Fix would violate, unless adjusted: P1 — a staged row that swaps "▲ detected · Dismiss" for "◌ staged — not yet applied · Undo" must keep the row height (the scan rows are 46 px at 1440; the record rows are 33 px today, F-S4-7 — two heights for one row kind is the #255-2 class). Reserve one row height for all three states. P9 — ◌ already means "pending" in `--none`; "staged" is a pending state, so ◌ is right, but the word must be the one word "staged" everywhere (block, footer, chip). P13 — the APPLY control belongs in the block's action column, not a new surface.
Overlaps: #253 (the chip must read the staged count — bind to one field); #255 (row heights — #255 fixes the record row, this issue must not re-break it); #252 (closed — the band mounts once per Apply, the "band mounts once per Apply" measure is P7's).
Labels: p7 p15 p16 p1
```

## #255 — site-conditions block layout-shift defects

```
## Principles
Violates: P4 (edges) — reason-chip text is not centred: box centre 628.3 vs text centre 635.8 (+7.5 px) on every chip at 1440, +7.5 at 380; padding 25/10 (1440) and 23/8 (380) — the empty glyph slot on the left is the cause (F-S4-2, `out-run1/1440x1000-denver-s4-picker.png`). P1 (nothing moves) — choosing "Other (say what)" mounts the note input at 1063,689 and throws CONFIRM DISMISS from 1065,689 to 190,723: a new line, a different column, 34 px lower (F-S4-3, `1440x1000-denver-s4-other.png`); at 380 Confirm drops 34 px (44,1093 → 44,1127). P6 (content never dictates layout) — the record row is a second height for the same row kind: 33 px at 1440 vs 46 px scan rows (F-S4-7); at 380 the dismissed record is 108 px (5 lines) against scan rows of 85/119/58 (F-S3-15). The asserted sentence's 58-vs-36 wrap from the issue body was not reproduced at 1440 on this run (the dismissed sentence fits one line at 958 px) — the grow is real at 380 and on the longer assert sentence.
Also: P9 — CONFIRM DISMISS disables while the note is empty with no word saying why (disabled=true, title "", F-S4-4). Add a `title` / inline hint ("say what — required") or keep it enabled and validate on click.
Fix honours: 1) P4 — `justify-content: center` with the glyph slot reserved on BOTH sides (or the glyph overlaid), measured by box-centre = text-centre ±1. 2) P6/P1 — the per-record clause on one line at 1440, the advisory once in the footer, and one reserved row height for scan rows AND record rows (46 px) so a correction never changes the row count's geometry. 3) P1 — the note slot reserved from the picker's first paint (width allocated, visible on Other), Confirm fixed in the action column — measured Confirm rect identical before/after choosing Other.
Adjustment to the proposal: option "note on its own indented line beneath the chips" moves every row below it by the note's height the moment Other is chosen — that is the same P1 defect one row lower. Reserve the slot.
Overlaps: #254 (staged rows add a third row state — one row height rule covers it); #153 (the 380 wrap of "Adjacent interchange (highway ramps)" puts ▲ on its own line and the name at left 42 instead of 66 — F-S3-15 — is the 380 stacking, #153 class, not this issue).
Labels: p4 p1 p6 p9
```

## #250 — post-generate landing races the DOM swap

```
## Principles
Violates: P1 — the results zone lands at 174 at 1440 and 173 at 380 against the #152 E target of 98 on every ok generate today (F-S2-3: 98 + strip 52 + 24 — the ruling-f verdict-strip remount, declared in arc 23); the intermittent under-nav case from arc 21 DID reproduce on a refused generate: 1 of 2 natural refusals landed with the results zone at −104, the strip at −180..−128 and the refusal container at −65..92 in a 1000 px viewport (F-S2-3 / F-S5-3, `out-followup/1440x1000-denver-s5-refusal-natural.png`) — the operator waits 22 s and the one thing to act on is under the nav. P3 — when the race fires the status is under the nav for the whole scan (the issue's measurement). P8 — the wait state must be visible; the band (#252) now satisfies this by construction (fixed bottom, B2), so the remaining defect is the landing offset, not the wait.
Fix honours: P1 — option (a) re-issues the scroll once after a frame (idempotent) and option (c) binds `.zone` scroll-margin to the post-generate chrome (no rail) — together they make the landing a computed coordinate, not an anchoring side-effect. Add: option f2 from the arc-23 README (a reserved-height slot for the verdict strip) removes the 76 px ruling-f shift with one CSS rule — that is the P1 fix; (a)+(c) are the P3 fix.
Adjustment: the acceptance "wait line rect within [nav-h, innerHeight]" is obsolete — the wait line was retired by #252; restate as "results zone top = 98 ±1 on 10 consecutive Generates at both viewports; band present for every sample of the flight".
Overlaps: #253 (a sticky strip changes the landing target — one scroll-margin rule must serve both; #253 must not land before this rule exists); #240 (the two instant jumps before the smooth settle — same swap, cosmetic; #240 owns the hitch, this owns the landing).
Labels: p1 p3
```

## #240 — Generate's DOM swap causes two instant scroll jumps

```
## Principles
Violates: P1 — measured on this sha: scrollY 1357 → 976 → 691 → 602 → 583 over the first 400 ms after Generate at 1440 (3 jumps > 40 px), 2787 → 2456 → 1609 → 1237 → 1095 → 1010 → 991 at 380 (6 jumps); document height 2357 → 3064 across the swap (F-S2-2). P12 — the hitch reads as "cheap" on the demo's one big click.
Fix honours: P1 — option (b), reserve the results zone's height across the swap (min-height = the previous document's results height, or the pre-generate cards' height), so the document never collapses and anchoring has nothing to compensate; P16 forbids a skeleton in that reserved space — it holds the pre-generate cards (already the #252 behaviour: "the zone holds the pre-generate cards until the answer lands") so the reservation is the cards' own height, not a placeholder.
Overlaps: #250 (landing offset — distinct, same swap); #235 (results-zone treatment is in the design round's scope — rider there if the round happens first).
Labels: p1 p12
```

## #235 — visual-consistency round (road section, reference section, footnotes, plan-PDF density)

```
## Principles
Violates (measured on this sha):
- Surface C (reference section): P5 — two headings for one zone: the zone title "Rules, permit & audit" (17px/700) and, 39 px below it, an inner h2 "Denver — jurisdiction rules" (20px/700) — the inner heading is LARGER than the zone's (F-S3-2). P2 — the tier ledger line restates every chip's count ("2 changes · 4 needs attention · 13 checked · 3 pending" then chips "▲Changed this plan 2", "⚠Needs attention 4", …) — and while refreshing the ledger reads "◌ checking against the updated inputs…" while the chips hold their numbers, two voices for one fact (F-S3-1). P5 — 63 distinct type tuples on the settled page across 16 sizes (9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 16, 17, 20, 24, 28, 76 px) against a four-role table (F-S3-12); the audit-body register alone carries four sizes. P11 — the audit PDF download is a text link ("↓ Audit PDF", mono 11px, no border) inside the Checked & passed tier body while every other download is a 40 px bordered `.dl-btn` (F-S3-5).
- Surface A (road section): not re-measured here — the setup panel's detected/applied table is pre-generate and the walk's P4 leg on it is a follow-up (findings.md 'could not measure'); the #226 roles are the fix vocabulary.
- Surface B (footnotes): P13 — the "road geometry governs" disclosure is body copy in a container, one click away is the right home (P13's own words); P2 — it must live in one place.
- Surface D (plan PDF): P2 cross-surface — the plan sheet prints "Total corridor 3,462 ft · Downstream 100 ft" while the setup panel's corridor extent for the same pin printed "Total 3,412 ft · Downstream 50 ft" (F-S6-3, `out-run1/downloads/1440x1000-denver-plan.pdf` p. 2 vs `1440x1000-denver-s1-pinned.png`); the device-list XLSX Summary prints "Jurisdiction | CDOT" while the strip, the crew PDF and the plan carry Denver (F-S6-2). These two are honesty defects, not density — they get their own issue (new-issues.md N1) and are NOT in this round's scope.
Fix honours: P5 — one heading per zone, every text node on a `tr-*` role (the "no other type sizes" rule); P2 — the ledger line goes or the chips lose their numerals (recommend: keep the chips, delete the ledger line — the chips are the interactive surface); P11 — the audit PDF becomes a `.dl-btn` in the OutputCards grid (a fourth card, or the crew card's pattern) so every download wears one treatment; P4 — audit rows share the title left edge and the cite right edge (measured F-S3-9).
Scope after the audit (Part 4): A + C + B stay; D's density stays but D's honesty defects move to N1; the OutputCards edge defect (N5) and the section-03 heading/ledger (above) are small enough to land as scoped issues WITHOUT the design round — recommend option (b): fix C and the OutputCards edge directly against #226/#227, run the round for A + B + D only.
Overlaps: #253 (new surface — not in this round); #240 (rider); N1/N5 (new-issues.md).
Labels: p5 p2 p11 p4 p13
```

## #225 — plan-flags dropdown row text at half width

```
## Principles
Violates: P6 (content never dictates layout) — the message column is sized by something other than the container, so the right half is empty and long messages wrap 5+ lines (issue measurement; the walk's Denver plans carried 3 flags but the soft-check message was not among them, so not re-measured here). P4 — the annotation labels (FIX INPUTS, MANUAL HANDLING, CDOT S-630-1) float mid-panel instead of sharing one right edge.
Fix honours: P6 — `grid-template-columns: minmax(0, 1fr) <gutter>` on `.check-list-item`; P4 — annotations right-aligned in the fixed gutter, one `right` for every row (±1 px, measured); P5 — the annotation stays in the step-index register.
Overlaps: #235 surface C uses the same `CheckRow` (`AuditTrail.tsx:1515-1563`) for section 03 — one fix serves both; whoever lands first owns the grid rule.
Labels: p6 p4
```

## #215 — work-window timeline lacks boundary labels

```
## Principles
Violates: P14 / P3 (the answer's shape) — the boundary the crew needs is in the data and not printed; the operator infers 3:30 from a gap. P9 — a bar end with no word is a state carried by position alone.
Fix honours: P9/P14 — every window start and end gets a text label; P1/P6 — labels live in a reserved label row (fixed height) with collision handling, never resizing the timeline; P5 — labels in the step-index register.
Overlaps: none open. (The #206 arc built the data; this is presentation only.)
Labels: p14 p9 p1
```

## #212 — hydration mismatch after UTC midnight (AppSheetMeta ISSUED)

```
## Principles
Violates: P16 (placeholder numbers) / P8 — the sheet-meta strip prints a build-day date as "ISSUED" that is not the issue date of anything; Rule 10 — a stale value presented as current. On this walk ISSUED printed 2026-09-08 (the deploy day); tomorrow's visitors get the same string plus five React hydration errors.
Fix honours: P16 — render an honest word ("issued —" / "not issued") or the real issue date from a surface that has one; P8 — the client effect that updates it must not shift the strip (reserve the cell width; the strip is `.jbar-slot-*` pixel-measured, so run `verify-jbar-stability.mjs`).
Overlaps: none. (The plan PDF's DATE cell prints the render date — correct — so the fix is on the screen only.)
Labels: p16 p8
```

## #242 — stale bundle after a deploy, no new-version affordance

```
## Principles
Violates: P8 (honest wait states) — a tab on the old bundle silently runs old behaviour; P16 — the old bundle's answer is presented as current with no label.
Fix honours: P8 — one small line, once, in one place ("new version — reload"), never auto-reload; P1 — it must not shift content: put it in the band's slot (the band is fixed-bottom and already reserved) or the nav, never inline; P2 — one voice: not a toast AND a ribbon.
Overlaps: #252 (closed — the band is the natural home for a chrome-level notice; the band's rule "iff a request is open" would need a second state, ruled at checkpoint).
Labels: p8 p16 p1
```

## #153 — no supported small-viewport / touch / zoom behaviour

```
## Principles
Violates at 380 (measured, this sha): P10 — 21 px rail entries (5 buttons), 16 px "Enter manually" / "Hide manual entry", 16 px Terms/Privacy, 19 px "Edit full setup", 13–16 px signposts, 2 px range-input track for the speed slider (F-S1-6, F-S3-16); axe `target-size` at 380: `.strip-edit-all` and the latitude input (the two named + one). P1 — at 380 the jurisdiction proposal grows the band 291 → 447 and pushes Road/Work/Schedule/Generate and the status strip 180 px down (F-S1-5); opening the Speed editor in the setup strip grows the strip 211 → 255 and moves the results zone 44 px (F-S3-6); the picker's open+cancel moves the rail 20 px. P6 — the setup strip wraps into three rows of cells (tops 1426/1489/1552); the block's wrapped row puts ▲ on its own line and the name at 42 instead of 66 (F-S3-15); the picker's work-zone input does not overflow (measured: inputs end 25 px inside the edge, F-S1-14 — retracted from the screenshot read) but the disabled Save & Close has no reason word within reach of the footer (F-S1-15). P3 — at 380 the pick CTA is below the fold on load (status strip at 3408 in an 800 px viewport, F-S1-1).
Fix honours: P10 — a 44 px hit floor (padding, not visible box) on every control at ≤ 520; P1/P6 — reserve heights at 380 the same way as at 1440 (the band's proposal slot, the strip's editor row); P14/Rule 10 — option (a) or (b) renders an honest "not supported below N px" rather than a degraded layout.
Ruling still needed: the supported matrix (a/b/c/d). Recommendation from the measurements: (b) tablet — every P10 defect above is fixable by padding; the P1/P6 defects at 380 are the stacking design nobody has done.
Overlaps: #253 (spec 34 — the 380 un-pin), #255 (the 380 wrap of the block), #235 (none), the a11y pile (the two named axe findings ARE this issue).
Labels: p10 p1 p6 p3
```

## #234 — intersection marker not restored when the picker reopens

```
## Principles
Violates: P15 (the record stays) — the scenario holds the marker; the picker forgets it: display state diverging from stored values. P14 — the reopened picker shows a blank where the answer is.
Fix honours: P15 — the picker rehydrates every stored field (pin, road, marker) from the scenario; a test asserts the reopened DOM equals the saved state.
Overlaps: #209 (picker editor hygiene — same modal, different defect).
Labels: p15 p14
```

## #209 — picker renders lanes/divided editors on kinds that discard them

```
## Principles
Violates: P13 / Rule 10 — an editor whose value is predestined for the bin is a control offered without a consequence; P9 — a value the seam will drop is not marked as such at the control (the #198 note says so after the fact).
Fix honours: P13 — hide the editors per kind (or read-only with the reason word beside them, P9); P12 — `max={4}` matches the domain so the control cannot accept an impossible value.
Overlaps: #234 (same modal).
Labels: p13 p9
```

## #203 — saved-mode download anchors navigate to raw "Render failed"

```
## Principles
Violates: P8 — a failure navigates the tab away with no in-app state; P15 — no way back but browser Back; P11 — the sandbox path uses the #180 refusal vocabulary and the saved path does not.
Fix honours: P11/P8 — fetch-driven downloads with the same in-card error + "Try again" the sandbox `.dl-btn` already has; P16 — the stale-document path dies on edit (#197 stamp).
Overlaps: #194, #195 (saved-mode cluster, held on the flag).
Labels: p8 p11 p15 (held — launch-prep)
```

## #195 — signed-in users told to "Sign up"

```
## Principles
Violates: P2/P8 — the product contradicts its own state (signed in, told to sign up); P3 — the primary CTA leads to a dead end.
Fix honours: P3 — the redirect removes the dead route while the flag is off.
Overlaps: #194, #203 (saved-mode cluster).
Labels: p3 p2 (held — launch-prep)
```

## #194 — workbench quote panel: eight dead rate inputs, false "Auto · 0 from layout"

```
## Principles
Violates: P16 (placeholder numbers) — "Auto · 0 from layout" asserts a computation that never ran; Rule 10 — eight inputs whose values reach no request. Note: the SAME caption renders in sandbox mode today — "Flaggers · Auto · 0 from layout" on a shoulder plan with no flagger (F-S3-10); there it is true (0 flaggers in the layout) but reads identically to the false one. P2 — one caption, two meanings.
Fix honours: P16 — the caption prints only what was computed; P13 — hide the fields in saved mode until the settings route lands.
Overlaps: #202 (backend — settings persistence); #203/#195 (cluster).
Labels: p16 p2 (held — launch-prep)
```

## #239 — /landing copy rewrite

```
## Principles
Violates: P2/P12 — the archived copy overstates ("~90 sec", "100% MUTCD-cited") against the verified capability table; unreachable today so no operator cost.
Fix honours: P2 — one voice, the verified claims; P16 — no invented numbers.
Overlaps: launch-prep cluster.
Labels: p2 (held)
```

## #236 — verdict_hook counts working-tree files

```
## Principles
None apply — verification tooling, not an operator surface. Keep on the filler list; not ranked in Part 4.
```

## #237 — s2a7 browser live-check helper matches the rail's Generate entry

```
## Principles
None apply — harness drift, not an operator surface. The audit's own harness scopes every non-unique name (`Undo`, `Dismiss`, `Download PDF`, `Retry`) by container, which is the fix this issue asks for. Not ranked in Part 4.
```

## #243 — Note 8 "both sides of divided highway" false FAIL

```
## Principles
Backend honesty (out of scope for this audit). One principle applies on the surface: P2/P12 — a ✕ under Needs attention on a correct plan lowers trust in every other row (the aesthetic-usability effect runs both ways). Ranked in Part 4 under "honesty first" because the screen misleads, even though the fix is backend-only (Rule 3).
Labels: p2 (backend)
```

## #244 — replication snapshot posts `scenario` instead of the wire scenario

```
## Principles
Debug-only surface (P13 confirmed: the button renders only with ?debug=1, F-S7-1). P2 applies — the snapshot's site_scan projection disagrees with the served audit. No operator cost; fix is one sender. Out of the design rank; listed under "out of scope" in findings.md.
Labels: p2 (debug)
```

## #256 — dense corridors sit at the 20 s scan budget

```
## Principles
Backend (out of scope for this audit). Surface consequence measured: the refusal container's P11/P10/P2 defects (new-issues.md N2) are hit on exactly the corridor this issue makes fail a third of the time — which is why N2 ranks where it does.
```
