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
