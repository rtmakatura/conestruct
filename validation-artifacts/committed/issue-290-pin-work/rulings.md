# issue-290-pin-work — the rulings this arc is built under

**Issue:** #290 — "Direction A Phase 3 — the work segment, pin = work start".
**Phase:** 3 (of #281 Direction A). **Sub-issues:** #284 (proposed kind), #285 (nearest-intersection
tag), #291 (Lookout Mountain — the road-tag direction).

**Base:** `6fe391e` (= `main` = `origin/main` = prod `healthz` at the time of this commit,
2026-09-25).

This file is the arc's authority: every commit on this branch cites it. Filed as this arc's
**first** commit, per the per-arc rulings convention adopted 2026-09-16.

**What this file holds at the checkpoint.** #290 has not been ruled yet — the checkpoint
(`checkpoint.md`, committed next to this file) is what Ryan rules on. So the sections below
are what #290 **carries in**: its own body (gate, scope, acceptance) and FLOW.md §5a's ruled
model and guardrails. Ryan's ruling on the checkpoint appends to this file as "The ruling,
verbatim", and nothing is built until it lands.

---

## #290's body, verbatim (fetched 2026-09-25; 0 comments)

> ## Problem
> Phase 3 of #281: pin = work start, the proposed kind, the nearest-intersection tag, the
> aerial growing the approaches. Backend-first; opens with the scenario version field; gated
> on #256. FLOW.md §9 calls it the biggest change made to date; it is the fix for the demo's
> second failure ("the pin marks the work", P21). Part 1 §4 specifies the five moves.
>
> ## The gate, precisely
> Gated on #256's pre-scan-on-confirm lever (lever 2), not on #256's refusal rate. The
> s2-arc31 investigation found and measured the mirror-chain cause; it did not build the
> pre-scan. Until it lands, the tag prints the road name with lat/lng in provenance — the
> ruled interim and the permanent fallback. #279 is a second input: the proposal reads the
> classification.
>
> ## Scope
> The scenario version field first (a model change this size is versioned before anything
> reads it) · the proposed-kind producer · the nearest-intersection tag · the aerial growing
> the approaches (§4, §8.19) · the modal migration continuing piece by piece (ruling 189;
> each piece named, §8.40).
>
> ## Acceptance
> - Every S2 state measured on prod at both widths.
> - The pin marks the work; the operator sees what it means without inferring.
> - The version field exists and is read first.
> - A proposed kind renders only from a producer; never sets the kind.
> - The tag names a cross street only from a bucket; otherwise the road name.
> - The pre-scan is a read.
> - Each migrated modal piece named before/after.
> - Backend-first; every wire field enumerated across senders; every threshold traced or
>   CHOSEN.
> - Ryan hand-check.
>
> ## Reference
> #281 "The phases" 3; the proposed-kind and nearest-intersection rulings; Part 1 §4,
> §8.18–§8.20, §8.40 · FLOW.md §5a, §9 · #256 lever 2 · #279 · #234. Absorbs the
> proposed-kind and nearest-intersection issues. Requires Phase 0, Phase 2, and the pre-scan
> lever. Refs #281

---

## FLOW.md §5a, the ruled model, verbatim (FLOW.md lines 48–69 at `6fe391e`)

> ### 5a. The pin is the wrong pin — and the fix is a segment, not a point
> Today the pin marks where the *advance warning* begins, and the corridor (advance warning →
> taper → buffer → work zone → downstream) is laid out from there along the bearing. The
> user's mental model is the opposite: they know where the *construction* is.
>
> **Ruled 2026-09-15 — the model:** the work is a **segment on a road, with a side.** The pin
> marks where the work starts; a length (typed) or a second point (tapped) sets where it ends;
> the side or lane says what is occupied. The system lays out the approaches — advance
> warning, taper, buffer — upstream of the work in every direction of travel that reaches it:
> one for a shoulder job, one at each end for a flagger job. Direction is derived from the
> road and the side, never typed. The aerial overlay draws the work first, then the approaches
> growing out from it.
>
> **The user's five moves:**
> 1. *Find the spot.* Type an address or a cross-street pair, or drop a pin. The system finds
>    the road and names the nearest intersection — the way every 811 ticket and every crew
>    describes a location.
> 2. *Mark where the work starts.* One tap on the road, snapped to the centerline: "Work
>    starts here · 210 ft N of W 38th Ave."
> 3. *Set the extent.* Type a length, or tap a second point. The work segment appears
>    highlighted on the aerial with its length labelled. The user sees *their work* before
>    anything else.
> 4. *Say which side.* Shoulder, lane, or both directions — as a tap on the aerial **and** as
>    a plain control that writes the same field (phones use the control now, the tap later).
>    The tap *proposes* the kind; the user confirms it ("Looks like a shoulder closure —
>    right?"). Only live kinds are offered.
> 5. *See the plan grow.* The approaches render around the work. Generate.
>
> **Rulings that bound the build (the re-audit, 2026-09-15):**
> - The kind is confirmed, never inferred (Rule 8, suggest-never-set). The aerial offers only
>   enabled kinds.
> - One producer for the extent: the wire carries start + length along the road; the tap and
>   the length box are two controls writing that one field (P2).
> - The scan fix (#256) lands first: approaches at both ends roughly double the scan bbox on a
>   flagger job, and the "nearest intersection" label at pin-drop needs the scan's
>   intersection bucket before Generate — the pre-scan-on-confirm lever becomes a dependency.
> - **A scenario version field lands first, as its own commit** (`anchor_semantics` or a
>   schema version), so no saved plan or fixture can silently mean something ~2,300 ft
>   different from what it meant when recorded (Rule 10).
> - Near-intersection detection reuses the existing 250 ft relevance threshold (CHOSEN in the
>   scan); no second number (Rule 12).
> - The typed bearing field retires deliberately (Rule 5); the #214 disclosure sentence and its
>   byte-identity pin retire with it.
> - Mobile operations have no fixed segment; the model keeps a place for start + direction
>   without designing it now.

And FLOW.md §7's decision (line 86), verbatim:

> **Pin model: the pin marks where the work starts; the system lays the advance warning
> upstream.** One pin, one bearing, the same aerial overlay — the anchor moves from the first
> sign to the work. This is a backend change (Rule 3, P21): the corridor is laid out backward
> from the pin along the approach direction, and every consumer of the anchor (the scan bbox,
> the corridor check, the drawing, the deliverables) follows. Research first: what the anchor
> currently means in `build_corridor`, every reader of it, and what "upstream" means on a
> one-way or divided road.

**One note on the brief's guardrail 7.** The brief asks whether #214's disclosure "retires with
[the bearing field] or moves — say which". FLOW.md §5a already rules it: it **retires with**
the typed bearing field, together with its byte-identity pin. The checkpoint treats this as
ruled and does not re-open it.

---

## The ruling, verbatim (Ryan, 2026-09-25, on `checkpoint.md` at `1f6a3b4`)

> Checkpoint shipped; the backwards-corridor defect is filed (I'll give you its number).
> Rulings, all as recommended:
> 1. Corrected premise accepted: today's pin is corridor_end, measured on prod.
> 2. No interim flip; this arc fixes the defect behind the version field.
> 3. Version field old value = corridor_end.
> 4. The nearest-intersection tag gets its own lookup in its own arc; #290 no longer waits on
>    the pre-scan. Re-scope #285 by comment (draft it for me as text).
> 5. The north-up scan box (~3× waste on diagonals) is its own issue — draft it for me as text.
>    Not this arc.
> 6. The "Work starts" label shipped in #289 over the unchanged model is recorded as a P21
>    violation that this arc makes true.
> 7. Cut (a): anchor moved in build_corridor; each approach's geometry returned by the backend,
>    never sent on the request.
> 8. Side control: the road's two edges in compass words ("East side · northbound traffic");
>    backend derives direction from the confirmed road + side, honouring the one-way tag. It is
>    the plain control phones use; the aerial tap comes later.
> 9. Flagger "start" = the upstream end for the closed lane's traffic.
> 10. Pre-change plans and fixtures open with side unset, marked needs-you; never silently
>     re-read. Lookout Mountain re-records on the centerline.
> If any of your nine questions isn't answered by the above, list it before building. Record
> all of it in rulings.md. Then build per the checkpoint's sequence, version field first,
> backend-first, each ship naming its visible change. Stop at the first ship.

### How the ruling maps onto the checkpoint's nine questions

| checkpoint question | ruled by |
|---|---|
| 1 premise (pin = corridor end; version literal) | rulings 1, 3 |
| 2 file the mirror, no interim flip | ruling 2 (filed; **number to come**) |
| 3 option (a), per-approach geometry in the response | ruling 7 |
| 4 side control (two enums, compass words) | ruling 8. **Two parts not ruled**, listed below. |
| 5 flagger "start" | ruling 9 |
| 6 v1 under v2 | ruling 10 |
| 7 gate re-scope, #285 its own lookup | ruling 4 |
| 8 aerial stays in the modal this arc | **not ruled**, listed below |
| 9 bbox: union of per-approach hulls; box vs strip measured | ruling 5 takes the north-up box out of the arc. **The flagger envelope is not ruled**, listed below. |

Ruling 6 records a violation that none of the nine questions asked about. The P21 "Work starts"
violation (`move-ledger.ts:129`, `band-facts.ts:191`, shipped in #289) is on the record here, and
the arc's visible ship is what makes the label true.

### Open, listed before building (none of them touches the first ship)

1. **Manual mode's direction.** With no confirmed road there is no geometry to derive from.
   - Recommended: ManualFallback's typed "Bearing (° from N)" (`ManualFallback.tsx:78-97`) is
     replaced by a coarse four-way choice ("traffic heads N / E / S / W"), labelled coarse.
   - Needed by the visible ship.
2. **The left edge.** The layout models only the right side (`layout.py:118-152, 224-230`).
   - Recommended: the side control offers only the edges whose occupied side is the right side
     of that traffic. A left-side / median choice renders gated (Rule 8), named, not built.
   - Needed by the visible ship.
3. **The aerial.** Recommended: it stays in the picker modal this arc, redrawn work-first with
   the approaches after the side is confirmed (rules 110–112). Its migration onto the band is
   the next arc. Needed by the visible ship.
4. **The flagger's scan envelope.** Ruling 5 takes the north-up box out of this arc. The
   flagger's second approach still has to be scanned: today about 1,150 ft of it is unscanned
   at 45 mph (checkpoint (c)).
   - Recommended: the scan bbox becomes the union of the per-approach hulls, in today's box
     shape.
   - The box-vs-strip measurement (checkpoint (k) commit 5) moves to ruling 5's issue.
   - Needed by the backend corridor commit (checkpoint (k) commit 3).

### The build order under this ruling

The checkpoint's (k) sequence holds, with two changes:
- commit 5 (the box-vs-strip measurement) leaves this arc under ruling 5;
- #285's lookup is its own arc under ruling 4.

**First ship = checkpoint (k) commits 1 + 2: the version field, backend then senders.**
- `ScenarioMeta.pinModel`, where an absent value is `corridor_end` (ruling 3).
- Read first; `work_start` is refused honestly until the v2 corridor lands.
- Echoed in the audit and the replication snapshot.
- Every sender carries it.

Visible change: none.

---

## The ruling on the four open points, verbatim (Ryan, 2026-09-25, after the first ship `f47d3b7`)

> Shipped. The backwards-corridor issue is #298 — cite it. The #285 comment is posted and the
> bbox issue is filed (number to follow). Rulings on the four open points, all as recommended:
> (1) manual mode's direction is a four-way choice, "traffic heads N / E / S / W", replacing
> typed degrees; (2) left and median edges show greyed out, named but not built; (3) the aerial
> stays in the picker modal this arc, redrawn work-first with approaches after the side is
> confirmed; (4) the flagger's second approach is scanned by combining one box per approach in
> today's shape. Record in rulings.md, then continue the build sequence. Stop at the next ship.

**Now on the record:**
- **The shipped mirror is #298.** Every commit that fixes part of it cites it.
- **The #285 re-scope comment is posted**, and the north-up box issue is filed (number to come).
- **All four open points are closed:**
  - manual mode: a four-way heading;
  - left and median: gated, named, not built;
  - the aerial: stays in the modal, redrawn;
  - the flagger scan: a union of per-approach boxes.

**Next ship = checkpoint (k) commits 3 + 4, backend-only.**
- The work-start corridor behind `pinModel == "work_start"`: the work start, the side and travel
  fields, the backend-derived direction, the approach list, the per-approach scan boxes, and the
  per-approach geometry in a response.
- Then the fixtures' v2 twins, with the single-leaf proof first.

Visible change: none. Nothing sends `work_start` until the frontend ship.

---

## The ruling on the pre-side picker, verbatim (Ryan, 2026-09-25, after the second ship `aab8caa`)

> Shipped. The bbox issue is #299 — cite it where the north-up box is referenced. Ruling on the
> one question: before the side is confirmed, the picker draws the pin and the sentence "Say which
> side is occupied to lay out the work" — no segment, and no direction-free circle, because a
> shape without a direction is a guess at the plan (P16, Rule 10). Record it and build the
> visible frontend ship. Stop there with the verdict, the file table, what I'll see on the
> screen, and the ship line.

**On the record:**
- **The north-up scan box is #299.** It is referenced in checkpoint (e), ruling 5 and the
  open-points ruling 4, and is not this arc's.
- **Before the side is confirmed, the picker draws the pin and exactly:**

  > Say which side is occupied to lay out the work

  Nothing directional is drawn, which matches the backend's `/render/corridor-geometry` status
  `side_not_confirmed` (no work segment, no approach).

**The visible ship = checkpoint (k) commit 6:**
- the pin marks the work;
- the side control on the band;
- the typed direction retired;
- the overlay drawn from the backend's geometry;
- the pre-change plans opening with the side unset.

---

## The hand-check on prod, verbatim (Ryan, 2026-09-25, after the visible ship `659d800`)

> Hand-check on prod, N Broadway southbound (way 1329434113), side chosen:
>
> 1. DEFECT — the picker draws nothing after the side is confirmed. CORRIDOR EXTENT is empty and
> the aerial has no work segment or approaches. That is the visible point of #290 and #298.
> Reproduce on prod first, find why (does the modal know the side? does /render/corridor-geometry
> get called and with what? what does it return?), fix it, and prove it with a prod screenshot of
> this pin showing the work at the pin and the advance warning north of it.
> 2. The side control drops the greyed "median side — not built yet" option entirely. An option
> the user can't choose, named in jargon, is noise (P13, P18); record it in rulings.md as
> superseding ruling 2 of the four open points. The buildable sides stay.
> 3. The side control's selected state takes rule 135's chip treatment — accent border, the wash,
> a ✓ — so the choice is visible. Fix the spacing between options.
> 4. The picker's subtitle no longer mentions setting the length.
>
> Stack all four on one branch; one verified commit each; stop with the verdict, the file table,
> the prod screenshot from item 1, and ONE ship line. Also check the flagger case draws both
> approaches on prod before you stop.

**On the record:**
- **This supersedes the open-points ruling 2** ("left and median edges show greyed out, named but
  not built"). The side control offers only the sides a plan can be built for. A left or median
  edge is not offered at all, greyed or otherwise: "an option the user can't choose, named in
  jargon, is noise (P13, P18)". The backend's `_side_options` stops emitting them, and the band
  renders only `built` options. The `built` field stays on the wire for the day a left-side
  layout is built.
- **The way id.** The hand-check names way 1329434113. The prod probe at the same pin detected
  "NORTH BROADWAY SOUTHBOUND" as way **131232822** (`validation-artifacts/committed/
  issue-290-picker-draws/repro-prod/`), and the fix is proven on that way.
- **Item 1's cause** is recorded with its evidence in
  `validation-artifacts/committed/issue-290-picker-draws/README.md`.
