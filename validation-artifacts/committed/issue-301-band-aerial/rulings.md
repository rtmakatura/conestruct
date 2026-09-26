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

---

## The ruling, verbatim (Ryan, 2026-09-26, on `checkpoint.md` at `267bec3`)

> Rulings on the #301 checkpoint:
> 1. Option (a), scenario in, PNG out, drawn on the backend, thin Next proxy.
> 2. The buffer defect is filed as #<number> — fix it as this arc's commit 1, citing it: one layout call for every surface, the agreement test (Broadway SB, Lafayette flagger, and the 65→60 case that fails on main today).
> 3. The band uses the picker's colours so all three surfaces match. Record the rule 110 mismatch in rulings.md as a known deviation; not its own issue.
> 4. Before the kind: a legend line instead of the dotted channel.
> 5. Legend under the image at every width.
> 6. S3's 104 px strip deferred to its own piece.
> 7. Piece 2 in: the audit is the one speaker; the modal's per-zone length rows go.
> Also delete corridor-map.ts, centerline.ts and buildCorridorPolyline.
> Stack Ship A (backend) and Ship B (site) plus the evidence sweep on one branch. Stop with the verdict, the file table, what I'll see on the band, and ONE ship line.

**The buffer defect is #302.** The ruling's "#<number>" placeholder resolves to #302, "Picker and
PDF page 2 draw the wrong buffer when the work-zone speed limit is reduced — 645/820 ft drawn vs
570/650 ft built" (filed 2026-09-26; its body cites this arc's checkpoint). Every commit that fixes
it cites #302.

### Known deviation: rule 110's palette (ruling 3)

#281 Part 2 rule 110 draws the corridor's channels in `#f4c020` (advance warning), `#ff8a2e`
dashed (taper), `#e0a63c` dashed (buffer), `#3fd3a8` (work zone) and `#7e8da1` dotted
(downstream). Rule 12 and ruling 181 permit exactly two off-palette hexes, `#3fd3a8` and `#e0a63c`.

**What every surface draws instead:** the picker (mapbox-gl), PDF page 2 (Static Images) and now
the band's aerial (Static Images) all draw `ZONE_COLOR` (`conestruct/site/lib/corridor-zones.ts`,
mirrored in Python as `_LAID_OUT_ZONE_COLOR`):

| Zone | Colour |
|---|---|
| advance warning | `#FFD166` |
| taper | `#F3722C` |
| buffer | `#FF7A00` |
| work zone | `#1EC8A5` |
| downstream | `#8A8A8A` |

The non-colour channel is width rank (a static path cannot dash). `ZONE_COLOR` is registered as the
corridor's palette source in `lib/design/ink-exceptions.ts`.

**Why:** the three surfaces show one corridor, and they match each other (P11). The band draws no
hex of its own: its image comes from the backend, and its legend swatches read `ZONE_COLOR`.

**Status:** a recorded deviation, not an issue, per the ruling. Adopting rule 110's palette would
move all three surfaces together.

### How the rulings map onto the build

1. **Option (a):** `POST /render/corridor-map` (backend, PNG) and `app/api/corridor-map/route.ts`
   (a binary proxy).
2. **#302 is commit 1:**
   - `corridor_layout.laid_out`, the one call that builds every drawn corridor;
   - `build_corridor` gains `work_zone_speed_mph`;
   - the agreement test on Broadway SB, the Lafayette flagger and the 65→60 case.
3. **The picker's colours:** recorded above.
4. **Before the kind:** the work segment only, and a legend line, no drawn channel.
5. **The legend:** under the image at 1440 and 380.
6. **S3's strip:** not built.
7. **Piece 2:** the modal's per-zone `ExtentRows` removed; the band's rows (the audit) are the one
   speaker.

**Deleted:** `lib/corridor-map.ts`, `lib/centerline.ts`, `buildCorridorPolyline`.

**One branch:** Ship A (backend), Ship B (site) and the evidence sweep (local stack, 1440 and 380).

---

## The ruling after the memory stop, verbatim (Ryan, 2026-09-26, at `1289027`)

> Memory freed. Rulings:
> 1. /render/corridor-spec is dead code that computes a buffer without the work-zone speed — the exact #302 defect waiting for a caller. Delete it in this arc, with its tests, as its own commit.
> 2. Skip the local sweep — it's the heaviest step and prod is the real evidence anyway. Finish commits 5 and 6 plus the corridor-spec deletion, verify, and give me ONE ship line. After I ship, run sweep.cjs against prod (headless browser only, no local backend or dev server) and commit it as an evidence branch.

**On the record:**
- **The corridor-spec deletion is its own commit.** It covers the backend endpoint, its request model and taper-family table; the Next route and its test; `fetchCorridorSpec`; and the endpoint's tests. The cross-surface "one downstream length" test keeps its picker leg, now reading what the picker draws (`/render/corridor-geometry`).
- **The local sweep is not run.** `sweep.cjs` is committed with the prod evidence on a separate branch after the ship, run headless against `https://www.conestruct.com/sandbox`.

---

## The hand-check ruling: zoom on the band's aerial, verbatim (Ryan, 2026-09-26, after `d6e00a7` shipped)

> Ryan's hand-check on #301: "looks great." One addition: the band's aerial gets zoom. Keep option (a) — no mapbox-gl on the band. Add + / − controls on the image (32 px, 44 at 380, data-read, never locked by the write lock) that re-request /render/corridor-map with a zoom step; the default framing stays the whole corridor, − never zooms out past it... actually allow one step out for context; + allows up to N steps in, N CHOSEN and recorded. Keep the pin and overlay; the legend doesn't change. Show the previous image until the new one arrives (P16 — no blank, no spinner on the image). A "reset" returns to the whole-corridor framing. Record the ruling in rulings.md.
>
> Then the prod sweep on the shipped version plus the zoom states, committed on the same branch, and ONE ship line. Then the #301 and #302 close texts as plain text in this chat.

**How it is built:**
- **The request:** `POST /render/corridor-map` takes `zoom`, an integer step from **−1** (one step out, for context) to **+3**.
  - **N = 3, CHOSEN.** A corridor of about 1,400–2,700 ft fits at roughly zoom 15–16 in the band's frame, and three steps in (8× linear) reaches zoom 18–19, where the lane edges and cones' ground are legible on Mapbox satellite. Beyond that the imagery softens.
- **Step 0 is unchanged:** the whole-corridor `auto` framing that shipped, byte for byte.
- **Other steps take an explicit centre and zoom, computed on the backend (Rule 3):**
  - **The base:** the backend's own fit of every drawn point into the frame, with the same padding.
  - **Zooming in** centres on the **work segment's midpoint**, the thing the pin marks (P21).
  - **One step out** centres on the **corridor's middle**.
  - **Before the side:** the steps apply to the pin view's zoom 17, centred on the pin.
- **The band:**
  - + / − and "Reset" sit on the image. They are 32 px, and 44 px at ≤480.
  - They are `data-read` and never disabled by the write lock. At a bound, a button is `aria-disabled`: still focusable, and it does nothing.
  - Reset appears only away from step 0.
  - While a zoom step loads, the **previous picture of the same corridor stays**, with no blank and no wait note on the image. A new scenario or stage still clears it (Rule 10: never another corridor's picture). A new scenario, stage or frame size resets the zoom to 0.
  - The pin, the overlay and the legend are unchanged.
