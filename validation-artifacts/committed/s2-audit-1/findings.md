# s2-audit-1 — design audit of `/sandbox` against DESIGN-PRINCIPLES.md (P1–P16)

**Prod sha `2e0b25e776732c64988bbdd57c444f5d613d2eea`** — healthz = `git rev-parse origin/main` at the start of every run (logged as the first line of each `out-*/log.txt`). 2026-09-08, 15:50–16:40 UTC. No code, no CSS, no tests changed; this branch is docs and evidence only (the diff-verifier is not required for a no-code branch).

Viewports 1440×1000 and 380×800. Pins: Denver 39.7269, −104.9873 (bearing 180, work zone 1,000 ft) and Lakewood 39.7113, −105.0815. Headless Chromium (Playwright) + axe-core; every figure below is a `getBoundingClientRect` / `getComputedStyle` / axe readout, never an eyeball. Harness: `audit-walk.js` (the walk), `audit-followup.js` (audit PDF, stale dim, refusal hunt), `audit-replay380.js` (the 380 refusal from a captured body), `audit-lib.js` (probes), `pdf-check.py` (P2 against the files). Raw rows: `out-run1/rows.json`, `out-followup/rows.json`, `out-replay/rows.json`; screenshots beside them; downloads under `out-*/downloads/`.

Row IDs (`F-…`) are what `issue-comments.md` and `new-issues.md` cite. Verdict vocabulary: **violated** / honoured / n/a / deviates-by-ruling / note (a measurement that is not a verdict).

---

## Part 4 — the ranked open UI list

Ranked by (1) honesty first — P2, P8, P16, P14, anything where the screen misleads; (2) how often an operator hits it per plan; (3) layout stability and alignment — P1, P4, P6; (4) polish — P5, P11, P12; (5) mobile-only last unless it blocks a field use. `N#` = proposed in `new-issues.md`.

| rank | issue | principles | one line |
|---|---|---|---|
| 1 | **N1** deliverables disagree with the screen | P2 | XLSX says jurisdiction CDOT, screen and crew PDF say Denver; plan PDF says downstream 100 ft / total 3,462 ft, the panel said 50 / 3,412 — every plan, every download |
| 2 | **N2** the refusal surface | P2 P16 P8 P3 P11 P10 P12 | on a refused scan: PLAN DECLINED while download buttons are live over "— devices"; the refusal said twice (three times with the pill); the container above the fold 1 of 2 times; two button treatments, an 18 px Retry, a raw ISO stamp; the proceed button promises a disclosure the server then does not print — hit on a third of Denver first scans (#256) |
| 3 | **#243** Note 8 false FAIL | P2 (backend) | a ✕ on a correct plan — divided roads with a sidewalk or bike detection; the fix is backend, the cost is on the screen |
| 4 | **#212** ISSUED bakes the build date | P16 P8 | every visitor, every day after a deploy: a stale date presented as today plus five hydration errors |
| 5 | **#253** next-steps strip | P3 P2 (P1 P8 P10 to guard) | every plan: no step named after the answer lands; absorbs the lockup (one voice); must not move the landing (P1) |
| 6 | **#254** batch corrections | P7 P15 P16 P1 | every corrected plan: 4–23 s locked per Dismiss/Assert/Undo, measured |
| 7 | **N4** the stale dim's own label fails contrast | P9 P16 | while a plan re-generates, "Previous answer — …" sits inside the dim it explains: 2.39:1; 56 of 59 text pairs in the dim under 4.5:1 — every correction, every edit |
| 8 | **#255** block layout-shift defects | P4 P1 P6 P9 | every dismiss: chip text +7.5 px off centre, Confirm jumps a line on "Other", record rows a second height, disabled Confirm with no word |
| 9 | **#250** landing races the swap | P1 P3 | every plan lands at 174 not 98; the refusal container lands above the nav 1 of 2 refusals (this audit) |
| 10 | **N3** landing / pre-generate voices | P3 P2 P1 | every session: the pick CTA ends 4 px below the fold at 1440 and the strip sits 1,114 px lower; "location unset" has three speakers; the strip grows 47 → 52 px at the first verdict |
| 11 | **N5** OutputCards + the audit PDF link | P4 P11 P16 | every plan: the crew card breaks the download buttons' shared edge by 52 px; the audit PDF is an 18 px text link in a tier body; "—" placeholders under a declined plan |
| 12 | **N6** setup-strip inline editors | P3 P7 P1 | every edit post-generate: no way shown to close an editor, Escape does nothing, outside-click closes; at 380 the strip grows 44 px |
| 13 | **#235** design round (A + B + C + D-density) | P5 P2 P11 P4 P13 | section 03 has two headings (the inner one larger), the ledger restates every chip, 63 type tuples / 16 sizes |
| 14 | **#240** two instant jumps before the settle | P1 P12 | 3 jumps at 1440, 6 at 380, measured; cosmetic |
| 15 | **#225** plan-flags dropdown half width | P6 P4 | per flagged plan; the flags exist to be read |
| 16 | **#215** timeline boundary labels | P14 P9 P1 | per scheduled plan in a jurisdiction with off-tick windows |
| 17 | **N7** type-role and ink hygiene | P5 P9 P11 | 63 tuples on 16 sizes vs a four-role table; `.honesty` at 4.47:1 (axe fails it); `#ffffff` literal in `.tr-section` |
| 18 | **N8** desk hit targets under 32 px | P10 | rail entries 21 px, Retry 18, Audit PDF 18, Undo 16, Terms/Privacy 16, signposts 13–16, the speed slider's 2 px track |
| 19 | **#234** intersection marker not restored | P15 P14 | near-intersection kind only, every reopen |
| 20 | **#209** picker editors on kinds that discard them | P13 P9 | low; #198 notes keep it honest |
| 21 | **#242** stale bundle after a deploy | P8 P16 | per deploy, per open tab |
| 22 | **#153** small-viewport matrix | P10 P1 P6 P3 | every 380 defect in this file is this issue's; blocked on the matrix ruling |
| held | #194 · #195 · #203 · #239 | P16 P2 P8 P11 | saved-mode / launch-prep cluster, flag off |
| — | #236 · #237 | none | tooling; not ranked |
| — | #244 · #256 | P2 (debug) · backend | out of the design rank; listed under "out of scope" below |

**Where this rank disagrees with the board (handoff.md: audit → #253 → #254/#255 → #256 → #243 → #250 → #235):** N1 and N2 are new and go first because they are honesty defects hit on every plan (N1) and on the demo corridor's most common failure (N2); #243 and #212 move ahead of #253 for the same reason (the screen states something false). #256 stays where the board has it — it is backend and this rank does not cover it, but N2 is its surface cost and should land with or before it. #253 → #254 → #255 keep their relative order. #250 moves ahead of #235 (it now has a second, worse symptom: the refusal above the fold). Ryan rules.

**#235's scope after this audit:** stays — Surface A (road-section alignment, not re-measured here, still the #226 vocabulary job), Surface B (the "road geometry governs" footnotes — a P13 relocation with the #214 constraint), Surface C (reference-section continuity: the two-heading defect, the ledger/chip duplication, one type register per subsection), Surface D's density pass (with the containment harness). Leaves #235 — Surface D's two honesty numbers (→ N1), the OutputCards edge + the audit-PDF link (→ N5), the scroll hitch (#240 stays its own issue; rider optional). Recommendation: land C and N5 without a design round (they are measured defects with one-rule fixes); run the round for A, B and D only.

---

## Part 1 — the walk

### Rollup

**Violations by principle** (distinct defects, both viewports; a defect measured at both viewports counts once — 380-only defects are marked ³⁸⁰):

| P | count | the defects |
|---|---|---|
| P1 | 9 | landing 174 vs 98 · strip 47→52 px · Confirm jumps on "Other" · record row second height · picker-open shift ³⁸⁰ · band proposal shifts steps 180 px ³⁸⁰ · strip editor grows 44 px ³⁸⁰ · swap jumps (#240) · Confirm→record grows the band slot 155 px (steps unmoved at 1440; moved ³⁸⁰) |
| P2 | 9 | XLSX jurisdiction · PDF downstream/total · refusal said twice (+ pill) · PLAN DECLINED with a plan on screen · ledger restates chips · lockup vs block count (#253 rules it) · "location unset" three speakers · "Output requires TCS review" twice · "Auto · 0 from layout" true and false with one wording |
| P3 | 5 | pick CTA below the fold · refusal container above the nav (1 of 2) · editor has no close affordance · no step named post-generate (#253) · lockup is a fact not a step (#253) |
| P4 | 4 | reason-chip text +7.5 px · download buttons' bottom edge (52 px) · block wrapped row ³⁸⁰ (glyph on its own line, name at 42 vs 66) · setup strip wraps into three rows ³⁸⁰ |
| P5 | 2 | two headings in zone 03, the inner one larger · 63 type tuples on 16 sizes |
| P6 | 3 | record row 33 vs 46 (a second height per row kind) · block rows 85/119/58 ³⁸⁰ · setup strip three rows ³⁸⁰ |
| P7 | 2 | every Dismiss/Assert/Undo opens a request (#254) · editor commits with no Apply and no Cancel |
| P8 | 2 | download buttons live under PLAN DECLINED · stale bundle (#242, not measured here) |
| P9 | 5 | stale ribbon 2.39:1 inside the dim · `.honesty` 4.47:1 · disabled Confirm no word · dimmed previous answer 56/59 pairs (#192, ruled — re-opened as a question) · no word on the picker's disabled Save at 380 (gate words are in the map pane, off-screen from the footer) |
| P10 | 2 groups | desk: rail 21 px, Retry 18, Audit PDF 18, Undo 16, signposts 13–16, Terms/Privacy 16, slider track 2 px · phone ³⁸⁰: axe target-size `.strip-edit-all`, `Edit Lane W`, `Edit Work zone`, the latitude input; everything in the desk list |
| P11 | 4 | refusal's two button treatments · audit PDF link vs `.dl-btn` · scan stamp in two formats (sliced on the block, raw ISO in the refusal line and the audit PDF) · `#ffffff` literal in `.tr-section` |
| P12 | 3 | raw ISO in the refusal provenance · raw ISO in the audit PDF · the scroll hitch |
| P13 | 0 | — (debug button gated; expanders live under the lock) |
| P14 | 1 | NOT-CHECKED disclosures could not be observed (see "could not measure") — no defect found, one measurement missing |
| P15 | 0 | — (#234 is filed; not reproduced here — near-intersection kind not walked) |
| P16 | 3 | "— devices" / "— types" placeholders under a declined plan · the proceed button's promised disclosure not produced · ISSUED = build date (#212, same-day so not observed) |

**By surface:** S1 landing/pre-generate 11 · S2 in flight 4 · S3 post-generate 14 · S4 correction round-trip 6 · S5 refusal 9 · S6 downloads 4 · S7 debug 0.
**By viewport:** 1440 — 41 distinct; 380 — the same 41 plus 8 that exist only at 380 (marked ³⁸⁰), all #153's.

---

### S1 — Landing / pre-generate

Screens: `out-run1/1440x1000-denver-s1-empty.png`, `380x800-denver-s1-empty.png`, `…-s1-picker.png`, `…-s1-pinned.png`, `…-s1-band-resolved.png`, `…-s1-invalid.png`, `…-s1-pre-generate.png`; `out-followup/380x800-f3-picker.png`.

| id | P | verdict | what | where | measurement | operator cost |
|---|---|---|---|---|---|---|
| F-S1-1 | P3 | **violated** | On load, nothing actionable is in the first viewport. | `GeneratorShell.tsx:1099-1143` (h1, draft banner, read-only jbar precede the zone); `.jbar.jbar-readonly`; `button "Pick Location on Map"` | 1440: h1 155..186 · draft banner 261..341 · jbar 365..529 · zone head 553..585 · rail 658..696 · pick CTA **960..1004** (innerH 1000) · status strip 2114..2161. 380: strip at 3408 (innerH 800). | Every session's first second: the operator reads 550 px of preamble before a control. |
| F-S1-2 | P2 | **violated** (ruled in part) | "Location unset" has three speakers: the rail blocker, the CTA reason (`role=alert`), the strip (`aria-live=polite`). Rail = CTA is the #228 ruling (one export); the strip is a third voice. | `ProgressRail.tsx:74-80`; `GeneratorFormPrimitives.tsx:224-229`; `StatusBar.tsx:248-256` | rail-blocker "Set a location first — pick on map or enter manually." = cta-reason (byte-equal); strip "AWAITING LOCATION · pick a location on the map to verify this plan". 4 live regions mounted pre-pin: jbar-suggest (polite, "Drop a site pin…"), cta-reason (alert), strip (polite), sr-only status (empty). | Screen-reader users hear the blocker twice; sighted users read it three times. |
| F-S1-3 | P2 | **violated** (minor) | "Output requires TCS review" under Generate and in the footer. | `GeneratorSidebar.tsx:564`; `AppFooter.tsx:14` | 2 text nodes on the empty page (`out-followup` F-row); 1 post-generate (the Generate footer unmounts). | Trivial; noted because P2's measure is the grep. |
| F-S1-4 | P1 | **violated** | The status strip changes height at the first verdict. | `StatusBar.tsx:299-308` (verifying, no pill) vs `:336-343` (pass + `.pill`); `globals.css:1015-1030` | 1440: heights **47 → 52** (VERIFYING → VERIFIED · READY FOR TCS REVIEW); 380: **68 → 88 → 69** (three heights across the pre-generate verify). Everything below moves 5 px (20 px at 380). | Every pin, every edit that re-verifies. |
| F-S1-5 | P1 | honoured 1440 / **violated** ³⁸⁰ | The jurisdiction proposal grows the band slot; at 1440 the band is a side column so no step moves; at 380 the band is stacked and pushes every step. | `GeneratorSidebar.tsx:464-468` (`.jctl-band`); `JurisdictionSection.tsx:603-760`; DESIGN-SPACING "below ~900 px the cards stack — recorded, not designed" | 1440: band 184 → 356 (+172), `#rail-step-road/work/schedule/generate` and `.status-bar` dTop 0. 380: band 291 → 447, `.zone[1]`, `.status-bar`, `#rail-step-*` **dTop +180**, docH +180. Confirm → record: 1440 pending slot 210 → record 343 (+133), footer +199 (Denver) / +666 (Lakewood — the schedule-windows block mounts for the confirmed jurisdiction: user-asked); 380 the same +180 on every step, and Undo reverses it. | 380 only: the operator's Road step jumps 180 px while they read the proposal. |
| F-S1-6 | P10 | **violated** | Rail entries are 21 px buttons at both viewports. | `ProgressRail.tsx:48-53`; `globals.css:2471` | "Location — done" 93×21, "Road — done" 63×21, "Work — done" 63×21, "Schedule — not set" 214×21, "Generate — ready" 73×21. Also: "Enter manually" / "Hide manual entry" 95–116×16, "Project details" 500×16, `input.range-orange` (speed slider) **500×2** (`ShoulderForm.tsx:102-124`). | Desk: under the 32 px floor. Phone: under 44. |
| F-S1-7 | P9 | **violated** | `.honesty` (the boundary caveat) at 4.47:1 — axe `color-contrast` fails it at both viewports. | `JurisdictionSection.tsx:657-661`; opacity .85 on the node | `#818e9e` on `#1b2838` at opacity .85 = **4.47** (< 4.5). | Small; it is the one sentence that says "confirm with the permitting authority". |
| F-S1-8 | P9 | honoured (inert) | Pre-pin pending sections at opacity .35 fail 4.5:1 (57 nodes) — they are `inert` (`GeneratorFormPrimitives.tsx:65-69`), WCAG-exempt as inactive; the pending word "◌ Pending — set a location first" carries the state. | | 57 pairs 2.45–2.95 in `.setup-panel`, all under `.step-pending-body[inert]`. | none |
| F-S1-9 | P14 | honoured | The results zone's empty state names the steps. | `OutputCards.tsx:145-149` | "No package yet · Describe the work zone → press generate → download the package". | — |
| F-S1-10 | P9 | honoured | INVALID INPUT provoked (work zone 0): glyph, word, pill, CTA reason. | `StatusBar.tsx:205-212` | "INVALID INPUT · Work zone length is required. · GENERATION BLOCKED", h 52; cta-reason "Work zone length is required." | — |
| F-S1-11 | P4 | honoured | Fact strip: label and value share a left edge per cell. | `GeneratorSidebar.tsx:881-894` | Lat 206/206 · Lng 305/305 · Bearing 418/418 · Speed 505/505 · Jurisdiction 582/582. | — |
| F-S1-12 | P10 | honoured | Suggestion Confirm / Dismiss 24 px; class chips 33 px. | `JurisdictionSection.tsx:733-742` | "Confirm Denver" 114×24, "Dismiss" 68×24. | (24 is the desk minimum axe checks; under the P10 32.) |
| F-S1-13 | P15 P9 | honoured | Resolved record keeps ✓ + sentence + Undo; Undo restores the proposal. | `JurisdictionSection.tsx:672-696` | "✓ Confirmed Denver — was None — baseline. Undo"; ✓ `rgb(79,215,135)`. | — |
| F-S1-14 | P6 P1 | honoured 1440 / **violated** ³⁸⁰ | Picker dialog fits the viewport; open + cancel leaves the page where it was at 1440. At 380 the rail moved 20 px after cancel. | `LocationPickerModal.tsx:1750-1762` | 1440: dialog 1280×880 at 80,60, 0 rects moved. 380: dialog 8..372 × 8..792; inputs end 25 px inside the edge (no overflow — the screenshot's clipped "1000" is right-aligned text, not overflow); `.progress-rail` dTop +20 after Cancel. | 380 only. |
| F-S1-15 | P9 | **violated** ³⁸⁰ | The picker's disabled Save & Close (opacity .4) has no word beside it; the gate words live in the map pane. At 1440 both are in view; at 380 the footer is at 729 and the map hint is scrolled inside a 606 px scroller with 820 px of content. | `LocationPickerModal.tsx:2078-2104` | Save disabled, opacity 0.4, title ""; gate words "Click the map or search to drop a pin" (map overlay), "Drop a pin on the map" (road-properties pane). | Phone: a grey button with no reason in reach. |
| F-S1-16 | P10 | note | Dialog controls under 24 px: "+ Or enter coordinates manually" 211×16; Mapbox attribution links 14 px (third-party). | `LocationPickerModal.tsx:1844-1852` | | |

### S2 — Generate in flight

Screens: `out-run1/*-s2-generate-band.png`, `*-s2-settled.png`; `out-followup/1440-f2-midflight.png`.

| id | P | verdict | what | where | measurement | operator cost |
|---|---|---|---|---|---|---|
| F-S2-1 | P8 | honoured | One band, bottom-fixed, present for every sample of every flight; strip silent while it is up. | `WorkingBand.tsx:31-42`; `lib/working-band.ts:67-121` | 1440: 47–59 samples, first at 4–6 ms, h 41, "GENERATING · new plan · pin 39.7269, -104.9873"; 380: h 80. Strip text in 0/59 band samples. RE-GENERATING objects seen: "after a correction to …", "after undoing the correction to …", "without the site check", "retrying the site scan"; RENDERING × 7 objects. | — |
| F-S2-2 | P1 | **violated** (#240) | Two instant scroll jumps before the smooth settle. | `GeneratorShell.tsx:1152-1189` (the swap), `:764-789` (landing) | 1440 scrollY: 1357 → 976 → 691 → 602 → 583 (3 jumps > 40 px in 400 ms), docH 2357 → 3064. 380: 2787 → 2456 → 1609 → 1237 → 1095 → 1010 → 991 (6 jumps). | Every Generate. |
| F-S2-3 | P1 | **violated** (declared, #250) | The results zone lands at 174 / 173, not 98 — the ruling-f verdict-strip remount (98 + strip 52 + 24). | `GeneratorShell.tsx:771-775`; `globals.css:1354-1357` | 1440: 174 on 3 of 3 ok generates; 380: 173. On a **refused** generate (follow-up attempt 2): results top **−104**, strip −180..−128, refusal container **−65..92** (under the 52 px nav) — the #250 race, now on the surface that matters most. | Every plan (76 px); the refusal case: the operator waits 22 s and sees nothing to act on. |
| F-S2-4 | P3 | honoured (ok) / **violated** (refused, 1 of 2) | The settle viewport contains the verdict or the next step. | as above | ok: strip 98..150, lockup 218..255 in a 1000 viewport. refused #1: container 218..375 (in view); refused #2: container −65..92 (out). | see F-S2-3 |
| F-S2-5 | P16 P9 | honoured / **violated** | Re-generate: the previous answer stays, dimmed, with the ribbon "Previous answer — values below predate the request in flight." — but the ribbon is INSIDE the dim, so the label that explains the dim is itself at 2.39:1, and 56 of 59 text pairs in the dim fail 4.5:1. | `GeneratorShell.tsx:1320-1344` (ribbon inside the `.results-stale` wrapper); `globals.css:3134-3147` | `.results-stale` opacity 0.5, filter grayscale(0.4), 104 nodes; ribbon 2.39; `span.k` "Total devices" 2.47; `.num` "39" 2.56. Ribbon at vtop 850 (in view) while the operator is at the block; band fixed bottom. #192 ruled the dim; the ribbon's own contrast was never measured before (arc 23 counted 30 axe nodes, not the label). | Every correction and every edit: 4–23 s of unreadable previous answer with an unreadable label. |

### S3 — Post-generate

Screens: `out-run1/*-s3-settled.png` (full), `*-s3-block.png`, `*-s3-strip-editor.png`, `*-s3-quote-open.png`, `*-s3-tiers-open.png`; `out-followup/1440-f1-checked-open.png`, `1440-f1-audit-open.png`.

| id | P | verdict | what | where | measurement | operator cost |
|---|---|---|---|---|---|---|
| F-S3-1 | P2 | **violated** | The tier counts are stated twice: the ledger line and each chip's numeral; while refreshing the ledger says "◌ checking against the updated inputs…" and the chips keep their numbers — two voices, one fact. | `TieredReference.tsx:715-717` + `lib/tiering.ts:357-364` (ledger); `ReferenceChip.tsx:48-63` (chips) | ledger "2 changes · 4 needs attention · 13 checked · 3 pending · reference"; chips "▲Changed this plan 2", "⚠Needs attention 4", "✓Checked & passed 13 · each cited", "◌Pending / not verified 3"; mid-refresh ledger "◌ checking against the updated inputs…" with chips unchanged (`out-run1/1440x1000-denver-s3-settled.png`). | Every plan; every re-generate shows the disagreement for the flight. |
| F-S3-2 | P5 | **violated** | Zone 03 has two headings and the inner one is larger. | `GeneratorShell.tsx:1391-1396` (`.zone-title`); `TieredReference.tsx:700-702` (`h2`) | zone-title "Rules, permit & audit" 17px/700 at y 1737; inner h2 "Denver — jurisdiction rules" 20px/700 at 1776 (39 px below). Zones 01/02 have one heading each. | Every plan; reads as two sections. |
| F-S3-3 | P2 | note (ruled by #253) | The lockup and the block state the detected count from one field. | `ResultsHead.tsx:44-62`; `SetupStrip.tsx:433` | lockup "4 · Site conditions detected · of 5 checked"; block 5 rows, 4 "detected". Agree today; #253 deletes the lockup. | — |
| F-S3-4 | P4 | **violated** | The three download cards do not share a button edge: the crew card carries two buttons. | `OutputCards.tsx:152-178` (crew = `crew-pdf` + `markdown`), `:284-356` (`DlCard`) | `.dl-btn` tops 1589/1589/**1537**/1589 (spread 52); bottoms 1629/1629/1577/1629; card heights 206/206/206. | Every plan; the one row of primary actions. |
| F-S3-5 | P11 | **violated** | The audit PDF is a text link inside the Checked & passed tier body; every other download is a 40 px bordered `.dl-btn`. | `TieredReference.tsx:546-561` | "↓ Audit PDF" 85×18, border 0, mono 11px, two clicks from the settled page (open the tier, find the link); `.dl-btn` 325×40 bordered. | Every plan that goes to a TCS: the audit PDF is the deliverable they need. |
| F-S3-6 | P3 P7 | **violated** | A strip editor opens on click and shows no way to close: no Done/Cancel, Escape does nothing, an outside click closes it (undiscoverable). Its change commits on blur with no Apply. | `SetupStrip.tsx:78-124` (`Simple`), `.sv-editor` `:102`; work-zone commit-on-blur `:797-812` | Edit Speed: editor 149×63, control 82×28, close affordance none; Escape → still open; click at (5,300) → closed. 1440: strip h 65 → 65, 0 rects moved. **380: strip 211 → 255, `.zone[1]`, `.status-bar`, results dTop +44.** | Every post-generate edit; the operator learns by trial. |
| F-S3-7 | P4 | honoured 1440 / **violated** ³⁸⁰ | Strip cells share height and top at 1440; at 380 they wrap into three rows of unequal width. | `SetupStrip.tsx:632` | 1440: heights 63 ×9, tops 928 ×9. 380: tops 1426/1489/1552; widths 123/131/111/78/80/72/91/59/65; axe `target-size` on `Edit Lane W`, `Edit Work zone`, `.strip-edit-all` (130×19). | 380 only. |
| F-S3-8 | P1 | honoured | Opening the quote, a tier, or an audit item moves nothing above it. | `PricingCard.tsx:32-50`; `ReferenceChip.tsx`; `AuditTrail.tsx:1489-1512` | price 52 → 372, above moved none; tiers +1120 / +203 / +352, above moved none. | — |
| F-S3-9 | P4 | honoured | Quote fields: label and input share a left edge; hero meta values right-align; audit rows share the title left (255) and cite right (1211). | `QuotePanel.tsx:653-703`; `ResultsHero.tsx:69-94`; `AuditTrail.tsx:1503-1508` | 8 fields 187/546/906 ×3 rows; `.mv` rights 1245 ×4. | — |
| F-S3-10 | P2 P16 | note (→ #194) | The Flaggers caption "Auto · 0 from layout" is true here (shoulder plan, no flagger) and byte-identical to the false one #194 reports in saved mode. | `QuotePanel.tsx:722-729` | "Flaggers · Auto · 0 from layout"; "Delivery (mi) · Auto · 5 mi from HQ". | — |
| F-S3-11 | P11 | note | The quote's two actions wear two treatments by design (secondary bordered / primary filled). | `QuotePanel.tsx:387-405` | "Preview breakdown" 528×47 border 1px transparent; "Download Quote (XLSX)" 526×47 filled `--act`. | (consistent with a primary/secondary pair; recorded) |
| F-S3-12 | P5 | **violated** | 63 distinct type tuples (family · size · weight · transform · colour) on the settled page across 16 sizes; the role table has four roles on two sizes. | `globals.css:2413-2445` (`.tr-*`); `lib/design/type-roles.ts` | sizes 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 14, 16, 17, 20, 24, 28, 76 px; an open audit body alone: mono 16/400, sans 14/400, mono 9/700, mono 10/400. Full list `out-run1/*-type-tuples.json`. | Polish; the #226 "no other type sizes" rule is not yet page-wide. |
| F-S3-13 | P12 P11 | honoured / **violated** | The block footer slices the scan stamp ("8 sep · 16:06 utc", ISO on `title`) — honoured. The refusal line and the audit PDF print the raw ISO — two formats for one stamp. | `SetupStrip.tsx:438-453` vs `GeneratorShell.tsx:1276-1291`; `src/rendering/audit_blocks.py` (PDF "Scanned … at 2026-09-08T16:18:40+00:00") | block "corridor scan · 8 sep · 16:06 utc · 2.5 s · a correction re-generates the plan"; refusal "… attempted 2026-09-08T16:14:59+00:00 · budget 20 s"; audit PDF p. 3 raw ISO ×1. | Refusal and PDF readers. |
| F-S3-14 | P9 | honoured | Every block row: glyph + word; result words are the vocabulary. | `SetupStrip.tsx:240-252` | ▲ detected ×4, ✓ none along the corridor; 0 glyphs unhidden. | — |
| F-S3-15 | P4 P6 | honoured 1440 / **violated** ³⁸⁰ | Block: names share a left edge, actions a right edge, one row height (46) at 1440. At 380 the wrapped name "Adjacent interchange (highway ramps)" puts ▲ on its own line and the name at 42 instead of 66; rows 85/119/85/85/58. | `SetupStrip.tsx:200-456`; `globals.css:1934-1953` (`@container`, `minmax(0,1fr) 92px`) | 1440: name lefts 212 ×5, action rights 1252 ×5, rows 46 ×5, grid "958px 92px". 380: name lefts 66/**42**/66/66/66, grid "194px 88px", rows 85/**119**/85/85/58 (`out-run1/380x800-denver-s3-block.png`). | 380 only. |
| F-S3-16 | P10 | **violated** (desk) | Controls under 32 px on the settled page. | `ResultsHead.tsx:52-62`; `TieredReference.tsx:234-246`; `AppFooter.tsx:8-13`; `SetupStrip.tsx:274` | signposts "correct in setup ↑" 119×16 (lockup) and 119×13 (section 03 ×2); Terms 35×16, Privacy 49×16; Undo 30×16; "↓ Audit PDF" 85×18; `.strip-edit-all` 130×19 ³⁸⁰. | Desk: mis-clicks on the two cheapest navigations. |
| F-S3-17 | P13 | honoured | Audit items are `data-read` expanders; the default post-generate view has one auto-expanded tier (Needs attention) and the quote closed. | `AuditTrail.tsx:1500-1510` | 5 audit-head buttons 1066×50; price-body hidden. | — |
| F-S3-18 | P2 | honoured | Hero counts = plan-sheet card counts; live regions post-generate = 2 (strip, sr-only). | `ResultsHero.tsx`; `OutputCards.tsx` | hero 39/12; cards 39/12/11; sr "Plan generated — 31 devices, 9 types." (the Lakewood-jurisdiction Denver plan). | — |
| F-S3-19 | P10 | honoured / **violated** ³⁸⁰ | axe settled: 1440 `heading-order` (an `h4` in `.dl-card` after `h2`) + `region`; 380 adds `scrollable-region-focusable .gap-8` and `target-size .strip-edit-all` (the two named) — and with the strip's wrap, `Edit Lane W` / `Edit Work zone`. | `OutputCards.tsx:285-288` | | |

### S4 — Correction round-trip (Dismiss → chips → Other → Confirm → band → record → Undo)

Screens: `out-run1/*-s4-picker.png`, `*-s4-other.png`, `*-s4-confirm-band.png`, `*-s4-record.png`.

| id | P | verdict | what | where | measurement | operator cost |
|---|---|---|---|---|---|---|
| F-S4-1 | P1 | note | Dismiss mounts the picker row (user-asked); rows below move by its height. | `SetupStrip.tsx:339-405` | block 323 → 373 (1440), rows 5 → 6; 380: 559 → 713. | (expected) |
| F-S4-2 | P4 | **violated** (#255-1) | Reason-chip text is not centred: the empty glyph slot sits on the left. | `SetupStrip.tsx:362-375`; `globals.css:1850-1881` | every chip: text centre − box centre = **+7.5 px** at both viewports; padding 25/10 (1440), 23/8 (380); chips 95×28 / 77×28 / 155×28 / 131×28 (1440), 26 px tall at 380. | Every dismiss. |
| F-S4-3 | P1 | **violated** (#255-3) | Choosing "Other (say what)" mounts the note input and throws Confirm to a new line. | `SetupStrip.tsx:380-401` | 1440: Confirm **1065,689 → 190,723** (a new line, the left column); note 184×27 at 1063,689. 380: Confirm 44,1093 → 44,1127. | Every "Other" dismiss. |
| F-S4-4 | P9 | **violated** | Confirm dismiss is disabled while the note is empty and carries no word saying why. | `SetupStrip.tsx:393-401` | disabled=true, title "", text "Confirm dismiss". | Every "Other" dismiss: a grey button. |
| F-S4-5 | P4 | note | With the picker open: Cancel at right 1252 (the action column), Confirm dismiss at right 325 (the picker's left), other rows' actions at 1252 — two action edges in one block while the picker is open. | `SetupStrip.tsx:323-326`, `:393-401` | Cancel 44×26 right 1252; Confirm 135×30 right 325; Dismiss/Assert right 1252. | Every dismiss. |
| F-S4-6 | P7 | **violated** (#254) | One Confirm opens one request and locks the page; Undo opens another. | `SetupStrip.tsx:327-334` → `GeneratorShell` `withSiteCorrection` | Denver 1440: "RE-GENERATING · after a correction to Adjacent at-grade intersection", 37 samples, settled **4.1 s**; 380: 3.7 s; Lakewood: 209 samples, **22.8 s**. Undo: "after undoing the correction to …", a second flight. | Every correction. |
| F-S4-7 | P6 | **violated** (#255-2, inverted) | The record row is a second height for the same row kind. | `SetupStrip.tsx:260-279` (`.sc-record`); `globals.css:1940-1953` | 1440: record **33** (1 line) vs scan rows **46**; 380: record 108 (5 lines) vs 85/119/58. The issue's 58-vs-36 assert case was not walked (the Dismiss row was used); the dismissed sentence fits one line at 958 px. | Every correction: the row count's geometry changes. |
| F-S4-8 | P15 P4 | honoured | The record keeps × + sentence + Undo; Undo shares the action edge; Undo removes the record. | `SetupStrip.tsx:260-279` | × "Undo" 30×16 right 1252 = Dismiss/Assert right 1252; records after Undo 0, rows 5. | — |
| F-S4-9 | P2 | note | Lockup after the correction still reads the detected count (4 of 5) — the correction is a record, not a change to "detected". | `ResultsHead.tsx` | "4 · Site conditions detected · of 5 checked". | (#253 wording: "N OPEN" would change on a dismiss; the lockup does not — decide which the chip reads.) |

### S5 — Refusal (two natural at 1440, replay at 380)

Screens: `out-followup/1440x1000-denver-s5-refusal-natural-f1.png` (in view), `…-s5-refusal-natural.png` (above the fold), `1440-f4-refusal-full.png`, `1440-f4-not-checked.png`; `out-replay/380x800-denver-s5-refusal-replay*.png`.

| id | P | verdict | what | where | measurement | operator cost |
|---|---|---|---|---|---|---|
| F-S5-1 | P2 P8 P16 | **violated** | Under PLAN DECLINED the page still shows a plan: hero counts (refusal #1) or download cards with "— devices" / "— types" placeholders and four live download buttons (refusal #2); the sr-only region announced "Plan generated — 39 devices, 12 types." (refusal #1). | `GeneratorShell.tsx:778-782` (announcement from the settled breakdown), `:1345+` (`showResults` on the breakdown, not the audit); `OutputCards.tsx:55-56` (`—` placeholders); `StatusBar.tsx:222-238` | #1: strip "PLAN DECLINED · …", hero true, **4 download buttons enabled**, sr "Plan generated — 39 devices, 12 types."; #2: hero false, **4 download buttons enabled over "— devices" / "— types"**, sr "". | A third of Denver first scans: a declined plan with live downloads is the one state the interface must never show. |
| F-S5-2 | P2 | **violated** | The refusal is stated twice (three times with the pill). | `StatusBar.tsx:222-238`; `GeneratorShell.tsx:1267-1291` | strip "PLAN DECLINED · the site scan could not complete — retry it, or generate without the site check, from the notice in the Results zone" + pill "SERVICE UNAVAILABLE"; container "Site scan unavailable — the plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway and the plan will carry a NOT-CHECKED disclosure." | Every refusal. |
| F-S5-3 | P3 | **violated** (1 of 2) | The container landed above the nav on one of two natural refusals. | `GeneratorShell.tsx:764-789`; #250 | #1: container 218..375; #2: **−65..92**, strip −180..−128, results top −104 (innerH 1000). | After a 22 s wait the operator sees the download cards and nothing to act on. |
| F-S5-4 | P11 | **violated** | Two actions in one row, two treatments: a text-link Retry and a bordered two-line proceed button. | `GeneratorShell.tsx:1293-1311` | "↻ Retry scan" 94×**18**, border 0; "Generate without site check — the plan will say SITE CONDITIONS NOT CHECKED" 596×28, border 1px, **2 lines**. | Every refusal; the primary recovery is the smaller, quieter control. |
| F-S5-5 | P10 | **violated** | Retry is 18 px tall. | as above | 94×18 (desk); 380: see replay row. | |
| F-S5-6 | P12 | **violated** | The provenance line prints a raw ISO stamp. | `GeneratorShell.tsx:1283-1285` | "corridor scan · scan budget exceeded (20 s) · attempted 2026-09-08T16:14:59+00:00 · budget 20 s". | Every refusal. |
| F-S5-7 | P16 P2 | **violated** | The proceed button promises "the plan will say SITE CONDITIONS NOT CHECKED"; on this run the re-generation (memo warmed by the refused attempt) scanned successfully and the plan said "4 · Site conditions detected · of 5 checked" — no NOT-CHECKED anywhere. Honest outcome, false promise. | `GeneratorShell.tsx:1302-1311`; `:665` (`proceed_if_unavailable`) | band "RE-GENERATING · without the site check", settled 8.6 s, verdict "VERIFIED · 3 plan flags", block present, ledger "2 changes · 1 needs attention · 13 checked · 2 pending", NOT CHECKED tags 0. | Every proceed-anyway on a warm memo: the operator expected a disclosure and must re-read the block to learn the scan ran. |
| F-S5-8 | P9 | honoured | Contrast in the container. | | tr-section 14.92, glyph 8.82, message 9.68, prov 5.61, buttons 5.68 / 5.61. | — |
| F-S5-9 | P14 | honoured | Section 03 under the refusal says why it is empty. | `TieredReference.tsx:439-473` | ledger "0 changes · 1 needs attention · 0 checked · 0 pending"; attention body "Audit trail unavailable while generation is declined — see the notice above."; audit PDF button absent (the tier body is not rendered). | — |
| F-S5-10 | P3 P11 P10 P2 | **violated** ³⁸⁰ (replay of the captured 400 body, fulfilled on the Generate's own audit request) | At 380 the container is in view; the proceed button wraps to four lines; Retry stays 18 px; the declined page again carries a plan. | as F-S5-1/4/5 | container 348..675 (h 326, w 332), strip 98..249, results top 272, settled 18.4 s; "↻ Retry scan" 94×**18** at 39,575; "Generate without site check — …" **304×63, 4 lines** at 39,601; hero true, 4 downloads enabled, sr "Plan generated — 31 devices, 9 types."; axe target-size ×3 (`Edit Lane W`, `Edit Work zone`, `.strip-edit-all`). The 1440 replay reproduced F-S5-1..6 byte-for-byte (`out-replay/1440x1000-denver-s5-refusal-replay.png`). | Phone: the recovery is a 63 px paragraph button and an 18 px link. |

### S6 — Downloads

| id | P | verdict | what | where | measurement | operator cost |
|---|---|---|---|---|---|---|
| F-S6-1 | P8 | honoured | Every render raises the band with its object; button labels never change. | `OutputCards.tsx:86-91`; `RenderRequestContext` | plan sheet PDF 18 samples · device list XLSX 4 · crew instructions PDF 7 · crew instructions MD 5 · quote XLSX · MHT package ZIP · audit PDF 69; "Download PDF↓" unchanged. | — |
| F-S6-2 | P2 | **violated** | The device-list XLSX Summary prints the jurisdiction as CDOT while the strip, the band record, the crew PDF ("Jurisdiction: Denver") and the plan carry Denver. | `src/export/device_list.py:241` (`params.jurisdiction`) — the render params' field, not `meta.jurisdiction`; location of the params writer to confirm at investigation | `out-run1/downloads/1440x1000-denver-devices.xlsx` Summary: "Jurisdiction | CDOT"; same at 380; `…-crew.pdf` p. 1 "Jurisdiction: Denver"; strip cell "JURISDICTION Denver" (`1440x1000-denver-s3-settled.png`). | Every bid list on a jurisdiction plan says the wrong authority. |
| F-S6-3 | P2 | **violated** | The plan sheet's corridor details disagree with the setup panel's corridor extent for the same pin. | `src/rendering/plan_sheet.py:3707` ("Downstream", `corridor.downstream_taper_ft`) vs the panel's `/api/render/corridor-spec` (`lib/render-proxy.ts:308`, `GeneratorSidebar.tsx:918-948`); `src/api/render_api.py:969` (`downstream_taper_length(…, use_max=True)`) | plan PDF p. 2: "Total corridor 3,462 ft (0.66 mi) · Downstream **100 ft**"; panel (`1440x1000-denver-s1-pinned.png` / `03-pinned`): "Total **3,412** ft · Downstream **50** ft"; advance 1,500 / taper 217 / buffer 645 / work zone 1,000 agree. | Every plan sheet: the crew reads 100 ft, the estimator saw 50. |
| F-S6-4 | P2 | honoured | The audit PDF's site-conditions table and cover line match the screen. | `src/rendering/audit_blocks.py`; `out-followup/downloads/1440x1000-denver-audit.pdf` p. 3 | PDF: Adjacent at-grade intersection DETECTED "46 found · nearest 95.8 ft" · Adjacent interchange DETECTED "10 found · nearest 10.8 ft" · Pedestrian sidewalks DETECTED "103 found · nearest 100.1 ft" · Bike lane DETECTED "11 found · nearest 109.6 ft" · School zone "None along the corridor"; screen block rows identical (`out-run1/1440x1000-denver-block-rows.json`). Cover "2 changes · 1 needs attention · 13 checked · 2 pending" = the ledger at the time. | — |
| F-S6-5 | P12 | **violated** | The audit PDF prints the scan stamp as raw ISO. | `src/rendering/audit_blocks.py` ("Scanned along the corridor against OpenStreetMap at 2026-09-08T16:18:40+00:00 (7147 ms, memoised, via …)") | 1 raw ISO per audit PDF; plan / crew PDFs 0. | TCS readers. |
| F-S6-6 | P2 | honoured | Plan sheet DATE = the render day; crew PDF "Generated: 2026-09-08"; XLSX "Generated 2026-09-08 16:07:35". | | | (#212's ISSUED is the screen's, not the files'.) |

### S7 — `?debug=1`

| id | P | verdict | what | where | measurement |
|---|---|---|---|---|---|
| F-S7-1 | P13 | honoured | The replication snapshot button renders only with `?debug=1`. | `DebugSnapshotButton.tsx:271-280` | `?debug=1`: 1 button 227×30 at 194,2193; plain `/sandbox`: 0. |

---

## Could not measure (say so, not "looks fine")

- **NOT-CHECKED disclosures** (strip `.site-not-checked`, section 03 `NOT CHECKED` rows, the audit PDF's NOT-CHECKED page): the only way to produce them is a refused scan followed by proceed-anyway on a scan that is STILL refused; on this sha the refused attempt warms the memo, so proceed-anyway scanned successfully both times it was tried (F-S5-7). The disclosures' geometry is unmeasured; their existence is asserted by the arc-22/23 evidence, not by this audit.
- **#255-2's asserted-sentence wrap (58 vs 36 px):** the round trip used the Dismiss row; the assert sentence was not measured at 1440. The dismissed record's height (33 vs 46) is the measurement on file.
- **#235 Surface A (the detected/applied table):** pre-generate, inside the picker flow with a detected road; the manual-pin flow used here never mounts it. A follow-up leg through the picker with a real road detection is needed.
- **Near-intersection kind** (#234, the cross-street forms): not walked; shoulder work only.
- **#212's hydration errors:** same-day as the deploy, so not reproducible today (no `pageerror` in any run).
- **Stale-tab (#242):** not reproducible in a fresh headless context.
- **P12's hand-check:** no numeric measure by design; the screenshots are on the branch for Ryan.
- **380 refusal geometry** was measured by replay, not a natural refusal (the first replay attempt fulfilled the pre-generate verification request instead of the Generate's; `audit-replay380.js` fixes that — row F-S5-10). A natural 380 refusal would add only the landing race (F-S5-3), which is timing, not width.

## Out of scope for this audit (listed so they are not lost)

- #243 Note 8 false FAIL (backend; ranked because the screen misleads).
- #244 snapshot posts `scenario` (debug surface).
- #256 scan budget / corridor-check budget (backend; N2 is its surface cost).
- The 429 mirror and the corridor-check second budget (arc-22 follow-ups in #256).
- F-S6-2 / F-S6-3 are P2 defects seen on the surface whose FIX is backend (device_list.py, plan_sheet.py / corridor-spec) — filed as N1 with the backend label, not silently reclassified.

## Files

- `findings.md` (this file) · `issue-comments.md` (Part 2) · `new-issues.md` (Part 3, ranked).
- `audit-walk.js`, `audit-followup.js`, `audit-replay380.js`, `audit-lib.js`, `pdf-check.py`.
- `out-run1/` — the walk: `log.txt`, `rows.json`, per-leg `*-samples.json`, `*-block-rows.json`, `*-type-tuples.json`, `probes-*.json` (contrast / glyph / type / targets per root), `axe-*.json`, screenshots, `downloads/` (plan / crew PDFs, device-list and quote XLSX, crew MD — the two package zips deleted: they duplicate the files), `pdf-check.md`.
- `out-followup/` — audit PDFs (ok plan and the proceed-anyway plan), the refusal hunt, the stale-dim probe, `refusal-replay.json` (the captured 400 body).
- `out-replay/` — the 380 (and 1440) replayed refusal.
