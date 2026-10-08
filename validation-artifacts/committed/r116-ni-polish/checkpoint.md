# 📋 R116 checkpoint: three near-intersection rough edges

Branch `r116-ni-polish`, off main `4c1a324` (live on prod). No code. R116 is quoted verbatim in `rulings.md`.

**How the screenshots were made:**
- **"Before"** is a local build of `4c1a324` (the code prod serves), driven by `capture_r116.cjs`. The plan is a near-intersection lane closure on N Broadway SB with the pin at 39.73370, −104.98753, Denver guessed from the pin, 500 ft of work, and the cross street marked at E 12th Ave. Prod's headless browser can't load the occupied-side choices, and E 11th Ave sits about 120 ft downstream of the pin, inside any work zone long enough for the 180 ft taper at 30 mph. That's why the cross street is E 12th.
- **"After" for items 1 and 2** is a **mock**: the proposed markup is written into the live page with the page's own classes, so it renders with the real CSS. No code changed.
- **"After" for item 3** is a **prototype**: the proposed change was applied to a scratch copy of `plan_sheet.py` outside the repo. `pdf/prototype-plan_sheet.diff` shows the change; it is not on this branch.

---

## Item 1: the NEEDS YOU jurisdiction row

| | 1440 | 390 |
|---|---|---|
| before | `shots/ny-1440-before.png` | `shots/ny-390-before.png` |
| after (mock) | `shots/ny-1440-after.png` | `shots/ny-390-after.png` |

Before, at 1440: the title reads "add_device / 1 / arrow_board", Denver's whole rule sentence runs across the top as the citation, and the detail wraps one word per line.

### Why

R116's guess was a row type the R99/R103 redesign never styled. The cause is different: the row is the same component and CSS as every other NEEDS YOU row (`.ny-item` / `.ny-mid` / `.ny-right`, rules 74 and 76 of the #288 spec). What breaks it is the content it puts there:
- **Title.** `deltaTitle` (`conestruct/site/lib/needs-you-items.ts:40-46`) joins the raw effect keys, giving `"add_device 1 arrow_board"`.
- **Citation.** It is `d.rule` (`needs-you-items.ts:58`), Denver's whole rule sentence, about 130 characters, em dash included: `data/jurisdictions/denver.json:55`, "Arrow board required if closing one or more lanes — Denver's trigger is >=1 lane (vs. Colorado Springs' 4+-lane roadway rule)." Every other row cites a short string like "MUTCD § 6F.61".
- **The layout.** `.ny-cite` is `white-space: nowrap` (`globals.css:3859-3866`, `da089bf`, 2026-09-23) in an `auto` track, so the sentence takes the full width. The `minmax(0,1fr)` middle track collapses to about 0, which wraps the title and detail one word per line and pushes the text over the citation.
- **The test.** It passed because its fixture is made up: `lib/needs-you-items.test.ts:37-82` uses `rule: "MUTCD § 6C.02"`, where the real wire sends a sentence. Line 66 pins the raw title `"add 2 cones"`.

**Why it's common now.** Since R108 (`477c951`) prefills Denver from the pin, and `_jurisdiction_eval` (`src/api/render_api.py:1692-1705`) runs whenever `jurisdiction_key` is set, every Denver lane-closure plan shows this row with no action from the operator. Before R108 it only appeared after the operator picked Denver.

### What it should say, and two things the row gets wrong besides layout

- **"Added" would be false.** The near-intersection layout already places an arrow board (`src/generation/layout.py`, step 3). `apply_count_deltas_structured` (`src/rules/jurisdiction.py:715-720`) raises the count to `max(quantity, qty)`, so on this plan it changes nothing: Denver makes the existing board required. "Arrow board required" is the true title (Q1a).
- **"Changed this plan" overclaims.** The row says "changed this plan" and is counted as "1 changed this plan" in the NEEDS YOU header. The results card says "54 on the plan sheet · incl. +1 jurisdiction-required" (`shots/results-1440-before.png`, the whole results page from the same flow on the same build). On this plan the delta raised no count, so both overstate (Rule 10). The backend doesn't say whether a delta raised a count, so the frontend can't tell (Q1b).

### Proposed fix

1. **Backend (Rule 3: it owns the words and the fact).** `evaluate()` (`src/rules/jurisdiction.py:547-553`) adds two fields to each delta:
   - the device's display name, from the existing `_display_name` / `_JURISDICTION_DEVICE_DISPLAY` (`jurisdiction.py:629-649`, today used only for the breakdown and XLSX);
   - `raised: bool`, whether the delta changed a count.
2. **`needs-you-items.ts`.**
   - **Title:** "{Device} required" when nothing was raised, "{Device} added" when a count was raised, "Swapped to {device}" for a swap.
   - **Detail, one line:** a short sentence, e.g. "Denver requires one on any lane closure · the plan already places it".
   - **Citation:** `source.doc` (+ `§section` when present), e.g. "DOTI PT-116.1".
   - **Never a raw key.** No fallback joins `op`/`device`. An op or admin delta with no `note` needs a ruled title (Q1c).
   - The row counts as "changed this plan" only when `raised`.
3. **Other places raw keys reach the UI:**
   - `components/JurisdictionSection.tsx:274` (`DeltaRowView`) prints a swap's unit as the raw device key (e.g. `lighted_barricade`); it uses the same label.
   - `JurisdictionSection.tsx:293` shows `{d.rule}` as body text in Plan reference (`TieredReference.tsx:326-329, 392-395, 546-549`). That's the em dash again (Q1d).
4. **Tests (Rule 11):** replace the made-up fixture with the real Denver delta, and add a mounted NEEDS YOU test that asserts no `_`-joined keys appear, the citation is short, and the title is "Arrow board required".

**Rule 5:**
- Every Denver lane-closure plan's NEEDS YOU row changes as shown.
- Where nothing was raised, the header count drops from "1 changed this plan" to 0 and the "+1 jurisdiction-required" clause goes, which follows Q1b. If nothing in NEEDS YOU then changed the plan, R103's primary-button rule moves the primary action off NEEDS YOU on those plans.
- The audit JSON gains two fields per delta, so every recorded baseline with deltas moves, the same table-hygiene rule as before.
- No PDF change.

---

## Item 2: the block under "Work zone length (ft)"

| | 1440 | 390 |
|---|---|---|
| before | `shots/extent-1440-before.png` | `shots/extent-390-before.png` |
| option A, rows removed (mock) | `shots/extent-1440-A.png` | `shots/extent-390-A.png` |
| option B, WHAT-style row (mock, popover closed / open) | `shots/extent-1440-B.png`, `shots/extent-1440-B-open.png` | `shots/extent-390-B.png`, `shots/extent-390-B-open.png` |

### When it shipped, and where it shows

- **Shipped `b5de343`, 2026-09-22**, "feat: the band stack replaces the setup panel -- S1-S3, the first visible ship" (Refs #289). The rows moved over from the retired sidebar corridor bar (#227).
- **Later changes:**
  - `17b419b` (2026-09-23) added "corridor lengths wait on the kind of work".
  - `4e86722` (2026-09-23) dropped the block's header and border, so the rows became provenance lines. That's #289 fidelity Q3, ruled "Q3 as recommended — the corridor rows become provenance under the extent field, block header and border gone" (`issue-289-band-stack/rulings.md:456`).
  - `659d800` (#290) added the occupied-side note.
  - `b40cd51` (#301 piece 2) removed the picker's own per-zone rows under #301 ruling 7, "the audit is the one speaker; the modal's per-zone length rows go" (`issue-301-band-aerial/rulings.md:143`). That left this block as the only pre-Generate place the corridor lengths appear.
  - R107 (`477c951`) put WHAT in two columns and left this cell alone, which is why it now looks unlike its neighbours.
- **Code:** `conestruct/site/components/bands/WhereBand.tsx:584-656` (the line at 606, the rows at 627-655) and `globals.css:5079-5085` (`.a-extent`). It's a bare 260 px column, not a `FieldCell`.
- **Kinds:** all of them. Nothing in it depends on the kind. It lives in the WHERE band.
- **When the five rows show:** only when the kind is confirmed, a side is given, the length is above 0, and the audit has returned `sections.corridor_spec` (`GeneratorShell.tsx:1542-1544`). Confirming closes WHERE, so the rows only appear when WHERE is reopened afterwards, through its CHANGE link or the Setup box's Length cell. That's likely why Ryan hasn't seen them.
- **Rule 3 is clean:** the four lengths come from the backend (`src/api/audit.py:1617-1623`), and the fifth is the typed length.
- **On near-intersection it's also incomplete:** `corridor_spec` is the mainline only. The cross-street approaches come back separately (`audit.py:1625-1628`), and this block never shows them.

### The options (mocked)

- **(A) Remove the rows.** The extent becomes one WHAT-style row (label, marker "✓ yours", input) with nothing under it. **Cost:** nothing on screen shows the corridor lengths before Generate, which reverses #301 ruling 7's "one speaker". It changes `GeneratorSidebar.corridor-bar.test.tsx:156-180` and `GeneratorShell.kind-confirm.test.tsx:307-308, 326-327`.
- **(B) Tidy it to match the WHAT band** *(recommended)*. The extent becomes a `FieldCell` row inside `.a-cols > .a-col`, with the WHAT band's label track, marker and input. The five lengths move into the marker's popover:
  - "your answer · the extent the plan is built for";
  - "Corridor at this length", then the five rows, with the same text and `zone-*` test ids;
  - on near-intersection, "the cross-street approaches lay out separately".

  Before the kind is set, the popover carries the single "wait on …" note instead. It keeps #301 ruling 7's one speaker and matches the WHAT band (P2, P4). The test change is that `corridor-bar` opens `info-toggle-worklen` first; the popover stays mounted, so the test ids survive.
- **(B′) A variant of B.** The extent row as in B, with the lengths moved into the aerial's existing zone legend (`BandAerial.tsx:219-240`, which already lists the five names without lengths), so the names aren't listed twice in WHERE. Not mocked; ask if you want it.

**P1–P22:** WHERE band, FLOW step 1, the estimator. B and B′ add no row and move nothing after load (P1). One control per fact (P2). The row aligns with WHAT's rows (P4). Popover detail behind a marker is R98's pattern.

---

## Item 3: PDF page 1, NOTES & SIGN SCHEDULE

| plan | before | after (prototype) | variant B (prototype) |
|---|---|---|---|
| near-intersection, Broadway one-way | `pdf/ni_oneway_before.png` | `pdf/ni_oneway_after.png` | `pdf/ni_oneway_variantB.png` |
| near-intersection, two-way | `pdf/ni_twoway_before.png` | `pdf/ni_twoway_after.png` | |
| shoulder (control) | `pdf/shoulder_before.png` | `pdf/shoulder_after.png` (pixel-identical) | |
| Case 27 stepped (two-column table) | `pdf/case27_stepped_before.png` | `pdf/case27_stepped_after.png` | `pdf/case27_stepped_variantB.png` |

### Why

The box is over capacity on **every** near-intersection plan, and two bugs make it worse. All refs are in `src/rendering/plan_sheet.py`.

1. **Titles sit 6 pt above the next line in tiers 1 and 2.** `section_header` draws the title at `y - 4` and then drops `section_header_pad[1]` (3134-3135). That's 10 in tiers 1 and 2 (2840, 2849), leaving a 6 pt gap. Measured: "PARAMETERS" sits 0.9 pt above the top of "Speed limit"; the shoulder plan, in tier 0, has 2.9 pt. The fine-print footer lines step 6 pt under 6.5 pt bold, so they touch too.
2. **The tier counts fixed note lines as advance rows.** `extra_note_lines` adds 5 on near-intersection plans and 2 for the rightmost-lane note (3095-3101). Broadway's 4-row advance table therefore reads as 11, which lands in tier 2 with `two_col_advance` (2846-2853). The 4 rows are split into two columns, and each column draws its own CODE/DESCRIPTION/DISTANCE header. That's the doubled header.
3. **The overflow loop then cuts every row.** In two columns, cutting a row frees no space, because the "+N MORE" line costs the same row pitch (3436-3448). Only a cap of 0 fits. Page 1 prints the doubled header over **no rows** and "+4 MORE ADVANCE SIGNS…". The four cut signs are W4-2R 100 ft, W20-5R 200 ft, R2-10 250 ft and W20-1 300 ft.
4. **Not caused by R114.** One-way and two-way render the same box, and so do the work-start + Denver variants.

### The proposed fix (prototyped, `pdf/prototype-plan_sheet.diff`)

a. **Rhythm:** at least 8 pt from every title to the next line, in every tier, and a 7 pt pitch for the bold footer lines.
b. **Tier from list rows only:** stop adding `extra_note_lines`. Use two columns only for more than 6 advance rows, so a 4-row table never splits.
c. **Never an empty table:** when the cap reaches 0, one line names the cut codes: "4 ADVANCE SIGNS OFF-PAGE (W4-2R, W20-5R, R2-10, W20-1). SEE CREW NARRATIVE & DEVICE LIST". Two-column cuts go two rows at a time.
d. **Make room on near-intersection plans:** fold the three oblique plate-departure lines into the bold line: "…CASES 18/19: NOT DRAWN. PLATE DEPARTURES: SEE AUDIT. SEE DEVICE LIST, CREW NARRATIVE, AND AUDIT." The audit carries all three departures (`src/api/audit.py:1264-1285`). The rightmost-lane note stays.

Measured on the prototype (`pdf/measure_before.json` / `measure_after.json`):

| plan | min line gap before → after | advance rows drawn before → after |
|---|---|---|
| near-intersection Broadway (one-way and two-way) | −0.3 pt (touching) → 1.9 pt | 0 of 4 (empty table) → the one line naming all 4 |
| shoulder | 1.7 → 1.7 (pixel-identical) | 3 of 3 → 3 of 3 |
| Case 27 stepped | −0.3 → 0.9 | 4 of 8 → **2 of 8** |

Nothing exceeds the box in any render.

**What the fix doesn't do, and costs:**
- **Broadway still prints no advance rows.** After the fix the box has 13 pt to spare, and drawing all 4 rows in one column needs about 45 pt more than the one line. The honest one-line summary is the outcome, not a fallback.
- **Variant B** keeps the tighter tier spacing (fixed note lines still count toward the spacing tier, but not toward two columns). Broadway then draws 2 of 4 rows plus "+2 MORE ADVANCE SIGNS", and Case 27 stays at 4 of 8. The footer lines sit at the 7 pt minimum.
- **Case 27 loses 2 of its 4 drawn advance rows** under the fix as prototyped. The extra rhythm costs about 8 pt. Variant B avoids that.
- **Two-way near-intersection sheets change.** The fine-print line that differed between one-way and two-way (departure (2)) is folded into "PLATE DEPARTURES: SEE AUDIT", so R112's "two-way stays byte-identical" would not hold for page 1's notes. This would be a stated behavior change. `tests/test_r114_one_way_near_intersection.py:261` and `tests/test_near_intersection_voice.py:333-341` assert the fine print and would change with it.
- **Tests that pin the box:**
  - `tests/test_rules.py:1041` (the tier pads), `:1070` (a stale hand-written cursor simulation) and `:1135` (Case 27 two-column).
  - `tests/test_pdf_containment.py:212` holds `adv-near-intersection` at zero collisions, but its detector only sees same-line overlaps and **misses this vertical touching**. The fix adds a vertical-clearance check (Rule 11).

---

## Questions to rule

- **Q1a:** title the row "Arrow board required" where the board is already in the layout ("added" only when a count was raised)? *Recommend yes.*
- **Q1b:** the backend records whether each delta raised a count, and a row counts as "changed this plan", and in "+N jurisdiction-required", only when it did? *Recommend yes.*
- **Q1c:** the title for an op or admin delta with no `note`. *Recommend* "{Jurisdiction} work-method rule", with the detail line from the rule's first clause.
- **Q1d:** the em dash lives in jurisdiction data (`denver.json:55` and possibly other files), which is sourced text the UI quotes in Plan reference.
  - *Recommend:* leave the data as sourced. NEEDS YOU stops showing the sentence (Q1 fix), and Plan reference keeps quoting it as a source.
  - Alternative: reword the data under the unslop rule, which changes what the source file says.
- **Q2:** (B) the WHAT-style row with lengths in its popover *(recommended)*, (B′) the lengths in the aerial legend, or (A) remove the lengths, reversing #301 ruling 7?
- **Q3a:** on Broadway, one line naming all 4 cut codes (the fix as prototyped), or variant B's 2 rows + "+2 MORE"? *Recommend the prototype:* clean, names every sign, and the distances are in the device list and crew narrative. Variant B is the alternative if you'd rather keep rows and Case 27's 4.
- **Q3b:** fold the three plate-departure lines into "PLATE DEPARTURES: SEE AUDIT", accepting that two-way near-intersection page-1 notes change? *Recommend yes.*
- **Q3c:** under the prototype, accept Case 27's advance rows going from 4 drawn to 2, or keep tier 2's spacing for two-column tables only? *Recommend the latter:* gate the extra rhythm to one-column layouts.

Order once ruled: item 1, then 3, then 2, one branch each. Item 1 touches the backend's delta shape, item 3 the PDF, and item 2 frontend only.
