# s2-audit-1 — Part 3: new issues, in Part 4 rank order

Drafted 2026-09-08 against prod `2e0b25e`. Every measurement is a row in `findings.md` (F-…) with a screenshot on this branch. Labels: existing set + the proposed `p1`…`p16`. Nothing here is filed; Ryan posts. Findings that belong to #253 / #254 / #255 / #235 are in `issue-comments.md`, not here.

---

## N1 — Deliverables disagree with the screen: XLSX jurisdiction, plan-sheet corridor lengths

**Labels:** bug, priority-high, backend, pdf-rendering, p2

### Problem
Two facts are stated differently on the screen and in the files the operator hands out (prod `2e0b25e`, Denver 39.7269, −104.9873, shoulder work, 1,000 ft, jurisdiction Denver confirmed in the band):

1. **Jurisdiction.** The device-list XLSX Summary sheet prints `Jurisdiction | CDOT`. The setup strip cell reads "JURISDICTION Denver", the band record reads "✓ Confirmed Denver — was None — baseline", the crew-instructions PDF reads "Jurisdiction: Denver" (p. 1), the audit PDF's cover names Denver. Same at 380. (`findings.md` F-S6-2; `out-run1/downloads/1440x1000-denver-devices.xlsx`, `…-crew.pdf`, `out-run1/1440x1000-denver-s3-settled.png`.)
2. **Corridor lengths.** The plan sheet p. 2 "Corridor details" prints `Total corridor 3,462 ft (0.66 mi)` and `Downstream 100 ft`; the setup panel's corridor-extent block for the same pin printed `Total 3,412 ft` and `Downstream 50 ft`. Advance warning 1,500 / taper 217 / buffer 645 / work zone 1,000 agree; only the downstream figure and the total differ, by exactly 50 ft. (F-S6-3; `out-run1/downloads/1440x1000-denver-plan.pdf` p. 2 vs `out-run1/1440x1000-denver-s1-pinned.png`.)

P2 (one voice per fact): two elements that could disagree are one element too many — here they do disagree. Rule 3 / Rule 10: the number the crew reads on the sheet is not the number the estimator saw.

### Proposed solution
- Jurisdiction: `src/export/device_list.py:241` writes `params.jurisdiction`; find the writer of that render-params field and make it read the plan's `meta.jurisdiction` (the value every other renderer prints). Add the XLSX Summary to the cross-surface agreement proof (`validation-artifacts/check_cross_surface_agreement.py`).
- Corridor: `src/rendering/plan_sheet.py:3707` prints `corridor.downstream_taper_ft`; the panel prints the `/api/render/corridor-spec` answer (`lib/render-proxy.ts:308`, `GeneratorSidebar.tsx:918-948`). `src/api/render_api.py:969` computes `downstream_taper_length(…, use_max=True)` for the spec; the sheet's corridor object evidently uses another value. One computation, one field, both surfaces read it (backend authoritative, Rule 3). If the two are legitimately different quantities (a drawn downstream taper vs a spec downstream zone), the sheet and the panel must use two different words — today they share "Downstream".

### Acceptance
- XLSX Summary Jurisdiction == strip jurisdiction == crew PDF jurisdiction for a Denver plan and a None — baseline plan (test at the export level, Rule 11).
- Plan sheet p. 2 Downstream and Total corridor == the corridor-spec response's values for the same scenario (cross-surface dump compares them).
- No change to any other corridor figure; containment harness unchanged.

### Reference
`findings.md` F-S6-2, F-S6-3 · `src/export/device_list.py:241` · `src/rendering/plan_sheet.py:3707` · `src/api/render_api.py:969` · `lib/render-proxy.ts:308` · P2, Rule 3, Rule 10.

---

## N2 — The refusal surface: a declined plan with live downloads, the refusal said three times, two button treatments, an 18 px Retry, a raw ISO stamp, a promise the server does not keep

**Labels:** bug, priority-high, frontend, ux, p2, p16, p8, p3, p11, p10, p12

### Problem
Measured on two natural refusals at 1440 and a replayed one at 380 (prod `2e0b25e`; `findings.md` F-S5-1 … F-S5-10; `out-followup/1440x1000-denver-s5-refusal-natural*.png`, `out-replay/380x800-denver-s5-refusal-replay.png`):

1. **A declined plan is a plan (P2, P16, P8).** With the strip reading "PLAN DECLINED · …" and the pill "SERVICE UNAVAILABLE", the results zone showed hero counts (39 / 12), the `sr-only` status region announced "Plan generated — 39 devices, 12 types.", and four download buttons were enabled. On the second refusal the cards printed "— devices" and "— types" (P16 names the `—` placeholder outright) with the buttons still live. The breakdown request answers independently of the audit (`GeneratorShell.tsx:778-782`, `showResults` keyed on the breakdown; `OutputCards.tsx:55-56`).
2. **Three voices (P2).** Strip sentence + pill + container sentence, all saying the scan could not complete (`StatusBar.tsx:222-238`; `GeneratorShell.tsx:1267-1291`).
3. **Above the fold (P3, #250).** One of two natural refusals landed with the container at −65..92 and the strip at −180..−128 in a 1000 px viewport: after a 22 s wait the operator sees the download cards and nothing to act on.
4. **Two treatments, one row (P11, P10).** "↻ Retry scan" is a 94×18 text link; "Generate without site check — the plan will say SITE CONDITIONS NOT CHECKED" is a 596×28 bordered two-line button (at 380: 304×63, four lines). The primary recovery is the smaller, quieter control (`GeneratorShell.tsx:1293-1311`).
5. **Raw ISO (P12, P11).** "… attempted 2026-09-08T16:14:59+00:00 · budget 20 s" while the block footer slices the same stamp to "8 sep · 16:06 utc" (`GeneratorShell.tsx:1283-1285` vs `SetupStrip.tsx:438-453`).
6. **A promise the server may not keep (P16, P2).** The proceed button says the plan "will say SITE CONDITIONS NOT CHECKED"; on both tries the re-generation (memo warmed by the refused attempt) scanned successfully and the plan said "4 · Site conditions detected · of 5 checked" with no disclosure — an honest outcome the button text contradicts (F-S5-7).

Operator cost: the Denver demo corridor refuses a third of first scans (#256); every one of those shows this surface.

### Proposed solution
1. While the audit is declined, the results zone renders the refusal container and the pre-generate cards ONLY: no hero, no download buttons, no announcement (the breakdown's answer is held, not shown — the #192 carry rule already holds it across a re-generate). Downloads return with the verdict.
2. One voice: the strip states the verdict (PLAN DECLINED + pill); the container states the reason and carries the actions; the strip's sentence drops its clause (it says "from the notice in the Results zone" — a pointer, not a restatement).
3. The landing rule from #250 (reserved-height slot + one post-scroll re-check) applies to the refused settle exactly as to the ok settle; acceptance: container top ≥ nav-h on 10 of 10 refusals.
4. Both actions are `.dl-btn`-class bordered buttons on one edge, 40 px tall, Retry first; the proceed label shortens to "Generate without site check" with the consequence on the line beneath in `tr-prov` (one line at 1440, two at 380, never a wrapped button).
5. The refusal line uses the block's `fmtScanStamp` (sliced, ISO on `title`).
6. The proceed label states the input, not the outcome: "Generate without waiting for the scan" — and if the scan does run, the band's "without the site check" object is already honest; the block then says what happened.

### Acceptance
- Under any `PLAN DECLINED` state: 0 enabled `.dl-btn`, no `.hero`, `sr-only` status empty (mounted test + prod live check across a replayed refusal body — the harness on this branch captures one).
- Refusal stated once as a sentence (strip pill + container reason; grep test).
- Container top ≥ `--nav-h` after settle, 10 of 10, both viewports.
- Two actions: same `border`, same `height` (±1), same `right` edge or same `left` edge; Retry ≥ 32 px at 1440, ≥ 44 at 380.
- No `\d{4}-\d\d-\d\dT` in the container's visible text.
- Band rules, #198 sentences, the refusal's `role=alert`, and spec 31 (no band + refusal co-frame) unchanged.

### Reference
`findings.md` F-S5-1..10, F-S2-3 · `GeneratorShell.tsx:1267-1314, :778-782, :1320-1345` · `StatusBar.tsx:222-238` · `OutputCards.tsx:55-56` · #250, #256, #192, #252 (closed) · P2 P16 P8 P3 P11 P10 P12.

---

## N4 — The stale dim's own label fails contrast: the "Previous answer" ribbon is inside the dim it explains

**Labels:** bug, priority-medium, frontend, ux, p9, p16

### Problem
While a plan re-generates, the results are dimmed (`.results-stale`: opacity 0.5, grayscale 0.4 — the #192 marking, ruled) and the ribbon "Previous answer — values below predate the request in flight." is the dim's text channel (#252 ruling f). The ribbon is rendered INSIDE the dimmed wrapper (`GeneratorShell.tsx:1320-1344`), so the label measures **2.39:1**; 56 of 59 text pairs in the dim fail 4.5:1 (e.g. "Total devices" 2.47, "39" 2.56). Arc 23 counted the 30 axe nodes and deferred the question to this audit; the label's own contrast was never measured. (`findings.md` F-S2-5; `out-followup/1440-f2-midflight.png`.)

P9: a state carried by a word must be readable; P16: the "previous answer" label is the honest wait state — it cannot be the least legible text on the page. WCAG 1.4.3 exempts inactive controls, not explanatory text.

### Proposed solution
Move the ribbon out of the `.results-stale` wrapper (a sibling above it, same slot) so it renders at full ink on the same surface; keep the dim on the answer. Optionally raise the dim to opacity .6 so the largest figures (`.num`) clear 3:1 as large text — measured, not asserted.

### Acceptance
- Ribbon text ≥ 4.5:1 measured mid-flight on the composited surface (the arc-23 pairs probe, run under the band).
- `.results-stale` still dims every result node; the ribbon is the only undimmed text in the zone.
- Arc-23 B7 baseline (0 nodes outside the dim at 1440) unchanged; the "30 inside" figure may fall.
- No change to band rules or `regenerating` semantics.

### Reference
`findings.md` F-S2-5 · `GeneratorShell.tsx:1320-1344` · `globals.css:3134-3147` · #192, #252 ruling f · P9 P16 · handoff "Findings carried" (#192 stale dim).

---

## N3 — Landing and pre-generate voices: the first viewport has no control, "location unset" has three speakers, the strip changes height at the first verdict

**Labels:** enhancement, priority-medium, frontend, ux, p3, p2, p1

### Problem
1. **P3 — nothing to do above the fold.** On load at 1440×1000: h1 155..186, draft banner 261..341, read-only jurisdiction bar 365..529, zone head 553..585, rail 658..696, and the pick CTA at **960..1004** — four pixels below the fold; the status strip at 2114. At 380×800 the strip is at 3408. (`findings.md` F-S1-1; `out-run1/1440x1000-denver-s1-empty.png`.) The operator's first screen is 550 px of preamble and a scenario list.
2. **P2 — three speakers.** "Set a location first — pick on map or enter manually." is the rail blocker AND the CTA reason (`role=alert`; ruled one export, #228) AND, reworded, the strip ("AWAITING LOCATION · pick a location on the map to verify this plan", `aria-live=polite`). Four live regions are mounted pre-pin, including `.jbar-suggest.quiet` announcing its own empty state ("Drop a site pin for a jurisdiction suggestion"). (F-S1-2.) "Output requires TCS review" is printed under Generate and in the footer (F-S1-3).
3. **P1 — the strip grows.** VERIFYING (no pill) is 47 px; the first verdict with its pill is 52 px at 1440 (68 → 88 → 69 at 380): everything below moves at the moment the answer lands (F-S1-4; `StatusBar.tsx:299-308` vs `:336-343`).

### Proposed solution
1. Pre-pin, the header compresses: the draft banner and the read-only jurisdiction bar (which pre-pin says only "None — baseline · Not set") collapse to one line each or move below the setup zone, so the pick CTA sits inside the first 700 px at 1440 and the first 800 at 380. Design call — the constraint is measurable: CTA bottom ≤ innerHeight on load at both viewports.
2. One live speaker for the location gate: the CTA reason (it is the control's own text); the strip pre-pin reads AWAITING LOCATION without repeating the instruction; the rail blocker stays visual (`aria-hidden` on the duplicate text or `aria-describedby` to the one region). The `.jbar-suggest.quiet` empty state drops `aria-live` (nothing changed — nothing to announce).
3. The strip reserves the pill's height in every state (`min-height: 52px` on `.status-bar`, or the pill slot always allocated), measured: one height across AWAITING → VERIFYING → INVALID → VERIFIED.

### Acceptance
- Pick CTA `getBoundingClientRect().bottom ≤ innerHeight` on load at 1440×1000 and 380×800.
- Exactly one live region carries the location-gate sentence pre-pin (count test).
- `.status-bar` height identical across every pre-generate state at 1440 (table in the live check).
- #228 rail derivation untouched; #193 announcements untouched.

### Reference
`findings.md` F-S1-1..4 · `GeneratorShell.tsx:1099-1143` · `StatusBar.tsx:191, 248-256, 299-343` · `ProgressRail.tsx:74-80` · `GeneratorFormPrimitives.tsx:224-229` · `JurisdictionSection.tsx:626-636` · P3 P2 P1.

---

## N5 — OutputCards: the crew card breaks the download buttons' shared edge; the audit PDF is a text link in a tier body; "—" placeholders under a declined plan

**Labels:** bug, priority-medium, frontend, ux, p4, p11, p16

### Problem
1. **P4.** The three cards share a height (206) but not a button edge: the crew card carries two buttons, so its first sits 52 px above the other cards' single button — `.dl-btn` tops 1589 / 1589 / **1537** / 1589 (F-S3-4; `out-run1/1440x1000-denver-s3-settled.png`).
2. **P11.** "↓ Audit PDF" is an 85×18 mono text link inside the Checked & passed tier body (two clicks from the settled page: open the tier, find the link), while every other download is a 325×40 bordered `.dl-btn` in the MHT package grid (F-S3-5; `TieredReference.tsx:546-561`). It is the deliverable a TCS needs.
3. **P16.** Under a declined plan the cards print "— devices" / "— types" with the buttons enabled (F-S5-1, second refusal) — covered by N2's fix 1, listed here because `OutputCards.tsx:55-56` owns the placeholder.
4. axe `heading-order`: the card title is an `h4` after the zone's `h2` (`OutputCards.tsx:285-288`) — both viewports, every plan.

### Proposed solution
- Every card's action row is bottom-anchored (`margin-top: auto` on the row; the crew card's two buttons stack inside that row), so all first buttons share one `top` and one bottom edge: spread ≤ 1 px.
- The audit PDF becomes a fourth card ("Audit trail · PDF · N checks · each cited") in the grid, with the same `.dl-btn`; the tier-body link is removed (the tier keeps its "Every calculation is traced…" line). The header count reads "MHT PACKAGE · 5 FILES" only if the zip includes it — otherwise "4 FILES + AUDIT" (Rule 12: the number traces to the bundle).
- Placeholders: while the count is unknown the card prints the honest word ("not generated") and the button is disabled (N2 owns the declined state).
- `h4` → `h3` (or the card title becomes a `.tr-field` label, not a heading).

### Acceptance
- `.dl-btn` first-button tops equal across cards (±1) at 1440; at 380 the cards stack — each card's button bottom-anchored.
- Audit PDF rendered through the same `.dl-btn` path, band object "audit PDF" unchanged, download received (live check).
- No `—` in any `.dl-card .desc` text node in any state (test).
- axe `heading-order` 0 at both viewports.

### Reference
`findings.md` F-S3-4, F-S3-5, F-S5-1, F-S3-19 · `OutputCards.tsx:55-56, 152-178, 284-356` · `TieredReference.tsx:546-561` · P4 P11 P16 · #235 (the round does not need to own this).

---

## N6 — Setup-strip inline editors: no way shown to close, Escape does nothing, commit-on-blur with no Apply; at 380 the open editor grows the strip

**Labels:** bug, priority-medium, frontend, ux, p3, p7, p1

### Problem
Clicking a strip cell ("Edit Speed") swaps it for `.sv-editor` (149×63 with an 82×28 select). Measured (F-S3-6; `out-run1/1440x1000-denver-s3-strip-editor.png`):
- no Done / Cancel / × affordance in the editor (P3);
- Escape leaves it open; a click anywhere outside closes it — discoverable only by accident (P3);
- the value commits on change/blur and re-generates the plan; there is no Apply and no Cancel, so opening an editor and "changing your mind" costs a locked cycle (P7);
- at 380 the strip grows 211 → 255 and the results zone, the status strip and every zone below move 44 px (P1). At 1440: 0 px.

### Proposed solution
- Each editor carries a Done (✓) and a Cancel (×) in the cell's action edge; Escape = Cancel (restores the prior value, no request); Enter = Done. The work-zone editor already commits on blur/Enter through a draft (#252) — extend the draft pattern to every editor so a request is opened only on Done (P7).
- The editor renders inside the cell's reserved height (63 px) at every width: at 380 the select replaces the value text in place; the strip's row height is fixed per state (P1).

### Acceptance
- Escape closes the editor without a request (fake-timer test: 0 fetches).
- Done opens exactly one request; Cancel opens none; the band object "after an edit to speed" unchanged.
- `.setup-strip` height identical with an editor open and closed at 1440 and 380 (rect table in the live check).
- #252 lock declarations (`data-write`, `aria-disabled` openers) unchanged.

### Reference
`findings.md` F-S3-6, F-S3-7 · `SetupStrip.tsx:78-124, 797-812` · P3 P7 P1 · #252 (closed).

---

## N7 — Type-role and ink hygiene: 63 type tuples on 16 sizes, `.honesty` at 4.47:1, a `#ffffff` literal in `.tr-section`

**Labels:** type-debt, priority-low, frontend, ux, p5, p9, p11

### Problem
- **P5.** The settled page carries 63 distinct (family · size · weight · transform · colour) tuples across 16 sizes — 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 16, 17, 20, 24, 28, 76 px — against a four-role table on two sizes (`lib/design/type-roles.ts`; `.tr-*` `globals.css:2413-2445`). One open audit body alone uses mono 16/400, sans 14/400, mono 9/700, mono 10/400. Full list: `out-run1/1440x1000-denver-type-tuples.json` (F-S3-12).
- **P9.** `.honesty` ("Boundary data is approximate … confirm jurisdiction with the permitting authority.") measures 4.47:1 — `#818e9e` on `#1b2838` at opacity .85; axe `color-contrast` fails it at both viewports (F-S1-7; `JurisdictionSection.tsx:657-661`). It is the one sentence that tells the operator to verify.
- **P11.** `.tr-section` carries `color: #ffffff` as a literal (`globals.css:2419`); the arc-9 table marked it CHOSEN but it never became a token. Other literals outside the token block: `globals.css:1054` (a box-shadow), `:1800` (`#0b1420`), `:1935` (`--sc-leader: #4a6280`, declared decorative). Components: `TaperViz.tsx` (18 SVG hexes), `PlanSheet.tsx` (36), `LocationPickerModal.tsx:155,158` (pin colours), `GeneratorFormPrimitives.tsx:216` (spinner).

### Proposed solution
- A type-role census test: every text node on `/sandbox` (mounted, settled) maps to a `tr-*` role or to a named exception list (hero numerals, h1/h2, the pill); the census is the "no other type sizes" measure. Land the exceptions list first (Rule 5: declare, then enforce), then fold sizes into roles one surface at a time.
- `.honesty` drops the opacity (the token already sits at 6.19:1 on canvas) — measured.
- `--ink-bright` (or the existing `--ink`) replaces the `#ffffff` literal; the SVG hexes in TaperViz/PlanSheet are declared decorative or mapped.

### Acceptance
- Census test green with a committed exceptions list; tuple count reported in the arc README before/after.
- `.honesty` ≥ 4.5:1 on `--canvas-tint`; axe color-contrast 0 at both viewports (the arc-19/21 baseline).
- `grep -c "#[0-9a-f]\{6\}" globals.css` outside `:root`/`.workbench` blocks = the declared decorative set.

### Reference
`findings.md` F-S3-12, F-S1-7 · `globals.css:2413-2445, 2419` · `JurisdictionSection.tsx:657-661` · DESIGN-SPACING "Type roles (#226)" · P5 P9 P11.

---

## N8 — Desk hit targets under 32 px: rail entries, Retry, Audit PDF, Undo, signposts, footer links, the speed slider's 2 px track

**Labels:** frontend, ux, priority-low, p10

### Problem
P10 sets 44 px for the hand in a truck and says desk density is no excuse for targets under 32 px. Measured at 1440 (F-S1-6, F-S3-16, F-S5-5):

| control | size | where |
|---|---|---|
| rail entries ×5 | 63–214 × **21** | `ProgressRail.tsx:48-53`, `globals.css:2471` |
| "Enter manually" / "Hide manual entry" | 95–116 × **16** | `GeneratorSidebar.tsx:783, 964` |
| "Project details · OPTIONAL" | 500 × **16** | `GeneratorSidebar.tsx` |
| speed slider `input.range-orange` | 500 × **2** (the thumb is larger; the input's own box is the track) | `ShoulderForm.tsx:102-124` (and FlaggerForm, LaneClosureForm) |
| "↻ Retry scan" | 94 × **18** | `GeneratorShell.tsx:1293-1301` |
| "↓ Audit PDF" | 85 × **18** | `TieredReference.tsx:546-561` |
| record "Undo" | 30 × **16** | `SetupStrip.tsx:274` |
| signposts "correct in setup ↑" | 119 × **13–16** | `ResultsHead.tsx:52-62`, `TieredReference.tsx:234-246` |
| Terms / Privacy | 35–49 × **16** | `AppFooter.tsx:8-13` |
| "Edit full setup ⤢" (380) | 130 × **19** | `SetupStrip.tsx:905-915` |

axe `target-size` (24 px, WCAG 2.5.8) flags only `.strip-edit-all` and the latitude input at 380 and, with the strip wrapped, `Edit Lane W` / `Edit Work zone`; the P10 floor is stricter than axe.

### Proposed solution
Padding, not visible size: a `min-height: 32px` (44 at ≤ 520 px via the existing `@container`) on `.rail-entry`, the text-link buttons, the signposts, the footer links and `.reason-chip`; the range input gets `height: 24px` with the track drawn by the pseudo-element (the thumb already is). No visual change beyond the hit box; the DESIGN-SPACING row-inset values are unchanged.

### Acceptance
- Every enabled control on the settled page ≥ 32 px tall at 1440 (the walk's TARGETS probe, 0 under 32) and ≥ 44 at 380 for the controls a crew taps (rail, block actions, downloads, Retry).
- axe `target-size` 0 at 380 (retires the two named pre-existing findings).
- Rect table before/after: no visible box changes (P1).

### Reference
`findings.md` F-S1-6, F-S3-16, F-S5-5, F-S5-10 · P10 · #153 (owns the 44 px phone floor and the matrix ruling; this issue is the desk floor and needs no ruling).
