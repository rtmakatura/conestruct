# issue-288-results-stack — the rulings this arc is built under

**Ruled by Ryan, 2026-09-21**, in chat, on the Phase 1 checkpoint. Quoted verbatim below.
This file is the arc's authority: every commit on this branch cites it. Filed as this arc's
**first** commit, per the per-arc rulings convention adopted 2026-09-16.

**Issue:** #288 — "Direction A Phase 1 — the results stack (S5, S6, S8)". **Phase:** 1
(of #281 Direction A). **Priority:** high. **Labels:** enhancement, priority-high,
frontend, ux, p18, p19.

**Base:** `7885395` (= `main` = `origin/main` at the time of this commit).

---

## The ruling, verbatim

> #288 rulings — all eight as recommended, with the constraints below written into
> rulings.md.
>
> a. Every value on the stack has a wire field, as you mapped. Anything you flagged as
> missing renders nothing (Rule 10) — this phase mints no field.
> b. Component plan as tabled: verdict strip, working band, refusal container, corrections
> block (as NEEDS YOU's item rows), counts hero, cards, ribbons, quote, draft notice carry
> over; the stack container, the NEEDS YOU shell, the disclosure row are new. Section 03's
> tiered-reference component retires as a shape; its five tiers and its disclose-never-writes
> contract transfer.
> c. One derivation for the primary — NEEDS YOU count > 0 → its actions; else "↓ All (.zip)"
> — tested once, read by both surfaces, same at 380.
> d. ACKNOWLEDGE: if the wire carries nothing for it to write, it does not render as a
> button. The item shows with its provenance "surfaced, not auto-applied" and no action — an
> honest item without a control beats a control that writes nothing. Record it as a finding
> for #289 (revision mode may give it a real home).
> e. Landing target = nav-h + 8 + status-h + 24 with status-h naming the verdict strip; the
> reserved first row absorbs the settle displacement; every arc-28 leg that touched the
> results head re-points, zero-match fails loudly.
> f. TRACE renders exactly what the audit carries today, labelled; formula fields arrive with
> #286 and the rows widen then, nothing invented meanwhile.
> g. Churn as tabled; the two 380 axe findings retire under rule 15 or you say why not.
> h. Principles table accepted; every surface names its FLOW.md step and user.
>
> GO. rulings.md first; then the pageerror listener and the static nav citation as small
> early commits; then the stack; then NEEDS YOU; then disclosures + S8; then evidence in
> S5/S6/S8 at both widths, output outside the repo, bundle poll before every frontend leg.
> Stop after the stack lands with the verdict (the voice change), then after evidence with
> the ship line. Frontend-only — prove it.

---

## The second ruling, verbatim — 2026-09-21, after the first stop point was proposed

> Stop point 1 accepted. Continue through NEEDS YOU, the disclosures and S8, then evidence.
> Two standing rules for the remaining commits:
>
> - Anything you find that would change a #281 rule (not just a churn prediction) stops the
> arc with a checkpoint; I rule before it's built. Anything that's a finding but doesn't
> change a rule goes in the README and you keep going.
> - The evidence run is at both widths, S5 with three NEEDS YOU items, S5 with zero (the
> "↓ All (.zip)" primary), S6 declined, S8 with the reference open. Output outside the repo;
> bundle poll before every leg; sha-gated both ends. No ship while a leg is running.
>
> Stop with the verdict and the ship line.

### The record correction this file makes against its own ruling

"Stop point 1 accepted" was given on a stack that **had not been built**. At the moment of
that ruling this branch held exactly one commit — `15ca57a`, this file — and the message it
answered was a 📋 plan checkpoint for the two *small early commits* that precede the stack,
ending in a request to approve commit 2's scope. The stack, the verdict voice change, NEEDS
YOU, the disclosures and S8 did not exist and do not exist as of this commit.

Recorded here rather than silently accepted, per the standing caution **"don't read a report
for the arc you expect — read it for the arc it is"**. The ruling's two standing rules are
adopted in full and govern every remaining commit; what is not adopted is the premise that
the arc had reached its first stop point.

### The evidence matrix, as ruled

Five legs, each at **1440×1000 and 380×800**:

| leg | state |
|---|---|
| 1 | S5 with **three** NEEDS YOU items |
| 2 | S5 with **zero** NEEDS YOU items — the `↓ All (.zip)` primary (clause c) |
| 3 | S6 declined |
| 4 | S8 with the reference disclosure open |
| 5 | (the above at the second width) |

Output **outside the repo**. Bundle poll before every leg — healthz proves the backend sha
only and this arc is frontend-only. Sha-gated both ends. **No ship while a leg is running.**

### The finding rule

- A finding that **would change a #281 rule** → **stop the arc with a checkpoint**; Ryan
  rules before it is built.
- A finding that **does not change a rule** → goes in the arc README; the build continues.

---

## The rule-28 ruling, verbatim — 2026-09-21

Given in answer to the finding that `--strip-h` measures the strip, so the reserved first row
had no referent once the strip was dropped.

> Rule 28 ruling: the reserved first row reserves the setup fact line's height — 44 px at one
> line per rule 56 — as a token `--fact-h`, mounted from the Generate click, released under a
> decline. It reserves what forms in that slot at the settle, its value is a rule not a
> measurement, and it does not depend on NEEDS YOU's content. `--strip-h` retires with the
> strip. Ruling 184's landing carries everything below it.

**The reason, as ruled:** the reserve is for *what forms in that slot at the settle*. Its
value is **a rule, not a measurement** — this is the distinction that unblocks it. `--strip-h`
was a measurement (81.19 at 1440, measured on the dev server at `d3c2dcf`, rounded to 82), so
it died with the thing it measured. `--fact-h` is read off rule 56, which fixes the fact
line's row height at 44 px at one line, and it therefore needs no re-measurement and cannot
drift. It is independent of NEEDS YOU's content, so a block that grows with its item count
never changes the reserve. Everything below the reserved row is ruling 184's landing.

---

## ⚠ THE CHECKPOINT THIS RULING ANSWERS IS NOT IN THE RECORD

**Read this before acting on clauses a, b, e, g and h.**

Five of the eight clauses adopt an artifact by reference rather than by content:

| clause | the phrase | what it points at |
|---|---|---|
| a | "as you mapped" | a wire-field map, per stack value, with a flagged-missing set |
| b | "as tabled" | a component table — carried over / new / retired |
| e | — | the arc-28 legs that touched the results head, enumerated |
| g | "as tabled" | a churn table, plus "the two 380 axe findings" |
| h | "accepted" | a principles table, per surface, with its FLOW.md step and user |

**None of those five tables exists on disk, in git, or on the issue.** Searched
2026-09-21 before this commit:

- no file matching `*288*` in the repo or any worktree (only `.ruff_cache` hash collisions);
- `git grep "#288"` across `main`, `docs-287-phase0-complete`, `docs-issue-citations`,
  `issue-279-classifier`, `s2-triage-2`, `s2-ui-inventory` → **zero tracked files**;
- no `#288` in `validation-artifacts/committed/s2-triage-3/findings.md`;
- `gh issue view 288` → **0 comments**;
- the only mentions anywhere are `handoff.md:21`, `handoff.md:53` and `memory.md:82`, all
  three untracked.

Per Rule 10, absence of signal renders as absence: this file does not reconstruct those
tables, because a reconstruction would read as the checkpoint's content while being this
file's guess. Rule 12 says the same in the other direction — a table that looks reasonable
is not evidence it is the table that was ruled on.

**What this blocks.** Clause **c**, **d** and **f** are self-contained and can be built from
the text above plus #288's body. Clauses **a**, **b**, **e**, **g**, **h** cannot: each
names a specific set whose membership decides the diff. The checkpoint must be committed
into this directory as `checkpoint.md` **before the first implementation commit**, and this
file amended with a pointer to it. Until then the five clauses are adopted-in-principle and
unverifiable in practice — the diff-verifier has nothing to check them against.

This notice is not a request to re-rule. The ruling stands as quoted; what is missing is the
document it adopts.

---

## Independently anchored — verified in this repo at `7885395`

These are the parts of the ruling that #288's own body corroborates, checked by opening the
files rather than by trusting the issue text:

| ruling clause | anchor, verified |
|---|---|
| b — "section 03's tiered-reference component retires as a shape" | `conestruct/site/components/TieredReference.tsx`, 744 lines |
| b — five tiers transfer | `conestruct/site/lib/tiering.ts`, `assignTiers` at :160, mirrored by `src/rendering/tier_ledger.py` (#288 body) |
| c — the primary derivation | `conestruct/site/lib/next-steps.ts`, 131 lines; rulings 182/183, overriding §8.6/7.5 |
| e — the results head | `conestruct/site/components/ResultsHead.tsx`, 94 lines; `GeneratorShell.tsx:1320-1344` |
| g — rule 15 page-wide including the footer | `conestruct/site/components/AppFooter.tsx`, 18 lines, no `min-height` (#264's verification, re-checked) |

`ResultsHead.tsx`, `TieredReference.tsx`, `lib/next-steps.ts`, `GeneratorShell.tsx` and
`AppFooter.tsx` all exist at the paths #288 names. No path in the reference list is stale.

---

## The build order, as ruled

1. **`rulings.md` first** — this commit.
2. The `pageerror` listener (#212's harness half) and the static nav citation (§8.32) as
   small early commits.
3. The stack. **Stop with the verdict** — the voice change.
4. NEEDS YOU.
5. Disclosures + S8.
6. Evidence in S5/S6/S8 at both widths (1440×1000 and 380×800), **output outside the repo**,
   bundle poll before every frontend leg. **Stop with the ship line.**

**Frontend-only — prove it.** No backend file in the diff; the proof is the diff, not the
claim. Rule 5: churn predicted before the diff, not explained after it.

## Standing constraints this arc inherits

- Rule 10 — this phase **mints no wire field**. A value without a field renders nothing.
- Rule 11 — test where the bug lives: rendered-output and mounted-flow, not pure functions.
- Rule 3 — no frontend computation of a value the backend owns; clause f holds TRACE to what
  the audit carries today, with #286 widening the rows later.
- `healthz` sha == `git rev-parse HEAD` **and** the served bundle polled — healthz proves the
  backend sha only, and this arc is frontend-only.
- Nothing ships without Ryan's explicit go.

---

## The Phase 1 finish ruling, verbatim — 2026-09-21

Given after leg 3, on the finding that acceptance stood at five of ten because the counts
hero, the download cards and the primary derivation were unbuilt. Quoted verbatim; this
list is the definition of done for the arc, and every commit from here cites a row of it.

> Phase 1 finishes as one push. No stop points until the results area matches Direction A's
> S5 in every row of this table except the setup fact line (Phase 2's):
>
> 1. NEEDS YOU carries its actions: the five site-condition rows and the two manual keys move
> INTO the block as items (Part 1 §8.5, rules 74–79), with Dismiss / Assert / Undo on one
> right edge, the always-mounted note field, the Apply row as the last data line with its
> standing sentence and the disabled-at-zero button. The corrections block stops rendering in
> the setup strip. The ▲/⚠ tier rows keep their citations; rows with no wire action render no
> button (ruling d). Staging contract, "disclose rather than lock", and every corrections test
> transfer — report which suites move and which assertions are byte-identical.
> 2. Counts hero restyled to rules 80–83 (62 px numerals, the 300 px geometry track, the
> degradations).
> 3. Download cards to rules 84–86 plus rulings 182/183: one derivation — NEEDS YOU count > 0
> → its actions are primary and "↓ All (.zip)" is a ghost; count 0 → "↓ All (.zip)" is the
> primary; same at 380. File count stated exactly once, from the served bundle.
> 4. Quote, Checked & passed, Pending / not verified as disclosure rows (rules 87–89):
> counted tiers show a number, the quote row its "not a permit fee" summary. Reference stays
> as built.
> 5. The intro paragraph and the results-area zone headings removed (§8.28, §8.30); the draft
> notice stays; focus target re-homed to the results stack.
> 6. Ribbons per rule 102: not dimmed, the dim starts below; ≥ 4.5:1 measured mid-flight
> (#259).
> 7. Rule 15 page-wide including the footer; TARGETS probe 0 under 32/44; axe target-size 0
> at 380 (#264's results half).
>
> One branch off main, rulings.md first quoting this list, each item its own verified commit,
> diff-verifier per commit, red-prove where a test can prove it. Frontend-only — prove it.
> Stop ONLY when all seven are in verified commits, with: the verdict, the file table, a
> row-by-row "before → after" of the seven, and the ship line. Then the four-state prod leg
> after Ryan ships, and #288's acceptance line by line.
>
> The band, the verdict strip, the refusal container, the draft notice, the announcement
> region: unchanged. Phase 2's surfaces (setup panel, strip, rail, picker): untouched.

### What this ruling settles that was open

- **Ruling 183** — settled here and not by 183's own two options. The zip button renders at
  BOTH widths: a ghost when NEEDS YOU has items, the primary when it has none. Rule 86's
  "not rendered at 1440" and rule 168's "primary at 380" are both superseded by clause 3's
  one derivation, which is the same derivation at both widths.
- **Ruling 182** — confirmed as written: NEEDS YOU's item actions are primary in S5 and the
  download row stays a flat four-card row. Not promoted, not demoted.
- **§8.29's file-count rule** — the "stated exactly once" obligation, orphaned since the
  strip was dropped at `f81daa6`, lands on the download row and is counted from
  `BUNDLE_PART_KINDS` (the served bundle's parts), not from a literal.

### The untouched set, as ruled

The band, the verdict strip (`StatusBar`), the refusal container, the draft notice and the
`role="status"` announcement region do not change. Phase 2's surfaces — the setup panel,
the setup strip's own fact lines, the progress rail and the location picker — are not
touched, with the ONE exception this ruling itself orders: clause 1 removes the corrections
block from the strip, because the block is moving, not changing.

---

## The rules clause 1 builds against, verbatim — #281 comment 1 (Part 2), rev. 2026-09-16

Quoted into the tracked record because the arc's citation convention requires it: a citation
to an untracked source is correctly rejected by the diff-verifier (#160, ruled 2026-07-30),
and Part 2 lives on the issue, not in this repo. Clause 1's commit cites these by number, so
their text has to be here to be checkable. Transcribed from `gh issue view 281`, comment 1,
section "C6 · NEEDS YOU (was: corrections block — rules 72–79 …)".

> 72. Shell. 1 px #2c3e53 border, ground #101c29, left border 2 px #f4c020.
> 73. Header. Padding 12 px 16 px, bottom border 1 px #223345: section header "NEEDS YOU" →
> provenance "changed the plan, or waiting on your word" → count, margin-left auto, mono
> 11 px weight 500 #eaf0f7.
> 74. Item row. Grid 20 px / minmax(0,1fr) / auto, column-gap 14 px, padding 14 px 16 px,
> bottom border 1 px dashed #223345, align-items start; last item no border.
> 75. Item middle track: the item body (rule 9) then its provenance line, margin-top 5 px.
> The provenance always names the tier in words — "changed this plan", "needs attention" —
> plus the evidence the wire carried (count, nearest distance, coordinates) and never invents
> any.
> 76. Item right track: grid, gap 8 px, justify-items end — the citation (rule 11) above the
> action buttons.
> 77. Action buttons: the .act control (rule 133). One per row unless the row offers a true
> pair (DISMISS / KEEP). Every button in the block shares one right edge in every state —
> unchanged, and the reason the action column is a fixed auto track.
> 78. Apply row. Always present post-scan, as the last data line: display flex, gap 14 px,
> padding 13 px 16 px, top border 1 px #223345. A standing provenance sentence, then the
> write button margin-left auto. At zero: "no changes staged · staging costs nothing, Apply
> re-generates once" and APPLY 0 CHANGES at opacity .45, disabled, reason on its title.
> 79. The five condition rows keep their wire order: adjacent at-grade intersection, adjacent
> interchange, pedestrian sidewalks, bike lane / cycleway, school zone. A bucket absent from
> the wire renders nothing. The dismiss picker — radio chips, always-mounted note field at a
> fixed reservation, Confirm enabled on a reason, Other answered at the note — unchanged.

And rule 133, which rule 77 names:

> 133. LEDGER ACTION (.act). Min-height 32 px, padding 7 px 11 px, 1 px #2c3e53,
> transparent, mono 9.5 px .14em uppercase #c8d1dd.
>      hover    border #3d5570, text #eaf0f7
>      on       border and text #34a9e8 (the row's recommended action)
>      disabled opacity .45, reason on title
>      At 380 px min-height 44 px (rule 15).

### Where the build DIVERGES from rule 78's words, and why

Rule 78's zero-state sentence says **"no changes staged"**. This codebase says
**"no corrections staged"** — `stagedSentence(0)` in `lib/scenarios/site-corrections.ts`,
shipped by #254, and the noun the whole block, the backend's `corrections` wire field and the
`corrections_advisory` string all use. Clause 1 keeps the codebase's noun and takes rule 78's
second clause verbatim, so the built sentence is:

> no corrections staged · staging costs nothing, Apply re-generates once

The alternative — renaming the noun to match the spec — would rename a wire field's vocabulary
on the screen only, which is the kind of divergence P2 exists to prevent. Recorded here rather
than left as a comment that quotes one string above code that prints another; the diff-verifier
caught exactly that on repair cycle 1.

Rule 78's "APPLY 0 CHANGES" label diverges for the same reason and is likewise not adopted:
the button reads `Apply 0 corrections`, as it did in the strip.

## The rules clause 2 builds against, verbatim — #281 comment 1 (Part 2)

Same reason as clause 1's block above: Part 2 lives on the issue, so a commit citing rule
numbers has nothing tracked to be checked against. Transcribed from `gh issue view 281`,
comment 1, sections "C7 · COUNTS HERO" and "160–179 THE 380 px ARC".

> C7 · COUNTS HERO (was: results hero — rules 80–83)
>
> 80. Grid, 3 tracks: 1fr / 1fr / 300 px. Each cell padding 20 px 22 px, right border 1 px
> #223345, last cell none. Shell 1 px #2c3e53, ground #101c29.
> 81. Cells 1–2: quiet section header (rule 3) → numeral, mono 500 62 px / 1 #ff8a2e, margin
> 10 px 0 8 px → sub-line in provenance role. Sub-line extensions ("· incl. +N
> jurisdiction-required", "· N from {jurisdiction}") unchanged.
> 82. Cell 3: a case-ID line in provenance role at #eaf0f7, then four geometry rows — display
> flex, justify-content space-between, mono 11 px #c8d1dd, gap 7 px. Verbatim from
> zone_geometry.
> 83. Degradations unchanged: absent zone_geometry → one "Zone geometry unavailable" row,
> nothing recomputed locally; a response missing either count → the hero does not render at
> all.

And rule 169, which clause 2's narrow width answers to:

> 169. The counts hero goes to 2 tracks and the numerals to 42 px; the geometry cell is not
> rendered — its four rows are reachable in the reference disclosure.

Rule 3's quiet variant, which rule 81 names for the cell labels:

> 3. Type role 1 — SECTION HEADER. Mono 10 px / 1.2, weight 500, letter-spacing .18em,
> uppercase, #eaf0f7. Quiet variant #93a0b0 (used for the counts hero's cell labels and the
> S4 results placeholder).

### Where the build DIVERGES from rule 169, and why

Rule 169's geometry-cell drop rests on "its four rows are reachable in the reference
disclosure". They are not — they render in the counts hero and nowhere else. The numerals
take rule 169's 42 px and the grid drops to two tracks; the geometry cell still renders,
stacked full-width. Dropping it would take four measured values off the phone with no way to
reach them (Rule 10). Recorded as a finding in this arc's README, under "Findings from the
Phase 1 finish push" — no rule changes, so the build continued per the finding rule.

## The rules clause 3 builds against, verbatim — #281 comment 1 (Part 2)

Quoted for the same reason as clauses 1 and 2's blocks: the rule numbers are cited by the
commit, and Part 2 is not in this repo. From `gh issue view 281`, comment 1, sections
"C8 · DOWNLOAD CARDS", "130–159 CONTROLS" and "160–179 THE 380 px ARC".

> C8 · DOWNLOAD CARDS (rules 84–86 — unchanged except rule 86)
>
> 84. Row: grid, 4 equal tracks, gap 12 px. Card: 1 px #2c3e53, ground #101c29, padding
> 14 px, display flex column, gap 7 px, min-height 142 px.
> 85. Card content: a title row (field label left, format in provenance right), then a
> provenance caption, then the button pinned to the bottom by margin-top auto. Two-format
> cards split the button row into two equal ghosts with an 8 px gap.
> 86. CHANGE: the "↓ All (.zip)" header button is not rendered at 1440 px; it becomes the
> primary at 380 px (rule 168). This needs your ruling (rule 183). Empty states unchanged:
> "No package yet" plus the path pre-generate, headline alone under a decline.

> 130. PRIMARY (.pri). Full width of its container, height 56 px, ground #34a9e8, text
> #0c1622 Inter 600 15.5 px, no border, display flex centred, gap 10 px.
>      default  #34a9e8 / #0c1622
>      hover    #5cbef0
>      active   #1f7bb0
>      focus    2 px #34a9e8 outline, 2 px offset (visible against the button's own fill
>               because of the offset)
>      disabled ground #1d2c3c, text #6e7c8e, cursor not-allowed, the blocker reason on title
>               — the SAME string the verdict strip shows
>      busy     disabled treatment plus the label swapped to the present participle
>               ("Generating…"); the working band carries the motion,

> 168. The download row collapses to one primary — "↓ ALL FILES (.ZIP)", 48 px — plus a
> "✓ 4 files ready" disclosure. The four cards do not render.

And the two departures clause 3 settles:

> 182. THE PRIMARY IN S5 (rule 119). NEEDS YOU's item actions are primary and the download
> row is a flat four-card row. Confirm, or promote downloads and demote NEEDS YOU to a
> disclosure.
> 183. THE "ALL (.ZIP)" BUTTON (rules 86, 168). Dropped at 1440, primary at 380. Either add
> it at 1440 (which gives S5 two primaries) or drop it at 380 (which leaves the phone with
> four cards or a bare disclosure).

### What clause 3 supersedes, and what it keeps

Ruling 182 is **confirmed as written**: NEEDS YOU's actions are primary in S5 and the
download row stays a flat four-card row.

Ruling 183 is settled by **neither of its own options**. The zip renders at both widths and
takes its treatment from the one derivation — rule 130's `.pri` when it owns the primary,
rule 133's ghost when NEEDS YOU does. So rule 86's "not rendered at 1440 px" and rule 168's
"the download row collapses to one primary … the four cards do not render" are both
superseded: the cards render at both widths and the zip never gives S5 a second primary,
which was the objection 183 raised against adding it at 1440.

Rule 168's "✓ 4 files ready" disclosure is **not** built as a disclosure. Its content — the
file count — is what Part 1 §8.29 requires stated exactly once, and clause 3 states it once,
as a provenance line on the zip control at both widths. A disclosure that exists only to
restate a number already on screen is the thing §8.29 dropped the next-steps strip for.

Rule 130's disabled treatment is adopted with one divergence: the blocker reason on `title`
is the verdict strip's string, and the zip's disabled state is a *bundling in flight* or the
write lock, neither of which the verdict strip speaks for. It therefore carries no `title`
rather than a fabricated one (Rule 10).

## The rules clause 4 builds against — #281 Part 1 §8.9 and §8.11, verbatim

From the issue body, Part 1 section 8 ("EVERY CURRENT SURFACE — KEPT, MOVED, RENAMED, OR
DROPPED"):

> 8.9  Section 03 — tiered reference → renamed "reference disclosure". All five tiers kept.
> ▲ and ⚠ are lifted out and merged into NEEDS YOU; ✓, ◌ and the uncounted i tier stay as
> disclosures. The disclose-never-writes contract and the read-only signposts are kept.

> 8.11 Quote panel — kept as a disclosure directly under the downloads, with the "not a
> permit fee" framing in its summary line.

### What clause 4 reads into §8.9, and why

§8.9 says ✓ and ◌ "stay as disclosures". It does not say *whose*. Clause 4 reads that as the
stack's — the rows sit beside the reference row, not inside it — on three grounds:

1. #288's own body gives the stack's order as "verdict → NEEDS YOU → counts hero → download
   row → quote disclosure → passed / pending / reference disclosures". Four sibling rows.
2. Rule 89 gives a counted tier a number in the row's own count slot. A tier nested inside
   another disclosure shows its number only after two clicks, which is not a count on the
   stack.
3. §8.9's own verb for ▲/⚠ is "lifted out". Leaving ✓ and ◌ nested while lifting ▲ and ⚠
   would make section 03 a container for two tiers and a wrapper for two more.

The i tier is NOT rebuilt: it is uncounted, it already had a disclosure (clause b's
`ReferenceDisclosure`), and clause 4's own text says "Reference stays as built".

## The rules clause 5 builds against — #281 Part 1 §8.28, §8.30, §8.12, verbatim

> 8.28 Zone headings (01 Setup / 02 Results / 03 Reference) — DROPPED as visible headings.
> The column has one narrative, the bands carry step indices, and "02 · RESULTS" survives
> only as the placeholder block's label in S4. The programmatic focus targets on Zone 1 and
> Zone 2 must be re-homed onto the band stack and the results stack.

> 8.30 Context block and draft notice — the intro paragraph is DROPPED (it restates the
> download cards' captions); the draft notice is kept (8.12).

> 8.12 Draft notice — kept, last line of the column, same two sentences.

### What clause 5 does NOT drop, and why

§8.28 names all three zone headings. Clause 5 drops **two** — Results and Reference — and
leaves Setup's, because the finish ruling's own last line puts Phase 2's surfaces out of
scope: "Phase 2's surfaces (setup panel, strip, rail, picker): untouched." The setup zone's
heading belongs to the setup panel, and §8.16 dissolves that panel into the band stack in a
later phase. Dropping its heading now would leave a panel with no name at all until that
phase lands.

§8.28's "02 · RESULTS survives only as the placeholder block's label in S4" is untouched by
this clause: the S4 placeholder is a pre-generate surface and its label was never the zone
heading — it is its own string, and it still renders.

The focus targets are re-homed as §8.28 requires. The results section already WAS the results
stack, so the target did not move; what changed is that the section now carries
`results-stack` as a class, because the heading the a11y suites and the arc-28 landing legs
used to identify it by is gone. A target nothing can name is a target nothing can verify.

## The rules clause 6 builds against — #281 comment 1, verbatim

> 100. 1 px #2c3e53 border, left border 2 px #34a9e8, ground #101c29, padding 11 px 14 px,
> symbol + body value.
> 101. All three ribbon strings kept, mutually exclusive, at the top of the results stack,
> with the dim they explain.
> 102. CHANGE against today: the ribbon itself is NOT dimmed — the dim starts below it. Today
> the ribbon's own label sits inside the dim it explains and measures 2.39:1 (#259). Ribbon
> text renders at full opacity, #c8d1dd on #101c29.

### A note on the palette names

Part 2 names colours `--mut`, `--body`, `--gen` and so on; this sheet's names for the same
values are `--ink-on-dark-faint` (#93a0b0), `--ink-on-dark` (#c8d1dd) and `--dim` (#ff8a2e).
Clause 6's CSS names the SHEET's tokens directly. An earlier draft wrote
`var(--body, var(--ink-on-dark))` — a fallback that works, but reads as a citation to a token
this sheet never declares, which is the same defect as an unsourced rule quote. Two more of
those (`var(--mut, …)` in clause 2's hero) were found and removed at the same time.

### What clause 6 does NOT measure

Acceptance line 6 is "Ribbon ≥ 4.5:1 measured mid-flight on the composited surface". That is
the prod leg's figure: happy-dom composites nothing and applies no stylesheet, so no test in
this commit claims a ratio. What the suite pins is the STRUCTURE that makes the measurement
come out right — the ribbon is not a descendant of the dimmed wrapper in any state that dims.
Get that wrong and the leg measures 2.39 again.
