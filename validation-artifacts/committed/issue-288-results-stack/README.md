# issue-288-results-stack — Direction A Phase 1, the results stack

**Issue:** #288 (S5, S6, S8). **Authority:** `rulings.md` in this directory — both rulings
of 2026-09-21, verbatim. **Base:** `7885395`. **Design authority:** #281.

## State of the arc

| step, as ruled | state |
|---|---|
| 1. `rulings.md` first | **done** — `15ca57a`, amended `4a63032` with the second ruling |
| 2a. the `pageerror` listener | **done** — this commit (`err-tap.js`, the gate, this README) |
| 2b. the static nav citation | **done** — `78af565`, the s8.32 date removal |
| 3. the stack, stop with the verdict | **not started — blocked, see below** |
| 4. NEEDS YOU | **not started — blocked** |
| 5. disclosures + S8 | **not started — blocked** |
| 6. evidence, five legs, both widths | **not started** — nothing to measure yet |

**Nothing is deployed.** No leg has been run. Every artifact in this directory is a harness,
not a measurement; when a leg runs, its output goes **outside the repo** per the ruling.

## The block

Ruling clauses **a, b, e, g and h** adopt a checkpoint by reference — "as you mapped", "as
tabled", "accepted". That checkpoint is not in the record: no `*288*` file in the repo or
any worktree, zero tracked files matching `#288` on any branch, nothing in
`s2-triage-3/findings.md`, and `gh issue view 288` reports **0 comments**. The five tables it
carries — the wire-field map, the component table, the arc-28 legs that re-point, the churn
table with its two 380 axe findings, the principles table — each name a set whose membership
decides the diff. Steps 3–5 cannot be built without them, and reconstructing them here would
put a guess where the authority belongs (Rule 12). Full statement in `rulings.md`.

## The harness

### `err-tap.js` — the listener, attached before navigation

`attachErrorTaps(page)` is called on a page that **has not navigated**. React throws
hydration errors while hydrating the first paint; a listener attached after `goto` resolves
has already missed them. Earlier legs got this right by habit (`s2a30-ledger.js:210`,
`s2a29-lc.js:192`); the ruling landed it first, so it is a contract here.

It taps `pageerror`, `console` (errors only) and `requestfailed`, timestamps each relative
to attach, and `classify()` splits hydration-shaped messages from the rest on message shape
rather than one literal, so a React rewording cannot silently pass.

**Every leg attaches a second, deliberately late tap and records both counts.** "0 pageerror"
proves nothing alone — zero is also what a mis-ordered listener reports. Recording both makes
the ordering claim evidence instead of assertion.

### `i288-sheetmeta-gate.js` — the served-bundle gate

healthz proves the backend sha only; this arc is frontend-only, so the frontend gets its own
gate (arc 26's lesson: a leg measured a stale frontend against a fresh healthz).

This arc's first product change is an **absence**, and an absence is a weak signature — a
500, a redirect or a strip that failed to render all read as "ISSUED not present". So the
gate requires the absence **and** two positive marks from the same strip: `ISSUED` gone,
`LOCATION` present, `AS NOTED` present. A half-deployed or broken page cannot satisfy all
three.

## Findings

Per the second ruling: a finding that would change a #281 rule stops the arc; one that would
not goes here and the build continues. **Neither of these changes a rule.**

### 1 — the "static nav citation" commit had no work in the nav

§8.32 says the nav citation must be "static text with no date". `AppNav.tsx:79` already
renders `MUTCD 2023 · CDOT` — static, dateless — and `AppNav.tsx:65-69` renders `{ta} ·
{cdotSheet}`, also dateless. The nav was already compliant. The date §8.32 forbids lived in
the surface being *replaced*, `AppSheetMeta.tsx:21`, so that is where `78af565` cut. Recorded
because reading the clause as nav work would have produced an empty commit and a false
"done".

### 2 — the component's own comment asserted an invariant that is false

`AppSheetMeta.tsx` carried, since UX-20: *"UTC keeps the value identical across SSR and
hydration (no client-only drift)."* It does not. The SSR HTML is baked at deploy; the client
renders when the page is opened. From the first UTC midnight after a deploy until the next
deploy the two dates differ. This is #212's finding — bounded by the deploy, not the cache,
which is why deploy-day runs structurally cannot see it. `78af565` replaced the comment as
well as the code: a corrected line beside an uncorrected claim is still a false record.

### 3 — the replacement test is an equality, not a grep

Asserting "no date string present" would pass against any differently-shaped render-time
clock. `AppSheetMeta.test.tsx` renders at `23:59:59Z` and `00:00:01Z` and asserts the two
markups are byte-identical — the invariant that was actually broken (Rule 11, at the
rendered output).

### 4 — rulings 185 and 186 are still OPEN QUESTIONS in the design authority

Found by the diff-verifier while checking `0bb2081`'s citations. `#281` comment 1 — the
design authority this arc cites as "#281, comment 1, rule N" — carries both as questions,
not rulings:

> 185. THE SUMMED COUNT (Part 1, 7.3). "Needs you · 3" is ▲ + ⚠. **Keep the sum only, or
> show both tiers in the default view and drop the sum.**
>
> 186. S8's COLLAPSED NEEDS YOU (rule 124 and Part 1, 7.9). A per-state default for a block
> expanded everywhere else. **Approve, or make it always expanded.**

The answers are recorded in two other places, both of them Ryan's own words: `prompt.md:27`
(the recovered arc-33 prompt — "Ruling 185: the header count is the sum, the decomposition is
provenance. Ruling 186: always expanded") and #288's body, which lists them under "Rulings
carried" in the same terms. `0bb2081` implements the answers, and they are consistent across
both records.

**What is stale is the authority, not the decision.** #281 comment 1 was never updated when
185 and 186 were answered, so a reader who follows this arc's own citation convention lands
on an open question and cannot tell the block was ruled. No #281 rule changes — the decision
stands — so per the second ruling this is recorded and the build continues. Worth a comment
on #281 marking both resolved, so the next arc's citation does not have to be traced through
a prompt file to be believed.

### 5 — the file count is currently stated NOWHERE, and §8.29 says it must be stated once

Found by the diff-verifier as a stale comment in `OutputCards.tsx:229`; it is more than a
comment. §8.29 lists what must be preserved from the dropped strip: *"the reserved slot … and
the rule that the file count is stated exactly once on the page"*. The strip's chip 3 was
that one statement (`4 FILES READY`, from `BUNDLE_PART_KINDS`), and #253's ruling 2 had
deliberately removed the numeral from the download caption so the page had one voice for it.

`2ef4a8f` dropped the strip. The count is now stated **zero** times.

This is a build gap, not a decision, and not a rule change — §8.29 already requires the
restatement. It closes when the counts hero and the download cards land (rule 86, rulings
182/183), which is where acceptance line 4 — "file count stated once, from the served bundle;
counts are wire digits, no literal totals" — is measured. Until then Rule 10 keeps the
surface honest: the caption asserts no number it cannot back, rather than a stale one.

The comment at `OutputCards.tsx:229` now says this, so the next reader of that file learns it
from the file rather than from this README.

## The lesson: 3 of 10 across three ships

Three ships landed on `main` — `e55b23a`, `f81daa6`, `6c9fadf` — and #288's acceptance moved
from 0 of 10 to **3 of 10 and stopped there**: line 5 (the reserved row holds at the settle),
line 8 (zero `pageerror`, no date in the citation), line 9 (nothing in §8 KEPT changed
behaviour). Lines 1, 2, 3, 6 and 7 never became *measurable*, and line 4 got worse.

**Why: the shell was built before the thing that mounts it.**

The order the arc actually ran in was:

1. the `§8.32` date removal — a real fix, on a surface that already existed;
2. the `pageerror` harness — a leg's instrument, no surface at all;
3. the **NEEDS YOU shell** — a complete component, rules 72–79, nine tests, *imported by
   nothing*;
4. the **strip removal** — which deleted a surface and left a 44 px reserved row holding a
   place for something not yet built.

Every one of those was individually correct, verified, and shipped green. Together they
produced three deploys after which the results area had **less** on it than before and the
acceptance list could not move, because seven of its ten lines measure *states of a mounted
stack* — S5 with items, S5 with none, S6, S8 — and no stack was mounted.

The mechanism is precise and worth naming, because it will recur: **a stop point that names
a component rather than a surface can be satisfied without anything becoming measurable.**
"The NEEDS YOU shell is in a verified commit" was true, and bought nothing on prod. "S5 with
three items renders at both widths" could not have been satisfied by an unmounted component.

Ryan put the responsibility on accepting stop points that named no mounted surface. Half of
it belongs to the other side of the table: **I proposed those stop points.** Each time I
reported a blocker I offered the next increment in terms of what I could finish cleanly — a
component, a harness, a removal — rather than in terms of what would become *observable*. A
stop point framed as "what is built" is easy to hit and easy to verify; one framed as "what
can now be measured" is the one that moves an acceptance list.

**The rule this arc adds:** a build order's stop points are named after surfaces the leg can
reach, not after components the diff contains. A component with no importer is not a stop
point; it is work in progress that happens to compile.

Applied from step 1 onward: the next stop is "S5-with-items, S5-with-none, S6 and S8 are all
reachable on the branch" — four surfaces, not four files.

## Evidence plan, as ruled — not yet run

Five states, each at **1440×1000** and **380×800**: S5 with three NEEDS YOU items · S5 with
zero, the `↓ All (.zip)` primary (clause c) · S6 declined · S8 with the reference open.
Output outside the repo. Bundle poll before every leg. Sha-gated both ends. **No ship while a
leg is running.**

## Findings from the Phase 1 finish push

Under the arc's finding rule: a finding that would change a #281 rule stops the arc with a
checkpoint; one that does not goes here and the build continues. Both below are the second
kind.

### Clause 2 — rule 169's geometry cell is NOT dropped at 380

**Rule 169 says:** "The counts hero goes to 2 tracks and the numerals to 42 px; the geometry
cell is not rendered — its four rows are reachable in the reference disclosure."

**The finding:** the second clause is the justification for the first, and it is not true of
this codebase. The four geometry rows — taper L, buffer B, device spacing, work-zone length —
come from `zone_geometry` on the device-breakdown response and render in exactly one place,
the counts hero's third cell. They are **not** in the reference disclosure, in any tier, at
any width. `TieredReference`'s reference tier carries the permit FYI, the work-hours card, the
hazard chips, the administrative deltas and the device schedule; no geometry.

**What was built instead:** the numerals take rule 169's 42 px, the grid drops to two tracks,
and the geometry cell **still renders**, stacked full-width beneath them. Dropping it would
take four measured values off the phone with nowhere to read them, which is the Rule 10
failure — absence of a surface is not absence of the fact, and the operator would have no way
to reach it.

**Why this is not a checkpoint:** it changes no rule. Rule 169's *intent* — the phone does
not carry a 300 px side rail — is honoured; only its means are. The rule becomes correct as
written the moment the geometry rows have a second home, and the natural one is the reference
disclosure it already names. That is a Phase 2 or #286 job, not this push's.

### Clause 2 — the counts hero's corner ticks are deleted

Rule 80 specifies the hero's shell completely: 1 px border, ground, three tracks. The two
corner ticks were the old results hero's own flourish and are carried by no rule. Deleted
rather than kept as undeclared decoration. No value moved.

### Clause 2 — the ruled numeral sizes were already declared

#283 (Phase 0) declared `--fs-hero-numeral: 62px` and `--fs-hero-numeral-380: 42px` on
`:root` ahead of any surface using them, per #281's "never as debt". Clause 2 is the phase
that draws them, so the cells read the tokens rather than minting the literals a second time,
and #263's census now records the `var()` names instead of the retired 76/60. This is Phase 0
paying off exactly as intended, and worth recording because it is the first time it has.

### Clause 3 — the file count was stated ZERO times for three ships

Recorded because the gap had a lifespan, and the lifespan is the finding.

Part 1 §8.29 dropped the next-steps strip and explicitly KEPT one of its rules: "the file
count is stated exactly once on the page". The strip's chip 3 ("4 FILES READY") was the one
statement. The strip was deleted at `f81daa6`, and from that commit until clause 3 the count
was stated **zero** times — the rule was carried in a code comment in `OutputCards.tsx` and
in acceptance line 4, and nowhere on the screen.

Leg 2 and leg 3 both reported acceptance line 4 as **OPEN — stated ZERO times**, correctly.
What neither leg could report is that a "kept" rule had no owner: §8.29 said what must
survive the strip's deletion, the deletion shipped, and the surviving rule landed on nothing.

**The pattern worth naming:** when a ruling drops a surface and keeps one of its rules, the
rule needs a new owner named in the same commit that does the dropping — or it becomes a
comment describing a property the page does not have. The strip's removal was verified,
shipped green, and left a rule pointing at nothing for three ships.

Clause 3 gives it an owner: the zip control's own provenance line, counted from
`BUNDLE_PART_KINDS` (Rule 12 — it traces to the bundle's parts, not to a literal), asserted
once per state by `GeneratorShell.primary.test.tsx`.

### Clause 3 — a test that was scoped to its own answer

Worth recording as a testing lesson, not a defect: the first version of the "one primary per
state" suite queried filled actions with `.needs-you.owns-primary .act.is-on` — the same
scope the CSS uses. Injecting the regression it existed to catch (un-scoping the CSS rule)
did not fail it, because the query assumed the scope it was meant to verify.

Two fixes, both kept: the DOM query dropped the scope so an escaping treatment is visible,
and a separate CSS-contract assertion checks the scoping in the sheet — because happy-dom
applies no stylesheet and the DOM genuinely cannot answer that question.

The injection also surfaced a real inconsistency it was not looking for: an earlier edit had
scoped the `:hover` rule but not the base rule, because the script that wrote both failed its
second assertion after the first replacement and never wrote the file. Base un-scoped, hover
scoped, suite green. Only the deliberate regression run exposed it.

### Clause 4 — TWO real defects the promotion exposed

Both were latent before this commit and would have shipped.

**1. `ReferenceDisclosure`'s `defaultOpen` only applied at mount.** The prop exists for Rule
10: the verdict strip says "retry below", and the Retry lives inside section 03's ⚠ tier, so
a declined or failed audit must open that panel or the pointer lands on nothing. But
`useState(defaultOpen)` reads the flag ONCE, and the flag is false at mount — the audit has
not answered yet — and becomes true only when the answer turns out to be a refusal. So every
error arriving after the first render left the panel shut.

It did not show before clause 4 because section 03 also held ✓ and ◌, whose contents kept the
suites busy; the moment those tiers left, three #187 honesty suites failed at once and named
it. Fixed with the `ReferenceChip` `autoExpand` idiom that has handled the same false→true
arrival since #219.

**2. The #187 refreshing cue was about to hide behind a closed disclosure.** "◌ previous
answer — refreshing…" is the line that says the values on screen are stale. It lived in
section 03's chrome. Once ✓ and ◌ were promoted to rows of the stack, their COUNTS were
visible while the cue qualifying them was inside a closed panel — a stale answer presented as
current, which is exactly the half of Rule 10 that is easiest to ship.

Moved to the stack, stated once, in a slot that keeps its reserved height when empty (P1) so
the stack does not shift when the cue appears. The claim moved with it, by name, from
`JurisdictionSection.density.test.tsx` to `GeneratorShell.disclosures.test.tsx`.

**The pattern both share:** folding a surface behind a disclosure silently changes what is
*reachable*, and the things most likely to become unreachable are the ones that exist to keep
something else honest — a recovery action, a staleness cue. When a fold lands, the question
is not "does it still render" but "can the operator still get to the thing that stops them
being misled".

### Clause 4 — a test that asserted a number instead of measuring one

The first version of the rule-89 count assertion said the ✓ tier would show `"2"`, reasoning
from the two passing Colorado checks in the fixture. The ledger counts 8 — it also counts the
scan facts, the clean corridor and the geometry pass. The figure was an assumption wearing an
assertion's clothes.

Replaced with the claim actually worth making: the ✓ row's count and the audit card's
"N checks" must be the SAME number, because both read one ledger (`assignTiers`, mirrored by
`src/rendering/tier_ledger.py`). That is a P2 claim, it needs no fixture arithmetic, and it
would catch a second producer appearing — which a hard-coded 8 would not.

### Clause 5 — a deletion that took an identifier with it

Small, but it is the third time this arc that removing a surface removed something else's
grip on the page.

The results section has always been the focus target for the post-Generate settle (#193) and
the element the arc-28 landing legs measure (ruling 184). Nothing about that changed here.
What changed is that `GeneratorShell.a11y-focus.test.tsx` identified it as "the SECTION whose
`.zone-title` says MHT package" — so dropping the heading under §8.28 broke three focus tests
that were not about headings at all.

Fixed by naming the thing: the section carries `results-stack`, §8.29's own word for it, and
the suites hold that instead. The lesson matches clause 4's: **what a test uses to FIND an
element is part of that element's contract**, and a heading is a bad handle precisely because
it is presentation and presentation is what gets dropped.

Also deleted: `.zone-note`, the CSS rule for the stage direction that sat in the results
heading ("device & type counts drive your estimate"). A rule whose only element is gone is a
rule that rots. `.zone-head` / `.zone-tag` / `.zone-title` all stay — the setup zone still
uses them, and that zone is Phase 2's.

### Clause 6 — three phantom token references, caught by writing the comment

`var(--body, var(--ink-on-dark))` is valid CSS and renders correctly, because the fallback
fires. It is also a lie: this sheet has no `--body`. Part 2 uses that name; the sheet uses
`--ink-on-dark` for the same #c8d1dd.

I wrote it three times — once in clause 6's ribbon and twice in clause 2's hero — and each
time the comment beside it said "--body on --da-ground" or "provenance ink", describing a
token the reader would not find. Nothing failed. The census does not police colour, the ink
gate only rejects raw hex, and the rendered result is correct.

It surfaced only when writing the ribbon's comment required stating the contrast pair by
name, and the name did not exist. All three are now the sheet's real tokens, with the Part 2
alias noted where it helps.

**Why it belongs in the record:** a var() fallback is a silent alias. It makes a
non-existent token look declared, and the more precise the surrounding comment is, the more
convincing the fiction. The same shape as the rule-78 quote and the "recorded in the arc
README" claim — the code was right and the claim about it was not.

### Clause 7 — three rule-15 failures behind folds, and a coverage claim that was false

The enumeration found three inline `↗` links at 12 px with no hit box: "Open {sheet} PDF on
CDOT.gov", and two "Tracking issue" links. Their tappable area was the line box, about 16 px,
against rule 15's 32 px floor.

**All three render only behind a fold, and one behind two folds.** The case-reference link
sits in an `ItemAccordion` body inside the ✓ disclosure row — two clicks deep. The per-item
tracking link needs `pending_verification.items` populated; the flat one needs only the
pending tier open.

**The first version of this suite claimed to check all three and checked one.** The fixture
left `sections.case.url` and `pending_verification.items` unset, so two of the three branches
never mounted — and the comment beside the fix, and this README section, both said the
enumeration reached them by opening disclosures. The diff-verifier caught it by reading the
fixture against the component's guards, which is the only way it could have been caught: the
suite was green, and green is what a coverage claim looks like when it is false.

Three things changed as a result, and the order matters:

1. the fixture now populates both fields, so all three links actually mount;
2. the opener walks recursively until no fold is left, because one control was two deep and
   a single pass reached it;
3. **the coverage claim is now itself an assertion** — the suite fails if any of the three is
   missing, instead of a comment promising they are there.

The third is the durable one. A coverage claim that nothing asserts is a comment, and a
comment cannot fail.

### Clause 7 — a finding NOT fixed here: `.audit-head` announces no expanded state

Writing the recursive opener surfaced it. `.audit-head` (the `ItemAccordion` control) carries
no `aria-expanded` at all — its open state lives only as a class on the parent
(`.audit-item.open`). Selecting it by the attribute it does not have is how the opener's
first version silently opened nothing.

A disclosure control that does not announce whether it is expanded is a real a11y gap, but it
is rule 16's and WCAG 4.1.2's, not rule 15's, and `AuditTrail.tsx` is not this arc's surface.
Recorded rather than fixed, and worth its own issue: every other fold in the stack
(`.disc-head`, `.chip-sum`, `.price-head` before it retired) does carry `aria-expanded`, so
this is the odd one out, not the convention.

**The general shape, and the reason this is worth a README entry:** folding surfaces behind
disclosures — which is most of what Phase 1 did — moves controls out of the default view, and
an audit that measures the default view stops seeing them. Clause 4 hid a recovery action and
a staleness cue behind folds; clause 7 found three controls that had been hidden behind one
all along. Any future accessibility pass on this page has to open things first.

### Clause 7 — refining a test's question without relaxing its answer

The same enumeration flagged the dismiss picker's four radio inputs. Those are 1×1 px at
opacity 0 inside a `.reason-chip` label (#245: the radio keeps the tab order and the native
`:checked` semantics; the chip is what the operator sees and hits). WCAG 2.5.5 measures the
target the pointer lands on, so a floored label covers its own hidden input.

The lazy fix was to skip inputs. What is there instead: an input counts as floored **iff its
wrapping label is floored** — so an input with no floored label still fails, and a label that
loses its floor fails through the label. Recorded because "make the four failures go away" and
"ask the right question" produce the same green, and only one of them still works next year.
