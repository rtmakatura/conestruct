# Walkthrough findings — mission site-walkthrough-audit (#396)

Live site www.conestruct.com at `c431ceb`, walked 2026-10-25 headless (Playwright) at 1440x900 and 390x844, with the gate token sent in the `x-conestruct-gate` header (never written here). Screenshots are in `before/`; the scripts that took them are in `script/`. Paths in the Source column are under `conestruct/site/`.

## Ryan's note: "Download PDF" and "Download .md" wrap onto two lines

**Not reproduced on the live build.** The committed screenshots show every download button on one line at 1440 (Chromium), 1024 (Firefox) and 390 (Chromium and WebKit), and the crew card's shared row reads "PDF" / ".md", as it has since #329 (`28b49a8`; `components/OutputCards.tsx:106-117`, chosen at `:380-385`; padding `app/globals.css:3618-3627`). See `before/1440-sandbox-shoulder-generated.png`, `before/390-sandbox-downloads.png`, `before/390-chromium-downloads.png`, `before/1024-firefox-downloads.png`. The walk also measured each button at 44 px at widths down to 360 in three engines, but that output wasn't saved, so only the screenshots back it.

One path still carries long labels on a shared row: signed-out saved mode uses `SIGNUP_LABELS` ("Sign up to download PDF", "Sign up to download .md") ahead of the shared short labels (`OutputCards.tsx:120-126`, `:380-385`). The walk couldn't reach it without an account. Fixed in the light lane (item L1).

## Findings

| ID | Width | Class | Finding | Source | Disposition |
|---|---|---|---|---|---|
| W1 | both | FILE | Work length shows "1,000 ft · typed" / "✓ yours" for the default, never typed (Rule 10) | `lib/scenarios/index.ts:126`; `lib/scenarios/move-ledger.ts:182`; `components/bands/WhereBand.tsx:762-768` | #397 |
| W2 | both | FILE | Work type shows "✓ yours" on a default never chosen | `components/bands/PlanDetails.tsx:205-209` | #397 |
| W3 | both | FILE | Lanes shows "⚠ yours" / "OSM · withdrawn · operator-set" untouched; the same road read 2/12 ft one visit, 4/10.5 ft the next | `lib/road-detection/detected-rows.ts:237-261` | #397 |
| W4 | both | FILE | "◌ previous answer, refreshing…" stays up after Generate settles (seen on every generated screenshot; the 40 s+ duration was observed, not recorded) | `components/GeneratorShell.tsx:2249` (the cue), `:1547-1548` (its condition, `tiersRefreshing`) | #398 |
| W5 | both | FILE | "Windows · ◌ loading" never ends after a declined plan | `components/ScheduleField.tsx:202-204` | #398 |
| W6 | both | LIGHT | After a decline, "the option you picked stands" is said of a jurisdiction filled from the pin, in red | `components/bands/WhatBand.tsx:393` | L1 |
| W7 | both | LIGHT | "Generation declined. See the notice below." — the notice is at the top of the page | `lib/scenarios/rail.ts:139` | L1 |
| W8 | 1440 | FILE | Near-intersection refusal puts the cross street at "length minus 13 ft" while the map shows the pin; no way forward | backend audit 400; `components/LocationPickerModal.tsx` | #399 |
| W9 | 1440 | FILE | Wadsworth Blvd (route 121) prefilled as Lakewood; needs a sourced ruling | `/api/jurisdiction/suggest` | #400 |
| W10 | both | FILE | "4 files" beside the zip, but the zip has no crew PDF or audit PDF and adds quote.xlsx | `lib/render-types.ts:22`; `components/OutputCards.tsx:250` | #401 |
| W11 | both | FILE | Every download is named `plan.*` / `plan_mht_package.zip`, so two plans collide (touches an API route) | `components/OutputCards.tsx:152-158`; `components/GeneratorShell.tsx:1114`; `app/api/render/bundle/route.ts:68` | #401 |
| W12 | both | LIGHT | Selected kind chips and toggles differ by blue border/tint only, no ✓ (Rule 13) | `app/globals.css:4836-4840`, `:5507-5511` | L2 |
| W13 | 390 | LIGHT | Phone (WebKit): dropdowns render white with near-invisible text; real iPhone unchecked | `app/globals.css:5220` | L2 |
| W14 | 390 | LIGHT | Picker: "Save &amp; Close" wraps, the road list is clipped behind the footer, page text shows below the modal | `components/LocationPickerModal.tsx:1870-1883` | L3 |
| W15 | both | LIGHT | "STEP 1 OF 4" wraps to two lines (1440 with a long subtitle; 390 always) | `components/bands/BandPrimitives.tsx:115`; `app/globals.css:4718` | L2 |
| W16 | both | FILE | Picker still says "⚠ WHICH ROAD?" after a pick, truncates the road name, asks for a side it has no control for | `components/LocationPickerModal.tsx:2136`, `:2249` | #402 |
| W17 | both | FILE | Length "-5" says "Work zone length is required." (validation logic) | `lib/scenarios/validation.ts:175-179` | #403 |
| W18 | both | FILE | Flagger form repeats speed and lane width as sliders beside the step-2 selects | `components/FlaggerForm.tsx`; `components/bands/WhatBand.tsx:475-530` | #404 |
| W19 | both | FILE | Road detection takes 22–27 s per search (timed during the walk; the timings weren't saved) | `/api/road-bearing` | #405 |
| W20 | both | FILE + LIGHT | Enter in the address field does nothing (#402); "enter it manually" names a control the band doesn't have (copy, L1) | `components/bands/WhereBand.tsx:598-608` | #402, L1 |
| W21 | 390 | LIGHT | Phone nav has an empty bordered cell next to the logo | `components/AppNav.tsx:60-112` | L2 |

## Walked

- **Public pages:** `/`, `/terms`, `/privacy`, and a 404 at 1440 and 390: no horizontal scroll, axe 0, no `docs/style.md` violations. Contact form not submitted.
- **Sandbox, three ways in:** address, cross street, a CDOT road (Wadsworth).
- **Forms:** shoulder, flagger and near-intersection generated on Colfax; shoulder generated on Wadsworth; near-intersection on Wadsworth declined (W8) and was not generated; flagger not run on Wadsworth.
- **Refusals hit:** one-way flagger (recovered by ticking two-way), blank / too-long / negative length, missing cross street, unconfirmed cross-street lanes, cross street inside the zone.
- **Downloads:** all six controls on five runs, 30 files, every one HTTP 200 with the right content type and opening cleanly (observed during the walk; the per-file log wasn't saved). Zip 0.6–0.9 MB; plan PDF 2 pages; XLSX has Device List and Summary sheets; crew PDF 3–4 pages; .md `text/markdown`; audit PDF 4–5 pages.
- **Evidence limits:** `before/` holds 28 PNGs plus `public-pages.json`. `script/repl.mjs` is an interactive harness whose session wasn't saved, and `script/run.sh` points at a session scratchpad, so the scripts show how the walk was driven but don't re-run the measurements above as committed. `before/1440-near-int-unnamed-cross.png` actually shows a named cross street (West 10th Avenue).
- **Counts:** 21 findings: 7 LIGHT, 13 FILE and 1 both (W20); the FILE ones went into 9 issues, #397–#405. This corrects `e96e530`'s message ("11 light, 10 filed", "29 before screenshots").
- **Not walked:** signed-in and saved-plan views (no account); real iOS Safari (W13).
