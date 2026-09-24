# S4 on prod — in flight, both widths

#289's acceptance item "Every S1–S4 and S7 state measured on prod at both
widths", S4 leg.  The other legs: `../fidelity-after/` (S1–S3, S5, S7) and
`../s7-prod/`.

**Run:** `fidelity-audit/probe.cjs` against https://www.conestruct.com/sandbox
(healthz `8e2761e`), 2026-09-24T17:58:24Z, 1440×1000 and 380×800.  Same spot
as every leg: E Colfax, pin 39.74020, −104.95600, shoulder work.

| file | what |
|---|---|
| `s4-facts.json` | rule 117's facts, read off the live page at each width, plus the capture's text/box counts |
| `w1440-S4.png`, `w380-S4.png` | the full-page capture, taken right after the facts, with the plan still in flight |

## How S4 is held

S4 is `genState === "generating"`, which means the plan's `/api/render/device-breakdown`
request is in flight.  The first run (unheld) read 380's facts after the
answer had landed: working band gone, verdict "VERIFIED · 2 plan flags".
S4 did not last through one full-page capture.  The rig now holds that one
request (`page.route`) until the facts are read and the page is captured,
then releases it.  The page itself is unchanged; the answer only arrives
later.  `workingBandAfterCapture: true` at both widths records that the
screenshot is S4.

## Rule 117 against the measure

Rule 117 (Part 2): "Verdict slot mounted and empty, holding its height —
visibility hidden, not display none.  Both fact lines at opacity .5 with
'locked'.  The aerial NOT dimmed.  A results placeholder block: 1 px
#2c3e53, ground #101c29, padding 22 px 16 px, quiet section header '02 ·
RESULTS' plus 'No package yet — the plan is being built.' in body value
#6e7c8e.  Working band mounted.  No primary."

| clause | 1440 | 380 | |
|---|---|---|---|
| verdict slot mounted, empty, holding its height | mounted, text "", 57 px | mounted, text "", 80 px | **meets** (57 is the ruled 1440 reserve) |
| … visibility hidden, not display none | `visible` / `block` | `visible` / `block` | **mechanism differs**: the slot is visible but EMPTY, and `min-height: var(--status-h)` holds the room.  Nothing renders in it, and it is not `display: none`. |
| fact lines at .5 with "locked" | Where, What's the job?, Generate: all 0.5, all "locked" | same | **meets** (three lines, not two: Phase 2's stack has Generate as a band too) |
| aerial not dimmed | no aerial on the page | no aerial | **n/a**: the band stack mounts no aerial |
| working band mounted | yes, and still up after the capture | yes, and still up | **meets** |
| no primary | 0 visible `.a-pri` | 0 | **meets** |
| results placeholder block | **absent** | **absent** | **delta**: see below |

### The delta: a first Generate shows a "previous answer"

At both widths, in the placeholder's place the results zone shows the full
results (36 devices, 9 types, the four download cards, NEEDS YOU) under
the ribbon **"Previous answer — values below predate the request in
flight."**, plus a results-stack Setup line at opacity 1.  This is the
first Generate of the session.  The same run's S3 capture, taken just
before the click, shows no results and the open Generate button.

Cause, read in `conestruct/site/components/GeneratorShell.tsx`:

* Confirming the kind arms the checks (`checksArmed`), and the breakdown
  effect fetches `/api/render/device-breakdown` right then, before Generate.
* Generate re-fetches.  That pre-Generate answer is carried as `lastReady`
  (#192's stale-while-revalidate carry), so `regenerating` is true, and
  `showResults` with it, on the very first Generate.
* The placeholder is gated `genState === "generating" && !resultsVisible`,
  so it never renders.

The placeholder's own comment says it "renders on a FIRST generate only",
and the #258 comment says "a plan never presented is not a 'previous
answer'".  The carry breaks both: it presents an answer the person never
saw as a previous one.  `placeholderBox` is `null` at both widths, so
rule 117's figures (border, ground, padding, #6e7c8e) could not be measured
on prod.

**Not fixed here.**  The likely fix is to carry `lastReady` into a Generate
only when a plan was presented before.  It is recorded for Ryan's ruling.

### Also seen (380)

The results-stack Setup line's "pick a value to change it" (`ResultsHead.tsx`) wraps one word
per line in its right column (`w380-S4.png`, top).  This is the Setup line,
not S4 chrome; it is noted for the S5/S7 owner.
