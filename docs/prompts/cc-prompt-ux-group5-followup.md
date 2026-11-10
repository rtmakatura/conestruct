# cc-prompt: UX group 5 follow-up: one name for "Not checked yet", short rule-check results, phone placeholder

Ryan ruled this on 2026-11-06, on #443's open items X23, X33 and "long rule-check rows". It builds on #443, which went live at eff48e0.

Platform UI arc, mission rules. File the issue yourself (R146). Before the ship go, do a local walk with Overpass stubbed and commit crops for Ryan's hand check.

## Rulings (quote verbatim into rulings.md)

1. **One name for the section (P2).** "Not checked yet" is the section's name everywhere.
   - The NEEDS YOU strip's "<P> under Pending" becomes "<P> under Not checked yet".
   - The backend sentence "See the pending-verification disclosure." becomes "See Not checked yet." on the page and in the PDF, or uses the PDF's own name for that list if the PDF has one.
   - Grep for every other "Pending" or "pending-verification" a user can read (page, PDF, spreadsheet, crew narrative), list each one, and rename it the same way. Internal names stay as they are.
2. **Rule-check rows get a short result.** In "Checked and passed", each rule-check row reads title, then a short result on one line at 1440, e.g. "Signs on both sides of one-way street: Not required · 0 left, 10 right".
   - The full sentence, the quote and the citations move into the row's opened detail as written today. Nothing is lost.
   - The short result comes from the backend as a new field, so the frontend doesn't cut sentences (Rule 3).
   - Trace each rule check and record its short result and where each piece comes from. A check whose result can't be shortened honestly keeps its sentence, and you record why.
   - Search still finds text in the detail, as #443 does for closed rows.
3. **The search placeholder fits at 390.** Below 480 px the placeholder reads "Search: taper, 6B, sidewalk". Above that, it keeps #443's wording.
4. Follow group 1's rules: 44 px targets, only the ruled sizes, no new hex. List every new string with its source, and predict churn (Rule 5) for tests that look for the old strings.

## Walk-script rule (from #443's production check)

Send the gate header only to the Conestruct site's own origins, by matching the request host in the Playwright route. Sending it to every origin broke Clerk on #443's first two production runs, and it sends our header to other companies' servers. Fix this in the shared walk helper so every later walk inherits it, and record the change.

## Out of scope

Undo links (`cc-prompt-ux-undo-links.md`), the tap feedback and site map (`cc-prompt-ux-tap-and-site-map.md`), and the reason line on "Not checked yet" rows (Ryan: leave it).

## Evidence

Capture at 1440 and 390:
- the strip
- "Checked and passed" with every rule-check row closed, then one opened
- the placeholder at 390
- a search that matches text now inside a detail
- page 1 of the PDF showing the renamed sentence

Run axe and the 44 px measure, and commit the crops.
