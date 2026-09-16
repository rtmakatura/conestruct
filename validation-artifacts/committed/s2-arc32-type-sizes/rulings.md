# s2-arc32 (#283) — the rulings this arc was built under

**Ruled by Ryan, 2026-09-16**, in chat, at the arc's 📋 checkpoint. Quoted verbatim
below. This file is the arc's authority: every commit on this branch cites it, and the
diff-verifier checks the commits against it rather than against a message it cannot read.

Filed retroactively — this arc's three code commits landed before the convention existed
(adopted 2026-09-16, same session). From the next arc on, `rulings.md` is the arc's
**first** commit.

**Issue:** #283 — "Nine new type sizes and the fifth type role land as one ruled
exception commit with owners". **Phase:** 0 (#287). **Design authority:** #281.

---

## The GO, verbatim

> #283 GO — all six as recommended.
>
> a. Owners per the table; each size's owner is the Direction A rule number that
> consumes it (Part 2 rule N), written into the exception entry so the census fails if a
> size loses its owner.
>
> b. Nine new declared sizes, not fewer. The four existing `text-[12.5px]` Tailwind uses
> in SetupStrip become legitimate under the 12.5 entry retroactively — record that in the
> commit message as a declared consequence (Rule 5), not an accident; SetupStrip is
> dropped in Phase 2 anyway, so the debt is short-lived.
>
> c. Role 5 breakpoint = 520 px, per #281 ruling 180 ("19 px below 520"), via the same
> container query the #249 ledger uses. Not 380: the 380 figure in Part 2 rule 162 is the
> phone example, and 520 is the ruled switch.
>
> d. CSS custom properties on `:root` for the sizes and a `tr-question` class for role 5;
> `tokens.ts` exports the same values for the tests. One source, two readers — the tests
> assert they agree.
>
> e. The two hexes go into the ink-literals allowlist with ruling 181 cited, and into
> DESIGN-PRINCIPLES' rulings section (already written). Nowhere else.
>
> f. One commit. Red-prove: the widened `type-roles.test.ts` pairs and the census count
> fail before the code, pass after.
>
> Acceptance is #283's: nothing renders differently — rect and screenshot baselines
> unchanged is the proof, and the diff-verifier report says so with the file list. Stop
> with the verdict and the ship line.

---

## What the build did with each — including where it departed

A rulings file that only quotes is half a record. Two rulings were executed as written,
one rested on a wrong premise, one could not be executed at all, and one was overtaken by
a verifier finding. All four are recorded here, not only in commit messages.

### a — owners per size. **Executed, then repaired.**

`lib/design/tokens.ts` names the Part 2 rule that consumes each size. The first commit
(`1f4908d`) cited those rule numbers with nothing in the tree to check them against, and
**the diff-verifier returned REPAIR** — Part 2 is comment 1 on #281 and is not committed,
so eleven rule numbers were unverifiable. Remedy (a) from the verifier's report was taken
in `9569b45`: `part2-owners.md` in this directory quotes all eleven rules verbatim, so an
owner can be checked by subject. This is the finding that produced the `rulings.md`
convention.

### b — nine sizes, not fewer. **Executed. Its stated premise is false.**

Nine sizes are declared. But the sentence about the four `text-[12.5px]` uses does not
hold, verified in source at `fb49ab8`:

- **There are zero `text-[12.5px]` uses anywhere in the tree.**
- The four existing 12.5px uses are `font-size` declarations in `app/globals.css`, on
  `.workbench .dl-btn`, `.refchip .chip-sum .detail`, `.stale-ribbon`, `.wb-object`.
- The count of four is right; the mechanism (Tailwind) and the surface (SetupStrip) are
  not, and **three of the four are Phase 1 surfaces, not Phase 2** — so "SetupStrip is
  dropped in Phase 2 anyway, so the debt is short-lived" does not describe them.

Consequence recorded rather than folded: those four rows, plus three 15px rows and
`Nav.tsx`'s single `text-[22px]`, **keep their existing debt entries**. They share a pixel
value with a ruled size, not its owner; folding them would claim a role they do not play.
The retroactive-legitimacy effect the ruling intended does not apply, because the sizes
live on `:root` and the census never sees them.

### c — 520, not 380. **Executed as written.**

`.workbench .tr-question` switches at `@container (max-width: 519px)`, the #249 ledger's
existing breakpoint and mechanism. Note both Part 2 rule 7 and rule 162 say 380; this
ruling overrides both, and `part2-owners.md` records that departure beside the quoted
rules.

**Declared, not measured.** Nothing mounts `.tr-question` yet — the band stack is Phase 2
(#289) — so no container exists to exercise the query. The 520 switch must be measured by
the phase that mounts it.

### d — `:root` + `tokens.ts`. **Executed as written, and it is load-bearing.**

This ruling is what makes the whole arc legal. #281 requires the sizes to land before any
surface uses them; `type-census.test.ts` asserts observed == declared in both directions,
so a declared-but-unused size would be a stale row and fail. The census parser **excludes
`:root`** — so `:root` is not a stylistic choice, it is the mechanism. `tokens.test.ts`
pins the `:root` home for exactly that reason: a drift into `.workbench` would silently
re-enter the census and lose the property.

### e — the two hexes. **Half executed; the other half needed a mechanism that did not exist.**

DESIGN-PRINCIPLES was already correct (`DESIGN-PRINCIPLES.md:153`), as the ruling says.

The ink-literals allowlist half **could not be executed as written**, for ruling d's
reason: `ink-literals.test.ts` asserts observed == declared in both directions, and
neither hex is written anywhere. Verified — `#3fd3a8` appears nowhere in
`conestruct/site`; `#e0a63c` appears only at `SetupStrip.tsx:276` (a comment, and the
parser strips comments) and in `SetupStrip.grid-tokens.test.tsx` (a *negative* assertion,
and the parser excludes `*.test.tsx` at `ink-literals.test.ts:102`). An allowlist row for
either would be a stale row.

**The mechanism used is the implementer's, not ruled:** `INK_RESERVED`, a fourth
disposition whose rows assert **absence**. It was flagged as such when shipped
(`cb9b0f0`) so it can be overruled. It honours "nowhere else" literally — each hex exists
in exactly one place, and `ink-exceptions.ts` is the one file the code scanner skips by
construction — and it cannot go stale, because what it asserts is that the hex is *not*
there. The day a surface paints one, the assertion fails and forces it into a real bucket
with its site.

One assertion beyond the ruling: **`ZONE_COLOR` must not contain either hex.** The
corridor work zone paints `#1EC8A5` today and Direction A's `#3fd3a8` would replace it —
a *render* change, so it belongs to the phase that redraws the overlay, not to #283.

### f — one commit, red-proved. **Red-proved as written. Not one commit.**

Red-prove was done and recorded:

- pair enumeration — *"expected [ [ 'section', 'step' ], …(5) ] to have a length of 10 but got 6"*
- token table — *"expected [ '--bar-seg-min', '--glyph-cell' ] to deeply equal [ '--bar-seg-min', …(10) ]"*
- census — the two new `.tr-question` declarations undeclared, and `cssDeclarations` 103 → 105
- reserved ink (`cb9b0f0`) — appending `#3fd3a8` to `lib/corridor-zones.ts` failed with
  *"#3fd3a8 is reserved but used in code: expected [ 'lib/corridor-zones.ts' ] to deeply
  equal []"*; scratch reverted

**The arc is three commits, not one.** `1f4908d` is the ruled commit; `9569b45` is the
verifier-mandated citation repair; `cb9b0f0` is ruling e, which was still unresolved when
`1f4908d` landed. Squashing them would erase the REPAIR cycle, which is the part of this
arc most worth keeping on the record.

---

## Acceptance, as ruled

> nothing renders differently — rect and screenshot baselines unchanged is the proof, and
> the diff-verifier report says so with the file list.

Met, and proven mechanically rather than asserted — there are no baselines to re-record
because nothing can have moved:

- `app/globals.css`: **43 insertions, 0 deletions** across `main...HEAD`.
- **No `.tsx` file in the branch diff at all.**
- **No `.tsx` references `tr-question`.**
- `ZONE_COLOR` unchanged; the corridor work zone still paints `#1EC8A5`.

Frontend suite 147 files / 1174 tests green; `tsc --noEmit` clean.

## Verifier verdicts

| commit | verdict |
|---|---|
| `1f4908d` | **REPAIR** — Part 2 rule numbers unverifiable against the tree |
| `9569b45` (repair cycle 1) | **PASS** |
| `cb9b0f0` | **PASS** |
