# s2-triage-3 — every open issue against Direction A (#281)

Triaged 2026-09-16 against `34e27aa` (main tip). **Re-verified the same day against the
completed #281**, once Part 1 landed in the body and Part 2 (rev. 2026-09-16) landed as
comment 1. No code changed; this file and the drafts below are the whole deliverable.

## Provenance — what was read, and what changed on re-verification

**Read in full:** #281's body (55,473 chars, including Part 1 §1–§8 verbatim) and #281
comment 1 (43,813 chars, Part 2's numbered build rules). Part 2 rules are cited below as
**"#281, comment 1, rule N"**.

**Verified in source** (this worktree, at `34e27aa`):

- `FLOW.md` §8–§9 and `DESIGN-PRINCIPLES.md` P17–P22 — present on main, committed by `34e27aa`.
- `conestruct/site/lib/design/type-roles.ts:66,79,91,104` — exactly **four** roles
  (`section`, `step`, `field`, `provenance`). Ruling 180's "fifth type role" is accurate.
- `conestruct/site/lib/tiering.ts:160` — `assignTiers` exists.
- `src/rendering/tier_ledger.py` — exists. **#281 now cites this path correctly** (the
  earlier unqualified `tier_ledger.py` was repointed before re-verification).
- `conestruct/site/lib/render-proxy.ts:291-295` — `CorridorSpecRequestBody` carries
  `kind`, `speed`, `roadType?` and nothing else. #267's mechanism confirmed.
- `conestruct/site/components/AppFooter.tsx:8-13` — Terms / Privacy links, **no
  `min-height`**. This is the #264 residual, and §8.14 keeps the footer unchanged.
- Component files named by the issues all still exist: `ResultsHead.tsx` (94 lines),
  `SetupStrip.tsx` (1054), `ProgressRail.tsx` (127), `AppSheetMeta.tsx` (39),
  `TieredReference.tsx` (744), `lib/next-steps.ts` (131), `LocationPickerModal.tsx` (3293),
  `QuotePanel.tsx` (761).
- **`TRACE` does not exist in the tree.** No match in `conestruct/site/app`,
  `components`, `lib`, or `src/api/audit.py`. It is a Direction A construct only.

**Read from the issue, not verified in source:** every classification's account of what a
defect *is* comes from the issue body as filed. Where an issue self-labels "⚠ agent-quoted,
spot-check before working" (#194, #195) that caveat stands and is not discharged here.

### Two classifications changed on re-verification

The first pass ran before Part 1 and Part 2 were pasted into #281, and cited #281's ruling
numbers throughout because §8 could not be read. With §8 readable, **two issues move out of
CLOSED BY CONSTRUCTION into RE-AIMED.** Both moved for the same reason: the ruling that
"fixes" them is a *build rule on a surface Direction A keeps*, not a consequence of deleting
a surface — and §8.39 lists both under "Still open and inherited".

| Issue | Was | Now | The line that decides it |
|---|---|---|---|
| **#259** | CLOSED BY CONSTRUCTION (ruling 197) | **RE-AIMED**, Phase 1 | §8.8 keeps stale ribbons in KEPT, UNCHANGED, and says *"Note #259 ... is **NOT fixed by this direction**; Part 2 raises the ribbon label out of the dim."* §8.39 lists it still open. The fix is comment 1, rule **102** |
| **#276** | CLOSED BY CONSTRUCTION (ruling 196) | **RE-AIMED**, Phase 2 | §8.27: *"#276 ... **must be re-decided in the WHAT band's jurisdiction field**."* §8.39 lists it still open. Comment 1, rule **196**: *"a change in behaviour, **not a port**"* |

The corrected set is now **exactly §8.38's own list**:

> **8.38 Closed by construction:** #272 (label/chip left edge), #264 (rail hit targets),
> #262 (inline editors with no close) — all by deleting the surface, not by fixing it.

Three issues, and the triage independently arrives at the same three. Nothing else moved.

### What §8 confirmed that had been inferred

- **#212 / §8.32 — confirmed, and it gains an acceptance.** The sheet meta is dropped, and
  §8.32 goes further than the first pass assumed: *"The hydration defect noted against it
  ... **must not follow it there**: Part 2 specifies the nav citation as static text with
  no date."* §8.1 gives the nav that citation, so there is a new surface that could carry
  the defect, and §8.32 forecloses it. That assertion is now a Phase 1 acceptance.
- **#264's footer residual — confirmed, and sharpened into a rule collision.** §8.14 and
  comment 1 rule **30** both keep the footer unchanged; comment 1 rule **15** says *"Every
  interactive element ≥ 32 px in its smaller dimension at 1440 px, ≥ 44 px at 380 px"* with
  no exemption. Rule 15 is the wider statement and should win.
- **#235 — the first pass read "A/B/D" as a typo for A/B/C, and that is what it was.**
  #281's Reference line now reads A/B/C. The remainder is **surface D**, the plan PDF, which
  no phase covers. §8.39 lists #235 still open, consistent with a live remainder.
- **N5 / TRACE's phase — confirmed as Phase 1.** It had been flagged as an inference. Part 1
  §6.4 and §2 put TRACE *inside the reference disclosure*, and §8.9 renames section 03 to
  "reference disclosure" — a Phase 1 surface. The inference held.
- **#272 — §8.29 adds a second thing to preserve.** Not only "the file count stated exactly
  once", but *"the reserved slot that stops the strip pushing the results down at the settle
  (kept, as the results stack's own reserved first row)"*.

### One conflict inside #281 worth knowing about

**§8.20 drops the picker modal; ruling 189 retains it.** §8.20 reads *"Location picker modal
— DROPPED as a modal ... **Decision needed** on whether the band can carry all of it, or
whether a subset stays behind a modal at 1440"*, and §8.40 flags it as one of two places the
direction could quietly drop work.

**Ruling 189 is the answer to that decision**, and it sits in the rulings section, which is
where #281 says every ruling on the spec's departures lives:

> **189 the modal migration — phased.** Phase 2: the Where band owns the aerial and the
> outcome; the picker modal stays for the decision work ... It migrates piece by piece in
> Phase 3 and after. Nothing in the column's structure depends on the modal being gone.

So §8.20 poses the question and 189 rules it. **#209, #234 and #267 are aimed at Phase 2 on
ruling 189's authority**, with §8.20's migration as their Phase 3+ tail. If 189 is ever
revisited, those three re-aim with it — they are the issues riding on the modal surviving
Phase 2.

### Prod tip at triage time

`healthz` sha `c598ac2`; `git rev-parse HEAD` `34e27aa`. **They do not match.** The
one-commit delta is `34e27aa`, docs-only (`FLOW.md`, `DESIGN-PRINCIPLES.md`, 2 files, 155
insertions). No product code differs, and Modal does not deploy on a docs merge.

---

## Part 1 — the three buckets

35 issues open; #281 is the umbrella and is not classified. **34 classified, 0 unclassified.**

| # | Bucket | Reason | Phase |
|---|---|---|---|
| #28 | UNAFFECTED | `AuditResponse.sections` typing. §8.39 lists it "still open and inherited". N1 and N5 both enlarge the shape it is about | — |
| #128 | UNAFFECTED | Corner-quadrant schema + generator; MUTCD domain, no screen | — |
| #146 | UNAFFECTED | Unbuilt PDF ingestion; no surface exists to redraw | — |
| #153 | RE-AIMED | #281's acceptance names 1440×1000 and 380×800; comment 1 rule 15 sets both floors; FLOW §9 makes 380 its own phase | 4 |
| #194 | UNAFFECTED | `QuotePanel` saved mode, behind `NEXT_PUBLIC_AUTH_UI`. §8.11 keeps the sandbox quote panel as a disclosure; saved mode is untouched | — |
| #195 | UNAFFECTED | `/app/plans/new`, auth surface. Not `/sandbox` | — |
| #202 | UNAFFECTED | Quote-settings persistence; backend + saved mode | — |
| #203 | UNAFFECTED | Saved-mode download anchors; auth surface | — |
| #204 | UNAFFECTED | Flag record + flip checklist. No phase touches the flag | — |
| #205 | UNAFFECTED | Jurisdiction-record reachability; data decision | — |
| #208 | UNAFFECTED | mypy ratchet baseline; tooling | — |
| #209 | RE-AIMED | Picker retained for Phase 2 (ruling 189); the form grid survives inside the WHAT band (§8.16, §8.22) | 2 |
| #212 | RE-AIMED | §8.32 drops the sheet meta **and** forbids the defect following to the nav. The `app/app/page.tsx` half and the `pageerror` listener survive | 1 (harness) |
| #215 | RE-AIMED | §8.24 moves the schedule section into the WHAT band as the work-dates field; rulings 198/199 | 2 |
| #234 | RE-AIMED | Picker retained for Phase 2 (ruling 189); §8.20's migration is its Phase 3+ tail | 2 |
| #235 | RE-AIMED | Reference line reads A/B/C; §8.9 renames and keeps section 03. Remainder is surface D, a **print** surface no phase covers. §8.39 still open | 2 + unphased |
| #236 | UNAFFECTED | `verdict_hook.py` file count; tooling | — |
| #237 | RE-AIMED | §8.17 replaces the rail, killing the named collision; the suite must be re-pointed regardless | 2 |
| #239 | UNAFFECTED | `/landing` copy; archived page, outside `/sandbox` | — |
| #242 | UNAFFECTED | Deploy-skew mechanism, not a drawn surface. Four phases is four more chances for it to bite | — |
| #243 | UNAFFECTED | Note 8 checker; backend-owned (Rule 3). §8.39 "still open and inherited" | — |
| #244 | UNAFFECTED | `DebugSnapshotButton`; §8.15 keeps it unchanged. #281's payload-sender contract absorbs its acceptance | — |
| #256 | UNAFFECTED | Phase 0 dependency. §8.39: *"this direction's refusal frame is still the surface that defect is seen through"* | 0 |
| #259 | **RE-AIMED** *(changed)* | §8.8 keeps the stale ribbons and says #259 is **not** fixed by the direction; §8.39 still open. Comment 1 rule **102** is the fix | 1 |
| #262 | CLOSED BY CONSTRUCTION | §8.38 and §8.27 — *"closes #262 by deletion, not by fix"* | 2 |
| #264 | CLOSED BY CONSTRUCTION | §8.38, §8.17 — *"#264 ... is moot"*. **Residual: the footer** (§8.14 vs comment 1 rule 15) | 1 + 2 |
| #265 | UNAFFECTED | Edition string, two literals, plus a Rule 9 ruling. Backend + PDF | — |
| #266 | UNAFFECTED | Audit PDF heading hard-codes `S-630-1`. §8.39 "still open and inherited" | — |
| #267 | RE-AIMED | Picker retained for Phase 2 (ruling 189); preview-as-read creates a **second** instance of the same defect | 2 |
| #272 | CLOSED BY CONSTRUCTION | §8.38, §8.29 — *"#272 becomes moot"* | 1 |
| #276 | **RE-AIMED** *(changed)* | §8.27 — *"must be re-decided in the WHAT band's jurisdiction field"*; §8.39 still open; comment 1 rule 196 *"not a port"* | 2 |
| #277 | RE-AIMED | §8.23 folds the block into the WHAT band's per-field provenance lines — *"nothing it said is gone"* | 2 |
| #279 | UNAFFECTED | Phase 0 dependency | 0 |
| #280 | RE-AIMED | §8.23 deletes the block its 332.8 px measurement was taken against; the `ROAD_TYPE_LABELS` question survives untouched | 4 |

### Counts

- **CLOSED BY CONSTRUCTION — 3**: #262, #264, #272 — **exactly §8.38's list**
- **RE-AIMED — 12**: #153, #209, #212, #215, #234, #235, #237, #259, #267, #276, #277, #280
- **UNAFFECTED — 19**: #28, #128, #146, #194, #195, #202, #203, #204, #205, #208, #236, #239, #242, #243, #244, #256, #265, #266, #279
- **Unclassified — 0**

§8.39's "still open and inherited" list is **#276, #256, #259, #243, #266, #235, #28** —
seven issues, and the triage classifies all seven as open (two re-aimed, five unaffected).
No disagreement.

Of the 19 unaffected, **9 are the saved-mode / auth / launch-prep cluster** (#194, #195,
#202, #203, #204, #239, plus #205, #208, #236 as tooling and data). Direction A does not
touch any of them, and they do not touch it — the cleanest concurrency in the board.

---

## Special cases, ruled explicitly

### #235 — supersession confirmed, remainder is a print surface

#281's Reference line reads **"#235 (surfaces A/B/C superseded by this)"**. The first pass
reached A/B/C by argument before the line was corrected; the argument and the line now agree.

- **A — road section.** Superseded by the WHAT band's per-field provenance (§8.23, ruling
  198). The floating-annotation complaint is answered structurally: the annotation becomes
  the field's own provenance clause instead of a note the reader must associate by reading.
- **B — disclosure footnotes.** Superseded by the counted disclosures (§8.9, Phase 1).
  **#214's constraint survives verbatim** and must be restated in Phase 1's acceptance: the
  information survives somewhere standing and inspectable; restyling and relocating are in
  scope, deleting is not.
- **C — reference section.** §8.9 renames section 03 to "reference disclosure", keeps all
  five tiers, lifts ▲/⚠ into NEEDS YOU, and keeps the disclose-never-writes contract and the
  read-only signposts. The consistency pass happens against a larger type system than this
  issue assumed — ruling 180's fifth role plus the nine sizes.
- **D — plan PDF density. Remains open. Unphased.** Print-layout pass with the containment
  harness re-run (zero overflow is not negotiable). Disjoint from every Direction A file.

### #253, #249, #273 — closed, with acceptances that die

Closed and **not ranked**. What retires, so the next arc does not inherit a dead acceptance:

- **#253** (next-steps strip). `lib/next-steps.ts` and `.ns-strip` are dropped (§8.29). Its
  ruling 1 — *"the strip **replaces** the lockup; one field, one surface"* — is spent: both
  are gone. **Surviving: its rulings 3 and 4** — chip 3 is "N FILES READY from the served
  bundle or absent-with-reason, never an invented wire state", and "cleared" must be a
  server-confirmed state. Rule 10 statements about wire honesty, not about a strip. Ruling
  2's "digits from the wire, no hard-coded five" is live, and ruling 185 restates it.
  **§8.29 adds one more survivor the first pass missed:** the reserved slot that stops the
  strip pushing results down at the settle, kept as the results stack's reserved first row.
- **#249** (site conditions leader-dot ledger). The lockup is gone twice over. **Ruling 4
  survives and hardens**: the lockup may not print "0 · No site conditions detected" when
  the scan is `not_run` or `unavailable` — now a fact line's problem, Phase 2. **Dead:**
  every `.sc-*` geometry acceptance, the leader-dot treatment, the footer ISO stamp, and the
  `aria-pressed` vs native-radio question. But note §8.5 keeps the corrections block
  **whole** inside NEEDS YOU — *"the staging contract, the Apply row's standing sentence,
  the disabled-at-zero button with its reason, the dismiss picker's always-mounted note
  field, and the 'results disclose rather than lock' rule all survive verbatim"* — so more
  of #249's content survives than its form suggests. The five condition rows keep wire order.
- **#273** (detected vs applied). Its close comment already retired the ink-equality and
  equal-track acceptances. **Now the ledger form itself retires**: §8.23 folds the block into
  per-field provenance lines, so the 16 px verdict gutter, the two-line clause and the 380
  two-line reserve go with it (which is why #280 re-aims). **Surviving: the ruled product
  question** — on matching rows the detected value *is* printed; "same as detected" was ruled
  against on evidence. §8.23 says it plainly: *"The separate block is gone; nothing it said
  is gone."* Ruling 188 restates it for the new surface and adds a second channel (the tally
  in words).

### #256, #279 — Phase 0, and what leans on them

Both **UNAFFECTED**. What in #281 does not work until they land:

**#256** carries three dependents, one hard:

1. **The nearest-intersection tag.** *"#256's pre-scan-on-confirm lever is a **hard
   dependency**; until then the tag prints the road name, lat/lng in provenance."* Phase 3.
2. **Phase 3 entire** — *"Backend-first; opens with the scenario version field; **gated on
   #256**."*
3. **Phase 1's ordering.** FLOW §9: *"Goes first while **#256 clears the runway for 2**."*
   Phase 1 does not need #256; #256 needs to be running during Phase 1 so Phase 2 is not
   waiting on it.

§8.39 adds the framing: *"this direction's refusal frame is still the surface that defect is
seen through"* — §8.4 keeps the refusal container unchanged in content and behaviour and
moves it up the column, so a #256 refusal renders in a **kept** surface. The redesign
neither fixes nor hides it.

The arc-31 investigate result changes what #256's fix is, not what depends on it: the root
cause is a mirror chain that hands every mirror the whole remaining budget
(`src/rules/site_detection.py:168-173`), not a slow query. A per-mirror cap fixes it inside
the existing budget. **The pre-scan-on-confirm lever that Phase 3 depends on is still
unbuilt** — lever 2 in #256's proposed solution, which the investigate arc did not reach.
Phase 3's gate is on that lever specifically, not on the refusal rate.

**#279** carries two:

1. **The proposed kind.** *"'Your tap looks like a right-shoulder closure' has no producer
   today. The proposed-kind derivation is Phase 3's."* A derivation that proposes a kind
   reads the classification; `isUrban` resolving false on an OSM `primary` in central Denver
   would propose from a wrong road type.
2. **The WHAT band's per-field provenance** (§8.21, §8.23). Road type is one of the two
   fields §8.21 names explicitly, printed *with* its provenance line — §8.23's example is
   *"OSM · 30 mph · measured"*, amber and "inferred, not measured" where it is a guess. #279
   is the value being wrong behind exactly that clause, and suggest-never-set is in #281's
   inherited contracts.

The **scan bbox on a two-approach job** — Phase 3's "aerial growing the approaches" — sits
across both: the bbox is #256's cost driver (arc-31 measured wide-vs-tight directly), and
what counts as an approach depends on the classification #279 breaks.

### The backend-honesty group, and what happens to #212

**#212 is the only one of the group that moves.** #244, #243, #265, #266 print on surfaces no
phase redraws — and §8.15 keeps the debug snapshot button explicitly unchanged. #212 printed
on the sheet meta, which §8.32 drops.

- The **`AppSheetMeta.tsx:21` instance dies with the surface.**
- **§8.32 creates a new obligation**: the nav citation that inherits the TA/sheet string is
  *"static text with no date"*. That is an assertion Phase 1 must make, not assume — this
  defect arrived the first time because `a9201f8` replaced a stale hardcoded date with a
  computed one.
- **Two of three acceptance bullets survive**: the `app/app/page.tsx:15` instance (dormant
  behind the unset auth flag, untouched by any phase) and the `pageerror` listener.

So #212 is **RE-AIMED, narrowed — not closed.** Closing it would retire the `pageerror`
listener along with the surface, and that listener is the detector for this class across four
phases of new rendering. It is the most valuable line in the issue and has nothing to do with
the sheet meta.

### #264's residual, now a rule collision

§8.38 names #264 closed by construction and §8.17 says the rail entries are moot. Nine of ten
measured rows go with their surfaces. **The tenth does not:** §8.14 keeps the footer in the
UNCHANGED list and comment 1 rule **30** repeats it, while comment 1 rule **15** states the
floor with no exemption — *"Every interactive element ≥ 32 px in its smaller dimension at
1440 px, ≥ 44 px at 380 px."*

`AppFooter.tsx:8-13` has no `min-height` (verified in source). **Rule 15 is the wider
statement and should win**; "footer unchanged" means unchanged in content and layout, not
exempt from the floor, and honouring it costs nothing visible (padding, not size — P1).

The close hands this issue's own page-wide phrasing to Phase 1's acceptance, so the footer is
caught by the probe rather than by a surviving issue.

---

## Part 2 — the issues Direction A creates

Nine new issues: the five things the spec did not know, plus four phase umbrellas. Phase 4's
umbrella is deliberately not drafted (#281: "Phase 4 can wait").

| Draft | What | Phase | Note |
|---|---|---|---|
| N1 | Preview-as-read backend flag | 0 | Backend-first; Pydantic drops unknown fields |
| N2 | Nine type sizes + role 5 + the two hexes | 0 | Owners named, before any surface uses them |
| N3 | The proposed-kind producer | 3 | No producer today; chips render unselected until it exists |
| N4 | The nearest-intersection tag | 3 | Hard-gated on #256's pre-scan lever |
| N5 | TRACE's formulas as wire fields | 1 | **Phase now confirmed** — §6.4 puts TRACE inside the reference disclosure (§8.9, Phase 1) |
| P0 | Phase 0 umbrella — foundations | 0 | Absorbs N1, N2, #256, #279 |
| P1 | Phase 1 umbrella — the results stack | 1 | Absorbs #272, N5, #259, #264's results half, #212's harness half |
| P2 | Phase 2 umbrella — band stack and revision | 2 | Absorbs #262, #276, #209, #215, #234, #237, #267, #277, #235 A–C, #264's setup half |
| P3 | Phase 3 umbrella — the work segment | 3 | Absorbs N3, N4; gated on #256 |

---

## Part 3 — the ranked board

Everything open after Parts 1–2, in build order. Closed issues are not ranked. The three
CLOSED BY CONSTRUCTION issues are not ranked — they are absorbed by their phase umbrella and
close when it is posted.

### Track A — Phase 0, blocks everything

| Rank | Item | Why here | Concurrency |
|---|---|---|---|
| 1 | **#256** scan budget | Phase 3 is gated on it; Phase 1 wants it running alongside. Investigate **done** (`s2-arc31-scan-budget`, `67d95c7`); next is the 📋 plan checkpoint on a per-mirror cap + the fold, then the **pre-scan lever** Phase 3 needs | `src/rules/site_detection.py`, `src/api/site_scan.py` |
| 2 | **#279** classifier `isUrban` | Phase 3's proposed kind and the WHAT band's provenance line both read it | `lib/road-detection/classify.ts`, `road-bearing/route.ts` |
| 3 | **N1** preview-as-read flag | Backend-first: **must ship before any Phase 2 surface sends it** — Pydantic silently drops unknown fields | Backend request schema + `render-proxy.ts` |
| 4 | **N2** nine type sizes + role 5 | One ruled exception commit with owners, **before any surface uses them**. Cheap; unblocks every visual phase | `lib/design/type-roles.ts`, `globals.css` |

**1, 2, 3 and 4 all run concurrently.** Four disjoint file sets, four different layers. The
widest parallelism in the board, and it is at the front.

### Track B — Phase 1, the results stack

| Rank | Item | Why here | Concurrency |
|---|---|---|---|
| 5 | **N5** TRACE formulas as wire fields | Backend-first, same Pydantic reason as N1. Must land before the row that prints it | `src/api/audit.py` |
| 6 | **P1** Phase 1 umbrella | Frontend-only, no fixture re-baseline. Absorbs #272, #259, #264's results half | `ResultsHead.tsx`, `TieredReference.tsx`, `lib/next-steps.ts`, `GeneratorShell.tsx` |
| 7 | **#212** (narrowed) `pageerror` listener | The detector for four phases of new rendering — **land it before Phase 1's surfaces**, not after | Live-check runner — disjoint from everything |

**5 and 7 run alongside Track A.** 6 sequences after 5 (the row cannot print a field the wire
does not carry) and wants 4 in place. **Pull 7 forward to ~rank 2.5** — a harness change,
disjoint from every file in the board, highest value before rendering starts.

**#259 lands inside 6**, not as its own rank: comment 1 rule 102 is a build rule of the
stale-ribbon block, not a separate fix.

### Track C — backend honesty, runs alongside everything

Five UNAFFECTED issues that touch no Direction A file and can run at any time.

| Rank | Item | Files |
|---|---|---|
| 8 | **#243** Note 8 counts adjustment signs | `src/rules/site_adjustments.py` + the Note 8 checker |
| 9 | **#265** edition string, two literals + the Rule 9 ruling | `plan_sheet.py:3158`, `base.md.j2:128`, `data/jurisdictions/denver.json` |
| 10 | **#266** audit PDF hard-codes `S-630-1` | `audit_blocks.py:204` |
| 11 | **#244** snapshot posts `scenario` | `DebugSnapshotButton.tsx:284` |
| 12 | **#28** type `AuditResponse.sections` | `render-types.ts` — **grows** as N1 and N5 add fields |

**8, 9, 10 are mutually disjoint** and disjoint from Tracks A and B. 9 and 10 share a
reviewer's context (edition / standard-sheet honesty) though no file — worth batching. 11 is a
one-line fix that belongs with whichever arc next touches the sender list. **12 sequences
after 3 and 5**, or it re-baselines twice.

### Track D — Phase 2, the band stack

| Rank | Item | Why here |
|---|---|---|
| 13 | **P2** umbrella | The largest absorber: #262, #276, #209, #215, #234, #267, #277, #264's setup half, #235 A–C, #237's re-point |
| 14 | **#237** live-check selectors | Not optional — the suite breaks the moment the rail dies (§8.17). Do it **inside** Phase 2 |

**Sequences after Track A** (needs N1's flag and N2's sizes) **and after Phase 1** (FLOW §9
orders the results stack first; #256 clears the runway for 2). Within Phase 2 the absorbed
issues are one design pass, not fourteen fixes — which is why they are absorbed, not ranked.

**Watch §8.20/§8.40.** The modal-to-band migration is flagged in #281 itself as one of two
places the direction could quietly drop work. #209, #234 and #267 are the issues riding on
ruling 189's phased retention; if 189 is revisited they all move.

### Track E — Phase 3, the work segment

| Rank | Item | Why here |
|---|---|---|
| 15 | **P3** umbrella | Backend-first; opens with the scenario version field |
| 16 | **N4** nearest-intersection tag | **Hard-gated on #256's pre-scan lever** — not on its refusal rate |
| 17 | **N3** proposed-kind producer | Reads the classification; wants #279 landed |

**Sequences after Track A and Track D.** 16 and 17 are disjoint once the scenario version
field exists, so they run concurrently inside the phase.

### Track F — deferred, no phase

| Item | Status |
|---|---|
| **#235 remainder (surface D)** | Print-layout pass. No phase covers print. Disjoint from all |
| **#153** | Folds into Phase 4; comment 1 rule 15 already sets both floors |
| **#280** | Folds into Phase 4; its measurement retires first (§8.23) |
| **#128, #146, #205, #208, #236, #242** | Unaffected, unscheduled, unchanged by this triage |
| **#194, #195, #202, #203, #204, #239** | Saved-mode / launch-prep cluster. Batch as one arc at flag-flip |

### What must sequence, in one list

- **N1 and N5 before any surface that sends or prints their fields** — Pydantic silently drops
  unknown fields. The only hard correctness ordering in the board.
- **N2 before any surface uses the nine sizes** — #281's own words: "never as debt".
- **#256's pre-scan lever before N4.** Named a hard dependency.
- **Phase 1 before Phase 2** — FLOW §9.
- **Phase 2 before Phase 3** — the band stack is what the work segment sits in.
- **#237 inside Phase 2**, not after it.
- **#28 after N1 and N5**, or it re-baselines twice.

Everything else in Tracks A, B and C is concurrent.

---

## Ship line

Read-only against `gh`. Nothing is posted by this arc. To ship the file:

```
.\scripts\ship.ps1 -Branch worktree-s2-triage-3
```

Docs-only — no Modal redeploy is required and `/healthz` will not move. The drafts below are
posted by Ryan through the web UI.

---

# The drafts

Nothing below was posted. The same files live under `%TEMP%\s2-triage-3\`; the commands
are in the final section.

## Close comments (3)

### `gh issue comment 262` — then close

Closed by construction — Direction A (#281), Part 1 §8.38: *"#272 (label/chip left edge), #264 (rail hit targets), **#262 (inline editors with no close)** — all by deleting the surface, not by fixing it."*

§8.27 is the surface's entry and it is unusually explicit about what is being traded away:

> **Setup strip — DROPPED as a strip**; its job is done by the collapsed fact lines. The ⤢ / ✎ edit split is replaced by one link per fact line, and every edit — simple or structural — now re-opens a band. Consequences: **the inline editors that commit on blur are gone (which closes #262 by deletion, not by fix)**, the work-zone length draft-and-commit exception is gone with them, and jurisdiction / street class / speed / lane width / date / hours no longer edit in place. **DECISION NEEDED: this trades six one-click inline edits for six band re-openings.**

Ruling **190** takes that decision — *"loss of inline strip edits — confirmed"* — and #281 records the close as by deletion. This comment is that record. §8.40 flags this as one of the two places the direction could quietly drop work that exists today, so the trade is on the record, not assumed.

**Every one of this issue's four defects has a live analogue in revision mode**, so Phase 2's acceptance must check all of them:

- **No way shown to close (P3).** A re-opened band collapses back to its fact line. The acceptance is that the exit is *visible*, not merely available.
- **Escape does nothing (P3).** Escape must cancel the staged change and open **zero requests**. This issue's fake-timer test ("0 fetches") transfers unchanged, written against the band.
- **Commit-on-blur with no Apply (P7).** Resolved by #281's preview-as-read ruling — *"no band, no lock, never memoised, never written; commit-on-blur/Enter, never per keystroke"* — plus ruling **202**'s Apply semantics. The acceptance: **a preview opens no band and takes no lock**; only APPLY writes. §1.1 states it as the structural rule: *"nothing is written until APPLY."* Ruling **191**'s staged sentence ("1 field · 2 corrections") must enumerate what one Apply carries.
- **At 380 the open editor grows the strip 211 → 255 and moves everything below 44 px (P1).** This needs the most care, because ruling **184 rejected** reserved band heights. The replacement guarantee is the arc-28 landing machinery — `armLandingCheck`, settle-plus-tolerance, counted cap — which ruling 184 extends to *every* collapse, not only Generate. So the acceptance is not "the band height is fixed"; it is **"every collapse and every re-open lands the next band at a computed spot, counted."**

One thing this issue's deletion takes with it that is worth naming: **the work-zone length draft-and-commit exception** (#252's draft pattern) goes too, per §8.27. That pattern was the model this issue proposed extending to every editor. It is superseded by the preview, which is a stronger version of the same idea — a read that writes nothing until Apply.

`SetupStrip.tsx:78-124, 797-812` is the code that goes. #252's lock declarations (`data-write`, `aria-disabled` openers) are in #281's inherited contracts and survive.

Refs #281

### `gh issue comment 264` — then close

Closed by construction — Direction A (#281), Part 1 §8.38, which names this issue in its closed-by-construction list: *"#272 (label/chip left edge), **#264 (rail hit targets)**, #262 (inline editors with no close) — all by deleting the surface, not by fixing it."*

§8.17 is the specific line: *"the rail's jump-to-section buttons are gone, because there are no off-screen sections to jump to. **#264 (rail entries under 32 px) is moot;** the fact-line CHANGE links are specified at 32 px minimum in Part 2."*

Nine of the ten measured rows go with their surfaces:

| control | where it goes | authority |
|---|---|---|
| rail entries ×5 | the rail is replaced by the move ledger and pending fact lines | §8.17 |
| "Enter manually" / "Project details" | setup panel dissolved into the band stack | §8.16 |
| speed slider `input.range-orange` | per-kind form → the WHAT band's field grid | §8.22 |
| "↻ Retry scan" | refusal container, moved up the column | §8.4 |
| signposts "correct in setup ↑" | kept as read-only signposts in the reference disclosure | §8.9, §6.5 |
| "↓ Audit PDF" | section 03 → reference disclosure / download row | §8.9, §8.6 |
| record "Undo", "Edit full setup ⤢" | setup strip dropped; one CHANGE link per fact line | §8.27 |

**The residual: the footer.** §8.14 puts it in the KEPT, UNCHANGED list — *"Footer — kept, unchanged, below the draft notice"* — and #281 comment 1, rule **30** repeats it: *"Footer — unchanged."* So `AppFooter.tsx:8-13` keeps Terms at 35 px × 16 and Privacy at 49 px × 16 (verified in source at `34e27aa`: no `min-height` on the component).

**That collides with comment 1, rule 15**, which is page-wide and has no exemption:

> **15. Hit targets.** Every interactive element ≥ 32 px in its smaller dimension at 1440 px, ≥ 44 px at 380 px. The fact-line link (rule 56) is the one that this fixes relative to today.

Rule 15 says *every* interactive element; rule 30 and §8.14 say the footer does not change. **Rule 15 is the wider statement and should win** — which means "footer unchanged" means unchanged in content and layout, not exempt from the floor. Padding, not visible size (P1), so honouring rule 15 costs the footer nothing visible.

This issue's acceptance was already phrased page-wide — *"every enabled control on the settled page ≥ 32 px tall at 1440"* — and **that phrasing is what moves**, not the ten-row table. Phase 1 carries:

- The walk's TARGETS probe runs over the **settled page, footer included**, and reports **0 controls under 32 px** at 1440 (rule 15).
- **≥ 44 px at 380** for every interactive element (rule 15 again — note it is stated unconditionally at 380, not only for controls a crew taps).
- axe `target-size` 0 at 380, which retires the two pre-existing findings this issue named.
- Rect table before/after: no visible box changes (P1).

Phrased that way the footer is caught by the probe rather than by a surviving issue, which is the right outcome — a floor that only holds on surfaces someone remembered to list is not a floor.

#153 still owns the 44 px phone floor and the viewport matrix; see its own re-aim comment.

Refs #281

### `gh issue comment 272` — then close

Closed by construction — Direction A (#281), Part 1 §8.38, which names this issue first in its closed-by-construction list: *"**#272 (label/chip left edge)**, #264 (rail hit targets), #262 (inline editors with no close) — all by deleting the surface, not by fixing it."*

§8.29 is the surface's own entry:

> **Results head and next-steps strip ("NEXT — 3 STEPS") — DROPPED.** Its three chips pointed at site conditions, pending items and downloads; in this column all three are visible in the same viewport, so the strip restates what is already on screen. ... **#272 becomes moot.**

Ruling **193** says the same thing and names where the surviving rule goes. `lib/next-steps.ts` and the `.ns-strip` rules go with the strip, and with them the label/chip-row edge this issue measures.

**Two things must be preserved from the strip, and §8.29 names both:**

1. **The reserved slot.** *"the reserved slot that stops the strip pushing the results down at the settle (kept, as the results stack's own reserved first row)."* This is the P1 no-movement guarantee, re-homed — the results stack owes it now, and it is the half of this surface that was working correctly.
2. **The file count stated exactly once** on the page (ruling 193 passes it to the download row). A Rule 10 statement about the served bundle, not about a strip, and it outlives its host.

**The cause can recur.** The defect was a label and the row it heads binding to different insets — one element inside the padded box, one inheriting the zone's. The results stack has at least two places with that shape: the **NEEDS YOU** block (a heading over item rows) and the **download row** (a label over four cards, §8.6). P4 is the rule and it is measurable, so Phase 1's acceptance carries:

- For every heading-over-row pair in the stack, `label.getBoundingClientRect().left === row.left` (±1), measured in the live check at **1440×1000 and 380×800** — the pair #281's umbrella acceptance names.
- No glyph clipped at a container's left boundary (`scrollWidth` fits its box).
- The reserved first row holds at the settle: **no results movement**, measured by the arc-28 landing machinery, which ruling 184 extends to every collapse.
- P12: the element the operator is meant to read first does not read as cheap.

Refs #281

## Re-aim comments (12)

### `gh issue comment 153` — stays open

Re-aimed at Direction A (#281) — **Phase 4, the 380 px arc.**

This issue has been blocked on a ruling on the supported viewport matrix, with no code to start before it. **#281 takes most of that ruling**, without being filed as an answer to this issue:

- #281's umbrella acceptance: *"Every state in Part 1 §2 is measured on prod at **1440×1000 and 380×800** by the end of Phase 4."* That names the supported pair.
- FLOW.md §9 makes **"Phase 4 — the 380 px arc"** its own phase, "after the shape is stable".
- Ruling **182/183** sets the same primary-action rule at 380 as at 1440: *"Same rule at 380. One primary per state, no viewport inconsistency."*
- Ruling **187** is withdrawn — *"all six panel rows survive at 380"* — so the direction does not degrade content by dropping rows at width.

Against this issue's own options, that is effectively **(b), responsive down to tablet, taken down to 380** — narrower than (c)'s full phone commitment only in that nothing has yet ruled what the **plan sheet and the corridor map** degrade to. Those two artifacts are the hard part this issue correctly identified, and **Direction A does not touch either** — no phase covers print, and the corridor map sits inside the picker modal, which ruling 189 retains.

**New home:** Phase 4's issue, which does not exist yet by ruling (#281: "Phase 4 can wait").

**Acceptance changes:**

- The "supported sizes named in a doc" bullet is **partly discharged** — 1440×1000 and 380×800 are named in #281's acceptance and in FLOW.md §9. What is still unnamed is the **floor**: what happens below 380, and whether an honest message or a degraded layout renders there. That is the part of this issue that survives intact, and it is still a ruling, not a task.
- `verify-jbar-stability.mjs:32` still tests a single `[1440, 1100]`. Direction A's live checks measure 1440×1000 and 380×800, which is a third size again — **reconcile the three before Phase 4**, or the stability harness is measuring a viewport nothing else uses.
- The **plan sheet and corridor map degradation question is unchanged** and unowned. It is the reason this issue should not simply close into Phase 4.
- The dead prior-art paths (`design/generator-redesign/`, `docs/endeavor-b-spec.md`) should be struck from the body regardless — that is a one-line edit and needs no ruling.

#264's desk-floor close hands the page-wide ≥ 32 px probe to Phase 1; **this issue keeps the 44 px phone floor**, as #264 already recorded.

Refs #281

### `gh issue comment 209` — stays open

Re-aimed at Direction A (#281) — **Phase 2**, with half of it reaching into Phase 3.

The picker modal **survives**. Ruling 189: *"the modal migration — phased. Phase 2: the Where band owns the aerial and the outcome; **the picker modal stays for the decision work** (detection, candidates, bearing, cross-street, suggestions), opened from the band. It migrates piece by piece in Phase 3 and after."* So both findings survive on a surface the redesign keeps.

**New home, per finding:**

- **Finding A — editors on non-applicable kinds.** The lanes-per-direction and divided editors are *field* editors, not decision work. Ruling 198 puts fields in the **What band** (*"Where absorbs the kind; What absorbs dates"*), and the What grid carries **per-field provenance**. So A migrates out of the modal into the What grid — Phase 2 builds the grid, and the editors move when the modal's field half migrates. Until then the defect sits in the modal, unchanged.
- **Finding B — the lanes input accepts 6 against a domain max of 4.** Pure input-bound hygiene, no dependency on which surface hosts it. It can be fixed at any time in either home; `max={4}` with the bound's provenance in a comment is the same one-line change before or after the migration.

**Acceptance changes:**

- Finding A's fix — *"hide or read-only those editors per kind (with the reason shown)"* — gets sharper in the What grid than it was in the modal, because the grid has a provenance clause per field. **The reason becomes the clause, not a separate note.** A field the kind discards renders with its reason in the same channel every other field uses.
- The `skipped_not_applicable` handoff note from #198 is what makes the current state honest. **It must survive the migration** — #281's inherited contracts carry "#198 byte-identity", so the note's string does not change shape when its host does.
- Ruling **188** is worth reading against Finding A: *"unchanged values — `#c8d1dd`, every row stays"*. The grid does **not** drop rows that did not change, so a not-applicable field is a *row that is present and explained*, not a row that vanishes. That is the opposite of "hide", and it is the newer ruling — **prefer read-only-with-reason over hidden.**

Rule 10 is the underlying rule either way: offering an editor whose value is predestined for the bin is a silent discard even when the discard is disclosed afterwards.

Refs #281

### `gh issue comment 212` — stays open

Re-aimed and **narrowed** by Direction A (#281). Not closed — read the second half before retiring anything.

**What dies, now verifiable.** Part 1 §8.32:

> **Sheet meta — DROPPED from the screen;** the TA/sheet citation it carried moves to the nav's right edge post-generate. **The hydration defect noted against it (a UTC-midnight date computed at render) must not follow it there: Part 2 specifies the nav citation as static text with no date.**

So `AppSheetMeta.tsx:21` and the baked `ISSUED` date go with the surface, and with them the `#425 → #418 → #423` trio on `/sandbox`. The `new Date().toISOString().slice(0, 10)` call and its wrong comment (*"UTC keeps the value identical across SSR and hydration"* — true only same-day) are deleted rather than fixed.

**§8.32's second sentence is a new acceptance, and it belongs to Phase 1.** §8.1 gives the nav the citation — *"App nav — kept. Gains the TA/sheet citation on the right after a plan lands"* — which is a new surface that could carry the same defect. §8.32 forecloses it: **static text, no date.** That must be asserted, not assumed, because this is precisely how the defect arrived the first time: `a9201f8` replaced a stale hardcoded date with a computed one, and the fix for one lie created the next.

**What survives, and why this issue stays open.** Two of the three acceptance bullets never depended on the sheet meta:

1. **`app/app/page.tsx:15`** — the same class (`Date.now()` relative timestamps), dormant behind the unset `NEXT_PUBLIC_AUTH_UI`. No Direction A phase touches `/app`; every phase is `/sandbox`. It is a live hydration hazard the day the flag flips (see #204's flip checklist).
2. **"Live checks fail on any page-level thrown error going forward."** A **harness** change — the `pageerror` listener — and the most valuable line in this issue. This class surfaced *only* via `pageerror`; console listeners miss thrown recoverable errors. Direction A ships **four phases of new rendering**, four new chances to introduce it on surfaces nobody has measured.

**Acceptance changes:**

- *"`ISSUED` renders an honest value"* — **retired with the surface.** There is no `ISSUED` to render.
- **Added, from §8.32:** the nav's TA/sheet citation is **static text with no date**, asserted in Phase 1. If it ever needs a real issue date, Rule 10 applies fresh and §8.32 is the authority to re-open the question deliberately.
- *"Zero hydration errors on a page built the previous UTC day"* — **survives and widens** to the column, asserted in every phase's prod leg.
- The `pageerror` listener bullet survives unchanged and **should be pulled forward**. It is disjoint from every file in the redesign, costs a line in the runner, and its value is highest **before** Phase 1 starts rendering.

**Scope this issue down to the two survivors plus §8.32's nav assertion**, and land the listener first.

Refs #281

### `gh issue comment 215` — stays open

Re-aimed at Direction A (#281) — **Phase 2, the What band.**

The schedule section is redrawn, not dropped. Ruling **198**: *"four bands, not five ... Where absorbs the kind; **What absorbs dates**."* Ruling **199**: *"work dates as a field in What — confirmed."* So the work-window timeline moves into the What band as a field, and this defect moves with it: **unlabeled window boundaries survive any redraw**, because the defect is about which values are printed, not about how the bar looks.

**New home:** the What band's date field, Phase 2 (#281, "The phases", 2).

**Acceptance changes:**

- The three bullets stand as written. *"Every rendered window's start and end time is readable as text without inference"* is exactly the kind of statement that should survive a redesign untouched, and it does.
- **One thing gets easier and one gets harder.** Easier: the What grid carries **per-field provenance**, so a window boundary has a place to print its source without a floating annotation — the 3:30 value and where it came from share a channel. Harder: the band is inside one 880 px column rather than a full-width setup zone, so the collision handling this issue calls for ("labels don't collide/overlap at dense boundaries") has **less horizontal room** than it does today. Test the 3:30-beside-4:00 case at the column width, not at the current zone width, and at 380 as well.
- Add: **the tally-in-words channel from ruling 188.** The status row states its sum in words as a second channel beyond hue and weight. If a window's boundary is a fact the operator must read, it gets a word, not only a position on a bar — which is the same argument this issue makes, generalised.
- Rule 10 underneath, unchanged: the precise value exists in the data and is simply not printed. A boundary the operator infers is a boundary the tool declined to state.

The #206 window-composition arc built the semantics this displays; that backend work is untouched by Direction A and this remains frontend-only.

Refs #281

### `gh issue comment 234` — stays open

Re-aimed at Direction A (#281) — **Phase 2**, and it gets more load-bearing, not less.

The picker modal survives. Ruling **189**: *"Phase 2: the Where band owns the aerial and the outcome; **the picker modal stays for the decision work** (detection, candidates, bearing, **cross-street**, suggestions), opened from the band."* Cross-street decision work is named explicitly as modal-resident, so this rehydration defect survives on a retained surface.

**New home:** the picker modal as opened from the Where band, Phase 2.

**Why it gets more load-bearing.** Today a lost intersection marker costs a re-place. Under Direction A two things raise the stakes:

1. **The Where band owns the *outcome*** (ruling 189) and renders it as a **fact line** when collapsed. A fact line that reads from scenario state the picker failed to rehydrate is a fact line that disagrees with the modal behind it — which is the one-producer-per-printed-fact problem (#257), on a surface built to state facts.
2. **Phase 3 builds the nearest-intersection tag** — "210 ft N of W 38th Ave" — from the scan's intersection bucket. That tag and this marker describe the same geometry from two directions. A picker that cannot restore the marker while the band prints a tag derived from it is exactly the divergence this issue already names.

**Acceptance changes:**

- The three bullets stand unchanged; they are about stored-vs-displayed state and are indifferent to the host surface.
- **Add a fourth:** the Where band's collapsed fact line and the re-opened modal agree on the intersection, in both directions — open → collapse → re-open shows the same marker and the same fact line. This is the navigation-derives-state rule stated at the seam Direction A creates.
- The revision path makes this testable in a way it was not before: **CHANGE ONE THING re-opens one band in place** (ruling 190), so "reopen the picker" becomes a first-class user action with a name, rather than an incidental one. Write the test against that action.

Refs #281

### `gh issue comment 235` — stays open

Re-scoped by Direction A (#281) — **three of four surfaces superseded; the remainder is surface D, and it has no phase.**

#281's Reference line: *"#235 (surfaces A/B/D superseded by this)"*. **That line appears to name the wrong three letters**, and this comment records the reading taken, because the difference decides what is left open.

**The discrepancy.** Two other statements contradict the literal A/B/D:

- #281, Phase 1: *"Replaces the results head, the next-steps strip, **section 03's presentation**."*
- FLOW.md §9, Phase 1: *"Replaces the results head, the hero's presentation, the cards' header, **section 03's presentation**."*

Surface **C is the reference section** — `TieredReference.tsx`, section 03 — which Phase 1 demonstrably replaces. Surface **D is the plan PDF** below "Reference: CDOT S-630-1", a **print** surface, and **no Direction A phase covers print**: Phases 0–4 are foundations, results stack, band stack, work segment, 380 px. Under the literal reading, the one surface Direction A cannot reach would be marked superseded while the one it explicitly replaces would be left open.

**Reading taken: A/B/C are superseded, the remainder is D.** Ryan confirms or corrects #281's Reference line when Part 1 and Part 2 are pasted into it.

**Where each surface goes:**

- **A — road section** (detected/applied table: mixed alignments, ragged confirm-row boxes, floating MUTCD annotation notes). Superseded by the **What grid with per-field provenance**, Phase 2, ruling 198. The floating-annotation complaint is answered structurally: the annotation becomes the field's own provenance clause instead of a note the reader must associate by reading.
- **B — "road geometry governs" disclosure footnotes.** Superseded by the **counted disclosures** of the results stack, Phase 1. **The #214 constraint survives verbatim and must be restated in Phase 1's acceptance: the information survives somewhere standing and inspectable; restyling and relocating are in scope, deleting is not.**
- **C — reference section.** Superseded by Phase 1's re-presentation of the five-tier ledger. The #226 role tokens this surface wanted applied consistently are joined by a **fifth role** (ruling 180, "step question") and the nine new sizes, so the consistency pass happens against a larger type system than the one this issue assumed.
- **D — plan PDF density.** **Remains open. Unphased.** Print-layout pass: hierarchy, grouping, breathing room within the fixed page budget, with the containment harness re-run (zero overflow is not negotiable). Disjoint from every Direction A file, so it can run at any time by anyone not on the column.

**Acceptance changes:** the design-round framing (options (a)/(b)/(c), "Claude Design advise-only → ruling → scoped issues") is **discharged for A/B/C** — that round happened and its output is #281. The remainder D is small enough that it no longer needs a design round of its own; scope it as a single print pass.

Contracts that bound the remainder are unchanged: #214 disclosure survives, #198 strings byte-identical, PDF containment stays zero, Rule 13.

Refs #281

### `gh issue comment 237` — stays open

Re-aimed at Direction A (#281) — **Phase 2, and it must be done inside that phase, not after it.**

The specific collision named here is **closed by construction**: the `/Generate/` `.first()` selector matches the progress rail's Generate entry, and **the rail is replaced**. #281's inherited contracts: *"rail single-voice (#228 — **the rail is replaced**; its derived-entry contract moves to the move ledger and the fact lines)"*. When the rail goes, so does the duplicate "Generate" string that this selector trips over.

**But the issue does not close**, for two reasons:

1. **The suite breaks harder, not less.** A selector that today matches the *wrong* Generate will, after Phase 2, match **nothing** — the setup panel and its rail are replaced by the band stack. The suite goes from a false "0 checked" to a real one. Re-pointing it is not optional cleanup; it is part of landing Phase 2 with evidence.
2. **The general action survives and grows.** *"Swap the s2a7 browser helper (and audit the other archived live-check suites) to exact-name or `data-testid` selectors"* applies to every suite, and Direction A rewrites the DOM under **all** of them across four phases. The `cta-reason` / `rail-blocker` hooks from s2-arc13's #229 arc are the pattern; `rail-blocker` in particular is named after a surface that will not exist.

**New home:** Phase 2's issue, as a required step rather than a follow-up.

**Acceptance changes:**

- Add: **every live-check suite cited as evidence for a phase is re-pointed before that phase's prod leg**, and a suite that matches zero nodes **fails loudly** rather than reporting "0 checked". The false-zero is the actual defect here — the selector drift is just how it surfaced this time, and it will surface again four more times.
- Add: `data-testid` hooks are minted **as the new surfaces are built**, not retrofitted. A column of bands with one open needs stable handles for band identity and open/collapsed state; those are cheaper to add in the same commit as the band.
- The standing caution stands until then: **the s2a7 browser suite must not be cited as evidence**; the wire suite (`s2a7-wire-checks.py`, 17/17) stands alone.

Refs #281

### `gh issue comment 259` — stays open

Re-aimed at Direction A (#281) — **Phase 1. Stays open; this is not closed by construction.**

**Correcting an earlier read of this issue.** Direction A does **not** drop the surface. Part 1 §8.8 keeps the stale ribbons in the KEPT, UNCHANGED IN BEHAVIOUR list — *"Stale ribbons — all three kept, mutually exclusive, at the top of the results stack, with the dim they explain"* — and then says so explicitly:

> **Note #259 (the ribbon's own label sitting inside the dim at 2.39:1) is NOT fixed by this direction;** Part 2 raises the ribbon label out of the dim.

§8.39 lists this issue under **"Still open and inherited"**, alongside #276, #256, #243, #266, #235 and #28. So the defect survives on a kept surface and the fix arrives as a specified build rule, not as a side-effect of deleting anything.

**The fix, specified.** #281 comment 1, rule **102**:

> CHANGE against today: the ribbon itself is NOT dimmed — the dim starts below it. Today the ribbon's own label sits inside the dim it explains and measures 2.39:1 (#259). **Ribbon text renders at full opacity, `#c8d1dd` on `#101c29`.**

That is this issue's own proposed solution — move the ribbon out of the `.results-stale` wrapper, sibling above it, same slot — with the values named. Ruling **197** approves it as declared scope: *"I raised the ribbon out of the dim. That is a fix shipped inside a redesign."*

**New home:** the Phase 1 issue (the results stack), which owns rules 100–102.

**Acceptance changes:**

- The first bullet stands and gains a target: ribbon text ≥ 4.5:1 mid-flight **measured on the composited surface** (the arc-23 pairs probe run under the band). #281 comment 1, rule **13** sets the floor page-wide and says the thing that matters here — *"Any text inside a dimmed region must clear the floor AFTER the dim"*. Measured, not asserted (Rule 13, P9).
- The second bullet stands: `.results-stale` still dims every result node; the ribbon is the only undimmed text in the zone. Rule 102 words it as "the dim starts below it".
- The third bullet stands: the arc-23 B7 baseline (0 nodes outside the dim at 1440) changes, and the "30 inside" figure may fall — **record the new count rather than asserting the old one held.**
- The optional half of the proposed solution — *"raise the dim to opacity .6 so the largest figures clear 3:1 as large text"* — is **not** what Part 2 chose. Rule 102 fixes the ribbon and leaves the dim alone. If the 56-of-59 failing pairs inside the dim are to be addressed, that is a separate decision and rule 13's "after the dim" clause is the authority to raise it.
- No change to band rules or `regenerating` semantics — unchanged, and §8.3 keeps the working band as-is.

Refs #281

### `gh issue comment 267` — stays open

Re-aimed at Direction A (#281) — **Phase 2**, and Direction A creates a **second** instance of this exact defect.

The picker modal survives (ruling **189** — the modal keeps the decision work, including bearing and candidates, opened from the Where band), so the taper preview and its payload gap survive with it. Verified in source at `34e27aa`: `conestruct/site/lib/render-proxy.ts:291-295` defines `CorridorSpecRequestBody` as `kind`, `speed`, `roadType?` and nothing else — the mechanism this issue describes is intact.

**New home:** the picker modal behind the Where band, Phase 2.

**The reason this matters more under Direction A.** #281 introduces a second preview with the same shape:

> **A preview is a read.** No band, no lock, never memoised, never written; commit-on-blur/Enter, never per keystroke; **the fast request only (breakdown)**, never the audit, scan or PDFs.

That preview feeds the **before/after panel** in revision mode (ruling 190) and computes *"taper, buffer, spacing and counts only"* (ruling 201). **It computes taper — the same value this issue reports wrong.** So the codebase is about to have two previews of the same quantity, and the failure mode here (the preview request omits widths, the backend fills defaults, the preview shows a length the plan does not build) is available to both.

**Acceptance changes:**

- The fix is unchanged: **send the scenario's widths.** Payload sender is the picker modal; the corridor-spec body cap is 4 KB. Rule 3 holds — the backend owns the taper math, the frontend only has to stop withholding its inputs.
- **Add, and hand to Phase 2:** *"preview must equal applied"* is an invariant for **every** preview surface, not just this one. The revision panel's taper must be computed from the same scenario values Apply will use, or the panel is showing a before/after of a plan that will not be built.
- **Add:** ruling 202's blind-apply wording is the honest fallback when a preview cannot be computed — *"1 change staged · preview failed — Apply re-generates the full plan without a preview."* A preview computed from **substituted defaults** is worse than that state, because it looks like it succeeded. If the widths are unavailable, the honest output is the failed-preview sentence, not a confident wrong length.
- Enumerate the senders when the payload changes — #281 carries "payload senders enumerated on any wire change" in its inherited contracts, and backend-first is mandatory because Pydantic silently drops unknown fields.

This is #198's family — preview ≠ applied — and it is the family the revision mode is built out of.

Refs #281

### `gh issue comment 276` — stays open

Re-aimed at Direction A (#281) — **Phase 2, the WHAT band's jurisdiction field. Stays open.**

**Correcting an earlier read of this issue.** The setup strip is dropped (Part 1 §8.27), but the defect is not dropped with it — §8.27 says so in the same breath:

> **#276 (the jurisdiction cell's silent static fallback) must be re-decided in the WHAT band's jurisdiction field.**

§8.39 lists this issue under **"Still open and inherited"**. And #281 comment 1, rule **196** is explicit that this is not a free ride:

> The cell that silently falls back to a static label moves into the WHAT band's jurisdiction field. It needs a decided behaviour there — I have specified "Not set" wording and no skeleton (rule 14), which is **a change in behaviour, not a port.**

**New home:** the WHAT band's jurisdiction field, Phase 2. §8.21 is the move — *"Jurisdiction & classification band — moved into the WHAT band as two fields (jurisdiction, road type) with their provenance lines."*

**Acceptance changes — read these before building against this issue's body.**

- **This issue's second acceptance bullet is retired.** It proposed *"loading → the pending treatment ... Loading state matches the bar's"*, mirroring `JurisdictionContextBar`'s `pendingName` skeleton. That is dead **twice over**: rule **14** forbids it globally — *"No skeletons, no placeholder bars, no indeterminate progress, anywhere. A value that is not known renders as a word: 'Not set', 'pending', 'No package yet', 'Zone geometry unavailable'"* — and §8.31 **drops `JurisdictionContextBar` itself** ("Jurisdiction context bar — DROPPED as a bar"). There is no bar left to match.
- **The first acceptance bullet stands unchanged and is the core**: a failed evaluation never renders as a confident jurisdiction name. Rule 10 — absence renders as absence.
- **Replace the state list with the ruled one:** unset → the word **"Not set"**; errored → an honest word; loaded → the evaluated name. Three states, no skeleton in any of them. Mounted tests for all three (Rule 11).
- **Add, from §8.31:** *"Its reserved-height rule (the bar must not resize on selection) transfers to those fields."* So the jurisdiction field must not change height across its three states — which is the same P1 no-movement guarantee the bar carried, now owed by the field.
- **Add:** ruling **200** amends P16 to permit one busy signal **per fact**. That is the ceiling for an in-flight jurisdiction evaluation — one signal on that fact, and it is a word, not a bar.

#257's one-producer-per-printed-fact contract is in #281's inherited list and still governs: the fact line and the field must not derive the jurisdiction name two ways.

Refs #281

### `gh issue comment 277` — stays open

Re-aimed at Direction A (#281) — **Phase 2, the What grid.**

FLOW.md §9 already holds this issue: *"**Held until these land:** #262, #272, #264, #259, #235, **#277** — surfaces the redesign redraws."* This comment says where it lands.

The detected-vs-applied block is superseded in form by the **What band's grid with per-field provenance** (ruling **198**, which also moves the kind into Where and dates into What). The block's content survives the change of form — that is the same relationship #273's close comment already described when the two-column table became the applied-forward ledger.

**New home:** the What grid, Phase 2 (#281, "The phases", 2).

**Acceptance changes:**

- The first bullet **transfers and widens**. It was *"every LIVE kind carrying `confirmedRoad` renders the block"*; it becomes **every LIVE kind renders the What grid**, which is not an opt-in surface at all — it is one of the four bands, so it mounts for every kind by construction. The three-of-seven mounting (`ShoulderForm.tsx:83`, `FlaggerForm.tsx:108`, `NearIntersectionForm.tsx:230`) is per-form, and **the bands are not per-form.** That is what closes the structural half of this issue.
- The second bullet **stands unchanged and is the reason this stays open**: *"gated kinds name the block in their enablement checklist."* Rule 8 — enablement bars are explicit and evidenced — and #281 carries Rule 8 in its inherited contracts. Three of the four missing kinds are gated (`memory.md` product state), so the question this issue correctly framed as "when, not whether" is still a question, and the answer must be written into each gated kind's enablement bar rather than assumed.
- **Add:** ruling **188** decides a sub-question this issue did not reach. *"Unchanged values — `#c8d1dd`, every row stays"*, plus a second channel: *"the status row's tally states the sum in words ('3 changed · 2 unchanged · 2 on apply')"*. So a kind whose detection and application agree on every field still renders every row — the grid does not collapse to nothing on the agreeing case. That is consistent with #273's ruled product question (on matching rows the detected value **is** printed; "same as detected" was ruled against on evidence).
- **Add:** #279 is a hard input to this. The grid prints road type with its provenance; `isUrban` resolving false on an OSM `primary` in central Denver means the grid would print a wrong fact confidently. Land #279 before the grid renders the classification as a fact line.

Refs #281

### `gh issue comment 280` — stays open

Re-aimed at Direction A (#281) — **Phase 4**, with its measurement retired and its investigation still live.

**The measurement dies; the question does not.** This issue's numbers — a 332.8 px worst-case clause against 236 px available, `Freeway / interstate` at 128 px of it, a two-line reserve costing +16 px per row and ~80 px on a five-row shoulder plan — are all measured against the applied-forward ledger shipped at `b2a325a`. **That layout is replaced** by the What grid with per-field provenance (ruling **198**, Phase 2). The clause's typography, its gutter, its available width inside an 880 px column, and whether it wraps at all are different questions on the new surface.

So: **do not carry the 332.8 px figure forward.** Re-measure against the What grid once it exists, per Rule 12 — a value being reasonable is not evidence it is right, and a value measured against a deleted layout is not evidence of anything.

**New home:** Phase 4, the 380 px arc (#281, "The phases", 4: *"After the shape is stable"*). ⚠ **This phase assignment is an inference, not a ruling.** #281 does not name this issue. Phase 4 is where the 380 px reserve question belongs; if Phase 2's grid turns out to solve or move it, re-aim again then.

**What survives untouched, and can run now.** The domain-label half of the investigation has no dependency on any Direction A surface:

- Enumerate every consumer of `ROAD_TYPE_LABELS` (grep), and whether any is a **deliverable** where the long form is the legally recognisable one. That question is about the plan sheet and the crew document, which Direction A does not touch at all.
- Establish whether the classification's **wire value is the label or a key**. If a key, the label is presentation-only and cheap to change — and that answer is independent of which component renders it.

Both are disjoint from every file in the redesign and from each other. They are the cheap half and they de-risk the expensive half.

**Acceptance changes:**

- *"Every consumer enumerated; no deliverable loses a legally meaningful term"* — **stands unchanged.**
- *"If shortened: the worst-case clause fits one line at 380 with real headroom, and the block's two-line reserve is removed with its measurement recorded"* — **stands, but the measurement is taken against the What grid**, not the ledger, and at the column width #281 specifies rather than the current zone width.
- *"If not shortened: the reason recorded and this issue closed as ruled-against"* — stands.
- **Add:** #279 is upstream. A shorter label for a value the classifier gets wrong is a shorter wrong answer. Sequence after #279.

Refs #281

## New issues (9)

### `gh issue create` — N1-preview-flag

## Problem

Direction A's revision mode is built on a **preview**, and #281 rules what a preview is:

> **A preview is a read.** No band, no lock, never memoised, never written; commit-on-blur/Enter, never per keystroke; the fast request only (breakdown), never the audit, scan or PDFs. **Needs a backend preview flag on the request (Phase 0).**

No such flag exists on the request today. Without it the backend cannot distinguish a preview read from a real generate, which means every guarantee in that ruling is unenforceable at the only layer that can enforce it — the backend. A frontend that merely *promises* not to write is the `corridor-spacing.ts` failure mode restated (Rule 3): the backend owns the predicate.

The flag is also the gate on three separate behaviours the ruling names — no memoisation, no band, no lock — each of which is a backend decision today made on the basis of "a request arrived".

Classification: **behavior-changing, additive.** No current caller sends the flag, so nothing changes until Phase 2 sends it.

## Proposed solution

- Add the flag to the render request schema (Pydantic), defaulting to the current behaviour so absent means "not a preview".
- The backend honours it by: computing **taper, buffer, spacing and counts only** (ruling 201's own list); **not** memoising the result; **not** taking a write lock; **not** emitting audit, scan or PDF work.
- Verdict and needs-you are **not** computed for a preview — ruling 195: *"verdict is for the plan on screen, not the staged change"*, and ruling 204 keeps the verdict row permanently non-numeric.
- The response carries enough for the before/after panel and nothing more.
- Every threshold or budget the preview path introduces is traced or marked CHOSEN in its docstring (Rule 12).

## Why backend-first is not optional here

**Pydantic silently drops unknown fields.** If the frontend ships the flag first, the request is accepted, the flag is discarded, and the "preview" writes, memoises and locks exactly as a generate does — with no error anywhere. That is the standing backend-first rule in CLAUDE.md and this is the case it was written for.

Enumerate every sender of the render payload by grep when the field lands (#281 inherited contract: "payload senders enumerated on any wire change"). #244 is a live example of a sender that was missed.

## Acceptance

- A request with the flag set returns breakdown values and **writes nothing**: no memo entry, no lock taken, no audit/scan/PDF work performed — asserted at the payload level, not by reading the frontend (Rule 11).
- A request **without** the flag behaves byte-identically to today. Existing fixtures unchanged.
- The flag's absence is not an error; absent means not-a-preview.
- Every new constant traced or marked CHOSEN.
- Sender enumeration recorded in the arc report.

## Reference

- #281 — Direction A, "Rulings the audit added", the preview-as-read ruling; rulings 195, 201, 202, 204.
- FLOW.md §9, Phase 0: "the preview-as-read backend flag".
- CLAUDE.md standing conventions: "Backend-first is correctness whenever a wire field is added: Pydantic silently drops unknown fields."
- Rule 3 (backend owns the math), Rule 11 (test where the bug lives), Rule 12 (every value traced or CHOSEN).
- Priority-high. **Phase 0. Blocks Phase 2's revision mode.** Refs #281

### `gh issue create` — N2-type-sizes

## Problem

Direction A introduces **nine type sizes** the type system does not have, and #281 rules how they may enter:

> **Nine new type sizes** land as one ruled exception commit with owners before any surface uses them — never as debt.

The sizes: **22, 19, 17.5, 15.5, 15, 13.5, 12.5, 62, 42** (#281, "The phases", Phase 0).

The existing system is four roles — verified in source at `34e27aa`, `conestruct/site/lib/design/type-roles.ts:66` (`section`), `:79` (`step`), `:91` (`field`), `:104` (`provenance`) — each defined as a token with family, weight, size, tracking, colour, casing and decoration, and asserted by `type-roles.test.ts` against the `.tr-*` blocks in `globals.css`. Ruling **180** adds a fifth:

> **180 fifth type role — approved.** "Step question": Inter 22 px / 1.25 / 600 / `--ink`, 19 px below 520. Recorded in DESIGN-PRINCIPLES and `type-roles.ts`.

Nine loose sizes entering across four phases, one surface at a time, is how a type census stops meaning anything. That is the whole reason #281 ruled the commit shape up front rather than leaving it to each phase.

Classification: **additive, no surface changes in this commit.** Nothing renders differently until a later phase uses a size.

## Action

- One commit adding all nine sizes, each with a **named owner** — the role or surface that justifies it. A size with no owner does not land.
- Register the fifth role, "step question", in `type-roles.ts` and `DESIGN-PRINCIPLES.md` per ruling 180: Inter **22 px / 1.25 / 600 / `--ink`**, **19 px below 520**.
- Extend `type-roles.test.ts` to cover the fifth role the way it covers the existing four (the six-pair enumeration becomes ten pairs — roles must differ in at least two of family / casing / size / tracking / colour / decoration).
- Record the two off-palette hexes in the same commit or an adjacent one, per ruling **181**: `#3fd3a8` (work zone) and `#e0a63c` (buffer), **approved as decorative-and-labelled, nowhere else**. They are not signal colours; Rule 13 still requires a glyph/shape/text second channel for anything that carries a verdict.
- Update the type census so it reflects the new total rather than being re-derived later.

## Acceptance

- All nine sizes present with an owner named per size.
- The fifth role is a token, tested, with its below-520 value.
- `type-roles.test.ts` passes with the widened pair enumeration.
- **No rendered surface changes in this commit** — rect and screenshot baselines unchanged.
- The two hexes appear only where ruling 181 permits, and carry their decorative-and-labelled note.

## Reference

- #281 — "Rulings the audit added" (nine sizes); rulings 180, 181; Phase 0 in "The phases".
- FLOW.md §9, Phase 0: "the type-census exception commit (nine sizes, owners)".
- `conestruct/site/lib/design/type-roles.ts:51-131`; `type-roles.test.ts`; `DESIGN-SPACING.md`; #226 (the four roles this extends).
- Rule 12 — a value being reasonable is not evidence it is right; every size traces to its owner.
- Priority-high. **Phase 0. Blocks every visual phase**, by #281's own "before any surface uses them". Refs #281

### `gh issue create` — N3-proposed-kind

## Problem

Direction A's Where band proposes a scenario kind from the pin — *"Your tap looks like a right-shoulder closure"* — and #281 records that **nothing produces that sentence today**:

> **"Your tap looks like a right-shoulder closure" has no producer today.** The proposed-kind derivation is Phase 3's; until then the chips render unselected with no "✓ proposed".

So the spec's copy describes a fact the system cannot state. Rendering it before the producer exists would be a fabricated suggestion on the surface that decides what plan gets built — Rule 10 (absence renders as absence; a silent default presented as an answer is a violation), and **suggest-never-set**, which is in #281's inherited contracts.

The interim behaviour is already ruled and needs no further decision: **chips render unselected, with no "✓ proposed" marker.** This issue is the producer.

## Why this is consequential

The proposed kind is the first thing the operator sees about their own pin, and accepting it is one tap. A wrong proposal that reads as the system's considered opinion is worse than no proposal — it converts a guess into the plan's kind, and every downstream value (taper, buffer, device spacing, the deliverables) inherits it. Ruling **198** puts the kind in the Where band, so the proposal and the pin share a surface: the proposal must be as honest as the pin is literal.

## Proposed solution (investigate first — Rule 12)

- Establish what the derivation may read. The candidates are the scan's buckets, the classification, and the pin's relationship to the way geometry — **all three are contested inputs right now**: #279 has `isUrban` resolving false on an OSM `primary` in central Denver, and #256's scan is what produces the buckets.
- Decide whether the proposal is **backend-owned**. Rule 3 says the backend owns the math; a kind proposal is a predicate over detected facts, which puts it backend-side unless there is a stated reason otherwise. If any part is mirrored in the frontend it is commented as a mirror, backend authoritative.
- Decide the **confidence floor**: below it, no proposal at all — the ruled interim state is the permanent fallback, not a placeholder. "No proposal" must be a first-class output, not an error.
- Mark the proposal **inferred** where it is inferred (#274's marker is exactly this distinction).
- Every threshold traced or marked CHOSEN in its docstring.

## Acceptance

- A proposal renders only when a producer produced it; otherwise chips render unselected with no "✓ proposed" — the ruled interim state, permanently available.
- The proposal is a **suggestion**: it never sets the kind without the operator's action (suggest-never-set stays green).
- Accuracy measured on a named sample of reference pins, reported before and after, not asserted.
- A wrong or absent classification produces **no proposal**, not a default one.
- Every threshold traced or CHOSEN.

## Reference

- #281 — "Rulings the audit added", the proposed-kind ruling; ruling 198 (Where absorbs the kind); Phase 3 in "The phases".
- FLOW.md §9, Phase 3: "the proposed kind".
- #279 (classifier — upstream input, must land first); #274 (inferred vs measured marker); #256 (the scan that produces the buckets).
- Rule 3, Rule 10, Rule 12; suggest-never-set.
- Priority-medium. **Phase 3.** Sequences after #279. Refs #281

### `gh issue create` — N4-intersection-tag

## Problem

Direction A's work segment tags the pin with its nearest intersection — *"210 ft N of W 38th Ave"* — and #281 records both that the input is not available at the time the tag renders, and what must happen until it is:

> **"210 ft N of W 38th Ave" needs the nearest intersection at pin time** — the scan's intersection bucket, which runs at Generate today. **#256's pre-scan-on-confirm lever is a hard dependency**; until then the tag prints the road name, lat/lng in provenance.

The mismatch is one of timing, not data: the intersection bucket exists, but it is produced by the site scan, and the site scan runs at **Generate**. The tag renders at **pin confirmation** — before Generate. So at the moment the tag needs its value, nothing has computed one.

This is the surface FLOW.md §5a exists for: the pin is the wrong pin, and the fix is a segment, not a point. A tag that states the work's position relative to a named cross street is how the operator confirms the tool understood where the work is (P21 — the model matches the mental model).

## The dependency, stated precisely

**#256's lever 2 — pre-scan on pin confirmation** ("a read, pre-generate, within suggest-never-set") is what makes the bucket available in time. That is the gate, and it is worth being exact about it:

The s2-arc31 investigation (branch `s2-arc31-scan-budget`, `67d95c7`) found #256's root cause to be a **broken mirror chain** — `src/rules/site_detection.py:168-173` hands every mirror the entire remaining budget, so a stalled mirror consumes it and the next is never tried — and a per-mirror cap fixes the refusal rate inside the existing budget. **That fix does not deliver this dependency.** The pre-scan lever was not built by that arc. So Phase 3's gate is on **lever 2 specifically**, not on #256's refusal-rate acceptance being met.

## Proposed solution

- Consume the pre-scan's intersection bucket at pin confirmation; derive the nearest intersection and the offset.
- **The interim state is the permanent fallback**, not scaffolding: when no bucket is available, the tag prints the **road name**, with lat/lng in provenance. Absence renders as absence (Rule 10) — it never guesses a cross street and never prints a distance it did not measure.
- Distance and bearing wording ("210 ft N of") is derived, not authored in the frontend. Rule 3: the backend owns it; any frontend mirror is commented as a mirror.
- Every tolerance — what counts as "nearest", the offset's rounding — traced or marked CHOSEN (Rule 12).

## Acceptance

- With a pre-scan available, the tag names the nearest intersection and the offset, and both trace to the bucket that produced them.
- With **no** pre-scan available, the tag prints the road name and nothing more; lat/lng in provenance. No fabricated cross street, no fabricated distance.
- The pre-scan is a **read**: it takes no lock, sets nothing, and stays within suggest-never-set.
- The tag and the picker's intersection marker agree (see #234, which is the same geometry from the other direction).
- Every tolerance traced or CHOSEN.

## Reference

- #281 — "Rulings the audit added", the nearest-intersection ruling; Phase 3 in "The phases" ("gated on #256").
- FLOW.md §5a (the pin is the wrong pin); §9 Phase 3.
- #256 lever 2 (pre-scan on pin confirmation) — **the hard dependency**; `validation-artifacts/committed/s2-arc31-scan-budget/README.md` for what the investigation did and did not deliver.
- #234 (intersection marker rehydration); P21.
- Rule 3, Rule 10, Rule 12; suggest-never-set.
- Priority-medium. **Phase 3. Hard-gated on #256's pre-scan lever** — not on its refusal rate. Refs #281

### `gh issue create` — N5-trace-formulas

## Problem

Direction A's TRACE rows show the formula behind a computed value, and #281 rules where that formula text may come from:

> **TRACE's formulas must be wire fields** (Rule 3, citation counter 19). If the audit does not emit formula text, the row prints what the audit carries and nothing more. **No authored math in the frontend.**

The audit does not emit formula text today. **`TRACE` does not exist anywhere in the tree** — verified at `34e27aa`: no match in `conestruct/site/app`, `conestruct/site/components`, `conestruct/site/lib`, or `src/api/audit.py`. So this is entirely new, on both sides of the wire, and the ordering matters more than the size.

The failure mode this ruling forecloses is the `corridor-spacing.ts` one (Rule 3): a frontend that renders `L = WS²/60` because a developer knew the formula, beside a value the backend computed by some other path. The two agree until they don't, and when they diverge the frontend is the more convincing liar because it shows its work.

Classification: **additive on both sides.** Backend-first is mandatory — Pydantic silently drops unknown fields, so a frontend that ships first renders nothing and reports no error.

## ⚠ Phase assignment is inferred

#281 does not state which phase TRACE belongs to. **Phase 1 is this issue's inference**, from TRACE being a disclosure-class row and Phase 1 owning "quote disclosure → passed / pending / reference disclosures". **Confirm against Part 2 before starting** — Part 1 and Part 2 are unfilled paste placeholders in #281 as of `34e27aa`, so the rules that describe TRACE's own behaviour could not be read at triage.

## Proposed solution

- The audit emits formula text as a **wire field** per computed value that has one, alongside the value and its inputs.
- The frontend renders **what the audit carries and nothing more**. A value with no formula field renders as a value — not as a value plus a formula the frontend supplied.
- Each formula carries its citation. **Citation counter 19** — a citation is a claim; verify by subject, never by number, and quote with a page cite.
- Enumerate every sender and consumer of the audit payload when the field lands (#281 inherited contract: "payload senders enumerated on any wire change").

## Acceptance

- Formula text is on the wire, asserted at the **payload level** (Rule 11 — pure-function tests pass while bugs ship).
- A value whose formula the audit does not emit renders **without** a formula. No fallback string, no authored math (Rule 3).
- Every emitted formula's citation verified by subject with a page cite; citation counter incremented in the arc report.
- Existing audit fixtures move together with the field — the expectation-JSON pin moves both sides at once (#281 inherited contract).
- Sender/consumer enumeration recorded.

## Reference

- #281 — "Rulings the audit added", the TRACE ruling; inherited contracts (citation counter 19, payload senders, expectation-JSON pin).
- `src/api/audit.py`; `conestruct/site/lib/render-types.ts` (see #28 — this field enlarges the `Record<string, unknown>` surface that issue is about).
- Rule 3 (backend owns the math), Rule 11 (test where the bug lives), Rule 12.
- CLAUDE.md: "Backend-first is correctness whenever a wire field is added."
- Priority-medium. **Phase 1 (inferred — confirm against Part 2). Backend-first; must land before the row that prints it.** Refs #281

### `gh issue create` — P0-phase0

## Problem

Phase 0 of Direction A (#281). **Nothing visible ships in this phase** — it is the set of things that must be true before any Direction A surface is drawn, and #281 defines it:

> **0. Foundations, nothing visible** — FLOW.md and DESIGN-PRINCIPLES.md committed (type role 5, the two off-palette hexes, P16's "one busy signal per fact"); the type-census exception commit (22, 19, 17.5, 15.5, 15, 13.5, 12.5, 62, 42 — owners named, one commit, before any surface uses them); the preview-as-read backend flag; #256; #279.

Each item is here because landing it later costs more than landing it now: a wire field added after its sender is a silent no-op (Pydantic drops unknown fields), type sizes added per-surface are debt by the second surface, and a wrong classifier or a refusing scan poisons every fact the new surfaces state.

## Scope — what this phase absorbs

| Item | State | Owner issue |
|---|---|---|
| FLOW.md §8–§9, DESIGN-PRINCIPLES.md P17–P22 | ✅ **Done** — `34e27aa`, on main | — |
| The nine type sizes + role 5 + the two hexes | Not started | N2 |
| The preview-as-read backend flag | Not started | N1 |
| Scan budget / pre-scan lever | **Investigate complete**, build not started | #256 |
| Classifier `isUrban` | Not started | #279 |

**#256's status, precisely.** The s2-arc31 investigation (branch `s2-arc31-scan-budget`, `67d95c7`) is complete and unmerged. It found the root cause is a **broken mirror chain**, not a slow query: `src/rules/site_detection.py:168-173` hands every mirror the entire remaining budget, so a stalled mirror 2 consumes it and mirror 3 — which answered the full Denver scan 3/3 clean in 2.8–4.4 s — is never reached. A per-mirror cap fixes it inside the existing budget; no budget needs raising. **The pre-scan-on-confirm lever that Phase 3 is gated on was not built by that arc** and is still outstanding.

## Rulings this phase carries

- **180** — fifth type role, "step question": Inter 22 px / 1.25 / 600 / `--ink`, 19 px below 520.
- **181** — `#3fd3a8` (work zone) and `#e0a63c` (buffer), decorative-and-labelled, nowhere else.
- **200** — P16 amended: one busy signal **per fact**.
- **The preview-as-read ruling** — no band, no lock, never memoised, never written; the fast request only.
- **Nine type sizes** land as one ruled exception commit with owners, never as debt.

## Concurrency

**All four open items are disjoint and run concurrently.** N1 is the render request schema, N2 is `type-roles.ts` and `globals.css`, #256 is `src/rules/site_detection.py` and `src/api/site_scan.py`, #279 is `lib/road-detection/classify.ts` and `road-bearing/route.ts`. Four file sets, four layers, no shared surface. This is the widest parallelism available in the whole redesign and it is at the front of it.

## Acceptance

- Nothing renders differently at the end of this phase. Rect and screenshot baselines unchanged; **that is the acceptance**, not a caveat.
- The preview flag is honoured by the backend and sent by nobody yet.
- The nine sizes exist with owners; no surface consumes one.
- #256: Denver first-scan-of-session ≤ 1 refusal in 20 cold runs, measured, **and** the pre-scan lever exists as a read.
- #279: the reference urban pins classify as urban; a genuinely rural fixture still classifies rural; rate reported before and after on the same sample.
- Every constant introduced traced or marked CHOSEN (Rule 12).

## Reference

- #281 (design authority), "The phases" 0; FLOW.md §9 Phase 0.
- Absorbs: N1 (preview flag), N2 (type sizes), #256, #279.
- Priority-high. **Blocks Phases 1, 2 and 3.** Refs #281

### `gh issue create` — P1-phase1

## Problem

Phase 1 of Direction A (#281) — **the results stack.** This is the phase that fixes what made the demo painful, and #281 puts it first for that reason:

> **1. The results stack** (S5, S6, S8) — verdict → NEEDS YOU → counts hero → download row → quote disclosure → passed / pending / reference disclosures. Frontend-only. Re-presents the existing five-tier ledger (`assignTiers` ⟷ `tier_ledger.py`); ▲ and ⚠ lift into NEEDS YOU, ✓ ◌ and reference fold. **Replaces the results head, the next-steps strip, section 03's presentation.**

**No second classifier is built (P2).** The five-tier ledger is the one sorter: ▲ changed · ⚠ attention · ✓ checked · ◌ pending · reference (uncounted). The ▲/⚠ tiers **are** "what needs you"; the other three fold to counts.

**Correct paths, verified in source at `34e27aa`:** `conestruct/site/lib/tiering.ts:160` (`assignTiers`) and **`src/rendering/tier_ledger.py`** — #281 and FLOW.md §9 both cite the backend module unqualified as `tier_ledger.py`; it is under `src/rendering/`, not `src/rules/`.

Frontend-only, **no fixture re-baseline**.

## Rulings this phase carries

- **182/183 — one rule: the primary is the next step.** If NEEDS YOU has items, its actions are primary and the download row is secondary with "↓ All (.zip)" present as a ghost. If NEEDS YOU is zero, "↓ All (.zip)" is the primary. **Same rule at 380.** One primary per state.
- **184 — no reserved band heights**, but the arc-28 landing machinery (`armLandingCheck`, settle-plus-tolerance, counted cap) applies to **every** collapse, not only Generate.
- **185 — the sum is the count; the decomposition is its provenance**: "3 · 2 changed the plan · 1 waiting on your word".
- **186 — S8's collapsed NEEDS YOU rejected. Always expanded.** State-dependent defaults drift.
- **187 — withdrawn.** All six panel rows survive at 380.
- **193 — the "file count stated exactly once" rule passes to the download row.**
- **194 — intro paragraph dropped; the draft notice stays.**
- **197 — #259 fixed inside:** the ribbon is raised out of the dim.
- **201 — the "0.9 s" is cut.** Status row reads "computed for 35 mph · taper, buffer, spacing and counts only".
- **204 — the verdict row is permanently non-numeric.**

## What this phase absorbs

| Issue | How |
|---|---|
| **#259** | Closed by construction, ruling 197. Carries in: mid-flight explanatory text ≥ 4.5:1 **measured on the composited surface**; the dim covers only the answer |
| **#272** | Closed by construction, ruling 193. Carries in: `label.left === row.left` (±1) for every heading-over-row pair, at 1440×1000 and 380×800 |
| **#264** (results half) | Closed by construction. Carries in **page-wide**: the TARGETS probe reports 0 controls under 32 px on the settled page at 1440 — **including the footer**, which no phase otherwise touches (`AppFooter.tsx:8-13`, no `min-height`, verified in source) |
| **#212** (harness half) | The `pageerror` listener. **Land it before this phase's surfaces render**, not after — it is the detector for this defect class across all four phases |
| **N5** | TRACE's formulas as wire fields. Backend-first; must land before the row that prints it |

## Acceptance

- Every state in Part 1 §2 that belongs to S5/S6/S8 measured on prod at **1440×1000 and 380×800**.
- **One primary action per state**, at both widths (ruling 182/183).
- NEEDS YOU is always expanded (ruling 186).
- The five-tier ledger is the only sorter; **no second classifier** (P2).
- The file count is stated **exactly once** (ruling 193) and comes from the served bundle — never an invented wire state (#253's surviving ruling).
- Counts are digits from the wire; **no hard-coded totals** (Rule 12, #253's ruling 2, ruling 185).
- Mid-flight explanatory text ≥ 4.5:1 measured; the dim covers only the answer (#259).
- Heading/row left edges agree ±1 at both widths (#272).
- TARGETS probe: 0 controls under 32 px at 1440, ≥ 44 px at 380 for tapped controls, axe `target-size` 0 at 380 (#264).
- Every collapse lands the next band at a computed spot, counted (ruling 184).
- Zero `pageerror` events on the settled page (#212).
- **Nothing listed as KEPT has changed behaviour**; the draft notice survives (ruling 194).
- Ryan hand-checks on a hard-refreshed tab.

## Reference

- #281 (design authority), "The phases" 1; FLOW.md §9 Phase 1; DESIGN-PRINCIPLES P1–P22 with the FLOW.md step and user named per surface.
- `conestruct/site/lib/tiering.ts:160`; `src/rendering/tier_ledger.py`; `ResultsHead.tsx`; `TieredReference.tsx`; `lib/next-steps.ts`; `GeneratorShell.tsx:1320-1344`; `globals.css:3134-3147`.
- Absorbs #259, #272, #264 (results half), #212 (harness half), N5.
- Requires Phase 0's type sizes (N2). Priority-high. Refs #281

### `gh issue create` — P2-phase2

## Problem

Phase 2 of Direction A (#281) — **the band stack and revision.** #281:

> **2. The band stack and revision** (S1–S4, S7) — bands, fact lines, CHANGE links, the What grid with per-field provenance; the **picker modal retained** behind the Where band; revision mode with the preview-as-read rule and the reserved status row.

**Four bands, not five** (ruling 198): FLOW's five steps are the user's questions; the bands are how the column asks them. **Where absorbs the kind; What absorbs dates.**

This is the largest absorber in the redesign — it replaces the setup panel, the progress rail, the setup strip and its inline editors, the zone headings, and the detected-vs-applied block, and it builds revision mode on top.

## Rulings this phase carries

- **184 — no reserved band heights.** User-initiated collapse is P1's own clause. But every collapse lands the next band at a computed spot: the arc-28 landing machinery applies to **every** collapse.
- **188 — unchanged values `#c8d1dd`, every row stays**, plus a second channel beyond hue and weight: the status row's tally states the sum in words ("3 changed · 2 unchanged · 2 on apply").
- **189 — the modal migration is phased.** The Where band owns the aerial and the outcome; **the picker modal stays for the decision work** (detection, candidates, bearing, cross-street, suggestions), opened from the band. It migrates piece by piece in Phase 3 and after. **Nothing in the column's structure depends on the modal being gone.**
- **190 — inline strip edits are gone.** CHANGE ONE THING re-opens one field, in place, with its consequence shown. #262 closes by deletion.
- **191 — merged apply**, with the staged sentence enumerating what is staged ("1 field · 2 corrections").
- **192 — zone headings dropped**; focus targets move to the band stack and the results stack.
- **195 — "verdict is for the plan on screen, not the staged change".**
- **196 — #276:** "Not set" when unset, an honest word when the evaluation errored, **no skeleton**.
- **198 / 199 — four bands; work dates as a field in What.**
- **200 — P16 amended: one busy signal per fact.**
- **201 — the "0.9 s" is cut.** Status row reads "computed for 35 mph · taper, buffer, spacing and counts only".
- **202 — Apply enabled in 7b and 7d, with words.** 7b: "1 change staged · preview still computing — Apply re-generates the full plan either way". 7d: "1 change staged · preview failed — Apply re-generates the full plan without a preview". **The button works; the sentence says you are applying blind.**
- **203 — 7a's quietness is as designed.** Nothing is wrong in 7a.
- **The preview-as-read ruling** — no band, no lock, never memoised, never written; commit-on-blur/Enter, never per keystroke; the fast request only.

## What this phase absorbs

| Issue | How |
|---|---|
| **#262** | Closed by deletion, ruling 190. Carries in: visible exit; Escape cancels with **0 requests**; only Apply re-generates; every collapse/re-open lands counted (ruling 184 replaces the fixed-height acceptance) |
| **#276** | Closed by construction, ruling 196. **Its "loading matches the bar's skeleton" acceptance is retired** — ruling 196 says no skeleton |
| **#264** (setup half) | Closed by construction: rail entries, "Enter manually", the speed slider, record "Undo", "Edit full setup ⤢" |
| **#209** | Re-aimed. Editors on non-applicable kinds → read-only-with-reason in the What grid (ruling 188 keeps every row); lanes `max={4}` with provenance |
| **#215** | Re-aimed. Work-window boundaries labelled, now inside the column's narrower width — test 3:30-beside-4:00 at column width and at 380 |
| **#234** | Re-aimed. Picker rehydration; **add**: the Where band's fact line and the re-opened modal agree in both directions |
| **#267** | Re-aimed. Send the scenario's widths; **and** "preview must equal applied" becomes an invariant for the revision preview too |
| **#277** | Re-aimed. The grid mounts for every kind by construction; gated kinds must still name it in their enablement bar (Rule 8) |
| **#235** A/B/C | Superseded. **#214's disclosure must survive somewhere standing and inspectable** — restyle and relocate, never delete |
| **#237** | Re-aimed, **inside this phase**: re-point the live-check suites before the prod leg; a suite matching zero nodes fails loudly |

## Acceptance

- Every state in Part 1 §2 for S1–S4 and S7 measured on prod at **1440×1000 and 380×800**.
- Exactly one band open; bands above collapsed to fact lines with CHANGE links; bands below dim pending lines.
- **A preview writes nothing**: no band, no lock, no memo — asserted at the payload level (Rule 11), not inferred from the frontend.
- Escape cancels a staged change with **zero requests**; Apply is the only request opener (#262).
- The staged sentence enumerates what one Apply carries (ruling 191).
- 7b and 7d render their exact blind-apply sentences (ruling 202).
- Jurisdiction cell: "Not set" / honest error word / evaluated name, **no skeleton** (ruling 196).
- Every row stays on unchanged values, with the tally stated in words (ruling 188).
- Every collapse and re-open lands the next band at a computed spot, counted (ruling 184).
- **The picker modal still works** — nothing in the column depends on it being gone (ruling 189).
- #214's disclosure survives; #198 strings byte-identical; suggest-never-set stays green.
- Live-check suites re-pointed; no false "0 checked" (#237).
- Ryan hand-checks on a hard-refreshed tab.

## Reference

- #281 (design authority), "The phases" 2; FLOW.md §9 Phase 2; DESIGN-PRINCIPLES P1–P22.
- `SetupStrip.tsx` (1054 lines), `ProgressRail.tsx` (127), `LocationPickerModal.tsx` (3293), `GeneratorSidebar.tsx`, `lib/render-proxy.ts:291-295`.
- Absorbs #262, #276, #264 (setup half), #209, #215, #234, #267, #277, #235 A/B/C, #237.
- **Requires Phase 0** (N1's preview flag, N2's type sizes) **and Phase 1** (FLOW.md §9 ordering). Priority-high. Refs #281

### `gh issue create` — P3-phase3

## Problem

Phase 3 of Direction A (#281) — **the work segment.** #281:

> **3. The work segment** (S2's move ledger, FLOW §5a) — pin = work start, the proposed kind, the nearest-intersection tag, the aerial growing the approaches. **Backend-first; opens with the scenario version field; gated on #256.**

FLOW.md §9 calls it "the biggest change made to date". It is the fix for the demo's second failure, recorded in #281's umbrella acceptance as **"the pin marks the work (P21)"** — today the pin is a point, and FLOW.md §5a's finding is that the pin is the wrong pin and the fix is a segment, not a point.

## Scope

- **Pin = work start**, not work centre. The segment grows from it.
- **The proposed kind** — no producer exists today (N3).
- **The nearest-intersection tag** — "210 ft N of W 38th Ave" (N4).
- **The aerial growing the approaches.**
- **The scenario version field** opens the phase: a model change this size needs a version on the scenario before anything reads it.

## The gate, stated precisely

**Gated on #256** — but on a specific lever, and this is worth being exact about because the investigation has already landed and could be mistaken for the gate being cleared.

The s2-arc31 investigation (branch `s2-arc31-scan-budget`, `67d95c7`, unmerged) found #256's root cause is a **broken mirror chain**: `src/rules/site_detection.py:168-173` hands every mirror the entire remaining budget, so a stalled mirror consumes it and the next is never tried. A per-mirror cap fixes the refusal rate inside the existing budget.

**That is not this phase's dependency.** #281's audit ruling names the lever: *"#256's **pre-scan-on-confirm lever** is a hard dependency"* — lever 2 in #256's proposed solution, "a read, pre-generate, within suggest-never-set". **The investigation did not build it.** The nearest-intersection tag needs the scan's intersection bucket to exist at **pin confirmation**; the bucket is produced by a scan that runs at **Generate**. Until the pre-scan lands, the tag prints the road name with lat/lng in provenance — which is the ruled interim state and the permanent fallback, not scaffolding.

**#279 is a second input.** The proposed kind reads the classification; `isUrban` resolving false on an OSM `primary` in central Denver means the proposal would be derived from a wrong road type.

## Rulings this phase carries

- **189 — the modal migrates piece by piece in Phase 3 and after.** Nothing in the column's structure depends on it being gone, so migration is incremental and reversible.
- **198 — Where absorbs the kind.** The proposed kind renders in the Where band.
- **The proposed-kind ruling** — no producer today; until one exists, chips render unselected with **no "✓ proposed"**.
- **The nearest-intersection ruling** — hard-gated on #256's pre-scan; interim prints the road name, lat/lng in provenance.
- **Backend-first**, per #281's phase text and the standing Pydantic rule.

## What this phase absorbs

| Item | How |
|---|---|
| **N3** | The proposed-kind producer. Backend-owned (Rule 3); suggest-never-set; no proposal below the confidence floor |
| **N4** | The nearest-intersection tag. Hard-gated on #256's pre-scan lever |

## Acceptance

- Every state in Part 1 §2 for S2 measured on prod at **1440×1000 and 380×800**.
- **The pin marks the work** (#281 umbrella acceptance, P21) — the operator can see what the pin means without inferring it.
- The scenario version field exists and is read before anything depends on the new model.
- A proposed kind renders **only** when a producer produced it; otherwise unselected chips, no "✓ proposed".
- The proposal never sets the kind — **suggest-never-set stays green**.
- The intersection tag names a cross street **only** when a bucket produced one; otherwise the road name, lat/lng in provenance. No fabricated distance.
- The pre-scan is a **read**: no lock, no write, within suggest-never-set.
- Backend-first: every new wire field lands and is enumerated across senders before any surface sends it.
- Every threshold traced or marked CHOSEN (Rule 12).
- Ryan hand-checks on a hard-refreshed tab.

## Reference

- #281 (design authority), "The phases" 3, and the proposed-kind and nearest-intersection rulings; FLOW.md §5a, §9 Phase 3; P21.
- #256 **lever 2 specifically** (`validation-artifacts/committed/s2-arc31-scan-budget/README.md` for what the investigation did and did not deliver); #279; #234.
- Absorbs N3, N4.
- **Requires Phase 0, Phase 2, and #256's pre-scan lever.** Priority-medium (sequencing, not value). Refs #281

## The commands

Claude Code's `gh` is read-only; nothing below was executed. Bodies live beside this file in
`%TEMP%\s2-triage-3\`.

Re-verified against the completed #281 (Part 1 in the body, Part 2 as comment 1). **#259 and
#276 moved from close to re-aim** — §8.8 and §8.27 keep or move their surfaces rather than
dropping them, and §8.39 lists both under "Still open and inherited". The closed set is now
exactly §8.38's three.

Per the standing convention, reformat each body in chat before posting rather than pasting
these files to `gh` directly.

---

## 1. Close comments — post the comment, then close. Three issues.

**Do not close anything before the comment is posted.** The comment is the record that the
close was by construction rather than by neglect.

```
cd C:\Users\rtmak\Documents\traffic-control-tool
$T = "$env:TEMP\s2-triage-3"

gh issue comment 262 --body-file "$T\close-262.md"
gh issue comment 264 --body-file "$T\close-264.md"
gh issue comment 272 --body-file "$T\close-272.md"

gh issue close 262 --reason "not planned"
gh issue close 264 --reason "not planned"
gh issue close 272 --reason "not planned"
```

## 2. Re-aim comments — comment only, issues stay open. Twelve issues.

```
gh issue comment 153 --body-file "$T\reaim-153.md"
gh issue comment 209 --body-file "$T\reaim-209.md"
gh issue comment 212 --body-file "$T\reaim-212.md"
gh issue comment 215 --body-file "$T\reaim-215.md"
gh issue comment 234 --body-file "$T\reaim-234.md"
gh issue comment 235 --body-file "$T\reaim-235.md"
gh issue comment 237 --body-file "$T\reaim-237.md"
gh issue comment 259 --body-file "$T\reaim-259.md"
gh issue comment 267 --body-file "$T\reaim-267.md"
gh issue comment 276 --body-file "$T\reaim-276.md"
gh issue comment 277 --body-file "$T\reaim-277.md"
gh issue comment 280 --body-file "$T\reaim-280.md"
```

## 3. New issues — the five the spec did not know

```
gh issue create `
  --title "Preview-as-read backend flag — the render request cannot distinguish a preview from a generate" `
  --label "enhancement" --label "priority-high" --label "backend" `
  --body-file "$T\new-N1-preview-flag.md"

gh issue create `
  --title "Nine new type sizes and the fifth type role land as one ruled exception commit with owners" `
  --label "enhancement" --label "priority-high" --label "frontend" --label "ux" `
  --body-file "$T\new-N2-type-sizes.md"

gh issue create `
  --title "The proposed scenario kind has no producer — the WHERE band's suggestion cannot be stated" `
  --label "enhancement" --label "priority-medium" --label "backend" --label "frontend" --label "p2" `
  --body-file "$T\new-N3-proposed-kind.md"

gh issue create `
  --title "Nearest-intersection tag at pin time — the scan's intersection bucket runs at Generate, not at confirm" `
  --label "enhancement" --label "priority-medium" --label "backend" --label "frontend" --label "p21" `
  --body-file "$T\new-N4-intersection-tag.md"

gh issue create `
  --title "TRACE's formulas must be wire fields — no authored math in the frontend" `
  --label "enhancement" --label "priority-medium" --label "backend" --label "audit-trail" --label "p2" `
  --body-file "$T\new-N5-trace-formulas.md"
```

## 4. The phase umbrellas

```
gh issue create `
  --title "Direction A Phase 0 — foundations, nothing visible" `
  --label "enhancement" --label "priority-high" --label "backend" --label "frontend" `
  --body-file "$T\new-P0-phase0.md"

gh issue create `
  --title "Direction A Phase 1 — the results stack (S5, S6, S8)" `
  --label "enhancement" --label "priority-high" --label "frontend" --label "ux" `
  --body-file "$T\new-P1-phase1.md"

gh issue create `
  --title "Direction A Phase 2 — the band stack (S1-S4) and revision (S7)" `
  --label "enhancement" --label "priority-high" --label "frontend" --label "ux" `
  --body-file "$T\new-P2-phase2.md"

gh issue create `
  --title "Direction A Phase 3 — the work segment, pin = work start" `
  --label "enhancement" --label "priority-medium" --label "backend" --label "frontend" --label "ux" `
  --body-file "$T\new-P3-phase3.md"
```

Phase 4's umbrella is deliberately not drafted — #281: "Phase 4 can wait."

## Label caveat

The repo's principle labels run `p1`–`p16` per the house style, and #281 itself carries
`p17`–`p22`, so those exist too. The label sets above are a proposal; **confirm each against
the repo's taxonomy before creating**, since `gh issue create` fails on an unknown label
rather than creating it.
