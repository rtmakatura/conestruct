# #438 rulings

## Ryan, 2026-11-03 (verbatim, with `/start 438`)

> Item 1 ruling: the strip names both places with their own counts, each from the same source as the section it names: "Plan ready. <A> item(s) above and <P> under Pending need a check before field use." A = the "Also on this plan" count, P = the Pending row's count. Drop a part when its count is 0; when both are 0 keep today's verdict wording. Items 2–5 as filed.

## Investigation (2026-11-03, base `d65bf13` = main `9a9ca2d` + the #437 production-check evidence)

Item 1, the two producers:
- **A** is the rows NEEDS YOU lists under "Also on this plan" (`components/NeedsYou.tsx:107-118`): `needsYouModel.items` (tier items after `mergeConditions`, `lib/needs-you-conditions.ts:124-138`) plus the listed condition rows that aren't questions (`SiteConditionRows`, mounted when `hasOtherListed`, `components/GeneratorShell.tsx:1522, 2146-2160`): `needsYouRows.filter(r => isListed(r) && !questionFlags.has(r.flag))`. One producer goes in `lib/needs-you-conditions.ts` (`alsoOnPlanCount(model, rows, questionFlags)`), read by both NeedsYou and the strip. Without a question flow the "Also on this plan" label doesn't render, but the same rows are NEEDS YOU's list, and "above" still points at them.
- **P** is `settledLedger.pending` (`GeneratorShell.tsx:1353-1360`), the number `PendingDisclosure` prints (`:2383-2386`, `ResultsDisclosures.tsx:112-130`).
- Today's N = 0 words come from `plan_flags` (`components/StatusBar.tsx:460-520`): clean → "VERIFIED · 0 validation warnings" + READY FOR TCS REVIEW; warnings only → "VERIFIED · N validation warnings" + REVIEW WARNINGS pill; otherwise "VERIFIED · N plan flags". At Colfax after Apply: strip total 4, A = 1 ("Site corridor validation"), P = 3.
- The strip is mounted at `GeneratorShell.tsx:1729-1755` (`questions={openQuestions}`); it gets a new prop with A and P.

Calls for the build (R145, proposed; confirm against the code when building):
- **H1.** The new sentence replaces the two NOT-clean branches' words (warnings-only and plan-flags) when questions = 0 and A + P > 0. The clean branch is untouched: changing READY FOR TCS REVIEW is outside the ruling.
- **H2.** The REVIEW WARNINGS pill goes with the new sentence, for the reason #437 ruling 2 removed REVIEW FLAGS (it looks like a button and isn't one).
- **H3.** When the strip isn't given the counts (prop absent, e.g. before the ledger settles), it keeps today's words (Rule 10: no guessed count). So StatusBar.test.tsx's existing pins stay unchanged.
- **H4.** Wording: "1 item above", "2 items above"; "and" joins both parts; with only P: "Plan ready. 3 under Pending need a check before field use." (singular "1 under Pending needs a check"). With only A: "Plan ready. 1 item above needs a check before field use."

Items 2-5 as filed in #438. Rule 5 prediction is written before the diff, in the build session.

## Build session (2026-11-04, rebased onto `ux-group3-prod-check` `c494f32` = main `6231697` + the #439 production-check evidence)

R145 self-ruled (fit existing rules; none on the park list):
- **H1-H4** as proposed above, confirmed against the code: the strip's not-clean branches are `StatusBar.tsx:490-519`; the clean branch (`:466-474`) is untouched.
- **H5 (item 4).** The tier and condition rows' provenance lines (`ny-prov`) move from mono `.tr-prov` to `.tr-note` (Inter 12.5, #435 ruling 2: every full sentence leaves mono). The citation (`ny-cite`, e.g. "OpenStreetMap") stays mono: it is rule 11's citation role, a short label, which is what #438's own proposed solution keeps in mono.
- **H6 (item 5).** The results stack's three section titles (NEEDS YOU, YOUR PLAN, DOWNLOADS) become `h2`, siblings under the page `h1`; the NEEDS YOU question title and the Downloads card titles become `h3`. Visual size is class-driven and unchanged (`.dl-card h4` selector follows to `h3`). P11: the three section titles share one level.
- **H7 (item 2).** Topics: Sidewalks, Intersection, Highway interchange, Bike lane, School zone (the nouns FLAG_WORDS already carries, capitalised). The answer label's first letter is lowercased; " · not applied yet" is kept.

### Rule 5 prediction (written before the diff)
Changes: (1) the strip's words in the two not-clean branches when GeneratorShell passes the counts (A + P > 0, questions = 0), with no pill; (2) the answered-row text; (3) the Key distances label takes the TOTAL DEVICES label rule (mono 10 px, .18em, caps); (4) provenance lines in "Also on this plan" render Inter 12.5; (5) heading tags as in H6. Expected test updates: GeneratorShell.batch-corrections:307/310, NeedsYouQuestion.test:144/165, GeneratorShell.needs-you:243, ResultsHero.test:152, OutputCards.phone-note:35, GeneratorShell.disclosures:217.
Byte-identical: the clean branch, the strip without counts (StatusBar.test's existing pins), the questions > 0 strip, every backend file, the type census (no new size).

Amended during the build, stated rather than explained away: the first test run also failed three pins the list above missed, all the same two changes. OutputCards.test (the card-title h4 test, and its CSS test `.dl-card h4`, which also asserted that no `.dl-card h3` rule exists), and ResultsHero.test rule 81 (it looks up the `.hero-cell .k {` selector text). `lib/design/type-exceptions.ts` changes two census rows because their selectors changed (`.dl-card h4` → `h3`; `.hero-cell .k` → `.hero-cell .k, .hero-meta .k`). Same sizes, no row added. Nothing else moved: full vitest 2746 passed, 1 skipped.
