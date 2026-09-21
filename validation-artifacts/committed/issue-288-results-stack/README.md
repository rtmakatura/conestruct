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

## Evidence plan, as ruled — not yet run

Five states, each at **1440×1000** and **380×800**: S5 with three NEEDS YOU items · S5 with
zero, the `↓ All (.zip)` primary (clause c) · S6 declined · S8 with the reference open.
Output outside the repo. Bundle poll before every leg. Sha-gated both ends. **No ship while a
leg is running.**
