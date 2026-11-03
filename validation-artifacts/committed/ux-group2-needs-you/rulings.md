# UX group 2: "Needs you" as one question at a time: rulings

Ruled 2026-11-02 by Ryan: Option B on the "Tool page: Needs you" design canvas (https://claude.ai/artifact/6UESUis2J7M5piFrpueEdR, artboard `project/OptionB.dc.html`; `project/Main.dc.html` is today), with downloads kept usable before the questions are answered. Quoted verbatim from cc-prompt-ux-group2-needs-you.md § Rulings.


1. **Order after Generate:** verdict strip → NEEDS YOU → 5-other-conditions row → Setup (one line) → Your plan → Downloads (with the price-quote row) → the existing disclosures (Checked & passed, Pending, Reference) → draft footer.
2. **Verdict strip** says the count in words: "Plan ready. Answer N quick questions before you send it." (N = the NEEDS YOU count; singular "1 quick question"). The REVIEW FLAGS chip is removed. With N = 0 the strip keeps today's verdict wording.
3. **NEEDS YOU shows one question at a time.** Header row: mono "NEEDS YOU", "Question k of N", and a segment bar (one segment per question, filled when answered or current). Body: the question as a 19 px Inter heading, one 13.5 px explanation sentence, then two radio rows (ruling 5), then the source line and the primary button. Under the body, one row per remaining question showing ◌ and its plain title ("Next: an intersection next to the work"). Answered questions collapse to a one-line record with ✓ or × and Undo (P15). Every question stays reachable: clicking a collapsed row reopens it.
4. **Order of questions:** items whose wire says they changed the plan first, then items that flag without changing the plan. Ties keep today's order. Derived in `lib/needs-you-items.ts` (one producer; no ordering in components).
5. **Each answer row states its consequence.** Two radio rows (Option C's 14 px square marker: filled `--act` with inset gap when chosen, `--pri-off-ink` outline when not): a 13.5/600 label ("Yes, they're there" / "No, there aren't any") and a 12.5 `--ink-mute` line saying what happens to the plan, built from wire fields only (device count, device-total delta). "Yes" maps to the existing Confirm action; "No" maps to the existing Dismiss. No new backend action. **Every consequence line must be true of the backend: trace each to the field and code path that makes it true, and list them at the checkpoint. If a line can't be traced (Ryan's open question: does dismissing the intersection actually clear its flag?), stop and report; do not ship an untraced claim.**
6. **Button:** "Next question" on all but the last; the last says "Apply answers" and is the existing Apply (one regenerate, #254 staging unchanged). Disabled until the current question has an answer.
7. **Detail moves behind "Details"** on each question (P19, one click): found count, nearest distance, the citation, OpenStreetMap, the scan time and duration. The source line in the default view is "Source: <citation> · map data from OpenStreetMap · Details".
8. **The other scanned conditions** collapse to one row: "✓ N other conditions checked. Nothing else needs you." with "Show them". Replaces "✓ 3 none found · ◌ 2 not asserted · SHOW 5". The not-asserted rows keep their Assert action inside "Show them".
9. **Setup** is one row: ✓, mono "SETUP", the values joined with " · ", and "Edit" (opens the existing revision path). The 4×2 grid moves behind Edit.
10. **Your plan**: mono "YOUR PLAN" header, "As it stands now"; three cells: TOTAL DEVICES (62 px `--dim`, line "On the plan sheet"), DEVICE TYPES (62 px, "Different devices to pull from the yard"), KEY DISTANCES (Taper, Buffer, Device spacing, Work zone; label Inter 13.5, value mono `--dim`). Numbers from the same wire fields as today (Rule 12).
11. **Downloads stay usable before the questions are answered** (Ryan, 2026-11-02; P8 disclose, don't lock). While any question is unanswered or answers are staged, a `--vd-flag-ground` row above the cards says: "These files match the plan before your N answers. Answer first and they'll update." It disappears when NEEDS YOU is empty and nothing is staged.
12. **Download cards**: title, format tag, one plain line of what the file is for, 44 px "Download ↓". Plan sheet: "The drawing for the crew and the permit. N devices." Device list: "What to load on the truck. N types, CDOT bid items." Crew instructions: "Setup and takedown, in order. N steps." (keep today's PDF and .md buttons). Audit trail: "Every number and the rule behind it. N checks." Header: "N files, quote included" and "Download all (.zip) ↓".
13. **Price quote** stays its own disclosure (Ryan liked it as is) but its collapsed row joins the downloads: "Price quote · Contractor estimate, not a permit fee · $total · Open".
14. Copy follows the unslop rules. Every new string is listed at the checkpoint with where its numbers come from.


## Ryan's checkpoint rulings

Ruled 2026-11-02 by Ryan at the checkpoint, quoted verbatim:

> S1. Add a real "confirm" action on the backend, in the same backend change as S2. "Yes" records it, so it shows in the audit trail and survives a reload. The button stays "Apply answers" in every case.
>
> S2. Yes: add a "not there" dismiss reason on the backend. "No" sends it. No reason chips, no auto-typed "other" note.
>
> S3. Approved, with "TCS" in place of "supervisor": "No devices change. Your answer goes in the audit trail for the TCS to check."
>
> S4. Drop the total clause. "The 4 devices come off the plan." only. No follow-up issue for now.
>
> S5. Approved as you recommended: N counts scanned conditions only; the rest show under "Also on this plan" with their citation and today's Acknowledge.
>
> Size: three stacked branches under one issue, one ship go: (1) backend confirm + "not there", (2) strip, NEEDS YOU, new order, (3) Setup, Your plan, Downloads.
>
> Your ten D1–D10 calls are approved. Post the issue yourself (R146).


## Branch 1 (`ux-group2-backend`): R145 self-ruled calls

Built 2026-11-02 on Ryan's rulings S1 and S2. None of these hits the park list.

- **E1. A third status, `confirmed`.** A confirm on a detected flag comes back `status: "confirmed"`, not `applied`. Every consumer that keys on `applied` (the `site_condition_overridden` pending item `audit.py:2827`, `corrections_advisory`, the sheet line `corrections_disclosure`, the PDF Result cell, TieredReference's assert branch) then skips it by default. That answers the handoff's open call: a confirm adds no pending item because nothing is overridden.
- **E2. Confirm on a flag the scan didn't find is `moot`.** Without a scan result it is `moot` too, the same shape as a dismiss in both cases.
- **E3. The record sentence:** "Operator confirmed the scan's {label}. The plan is unchanged." It carries no verify advisory, so `record_clause == disclosure`. The narrative and the audit print it through `correction_sentences` (every record), so the "Yes" is in the audit trail and survives a reload (S1).
- **E4. Audit PDF scan table:** a confirmed row reads "DETECTED: confirmed by operator" with the scan's evidence kept.
- **E5. `not_there`** joins the backend Literal and `DISMISS_REASON_TEXT` ("not there") and the TS `SiteDismissReason`. It is **not** added to the `DISMISS_REASONS` chip list: "No" sends it directly (S2, no chips), and the chips leave in branch 2. The helpers are `confirmMarker` and `notThereMarker`.
- **E6. The ledger (Python `tier_ledger.py`, TS `tiering.ts` mirror)** is unchanged. A confirmed record adds no fact; the condition keeps its own detected fact.

**Rule 5 miss:** the checkpoint predicted "~+40" for the backend if S2-A/S1-C were ruled in. Actual: backend source +55/−9, backend tests +85, and frontend +35/−8 (types, two helpers, their test, one intent line). I hadn't predicted the frontend half.


## Branch 2 (`ux-group2-needs-you-ui`): R145 self-ruled calls

Built 2026-11-02 on rulings 1-8 and S1-S5 (the strip, NEEDS YOU one question at a time, the new order). None of these hits the park list.

- **F1. The REVIEW FLAGS pill is removed in every state**, N = 0 included (ruling 2 names it removed; the words stay). The REVIEW WARNINGS and READY FOR TCS REVIEW pills are not named and stay.
- **F2. The strip's N is the open questions:** unanswered plus answered-but-not-applied (`openQuestionCount`, the number D6 gives the warning row). Once every answer is applied, N = 0 and the strip keeps today's verdict.
- **F3. Per-flag words.** Singular flags read "Yes, it's there" / "No, there isn't one". Explanations: bike lane "…so we added N devices for people on bikes."; school "…for the school zone."; interchange "…The plan adds no devices for it; the ramp layout stays with your TCS." (audit.py:2664-2678); the intersection's "traffic control supervisor" reads "TCS" (S3). A flag with no adjustment record on the wire states no device count: "The plan stays as it is." / "The plan is built again without it." (Rule 10).
- **F4. A radio click stages the answer at once**; choosing the answer the plan already carries (after an Undo of an applied record) un-stages instead of writing it again.
- **F5. With the card closed** (every answer applied) the header reads "N of N answered". If something is still staged then (a manual key, an Undo on a non-question record), an "Answers ready to apply." row carries the same Apply.
- **F6. A collapsed answer reads** "<the question without its ?>: <the answer label>", plus " · not applied yet" while staged, with Undo. Clicking the row reopens it.
- **F7. Ruling 8's row drops "Nothing else needs you."** while NEEDS YOU still lists a tier item (Rule 10: the sentence would be false).
- **F8. N = 0:** NEEDS YOU mounts only for a question, a tier item, a non-question condition record or a staged Apply. A scanned plan with nothing detected shows ruling 8's row alone (P14).
- **F9. Setup moves below the other-conditions row in this branch**, as the grid it is today. Its one-row form (ruling 9) is branch 3's.
- **F10. A staged non-question intent** (an Assert from "Show them") while a question is open applies with the last question's "Apply answers". There is no second Apply button beside the card (ruling 6 gives the block one).

**Rule 5 against the checkpoint's prediction (§ 3 a, b, c, g):** predicted ~300 assertions in ~20 test files for (c) plus ~66 for (a, b, g). Actual: 14 test files touched, vitest 2722 passed. Two suites were rewritten as predicted (NeedsYouConditions.test, the batch-corrections tail), NeedsYouQuestion.test is new, and `NeedsYouConditions.tokens.test`, `ResultsHead.grid`, `post-generate-scroll`, `BandStack.landing` and `results-slot-tokens` needed no change (fewer than predicted). Source: NeedsYouConditions.tsx −691/+330 (predicted −450/+350), NeedsYouQuestion.tsx +330 (predicted +250), needs-you-items.ts +231 (predicted +120), globals.css +245 (predicted +300/−200; nothing was deleted, because the dismiss-picker CSS is now unused and leaves in branch 3's cleanup, which the prediction did not say).
