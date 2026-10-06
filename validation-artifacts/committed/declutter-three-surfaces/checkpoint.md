# 📋 R96 checkpoint: declutter Step 2 (WHAT), the Setup line, and NEEDS YOU

This is investigation and mockups only. No app code changes until Ryan rules (R96, quoted verbatim in `rulings.md`). Ryan rules from the mockups, then each surface is built on its own branch.

## Evidence

- **Today, on prod** (www.conestruct.com/sandbox, `a748a7b`, 2026-10-06, about 09:20 MDT). `today/capture_today.cjs` drives it with Playwright and the gate's bypass header: the pin is E Colfax Ave (39.74020, −104.95600), work is Shoulder, and the first occupied side is chosen. It confirms the Denver and Arterial suggestions, then generates. Files:
  - `today/what-{1440,390}.png`: the WHAT band with both "✓ Confirmed … (was Not set). Undo" bars.
  - `today/what-{1440,390}-suggested.png`: the band before the suggestions are answered.
  - `today/setup-{1440,390}.png`: the results head.
  - `today/needsyou-{1440,390}.png`: NEEDS YOU.
  - `today/page-*`: full pages.
- **The proposals:** `mockups/{what,setup,needsyou}.html` (static, styled with the workbench tokens), rendered by `mockups/render.cjs` to `mockups/*-{1440,390}.png`. None of it is app code.
- **Finding:** on this pin the picker found no road in 4 of 6 prod runs this morning. The band said "No confirmed road at this pin, so nothing was prefilled", with 65 mph and "Rural, divided" defaults. The capture retries until the road is detected. This looks like Overpass flakiness, which is #292's subject, and is outside R96.

Every fact on each surface today is kept. Each one is moved, grouped or put behind a labelled disclosure, never deleted (P13, P19). The P15 records (confirmations, dismissals, corrections) stay visible with Undo.

---

## A. Step 2 (WHAT)

**FLOW.md step and user:** step 2 "What". The user is the rep or estimator on a first pass, asking "What's the job?" (FLOW §3). FLOW §3 says what they can ignore: "everything the system got right". For step 1 it lists "provenance tokens" as ignorable too.

**What reads as noise today** (`today/what-1440.png`):
- **Twelve mono provenance lines,** one under every field. They're built by `clauseFor()` at `components/bands/WhatBand.tsx:185-193` and rendered by the local `Cell` at `WhatBand.tsx:97-178` (and `PlanDetails.tsx:84-135`). Each is a sentence ("OSM · 30 mph · measured", "your change · operator-set from here on"). They're required by rule 137: "a field with no provenance line is a defect" (`issue-289-band-stack/checkpoint.md:335`).
- **Two full-width record bars,** "✓ Confirmed Denver (was Not set). Undo" and "✓ Confirmed Arterial (was Not set). Undo". They sit in `.a-cell-action`, which spans the grid (`app/globals.css:4659`, `grid-column: 1 / -1`), from `JurisdictionSection.tsx:776-805` and `:551-577`. Each breaks the 3-column grid, and at 390 each is its own boxed row with Undo stacked under the sentence (`today/what-390.png`).
- **Two sections with different logic.** "Anything we got wrong?" (`WhatBand.tsx:355`) holds speed/lanes/width, road type/jurisdiction/dates, and Project name/Location description. "The rest of this plan" (`PlanDetails.tsx:222-226`) holds work type/night/speed reduction, one-way/divided, street classification and the Denver windows line (`ScheduleField.tsx:320`, mounted at `PlanDetails.tsx:421`). Road facts are split across the two, and so are job facts.

**Proposed** (`mockups/what-1440.png`, `what-390.png`):
1. **Two groups, named for the user's question:**
   - **THE ROAD:** Speed limit, Lanes per direction, Lane width / Road type, Street classification, One-way or divided?
   - **THE JOB:** Work type, Night operation, Work-zone speed reduction / Jurisdiction, Work dates, Denver windows.
   
   Each group is the existing fixed `repeat(3, minmax(0,1fr))` grid with 6 cells. The Denver windows line becomes a cell beside the dates that it depends on.
2. **One quiet marker per field,** symbol plus word from the fixed vocabulary (P9): `✓ measured`, `✓ yours`, `✓ detected`, `✓ default`, `⚠ inferred` (amber), `◌ not set`.
   - The marker sits in the cell's existing third row, so every cell keeps one shape: label 18 px / field 44 px / marker 18 px (P6).
   - The marker is a button. It opens the full provenance line and the existing "i details" panel in a popover over the page, not inline. Nothing below it moves (P1). The mockup shows Road type's open.
3. **Confirmations inside the field they confirm.** The resolved record becomes that field's marker row: "✓ confirmed Denver · was Not set · Undo". Undo is kept (P15), and the grid is never broken.
   - An unanswered suggestion keeps today's full row with real Confirm/Dismiss buttons (P10). A footer-row text link would be under 44 px at 390.
   - On Confirm or Dismiss the row collapses into the field. That moves the content below up by the row's height. The user asked for it by clicking, but it is a change of layout on answer. **Ruling needed (P1).**
4. **Project name and Location description** move behind "File details · Project name, Location description · ◌ 2 not set · open ›" at the foot of the band. The count says what's inside.
   - Alternative (b): move them to step 5, where the files are named. Recommended against for now: either field changes the PDF title block, so editing them after Generate would need a re-generate (P7, P22). That's a bigger change than R96 asks for.

**Principles (standing check):**

| P | Verdict |
|---|---|
| P1 | Honoured for the marker popover, which overlays. **Deviates, needs a ruling** for the suggestion row collapsing on answer (today a bar of a different height replaces it, so it already moves, but differently). |
| P2 | Honoured: one marker per field; the record lives in the field it's about. |
| P3 | Honoured: the ⚠ inferred field is the only amber thing in the band. |
| P4 | Honoured: markers share the cells' left edge; the record's Undo sits in the marker row. The measure goes in the build's browser leg (label `left` equal across a column, row heights equal). |
| P5 | Honoured: markers are system voice (mono, faint); values are sans. |
| P6 | Honoured: one cell shape everywhere, with no full-width rows inside a group. Risk: "confirmed Denver · was Not set · Undo" is the longest marker and has to fit one track at 1440 (it does, barely, in the mockup). It ellipsizes rather than wrap; the full line is in the popover. |
| P7 | Not applicable: no change to when the plan regenerates. |
| P8 | Not applicable. |
| P9 | Honoured: every marker is symbol + word; ⚠ amber keeps its word "inferred". |
| P10 | The popover button target must be ≥ 44 px at 390 (the visible text is 18 px; the hit box gets padding). The suggestion buttons are unchanged. |
| P11 | Honoured: one marker style for every field, replacing two `Cell` copies (`WhatBand.tsx`, `PlanDetails.tsx`). |
| P12 | The goal of the change. |
| P13 | Honoured: provenance and details on request, labelled. |
| P14 | Honoured: `◌ not set` stays a word. |
| P15 | Honoured: the resolved record and Undo stay visible in the field. |
| P16 | Not applicable. |
| P17 | Serves step 2 for the rep/estimator; the provenance (for whoever audits the job) moves one click away, and is still printed on the audit PDF. |
| P18 | Honoured: the band's one primary action (Generate, below) is unchanged. |
| P19 | Honoured: the default shows values; "how we know" is opt-in. |
| P20 | Honoured: the groups are named for questions ("the road", "the job"), not for where the code keeps the field. |
| P21 | Not applicable. |
| P22 | Not applicable: this is the first pass. The same band in revising mode (`globals.css:4506-4526`) inherits the change, and nothing else there changes. |

**Rule 137 needs a ruling:** does a symbol-and-word marker, with its line one click away, satisfy "every field has a provenance line"? The recommendation is yes, with "the line is one click away and the marker carries its state word" written into rule 137.

**Rule 5 churn (predicted):**
- **Screens:** the WHAT band at both widths. It's 1070 → 672 px tall at 1440 and 2173 → 1550 px at 390 (today's element capture vs the mockup band; `mockups/render.cjs` prints the mockup heights).
- **The revising band:** same change.
- **Frontend tests** that read the text of the lines or bars:
  - "operator-set from here on": 2 files;
  - "· measured": 3;
  - "Confirmed ": 3;
  - `a-cell-action`: 1;
  - "The rest of this plan": 1.
- **No change:** wire fields, backend and PDFs. The audit PDF keeps its provenance.

---

## B. The post-Generate Setup line

**FLOW.md step and user:** step 4 "Look", read by the rep/estimator as "what did I build", and the entry to revision (P22, FLOW §5b: the estimator who comes back to change one thing).

**Today** (`today/setup-1440.png`):
- `ResultsHead.tsx:113-150` renders `setupSegments()` (`lib/scenarios/band-facts.ts:305`) as one sentence of underlined buttons joined by " · ".
- At 1440 it wraps to two lines that break mid-list. At 390 it's 4 lines plus the hint.
- Each value is a `button.a-val-lk` with `data-testid="setup-link-<key>"` and `aria-label="Change <field>: <text>"`, handled at `GeneratorShell.tsx:1028`.

**Proposed** (`mockups/setup-1440.png`, `setup-390.png`):
- A grid of label/value pairs: 4 columns × 2 rows at 1440 and 2 × 4 at 390. The pairs are Work, Road, Length, Speed, Lanes, Road type, City, Dates.
- Every label shares the column's left edge, and every value shares the line under it (P4). Labels are mono caps, faint (system voice); values are sans with today's underline (the user's words, P5).
- **Lane width is kept:** the Lanes cell holds two buttons, "2 × 12 ft". Today's segments are `lanes` and `laneWidth`; each still opens its own staged field (`STAGED_FIELD_OF`, `RevisionBand.tsx:41`).
- **Unchanged:** the hint "pick a value to change it", every click target and the handler.
- A long road name wraps inside its cell (P6); the cell never widens.
- Today's "Not set" for an unconfirmed jurisdiction reads "◌ not set" under CITY. "dates not set" becomes "◌ not set" under DATES.

**Principles:**

| P | Verdict |
|---|---|
| P1 | Honoured: fixed tracks, no reflow when a value changes length. |
| P2 | Honoured: each value appears once here, as today. |
| P3 | Honoured: the hint is kept. |
| P4 | **Honoured, the point of the change:** one left edge per column. |
| P5 | Honoured. |
| P6 | Honoured: the road name wraps in its cell. |
| P7, P8 | Not applicable. |
| P9 | Honoured: unset values get ◌ + "not set". |
| P10 | Each value's hit box stays ≥ 44 px at 390. Today's rule is at `globals.css:2373`; the build keeps it. |
| P11 | Honoured. |
| P12 | Honoured: Ryan's "disorganized and ugly". |
| P13, P14 | Honoured. |
| P15, P16 | Not applicable. |
| P17 | Serves step 4 for the rep/estimator. |
| P18 | Honoured: no primary here. |
| P19 | Honoured. |
| P20 | Honoured: answers "what did I set up?" |
| P21 | Honoured: "City" is the user's word. Today the internal field is `jurisdiction`; the label is the only change, and the aria-label keeps "Change jurisdiction". |
| P22 | **Honoured, unchanged:** each value opens today's staged editor. |

**Rule 5 churn (predicted):**
- `ResultsHead.tsx` markup changes: the " · " separators go, label spans are added, the 4/2-column grid comes in.
- **The grid is taller than today's sentence:** 92 → 164 px at 1440 and 204 → 291 px at 390. That's the cost of the labels and the shared edges. A one-row 8-column variant at 1440 would be about 60 px tall, but it can't hold "East Colfax Avenue Westbound" without wrapping. Recommended: the 4×2.
- Frontend tests: `setup-values` in 1 file and `setup-link-*` in 2. The test IDs are kept, so expect the text assertions to change, not the selectors.
- "dates not set" becomes "◌ not set" and "Not set" becomes "◌ not set": text churn in `setupSegments` tests.
- **No change:** handlers, wire, backend.

---

## C. NEEDS YOU

**FLOW.md step and user:** step 4 "Look", whose question is "what does it want from me?" FLOW §3: they must see "the two or three things that need a human" and can ignore "every check that passed".

**Today** (`today/needsyou-1440.png`):
- **The header count is 1:** `deriveNeedsYou` sets `count = items.length`, ▲ + ⚠ only (`lib/needs-you.ts:102-107`, ruling 185: "the header count is the sum, the decomposition is provenance").
- **Below it, seven condition rows** under "Site conditions: scanned" (`NeedsYouConditions.tsx:387`, rendered by `SiteConditionRows` at `:153`; the sub-header exists to keep the count true, `:363-375`):
  - 2 ▲ detected (Dismiss);
  - 3 ✓ "none along the corridor" (Assert);
  - 2 ◌ "not asserted" (Assert).
- **P2 finding:** sidewalks are stated twice. They appear once as the counted ▲ item "Pedestrian sidewalks present · changed this plan · 6 devices added" (from `site_adjustments`, `lib/needs-you-items.ts:64`, pushed at `:121`), and again as the uncounted ▲ row "Pedestrian sidewalks · detected · 58 found" (from the scan). A count of 1 above three ▲ glyphs reads as disagreeing (P2).
- **P19:** five rows that need nothing render by default.

**Proposed** (`mockups/needsyou-1440.png`, `needsyou-390.png`):
1. **One row per detected condition,** with its effect on the plan in the same row: "▲ Pedestrian sidewalks · detected · 58 found · nearest 54.1 ft / changed this plan · 6 devices added (…) · MUTCD § 6C.02 · OSM · Dismiss". The adjustment item and the scan row become one voice (P2).
   - A detected condition that adds nothing says "advisory · no devices added", with the same Dismiss.
   - The ⚠ attention items (Colorado FAILs, scan NOT-CHECKED, corridor, geometry, approaches) are unchanged and stay counted.
2. **The header count is what's listed:** ▲ detected or changed, plus ⚠. That's 2 on this pin. The sub-line says so in words: "2 detected · changed the plan or waiting on your word".
3. **The rest collapse into one labelled count:** "✓ 3 none found · ◌ 2 not asserted · show 5 ›". Opened, these are today's rows with today's Assert actions, unchanged (P13, P19). Nothing is deleted.
4. **Unchanged:**
   - staging, and "Apply N corrections" (P7);
   - the corridor-scan line;
   - Dismiss's reason picker.
   
   An applied correction (dismiss or assert) stays in the main list as its record with Undo (P15), and counts.

**Rulings needed:**
- **Ruling 185** (the count is ▲ + ⚠). The proposal keeps "the count is the sum of what's listed", but merging the scan's ▲ rows into the counted list makes detected conditions count. Today they don't. On this pin the count goes 1 → 2.
- **Ruling 186** ("always expanded"). The ▲/⚠ list stays always expanded. Only the uncounted ✓/◌ rows fold, which R96's own direction asks for. Recorded so the two don't read as conflicting.
- **The merge key.** A site adjustment and a scan bucket name the same condition through `flagToBucket` (`TieredReference.tsx:229`). A manual-asserted flag has no scan row, so it renders as today's ▲ adjustment item. A detected condition that fired no adjustment (intersection, advisory) renders as its scan row. This is presentation only. **Rule 3 holds:** the frontend joins two wire facts it already has, and computes no value.

**Principles:**

| P | Verdict |
|---|---|
| P1 | The fold opens downward on click (user-asked). Nothing else moves. |
| P2 | **Fixed:** one row per condition, and the count equals the rows above the fold. |
| P3 | Honoured: Dismiss sits on the row it's about. |
| P4 | Honoured: one right edge for every action, as today (`NeedsYou.tsx:117-160`). |
| P5 | Honoured. |
| P6 | Honoured: two-line subs wrap in the body track; the action column stays fixed. |
| P7 | **Honoured, unchanged:** staging and Apply. |
| P8 | Not applicable. |
| P9 | Honoured: ▲ / ✓ / ◌ / × each with a word. |
| P10 | Honoured: 44 px buttons at 390, as in the mockup. |
| P11 | Honoured. |
| P12 | Honoured: "feels pretty long on the page". At 1440 the default block drops from 8 rows (1 item + 7 conditions) to 2 rows + fold + footers: 838 → 344 px tall at 1440, 1380 → 496 px at 390. |
| P13 | Honoured. |
| P14 | Honoured: when nothing's detected the block shows "0" and the fold, never a blank. Today it returns null when the count is 0 and there are no conditions (`NeedsYou.tsx:78`); that's kept. |
| P15 | **Honoured:** records stay in the main list with Undo. |
| P16 | Not applicable. |
| P17 | Serves step 4 for the rep/estimator. |
| P18 | Honoured. |
| P19 | **Fixed:** what passed is a labelled count. |
| P20 | Honoured: answers "what needs me". |
| P21 | Not applicable. |
| P22 | Honoured: Assert/Dismiss staging is today's revision template, unchanged. |

**Rule 5 churn (predicted):**
- **On screen:** the count changes on any plan with a detected scan condition, and the sidewalk row merges. Five rows fold by default.
- **Frontend tests:**
  - "none along the corridor": 5 files;
  - "Site conditions: scanned": 1;
  - `ny-count`: 2;
  - plus `GeneratorShell.needs-you.test.tsx`;
  - the `deriveNeedsYou` / `buildNeedsYouItems` tests in `lib/`.
- **No change:** backend and wire. The audit PDF's section 03 is unaffected (separate surface: `TieredReference`).

---

## Summary of what Ryan rules

1. **WHAT:** the two groups, markers with a popover, records in the field, and File details behind a disclosure. Plus the P1 call on the suggestion row collapsing on answer, and rule 137's reading.
2. **Setup line:** the 4×2 / 2×4 grid, "City" as the label, "◌ not set" for unset values.
3. **NEEDS YOU:** the merged rows, the count read under ruling 185, and the fold.

Each builds on its own branch after the ruling, in the order Ryan picks. Suggested order: C (NEEDS YOU: the P2 fix is an honesty rule) → A → B.


---

## Build C (NEEDS YOU), branch `declutter-c-needs-you`: outcome against the prediction

Built as mocked up, under R99 and R101.

**What changed:**
- `lib/needs-you-conditions.ts` (new) classifies the condition rows once. The block renders exactly those rows, and the shell counts exactly the listed ones.
- `mergeConditions` folds a site adjustment into the listed row of its flag. Its counts ("changed this plan · 6 devices added", or "no devices added") and its citation come from the record.
- `SiteConditionRows` renders listed rows, then the fold ("✓ 3 none found · ◌ 2 not asserted", with a Show N / Hide toggle, `data-read`, live under the lock), then Apply and the scan line, unchanged. The "Site conditions: scanned" sub-header is retired.

**Browser leg** (local dev server on this branch against the prod backend, same capture rig, E Colfax): `build-c/needsyou-{1440,390}.png` (default) and `-open.png`.
- The header reads **2** with "· 2 site conditions".
- The intersection row reads "detected · 39 found · nearest 56.1 ft / no devices added", cited "MUTCD § 6N.12 p. 848 · OPENSTREETMAP".
- The sidewalk row reads "changed this plan · 6 devices added", cited "MUTCD § 6C.02 · OPENSTREETMAP".
- There is no separate "Pedestrian sidewalks present" item.

**Tests:**
- New: `lib/needs-you-conditions.test.ts` (6, red first: the module didn't exist).
- New in `GeneratorShell.needs-you.test.tsx`: "R99: the header count equals the rows listed…" and "R99: a detected condition and the adjustment it caused are ONE row". Both are red against the pre-change components (`2 failed`) and green after.
- Frontend total: 188 files, 1945 passed; `tsc` clean.

**Churn as predicted:** the condition-row tests in `NeedsYouConditions.test.tsx`, `GeneratorShell.needs-you.test.tsx` and `GeneratorShell.batch-corrections.test.tsx`, plus the "none along the corridor" lookups. Those suites now open the fold first, in their mount/generate helper. The sub-header test is replaced by the R99 count test.

**Misses** (not named in the prediction):
1. `WorkingBand.test.tsx` and `WriteLock.test.tsx` reach "School zone", a none-found row, so they open the fold too. The in-flight test's button list gains "Hide", which is a live read: every write is still disabled under the lock.
2. **A behaviour change I didn't predict.** `derivePrimaryOwner` (`GeneratorShell.tsx`) reads this count. A plan whose only listed thing is an advisory detection (no devices added, no ▲/⚠ item) counted 0 before, so the downloads owned the page's one primary action. It now counts 1, so NEEDS YOU's Apply/actions own it. This follows from R99's count, but it's a change in which button is primary. **Flagged for Ryan.**

---

## R103 on C: the primary follows consequence, not the header count

- `lib/needs-you-conditions.ts` `primaryCount()` feeds `derivePrimaryOwner`. It counts:
  - every ▲ / ⚠ item;
  - a staged intent;
  - a listed condition whose adjustment record added or modified devices;
  - an applied dismissal.
- An all-advisory block leaves the primary with the downloads. The header still counts every listed row (R99).
- **Assumption, flagged:** an applied dismissal counts. The wire no longer carries what the dismissed condition had added, so it isn't guessed advisory.
- **Tests:**
  - `needs-you-conditions.test.ts` gains 5 primaryCount cases (red: the function didn't exist).
  - `GeneratorShell.primary.test.tsx` gains "R103: an advisory-only detection is listed and counted, but the zip keeps the primary". It was red before the wiring, because NEEDS YOU owned the primary.
  - Frontend on C: 188 files, 1951 passed.
- This resolves build C's flagged miss 2.
