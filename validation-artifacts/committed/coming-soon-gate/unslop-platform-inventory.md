# R33 Part B: platform copy inventory (investigate only, no edits)

2026-09-29. Scanned at origin/main 467ffaf (+ Part A's branch, which touches none of these files). Rules: the unslop-ai-text skill's ranked tells (the "User-facing copy" rule the prompt cites isn't in CLAUDE.md yet). Excluded: `/`, `/404`, `/terms`, `/privacy` (Part A).

Classes: **safe** = display-only; **pinned** = a test/snapshot asserts the exact string (pin named); **cited** = MUTCD / S-630-1 wording, leave verbatim. "Mock copy" = a frontend test holds a hand copy of a backend string as input; it won't fail on a change but goes stale.

Paths: `C/` = `conestruct/site/components/`, `L/` = `conestruct/site/lib/`, `src/` = backend.

| Surface | Rows | safe | pinned | cited |
|---|---|---|---|---|
| 1. App UI (/sandbox, /app, jurisdiction panel, picker, bands) | 124 | 88 | 36 | 0 |
| 2. Audit panel + backend audit strings (incl. audit PDF) | 54 | 37 | 15 | 2 |
| 3. Validation / refusal messages | 25 | 18 | 7 | 0 |
| 4. PDF plan sheet, crew sheet, XLSX | 21 | 20 | 1 | 0 |
| 5. Emails | 0 | 0 | 0 | 0 |
| **Total** | **224** | **163** | **59** | **2** |

All but three rows are rule 1 (em dash). The three others: `global-error.tsx:19` (boilerplate), `render_api.py:200` and `:692` (missing contractions).

## Patterns (where one change fixes many rows)

- **"X — Y" labels (~60 rows):** chips, group labels, road-type names, TA hints, the PDF title separator. One convention (": " or the house " · ") fixes all of them.
- **"Statement — instruction" sentences (the rest):** a period or a semicolon.
- **Two backend helpers parse the em dash as data.** `src/api/audit.py:1709` builds the citation chip with `rule.split(" — ")[0]`; changing the 7 `site_adjustments.py` rule strings breaks the chips unless the split changes in the same commit. `src/rules/validators.py:392` does the same to `scenario_display_name` (7 titles) for the PDF PARAMETERS box.
- **Single-owner constants with hand-copied mocks.** `SITE_SCAN_UNAVAILABLE_MESSAGE`, `NOT_CHECKED_DISCLOSURE`, `_VERIFY`, `CORRECTIONS_SHEET_PREFIX` (all `src/api/site_scan.py`) are mocked in 4–9 frontend test files. The two "No devices added —" actions are mirrored byte-for-byte between `site_adjustments.py` and `C/AuditTrail.tsx` `SITE_ADJUSTMENT_DETAIL`.
- **Handoff notes:** `C/bands/HandoffNotes.tsx:60-109`, 12 rows (6 pinned by `GeneratorShell.handoff-provenance.test.tsx`).
- **Refusal pointers:** all six in `L/scenarios/auto-apply.ts:200-252`.
- **Negative assertions go vacuous:** `GeneratorShell.refusal-voice.test.tsx:179,210` and `LocationPickerModal.state-contract.test.tsx:272` assert an exact em-dash string appears 0 times. Change the copy without them and they still pass, testing nothing.

## 1. App UI

| file:line | current | rule | proposed rewrite | class |
|---|---|---|---|---|
| conestruct/site/app/app/page.tsx:97 | "No plans yet — start one in the workbench." | 1 | "No plans yet. Start one in the workbench." | safe |
| conestruct/site/app/global-error.tsx:19 | "An unexpected error occurred. The error has been reported." | 9, 12 | "Something broke on our side. We've logged the error." | safe |
| C/GeneratorFormPrimitives.tsx:62 | "Pending — set a location first" | 1 | "Pending: set a location first" | safe |
| C/GeneratorShell.tsx:1364-1365 | "Plan generated — N devices, M types." / "Plan generated — MHT package ready." | 1 | "Plan generated: N devices, M types." / "Plan generated. MHT package ready." | pinned C/GeneratorShell.a11y-announce.test.tsx:204 |
| C/GeneratorShell.tsx:1759 | sr-only h1 "Method of Handling Traffic — plan generator" | 1 | "Method of Handling Traffic plan generator" | safe |
| C/GeneratorShell.tsx:1936 | "APPLY — RE-GENERATE" | 1 | "APPLY AND RE-GENERATE" | pinned C/GeneratorShell.revision.test.tsx:180 |
| C/GeneratorShell.tsx:2169 | "No package yet — the plan is being built." | 1 | "No package yet. The plan is being built." | pinned C/GeneratorShell.scan-wire.test.tsx:356 |
| C/GeneratorShell.tsx:2225 | "Device breakdown failed — values below may be stale." | 1 | "Device breakdown failed. Values below may be stale." | safe |
| C/GeneratorShell.tsx:2237 | "Previous answer — values below predate the request in flight." | 1 | "Previous answer. These values predate the request in flight." | safe |
| C/GeneratorShell.tsx:2248 | "Previous answer — {n} staged, not yet applied." | 1 | "Previous answer: {n} staged, not yet applied." | pinned C/GeneratorShell.batch-corrections.test.tsx:220,234,346 |
| C/GeneratorShell.tsx:2309 | "◌ previous answer — refreshing…" | 1 | "◌ previous answer, refreshing…" | pinned C/AuditTrail.declined-stale.test.tsx:209 |
| C/GeneratorShell.tsx:2408 | "Draft — not a sealed plan. … requires review and seal by a licensed PE prior to field use." | 1, 11 | "Draft, not a sealed plan. It's engineering reference and needs a licensed PE's review and seal before field use." | pinned C/GeneratorShell.disclosures.test.tsx:174, C/GeneratorShell.zone-headings.test.tsx:163 |
| C/GeneratorSidebar.tsx:378 | "no lane tag for the cross street — the lane count was assumed 1 per direction" | 1 | "The map data has no lane tag for the cross street, so the lane count was assumed at 1 per direction, not detected." | safe |
| C/DeviceBreakdown.tsx:83 | "unavailable — generation declined" | 1 | "unavailable: generation declined" | pinned C/DeviceBreakdown.test.tsx:36 |
| C/DeviceBreakdown.tsx:85 | "paused — retry inside" | 1 | "paused: retry inside" | pinned C/DeviceBreakdown.test.tsx:65 |
| C/DeviceBreakdown.tsx:87 | "unavailable — retry inside" | 1 | "unavailable: retry inside" | safe |
| C/DeviceBreakdown.tsx:104 | "Plan details — device schedule" | 1 | "Plan details: device schedule" | safe |
| C/DeviceBreakdown.tsx:119 | "…while generation is declined — see the notice above." | 1 | "…while generation is declined. See the notice above." | safe |
| C/DeviceBreakdown.tsx:127 | "…in the last minute — retry in a moment." | 1 | "…in the last minute. Retry in a moment." | safe |
| C/DeviceBreakdown.tsx:146 | "Highlighted rows are jurisdiction-required — added by {J}'s published rules…" | 1 | "Highlighted rows are jurisdiction-required: {J}'s published rules add them on top of the MUTCD baseline." | safe |
| C/JurisdictionSection.tsx:84 | "† Two adopted sources disagree — conservative value rendered" | 1 | "† Two adopted sources disagree. Showing the conservative value." | safe |
| C/JurisdictionSection.tsx:121 | "conditional — surfaced, not auto-applied" | 1, 3 | "conditional: shown here, not applied automatically" | safe |
| C/JurisdictionSection.tsx:330; C/bands/RevisionBand.tsx:94; C/bands/WhatBand.tsx:546 | "Not set — MUTCD + CDOT only" | 1 | "Not set (MUTCD + CDOT only)" | safe (stub copies in class-suggest.test:124, suggest-contract.test:95, suggestion-records.test:81) |
| C/JurisdictionSection.tsx:349; C/bands/WhatBand.tsx:334 | "evaluating — the option you picked, not yet confirmed for this plan" | 1 | "evaluating: you picked this, but it isn't confirmed for this plan yet" | pinned C/JurisdictionSection.test.tsx:187 |
| C/JurisdictionSection.tsx:351 | "Statewide baseline — MUTCD + Colorado Supplement only." | 1 | "Statewide baseline: MUTCD + Colorado Supplement only." | safe |
| C/JurisdictionSection.tsx:407 | "{J} classifies via its published map — look the street up before submitting" | 1 | "{J} classifies streets on its published map. Look the street up before you submit." | safe |
| C/JurisdictionSection.tsx:547 | "…map — the road tier is a proxy, the adopted map governs." | 1 | "…map. The road tier is only a proxy; the adopted map governs." | safe |
| C/JurisdictionSection.tsx:568, 793 | "{suggested} — was {prior}." | 1 | "{suggested} (was {prior})." | safe |
| C/JurisdictionSection.tsx:572, 798 | "Dismissed the {X} suggestion — {prior} stands." | 1 | "Dismissed the {X} suggestion. {prior} stands." | pinned C/GeneratorShell.class-suggest.test.tsx:326, C/GeneratorShell.suggest-contract.test.tsx:252 |
| C/JurisdictionSection.tsx:593, 668 | "Detected road tier suggests {X} — you have {Y} selected." | 1 | "Detected road tier suggests {X}, but you have {Y} selected." | pinned C/GeneratorShell.class-suggest.test.tsx:303 |
| C/JurisdictionSection.tsx:769 | "Boundary data is approximate (…) — confirm jurisdiction with the permitting authority." | 1 | "…(…). Confirm the jurisdiction with the permitting authority." | safe |
| C/JurisdictionSection.tsx:817, 882 | "Pin appears to be in {X} — you have {Y} selected." | 1 | "Pin appears to be in {X}, but you have {Y} selected." | pinned C/GeneratorShell.suggest-contract.test.tsx:292 |
| C/JurisdictionSection.tsx:1037 | "Schedule marked "Not set" — the windows above are reference only." | 1 | "Schedule marked "Not set", so the windows above are reference only." | pinned C/JurisdictionSection.density.test.tsx:168, C/JurisdictionSection.notset.test.tsx:38 |
| C/JurisdictionSection.tsx:1043 | "{note} — enter the work date and start/end times…" | 1 | "{note}. Enter the work date and start/end times…" | safe |
| C/JurisdictionSection.tsx:1073 | "Metered exposure estimate ≈ $X — trim the schedule to avoid it." | 1 | "…≈ $X. Trim the schedule to avoid it." | safe |
| C/JurisdictionSection.tsx:1167; C/TieredReference.tsx:384, 513, 533 | "Work hours — {J}" | 1 | "Work hours: {J}" | safe |
| C/JurisdictionSection.tsx:1209-1210 | "…publishes no work-hour windows — no restriction shown because none is on record, not because none exists." | 1, 3 | "{J} publishes no work-hour windows. None is on record, which doesn't mean none exists." | safe |
| C/ScheduleField.tsx:302-303 | "…publishes no work-hour windows — none on record, not none existing" | 1, 3 | "{J} publishes no work-hour windows. None on record, which isn't the same as none existing." | safe |
| C/JurisdictionSection.tsx:1370 | "Permit — {J}" | 1 | "Permit: {J}" | safe |
| C/JurisdictionSection.tsx:1387 | "Courtesy reference — FYI · fees are never quote line items" | 1 | "Courtesy reference, FYI · fees are never quote line items" | safe |
| C/JurisdictionSection.tsx:1415 | "{tier} — {tier_reason}" | 1 | "{tier}: {tier_reason}" | safe |
| C/JurisdictionSection.tsx:1613 | "— worst: {rate}" | 1 | "· worst: {rate}" | safe |
| Road-type labels: C/LocationPickerModal.tsx:211-212, 218-219; C/bands/HandoffNotes.tsx:43-44; L/road-detection/detected-rows.ts:40-41; L/scenarios/band-facts.ts:96-97; L/scenarios/what-cells.ts:120-121; C/WorkBeyondShoulderForm.tsx:19-20; C/LaneClosureForm.tsx:20; C/MobileOpMultilaneForm.tsx:18; C/MobileOp2LaneForm.tsx:17 | "Rural — undivided", "Rural — divided", "Rural — divided hwy", "Rural — 2-lane 2-way" | 1 | "Rural, undivided" etc. | safe |
| C/LaneClosureForm.tsx:58; C/MobileOp2LaneForm.tsx:51; C/MobileOpMultilaneForm.tsx:51; C/WorkBeyondShoulderForm.tsx:60 | "TA-19 — divided highway, right lane closed" (and TA-35, TA-26, TA-1 hints) | 1 | "TA-19: divided highway, right lane closed" | safe |
| C/LocationPickerModal.tsx:840 | "Road detection is unavailable right now — use ↻ Re-detect roads to retry." | 1 | "…right now. Use ↻ Re-detect roads to retry." | safe |
| C/LocationPickerModal.tsx:854 | "Verify the location — with no road, the band asks which way traffic heads." | 1 | "Verify the location. With no road, the band asks which way traffic heads." | safe |
| C/LocationPickerModal.tsx:1336, 1549 | "Area located — drop a pin on the road to detect roads." | 1 | "Area located. Drop a pin on the road to detect roads." | pinned C/LocationPickerModal.state-contract.test.tsx:249 (and :272, negative) |
| C/LocationPickerModal.tsx:1912-1913 | "…is not configured. The interactive map can't load — please enter coordinates manually below." | 1, 11 | "The map isn't configured (NEXT_PUBLIC_MAPBOX_TOKEN missing), so it can't load. Enter coordinates below." | safe |
| C/LocationPickerModal.tsx:2009 | "Detecting road… — Save enables when detection settles" | 1 | "Detecting road… Save turns on once detection settles" | safe |
| C/LocationPickerModal.tsx:2121 | "{cross} — marked at your last save." | 1 | "{cross}, marked at your last save." | safe |
| C/LocationPickerModal.tsx:2127 | "{cross} — two-way, signal detected." | 1 | "{cross}: two-way, signal detected." | safe |
| C/LocationPickerModal.tsx:2214 | "Multiple roads detected — pick a road above to load road properties." | 1 | "Multiple roads detected. Pick one above to load its properties." | safe |
| C/LocationPickerModal.tsx:2220-2221 | "…existing values — verify manually below." | 1 | "…existing values. Check them below." | safe |
| C/LocationPickerModal.tsx:2275 | "{v} mph {src} — {kind} plans cap at {x} mph (…)" | 1 | "{v} mph {src}, but {kind} plans cap at {x} mph (…)." | safe |
| C/LocationPickerModal.tsx:2290 | "{n} lanes/direction {src} — plans draw at most {max}…" | 1 | "…{src}, but plans draw at most {max} lanes per direction." | safe |
| C/LocationPickerModal.tsx:2338 | "Low-confidence fallback — won't apply unless you accept it." | 1 | "Low-confidence fallback. It won't apply unless you accept it." | safe |
| C/LocationPickerModal.tsx:2484 | "Operator-set — overrides the detected {source}" | 1 | "Operator-set: overrides the detected {source}" | safe |
| C/LocationPickerModal.tsx:2948 | "Corridor preview unavailable — couldn't reach the layout service." | 1 | "Corridor preview unavailable. Couldn't reach the layout service." | safe |
| C/LocationPickerModal.tsx:2958; C/bands/BandAerial.tsx:137, 142 | "Can't lay the corridor out here — {refusal}" | 1 | "Can't lay the corridor out here: {refusal}" | pinned C/bands/BandAerial.test.tsx:161 |
| C/LocationPickerModal.tsx:2977 | "Corridor lengths wait on the kind of work — choose it after you save." | 1 | "…kind of work. Choose it after you save." | safe |
| C/LocationPickerModal.tsx:3014 | "none — straight projection along the heading" | 1 | "none: straight projection along the heading" | pinned C/LocationPickerModal.coverage.test.tsx:270 |
| C/NearIntersectionForm.tsx:266 | "…marked on the map — the plan places it along the road from the work start" | 1 | "…marked on the map. The plan places it along the road from the work start" | safe |
| C/NearIntersectionForm.tsx:267 | "not marked — mark the cross street on the map" | 1 | "not marked. Mark the cross street on the map" | safe |
| C/NearIntersectionForm.tsx:378-379 | "Cross-street lanes — direction A/B" | 1 | "Cross-street lanes, direction A" | pinned C/GeneratorShell.near-intersection.test.tsx:242,250 |
| C/NearIntersectionForm.tsx:400-402 | "…often include turn pockets — check the through-lane count before generating." | 1 | "…turn pockets. Check the through-lane count before generating." | safe |
| C/NearIntersectionForm.tsx:420 | "✓ Cross-street lane count confirmed — map data reported {x}." | 1 | "✓ Cross-street lane count confirmed; map data reported {x}." | safe |
| C/NearIntersectionForm.tsx:428 | "Undo — restore detected lane data" | 1 | "Undo: restore detected lane data" | pinned C/GeneratorForms.confirm-undo.test.tsx:182 |
| C/NeedsYouConditions.tsx:241 | "dismiss · other — {note}" | 1 | "dismiss · other: {note}" | pinned C/NeedsYouConditions.test.tsx:289 |
| C/NeedsYouConditions.tsx:343 | "staged — not yet applied" | 1 | "staged, not yet applied" | pinned C/NeedsYouConditions.test.tsx:230 |
| C/NeedsYouConditions.tsx:387 | "Site conditions — scanned" | 1 | "Site conditions: scanned" | pinned C/NeedsYouConditions.test.tsx:495 |
| C/NeedsYouConditions.tsx:496 | placeholder "say what — required" | 1 | "say what (required)" | pinned C/NeedsYouConditions.test.tsx:277 |
| L/scenarios/site-corrections.ts:66 | "Curve, hill crest — moves advance signs 50% farther upstream." | 1 | "Curve or hill crest. Moves advance signs 50% farther upstream." | pinned C/NeedsYouConditions.test.tsx:636 |
| C/OutputCards.tsx:445 | "Unsaved edits — Save to download the plan on screen." | 1 | "Unsaved edits. Save to download the plan on screen." | safe |
| C/PricingCard.tsx:34 | "FYI · contractor estimate — not a permit fee" | 1, 3 | "FYI · contractor estimate, not a permit fee" | safe |
| C/QuotePanel.tsx:587 | "Markup — overhead X%, profit Y%" | 1 | "Markup: overhead X%, profit Y%" | safe |
| C/QuotePanel.tsx:715 | "Auto-detect failed — enter manually" | 1 | "Auto-detect failed. Enter manually" | safe |
| C/ScheduleField.tsx:204, 220 | "◌ — checking these inputs", "◌ — reference (other street class)" | 1 | "◌ checking these inputs" | safe |
| C/ScheduleField.tsx:211 | "— set dates to check" | 1 | "set dates to check" | pinned C/ScheduleField.windows-block.test.tsx:119 |
| C/StatusBar.tsx:371-374 | "VERIFICATION PAUSED · too many updates in the last minute — Generate in a moment…" | 1 | "…in the last minute. Generate in a moment to check again" | safe |
| C/StatusBar.tsx:409 | "…waking the verification server — the first check can take a few extra seconds" | 1 | "…waking the verification server; the first check can take a few extra seconds" | safe |
| C/StatusBar.tsx:433 | "…this response carries no plan verdict — retry from the audit trail panel below" | 1 | "…no plan verdict. Retry from the audit trail panel below" | safe |
| C/bands/BandAerial.tsx:57 | "The aerial didn't load — Edit on map shows the corridor." | 1 | "The aerial didn't load. Edit on map shows the corridor." | safe |
| C/bands/BandAerial.tsx:61, 63 | alt "Aerial at the pin — nothing is laid out…" / "…laid-out corridor — the work and its approaches" | 1 | "Aerial at the pin. Nothing is laid out until the side is chosen" / "…laid-out corridor, with the work and its approaches" | safe |
| C/bands/HandoffNotes.tsx:60 | "(clamped from Y mph {src} — {kind} plans cap at X mph per TA)" | 1 | "(clamped from Y mph {src}; {kind} plans cap at X mph per TA)" | safe |
| C/bands/HandoffNotes.tsx:67 | "Speed X mph — accepted low-confidence fallback (src)." | 1 | "Speed X mph: accepted low-confidence fallback (src)." | safe |
| C/bands/HandoffNotes.tsx:69 | "Speed fallback X mph not applied — plan uses Y mph…" | 1 | "…not applied. The plan uses Y mph (src)." | safe |
| C/bands/HandoffNotes.tsx:77 | "Detected {A} not valid for {kind} plans — kept {B}." | 1 | "Detected {A} isn't valid for {kind} plans, so {B} was kept." | safe |
| C/bands/HandoffNotes.tsx:83 | "(clamped from N {src} — plans draw at most M lanes per direction)" | 1 | "(clamped from N {src}; plans draw at most M…)" | pinned C/GeneratorShell.handoff-provenance.test.tsx:306 |
| C/bands/HandoffNotes.tsx:87 | "Lanes set to N/direction ({src} — was M)." | 1 | "({src}, was M)" | pinned C/GeneratorShell.handoff-provenance.test.tsx:261 |
| C/bands/HandoffNotes.tsx:89 | "…from the picker not applied — {kind} plans don't take a lane count." | 1 | "…not applied: {kind} plans don't take a lane count." | pinned C/GeneratorShell.handoff-provenance.test.tsx:282 |
| C/bands/HandoffNotes.tsx:94 | "Road set to divided ({src} — was undivided)." | 1 | "({src}, was undivided)" | safe |
| C/bands/HandoffNotes.tsx:96 | "Divided setting from the picker not applied — …" | 1 | "…not applied: {kind} plans don't take a divided toggle." | pinned C/GeneratorShell.handoff-provenance.test.tsx:285 |
| C/bands/HandoffNotes.tsx:104 | "(narrowed from X ft — N lanes × … is wider than the plan sheet can draw…)" | 1 | "(narrowed from X ft because N lanes × … is wider than…)" | safe |
| C/bands/HandoffNotes.tsx:106 | "Lane width set to X ft (OSM detection — was Y ft)." | 1 | "(OSM detection, was Y ft)" | safe |
| C/bands/HandoffNotes.tsx:109 | "(was X mph — the posted speed is now Y mph, at or below it)" | 1 | "(was X mph; the posted speed is now Y mph, at or below it)" | pinned C/GeneratorShell.handoff-provenance.test.tsx:372 |
| C/bands/PlanDetails.tsx:196 | "inputs the grid has no cell for — every one of them changes the plan" | 1 | "inputs the grid has no cell for. Each one changes the plan" | safe |
| C/bands/RevisionPanel.tsx:175 | "preview unavailable — the plan on screen is unchanged" | 1 | "preview unavailable; the plan on screen is unchanged" | safe |
| C/bands/WhatBand.tsx:335 | "not evaluated — the check did not answer; the option you picked stands" | 1, 11 | "not evaluated: the check didn't answer, so the option you picked stands" | safe |
| C/bands/WhatBand.tsx:353 | "nothing detected — every value here is yours" | 1 | "nothing detected; every value here is yours" | safe |
| C/bands/WhereBand.tsx:200 | "the road's sides are unavailable — reopen the map to retry" | 1 | "the road's sides are unavailable. Reopen the map to retry" | safe |
| C/bands/WhereBand.tsx:299 | "{n} more kinds are not enabled — each waits on its typical sheet being validated…" | 1, 11 | "{n} more kinds aren't enabled yet. Each waits until its typical sheet is validated against the generator." | safe |
| C/bands/WhereBand.tsx:432 | "An address, or a cross-street pair — the way an 811 ticket describes it." | 1 | "An address or a cross-street pair, the way an 811 ticket describes it." | safe |
| C/bands/WhereBand.tsx:482 | "⚠ detection stale — the confirmed road was picked at a different pin" | 1 | "⚠ detection stale: the confirmed road was picked at a different pin" | safe |
| C/bands/WhereBand.tsx:495 | "⚠ saved before the pin marked the work start — say which side is occupied…" | 1 | "…marked the work start. Say which side is occupied to lay the work out from this pin" | safe |
| C/bands/WhereBand.tsx:652 | "corridor extent unavailable — awaiting verification" | 1 | "corridor extent unavailable, awaiting verification" | safe |
| C/bands/WhereBand.tsx:685 | "Confirm — {kind}" | 1 | "Confirm {kind}" | pinned C/GeneratorShell.kind-confirm.test.tsx:348 |
| L/scenarios/band-facts.ts:191 | "the work — not the first sign" | 1, 3 | "the work, not the first sign" | safe |
| L/scenarios/band-facts.ts:310 | aria "{field}: {text} — change" | 1 | "Change {field}: {text}" | pinned C/GeneratorShell.value-links.test.tsx:164, L/scenarios/band-facts.test.ts:122 |
| L/scenarios/band-facts.ts:432, 452 | "pending — find the work first" | 1 | "pending: find the work first" | safe |
| L/scenarios/band-facts.ts:448 | "pending — kind of work not chosen" | 1 | "pending: kind of work not chosen" | pinned L/scenarios/band-facts.test.ts:47 |
| L/scenarios/move-ledger.ts:202 | "Kind of work — confirm below" | 1 | "Kind of work: confirm below" | pinned C/GeneratorShell.kind-confirm.test.tsx:376,388 |
| L/scenarios/preview.ts:82, 85 | "…preview still computing — Apply re-generates…" / "…preview failed — Apply re-generates…" | 1 | "…preview still computing. Apply re-generates the full plan either way" | pinned L/scenarios/revision.test.ts:124,127 |
| L/scenarios/what-cells.ts:157 | "TA-10's definition — the flagger alternates two opposing directions" | 1 | "TA-10's definition: the flagger alternates two opposing directions" | safe |
| L/scenarios/rail.ts:211, 382 | aria "Road — pending — set a location first" | 1 | "Road: pending, set a location first" | pinned L/scenarios/rail.test.ts:350 |
| L/road-detection/cross-street.ts:147, 165 | "marked turn lanes here — its lane count usually includes…" / "…per-direction counts — a marker for turn pockets…" | 1 | "…turn lanes here, so its lane count usually includes…" / "…per-direction counts, which points to turn pockets or a center turn lane." | safe (mock copy C/GeneratorShell.near-intersection.test.tsx:56) |
| src/rules/boundaries.py:139 | "…boundary — jurisdiction lines here are jigsawed; verify which side…" | 1 | "Pin is N ft from the {X} boundary, where jurisdiction lines are jigsawed. Verify which side the work zone falls on." | safe |
| src/rules/boundaries.py:178 | "Pin is in {X} — not in the supported set; baseline rules will apply…" | 1 | "Pin is in {X}, which isn't in the supported set. Baseline rules apply unless you pick manually." | safe |
| src/rules/boundaries.py:185 | "…municipal limits — a jurisdiction Conestruct does not carry yet" | 1, 11 | "…municipal limits, a jurisdiction Conestruct doesn't carry yet (…)." | safe |
| src/rules/boundaries.py:196 | "…outside the mapped municipal boundaries — not in the supported set…" | 1 | "…outside the mapped municipal boundaries, so it's not in the supported set. Baseline rules apply…" | safe |
| src/rules/boundaries.py:231 | "…({vintage} vintage) — confirm only if the work zone is actually inside." | 1 | "…(…). Confirm only if the work zone is actually inside." | safe |
| src/rules/jurisdiction.py:291 | "schedule marked Not set — hours not evaluated" | 1 | "schedule marked Not set, so hours weren't evaluated" | pinned tests/test_schedule_hours_eval.py:240,256 |
| src/rules/jurisdiction.py:305 | "work date TBD — weekday windows assumed (conservative)" | 1 | "work date TBD: weekday windows assumed (conservative)" | safe |
| src/rules/jurisdiction.py:315 | "overnight shift — evaluated across midnight…" | 1 | "overnight shift: evaluated across midnight against the work date's windows" | safe |
| src/rules/jurisdiction.py:479 | "street class not provided — cannot resolve the Minor/Major split" | 1, 11 | "street class not provided, so the Minor/Major split can't be resolved" | safe |

## 2. Audit panel and backend audit strings

| file:line | current | rule | proposed rewrite | class |
|---|---|---|---|---|
| C/AuditTrail.tsx:84 + src/rules/site_adjustments.py:94 | "No devices added — the cross-street approach layout is not generated; see…" | 1, 11 | "No devices added: the cross-street approach layout isn't generated. See the pending-verification disclosure." | pinned tests/snapshots/corpus/grid_site_adjacent_intersection.json:133 (frontend copy must stay byte-identical) |
| C/AuditTrail.tsx:93 + src/rules/site_adjustments.py:128 | "No devices added — the per-ramp interchange layout is not generated…" | 1, 11 | same shape | pinned tests/snapshots/corpus/grid_site_adjacent_interchange.json:133 |
| C/AuditTrail.tsx:162 | "Values unavailable — the audit for this input did not succeed." | 1, 11 | "Values unavailable. The audit for this input didn't succeed; see the notice above." | safe |
| C/AuditTrail.tsx:400 | "— CDOT M-630 strongly recommends a TMA at this speed." | 1 | "Not deployed. CDOT M-630 strongly recommends a TMA at this speed." | safe |
| C/AuditTrail.tsx:433 | "…only minimal advance signing is required — no taper, no buffer, no channelizing devices…" | 1 | "…required: no taper, no buffer, and no channelizing devices on the road itself." | safe |
| C/AuditTrail.tsx:553 | "…may be limited — keep shadow-to-truck spacing tight" | 1 | "…may be limited. Keep shadow-to-truck spacing tight (≤ 200 ft)…" | safe |
| C/AuditTrail.tsx:595 | "…for additional protection — recommended at speeds ≥ 55 mph (CDOT M-630)." | 1 | "…for additional protection, as CDOT M-630 recommends at speeds ≥ 55 mph." | safe |
| C/AuditTrail.tsx:615 | "…merge direction at posted distance — LEFT arrow…" | 1 | "…at posted distance: LEFT arrow for the right-lane operation." | safe |
| C/AuditTrail.tsx:1076, 1081 + src/rendering/audit_blocks.py:535, 539 | "Approach 'id' — 35 mph, … — SIGNALIZED (…)" | 1 | "Approach 'id': 35 mph, {road_type}, SIGNALIZED (signal operation review required)." | safe |
| C/AuditTrail.tsx:1207 | "Work-zone posted speed is reduced — Fines Double signing applies per…" | 1 | "…is reduced, so Fines Double signing applies per CDOT S-630-1 Sheet 12, Fines Double Signing Notes." | safe |
| C/AuditTrail.tsx:1310 | "OpenStreetMap could not be reached at generation — road-network warnings were not evaluated." | 1, 11 | "OpenStreetMap couldn't be reached at generation, so road-network warnings weren't evaluated." | safe |
| C/AuditTrail.tsx:1331 | "Soft check against OSM — warnings do not block plan generation." | 1, 11 | "Soft check against OSM. Warnings don't block plan generation." | safe |
| C/AuditTrail.tsx:1380 | "…were not verified — site adjustments reflect operator-set flags only." | 1, 11 | "…weren't verified. Site adjustments reflect operator-set flags only." | safe |
| C/AuditTrail.tsx:1564 | "{label} — {detail}" | 1 | "{label}: {detail}" | safe |
| C/TieredReference.tsx:262; L/tiering.ts:313 | "operator correction — moot" | 1 | "operator correction (moot)" | safe |
| C/TieredReference.tsx:312 | "detected — no rule applies" | 1 | "detected, no rule applies" | safe |
| C/TieredReference.tsx:326, 392, 546 | "{J} deltas — fired" / "— conditional / needs input" / "— administrative" | 1 | "{J} deltas: fired" | safe |
| C/TieredReference.tsx:336 | "Site adjustments — devices added or moved" | 1 | "Site adjustments: devices added or moved" | safe |
| C/TieredReference.tsx:354 | "Audit trail unavailable while generation is declined — see the notice above." | 1 | "…is declined. See the notice above." | pinned C/GeneratorShell.refusal-voice.test.tsx:179,210 (negative; goes vacuous) |
| C/TieredReference.tsx:365 | "…in the last minute — retry in a moment." | 1 | "…in the last minute. Retry in a moment." | safe |
| C/TieredReference.tsx:402, 415 | "Personnel gates — obligations" / "Device mandates — obligations" | 1 | "Personnel gates: obligations" | safe |
| C/TieredReference.tsx:488 | "checked against OSM — no warnings" | 1 | "checked against OSM, no warnings" | safe |
| C/TieredReference.tsx:571 | "Site scan — measured, no rule applies" | 1 | "Site scan: measured, no rule applies" | pinned C/TieredReference.scan-rows.test.tsx:108 |
| C/TieredReference.tsx:608 | "{J} — jurisdiction rules" | 1 | "{J} jurisdiction rules" | pinned C/JurisdictionSection.density.test.tsx:60 |
| L/tiering.ts:284 | "signalized — signal operation review required" | 1 | "signalized: signal operation review required" | safe |
| L/tiering.ts:330 | "scanned — none along the corridor" | 1 | "scanned, none along the corridor" | safe |
| src/api/audit.py:1077 | "…exit per Case 17 — 500 ft past the downstream taper end…" | 1 | "…exit per Case 17: 500 ft past the downstream taper end to R2-11…" | pinned tests/snapshots/audit_flagger_reduction_fines_double_required.json:156 |
| src/api/audit.py:1144-1145 | "Case 18 (Sheet 10) — traffic control around a work area near an intersection, one lane closed — applied to an undivided highway" | 1 | 'Case 18 (Sheet 10), "traffic control around a work area near an intersection, one lane closed," applied to…' | cited (S-630-1 Case 18 plate title stays verbatim; only the dashes are ours) |
| src/api/audit.py:1156 | "…places cross-street advance signing only — corner-quadrant support is tracked at…" | 1 | "…signing only. Corner-quadrant support is tracked at…" | safe |
| src/api/audit.py:1234-1236, 1254-1256 | "Case 11 — the general shoulder-work typical (drawn for freeway/expressway) — applied to…" | 1 | "Case 11, the general shoulder-work typical (drawn for freeway/expressway), applied to…" | pinned tests/snapshots/audit_shoulder_urban25_quadratic.json:51, tests/snapshots/corpus/grid_undivided.json:51 |
| src/api/audit.py:1811, 1825 | "CDOT S-630-1 case reference — verification pending" | 1 | "CDOT S-630-1 case reference: verification pending" | safe |
| src/api/audit.py:1931-1933 | "The signal-operation review — phasing, timing, and signal-head visibility per… MUTCD Part 4 — remains with…" | 1 | "The signal-operation review (phasing, timing, and signal-head visibility per MUTCD §6N.12, items 04 and 05, 11th Ed. p. 848, and MUTCD Part 4) stays with the traffic control supervisor and the operating agency." | safe |
| src/api/audit.py:1956 | "Low confidence — verify lane count…" | 1 | "Low confidence: verify the lane count…" | safe |
| src/api/audit.py:1986-1989 | "Detection override — map data reported X; … built to the assertion — verify it in the field…" | 1 | "Detection override: map data reported X; the user asserted Y. The plan is built to the assertion, so verify it in the field or on imagery before deploying." | pinned tests/test_detection_override_audit.py:46-48 |
| src/rules/site_adjustments.py:103, 136 | "MUTCD §6N.12 p. 848 — Work within the Traveled Way at an Intersection (11th Ed.)" / "MUTCD §6N.16 p. 851 — Interchanges (11th Ed.)" | 1 | "MUTCD §6N.12 p. 848: Work within the Traveled Way at an Intersection (11th Ed.)" | cited (section titles verbatim; also pinned by corpus snapshots; audit.py:1709 splits on " — ") |
| src/rules/site_adjustments.py:69, 151, 182, 203, 234 | "MUTCD §6B.04 — increased advance warning…" and four more | 1 | "MUTCD §6B.04: increased advance warning for limited sight distance" | pinned tests/snapshots/corpus/grid_site_*.json (audit.py:1709 splits on " — ") |
| src/rules/site_adjustments.py:146 | "Driveways present within work zone — maintain access gaps…" | 1 | "Driveways present within the work zone. Maintain access gaps in channelization…" | pinned tests/snapshots/corpus/grid_site_driveways_present.json:126 |
| src/rules/night_adjustments.py:117, 168, 183 | "MUTCD §6L.07 — warning lights…" and two more | 1 | "MUTCD §6L.07: warning lights on channelizing devices in nighttime work zones" | safe |
| src/api/site_scan.py:145 | "SITE CONDITIONS NOT CHECKED — service unavailable at generation." | 1 | "SITE CONDITIONS NOT CHECKED: service unavailable at generation." | pinned tests/test_pdf_containment.py, tests/test_site_scan_ingenerate.py |
| src/api/site_scan.py:186 | "The plan is built to the correction — verify it in the field…" | 1 | "…correction, so verify it in the field or on imagery before deploying." | safe |
| src/api/site_scan.py:268 | "Operator dismissal of {X} is moot — the scan found none…" | 1 | "…is moot: the scan found none along the corridor, so there's nothing to dismiss." | safe |
| src/api/site_scan.py:274 | "…could not apply — the site scan did not complete…" | 1, 11 | "Operator dismissal of {X} couldn't apply: the site scan didn't complete, so nothing was detected to dismiss." | safe |
| src/api/site_scan.py:281 | "…is moot — the scan detected it; the assertion changes nothing." | 1 | "…is moot: the scan detected it, so the assertion changes nothing." | safe |
| src/api/site_scan.py:291 | "Operator asserted {X} — {found}." | 1 | "Operator asserted {X}; {found}." | pinned tests/test_site_scan_corrections.py, tests/test_site_scan_corrections_surfaces.py |
| src/api/site_scan.py:510 | "SITE CONDITIONS CORRECTED BY OPERATOR — " | 1 | "SITE CONDITIONS CORRECTED BY OPERATOR: " | pinned tests/test_site_scan_corrections_surfaces.py:106,114 |
| src/rules/validators.py:816 | "no tolerance — CDOT minimum is a hard floor" | 1 | "no tolerance; the CDOT minimum is a hard floor" | safe |
| src/rules/validators.py:1010 | "…is missing — the two guide signs must bookend the work zone." | 1 | "…is missing. The two guide signs must bookend the work zone." | safe |
| src/rules/validators.py:1478 | "…requires the reduction displayed in advance — at least one W3-5 upstream…" | 1 | "…requires the reduction to be displayed in advance: at least one W3-5 upstream…" | safe |
| src/rendering/audit_blocks.py:87 | "Audit Trail — {case_id}" | 1 | "Audit Trail: {case_id}" | safe |
| src/rendering/audit_blocks.py:103-104 | "Device spacing — taper" / "Device spacing — tangent" | 1 | "Device spacing (taper)" / "Device spacing (tangent)" | safe |
| src/rendering/audit_blocks.py:237 | "{label} — {detail} ({citation})" | 1 | "{label}: {detail} ({citation})" | safe |
| src/rendering/audit_blocks.py:288 | "Corridor check unavailable — OpenStreetMap could not be reached…" | 1, 11 | "Corridor check unavailable. OpenStreetMap couldn't be reached at generation, so road-network warnings weren't evaluated." | safe |
| src/rendering/audit_blocks.py:387 | "DETECTED — dismissed by operator ({reason})" | 1 | "DETECTED, dismissed by operator ({reason})" | pinned tests/test_audit_blocks_site_scan.py:292 |
| src/rendering/audit_blocks.py:403 | "Reference — detected, no rule" / "Reference — none" | 1 | "Reference: detected, no rule" / "Reference: none" | pinned tests/test_audit_blocks_site_scan.py:122-123 |

## 3. Validation and error messages

| file:line | current | rule | proposed rewrite | class |
|---|---|---|---|---|
| C/FlaggerForm.tsx:93 | "Map data reported {x} — untick to restore detection" | 1 | "Map data reported {x}; untick to restore detection" | safe |
| C/FlaggerForm.tsx:122, 171, 230, 280 | "Detection saw a single-lane road — confirm to enable this plan" (and 3 more) | 1 | "Detection saw a single-lane road. Confirm to enable this plan" | pinned C/GeneratorShell.refusal-voice.test.tsx:143 |
| L/scenarios/auto-apply.ts:200, 212, 228, 235, 242, 252 | "Detection saw a multi-lane road — confirm the lane count in the Road section to proceed." (6) | 1 | "Detection saw a multi-lane road. Confirm the lane count in the Road section to proceed." | pinned C/GeneratorShell.refusal-voice.test.tsx:150, L/scenarios/rail.test.ts:221,250 |
| L/scenarios/rail.ts:142 | "Confirm the cross-street lane count first — it was filled from map data." | 1 | "Confirm the cross-street lane count first. It was filled from map data." | pinned L/scenarios/rail.test.ts:67 |
| L/scenarios/rail.ts:143 | "Generation declined — see the notice below." | 1 | "Generation declined. See the notice below." | pinned C/GeneratorShell.input-gating.test.tsx:170, C/GeneratorShell.rail-single-source.test.tsx:110 |
| L/scenarios/rail.ts:145 | "Re-checking the declined input — Generate re-enables when the verdict settles." | 1 | "Re-checking the declined input. Generate comes back when the verdict settles." | pinned L/scenarios/rail.test.ts:71 |
| L/scenarios/rail.ts:147 | "Set a location first — pick on map or enter manually." | 1 | "Set a location first: pick it on the map or enter it manually." | pinned C/GeneratorShell.no-location.test.tsx:177, live-speakers.test.tsx:52, rail-single-source.test.tsx:88 |
| L/scenarios/validation.ts:98 | "…traffic can't merge around the closure — that's a flagger job, not this plan type." | 1, 3 | "…can't merge around the closure. That's a flagger job, not this plan type." | safe |
| L/scenarios/validation.ts:188 | "Describe 1 or 2 cross-street directions — one for a T-intersection, two when…" | 1 | "Describe 1 or 2 cross-street directions: one for a T-intersection, two when the cross street continues on both sides." | safe |
| L/scenarios/validation.ts:237 | "Mark the cross street on the map — the plan places it from there." | 1 | "Mark the cross street on the map. The plan places it from there." | pinned L/scenarios/rail.test.ts:132, L/scenarios/validation.near-intersection.test.ts:225 |
| L/scenarios/validation.ts:252 | "…same distance to the intersection — two different distances would describe…" | 1 | "…to the intersection. Two different distances describe two separate cross streets, which needs two plans." | safe |
| L/scenarios/validation.ts:269 | "The cross street can't be inside the work zone — Conestruct supports work near an intersection, not in it." | 1, 3 | "The cross street can't be inside the work zone. Conestruct supports work near an intersection, not in it." | safe |
| L/scenarios/validation.ts:287 | "…intersection itself isn't supported — shorten the work zone or…" | 1 | "…isn't supported. Shorten the work zone or increase the distance to the intersection." | safe |
| src/api/render_api.py:350 | "…more lanes than a flagger operation covers — TA-10 applies where one through lane runs in each direction." | 1 | "…covers. TA-10 applies where one through lane runs in each direction." | safe (mock copies in 3 frontend tests) |
| src/api/render_api.py:436 | "…between two opposing directions — a one-way road has no opposing direction to hold…" | 1 | "…two opposing directions. A one-way road has no opposing direction to hold, so the plan would direct traffic that isn't there." | safe |
| src/api/render_api.py:200 | "This scenario type is not yet available." | 11 | "This scenario type isn't available yet. Currently supported: {enabled}." | safe |
| src/api/render_api.py:692 | "…a plan cannot be rendered." | 11 | "No devices were generated for this scenario, so a plan can't be rendered." | safe |
| src/api/schemas.py:242 | "…must differ from start_time (…) — a zero-length shift is ambiguous; …" | 1 | "End time must differ from start time: a zero-length shift is ambiguous. An end time before the start time means the shift wraps past midnight." | safe |
| src/api/schemas.py:484, 831 | "…drawable half-road (52 ft) — use a lane width of X ft or less, or reduce the lane count." | 1 | "…(52 ft). Use a lane width of X ft or less, or reduce the lane count." | safe (mock copies in 2 frontend tests) |
| src/api/schemas.py:765 | "divided intersections are not supported yet — Cases 18/19 are undivided/arterial plates…" | 1, 11 | "Divided intersections aren't supported yet. Cases 18/19 are undivided/arterial plates, and a divided mainline adds the median-opening question (deferred)." | safe |
| src/api/schemas.py:1142 | "…ft from the work along the road — too far for a near-intersection plan." | 1 | "…along the road, too far for a near-intersection plan." | safe |
| src/generation/layout.py:1263 | "approaches disagree on along_station_ft (…) — both legs of the one supported cross street…" | 1 | "Approaches disagree on along_station_ft (…). Both legs of the one supported cross street must carry the same value…" | safe |
| src/generation/layout.py:1301 | "…lies inside the work zone (0..L) — in-intersection work is not supported." | 1, 11 | "…(0..L). In-intersection work isn't supported." | safe |
| src/api/site_scan.py:219 | "Asserting {X} takes no reason — the assertion is the fact." | 1 | "Asserting {X} takes no reason; the assertion is the fact." | safe |
| src/api/site_scan.py:333-334 | "Site scan unavailable — the plan can't verify… Retry, or generate anyway — the plan says whether the scan ran." | 1 | "Site scan unavailable. The plan can't verify school zones, sidewalks, or signals right now. Retry, or generate anyway; the plan says whether the scan ran." | safe (mock copies in 4 frontend tests) |

## 4. PDF plan sheet, crew sheet, XLSX

| file:line | current | rule | proposed rewrite | class |
|---|---|---|---|---|
| src/rendering/plan_sheet.py:1898, 1913 | title banner separator "  —  " | 1 | " · " | safe |
| src/rendering/plan_sheet.py:2132 | "DRAFT — Not for stamping" | 1 | "DRAFT, NOT FOR STAMPING" | safe |
| src/rendering/plan_sheet.py:2565, 2828, 3112 | "+N MORE — SEE DEVICE LIST (XLSX)" (and 2 more) | 1 | "+N MORE. SEE DEVICE LIST (XLSX)" | safe |
| src/rendering/plan_sheet.py:3154 | "+N MORE ADVANCE SIGNS — SEE CREW NARRATIVE &amp; DEVICE LIST" | 1 | "+N MORE ADVANCE SIGNS. SEE CREW NARRATIVE &amp; DEVICE LIST" | safe |
| src/rendering/plan_sheet.py:3186 | "† {LABEL} — {verdict} ({sources})" | 1 | "† {LABEL}: {verdict} ({sources})" | safe |
| src/rendering/plan_sheet.py:3195 | "† N ADOPTED-SOURCE CONFLICTS — CONSERVATIVE VALUES RENDERED…" | 1 | "† N ADOPTED-SOURCE CONFLICTS. CONSERVATIVE VALUES RENDERED; SEE JURISDICTION PANEL." | safe |
| src/rendering/plan_sheet.py:3213 | "…SHEET 10, CASES 18/19 — NOT DRAWN." | 1 | "…CASES 18/19, NOT DRAWN. SEE DEVICE LIST, CREW NARRATIVE, AND AUDIT." | safe |
| src/rendering/plan_sheet.py:3267 | "CLOSED LANE DRAWN AS THE RIGHTMOST LANE — MODELING ASSUMPTION; …" | 1 | "CLOSED LANE DRAWN AS THE RIGHTMOST LANE: A MODELING ASSUMPTION; …" | safe |
| src/rendering/plan_sheet.py:3308 | "GENERATED BY CONESTRUCT — DRAFT FOR PE REVIEW. NOT A SEALED PLAN." | 1 | "GENERATED BY CONESTRUCT. DRAFT FOR PE REVIEW, NOT A SEALED PLAN." | safe |
| src/rendering/plan_sheet.py:3817 | "DRAFT FOR PE REVIEW — Generated by MHT Tool (Conestruct)." | 1 | "DRAFT FOR PE REVIEW. Generated by MHT Tool (Conestruct). Not a sealed engineering document." | safe |
| src/rendering/plan_sheet.py:3993, 4001, 4006 | "Mapbox satellite imagery with street labels — for context only." | 1 | "Mapbox satellite imagery with street labels, for context only." | safe |
| src/rules/validators.py:350-364 (scenario_display_name: PDF title, crew narrative, XLSX) | "Shoulder Closure — Divided Highway" and 6 more | 1 | "Shoulder Closure (Divided Highway)" | pinned tests/s630/test_cross_surface.py:362,411,431, tests/test_near_intersection_generator.py:340 (validators.py:392 splits on " — ") |
| src/narrative/crew_narrative.py:641 | "(S-630-1 Sheet 26 — vehicle-mounted, not a roadside placement)" | 1, 3 | "(S-630-1 Sheet 26: vehicle-mounted, not a roadside placement)" | safe |
| src/narrative/crew_narrative.py:753-754 | "…this generated draft does not carry — the TCS supplies it on the submitted TCP." | 1, 11 | "…this generated draft doesn't carry. The TCS supplies it on the submitted TCP." | safe |
| src/narrative/crew_narrative.py:785 | "All travel lanes remain open — the closure occupies the shoulder only." | 1 | "All travel lanes remain open; the closure occupies the shoulder only." | safe |
| src/narrative/crew_narrative.py:791 | "All travel lanes and shoulders remain open — the work is beyond the roadway." | 1 | "…remain open because the work is beyond the roadway." | safe |
| src/rules/devices.py:164, 188 | "Type II barricade — two horizontal striped rails, 36–42 in tall" / "Type III barricade — three…" | 1 | "Type II barricade: two horizontal striped rails, 36–42 in tall" | safe |
| src/export/device_list.py:78, 82 | "…bills by SF — convert when sign sizes are known." | 1 | "…bills by SF. Convert when sign sizes are known." | safe |
| src/export/device_list.py:85; src/export/quote_generator.py:61 | "Optional — apply probability weight as appropriate per engineer discretion." / "Optional — quantities may be reduced per engineer discretion" | 1, 12 | "Optional. The engineer may apply a probability weight." / "Optional. The engineer may reduce quantities." | safe |
| src/export/device_list.py:95-99; src/export/quote_generator.py:189, 195-197 | "Jurisdiction-required — {doc}. …by SF — itemize per sign type" / "No single daily rate — NOT included in the quote total; price separately." | 1 | "Jurisdiction-required ({doc}). …by SF, so itemize per sign type." / "No single daily rate: NOT included in the quote total; price separately." | safe |
| src/export/quote_generator.py:679 | "Generated by Conestruct — conestruct.com" | 1 | "Generated by Conestruct · conestruct.com" | safe |

## 5. Emails

None in the repo. The only `mailto:` is the landing page's (Part A). Clerk templates live in the Clerk dashboard.

## Not covered

- **Jurisdiction data:** `data/jurisdictions/*.json` (14 files) holds 157 em dashes in rule text, notes, labels, titles, definitions (e.g. Denver fee tiers "Residential — administrative review"). This is the jurisdiction fact store. Treat it as one block, probably **cited**.
- **02-JURISDICTION-DATA.md isn't in the worktree or the main checkout**, so nothing could be matched against it. The jurisdiction block and the M-630 wording in `AuditTrail.tsx` are unconfirmed as sources.
- **MUTCD / S-630-1 text isn't in the repo.** "cited" is used only for known titles (§6N.12, §6N.16, Case 18). Paraphrases were classed safe.
- Out of scope on purpose: legacy Streamlit `src/api/app.py`, `DebugSnapshotButton` (`?debug=1` only), the archived landing components, `lib/design/*-exceptions.ts`, lone "—" missing-value placeholders, logs, developer-only exceptions.
- Source strings only; rendered PDFs/XLSX not checked. Rules 2, 4, 7, 10 were spot-checked by eye (~185 strings), no rows. Multi-line JSX may have gaps.
