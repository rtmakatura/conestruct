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
