# cc-prompt: UX group 5: the reference sections, one row style and a search box

Ryan ruled this on 2026-11-04: **Option A** on the "Tool page: reference sections" design canvas, **plus the search box**. Search counts **nicknames**. **No clickable numbers**: "Your plan" stays as it is, so the bottom-row artboards `NumbersBefore` and `NumbersAfter` are out.

Design reference: https://claude.ai/artifact/5oCaxQNabD963XWD1aac7j. Use the artboards `OptionA.dc.html`, `SearchIdle`, `SearchSidewalk`, `Search6B` and `SearchNone`. `Main.dc.html` shows today's sections.

The sections are the three below the results: "Checked and passed", "Not checked yet" and "Denver rules and site facts". This builds on #437/#438 (the results stack) and keeps group 1's spacing and text rules.

Mission rules for the Platform UI arc:
- Investigate first, then commit `rulings.md` (the "Rulings" section below, verbatim and dated) and `checkpoint.md`.
- Stop only for something on the park list. Record every other call you make.
- File the issue yourself (R146).
- Before the ship go, do a local walk with Overpass stubbed and commit crops for Ryan's hand check.

## Why

Ryan's review, screenshots 17–23:
- The three sections each look different, and some nest three or four levels deep.
- The sentences use small mono text.
- Finding one fact, such as "what's the fine" or "where did the taper come from", means opening sections at random.

## Rulings (quote verbatim into rulings.md)

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

## Out of scope

"Your plan", the NEEDS YOU strip and questions (#437/#438), the downloads, the Generate wait state (group 6) and the WHAT band (group 7).

## Investigate first

1. Today's components for the three sections: where each row's text comes from, and how deep each one nests now.
2. Ruling 5's traces, plus the "Show N more" split in ruling 4.
3. Where the searchable text lives on the page (rendered DOM or the data behind it), so search covers closed rows without rendering everything open.
4. The Rule 5 churn prediction, and P1–P22 for the changed surfaces (P2: one voice per fact; P19: the 80% default view).

## Evidence

Run locally with Overpass stubbed, at 1440 and 390:
- The three sections as they open by default, plus one opened row from each.
- The search states: idle, "sidewalk" (with a match inside a closed row), "6B" (source matches), "cone" (nickname), and "flagger" (none found, with a chip tapped).
- Escape restoring the open or closed state.

Also run axe and measure the 44 px targets. Commit the crops for Ryan's hand check.
