# s2-arc30 — the detected-vs-applied block rebuilt as the applied-forward ledger (#273, folding #278)

Branch `issue-273-ledger`, cut from `main` at `b2a325a`. Frontend only: no
wire field, no backend change, no snapshot or expectation re-baseline.
`/healthz` sha `b2a325aa2218949796ce6784a8bc248dca7c3283`, gated at the start
of the run and printed as the first line of `outLocal-*/log.txt`.

Investigated 2026-09-11 against the posted #273 body (the issue was rewritten
as the variation-01 build spec with six rules marked **[AMENDED]**); 📋
checkpoint the same day; GO with eight rulings plus a measurement demand on
the row padding, answered before any code was written.

## What changed, in one paragraph

The two-column table is replaced by a list of rows. Each row is a verdict
glyph in a 16 px gutter, the **applied** value on line 1 beside its label, and
one generated provenance clause on line 2 that always names the detected value
and its tokens. The honesty the last two arcs landed all survives, in clause
words rather than in cells. What retires is geometry: the fixed 132 px value
tracks, the header row and its hairline, the reserved per-cell slot, and the
520 stack.

## The acceptances that retire with the shape

#273's round-2 acceptances were written against a grid that no longer exists,
and they are recorded here as retired rather than left standing against a
layout they do not describe:

- **"the header's ink right edge equals its column's value ink right edge
  (±1)"** — there is no header row. Retired.
- **"the two value tracks are equal and fixed, sized to the widest value in
  the domain"** — there is one value per row now, and no track. Retired.
- **"row labels share one left edge"** — still true, and now trivially so:
  every label starts the row body.

#274's acceptance **"the rows measured by construction carry NO marker"**
retires here too, ruled 2026-09-11. It described the two-column shape, where a
token appeared only where one existed and there was nowhere honest to put one
for a row carrying no guess. The clause has a token position on *every* row, so
it must be filled truthfully — and `no source tag` is false about a value read
from a posted `maxspeed`. Speed limit and Lanes per direction now state the
method the classifier already held (`fields.speed.method` /
`fields.lanes.method`, set at `classify.ts:237-294`). Bearing still says
`no source tag`, because it comes off the candidate geometry and genuinely has
none. What #274 actually protects is untouched and still asserted: an inferred
value never renders identically to a measured one.

**The outcome those acceptances existed for survives, and is measured.** The
applied values still share one right edge — measured ink spread across rows
**0.0 px at both viewports** — obtained now because every row body spans the
full width, not because a track was pinned. That is the answer to conflict 1:
the spec's "do not convert the rows to a shared grid" and #273's "make the
values line up" are not in conflict, because the grid was only ever a means to
the edge, and the list gets the edge for free.

## The build corrected two figures. The build wins.

Everything the arc was ruled on was first measured on a **prototype** mounted
inside the live block's own container (prod `b2a325a`, real served fonts, real
role classes). That is stronger than a text probe and weaker than the build,
and on two counts the build disagreed:

1. **The clause slot stood 25.6 px against its 16 px reserve.** The clause is a
   `span` inside a `div`; a span's own line-height does not set its parent's
   line box, which inherited the panel's 1.6. The prototype styled the clause
   element directly and could not show it. Fixed by putting the line-height on
   the slot.
2. **Then it stood 19 px.** The remaining 3 px was the slot's *strut* —
   baseline-aligned against the inherited body font's ascent rather than the
   clause's 10 px. Fixed by making the clause a block, which removes the strut
   from the question and keeps it one element and one text node.

With both corrections the row measures **44.2 px at 1440** and **60.2 px at
380**, which is what the padding sweep predicted (44 / 60). Neither defect was
visible in any test; both were found by driving the real build.

## The measured figures (real build, `outLocal-a0d4781/`)

| | 1440×1000 | 380×900 |
|---|---|---|
| block | 500 × **292.8** px | 282 × **388.8** px |
| the block today, same fixture [^today] | 276.4 px | 405.1 px |
| delta | **+16.4** | **−16.3** |
| content / row body | 478 / 456 | 260 / 238 |
| row height (last row) | **44.2** (43.2) | **60.2** (59.2) |
| clause reserve | 16 px, one line | 32 px, two lines |
| applied-value ink right spread | **0.0 px** | **0.0 px** |
| worst MATCH clause | 236.8 px — fits | 236.8 px — fits by **1.2 px** |
| worst DIFFER clause | 332.8 px — one line | 332.8 px — **two**, inside the reserve |

[^today]: `s2-arc29-detected-applied/outLocal-after-6ab5d87/log.txt:3` and
`:76` — the arc-29 round-2 local run, committed at `b2a325a` and therefore
reachable from this branch. The same two figures were reproduced against live
prod `b2a325a` by this arc's checkpoint probes; the committed artifact is the
citation because a scratch probe is not one (#160).

**On the height price.** The GO accepted "+80 px at 380, +59.6 at 1440". Both
figures compared a **five-row** prototype against today's **four-row** block —
the E Bayaud way carries no `maxspeed`, so Speed limit correctly does not
render (Rule 10). Measured like against like, on the same fixture, the ledger
is **16.4 px taller at 1440 and 16.3 px shorter at 380** than the table it
replaces. The accepted price was not spent.

## Ruled, and where each ruling landed

| ruling | landed |
|---|---|
| 1 — keep 10 px block padding, drop spec 8.6 | `globals.css` `.dva`, with the 260→252 / 238→230 measurement in the rule |
| 2 — attack the padding, not the shape; 4/3 if it clears +60 without crowding | `.dva-row { padding: 4px 0 3px }`. Sweep below; ink gaps 7/6 = `.fact-strip .fact-cell`'s measured rhythm |
| 3 — `withdrawn` takes the value's position | structural: `provenanceClause({detectedValue: null})`, so `OSM · 2 · withdrawn` is unrepresentable |
| 4 — `changed in plan` for a domain snap | `appliedTokenFor`, keyed on `snapSpeedToDomain` / `clampLanesToDomain` |
| 5 — ✓ `--pass` / ⚠ `--warn`, drop the in-prose ⚠ | `.dva-glyph.is-match` / `.is-differ`; no vocabulary change |
| 6 — accept the line-1 wrap, fix the alignment bug | `margin-left: auto` on `.dva-val` |
| 7 — drop the last row's border, keep the caveat's | `.dva-row:last-child { border-bottom: 0 }`; the harness checks the 1 px is exactly that |
| 8 — no one-way row without an applied counterpart | guarded on the flagger kind; `rows.length === 0 → null` added |

### The padding sweep (prototype, both viewports)

Crowding was judged against rows that already ship on this panel, not against
taste: `.sched-window-row` measures 4 px ink-top / 5.6 px ink-bottom, and
`.fact-strip .fact-cell` measures **7 / 6**.

| padding | row | block @1440 | block @380 | ink top | ink bottom |
|---|---|---|---|---|---|
| 9/8 (spec 2.3) | 54 | 386.0 | 518.3 | 12 | 11 |
| 7/6 | 50 | 366.0 | 498.3 | 10 | 9 |
| 5/4 | 46 | 346.0 | 478.3 | 8 | 7 |
| **4/3 — taken** | **44** | **336.0** | **468.3** | **7** | **6** |
| 3/3 | 43 | 331.0 | 463.3 | 6 | 6 |

3/3 buys 5 px more and was declined: it is tighter on top than any shipped row
but the schedule windows. At 380 the floor is what it is — 80 px of the height
there is the two-line clause reserve, which stands.

## Why the glyphs needed no vocabulary change

The design asked for ▲ in `#f4c020`. In this house ▲ is the delta glyph in
`--dim` — `#ff8a2e`, **orange** — and the design's own rule 0.12 bars orange
from this block. The spec's constraint ruled out the spec's glyph. `⚠` already
means "changed / needs attention" and already owns `--warn`, the exact colour
asked for, so the mapping is:

| state | glyph | token | measured contrast on the block |
|---|---|---|---|
| match | ✓ | `--pass` | **8.1:1** |
| differ | ⚠ | `--warn` | **8.82:1** |
| not set | ◌ | `--none` | **5.61:1** |

`◌` is the third state the spec did not have: a plan that has taken no value
for a fact is neither agreement nor disagreement, and DESIGN-SPACING already
reserves `◌` for exactly that — "never a verdict". The in-prose `⚠` of spec
5.2 is dropped: with ⚠ in the gutter, repeating it mid-clause gives one glyph
two jobs, and the amber plus the word already carry it.

Spec 5.4's green-glyph-over-amber-clause pairing survives and is asserted by
test: a matching row whose detection was inferred renders ✓ green with the
whole clause amber. Green means the plan used what was detected. It never means
measured. Both ratios are recorded above so nobody "fixes" the pairing later.

## Type census

No new size enters the sheet and no fifth `tr-*` role is created, so no #226
ruling was needed. 9.5 → `tr-section`, 12.5 → `tr-field`, 11.5 and 10 →
`tr-prov`. The arc-29 value-register exception moves **11px → 14px** (one value
per row now, not two columns) and the verdict glyph joins the control-glyph
exception at 11px on its own rationale — a glyph cell, not text.
`CENSUS_PINS.cssDeclarations` 103 → 104; `cssSizes` stays 19.

## #198 does not bind the clause strings, and that is stated rather than assumed

The words are render-only: `meta.confirmedRoad` is explicitly not
backend-consumed (`lib/scenarios/types.ts:290-297`, "the Python backend ignores
it"), `grep confirmedRoad src/` is empty, and no expectation fixture or
deliverable carries `OSM · ` or `operator-set`. The backend's own
`operator-set` (`src/rendering/audit_blocks.py:475`) is unrelated prose about
site-scan flags. The discipline that governs these words is the frozen token
table in `provenance.test.ts` — asserted against written-out literals, not
against the exports under test, so a rename fails a test rather than passing
one.

## Churn (Rule 5): predicted at the checkpoint, actual here

| file | predicted | actual |
|---|---|---|
| `DetectedVsApplied.test.tsx` | 3 carried, 2 transformed | 5 → 5; one test's assertions transformed |
| `.layout.test.tsx` | all retire or transform | 8 → 12, rewritten for the ledger |
| `.confidence.test.tsx` | transform | 6 → 7 |
| `.lanes.test.tsx` | transform | 7 → 8 |
| `.slot.test.tsx` | D1/D2 transform, D3 retires | 14 → 9, exactly that |
| `.oneway.test.tsx` | new (#278) | +8 |

No test file was deleted or emptied; each file's header now names the contracts
that retired and why. Suite **147 files / 1152 tests**, `tsc` clean, lint clean
(one pre-existing picker warning untouched).

Arc-29 harness legs that no longer describe the layout: `s2a29-ink.js` (ink
right-edge equality) and `s2a29-threshold.js` (the label-floor stack
threshold). They are left in place as the record of what was measured then;
they are not run against this shape. `s2a29-lc.js`'s picker walk survives and
is this harness's base.

## Running it

```
node s2a30-ledger.js <outDir> <expectSha> [base]      # base defaults to localhost:3005
```

`outLocal-a0d4781/` is the local run against this branch's build: **28 pass, 0
fail, 20 info**, both viewports. The axe gate compares against the baseline
recorded at prod `b2a325a` by the arc-29 evidence run: `region` at 1440,
`region` + `scrollable-region-focusable` at 380, both naming `.gap-8`, a
page-level container. Zero violations outside that baseline, and none naming a
node inside `.dva`.

**On that citation.** The baseline was recorded in commit `3504ba6`
(`s2-arc29-detected-applied/outProd-b2a325a/geometry/axe-*-axe.json`), which
lives on the unmerged `s2-arc29-prod` branch and is **not reachable from this
branch or from main** — so citing it alone would be a citation nobody can
follow from here (#160). The two files are therefore copied verbatim into this
arc's own directory as `baseline-axe-1440-b2a325a.json` and
`baseline-axe-380-b2a325a.json`, and the harness's own baseline list is
commented with both facts. Nothing in the arc-29 archive was touched; when
`s2-arc29-prod` ships, the originals become reachable and these copies become
redundant rather than wrong.

## The prod leg (`outProd-30ef02a/`)

Shipped 2026-09-11. `/healthz` sha
`30ef02ad4e9d2979ab4688694b291653b2d6a4c3`, gated at the start of the run.

The healthz gate proves the BACKEND sha and nothing else, so the served
frontend got its own gate first (`prod-build-gate-30.js`, output in
`outProd-30ef02a/prod-build-gate.out.txt`): **PASS after 4 s**, the JS chunk
carrying `dva-glyph` and the stylesheet carrying `.dva-row{column-gap:6px}`
and `.dva-clause{min-height:16px}` — *and* no longer carrying `--dva-val`.
The signature is chosen so an older build cannot satisfy it: the two-column
table had no glyph at all, and the absence check proves the old fixed track is
gone rather than merely unused. JS and CSS are read from different files, so a
half-deployed build cannot read as PASS.

**28 pass, 0 fail, 20 info**, both viewports, and every figure identical to the
local run:

| | 1440×1000 | 380×900 |
|---|---|---|
| block | 500 × 292.8 px | 282 × 388.8 px |
| row height (last) | 44.2 (43.2) | 60.2 (59.2) |
| applied-value ink right spread | **0.0 px** | **0.0 px** |
| clause reserve · worst DIFFER | 16 px · 1 line | 32 px · 2 lines |
| #214 caveat | byte-exact | byte-exact |
| axe | baseline only, none inside `.dva` | baseline only, none inside `.dva` |

The lanes leg on prod, both viewports: no row changed height when the relay
cleared, and the clause read `OSM · 2 · overridden · operator-set` beside a ⚠
glyph and an applied value of 3.

**What this run does NOT show.** It measured the shipped tip `30ef02a`, which
predates the item-3 fix in this commit — so the prod clauses still read
`OSM · 30 mph · no source tag` on the rows that are read from real tags. That
is the defect the fix addresses, visible in `outProd-30ef02a/log.txt` as the
record of what shipped. The next ship changes those two clauses to
`· measured` and nothing else; the geometry above is unaffected, because the
clause's length is not what sets the row.

## The three open items, ruled 2026-09-11

1. **The clause renders as ONE text node — a ruled deviation from spec 3.6.**
   The spec asked for emphasised fragments inside the clause (the detected
   value and the applied token in `--ink-on-dark`). Rendering them would split
   the string across spans, which breaks the direct-text-node test idiom this
   repo reads clauses with and makes the sentence ungreppable. Ruled: not worth
   it. The fact is carried by the words, and the emphasis remains available
   later if the reading ever needs it. Recorded here as a deviation so nobody
   later reads the spec and files the difference as a defect.
2. **A road-type difference that is auto-apply's kind-narrowing still reads
   `operator-set`** — ruled to stay declared rather than guessed at.
   `auto-apply.ts:515,:524` keep the scenario's own type when the detected one
   is not in the kind's set, which is a narrowing and not an edit, but they
   expose no predicate to ask that with. Extending the `changed in plan`
   treatment would mean inferring the narrowing from outside, and a guess
   dressed as provenance is worse than a declared gap.
3. **`no source tag` on rows read from a real tag — FIXED.** Ruled: a row whose
   value came from a real tag must not say the tag is missing. Speed limit and
   Lanes per direction now render `fields.speed.method` / `fields.lanes.method`.
   `overridden` still outranks the method on the lanes row — once the operator
   has disputed the count, how detection arrived at it is no longer the fact
   the row is about — and a withdrawn detection states no method, because it
   has no value to have a method for. See the #274 retirement above.
