# issue-301-band-aerial — the rulings this arc is built under

**Issue:** #301 — "Picker modal migrates onto the WHERE band piece by piece — the aerial first (ruling 189)".
**Arc:** s2-arc36, piece 1 (the aerial on the WHERE band), and piece 2 (one voice for the corridor
lengths) if it is small.

**Base:** `eed4c29` (= `main` = `origin/main` = the prod `healthz` sha, checked 2026-09-25 at
`https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz`).

This file is the arc's authority: every commit on this branch cites it. Filed as this arc's
**first** commit, per the per-arc rulings convention adopted 2026-09-16.

**What this file holds at the checkpoint.** #301 has not been ruled yet. Ryan rules on the
checkpoint (`checkpoint.md`, committed next to this file). So the sections below are what the arc
**carries in**: #301's own body, ruling 189, and #290's pre-side ruling. Ryan's ruling on the
checkpoint is appended here as "The ruling, verbatim", and nothing is built until it lands.

---

## #301's body, verbatim (fetched 2026-09-25 with `gh issue view 301`; open; 0 comments)

Labels: priority-medium, frontend, type-debt, ux, p2, p11.

> ## Problem
>
> Ruling 189, verbatim: "the modal migration — phased. Phase 2: the Where band owns the aerial and the outcome; the picker modal stays for the decision work (detection, candidates, bearing, cross-street, suggestions), opened from the band. It migrates piece by piece in Phase 3 and after. Nothing in the column's structure depends on the modal being gone." (`validation-artifacts/committed/issue-289-band-stack/rulings.md:40-43`).
>
> Phase 2 shipped the band owning the **outcome** (the move ledger, the extent, the kind, the occupied side), but **not the aerial**. `conestruct/site/components/bands/WhereBand.tsx:10-37` records the deviation:
>
> > It does NOT own the aerial, and that is a deviation recorded here rather than papered over
>
> #290 then kept the aerial in the modal again (open-points ruling 3: "the aerial stays in the picker modal this arc, redrawn work-first with approaches after the side is confirmed"; `validation-artifacts/committed/issue-290-pin-work/checkpoint.md:499`: "Migrating the map … is its own arc after this one"). So today:
>
> - **The laid-out corridor is visible only inside the modal.** An operator who picks a side on the band (move 4) must reopen "Edit on map" to see where the work and the approaches land. The band has no picture of the answer it just recorded.
> - **Two surfaces state the corridor's lengths.** The band's Extent rows come from the audit's `corridor_spec`. The modal's CORRIDOR EXTENT panel comes from `/render/corridor-geometry`. They agree today (one backend), but they are two speakers for one fact (P2).
> - **The modal is still 3,085 lines** (`LocationPickerModal.tsx`): the map, its sources and layers, detection, candidates, road properties, the cross-street pin, the extent panel and the legend.
> - **`lib/corridor-map.ts` builds a Static Images URL for a route that does not exist.** `app/api/corridor-map/route.ts` is absent, as checked on 2026-09-25. It is dead code.
> - **Classification: layout / ownership debt.** No wrong output today; the P2 overlap is agreement-by-construction, not a mismatch.
>
> ## Impact
>
> - **The estimator and the rep** (FLOW step 1) confirm a side on the band blind. The drawing that proves the direction (the whole point of #298's fix) is one modal away.
> - **At 380 px** the modal is a full-screen detour for a glance at the corridor. The band is where the phone user already is (the checkpoint's surface M vs W).
> - **The next dev** touching the corridor overlay edits a 3,000-line modal whose map state cannot be reused by the band.
>
> ## Proposed solution
>
> One piece per PR. Name each piece before and after (checkpoint §(i)'s table form), and keep the modal working until its last piece leaves.
>
> ### Piece 1 — the aerial on the band (the outcome picture)
>
> A read-only aerial under the move ledger, drawn from `/render/corridor-geometry`. It shows the same five channels as the picker and page 2, with the same producer (`src/rules/corridor_layout.py`, P11) and the same pre-side rule: the pin and "Say which side is occupied to lay out the work", no shape.
>
> Options for the image:
> - **(a)** A static-image route (the missing `app/api/corridor-map/route.ts`) built on the page-2 overlay builder, `plan_sheet._aerial_laid_out_overlays`, moved to a shared module.
> - **(b)** A small mapbox-gl view reusing the modal's layer definitions.
>
> (a) is cheaper and phone-friendly. (b) is interactive but pulls map state onto the band. Recommendation: (a) first.
>
> ### Piece 2 — one voice for the corridor lengths
>
> When the band shows the aerial, the modal's CORRIDOR EXTENT panel becomes the band's rows, or the band's rows read the geometry answer. One speaker (P2).
>
> ### Piece 3 onward — the decision work, as ruling 189 orders it
>
> Ruling 189 keeps detection, candidates, bearing, cross-street and suggestions in the modal. Each later piece moves one of them with its own before → after and hand-check:
> - the road candidates;
> - road properties;
> - the near_intersection cross-street pin;
> - jurisdiction and street-class suggestions.
>
> Delete `lib/corridor-map.ts`'s dead anchor code (checkpoint row 26) in piece 1, or migrate it there.
>
> ## Acceptance
>
> - After the side is chosen on the band, the band shows the laid-out corridor with the advance warning upstream of the work (#298's acceptance, on the band). No modal is opened.
> - Before the side, the band's aerial shows the pin and the ruled sentence, and nothing directional (the pre-side ruling, P16 / Rule 10).
> - The band aerial, the picker and PDF page 2 draw from one producer. A test asserts they agree for the N Broadway SB and Lafayette flagger fixtures.
> - Corridor lengths have one speaker (P2).
> - At 380: no horizontal scroll, and the aerial fits the column.
> - The modal still opens from the band, and every piece not yet migrated behaves unchanged.
>
> ## Reference
>
> - `validation-artifacts/committed/issue-289-band-stack/rulings.md:40-43` (ruling 189)
> - `conestruct/site/components/bands/WhereBand.tsx:10-37` (the recorded deviation)
> - `validation-artifacts/committed/issue-290-pin-work/checkpoint.md:463-500` (§(i), the pieces named before → after)
> - `conestruct/site/components/LocationPickerModal.tsx` (3,085 lines)
> - `conestruct/site/lib/corridor-map.ts` (the URL builder for the absent route)
> - `src/rules/corridor_layout.py`, `src/rendering/plan_sheet.py` `_aerial_laid_out_overlays` (commit `6405803`)
> - Distinct from #300 (left-side layouts), #299 (scan bbox) and #285 (the nearest-intersection tag). This issue is where things are drawn and owned, not what is laid out.
> - Priority-medium. Not blocking. The follow-on arc to #290.

---

## Ruling 189, verbatim (`validation-artifacts/committed/issue-289-band-stack/rulings.md:40-43`)

> **189 the modal migration — phased.** Phase 2: the Where band owns the aerial and the
> outcome; the picker modal stays for the decision work (detection, candidates, bearing,
> cross-street, suggestions), opened from the band. It migrates piece by piece in Phase 3 and
> after. Nothing in the column's structure depends on the modal being gone.

---

## #290's rulings this arc inherits (`validation-artifacts/committed/issue-290-pin-work/rulings.md`)

**The pre-side ruling** (Ryan, 2026-09-25, after the second ship `aab8caa`), verbatim (the ruling sentence of a longer message):

> Ruling on the one question: before the side is confirmed, the picker draws the pin and the
> sentence "Say which side is occupied to lay out the work" — no segment, and no direction-free
> circle, because a shape without a direction is a guess at the plan (P16, Rule 10).

**The open-points ruling 3** (Ryan, 2026-09-25, after the first ship `f47d3b7`), verbatim (point 3 of four):

> (3) the aerial stays in the picker modal this arc, redrawn work-first with approaches after the
> side is confirmed

#290 has shipped. This arc is where the picture leaves the modal, as ruling 189 intended.

**The hand-check supersession** (Ryan, 2026-09-25): the side control offers only the buildable
sides. The median and left side are not rendered (this supersedes open-points ruling 2). The
left side on one-way streets is #300.

---

## Adjacent, not this arc's

#300 (the left side on one-way streets) · #299 (the north-up scan box) · #285 (the
nearest-intersection tag) · #284 (the proposed kind). #301 is about where the corridor is drawn and
who owns the drawing. It does not change what is laid out.
