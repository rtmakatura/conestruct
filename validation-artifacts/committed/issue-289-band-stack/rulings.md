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

## The 2026-09-23 rulings on the hand-check ship (`b80bdeb`)

Ryan, verbatim:

> Shipped. Rulings: (1) chips on the manual-entry path — approved; (2) CHANGE SOMETHING ELSE —
> retire it, the value links replace it; (3) kind/location/extent/dates open their band —
> accepted until Phase 3 rebuilds them. Record all three in rulings.md.
>
> Fix both findings, one commit each on a branch off main: the live checks send no kind and
> the verdict strip says only "choose the kind of work" until the kind is confirmed — no
> verdict for a kind nobody picked (Rule 10); and the staged sentence in NEEDS YOU and the
> ribbon enumerates what is actually staged ("1 field", "1 correction", "1 field · 1
> correction") from the one staging list. Plus the CHANGE SOMETHING ELSE retirement. Verify,
> stop with the ship line.

What each open question above now is:

1. **The chip row's widened gate — RULED, approved.** The row renders for a confirmed road
   (including a no-road picker save) and for a pin no picker save touched. Stale hides it.
2. **CHANGE SOMETHING ELSE — RULED, retire.** "The value links replace it." Its 2026-09-23
   approval above is superseded; the retirement is its own commit on this branch.
3. **The four band-opening values — RULED, accepted until Phase 3.** Kind, location, extent
   and dates open the band that owns them; Phase 3 (#290) rebuilds them. No staged writers.

### Finding 1, as built — "the live checks send no kind"

`scenario.kind` always holds a value, so sending "no kind" means sending no check. Every
sender of the scenario, enumerated:

| sender | before a confirmed kind |
|---|---|
| audit, device breakdown (`GeneratorShell`) | **not fired**; fire the moment the kind is confirmed (`checksArmed` in both effects' deps) |
| S7 preview (`firePreview`) | not fired |
| picker corridor-spec (`LocationPickerModal`, `initial.kindConfirmed`) | not fired; the panel says "Corridor lengths wait on the kind of work — choose it after you save." |
| bundle, per-file downloads, save, quote | post-generate; Generate is gated on the same confirmation |
| jurisdiction suggest | sends lat/lng only — no kind; unchanged |
| debug snapshot (`?debug=1`, on click) | not a check; unchanged |

The strip: a new first-ranked state, true only with a pin and no confirmed kind, rendering
`◌ choose the kind of work` in the chromeless no-verdict register — ranked above INVALID INPUT,
because those client bounds are the placeholder kind's and the ruling is "says only".

**Rule 5, stated — three consequences:**
- **#260 P2 has one exception now.** P2 kept the strip to the state and left the instruction to
  the CTA reason, "the one live speaker". In this one state the strip says Ryan's instruction by
  ruling, so the strip and the CTA reason both carry it.
- **The picker's corridor preview does not draw on a first pass.** The picker opens before the
  chips exist (they render once a road is saved), so on a fresh session it says the lengths wait
  on the kind; the WHERE band's corridor rows show them once the kind is confirmed. A re-opened
  picker after confirmation draws as before.
- **A kind re-picked after confirmation pauses the checks** and the WHERE corridor rows drop the
  held lengths — they were the previous kind's (rule 10: a stale answer is not presented as
  current). The held audit and breakdown stay in state for the results on screen, which are the
  confirmed kind's plan.

Test mounts: four suites that stub the whole column (bundle-settings, suggest-contract,
class-suggest, suggestion-records) can render no chip, so they now mount as a saved plan does
(`initialScenario={DEFAULT_SCENARIO}`, confirmed) — the same unpinned default they mounted
fresh. Their subjects are not the kind; `GeneratorShell.kind-confirm` owns it.

## The strip's wording in the kind-unconfirmed state — after the prod check, 2026-09-23

Relayed with Ryan's confirmation of the kind gate on prod, verbatim:

> Ship the pending strip-wording commit if it isn't shipped ("◌ AWAITING KIND OF WORK" on the
> strip, "choose the kind of work" only on the disabled primary).

No such commit existed on any branch, stash or working copy when this was checked (origin/main =
`193faab`), so it was built as its own commit and is NOT shipped by this session — the go named a
commit that did not exist.

What it changes: the strip reads **`◌ AWAITING KIND OF WORK`** — the state, in AWAITING LOCATION's
register — and the instruction "choose the kind of work" is the disabled primaries' alone (the
WHERE confirm's reason and the Generate frame's CTA reason, which is rule 139's one string). This
**supersedes** finding 1's Rule 5 note above ("#260 P2 has one exception now"): there is no
exception any more; the strip names the state and the CTA reason is the one live speaker of the
instruction, as #260 P2 ruled.

**Open for a ruling:** the WHAT band's pending line still reads "pending — choose the kind of
work" (rule 59: a pending line states why). It is a fact line, not a primary. Keep it, or
reword it to a state ("pending — kind of work not chosen")? — **RULED below.**

## The fidelity checkpoint rulings — Ryan, 2026-09-23

On `fidelity-audit.md`'s Q1–Q7, verbatim:

> Q1 yes — Part 2 rules 3–6 replace #226's values, dotted underline dropped. Q2 yes — remove
> the H1, "02 · GENERATOR", the frame corners and v0.4; DEMO stays in the nav's normal colours.
> Q3 as recommended — the corridor rows become provenance under the extent field, block header
> and border gone. Q4 as recommended. Q5 keep ⌁ — it is in DESIGN-SPACING's reconciled
> vocabulary as "proposed"; Part 2 rule 17's list omitted it; record that. Q6 rule 29's words,
> after confirming the PDF's draft line is its own string. Q7 rule 167 now, 168–169 to Phase 4.
> WHAT's pending line reads "pending — kind of work not chosen".
>
> Record all of it in rulings.md. Build F1–F8 as planned, one verified commit each, on a branch
> off main after the audit ships. Stop once at the end with: the verdict, the file table, a
> before/after screenshot pair per state at both widths, the re-run audit's delta count, and
> the ship line. Do not ship partway.

What each ruling resolves to in the build:

| Q | ruled | the build |
|---|---|---|
| **Q1** | Part 2 rules 3–6 **supersede #226's GO-ruled values** for the four label roles | `type-roles.ts` and its four CSS blocks: section 10 / 1.2 / 500 / .18em / #eaf0f7; step 10 / 1.2 / 400 / .12em / #93a0b0, **no CSS uppercase** (the caps are written into the strings, rule 4); field 12.5 / 1.4 / 500 / #eaf0f7; provenance 10.5 / 1.5 / 400 / #93a0b0, **no underline**. #226's values are recorded as superseded, not deleted from history. |
| **Q2** | remove the H1, "02 · GENERATOR", the frame corners and `v0.4`; **DEMO stays**, in the nav's normal colours | DEMO renders #93a0b0 (rule 22's nav-item colour), not orange |
| **Q3** | the corridor rows become **provenance lines under the extent field**; the block header and its border go | the `CORRIDOR EXTENT` header and the `.a-detect` dotted top rule are removed; the zone rows and the wait / unavailable notes render in the extent field's provenance stack |
| **Q4** | as recommended | the strip's expandable check list (X7) is **removed**; the "SITE CONDITIONS — SCANNED" sub-header (X13) **stays** (§8.5 "kept whole"); the file count is stated **once, on the download row** (ruling 193), not under the zip button |
| **Q5** | **keep ⌁** | `⌁` is in the reconciled symbol vocabulary: `conestruct/site/DESIGN-SPACING.md:111` gives it "proposed — a suggestion awaiting Confirm/Dismiss", `--ink-on-dark`, and DESIGN-PRINCIPLES' fixed vocabulary lists "▲ ✓ × ⚠ ◌ ⌁". **Part 2 rule 17's list ("✓ ▲ ⚠ ◌ × i") omitted it**, recorded here as the spec's omission, not a build defect. It takes rule 17's treatment (mono 12.5 / 1) and DESIGN-SPACING's colour. |
| **Q6** | rule 29's words, **after confirming the PDF's draft line is its own string** | **Confirmed:** the PDF's line is its own string, "GENERATED BY CONESTRUCT — DRAFT FOR PE REVIEW. NOT A SEALED PLAN." (`src/rendering/plan_sheet.py:3309`). The web notice (`GeneratorShell.tsx`) shares no producer with it, and no other surface renders the web sentence (the terms page and the save dialog carry their own). #198 byte-identity does not bind them. The notice becomes rule 29's two sentences, verbatim, in provenance role. |
| **Q7** | **rule 167 now**; 168–169 to Phase 4 | NEEDS YOU items go 18 / 1fr at ≤480 with the citation moved into the provenance line and the actions on their own full-width row. The 380 download cards and hero geometry cell **stay** until Phase 4. |
| — | WHAT's pending line reads **"pending — kind of work not chosen"** | a state, not an instruction: the instruction lives only on the disabled primaries (the 2026-09-23 strip ruling) |

**Two consequences of Q1 found while building F2, recorded rather than decided silently:**

1. **#226's two-axis rule and role 5.** Under Part 2's values the field label (rule 5) and the
   step question (rule 7) share family, casing, tracking and colour and differ only in size (and
   in weight, which #226's rule does not count). That is Part 2's own design. #226's rule was
   written for the four LABEL roles; the question joined the table at #283 and is not a label.
   `type-roles.test.ts` now names field ↔ question as the one pair allowed a single axis, and
   still fails if it loses its size difference, or if any other pair collapses. **If the rule
   should hold for role 5 too, Part 2's rule 5 or rule 7 has to move — a ruling.**
2. **The step index's caps are written, not transformed** (rule 4). Every `.tr-step` consumer
   was checked: step indices, counts and the NEEDS YOU result tags are already written in caps;
   `.act` states rule 133's own uppercase; citations take rule 11 (no uppercase — they print as
   authored); the schedule windows heading writes its caps into the string.

**Finding, not fixed in F2:** `var(--fs-provenance)` is read by `.a-panel-status` and counted
by the type census, but **no `--fs-provenance` token is declared anywhere** (`:root` carries
#283's nine, and `tokens.test.ts` pins exactly those nine). The S7 status row therefore
inherited its size, which is the audit's 16 px row. F7 fixes that row; the census comment that
says the token "has been on every provenance line since #283 declared it" is corrected there.

**The build:** F1–F8 per `fidelity-audit.md`'s fix plan, one diff-verified commit each, on
`issue-289-fidelity`. That branch is stacked on `issue-289-fidelity-audit`'s tip (`85c865c`):
the audit ships as a fast-forward, after which `main` is that tip, so this branch is "off main
after the audit ships" without waiting on the ship. It ships only after the audit, and only
once, at the end.

## The in-flight opacity — a measured departure from rule 95.5 (Ryan, 2026-09-24)

Ryan, verbatim: "Ruling: 60% opacity for in-flight figures stands — 42% measures 3.04:1, under
the 4.5:1 floor; record it in rulings.md as a measured departure from rule 95.5."

- **Rule 95.5**, "in flight — the cell's resting treatment at opacity .42 — the value stays
  readable and is visibly not current".
- **Measured:** the in-flight "now" cell is always the resting `#c8d1dd` (never the changed
  orange), over the panel's `#0f1c29`. At .42 the composite is `#5d6875`, **3.04:1**, under the
  4.5:1 floor project rule 13 holds; `.58` is the least opacity that clears; **`.6` measures
  4.84:1** (composite `#7e8995`). Rule 122 says the same of S7's own dim: text inside it "must
  still clear 4.5:1 after the dim".
- **Built:** `.workbench .a-panel-row .a-now.is-inflight { opacity: 0.6 }` in `19076b3`
  (shipped). `RevisionPanel.test.tsx` computes the ratio from the sheet's tokens on every run
  and fails under 4.5.
- **Status:** RULED — the departure stands. Rule 95.5's `.42` is superseded here by `.6`.

## The verdict strip's reserved height, re-measured after rule 165 (2026-09-24)

Ryan: "Re-measure the verdict strip's reserved height at 380 now that it wraps and correct the
70 px if it's wrong." Measured on prod at `19076b3` (`strip-reserve/`): the tallest natural
strip at 380 is **79.25 px** (the pill states, wrapped), against the 70 reserve — **corrected
to 80** on `issue-289-strip-reserve`. By ruling 4 of the s2-arc26 landing rulings (the 380
landing is the formula's), the 380 post-generate landing moves with it: **164** (was 154).

**Open for a ruling — 1440.** The same run measures the pill states at **56.25 px** at 1440
against the 52 reserve (F5's rules 50–52: 13 + 28.25 + 13 + 2), so the first verdict still
pushes the stack 4.25 px. The measured fix is 57, but ruling 1 of the same file fixes the
1440 landing at **"136 ±1"** and 57 would land it at 141. Not changed: raising the reserve,
or holding it at 52 and accepting the 4.25 px shift, is a choice between two ruled figures.
