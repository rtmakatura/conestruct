# #283 — the owner of each of the nine type sizes, quoted

**Why this file exists.** `lib/design/tokens.ts` and `DESIGN-SPACING.md` attribute each
of Direction A's nine type sizes to the Part 2 build rule that consumes it. Part 2 is
**not in this tree** — it is comment 1 on issue #281 — so a bare "Part 2 rule N" is a
citation to an untracked source, which the diff-verifier correctly rejects (#160, ruled
2026-07-30). The repair is the standing one: quote the source text into
`validation-artifacts/committed/` so every number is checkable by subject, not by number.

**Source, exactly.** GitHub issue #281, **comment 1**, "Part 2 — The Build Spec
(rev. 2026-09-16)", 43,813 characters, read 2026-09-16. Retrieved with
`gh issue view 281 --json comments --jq '.comments[0].body'`. Quotes below are verbatim,
including line breaks; each is the full rule as it appears, except rule 130 where the
state table below the first sentence is elided (marked).

**Verified by subject, not by number:** each quote is reproduced in full so the reader
can confirm the size *appears in the rule*, rather than trusting that rule N is about
size X. Where the rule and the ruling disagree, that is called out.

---

## 22 px — `--fs-step-question`

> 7. Type role 5 — STEP QUESTION. NEW ROLE, requires your ruling (rule 180).
>    Inter 22 px / 1.25, weight 600, #eaf0f7, sentence case, ends in a question
>    mark. Variant 19 px at 380 px.

Independently corroborated outside Part 2: `DESIGN-PRINCIPLES.md:151` carries ruling 180
with the same values.

## 19 px — `--fs-step-question-520`

> 162. Step question 22 → 19 px. Everything else in the type scale is unchanged —
>      no other size moves, so provenance stays 10.5 px and body stays 13.5 px.

**Rule 7 and rule 162 both say the variant is at 380 px. Both are overridden**: #281
ruling 180 reads "19 px below 520", and the GO of 2026-09-16 (ruling c) settled it —
520 is the switch, and rule 162's 380 is the phone example the section is written
around. The implementation uses 519px, the #249 ledger's existing container breakpoint.
This is the one place where the build deliberately departs from Part 2's own wording.

## 17.5 px — `--fs-primary-xl`

> 131. PRIMARY XL (.pri.xl). Height 66 px, 17.5 px. Used only for GENERATE PLAN
>      in S3 and the generate frame at 380.

## 15.5 px — `--fs-primary`

> 130. PRIMARY (.pri). Full width of its container, height 56 px, ground
>      #34a9e8, text #0c1622 Inter 600 15.5 px, no border, display flex centred,
>      gap 10 px.

*(The rule continues with a default/hover/active/focus/disabled/busy state table; no
other size appears in it.)*

## 15 px — `--fs-refusal`

> 9. Item body (inside NEEDS YOU and the refusal block). Inter 13.5 px / 1.5,
>    #eaf0f7; the leading clause in weight 600, the rest 400. Refusal sentence
>    only: 15 px.

Note the rule carries **two** sizes: 13.5 px for item body generally, 15 px for the
refusal sentence alone. That is why rule 9 is cited as an owner of both `--fs-refusal`
and (with rule 8) `--fs-body-value`.

## 13.5 px — `--fs-body-value`

> 8. Body value. Inter 13.5 px / 1.45, weight 400, #c8d1dd. Strong variant
>    weight 500, #eaf0f7.

Plus rule 9's item body, quoted above.

## 12.5 px — `--fs-field-label`

> 5. Type role 3 — FIELD LABEL. Inter 12.5 px / 1.4, weight 500, #eaf0f7,
>    sentence case.

> 17. Symbols are text, not icons: ✓ ▲ ⚠ ◌ × i, mono 12.5 px / 1, rendered
>     with font-variant-emoji: text. Colours per rule 18.

Two consumers at the same size, one sans and one mono — which is why the token is named
for the field label but cited to both rules.

**Standing conflict, recorded not resolved.** Part 2 rule 5 sets the field label at
**12.5 px**; the shipped role 3 is **12 px** (`lib/design/type-roles.ts`, unchanged by
this commit). Part 2 rule 6 likewise sets provenance at 10.5 px against a shipped 10 px.
Both are resizes of *rendered* roles, so they are out of scope here — #283's acceptance
is that nothing renders differently — and belong to the phase that redraws those
surfaces. The token declared here is the Direction A value; adopting it is that phase's
change, not this one's.

## 62 px — `--fs-hero-numeral`

> 10. Generated numerals. Mono, weight 500, #ff8a2e. Hero size 62 px / 1;
>     quiet/absent variant #6e7c8e.

> 81. Cells 1–2: quiet section header (rule 3) → numeral, mono 500 62 px / 1
>     #ff8a2e, margin 10 px 0 8 px → sub-line in provenance role. Sub-line
>     extensions ("· incl. +N jurisdiction-required", "· N from {jurisdiction}")
>     unchanged.

## 42 px — `--fs-hero-numeral-380`

> 169. The counts hero goes to 2 tracks and the numerals to 42 px; the geometry
>      cell is not rendered — its four rows are reachable in the reference
>      disclosure.

---

## The list itself, corroborated in the tree

Independently of Part 2, the nine values are recorded on main at
`DESIGN-PRINCIPLES.md:154`:

> **New type sizes land as one ruled exception commit** with owners before any surface
> uses them (22, 19, 17.5, 15.5, 15, 13.5, 12.5, 62, 42 — from Direction A's Part 2).
> Never as debt.

and in #281's own phase list (Phase 0). So the *set* was already checkable in the tree;
what this file adds is the *owner per size*, which was not.

## What is still not checkable from the tree

Part 2 in full. This file quotes eleven of its ~204 rules — the eleven these nine sizes
cite. Anyone re-verifying should read comment 1 on #281 directly; if Part 2 is ever
committed, this file becomes redundant and should be deleted rather than left to drift.
