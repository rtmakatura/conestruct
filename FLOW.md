# FLOW.md — what Conestruct is for, who uses it, and what a session looks like
*Drafted 2026-09-14 after the James/Zac demo. This is the document every screen is designed against. It did not exist before; every surface shipped so far was built from a complaint about a surface that already existed. Rules and principles (CLAUDE.md, DESIGN-PRINCIPLES.md) say how a screen must behave; this says what a screen is for.*

## 1. Who sits down at this

Two primary users. Both are producing an MHT (a traffic-control plan package) for a specific job, and neither is a traffic engineer.

**The field sales rep.** On site or just back from it, on a laptop or phone, needs an impromptu MHT to attach to a bid today. Knows where the work is. Does not know MUTCD. Wants: a defensible plan, fast, with a price. Will not read reference material.

**The office estimator.** At a desk, building a draft or a point of reference for a quote. Knows the job from a description or a set of coordinates. More patient than the rep, still not an engineer. Wants: a plan that will survive review, a device count that drives the number, and the ability to come back and adjust deliberately.

Secondary, later: the TCS who stamps it (reads the audit), the crew who sets it (reads the crew sheet). They read deliverables, not the screen.

**Consequence:** the screen serves the rep and the estimator. The TCS and crew are served by the PDFs. Anything on the screen that exists for the TCS is a candidate to move into the audit PDF or behind a disclosure.

## 2. What a good session is

Pin to signed plan in a few minutes. Then, optionally and later, come back and go deeper into any part.

Concretely: drop a pin, confirm the road, say what the work is, generate, glance at what the system flagged, download. Five decisions or fewer on the happy path. Every other decision is available, none is forced.

The second visit is different: the plan exists, something needs changing, the user wants to change exactly that thing and nothing else, deliberately, and see what it did to the plan.

**Consequence:** there are two modes with different shapes — *first pass* (linear, few decisions, momentum) and *revision* (non-linear, one deliberate change at a time, visible consequence). Today the screen has one shape for both.

## 3. The steps of a first pass, and what each needs

| step | the user's question | what they must see | what they must decide | what they can ignore |
| --- | --- | --- | --- | --- |
| 1 Where | "Is this the right spot?" | the map, the pin, the road the system found, the corridor drawn over the aerial | confirm the road (and its direction) | classification detail, provenance tokens, bearing math |
| 2 What | "What's the job?" | kind of work, length, speed, lanes — prefilled from the road | the kind; the length; anything the system guessed wrong | everything the system got right |
| 3 Go | "Is it working?" | one busy signal | nothing | everything |
| 4 Look | "Did it work, and what does it want from me?" | the verdict; the two or three things that need a human; the counts that drive the price | dismiss/assert/confirm the flagged things, or accept | every check that passed |
| 5 Take | "What do I hand over?" | the files, clearly named, one click each | which files | how they were made |

**Consequence:** step 4 is where the design is failing hardest. Today it shows every check the system ran, tiered, as walls of text. The user's question is "what needs me" — the answer is usually two or three items, and everything else should be one click away and labelled as "passed, N items".

## 4. What each zone is for — decided, not inherited

- **Setup** is for steps 1–2. It shows what the plan will be built from, prefilled, with the guesses marked. It is not a reference surface.
- **Results** is for steps 4–5. It leads with the verdict and what needs the user, then the counts, then the downloads. It is not a log.
- **Reference** is for the second visit and for the TCS. It holds every check, every citation, every provenance line, in full — behind a disclosure, with a summary line ("41 checks · 38 passed · 3 need you" ) and nothing else visible by default. It is not step 4.

The next-steps strip (#253) is the right idea for step 4 and currently sits on top of a zone that contradicts it.

## 5. The two findings from the demo

### 5a. The pin is the wrong pin — and the fix is a segment, not a point
Today the pin marks where the *advance warning* begins, and the corridor (advance warning → taper → buffer → work zone → downstream) is laid out from there along the bearing. The user's mental model is the opposite: they know where the *construction* is.

**How a job actually arrives** (researched 2026-09-14 — Colorado 811 locate tickets, Denver DOTI and Maricopa permit applications, Tacoma's traffic-control handbook, Portland's "workspace diagram"): three parts, always in this order — *where the work is* (an address, or a distance and direction from the nearest intersection), *how big it is* (length, width, which side or lane), *when*. The traffic control around it is never part of the input; it is the output. Portland's DOT formalises exactly this: the contractor submits a drawing of the work zone dimensions only, and the reviewer matches it to a standard plan.

**Ruled 2026-09-15 — the model:** the work is a **segment on a road, with a side.** The pin marks where the work starts; a length (typed) or a second point (tapped) sets where it ends; the side or lane says what is occupied. The system lays out the approaches — advance warning, taper, buffer — upstream of the work in every direction of travel that reaches it: one for a shoulder job, one at each end for a flagger job. Direction is derived from the road and the side, never typed. The aerial overlay draws the work first, then the approaches growing out from it.

**The user's five moves:**
1. *Find the spot.* Type an address or a cross-street pair, or drop a pin. The system finds the road and names the nearest intersection — the way every 811 ticket and every crew describes a location.
2. *Mark where the work starts.* One tap on the road, snapped to the centerline: "Work starts here · 210 ft N of W 38th Ave."
3. *Set the extent.* Type a length, or tap a second point. The work segment appears highlighted on the aerial with its length labelled. The user sees *their work* before anything else.
4. *Say which side.* Shoulder, lane, or both directions — as a tap on the aerial **and** as a plain control that writes the same field (phones use the control now, the tap later). The tap *proposes* the kind; the user confirms it ("Looks like a shoulder closure — right?"). Only live kinds are offered.
5. *See the plan grow.* The approaches render around the work. Generate.

**Rulings that bound the build (the re-audit, 2026-09-15):**
- The kind is confirmed, never inferred (Rule 8, suggest-never-set). The aerial offers only enabled kinds.
- One producer for the extent: the wire carries start + length along the road; the tap and the length box are two controls writing that one field (P2).
- The scan fix (#256) lands first: approaches at both ends roughly double the scan bbox on a flagger job, and the "nearest intersection" label at pin-drop needs the scan's intersection bucket before Generate — the pre-scan-on-confirm lever becomes a dependency.
- **A scenario version field lands first, as its own commit** (`anchor_semantics` or a schema version), so no saved plan or fixture can silently mean something ~2,300 ft different from what it meant when recorded (Rule 10).
- Near-intersection detection reuses the existing 250 ft relevance threshold (CHOSEN in the scan); no second number (Rule 12).
- The typed bearing field retires deliberately (Rule 5); the #214 disclosure sentence and its byte-identity pin retire with it.
- Mobile operations have no fixed segment; the model keeps a place for start + direction without designing it now.

### 5b. Deliberate revision after generation
The estimator submits a draft, comes back, wants to change one specific thing and see what it did. Today: "Edit full setup" reopens everything; inline strip editors commit on blur and regenerate (#262 open); corrections stage and apply (#254, shipped). Pieces exist; there is no *revision mode* — no "I am changing this one thing, show me the diff, then I'll accept."

What revision needs: pick a field, change it, see the before/after on the plan (device count delta, verdict delta), apply or discard. The staged-corrections pattern from #254 is the template — stage, disclose, apply once — **generalised once at the shell, never rebuilt inside each editor** (P11, the re-audit).

## 6. What this changes about the queue

- **Keep going:** #256 (backend, blocks measurement), #279, #243, #265 (value correctness — the plan is wrong regardless of layout).
- **Hold:** #272, #280, #264, #235, #259, #262 — polish or layout on surfaces this document may redraw.
- **New, ahead of the UI queue:** the pin-model research (5a), the revision-mode design (5b), the step-4 redesign (results leads with "what needs you").

## 7. Decisions (Ryan, 2026-09-14)
- **Phone is a priority, not yet a target.** The redesign is built so that mobile optimisation later is straightforward: 380 px is measured on every arc as it is today, the layout must degrade honestly rather than break, and no surface may assume a wide viewport in its structure. First-class phone work (touch targets, stacking design, #153) comes after the flow redesign lands.
- **Price is part of the first pass.** The quote is step 5 — it sits with the downloads, not in Reference. The rep leaves with a number.
- **The TCS reads the screen and the PDFs.** Reference survives on screen, in full, behind one disclosure with a summary count (P19); the default view still leads with what needs the user (P18). The TCS opens the disclosure; the rep never has to.
- **Pin model: the pin marks where the work starts; the system lays the advance warning upstream.** One pin, one bearing, the same aerial overlay — the anchor moves from the first sign to the work. This is a backend change (Rule 3, P21): the corridor is laid out backward from the pin along the approach direction, and every consumer of the anchor (the scan bbox, the corridor check, the drawing, the deliverables) follows. Research first: what the anchor currently means in `build_corridor`, every reader of it, and what "upstream" means on a one-way or divided road.

## 8. The design — Direction A, "The Column" (chosen 2026-09-16)
One centred column of bands: exactly one band open (the question being answered, headed by a 22 px step question), every band above collapsed to a one-line fact with a CHANGE link, every band below a dim "pending" line. The verdict strip sits above, always mounted. Generate does not navigate: setup collapses to fact lines and the results form beneath — verdict, NEEDS YOU (the ▲/⚠ tiers, heaviest block on the page), the counts, the four files, then counted disclosures. Revision is the collapse run backward: CHANGE ONE THING re-opens one band in place with a before/after panel whose numbers come from a *preview* (a read — no band, no lock; taper/buffer/spacing/counts only; verdict and needs-you "recompute on apply"). Full spec and every ruling on the Direction A issue.

## 9. What builds first, against this document (reordered 2026-09-15; phased 2026-09-16)
**Phase 0 — foundations, nothing visible:** FLOW.md + DESIGN-PRINCIPLES.md committed (role 5, the palette ruling, P16's sentence); the type-census exception commit (nine sizes, owners); the preview-as-read backend flag; #256 (scan budget, the pre-scan lever); #279 (the classifier).
**Phase 1 — the results stack (Direction A states S5, S6, S8).** Verdict → NEEDS YOU → counts → files → disclosures. Frontend-only. Replaces the results head, the hero's presentation, the cards' header, section 03's presentation. **Re-presents the existing five-tier ledger** (`assignTiers` ⟷ `tier_ledger.py`: changed ▲ · attention ⚠ · checked ✓ · pending ◌ · reference, uncounted) — the ▲/⚠ tiers *are* "what needs you"; the other three fold to counts; no second classifier is built (P2). Frontend-only, no fixture re-baseline, and it is the thing that made the demo painful. Goes first while #256 clears the runway for 2.
**Phase 2 — the band stack (S1–S4) and revision (S7).** Bands, fact lines, CHANGE links, the What grid with per-field provenance, the picker **modal retained** behind the Where band (it migrates piece by piece later — ruling 189). Revision mode with the preview-as-read rule and the reserved status row.
**Phase 3 — the work segment (§5a, S2's move ledger).** Pin = work start, the proposed kind, the nearest-intersection tag, the aerial growing the approaches. Backend-first; opens with the scenario version field; gated on #256; the biggest change made to date.
**Phase 4 — the 380 px arc.** After the shape is stable.
Each phase: Claude Code investigate → checkpoint with P1–P22 → rulings → build → prod → hand-check. The Direction A issue is the design authority for all four.

**Held until these land:** #262, #272, #264, #259, #235, #277 — surfaces the redesign redraws. **Kept going:** #256, #279, #243, #265, #276 — value correctness and one small honesty fix.
