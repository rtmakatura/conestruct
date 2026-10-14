# Rule 5 prediction: `issue-297-acknowledge` (#297 step 3 of 3, ACKNOWLEDGE)

Committed before any code. Stacked on `issue-284-proposed-kind` (`a62e6e0`), which stacks on
`issue-297-stable-keys` (`abc7d7d`).

## Ruling

Ryan, 2026-10-14:

> #297: as you recommend. ACKNOWLEDGE only on NEEDS YOU items with no write action (the jurisdiction deltas).
> Give items stable keys first, then record acknowledgements in meta.acknowledged keyed by stable id. The
> audit lists what was acknowledged.

The ruling's "the audit lists what was acknowledged" means the backend reads the field. #297's own text said
"does not touch `src/`", and the ruling supersedes it.

## Design (R145 self-ruled inside the ruling)

1. **It stages like a correction.** #254: "every click on a row is an INTENT held in the shell; the one
   scenario write is Apply". The #289 checkpoint (`issue-289-band-stack/checkpoint.md:518-537`) named staging
   as ACKNOWLEDGE's home. So a click stages `{acknowledge: <item id>, set: true|false}`, and Apply writes
   `meta.acknowledged` and re-generates once, alongside any staged correction or field edit.
   - It stages; it doesn't write directly. A direct write would re-fire the plan's requests on its own and
     break the one-write rule.
   - The new staged variant has its own guard (`isAckStaged`). Every filter that treats a non-field entry as
     a site-condition flag excludes it explicitly.
2. **Which rows.** Only jurisdiction-delta items (`jur:delta:<key>`), in both tiers: ▲ changed and ⚠ needs
   attention. They are the items with no write action. Every other item keeps `action: null` (ruling d holds
   for them).
3. **The row's control:**

   | state | button | provenance adds |
   |---|---|---|
   | not acknowledged | "Acknowledge" | (nothing) |
   | acknowledgement staged | "Undo" | "· acknowledgement staged" |
   | acknowledged | "Withdraw" | "· acknowledged" |
   | withdrawal staged | "Undo" | "· withdrawal staged" |

   - The item never disappears and its tier doesn't change. The operator acknowledged the item, not the
     condition (rule 10, P8).
   - The header count is unchanged.
4. **Apply.** The existing Apply row renders only when the scan produced condition rows. When it isn't
   mounted and anything is staged, NEEDS YOU renders the same Apply row itself, with the same sentence and the
   same write, so an acknowledgement can always land. `stagedEnumeration` gains "N acknowledgement(s)".
5. **The field.**
   - `ScenarioMeta.acknowledged?: string[]`, in both the frontend and the backend.
   - Backend: `list[str] | None`, at most 50 entries of at most 120 characters.
   - The key drops when the list empties (#179's shape).
   - It survives a regenerate, because nothing clears it (the opposite of `proceed_if_unavailable`).
6. **The audit.**
   - When `meta.acknowledged` is non-empty, `_audit_build` resolves each id against the plan's evaluated
     jurisdiction (`_jurisdiction_eval`) and adds top-level
     `acknowledged: [{id, rule, source, applies}]`, where `applies` is false when the rule no longer fires
     for this plan.
   - It's absent when empty, so no snapshot moves.
   - The audit PDF prints a block, "Acknowledged by the operator": one line per entry, the rule's sentence
     and its source, and "(no longer applies to this plan)" when `applies` is false.

## Predicted

- **pytest:**
  - the audit lists an acknowledged delta with its rule words and source;
  - a stale id is listed as no longer applying;
  - no key when nothing is acknowledged;
  - the device breakdown and page-1 PDF are byte-identical with and without `meta.acknowledged`
    (acknowledging writes nothing about the plan);
  - the field's limits.
- **vitest:**
  - delta rows offer Acknowledge, and no other row gains a button;
  - a click stages and Apply writes `meta.acknowledged`;
  - an acknowledged row still renders, with "acknowledged";
  - Withdraw, then Apply, removes it;
  - the staged sentence says "1 acknowledgement";
  - the filters ignore an acknowledgement;
  - the Apply row renders without condition rows.
- **Updated tests:** the ruling-d tests (`needs-you-items.test.ts:126-135`,
  `NeedsYou.test.tsx:58-68, 92-99`) are amended for the delta rows only.
- **Snapshots:** none move.
- **Screenshots** at 1440 and 360 on S Wadsworth Blvd (two Lakewood rule rows): the rows with Acknowledge,
  then staged, then applied. **Look at this:** it is a visible change.
