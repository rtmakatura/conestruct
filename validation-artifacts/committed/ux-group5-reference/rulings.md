# #443 UX group 5 — the reference sections: rulings

## Ryan's rulings (2026-11-04, Option A on the "Tool page: reference sections" canvas, plus the search box), verbatim

Design reference: https://claude.ai/artifact/5oCaxQNabD963XWD1aac7j. Prompt: `cc-prompt-ux-group5-reference.md`.

1. **One row style everywhere in the three sections.** Each row is at least 48 px, laid out as glyph, title, result, then Show/Hide on the right. The glyphs are ✓ pass, ◌ not checked, ▲ action taken, ⚠ keep in mind, and i info, and each uses its existing token. Group labels inside a section, such as CALCULATIONS, RULE CHECKS, DENVER RULES, PERMIT HOURS AND FINES, ALONG THE ROAD and DEVICES, are mono 10 caps, the only mono in these sections.
2. **Two levels at most:** a row, then its opened detail. Nothing inside a detail opens again. Content that sits deeper today is flattened into the detail: a short plain sentence (Inter 13.5 `--ink-on-dark`), then label–value rows (values in mono where they are numbers), then one "Source: …" line (Inter 12.5 `--ink-faint`). The taper detail in `OptionA` is the model.
3. **Section headers** show glyph, name, a short summary, and Show/Hide. Use the mock-up's summaries: "15 checks, each cited", "2 items for the TCS" and "For reference, never blocks the plan". Every count comes from the wire (Rule 12). Keep the default open or closed state each section has today, and record it.
4. **"Checked and passed" shows its first rows, then "Show N more checks".** Trace today's split and record N.
5. **Copy:** the row titles and results in `OptionA` are examples. Trace each one to the backend field it reads, then reword or drop any that don't hold, and list every string with its source. The frontend computes nothing (Rule 3).
6. **Search box**, above the three sections:
   - The label is "SEARCH THE DETAILS" (mono 10 caps). The placeholder is "A number, a rule or a word: taper, 6B, sidewalk, $500". The box is 48 px tall, with a × to clear it (44 px).
   - It searches all three sections, open or closed, including the text inside closed rows: titles, results, detail sentences, values, sources and device lines.
   - Matching ignores case and matches part of a word. It runs on the page as you type, with no backend call.
   - **Nicknames count:** "cone" finds channelizing devices and "sign" finds sign codes (e.g. R9-9). Keep the list in one small table, with each entry tied to a term that really appears on the page, and record the list.
7. **When search finds something:**
   - A status line under the box gives the count, e.g. "3 matching lines, all in Denver rules and site facts" (aria-live).
   - Sections with matches open and show only their matching lines, with "N of M lines match" in the header.
   - Sections with no matches dim and say "No matches".
   - Matched text gets `<mark>` with background `#294056` and `box-shadow: inset 0 -2px 0 var(--act)`. `#294056` is a new hex, so check it against the ink-literals gate. If an existing token is close enough, use the token and record it. Otherwise add a token and say why.
   - When the match is inside a closed row, that row opens and says "Opened because the match is inside." A long list inside it shows only its matching lines ("2 of 11 device types shown") with "Show all 11 types".
   - When the match is in a source, the row shows its "Source: …" line under the title (`Search6B`).
8. **When search finds nothing** (`SearchNone`):
   - It says "Nothing in this plan's details mentions "<term>"", followed by "Search looks through this plan's checks, sources and Denver rules. It doesn't search the whole MUTCD."
   - It shows "Words that are in this plan:" as 44 px chips, taken from the plan's own content. Trace how the chips are picked and record it.
   - It ends with "Clear search and show everything".
9. **Clearing** (×, Escape, or an emptied box) puts every section and row back to the open or closed state it had before the search started (P15).
10. **Out:** clickable numbers in "Your plan". Leave that band as it is.
11. Follow group 1's spacing and text rules: 44 px targets, only the ruled sizes, no new hex beyond ruling 7's mark (and that only if it's needed), and unslop copy. Use axe on the search states.

## R145 self-ruled calls (#443)

- **X1, a "line" is one row.** Ruling 7's status count and "N of M lines match" both count rows, so the two numbers can't disagree. `SearchSidewalk` says "3 matching lines" and "2 of 9" for the same state; `Search6B` says 3 and 3 of 15. The sub-count inside a row is its own phrase ("2 of 11 device types shown").
- **X2, default state.** Today all three are closed (`ResultsDisclosures.tsx` `defaultOpen = false`; `ReferenceDisclosure` `defaultOpen` only on an audit error, `GeneratorShell.tsx:2416`). Kept. `OptionA` draws them open only to show them; `SearchIdle` draws them closed. A failed audit still opens the third section (Rule 10), and a failed device breakdown still opens its row (was `autoExpand`, `DeviceBreakdown.tsx:115`).
- **X3, ruling 4's split.** Today has no split: every check draws. New rule: all of CALCULATIONS, then the first 2 of RULE CHECKS, then "Show N more checks". N = rows − shown. At the mock's 15: 5 + 2, N = 8, matching `OptionA`. N is computed from the rows, never written.
- **X4, where search reads.** A plain data model (`lib/reference-sections` builds it from `deriveTierSources`), not the DOM. Closed rows stay unmounted (rule 32's reasoning, `DisclosureRow.tsx`), and search reads the same strings the rows draw, so a hit can't name text the page wouldn't show.
- **X5, the mark.** `#294056` is the existing token `--raise-hi` (`globals.css:861`). Used; no new hex. The ink-literals gate doesn't move.
- **X6, summaries.** "N checks, each cited" (`ledger.checked`; "each cited" only when the audit didn't fail, as today), "N items for the TCS" (`ledger.pending`, singular "1 item"), "For reference, never blocks the plan" (no count). Section 3's name is `${jur.name} rules and site facts`, or "Site facts" with no jurisdiction (Rule 10).
- **X7, mono.** Ruling 1 says group labels are "the only mono"; ruling 2 and `OptionA` put numeric values in mono. Read together: the only mono *text*; numeric results and values stay mono.
- **X8, "Fines: 2 apply here" doesn't hold.** `lib/tiering.ts:206-208`: hazard meters "describe the jurisdiction, not this plan". Reworded to "2 on record, worst $500 / day". Title "Fines and hazards", since a hazard chip need not carry a meter.
- **X9, "(who prepares the plan, police at signals, steel plates)" dropped.** Those topic words aren't on the wire. The row reads "N rules to keep in mind"; the detail lists each rule's own `rule` text and source.
- **X10, formula lines.** `formula_text` is one wire string per line. `OptionA`'s labels "Width / Full taper / Shoulder taper" aren't on the wire, and adding a field would move every recorded baseline. The label is the wire's own symbol left of the first " = " ("W" | "10 ft (assumed)"); a line with no " = " draws value-only. Same split on `result_text` for the row's result ("L/3 = 50 ft" reads "50 ft"), and the full string stays searchable in the detail. A display split only, no arithmetic (Rule 3).
- **X11, shown titles.** `ItemSpec.title` stays (NEEDS YOU reads it). The rows map it: "Taper length calculation" → "Taper length", "Buffer space calculation" → "Buffer space", "Channelizing device spacing" → "Device spacing", "Advance warning sign set" → "Warning signs", `TA-x · S-630-1 reference` → "Standard plan". The mock's reworded "Case 11, shoulder closure on a divided highway" isn't used: the result is the wire's `case_id` verbatim.
- **X12, row text.** The mock's short "added 2 barricades and 2 SIDEWALK CLOSED signs" isn't on the wire: the result is the backend's `rec.action` or the panel's `SITE_ADJUSTMENT_DETAIL` text, verbatim. Long ones wrap.
- **X13, group placement.** DENVER RULES: fired, conditional and admin deltas, personnel and device chips. PERMIT, HOURS AND FINES (the mock's comma): fines double, hazards, work hours, permit. ALONG THE ROAD: site adjustments, corridor, scan, geometry, signalized approaches, measured buckets, moot corrections. DEVICES: device schedule, zone geometry. **Sidewalks moved from the mock's DENVER RULES to ALONG THE ROAD:** its source is MUTCD § 6C.02 from the site scan, not a Denver rule (Rule 12).
- **X14, measured buckets.** Absent keyless buckets merge into one row, "No railroad crossings, hospitals or road curvature", joined from the wire's buckets and `SCAN_REFERENCE_LABELS`; the mock's "sharp curves" isn't the label. A detected bucket keeps its own row.
- **X15, work hours.** The 24 h band chart stays inside the row's detail, extracted unchanged (#215): it opens nothing, and it's the only drawing of the windows. Text pairs for each scope's windows are added so search can read them.
- **X16, fee lines.** All fee lines draw, as a filterable list. Today `fees.items.slice(0, 6)` hides the rest while the summary counts all (Rule 10; "$500" must be findable). Behaviour change, stated.
- **X17, actions stay inside details.** Signposts ("Correct in setup ↑"), tracking links, the CDOT PDF link, Retry and the declined banner. They navigate or recover; none opens another level. Audit failure's Retry draws at the top of section 3, outside any row.
- **X18, chips (ruling 8).** Fixed candidates in order: taper, buffer, sidewalk, work hours, fines, permit, spacing, signs. Each is kept only if searching it hits the current plan; first 5 kept. So every chip is tied to this plan's content, and tapping one always finds something.
- **X19, nicknames (ruling 6).** One table, `lib/reference-nicknames.ts`: cone, barrel, tube → "channelizing"; sign → the sign-code pattern (R9-9, G20-5P); barricade → "Type III"; bike → "bicycle"; ped → "pedestrian"; ticket, penalty → "fine"; hours → "window"; fee, cost → "permit". A test ties each to a term on a real audit fixture or a wire-string source; entries with no hit are removed and recorded. "flagger" gets no nickname, so `SearchNone` holds on a shoulder plan.
- **X20, opening under search.** A match in a sentence, value or list opens the row with "Opened because the match is inside." A match only in the title or result leaves the row closed. A match only in the source leaves it closed and shows the source line (`Search6B`). Stored open state isn't touched during a search; the search state overlays it, so clearing restores it exactly (ruling 9, P15).
- **X21, glyphs.** ✓ passed, ◌ not checked, ▲ changed the plan, ⚠ keep in mind, i info. `CheckRow`'s "!", "✕", "ℹ" don't draw here. A failing Colorado check or a geometry error takes ⚠ with its words, in `--fail` ink as today.
- **X22, "See the pending-verification disclosure."** `SITE_ADJUSTMENT_DETAIL`'s two actions name a section that's no longer called that. Reworded to `See "Not checked yet".`
