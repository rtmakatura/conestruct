# cc-prompt: UX group 5 details: clean the inside of every opened row

Ryan ruled these on 2026-11-06 as rulings 5–7 of the group 5 follow-up. #450 was built from an earlier copy of that prompt and shipped rulings 1–4 only, so these come next. Ruling 4 below was added on 2026-11-07.

Platform UI arc, mission rules. File the issue yourself (R146). Before the ship go, do a local walk with Overpass stubbed and commit crops for Ryan's hand check. Send the gate header only to the site's own origins, as #450's walk helper already does.

## Rulings (quote verbatim into rulings.md)

1. **Clean up the inside of every opened detail.** #443 ruling 2 applies to what's inside a detail too. Ryan's production screenshots from 2026-11-06 show raw text there:
   - Device spacing math is in mono sentences that wrap badly (e.g. "1000 ft / 60 ft max spacing → 18 cones at 58.8 ft intervals").
   - Warning signs shows a raw key: "road_type = 'urban_low' → Table 6B-1 category: urban_low".
   - The Permit detail has lowercase fragments ("jurisdiction publishes no permit tiers", "adjacent owners, businesses, residents: …", "public (full street closure): …") and "STALENESS RISK: …" in caps.
   - The source line is in mono caps ("SOURCE: MUTCD § 6H.02 · TABLE 6B-1 · …").
   - Zone geometry uses letter labels ("Taper L", "Buffer B").

   Fix every detail to the same shape: one plain sentence (Inter 13.5), then label–value rows with only the values in mono, then one "Source: …" line (Inter 12.5 `--ink-faint`, sentence case). Where a sentence comes from the backend, fix it there (Rule 3) so the PDF and spreadsheet read the same. No internal key or variable name may reach the page. List every string you change, with before, after and source.
2. **A search that opens a long detail shows only its matching lines**, as #443 ruling 7 does for device lists. Searching "sidewalk" opens Permit and shows all 17 fee lines and every notice line. Apply the "N of M shown" and "Show all" pattern to every list inside a detail.
3. **Hide "Show all N" when all N are already showing.** Warning signs shows "3 of 3 signs shown" next to "Show all 3 signs".
4. **Driveways short result (from #450):** "Advisory · keep access gaps, no devices across driveways".
5. Follow group 1's rules: 44 px targets, only the ruled sizes, no new hex. List every new string with its source, and predict churn (Rule 5).

## Out of scope

Undo links, #448, #449 and #451.

## Evidence

Capture at 1440 and 390:
- every detail in "Checked and passed" and "Denver rules and site facts", opened (before and after)
- searches for "sidewalk" (Permit shows only its matching lines) and "taper"
- the Warning signs detail with no "Show all"
- page 1 of the PDF and the spreadsheet, where a backend sentence changed

Run axe and the 44 px measure, and commit the crops.
