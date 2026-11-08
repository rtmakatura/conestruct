# UX queue: work through these in order, with no round trip to Claude chat between them

Ryan set this up on 2026-11-07. Work the items in order, one item per fresh session (R154). Every ruling Claude chat would have given is already written in each item's prompt, or below. Ryan types `ship <branch>` himself in the same session that prints the `result:` line, and the gate is unchanged.

## How each session runs

1. Read this file and take the first item whose box isn't ticked. If an item says **parked**, skip it and take the next one.
2. Build it from its prompt with the mission rules as usual. Stack each branch on the previous item's shipped main, or on its prod-check branch if that ships with it.
3. **Don't stop to ask.** Make the call, record it in that item's `rulings.md`, and add it to "For Ryan" at the bottom of this file. Stop only for:
   - the park list
   - anything irreversible
   - any change to a device count, spacing or sign placement that the item's rulings don't already state (Rule 8)

   In those cases, mark the item **parked** with the question, commit and push the work so far, and move on to the next item in a fresh session.
4. Finish with the gates, the walk with crops, the `result:` line and the usual report. After Ryan's `ship` in that session, run the production check and close the issue. Then tick the box here, commit this file with the prod-check evidence, and end with: "Next: `/clear`, then paste the queue line again."
5. If a session runs out of room mid-item, push the work in progress, note where it stopped in `handoff.md` and here, and end the same way. The next session picks it up.

## The queue

- [x] **1. Group 5 details:** `cc-prompt-ux-group5-details.md`. Build on `issue-450-prod-check`. Ryan's answers, already decided:
  - Driveways gets "Advisory ·".
  - #451: the PDF section lists all 3 items, including work hours.
  - "◌ Pending" on steps stays.

  Also file the layout shift (0.96 at 1440, 1.73 at 390) as an issue for group 6, the Generate wait state.
  - **Status 2026-11-08:** built as #453, `issue-453-details-clean` `24603de` (on `issue-450-prod-check` `edaffb3`), pushed, CI green, both gates PASS. Layout shift filed as #452. Waiting on Ryan's `ship issue-453-details-clean`; then the prod check, close #453, tick this box.
- [ ] **2. Map in view, no waiting, wrong status text:** `cc-prompt-ux-map-in-view.md`.
- [ ] **3. Undo links:** `cc-prompt-ux-undo-links.md`. Also carry #446's known limit: after Move at 390x664, focus goes to "Use the big map instead".
- [ ] **4. #448, text with no line drawn:**
  - When a NEEDS YOU map draws no line for its subject, the sentence says what's true, e.g. "The scan found an intersection 73.2 ft from the work, but the map couldn't draw it. Check it at street level."
  - When the line is drawn, the sentence stays as it is.
  - Apply this to every question kind, and list each string with its source (Rule 10).
- [ ] **5. #451, the PDF count:** the "Not checked yet" section on the audit PDF lists all 3 items, including work hours, so it matches the cover. If item 1 already did this, tick the box and close #451 with a pointer.
- [ ] **6. #449, a bike lane that only crosses the end of the zone:**
  - **Investigate first:** what the scan counts as "along", what MUTCD and CDOT say for a bike lane that crosses versus one that runs alongside, and whether the plan adds devices for the crossing case today.
  - **If the fix changes any device count:** park it with a short write-up of the options and their sources. That's Ryan's call (Rule 8).
  - **If only the question's words are wrong:** fix the words (e.g. "A bike lane crosses the end of the work zone") and ship.

## For Ryan

Add each self-made call, open point and parked question here, one line each, with its item number and a link to its `rulings.md`. Ryan brings this list to Claude chat once, at the end.

All item 1 lines link to [rulings.md](validation-artifacts/committed/ux-group5-details/rulings.md) on `issue-453-details-clean`.
- Item 1 (#453), X17 open: the audit PDF still prints its spacing count lines with "->" and "max spacing"; the page and the PDF's sentences changed, the count lines didn't.
- Item 1, X24 open: the page's corner row drops "past the work zone" / "upstream" and the buffer row drops "General" / "tangents along the buffer space", against the PDF count lines (facts kept, a few words not).
- Item 1, open: the corridor warning still names road classes by their map labels "(motorway, trunk, primary or secondary)" and can read "a motorway link road" / "a living street road".
- Item 1, open: at 390, "$100 / occurrence" (Denver hazards) and the label "Tangent, 1,000 ft" still wrap; values keep number and unit together, labels and list values don't.
- Item 1, open: search highlight misses a match that spans the non-breaking space inside a long value (the row still opens).
- Item 1, open: "Notice to public (full street closure)" and "Notice to parking" read awkwardly; it's corpus data, filed with the rest as #454.
- Item 1, self-rulings X1–X24 (sentence/row/source shape, search filters rows and sentences with "N of M lines shown", Driveways "Advisory ·" as ruled): rulings.md.
- Item 1, filed: #452 (layout shift, group 6), #453 (this item), #454 (jurisdiction corpus notes).
- Item 1, gate notes not fixed (write-up only, non-blocking): red-pytest header names only one of two AttributeError cases; evidence.md cites an overwritten red-vitest file; a test-file header comment names a check that lives in another suite.
