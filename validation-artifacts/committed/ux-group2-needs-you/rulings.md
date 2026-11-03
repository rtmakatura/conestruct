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
