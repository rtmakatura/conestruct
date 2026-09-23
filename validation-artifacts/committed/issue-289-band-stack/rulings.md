# issue-289-band-stack — the rulings this arc is built under

**Issue:** #289 — "Direction A Phase 2 — the band stack (S1–S4) and revision (S7)".
**Phase:** 2 (of #281 Direction A). **Priority:** high.
**Labels:** enhancement, priority-high, frontend, ux, p18, p22.

**Base:** `e60c91c` (= `main` = `origin/main` = prod `healthz` at the time of this commit).

This file is the arc's authority: every commit on this branch cites it. Filed as this arc's
**first** commit, per the per-arc rulings convention adopted 2026-09-16.

**What this file holds at the checkpoint.** #289 has not been ruled yet — the checkpoint
(`checkpoint.md`, committed next to this file) is what Ryan rules on. So the sections below
are the rulings #289 **carries in** from #281: the design authority this arc is already
bound by before anything is built. Ryan's ruling on the Phase 2 checkpoint appends to this
file as "The ruling, verbatim", the way #288's did, and nothing is built until it lands.

---

## The carried rulings, verbatim from #289's "Rulings carried"

> 184 · 188 (every row stays; tally in words) · 189 · 190 / §8.27 (#262 closes by deletion) ·
> 191 (merged apply; staged sentence enumerates) · 192 / §8.28 (focus targets re-homed) ·
> 195 · 196 / rule 14 (#276: "Not set" / honest error word / name; no skeleton; §8.31's
> reserved height transfers) · 198 / 199 · 200 · 201 · 202 (blind-apply sentences in 7b/7d) ·
> 203 · preview-as-read / §1.1 "nothing is written until APPLY".

Each one, as #281 states it. Quoted verbatim from #281's body, "Rulings on Part 2's
departures (180–204)".

> **184 reserved band heights — no.** User-initiated collapse is P1's own clause. But every
> collapse lands the next band at a computed spot — the arc-28 landing machinery
> (`armLandingCheck`, settle-plus-tolerance, counted cap) applies to every collapse, not only
> Generate.

> **188 unchanged values — `#c8d1dd`, every row stays** (Part 2 rule 95.5). Plus a second
> channel beyond hue and weight: the status row's tally states the sum in words ("3 changed ·
> 2 unchanged · 2 on apply").

> **189 the modal migration — phased.** Phase 2: the Where band owns the aerial and the
> outcome; the picker modal stays for the decision work (detection, candidates, bearing,
> cross-street, suggestions), opened from the band. It migrates piece by piece in Phase 3 and
> after. Nothing in the column's structure depends on the modal being gone.

> **190 loss of inline strip edits — confirmed.** CHANGE ONE THING re-opens one field, in
> place, with its consequence shown. #262 closes by deletion, recorded as such.

> **191 merged apply — confirmed,** with the staged sentence enumerating what is staged
> ("1 field · 2 corrections") so one Apply is known to carry both.

> **192 zone headings dropped — confirmed;** focus targets move to the band stack and the
> results stack.

> **195 S7 verdict clause — approved:** "verdict is for the plan on screen, not the staged
> change".

> **196 #276 — approved:** "Not set" when unset, an honest word when the evaluation errored,
> no skeleton.

> **198 four bands, not five — confirmed.** FLOW's five steps are the user's questions; the
> bands are how the column asks them. Where absorbs the kind; What absorbs dates.

> **199 work dates as a field in What — confirmed.**

> **200 two busy vocabularies — approved.** P16 amended: one busy signal *per fact*.

> **201 the "0.9 s" — cut.** Status row reads "computed for 35 mph · taper, buffer, spacing
> and counts only".

> **202 Apply enabled in 7b and 7d — approved with words:** 7b footer "1 change staged ·
> preview still computing — Apply re-generates the full plan either way"; 7d "1 change staged
> · preview failed — Apply re-generates the full plan without a preview". The button works;
> the sentence says you are applying blind.

> **203 7a's quietness — approved as designed.** Nothing is wrong in 7a.

And the preview-as-read ruling, from #281's "Rulings the audit added (not in the spec's own
list)":

> **A preview is a read.** No band, no lock, never memoised, never written;
> commit-on-blur/Enter, never per keystroke; the fast request only (breakdown), never the
> audit, scan or PDFs. Needs a backend preview flag on the request (Phase 0).

And Part 1 §1.1, the sentence the whole revision half hangs on:

> Revision is the collapse machinery run backwards: the CHANGE link on a fact line re-opens
> that one band in place, with a before/after panel beneath the field, and nothing is written
> until APPLY.

---

## Rule 14, quoted because ruling 196 names it

> 14. No skeletons, no placeholder bars, no indeterminate progress, anywhere. A value that is
>     not known renders as a word: "Not set", "pending", "No package yet", "Zone geometry
>     unavailable".

The arc has one live violation to answer for (`JurisdictionSection.tsx:252`,
`.jbar-skel-line`); `checkpoint.md` §D carries it.

---

## Contracts every phase inherits (#281, verbatim)

> Rules 3/5/8/9/10/12/13 · #198 byte-identity · rail single-voice (#228 — the rail is
> replaced; its derived-entry contract moves to the move ledger and the fact lines) ·
> suggest-never-set · the expectation-JSON pin moves both sides together · PDF containment
> zero · citation counter 19 · payload senders enumerated on any wire change · write-lock
> declarations · spec 31 (no band + refusal co-frame) · the five-tier ledger is the one
> sorter · P1–P22 with the FLOW.md step and user named per surface.

---

## What is NOT ruled yet, and therefore not built

Everything in `checkpoint.md` marked **RULING NEEDED**. At the time of this commit that is
nine items, R1–R9 in that file's opening table:

1. **R1** — the fifth-step section (Flagger / Cross street) has no band under ruling 198's four.
2. **R2** — rule 135's gated kinds "not rendered at all today" against today's seven-kind
   picker and #277's surviving enablement-bar bullet.
3. **R3** — the preview skips the site scan, so **preview ≠ applied**, against #267's invariant.
4. **R4** — rule 124's collapsed NEEDS YOU in S7 against ruling 186's "always expanded".
5. **R5** — ACKNOWLEDGE's home: revision offers one, the wire still carries nothing to write.
6. **R6** — §8.25's pre-generate half (`SiteConditionsField`) has no band.
7. **R7** — `--nav-h` is 52 px; rule 21 says 48, and every landing target derives from it.
8. **R8** — measured: at 1440 the column in S3/S4 is shorter than the viewport, so ruling
   184's "computed spot" is unreachable and `armLandingCheck` would report a failure that is
   arithmetic, not behaviour.
9. **R9** — measured: the setup fact line is 60 px at 1440 and 131 px at 380, not rule 56's
   44, so rule 28's `--fact-h` reserve — the thing Phase 1 deferred to Phase 2 — is short.

None of them is a churn prediction; each would change or contradict a #281 rule, which is the
standing stop condition from #288's second ruling:

> Anything you find that would change a #281 rule (not just a churn prediction) stops the arc
> with a checkpoint; I rule before it's built.

---

## The ruling, verbatim — Ryan, 2026-09-22, on the Phase 2 checkpoint

> #289 rulings — recommendations adopted as tabled, with these decisions written into
> rulings.md:
>
> a. The writer enumeration is the honesty test: every path that wrote meta through the strip
> editors, withPin, or the corrections helpers becomes a band re-open, and a mounted test
> proves "only APPLY writes" by exercising each. Any writer you found that the table did not
> name is a finding, not a fix.
> b. Component plan as tabled. tr-question is used on band questions only — nowhere else,
> asserted.
> c. WHERE with the modal behind it: the three states as mapped; the #234 rehydration contract
> holds both directions (fact line ↔ modal agree on the intersection), tested.
> d. WHAT: per-field provenance comes from lib/road-detection/provenance.ts — one producer;
> the #273 ledger's tests retire as layout and transfer as facts. Jurisdiction field: three
> states (Not set / honest error word / name), no skeleton, no height change, tested. The grid
> switches on kind; every live kind renders it.
> e. S7: staged field edits live in the shell beside #254's staged corrections — one staging
> mechanism, never per editor. Preview fires on blur/Enter only, carries #282's flag, hits the
> breakdown path only; the panel renders its four situations with the reserved status row;
> APPLY folds staged fields and corrections into one write with the enumerating sentence;
> DISCARD un-stages; pin move clears all. Ruling 186 wins over rule 124: NEEDS YOU stays
> expanded and live in S7, dimmed with the rest of the results under the ribbon that explains
> why — nothing collapses because of state. Record rule 124 as overridden. ACKNOWLEDGE stays a
> row with no button until a wire action exists; draft the issue for its home.
> f. Landing targets per transition as measured; armLandingCheck() on every collapse and
> re-open.
> g. Churn as tabled.
> h. Commit order: rulings.md + checkpoint.md → WHERE + WHAT + the generate frame (S1–S3, the
> first visible ship) → S4 lock states + the fact-line mount at the settle → S7 revision →
> evidence. STOP after S1–S3 with the verdict, the file table, and a row-by-row before→after
> of what the setup looks like — that ship changes the screen and I want to see it before
> revision is built on it.
> i. Principles table accepted.
>
> GO.

---

## What "recommendations adopted as tabled" resolves, R1–R9

The checkpoint tabled a recommendation against each of the nine. Adopted means these, and the
build cites this section by R-number.

| R | resolved as | the consequence a commit has to carry |
|---|---|---|
| **R1** | The kind-specific fields become a **third row of the WHAT grid**, rendered only for kinds that have one. Ruling 198's four bands stand. | `near_intersection`'s approach-confirm hold is a rail blocker, so its row is **never inside a disclosure** — rule 139's chain has to stay visible. |
| **R2** | **Three chips**, the four gated kinds not rendered, **plus one provenance line** under the chip row naming what is not offered and why. | `DisabledScenarioBanner` retires; #277's second bullet is satisfied by the provenance line rather than by a per-kind bar. Rule 5: this is a stated behaviour change. |
| **R3** | Rule 91's header note **grows a clause** — the panel says which value AND which computation: "for 35 mph · before site conditions". | True in all four situations, so no predicate decides it. `preview != applied` stays recorded at the backend field and now also on the surface. |
| **R4** | **OVERRIDDEN BY THE RULING ABOVE.** The checkpoint leaned to (a) "it is a state". Ryan ruled the other way: **ruling 186 wins over rule 124.** | NEEDS YOU **stays expanded and live in S7**, dimmed with the rest of the results under the ribbon that explains why. **Nothing collapses because of state.** Rule 124 is recorded as overridden — see the next section. |
| **R5** | ACKNOWLEDGE **stays a row with no button** until a wire action exists. | The issue for its home is drafted in this arc and filed by Ryan; Phase 2 does not mint the field. |
| **R6** | `SiteConditionsField` moves into the **GENERATE band**. | The last question before the button; no grid change; the pre-generate assert path that exists today survives. |
| **R7** | **Not ruled — proceeding under a stated assumption.** `--nav-h` stays **52 px** and **rule 21's 48 px is the number that is wrong**. | Reason: moving the nav is visible churn outside this phase's surface, and every arc-28 landing leg and every `scroll-margin-top` in `globals.css` is measured against 52. The probe measured against 52 for the same reason. Flagged in the S1–S3 stop report; say the word and it inverts, at the cost of re-measuring every landing leg. |
| **R8** | The landing's success test becomes **"target at its spot OR the page scrolled to its maximum, whichever comes first"**, and an unreachable spot is **recorded**, not retried. | One predicate in `armLandingCheck`; the existing arc-28 legs keep meaning what they mean; the check stops reporting a product failure for a page that is simply short. |
| **R9** | `--fact-h` becomes a **floor, not a height** — renamed to say so — and **rule 56's 44 px is corrected to 48 px** so the token and the rule agree arithmetically. | The setup fact line grows past the floor on a long scenario and shifts the stack once, at the settle, by the overflow only. Rule 28's reserve is restored in the S4 commit, which is where its occupant mounts. |

## Rule 124, recorded as overridden

> **124.** In S7 NEEDS YOU renders collapsed as a disclosure reading "▲ Needs you · 3 · for the
> plan on screen", because its expanded actions belong to the answer on screen, not to the
> staged change.

**Overridden 2026-09-22 by ruling 186's own reason**, which Part 2 applied to S8 and not to S7:
"State-dependent defaults drift." S7 is a state; a block that is expanded in every other state
and collapsed in this one is exactly the default ruling 186 rejected.

What replaces it: **NEEDS YOU stays expanded and live in S7**, inside the dim with the rest of
the results, under the stale ribbon that says why the answer below is the previous one. Its
actions stay live for the same reason rule 123 keeps downloads live — staging has to stay
abandonable, and an action taken against the plan on screen is an action against the plan on
screen. The ribbon is the voice that says which plan that is; nothing collapses to say it.

Consequence for the build: S7 needs **no** collapse behaviour for NEEDS YOU, which removes a
component state rather than adding one.

## The 2026-09-23 rulings — the S7 ship

Ryan, on the S7 report.

### CHANGE SOMETHING ELSE — approved, and what it is for

> CHANGE SOMETHING ELSE approved (record it in rulings.md as the post-generate route to
> pin/extent/kind)

**The gap it fills.** Rule 190 re-opens ONE field and rule 119 collapses setup to ONE fact
line; between them the pin, the extent and the kind — the WHERE band's three answers — have no
post-generate route at all. Part 1 §5.6 makes DISCARD re-collapse the band, so DISCARD is not
that route either. Ruling e is silent on it, which is why the link was built and flagged rather
than assumed.

**What it is, exactly:** the revision band's second link. It returns to the full column and
**keeps the staged set** — abandoning a route is not abandoning a change, and ruling 191 folds
whatever is staged into one APPLY whenever that APPLY happens. It fires no request.

**What it is not:** a second way to edit the field S7 opened on. That field is the revision's
subject and its editor is the band's own.

### R7 — `--nav-h` stays 52

> --nav-h stays 52, rule 21's 48 noted as the design's figure

Ruled, and the arc's stated assumption is now the ruling. `--nav-h` is **52 px**; every arc-28
landing leg and every `scroll-margin-top` in `globals.css` is measured against it, and the
prototype's landing probe measured against it for the same reason. **Rule 21's 48 px is the
design's figure and is noted as such** — not a defect to fix and not a number the build derives
from.

### The dimmed-results contrast issue

Filed as **#295**. The draft this arc carried retires with it; nothing further to post.

## The 2026-09-23 hand-check — two defects and one gap

Ryan, verbatim:

> Ryan's hand-check found two defects and one gap. Stop new work.
>
> Defect 1 — the kind is never chosen. Shoulder work arrives pre-selected and the confirm only
> appears under CHANGE. That violates the ruled guardrail "the kind is confirmed, never
> inferred" (FLOW.md §5a, #281 §4.4, P21). Fix: after a road is confirmed, the WHERE band shows
> the three kind chips with NONE selected and the primary disabled with the reason "choose the
> kind of work"; only an explicit chip click selects, and the WHAT band stays pending until the
> kind is confirmed. Test it at payload level: no scenario kind is set without a click.
>
> Defect 2 — CHANGE ONE THING opens speed without asking. The user picks the field. Fix: the
> setup fact line's values each become their own link (speed, lanes, width, road type,
> jurisdiction, dates, kind, location) and clicking one opens that field in revision; or CHANGE
> ONE THING opens a picker of the fields first. Recommend one, build it, record the choice.
>
> Then stop. Gap 3 — visual fidelity against the Direction A mock-up — is its own pass, next,
> once Ryan provides the frames as images.

### D1 — what "confirmed" is, as built

`scenario.kind` is a discriminant: the type admits no scenario without one, so
`DEFAULT_SCENARIO` carries `shoulder` before anyone has chosen anything. That is the
pre-selection the hand-check found. The fix therefore cannot be "leave the kind unset" — it is
a SECOND fact, held by the shell and never sent on the wire, that says whether a person chose
it:

| state | reached by | chips | WHERE primary | WHAT band | Generate |
|---|---|---|---|---|---|
| `none` | a fresh sandbox session | none pressed | disabled · "choose the kind of work" | pending · "choose the kind of work" | blocked, same sentence (`deriveRail`) |
| `picked` | a chip click — the only writer | the clicked one pressed | enabled · "Confirm — <kind>" | pending | blocked |
| `confirmed` | the primary press | pressed | — | opens | per the rest of the chain |

- A chip click moves the state to `picked` even when it re-picks the kind already on the
  scenario (the default's own chip) — the click is the choice; the value being equal is not.
- A chip click after confirmation returns the state to `picked`: a changed kind is confirmed
  again, by the press.
- `initialScenario` (production: `app/app/plans/[id]` only — a saved plan) starts
  `confirmed`. The plan's kind was chosen when it was made.

### D2 — the choice, recorded

**Chosen: the per-value links.** Recommended over the field picker because:

1. P22's own sentence is "pick the field, change it, see what it did" — and the fact line
   already prints every value. The value IS the field; a picker would list the same values a
   second time, one click further away.
2. P18 (one question per step): a picker asks "which field?" before the question the user
   came with. The link answers it by being pressed.
3. Rule 33's "a CHANGE link focuses the band it re-opens" already describes a link per target.

The setup fact line becomes linked values, in rule 119's order with Ryan's additions slotted
in: **kind · location · extent · speed · lanes · width · road type · jurisdiction · dates**.
The trailing CHANGE ONE THING link retires (rule 5: stated); the row's right track carries a
provenance word instead (rule 134: a row offers a link or a word).

| value | opens | why |
|---|---|---|
| speed, lanes, width, road type, jurisdiction | S7 **on that field** — `REVISING · <FIELD>` | the five `StagedFieldKey`s; each has its writer in `what-writes.ts` |
| kind, location, extent | the column, **WHERE band open** | no staged writer exists — see below |
| dates | the column, **WHAT band open** (its second group) | as above |

**The four that do not open "in revision" — a deviation, flagged for a ruling.** Ryan's text
says a click "opens that field in revision". `StagedFieldKey` is a closed set on purpose
(types.ts: "a field with no writer would be a silent set"), and kind, location, extent and
dates have no staged writer: the kind switch carries the carry-across and three re-apply guards
(GeneratorSidebar `onKindChange`), the pin is the picker's save through `withPin` and the scan's
invalidation, and the dates write through `setWorkDates`. Minting four staged writers is its
own arc. Until then these four open the column on the band that owns them — the ruled CHANGE
SOMETHING ELSE route (above), landing on the right band instead of the natural one. The staged
set survives it, as that ruling requires.

`lanes` has no link for a kind with no lane count (flagger: TA-10's definition, #209) — the
value is not on the line, so there is nothing to press.

Rule 15 holds on the new links: each value is an inline-flex box with the 32 px floor (44 px in
the ≤480 block), the `.tr-signpost` pattern. The first draft leaned on WCAG 2.5.8's inline
exception; the #288 hit-target contract refused it ("rule 15 admits no exemption"), correctly.

### Open for a ruling — three things this fix raised and did not decide

1. **The chip row's gate, widened by one case.** The 2026-09-22 hand-check ruled the chips
   render "only once a road is confirmed". With the kind now owed before Generate, a pin that
   no picker save ever touched — the no-token manual path, `confirmedRoad === undefined` —
   would have no chips and no way to answer, and could never generate. Before this fix that
   pin generated on the silent default. Built: the row also renders for that case. (A picker
   save that resolved NO road writes `confirmedRoad: null` and already rendered the chips
   under the old predicate — `null !== undefined`.) A stale road still hides the row.
   Rule it, or say the manual path should reach the kind some other way.
2. **CHANGE SOMETHING ELSE, now redundant.** It was approved (above) as the post-generate route
   to pin, extent and kind. The kind, location and extent links are now direct routes to the
   same band. Kept, because it was ruled; its own prop note said it retires if the line grows a
   link per value. Retire, or keep as the "somewhere else" route?
3. **The four values that open a band, not S7** (the deviation above). Mint staged writers for
   kind / location / extent / dates in their own arc, or accept band-opening as their revision.

### Findings, recorded and NOT fixed ("stop new work")

- **Pre-generate verification still sends the placeholder kind.** Before any chip is clicked,
  the audit and breakdown fetches (the live verdict strip, the corridor extent rows, the
  jurisdiction cell) carry `kind: "shoulder"` — the discriminant's placeholder. Generate and
  every deliverable are gated, so no PLAN is built on it, and the mounted suite proves that at
  payload level. But the strip's pre-generate verdict (e.g. "READY FOR TCS REVIEW" in
  `GeneratorShell.no-location.test.tsx` at a fresh pin) speaks for a kind nobody chose. Rule 10
  question: suppress the pair until the kind is confirmed, or have the strip say it is
  awaiting the kind. Needs a ruling; it touches the corridor extent rows in WHERE, which read
  the audit.
- **S7's field edits are counted as "corrections" outside the panel** (pre-existing since
  `fd86079`). With one FIELD staged, the NEEDS YOU conditions block reads "1 correction staged
  · not yet applied · Apply 1 correction" and the stale ribbon reads "Previous answer — 1
  correction staged", while the panel correctly says "1 field staged". Both count the shared
  staged list's length (`NeedsYouConditions.tsx`, the #254 ribbon). Ruling 191's enumeration
  (`stagedEnumeration`) is the producer they should read.
