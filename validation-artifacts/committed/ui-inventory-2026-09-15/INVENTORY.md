# /sandbox UI inventory — what each surface does and when it appears

Written 2026-09-15 for the full-redesign brief. Read alongside the screenshots.

This describes the build at `origin/main` = `60098ae`, read from source:
`conestruct/site/app/sandbox/page.tsx` and the component tree under
`conestruct/site/components/` and `conestruct/site/lib/`. It describes **what
exists**. Where a surface has a known defect there is an *Open issues* line
naming the issue; nothing here proposes a fix.

`/sandbox` renders exactly one component: `<GeneratorShell mode="sandbox" />`.
Everything below lives inside that shell. The same shell in `mode="workbench"`
backs the signed-in `/app` pages; where a surface behaves differently in the two
modes this document says so, because the sandbox branch is the one the redesign
touches.

## A note on FLOW.md

**There is no FLOW.md in this repository at this sha.** A `find` across the repo
and a grep for the string over every tracked `.md` both return nothing, and no
file carries an equivalent numbered flow under another name. So no surface below
can honestly be mapped to a "FLOW.md step" — writing one in would be inventing a
citation.

What the product *does* have is its own numbered step vocabulary, rendered on
screen, derived in one place (`lib/scenarios/rail.ts`), and used consistently by
the progress rail, the form section headers and the picker. Each surface below is
therefore tagged with **Step**, meaning that on-screen step number, or
**Step — none** where the surface is not part of the numbered path. The numbering
is:

- **Step 1 — Scenario** (which kind of plan)
- **Step 2 — Location** (the pin, and the road under it)
- **Step 3 — Road** (posted speed, lanes, width, divided)
- **Step 4 — Work** (work type, duration, work-zone length, night)
- **Step 5 — the per-kind fifth section**, present only for some kinds:
  "Flagger" (flagger lane closure), "Cross street" (near intersection),
  "Protection" (the gated kinds). Absent for shoulder and work-beyond-shoulder.
- **Step 5 or 6 — Schedule** (6 when a fifth section exists, 5 when it does not)
- **Step 6 or 7 — Site conditions you assert** (the step after Schedule)

Between Location and Road sits an **unnumbered** band, "Jurisdiction &
classification", which deliberately has no step index and no rail entry.

**Users.** The code names three readers, and the surfaces divide along them: the
**operator** (the person building the plan — every setup control, every
correction, every gate), the **estimator** (the person pricing it — the hero
counts, the device schedule, the quote panel; the code says "the two numbers a
CBC estimator prices from"), and the **reviewer / TCS** (the person who must
stamp it — section 03's cited checks, the audit PDF, the "Output requires TCS
review" notices). A fourth reader, the **crew**, is served only by a downloaded
file, never by a screen. Those roles come from code comments and on-screen copy,
not from a flow document.

---

# The seven scenario kinds, and the tier ledger

Two cross-cutting facts the redesign has to carry, gathered here so they are not
scattered through the surface entries.

## The seven scenario kinds — three live, four gated

`lib/scenarios/index.ts` declares seven kinds in `SCENARIO_KINDS`, each with a
user-facing label and a standard-sheet sub-label. A separate array,
`ENABLED_SCENARIO_KINDS`, gates which of the seven the UI offers and the API
accepts. `src/api/render_api.py` holds the twin gate, `ENABLED_SCENARIOS`, and
the two lists agree at this sha.

**Live — offered, generate, download:**

| code kind | user label | sub-label |
|---|---|---|
| `shoulder` | Shoulder work | TA-3/TA-5 · S-630-1 |
| `flagger_lane_closure` | Flagger lane closure | TA-10 · S-630-1 |
| `near_intersection` | Lane closure near intersection | Cases 18/19 · S-630-1 |

**Gated — declared, never offered:**

| code kind | user label | sub-label |
|---|---|---|
| `lane_closure_divided` | Lane closure (divided) | TA-19 · S-630-3 |
| `work_beyond_shoulder` | Work beyond shoulder | TA-1 · S-630-1 |
| `mobile_op_2lane` | Mobile op (2-lane) | TA-35 · S-630-1 |
| `mobile_op_multilane` | Mobile op (multi-lane) | TA-26 · S-630-3 |

Each gated kind still has a full form component, a default scenario and a
work-type list in the codebase. None of it is reachable: the scenario picker
filters `SCENARIO_KINDS` through `isScenarioKindEnabled` before rendering, so a
gated kind is never drawn as an option, and the backend answers a gated kind with
a 400 naming the currently-supported list.

**For the redesign: offer three kinds, not seven.** Any mock, card grid or
comparison table showing all seven presents four plans the product cannot make.
Two related surfaces exist but are unreachable today: a single-kind picker
fallback (one locked card plus "Additional scenarios coming soon", for if the
enabled list ever drops to one) and a `DisabledScenarioBanner` that fires only if
a scenario somehow holds a gated kind.

## The tier ledger — the one sorter the results screen reuses

Every fact the plan produces is sorted by **consequence**, not by subject, by one
pure function: `assignTiers` in `lib/tiering.ts`. It reads statuses the backend
already computed and assigns each fact a tier. It computes no verdict of its own.
A Python mirror, `src/rendering/tier_ledger.py`, sorts the same facts for the
audit PDF's cover, and both are pinned to one committed expectation file so
neither can drift.

The brief calls for three piles — changed / attention / passed. Those are the
three that carry consequence and the three the results screen leads with. **The
code has five tiers, four of them counted**, and the inventory has to say so,
because two of the five render on screen as their own collapsed sections:

| tier | glyph | on-screen label | counted? | what lands here |
|---|---|---|---|---|
| `changed` | ▲ | Changed this plan | yes | jurisdiction deltas that fired (count/op severity); site adjustments that added or moved devices; Fines Double applicable |
| `attention` | ⚠ | Needs attention | yes | conditional or unknown deltas; personnel and device mandate chips; failed Colorado checks; corridor warnings; geometry violations; signalized approaches; work hours outside the window; a site scan that was not checked; a failed or declined audit |
| `checked` | ✓ | Checked & passed | yes | the trace items (taper, buffer, spacing, advance); the case match; passing Colorado checks and info items; flagger sight distance; zero-device site adjustments; corridor checked-and-clean; Fines Double not applicable; non-signalized approaches; hours inside; each scanned condition found absent |
| `pending` | ◌ | Pending / not verified | yes | every `pending_verification` item; work hours unknown (schedule not set) |
| `reference` | i | Reference | **no — unnumbered by ruling** | administrative deltas; standing hazard meters; scanned buckets that map to no rule; moot operator corrections; the device schedule; permit FYI; hours windows |

`ledgerLine()` renders the four counted tokens with their zeros always present —
"N changes · N needs attention · N checked · N pending · reference" — and that
exact string is what the audit PDF's cover prints. On screen the line itself was
deleted (the tier chips' own counts are the single voice); the function stays for
the PDF.

Two numbers elsewhere on the results screen are the same ledger by construction:
the **Audit trail download card's "N checks"** is `ledger.checked`, and the ✓ tier
chip's count is the same value from the same call. They cannot disagree. The
**Pending items** chip in the next-steps strip is *not* from the ledger — it reads
`pending_verification.count` off the wire directly.

---

# The frame

## Root shell

**Code:** the outer `<div className="workbench">` in `GeneratorShell.tsx`.
**User:** no name — it is the page. **Step — none.**

Carries two things the redesign must preserve, because a dozen surfaces read
them:

- `data-stage` — the lifecycle stage (`pre` / `generating` / `post` / `error`).
  CSS keys the progress rail's height budget and the post-generate landing rule
  off it.
- `ws-locked` — present whenever any request is open. One CSS rule dims every
  descendant carrying `data-write` while it is disabled.

**The write lock** (`WriteLock.tsx`) is a context boolean set from the same
predicate the working band mounts on. Every control in the post-generate DOM must
declare itself: `data-write` (a control that changes the plan or opens a request —
locks) or `data-read` (an expander, disclosure or in-page jump — never locks;
reading is never blocked). Route links carry neither. A test walks the whole
post-generate DOM with a request held open and fails by name on any control that
declares neither, so a new control cannot ship undeclared.

Four decorative corner ticks sit behind everything, `aria-hidden`.

## App nav

**Code:** `AppNav.tsx`. **User:** everyone. **Step — none.**

Sticky, full width. Left to right: the wordmark and version ("conestruct." /
v0.4); in sandbox, the static badge "Demo / MUTCD plan generator"; then a live
citation cell showing `summary.ta` and `summary.cdot_sheet` from the last
successful audit — it holds the previous values through a refetch rather than
flashing empty, and is blank only before the first audit ever resolves. On the
right, the static "MUTCD 2023 · CDOT" edition badge.

**States:** one, plus the two data cells being empty or filled. There is
deliberately **no status dot**: a green pulse used to sit beside the edition badge
deriving from nothing, and it was removed rather than given a fake source.

**Actions:** the wordmark routes to `/`. The Clerk save controls (`PlanSaveButton`,
org switcher, user button) are behind the `AUTH_UI_ENABLED` flag and the workbench
mode — on `/sandbox` they do not render.

**Open issues:** #265 (the edition string exists as two separate literals, and
Denver's record pins a different edition).

## Sheet meta

**Code:** `AppSheetMeta.tsx`. **User:** reviewer. **Step — none.**

A thin band under the nav carrying the project name, the address and the CDOT
sheet — the plan-sheet title block, mirrored on screen. Project and address come
from `meta.project` / `meta.address`; the sheet from the audit summary.

**Open issues:** #212 — this component bakes the build date into prerendered HTML,
so every visitor after UTC midnight gets a hydration mismatch.

## Zone headings

Three `zone-head` blocks structure the page, each a numbered tag plus a title:

- **01 Setup** — title "Describe the work zone" before generate, "Scenario" after.
  The section takes a `dominant` class in the `pre` stage only.
- **02 Results** — title "MHT package". Takes `dominant` only when the stage is
  `post` **and** the plan was not declined. A zone-note, "device & type counts
  drive your estimate", renders under the same condition.
- **03 Reference** — title "Rules, permit & audit". The whole section mounts only
  when there is something to say: a jurisdiction block exists, or a jurisdiction
  key is set, or results are showing, or the audit errored.

Zone 1 and Zone 2 are `tabIndex={-1}` programmatic focus targets — never in the
Tab order, focused only by an armed user action (Reopen focuses Setup; Generate
focuses Results at the settle).

---

# Pre-generate surfaces

Everything in this part unmounts the moment Generate is clicked. The setup panel
is not hidden — it is replaced by the setup strip.

## Setup panel

**Code:** `GeneratorSidebar.tsx`, rendering `.setup-panel`.
**User:** operator. **Step — hosts steps 1 through 6/7.**

Full-width panel (it used to be a 360 px sticky sidebar). Header reads "Plan" with
an "INPUT" tag. Below it: the progress rail, the scenario picker spanning the full
width, a two-column grid of form sections that collapses to one column under
980 px, then the Generate footer.

**States:** one — mounted, in the `pre` stage. What varies inside is whether a pin
exists, which gates every section after Location.

### Progress rail

**Code:** `ProgressRail.tsx`, fed entirely by `deriveRail()` in
`lib/scenarios/rail.ts`. **User:** operator. **Step — it *is* the step list.**

A sticky steering line at the top of the setup panel, pre-generate only. One entry
per step plus a trailing Generate entry. Each entry is a button that jumps (scroll
plus focus, reduced-motion aware) to that section's header.

The component decides nothing. State, glyph, state word, informational subline and
the full accessible name are all fields on the derived entries; a sentinel test
fails if any of them is computed in the component.

**Entry states and their triggers:**

| state | glyph | word | trigger |
|---|---|---|---|
| `done` | ✓ | (none) | no open problem in this section |
| `attention` | ⚠ | "needs attention" | at least one unresolved blocker lands here — the glyph repeats once per blocker, so nothing queues invisibly |
| `pending` | ◌ | "pending" | no location yet; every section after Location is gated behind the pin |
| `notset` | ◌ | "optional · not set" | Schedule only, when no dates are entered. Never blocks |
| `stale` | ▲ | "detection stale" | Road only: a confirmed road exists but its recorded pin no longer matches the current pin. The values stand; their basis moved. Never blocks; `attention` outranks it |

**The blocker chain.** One ranked chain produces both the rail's current-blocker
string and the Generate button's disabled reason — the same string from the same
source, asserted by test. First match wins:

1. work-zone length invalid (required, or over the 20,000 ft ceiling)
2. lane count invalid
3. approach fields invalid (near-intersection)
4. the cross-street lane count is filled from map data and awaits confirmation —
   "Confirm the cross-street lane count first — it was filled from map data."
5. the backend refused the current input — "Generation declined — see the notice
   below." (or, when a confirm affordance is on screen, that affordance's own
   pointer text)
6. a declined input's re-check is still in flight — "Re-checking the declined
   input — Generate re-enables when the verdict settles."
7. no location — "Set a location first — pick on map or enter manually."

The rail shows *every* simultaneously-true blocker, each on its owning entry; the
first is highlighted as current. A refusal with no matching section affordance has
no home entry, so its line renders on the Generate entry instead.

**Informational sublines** (never a state, never a blocker): Location shows "N to
confirm" when jurisdiction or street-class suggestions await a decision; Schedule
shows a duration ("4 days") once dates are set, which is display-only date
arithmetic.

**Open issues:** #264 (rail entries are under a 32 px hit target); #237 (the
live-check harness matches the rail's Generate entry and mis-reports).

### Scenario picker

**Code:** `ScenarioPicker` inside `GeneratorSidebar.tsx`.
**User:** operator. **Step 1.**

A vertical list of cards, one per enabled kind. Each card shows the kind's label
and, right-aligned in the provenance type role, its TA/sheet citation. The active
card takes an accent border and tint. Renders `SCENARIO_KINDS` filtered through
`isScenarioKindEnabled`, so only the three live kinds appear.

**States:** the multi-kind list (today's state, three cards), and the single-kind
fallback described above.

**Action:** picking a kind writes `scenario.kind` — but not naively. A kind switch
carries shared inputs across (`carryAcrossKinds`: meta, work-zone length, night,
jurisdiction key, street class, schedule, with speed snapped into the new kind's
schema domain), re-derives the detection relays by re-running the classification
from the confirmed road so the new kind gets its own relay shape, lets the
operator's in-effect speed outrank the re-applied detected speed, clears the
approach-confirmation hold, and resets the three re-apply guards. With no
confirmed road on file, no relays are written at all.

### Location section

**Code:** `LocationCorridorSection` in `GeneratorSidebar.tsx`.
**User:** operator. **Step 2.**

Two mutually exclusive states, switched on whether `meta.lat`/`meta.lng` are both
zero (the documented "no pin" sentinel — literal 0/0 is the Gulf of Guinea and is
never a legitimate site).

**State: no pin.** A full-width primary CTA, "Pick Location on Map", with the
caption "Map · road detect · work zone in one step". Below it a small text toggle,
"Enter manually", revealing the manual fallback. That fallback **auto-expands**
when `NEXT_PUBLIC_MAPBOX_TOKEN` is unset, because there is no map to fall back
from.

**State: pinned.** A read-only fact strip plus an "Edit Location & Corridor →"
button and an "Edit manually" toggle. The fact strip is presented as instrument
output rather than fields: the address on its own line, then five bordered cells —
Lat, Lng, Bearing, Speed, Jurisdiction — each a micro label over a mono value. A
bearing nobody set renders "—". The jurisdiction cell prints the evaluated block's
name, falling back to the option label, falling back to "Not set".

**Applied-from-picker notice.** When the picker → form handoff transformed a value
the operator reviewed, an amber system-event container appears titled "Applied
from picker", with one ⚠ sentence per transformation and a "picker → form handoff"
provenance line. The sentences name what happened: a speed clamped to the kind's
cap, a speed snapped to the 5 mph grid, a low-confidence fallback accepted or
skipped, a road type not valid for this kind, a lane count clamped, a divided
toggle the kind does not take, a lane width applied, a work-zone speed reduction
cleared. Each note is filtered out the moment it stops describing the current
scenario — a manual speed edit hides its now-stale clamp note. When nothing
notable happened the container does not render at all.

**Corridor extent rows.** A labeled sub-block listing the five zones upstream to
downstream — advance warning, transition, buffer, work zone, downstream — each
with a dash-patterned channel swatch, the zone name, and a right-aligned tabular
length in feet, under a Total row. Beneath them, a proportional bar whose segments
match the row order; the bar is `aria-hidden` and unlabeled, floors each segment
to a minimum width so a short taper never vanishes, and therefore deliberately
over-draws small segments. The table is authoritative; the bar is a sanity check.

The lengths are the **backend's**, off `sections.corridor_spec` on the audit
response (`advance_warning_ft`, `taper_ft`, `buffer_ft`, `downstream_taper_ft`)
plus the typed work-zone length. Nothing is computed locally. Two honest empty
states replace the rows: "Set work-zone length to compute" when `workLen` is zero,
and "Corridor extent unavailable — awaiting verification" when the backend lengths
have not arrived.

**Disclosure — "Project details".** Collapsed by default, tagged OPTIONAL, at the
bottom of the Location section. Holds three optional title-block fields: project
name, location description, address, with the note "Title-block metadata — set the
work location with the map pin above." It was demoted here from the top of the
panel precisely because it is not on the required path.

**Disclosure — manual entry fallback.** A bordered mini-card, "Manual entry
(fallback)", with latitude, longitude, bearing (0–359) and work-zone length. The
lat/lng inputs write through `withPin()`, the single door every pin writer uses,
so a typed coordinate clears the operator's site-condition corrections exactly as
a picker save does. Work-zone length carries blur-gated inline validation.

### Jurisdiction & classification band

**Code:** `JurisdictionControls` in `JurisdictionSection.tsx`, built by the shell
and placed by the sidebar inside a `FieldGroup` labeled "Jurisdiction &
classification". **User:** operator. **Step — deliberately none** (no step index,
no rail entry; it is pin-derived, so it sits directly under the pin it depends
on).

Two fields side by side.

**Jurisdiction.** A `<select>` whose first option is "Not set — MUTCD + CDOT only",
then every entry in `JURISDICTION_OPTIONS`. Below it an authority line: once the
evaluated block loads it reads the jurisdiction's name, its authority, "calls this
plan a *{tcp_term}*, the ROW *{row_term}*"; while loading, a skeleton line; unset,
"Statewide baseline — MUTCD + Colorado Supplement only."

**Street classification.** A three-button pressed-state group — Local, Collector,
Arterial — writing `scenario.street_class`.

**Suggestion slots.** Both fields host a suggestion slot fed from the pin. The
jurisdiction suggestion comes from `POST /api/jurisdiction/suggest` (debounced
400 ms on pin drags); the street-class suggestion is derived client-side from the
confirmed road's OSM highway tier, and vanishes rather than speak if the confirmed
road's recorded pin no longer matches the current one.

Both are **advice only**. The single writer of `jurisdiction_key` and
`street_class` from this feature is the operator's Confirm click. A malformed
suggestion response makes the slot go quiet instead of rendering a broken
suggestion; an absent or failing endpoint makes the whole feature inert and the
picker works unchanged.

**Resolving a suggestion leaves a record, not a cleared slot.** Confirm and Dismiss
both re-render the same container as a resolved record — ✓ or ×, the evidence, and
an Undo. The record carries the value in effect at click time, including the
distinction between "was null" and "was absent", so Undo restores
byte-identically: an absent key comes back absent, never as an explicit null. Undo
also re-arms the live proposal. Moving the pin clears any record — its subject no
longer exists. None of this is ever written to the scenario or the payload.

Pre-pin, the whole band renders `pending` like every other downstream step.

### Per-kind form

**Code:** one of `ShoulderForm`, `FlaggerForm`, `NearIntersectionForm` (the live
three) or `LaneClosureForm`, `WorkBeyondShoulderForm`, `MobileOp2LaneForm`,
`MobileOpMultilaneForm` (declared, unreachable).
**User:** operator. **Steps 3, 4, and the per-kind step 5.**

Each live form contributes a Road section (step 3), a Work section (step 4) and,
for flagger and near-intersection, a fifth section — "Flagger" and "Cross street"
respectively. Shoulder has no fifth section.

At the top of the **Road** section, all three live forms render the
detected-vs-applied block (below).

`NearIntersectionForm` additionally carries the **approach-confirmation hold**: a
lane count filled from map data is a proposal until the operator confirms or edits
it, and the hold gates Generate with a stated reason. Where OSM carried no lane
tag at all, the count was assumed 1 per direction and the hold's reason says so —
a substituted count and a detected count look identical on screen, so both are
held.

**Open issues:** #209 (the picker renders lanes/divided editors on kinds that
discard them, and the lanes input allows 6 against a domain max of 4); #235 (a
consistency round over the road section).

### Detected vs applied block

**Code:** `DetectedVsApplied.tsx`, mounted at the top of the Road section by the
three live forms. **User:** operator, and the reviewer reading over their
shoulder. **Step 3.**

Answers one question: *did the plan use what the map said?*

**Renders only when** a confirmed road exists **and** its recorded pin equals the
current pin. A stale road never speaks. The manual, no-road path renders nothing.

**Shape.** One row per fact. A 16 px glyph gutter, the fact's label and the
**applied** value on line one sharing one right axis, and a generated provenance
clause on line two that always names the detected value and the source tokens for
both sides. Every glyph sits on one vertical axis, so a column of ✓ reads as a
column and a single ⚠ breaks it.

**Three verdicts per row:**

- `match` (✓) — detected and applied agree. Compared as model values, not as the
  strings on screen, so "30" and "30 mph" cannot disagree spuriously.
- `differ` (⚠) — they do not. The clause says whether the difference is the
  system's own domain snap or an operator's change (`operator-set`).
- `unset` (◌) — the plan has taken no value for this fact. Neither agreement nor
  disagreement, and never dressed as a verdict.

**Rows:** bearing, speed limit, lane counts, divided, road type, one-way — each
present only where the classification actually reported that fact. The applied
column inherits the detected token while the values match, and says `operator-set`
once they differ. A caveat line closes the block: where road geometry is on file
the drawing follows the geometry's own bearings and the typed bearing is consumed
sign-only.

**Data:** entirely client-side, from `meta.confirmedRoad` (the picked candidate —
way, name, bearing, tags — plus the classification synthesized at confirm time)
against the live scenario fields. No wire change. The clause is composed by one
producer, `lib/road-detection/provenance.ts`, which the picker also composes from.

**Open issues:** #277 — **the block never renders for four of the seven kinds.**
#280 — "Freeway / interstate" is 128 px of a 332 px worst-case clause, forcing a
two-line reserve at 380 px. #279 — the classifier returns "Rural — undivided" for
a plainly urban Denver arterial; that is upstream of this block, but it is what
the block truthfully displays.

### Schedule section

**Code:** `ScheduleField.tsx`. **User:** operator. **Step 5 or 6.**

A three-way chip row — Single day / Date range / Not set — then, unless the mode is
"Not set", a work-date input (labeled "First work day" in range mode), an end date
in range mode, and start/end time selects on the half hour. An end time earlier
than the start is a legitimate overnight wrap and is labeled "(next day)"; only
end equal to start is excluded.

**States:** an untouched scenario presents **"Not set"** as the chosen mode and
writes nothing to the payload until the operator interacts. Before the fix this
presented "Single day" as chosen under a caption promising that windows and lead
times computed from it — an asserted shape.

When a jurisdiction is selected, the section also renders that jurisdiction's real
work-window rows from the evaluated block.

**Open issues:** #215 (the work-window timeline lacks labels at window boundaries,
so end times are inferred from unlabeled gaps).

### Site conditions you assert

**Code:** `SiteConditionsField.tsx`. **User:** operator. **Step 6 or 7 — the last.**

Two checkbox rows only: **Limited sight distance** ("Curve, hill crest — moves
advance signs 50% farther upstream") and **Driveways present** ("Advisory:
maintain access gaps in channelization"). Writes `meta.siteConditions`.

A provenance line above them states why it is only two: "Site conditions are
scanned along the corridor when you generate (OpenStreetMap). These two are yours
to assert — no scan can see them."

This is the residue of a much larger control. The manual detect section and the
five scanned checkboxes both retired: the scan owns those five keys and used to
overwrite the checkboxes silently, and their facts now render post-generate as
counted tier rows with real evidence. Pre-generate these rows render **no
evidence** — no counts, no distances, no phantom numbers.

### Generate footer

**Code:** the `rail-step-generate` block plus `GenerateButton`.
**User:** operator. **Step — the terminal action.**

A bordered footer holding the Generate button and, under it, the static line
"Output requires TCS review".

**States:** enabled exactly when the rail's blocker chain is empty; disabled
otherwise, carrying the blocker's message as its reason. The reason is the gate's
**one live speaker** (`role="alert"`) — the rail renders the same sentence visually
only, `aria-hidden`, so a screen reader hears it once. Clicking arms four things at
once: the scroll landing, the package announcement, the cleared "landed" flag, and
the cleared proceed-anyway acknowledgement, then flips the stage.

## Location picker modal

**Code:** `LocationPickerModal.tsx` — at 3,293 lines, the largest single surface.
**User:** operator. **Step 2, in depth.**
**Trigger:** the "Pick Location on Map" CTA (no pin) or "Edit Location &
Corridor →" (pinned). Closes on Save & Close, Cancel, the × button, or a click on
the backdrop.

A full-screen dialog (`role="dialog"`, `aria-modal`) titled "Define Work Zone",
with the eyebrow "Work zone · Define" and the lede "Drop a pin, review the
detected road properties, and set the work-zone length."

**Layout:** two columns above 980 px — a map column that never leaves the viewport,
and a fixed 456 px **decision rail** that scrolls on its own. Below 980 px it
stacks: map on top at 44vh, panels beneath, whole body scrolls.

### Map column

**Search bar.** A free-text address or intersection query posted to the geocoder. A
coarse (town-level) match zooms to 12; a precise match to 16.

**Manual coordinate boxes.** Latitude and longitude, with paste handling: a pasted
"lat, lng" pair splits across both boxes, and Unicode minus, en dash, NBSP and
stray whitespace are normalised before any parse. DMS glyphs are deliberately
*not* normalised, so the DMS refusal still fires.

**The map itself.** Mapbox GL, satellite or streets, toggled by a button top-left.
Two pins: the work-zone pin in the dim orange, and — for near-intersection only — a
teal cross-street pin coloured to match the work-zone corridor segment so the two
read as different jobs. The corridor polyline and its labels draw as map layers.
Bottom-right, a Recenter button ("show me the whole corridor" — the map no longer
auto-refits on pin drags) above the corridor legend.

**States of the map pane:**

- **no pin** — a floating hint, "Click the map or search to drop a pin"
- **pinned** — pin, corridor overlay, Recenter, legend
- **no token** — the map is replaced by an explicit panel: "Map unavailable /
  NEXT_PUBLIC_MAPBOX_TOKEN is not configured. The interactive map can't load —
  please enter coordinates manually below."

A bearing-detection warning renders in a thin strip directly under the map when
classification surfaces a bearing problem.

### Decision rail

**Detection outcome card.** The first block. Once a pin exists and detection has
run or is running, it always shows exactly one of four things — never nothing:

- **in-flight** — a skeleton
- **single match** — a confirmed card naming the road, its confidence as three
  filled/empty pips plus the word ("{source} · {level} confidence" — achromatic,
  never hue alone), and its tags
- **multi-candidate** — a pick list; properties are *not* synthesized until the
  operator picks one road
- **empty / error** — an explicit empty state carrying the error message

The card is keyed on the candidate set, so a fresh detection resets its collapse
state.

**Road properties panel.** The classification state machine has five states:
`idle`, `resolving`, `awaiting_pick` (the multi-candidate case — the panel sits
here rather than guessing), `detected`, and `error`. Each detected field renders as
a row with the detected value, an inline editor, and a Revert button once
overridden. Editors are typed per field: numeric, a road-type select, a divided
toggle. Overrides are recorded per field and handed back at Save, keyed so the
parent can apply them in a scenario-safe order. A "Re-detect" action re-runs
detection at the current pin.

**Work zone panel.** Work-zone length in feet and direction of travel in degrees,
each with inline validation (bearing must be a 0–359 integer; 360 normalises to 0
before it reaches the input; out-of-range or fractional trips the error and
disables Save). Two helpers: "use the detected bearing" and "flip direction".

**Cross street panel.** Near-intersection only. The operator arms an intersection
mode, clicks the intersection on the map, and the detected cross street is
summarised here with a Clear action. Every derived value is a **proposal** — it
lands in the approach form, editable, with the lane count held for explicit
confirmation.

**Corridor preview panel.** The five zone extents, from the backend spec lengths,
with their own status: available, awaiting the spec, or blocked on a pending road
pick.

### Footer

Right-aligned: an optional warning, then Cancel, then Save & Close.

**Save is gated.** Two footer notices name why it is disabled:

- "⚠ Pick a road to continue" — candidates exist but none is chosen
- "Detecting road… — Save enables when detection settles" — classification is
  resolving

**What Save writes.** A single `LocationPickerResult`: address, lat, lng, bearing,
work-zone length, the classification (null when detection did not run — the parent
then keeps existing road fields), the per-field overrides, the cross-street
candidate, and `confirmedRoad` — the committed road choice with the pin it was
confirmed at, persisted on the scenario so it survives close/reopen and reload.

**What the parent does with it** (`onPickerSave` in `GeneratorSidebar`): writes the
pin through `withPin` (clearing site-condition corrections if the pin actually
moved — a re-save at the same pin keeps them); applies the classification **only if
its content changed** since the last apply, so a re-open-and-save never re-imposes
detected values over manual edits made since; **clears every detection relay** if
the save resolved no road, because stale relays riding the wire under new
coordinates would arm or disarm the backend's gates on a road nobody detected;
applies only *changed* overrides, under the same guard; converts a changed
cross-street candidate into approaches and re-arms the confirmation hold; and
records the handoff notes.

**Open issues:** #267 (the preview's taper uses default lane and shoulder widths);
#234 (the intersection marker is not restored on reopen); #209 (editors render on
kinds that discard them; the lane input is bound wrong).

---

# Post-generate surfaces

## Setup strip

**Code:** `SetupStrip.tsx`. **User:** operator.
**Step — the compressed 1 through 6/7.**
**Appears:** in every stage except `pre`, replacing the setup panel.

One cell per scenario fact, in a horizontal strip. The edit split is the contract:

- **Simple values edit inline** and recompute immediately — jurisdiction, street
  class, speed, lane width, work-zone length, date, hours. Each cell is a button
  showing label, value and a ✎ affordance; clicking swaps the cell for its editor
  in place.
- **Structural values reopen the whole panel** — scenario kind and road type,
  because they gate which form renders. These cells carry a ⤢ affordance and the
  title "Reopen full setup to change".

A trailing button, "Edit full setup ⤢", does the same.

**Editors.** Jurisdiction is a select (first option "Not set"); street class a
three-button pressed group; speed a select bounded by the kind's own slider cap
(shoulder 25–75, flagger 25–55 — the strip must never offer a speed the panel
refuses); lane width a select from 9 to 14 ft; date a date input; hours two
half-hour selects where the end list excludes only the start value and labels
earlier times "(next day)".

**Work-zone length is the exception:** it holds a draft and commits on blur or
Enter, not per keystroke, because every keystroke used to open a request and the
lock would have disabled the field under the cursor. An unchanged or unparsable
draft writes nothing.

**Under the lock,** every cell renders `aria-disabled` rather than `disabled`, so it
stays focusable — an editor that commits under the lock hands focus back to its
opener, and a disabled button cannot take focus. Closing an editor restores focus
to the cell that opened it, but only when the close actually dropped focus to
`<body>`; a deliberate tab-away is not yanked back.

**Two blocks render above the strip:** the corrections block (its own entry below),
and —

**"Site conditions" not-checked notice.** An amber system-event container with a ⚠
glyph, the backend's disclosure sentence as one text node, and a provenance line
carrying the scan mode, any error, the attempt time (day · hh:mm utc, sliced from
the ISO string with no clock and no arithmetic; the full ISO sits on the `<time>`
element for copy and audit) and "· re-generate to retry". Renders **only** for a
proceed-anyway plan — scan status `unavailable`, `proceeded_anyway` true, and the
disclosure string present. Every other scan state prints nothing.

**Open issues:** #276 (the jurisdiction cell silently falls back to the static
label when the evaluated block is absent or errored); #262 (the inline editors show
no way to close, Escape does nothing, they commit on blur with no Apply, and at
380 px an open editor grows the strip).

## Corrections block — "Site conditions — scanned"

**Code:** `SiteCorrections` inside `SetupStrip.tsx`, anchored at
`#site-corrections`. **User:** operator. **Step — none; it is post-generate work.**
**Appears:** once a scan has been served for the plan on screen. Held through a
re-generation rather than unmounted.

This is where the operator disputes what the corridor scan found. Section 03
discloses the same facts but never writes; this block is the only writer.

**Shape.** One grid, two tracks — a ledger column and an action column, so the
verdict reads down the left edge and every button shares one right edge in every
state. No column heads: a row reads symbol → name → elastic dotted leader →
verdict → evidence.

**Five condition rows**, in wire order: adjacent at-grade intersection, adjacent
interchange (highway ramps), pedestrian sidewalks, bike lane / cycleway, school
zone. A bucket missing from the wire renders nothing at all.

**Row states:**

| state | glyph | words | evidence | action |
|---|---|---|---|---|
| detected | ▲ | "detected" | count and nearest distance, from the wire | **Dismiss** |
| absent | ✓ | "none along the corridor" | deliberately empty | **Assert** |
| staged | ◌ | "staged — not yet applied" | the intent in words | **Undo** (un-stages, costs nothing) |
| applied record | ✓ / × / ⚠ | the backend's disclosure clause, one text node | — | **Undo** |

The applied-record row *is* the system-event container — a state change reuses the
container it replaces. × for a dismiss, ✓ for an assert, ⚠ for a correction the
backend judged moot.

**The dismiss picker** opens as exactly one extra grid row under the condition, and
only from a detected row (guarded at the state transition against the served
bucket, not by which button the view happened to draw). It holds a radio-chip
group — Fenced off / Removed / Not in the work zone / Other (say what) — with the
chosen chip carrying border, wash, ink **and** a ✓ glyph plus the native checked
state. It is an in-DOM radio group, never a native `<select>`, because a native
popup renders outside the DOM where nothing can measure it. The note field is
**always mounted** at a fixed reservation, void and out of the tab order until
"Other" is chosen, so choosing Other never moves the Confirm button. Confirm is
enabled once a reason is picked; an Other with an empty note is answered *at the
note* on the click — focus, `aria-invalid`, and a "say what — required"
placeholder — so the button never moves and is never dead. Cancel takes the
condition row's action slot; Confirm dismiss takes the sub-row's action cell.

**Staging, and the one write.** Every click on a row is an **intent held in the
shell**, not a scenario write. Only **Apply** writes: it folds the whole staged set
into one `setScenario`, which opens one request and one working-band cycle.
Staging opens no request at all.

**The Apply row is always present** post-scan, as the ledger's last data line: a
standing sentence ("no corrections staged" / "N corrections staged · not yet
applied") and the block's one write button, "Apply N corrections", disabled at zero
with the reason on its title.

**While corrections are staged and the pair has settled, the results disclose
rather than lock.** The results zone dims, a ribbon says "Previous answer — N
corrections staged, not yet applied", and downloads, quote and save all stay live —
locking would make staging non-abandonable.

**The footer** reads as the ledger's last line: the label "scan", an elastic leader,
then the scan mode, the sliced timestamp, the scan duration in seconds to one
decimal, the word "memoised" when the backend re-served a prior fetch, and "· apply
re-generates the plan". Below it, the backend's verify-in-the-field advisory,
printed **once per plan** — absent on the wire means absent here.

**Under a re-generation** every button in the block disables and the block renders
the *last ready* scan rather than unmounting.

**Data:** `sections.site_scan` on the audit response — `status`, `mode`,
`measured_at`, `duration_ms`, `budget_s`, `memo_hit`, `proceeded_anyway`,
`buckets{detected,count,nearest_distance_m,nearest_distance_ft,details}`,
`corrections[{flag,action,reason,note,status,scan_detected,disclosure,record_clause}]`,
`corrections_advisory`. **Writes:** `meta.siteConditionOverrides`.

**Open issues:** #264 (the Undo text buttons are under 32 px); #256 (the scan budget
itself — see the refusal container).

## Status strip

**Code:** `StatusBar.tsx`. **User:** everyone; it is the product's verdict surface.
**Step — none.** **Appears: in every stage,** pre- and post-generate. It is not
post-generation chrome; it is the live per-input verdict.

The wrapper is a polite live region **and** a reserved slot: it holds the pill
height and the 24 px gap in every state, including the null state, so the verdict
re-mounting at the settle lands in room already allocated rather than pushing the
results zone down 76 px.

**The states, in strict precedence order:**

1. **INVALID INPUT · {message}** — red, pill "GENERATION BLOCKED". The schema-bound
   client checks only: work-zone required / ceiling, lanes, approaches. A backend
   400 never lands here.
2. **PLAN DECLINED · {pointer or message}** — red. Any backend 400: a gate refusal,
   the geometry taper floor, a refused scan. The pill distinguishes three causes:
   **SERVICE UNAVAILABLE** for a `site_scan_unavailable` code, **NEEDS REVIEW**
   when a confirm affordance is on screen, **NEEDS INPUT** otherwise. When an
   affordance exists the strip prints only a short pointer to it; with no
   affordance it prints the full 400 — and that is the only place on the whole
   screen it renders.
3. **AWAITING LOCATION · no site chosen** — chromeless neutral. No site has ever
   been chosen. Ranked below the two above (a real problem with an actual edit
   outranks a missing pin) and above every verdict branch, because the strip can
   never show a verdict for a site nobody chose. Before this state existed, a fresh
   `/sandbox` load rendered green READY.
4. **VERIFICATION PAUSED · too many updates in the last minute — retry from the
   audit trail panel in a moment** — a 429 from the app's own rate limiter, named as
   the edit pace it is, never dressed as an outage.
5. **VERIFICATION UNAVAILABLE · retry from the audit trail panel below** — a genuine
   fetch failure.
6. **VERIFYING · taper · buffer · spacing · sign placement** — a verification is in
   flight. After roughly 2 seconds the copy escalates to "VERIFYING · waking the
   verification server — the first check can take a few extra seconds", because a
   warm round trip is 0.5–0.7 s and a Modal cold start is ~5.5 s, and an unexplained
   VERIFYING reads as a hang. **This branch renders nothing once the plan is
   generated** — the working band is then the page's one working voice. It never
   shows the stale verdict either way.
7. **VERIFICATION UNAVAILABLE · this response carries no plan verdict** — a 200
   whose `plan_flags` rollup is absent. The strip does **not** re-derive a verdict
   from warning counts.
8. **VERIFIED · N validation warnings** — amber, pill "REVIEW WARNINGS", with a
   `<details>` disclosure listing each warning as a row: rule ID, message and
   citation. Fires when `plan_flags.is_clean` is false and the only non-zero
   category is validation warnings.
9. **VERIFIED · N plan flags** — amber, pill "REVIEW FLAGS", disclosure broken down
   by category so "fix your input" stays separate from "a compliance check failed"
   (cited CDOT S-630-1) and "Conestruct doesn't do X yet" (MANUAL HANDLING). The
   counts come from the backend rollup; compliance fails and V1 limitations carry
   their detail in section 03 and are pointed at, never restated.
10. **VERIFIED · 0 validation warnings** — green, pill "READY FOR TCS REVIEW".

The green/amber verdict is the backend's `plan_flags.is_clean`, never re-derived,
so the strip and the audit panel cannot disagree.

**Disclosure:** states 8 and 9 are `<details>` with a ▸ caret in the summary.

**Data:** `plan_flags{is_clean,validation_warnings,compliance_fails,v1_limitations}`,
`sections.geometry_validation.violations[]`,
`sections.corridor_validation{checked,warnings[]}`.

**Everything is read through the stamped audit view** — an answer for an input the
backend has not seen is never presented as current. During the 350 ms debounce
window and every refetch, the verdict reverts to checking.

## Working band

**Code:** `WorkingBand.tsx`, derived by `lib/working-band.ts`.
**User:** everyone. **Step — none.**
**Appears:** fixed to the bottom edge of the viewport, mounted exactly while a
request for the generated scenario is open. It is the page's **one working voice** —
the strip speaks verdicts, the refusal container speaks refusals, the announcement
region speaks the package, and no event has two speakers.

**Shape:** a 2 px track above the row (the only motion; it encodes "alive", never
percent done, and is static under reduced motion), then ◌ · verb · object · "⚠
CONTROLS LOCKED". The content row is `role="status"`, polite. There is no stage line
— the backend emits no stage events. There is no Cancel — aborting a fetch does not
roll back the wire scenario.

**The three verbs:**

**GENERATING** — the settled answer carried no site scan, so this flight is the
first Generate. Object: "new plan · {address}" from `meta.address`; when the
operator typed no address, "new plan · pin {lat}, {lng}" to four decimals. Never a
placeholder name.

**RE-GENERATING** — a scanned plan is being re-made. The object is chosen in strict
order from the difference between the last settled wire scenario and the current
one:

1. more than one condition marker changed → "after N corrections" (counted by flag;
   naming one condition would be a half-truth)
2. a correction added → "after a correction to {condition name}"
3. a correction removed → "after undoing the correction to {condition name}"
4. the proceed-anyway acknowledgement appeared → "without the site check"
5. one of the strip's inline fields changed → "after an edit to {speed / lane width /
   work zone length / jurisdiction / street class / work date / end date / start
   time / end time}"
6. the same wire object again (only Retry re-sends an answered input) → "retrying
   the site scan"
7. anything else → "the plan" — an honest generic rather than a guessed specific

**RENDERING** — no plan request is open but a file render is. The object is the
file's own declared name: "plan sheet PDF", "device list XLSX", "crew instructions
MD", "crew instructions PDF", "audit PDF", "quote preview", "quote XLSX", "MHT
package ZIP". A plan request outranks a render when both are open, because the plan
is what the file will be of.

The band never shows a failure state and never runs on a timer: the request closing
is the unmount, whatever the answer was. A spacer sibling after the footer reserves
its room, rather than padding on the root, which would suppress scroll anchoring in
the settle frame.

## Refusal container

**Code:** the `scan-refusal` block inside Zone 2 in `GeneratorShell.tsx`.
**User:** operator. **Step — none.**
**Appears:** only once the plan pair has settled — never in a frame the working band
is up — when the stamped audit is an error carrying the `site_scan_unavailable`
code.

Rendered **outside** the stale-results wrapper: the dimmed results behind it are the
previous answer, but the refusal is current and must keep its measured contrast.

**Shape:** `role="alert"`, an amber system-event container titled "Site scan", with
a ⚠ glyph and the backend's message as **one text node** — the only place it renders
on the whole screen. Line two is provenance: the scan mode, the error, the attempted
time (the same sliced `day · hh:mm utc` format the block footer and the not-checked
notice use; full ISO on the `<time>` element), and the budget in seconds.

**Two recovery actions**, both the same download-button class, on one edge, 40 px at
desk and 44 px at phone, both write controls under the lock:

- **↻ Retry scan** — first by position, never by weight. Refires both fetches
  unconditionally.
- **Generate anyway** — a deliberate, secondary action, never a default. The label
  states the input (it sets `proceed_if_unavailable`), and the consequence sits
  beneath in the provenance role: "tries the scan once more · the plan says whether
  it ran". It explicitly does **not** promise a NOT-CHECKED outcome.

The proceed-anyway acknowledgement is stamped per input: any edit produces a new
scenario object, which drops the acknowledgement and forces the next scan to succeed
or be acknowledged again. A fresh Generate click resets it too.

**When the container is up, the whole plan is withheld** — hero counts, download
buttons, pricing and the zone note all hide. The audit's verdict gates the results,
never the breakdown's arrival: the two answer independently, and a breakdown that
succeeds while the audit refuses used to show counts and four live download buttons
under a refusal.

**Open issues:** #256 — the demo corridor refuses roughly a third of cold scans at
the 20 s budget, and the corridor check carries a second independent 20 s budget with
no memo. This container is the surface that defect is seen through.

## Results head and next-steps strip

**Code:** `ResultsHead.tsx`, derived by `lib/next-steps.ts`.
**User:** operator. **Step — none; it is the post-generate to-do line.**

**Three states:**

- **null** — pre-generate. Nothing renders, not even the slot.
- **reserved slot, empty** — from the Generate click onward, a `.results-head-slot`
  of the strip's height plus its gap is mounted and empty, so the strip lands at the
  settle into room already allocated. Released under a declined plan.
- **strip** — once a plan has *landed*: generated, an answer for the generated
  scenario has settled since the click, and the pair was not declined.

The slot is also the pin: sticky within the results zone, and static below 520 px of
zone width.

**Shape:** a label, "NEXT — 3 STEPS", then three chips. Each chip is one `<a>`,
`data-read` (a jump, never a write — live under the band), rendering index · glyph ·
name · count, and jumping with scroll and focus to its anchor.

**Chip vocabulary:** ▲ work the operator owes · ✓ a server-confirmed zero or a
server-produced artifact · ◌ nothing evaluated. Never "done", never a filled chip.

**The three chips:**

| chip | states | data | anchor |
|---|---|---|---|
| **01 Site conditions** | ▲ "N OPEN/total" · ✓ "0 OPEN/total" · ◌ "NOT SCANNED". Staged corrections **append** "· k STAGED", never subtract | `sections.site_scan` — open = detected keyed buckets with no server correction; total = keyed buckets on the wire | `#site-corrections` |
| **02 Pending items** | ▲ "N OPEN" · ✓ "0 OPEN" | `pending_verification.count` — server-confirmed, never a client tick | `#reference` |
| **03 Download** | ✓ "N FILES READY" · ◌ "NOT PRODUCED" (inert, `aria-disabled`) | `BUNDLE_PART_KINDS.length` — the zip's parts: pdf, xlsx, markdown, quote | `#downloads` |

Under the working band the derivation reads the last confirmed answer, so the counts
hold for the whole flight — they never tick, never grey to a placeholder, never
predict. An audit error is null: there is nothing to count. There is no "not yet
evaluated" state, because no wire state backs one.

The strip is visually-only — it has no live region, because it never says what the
system is doing. It states the file count exactly once for the whole page; the
download cards' caption deliberately does not repeat the numeral.

**Open issues:** #272 — the "NEXT — 3 STEPS" label and the chip row do not share a
left edge.

## Results hero

**Code:** `ResultsHero.tsx`. **User:** estimator. **Step — none.**
**Appears:** whenever results are visible and the breakdown has data (ready, or the
carried previous answer during a refetch).

The two numbers an estimator prices from, at the largest treatment on the page.

**Left cell:** Total devices — `total_devices`, sub-line "on the plan sheet",
extended with "· incl. +N jurisdiction-required" when any device row carries the
backend's `jurisdiction_required` flag.
**Right cell:** Unique types — `unique_types`, sub-line "distinct device types to
source", extended with "· N from {jurisdiction name}".
**Right rail:** a case-ID line ("{jurisdiction} · {tcp_term}", or "Baseline · MHT"
with no jurisdiction) and four geometry rows — Taper L, Buffer B, Device spacing
(ft o.c.), Work zone — all verbatim from `zone_geometry`.

**Honest degradation:** when `zone_geometry` is absent the four rows are replaced by
a single "Zone geometry unavailable" row; nothing is recomputed locally. A partial
response missing either count renders the hero not at all rather than crashing the
results zone.

During a refetch the hero holds the carried previous answer and the parent dims it
under an explicit recomputing ribbon — marked, never presented as current.

## Stale ribbons

Three mutually exclusive single-line ribbons render at the top of the results
wrapper, and the wrapper takes a `results-stale` dim:

- **⚠ Device breakdown failed — values below may be stale. Fix the input or retry
  from the plan details panel.** — `role="alert"`, on a breakdown error.
- **Previous answer — values below predate the request in flight.** — during a
  regenerate that has prior results to hold. Visual only: the band's live region
  already announces the flight.
- **Previous answer — N corrections staged, not yet applied.** — the staged
  disclosure.

None of them renders under a declined plan: "values below" would point at content
the verdict hides, and the refusal container is the voice.

**Open issues:** #259 — the ribbon's own label sits inside the dim it explains and
measures 2.39:1.

## Download cards

**Code:** `OutputCards.tsx`, inside the `#downloads` jump anchor.
**User:** operator, crew (via the files), reviewer (the audit PDF). **Step — none.**

**Empty state (pre-generate, and under a decline):** a panel reading "No package yet"
plus, pre-generate only, the path "Describe the work zone → press generate →
download the package". Under a decline the headline stands alone — the refusal
container above is the single instruction, so the operator is not told to press a
button they already pressed.

**Header row:** the caption "MHT PACKAGE" and, in sandbox only, an "↓ All (.zip)"
button that POSTs the wire scenario plus the live quote settings to
`/api/render/bundle` and downloads `{project}_mht_package.zip`.

**Four cards on one action edge:**

| card | spec line | quantity | downloads |
|---|---|---|---|
| Plan sheet | "11×17 · {TA} · {CDOT sheet}" | `total_devices` devices | PDF |
| Device list | "CDOT BID-READY" | `unique_types` types | XLSX |
| Crew instructions | "SETUP + TAKEDOWN" | `summary.step_count` steps | PDF **and** .md, side by side |
| Audit trail | "EVERY CHECK CITED" | the tier ledger's `checked` count | PDF |

Each card's actions are one bottom-anchored row, so every card's first button shares
one top and one bottom edge. Any note — a 400's message, the unsaved-edits line —
prints *above* that row, so the edge never moves.

**The quantity line is always present at its own height.** A null quantity leaves it
empty; it is never "…" or "—". A failed breakdown prints the honest words "not
generated" on every card and withholds every download.

**States per button:**

- **sandbox** — a POST to `/api/render/{kind}` with the live scenario. A 400's
  user-facing message is extracted from `detail.message` (it names the specific
  taper length or speed the operator must satisfy) and the button relabels to "Try
  again". The error is stamped with the scenario it was for, so it stops rendering
  the moment that scenario is edited.
- **saved, clean** — a row-backed `<a href download>`.
- **saved, dirty** — the anchors give way to disabled buttons plus the note "Unsaved
  edits — Save to download the plan on screen. The saved copy no longer matches it."
- **signed out** — a single "Sign up to download …" link to `/app`.
- **locked** — disabled under the write lock; anchors take `aria-disabled` and
  `tabIndex -1`, since an `<a>` has no `disabled`.
- **audit card, no settled audit** — the quantity is null and the button is
  disabled. An audit that has not answered has no PDF.

The audit PDF is deliberately a full card with a full button; it used to be a mono
text link inside a collapsed tier. It is **not** in `BUNDLE_PART_KINDS`, so the
"files ready" count is unaffected by it.

**Open issues:** #203 (saved-mode download anchors navigate to raw "Render failed"
text on error, and `/api/plans/[id]/audit-pdf` is dead code); #264 (the Audit PDF
button is under a 32 px hit target).

## Quote panel

**Code:** `PricingCard.tsx` wrapping `QuotePanel.tsx`.
**User:** estimator. **Step — none.** **Appears:** when results are visible.

**Collapsed (default).** One line: a caret, "Pricing quote", the FYI framing "FYI ·
contractor estimate — not a permit fee", and on the right either the last previewed
backend total as currency, or the explicit unset note "expand to configure &
preview". **No mock estimate ever renders.** The head is `data-read`, so it expands
under the lock.

**Expanded.** The full quote panel in embedded dress. The panel **stays mounted while
collapsed** (hidden attribute), so its preview and edit state survive collapse
cycles.

**Eight inputs:** Duration (days), Flaggers, Delivery (mi), Overhead (%), Profit (%),
Flagger ($/hr), TCS ($/hr), Crew ($/hr). All settings are owned by the shell, not
this component, so the card unmounting across reopen → regenerate cycles cannot wipe
edited rates.

**Two auto-fill behaviours, each with a manual-override guard held in the shell:**

- **Flaggers** prefills from the layout — two for manual flagging, zero when AFAD
  replaces them, zero for every non-flagger kind. Once the operator types their own
  number the sync stops, until a kind switch re-arms it.
- **Delivery distance** resolves from the pin via `/api/distance`. Its states are
  `idle`, `resolving`, `auto` (with the miles), `manual`, `error`. A manual distance
  survives a remount and is never auto-overwritten.

**Two actions:**

- **Preview breakdown** — POSTs scenario plus settings to
  `/api/render/quote-breakdown` and renders equipment, labor and delivery line
  groups, night multiplier, overhead, profit and a "Total estimate" figure.
- **Download Quote (XLSX)** — POSTs the same body to `/api/render/quote`. In saved
  mode it becomes a row-backed anchor; dirty, a disabled "Save to download the
  edited plan"; signed out, "Sign up to download Quote".

**The staleness contract.** The previewed breakdown is stamped with the exact
settings and scenario objects the POST was built from. It renders as current only
while both are still the objects on screen; any edit replaces one of them and the
figures give way to an explicit note — "Inputs changed / The previewed figures were
computed for earlier inputs and no longer apply. Preview again for current totals."
The collapsed card headline clears at the same moment, so it can never show a figure
the panel has disavowed. The XLSX download reads live settings at click time, which
is what keeps the screen and the file from disagreeing.

**Open issues:** #202 and #194 are workbench-only (the saved quote settings are never
persisted, and the workbench panel renders eight dead rate inputs with a false "Auto
· 0 from layout" caption). #204's launch-prep trigger holds a QuotePanel warning.

## Context block and draft notice

**Code:** inline in `GeneratorShell.tsx`, below Zone 2 and above Zone 3.
**User:** everyone. **Step — none.** **Appears: in every stage.**

Three elements, deliberately relocated **below** the results zone because on load
they held 550 px of preamble above the pick CTA:

1. An intro paragraph: "Generate a CDOT-compliant MHT package: PDF plan sheet, device
   list, and crew instructions. Every dimension cited to MUTCD or CDOT standards."
2. **Draft notice** — an amber left-rule block: "Draft — not a sealed plan / Output is
   engineering reference. Requires review and seal by a licensed Professional
   Engineer prior to field use."
3. The read-only jurisdiction context bar.

## Jurisdiction context bar

**Code:** `JurisdictionContextBar` in `JurisdictionSection.tsx`.
**User:** reviewer. **Step — none.**

A **read-only** three-cell summary of choices made elsewhere. It carries no dropdown,
no pills and no Confirm, specifically so it never reads as a dead control above the
input it depends on. The interactive versions live in the Location step pre-generate
and the setup strip post-generate.

**Cells and their states:**

- **Jurisdiction** — the evaluated block's name, authority, and the terms it uses
  ("calls this plan a *{tcp_term}*, the ROW *{row_term}*"); a skeleton line while
  loading **or** while a key is selected but its block has not arrived (so it never
  flashes "Not set" for a chosen jurisdiction); "**Not set** · MUTCD + Colorado
  Supplement only." otherwise.
- **Street classification** — the class label, or "◌ Not set — choose it in Setup".
  Appends "· {jurisdiction} classifies via its published map" when the jurisdiction
  requires a class.
- **Governing spec chain** — the chain segments separated by ›, with the last segment
  marked local when a jurisdiction is set and a note, "local override rendered last &
  strongest". A skeleton while loading.

Every slot has a **reserved height**, because name and chain vary by jurisdiction and
the bar must not resize on selection.

## Section 03 — tiered reference

**Code:** `TieredReference.tsx`. **User:** reviewer, primarily. **Step — none.**
**Appears:** whenever a jurisdiction block exists, a jurisdiction key is set, results
are showing, **or** the audit errored — the last so the strip's "retry from the audit
trail panel below" always lands on a panel that exists.

**Header:** a section label reading "{jurisdiction} — jurisdiction rules" or "Plan
reference", a provisional badge when the jurisdiction's record contains provisional
facts, and the line "informational · sourced corpus · never blocks generation".

**The refresh cue** sits in its own reserved-height slot: "◌ previous answer —
refreshing…" while a refetch holds the previous answer on screen, nothing otherwise.
The old always-on ledger line was deleted — it restated every chip's count, and while
refreshing it said "◌ checking…" beside chips still holding their numbers. The chips
are now the one voice.

**Five tier chips**, each rendering only when it has a body:

**▲ Changed this plan** — auto-expands when non-empty. Holds fired jurisdiction
deltas, site adjustments that added or moved devices, and an applicable Fines Double.

**⚠ Needs attention** — auto-expands when non-empty. Holds, in order: the audit
declined/failed banner (with a Retry button, or, when declined, the line "Audit trail
unavailable while generation is declined — see the notice above", and when throttled,
the 429 wording); work hours outside the window; conditional and needs-input deltas;
personnel gates; device mandates; failed Colorado checks; and an accordion of the
site-scan not-checked item, corridor validation, geometry validation and signalized
approaches.

**✓ Checked & passed** — collapsed. Its summary is the ledger's checked count plus
"each cited". Holds the scope chrome ("Every calculation is traced to its MUTCD or
CDOT standard-plan source. Verify before stamping." and "Scope: federal MUTCD + CDOT
standards (S-630-1). Other jurisdictions may impose additional requirements not yet
captured."), the per-kind trace accordion, passing Colorado checks and info rows, a
named corridor-clean pass, advisory site adjustments, and one row per
scanned-and-absent condition. A first load shows "Computing audit trail…" here.

**◌ Pending / not verified** — collapsed, its own tier, never buried. Holds the
pending-verification items and an unknown hours verdict.

**i Reference** — collapsed, **uncounted**. Its summary lists what is inside rather
than a number: "permit · hours windows · device schedule · hazard meters". Holds the
hazard chip, administrative deltas, the work-hours card, the permit FYI, the moot
operator corrections and keyless scan buckets, and the device schedule. It
auto-expands on a breakdown error so the Retry inside is never hidden.

**Signposts.** Section 03 **discloses and never writes**. A condition row carries a
read-only signpost link — "Correct in setup ↑" on a detected or corrected row,
"Assert in setup ↑" on a scanned-absent row — that jumps to the corrections block in
the setup strip, where the write actually lives. A test asserts these rows contain no
buttons.

**Plan details — device schedule** (`DeviceBreakdown.tsx`, inside the Reference
tier). A collapsed chip whose summary carries the backend counts ("N device types · N
total units"). Expanded, a four-column table — Device type, MUTCD code, Function,
Qty — where rows a jurisdiction added carry a JR tag with the source document on its
title, never distinguished by hue alone, above an explanatory line. **Error states:**
declined ("Device schedule unavailable while generation is declined — see the notice
above", **no Retry**, because retrying an unchanged input re-earns the same 400);
throttled ("paused: too many updates in the last minute"); failed (the message plus a
Retry). An error auto-expands the chip.

**Open issues:** #235 (a consistency round over the reference section and its
disclosure footnotes); #243 (a Colorado check counts site-adjustment signs and fails
on sidewalk/bike detections); #266 (the audit PDF's Colorado heading hard-codes
S-630-1); #28 (the audit response sections are untyped `Record`s).

## Footer

**Code:** `AppFooter.tsx`. **User:** everyone. **Step — none.**
**Appears: in every stage.**

One row, mono micro-caps, wrapping on narrow viewports. Left: "© 2026 Conestruct ·
Built in Colorado". Right: a Terms link, a Privacy link, and the standing disclaimer
"Output requires TCS review · Not a substitute for licensed judgment". Route links,
so they carry neither `data-write` nor `data-read` and never lock.

A second, near-identical `Footer.tsx` exists for the marketing pages and does not
render on `/sandbox`.

**Open issues:** #264 (footer links under a 32 px hit target). The legal posture is
recorded separately: `/terms` and `/privacy` are placeholders pending review.

## Announcement region

**Code:** the `role="status" sr-only` div in `GeneratorShell.tsx`.
**User:** screen-reader users. **Step — none.**

Visually hidden, persistently mounted. Speaks once per armed Generate, at the pair's
settle, and only when the stamped audit is clean: "Plan generated — N devices, N
types." (or "Plan generated — MHT package ready." when the counts are absent).
Cleared at the click so a repeat Generate with identical counts still announces. A
declined pair consumes the arming **silently** — the refusal container is a
`role="alert"` and speaks for itself.

## Debug snapshot button

**Code:** `DebugSnapshotButton.tsx`. **User:** developer only. **Step — none.**

Renders nothing without `?debug=1`. Marked TEMPORARY in the source. POSTs the wire
scenario, the settings and the last picker classification to
`/api/replication-snapshot`.

**Open issues:** #244 — it posts `scenario` rather than the wire scenario, so its
site-scan projection always reads `not_run`.

---

# Cross-cutting behaviours the redesign inherits

These are not surfaces, but every surface is shaped by them, and a redesign that
ignores them will reintroduce defects that were fixed with evidence.

**The stage machine.** `genState` is `pre` (Generate not yet clicked — Zone 1
dominant, Zone 2 empty), `generating` (clicked, breakdown in flight), `post`
(breakdown ready — Zone 2 dominant), or `error` (breakdown failed — Zone 2 stale under
a red ribbon). Three derived flags matter as much: `regenerating` (a re-generate with
prior results to hold — dims and refreshes **in place** rather than unmounting,
because unmounting destroyed panel-local state and punished the designed
post-generate edit path), `planDeclined` (the stamped 400 — the audit's verdict gates
the results, never the breakdown's arrival), and `stagedDisclose`.

**Two fetches, one debounce.** Every scenario change fires `/api/render/audit` and
`/api/render/device-breakdown`, both debounced at 350 ms leading-and-trailing against
two 30/min/IP rate buckets — before the debounce, a slider drag self-DOSed the app
into VERIFICATION UNAVAILABLE for the rest of the minute. A single Retry refires
**both**, deliberately, so the two panels' timestamps stay aligned.

**Answer stamps.** Every asynchronous answer carries the scenario object it was
computed for, compared by identity (every writer spread-replaces). A verdict never
renders for an input the backend has not seen — including during the debounce's
deferred window. Content surfaces may hold the previous answer under an explicit cue;
**a verdict may not.**

**Stale-while-revalidate, split by kind.** The audit keeps its previous content
visible under a "(refreshing…)" cue during loading only; on an audit *error* the trail
blanks its values rather than render a prior input's numbers under a failure banner.
The device breakdown carries its previous answer through a refetch but drops it on
error — after a failure there is no last-known-good.

**The wire scenario.** Generate is a stage flip; what changes is what the loop
*sends*. Once generated, every request carries `site_scan`, so the backend scans the
corridor inside generation. Reopen drops the flag.

**The post-generate landing.** The results populate above the Generate button's
viewport position, so a landing scroll is armed per click and verified after it
settles, re-issued at most twice, with a 4 s deadline, disarmed the instant the user
scrolls, touches or presses a navigation key. A correction that fires once the answer
has settled is instant rather than animated. A failed generation does **not** yank the
viewport — except a declined pair, which is a settled answer with two actions and
lands like a successful one.

**Focus.** Programmatic focus moves only on armed user actions — Generate lands focus
on the results zone, Reopen on the Setup zone, a rail or chip click on the target
header. Background re-renders never move focus. Every programmatic target is
`tabIndex={-1}` and out of the Tab order.

**Glyph vocabulary, used consistently across every surface:** ✓ confirmed or passing ·
⚠ needs attention · ▲ changed this plan, or work the operator owes · ◌ unevaluated,
not set, pending — never a verdict · × dismissed · i reference · ◈ personnel · ▮
device mandate · ▤ device schedule. No signal is ever carried by hue alone; a glyph
always travels with a word.

**Absence renders as absence.** A bucket missing from the wire renders nothing. A
value nobody set renders "—" or "Not set", never a guess. A response carrying no
verdict produces no derived verdict. This is the most load-bearing rule in the
product, and it is why several surfaces have an explicit "unavailable" state where a
redesign would naturally reach for a placeholder.
