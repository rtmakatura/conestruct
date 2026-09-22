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
