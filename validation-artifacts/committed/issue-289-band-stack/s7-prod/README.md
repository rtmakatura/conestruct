# S7 on prod — the acceptance leg

**Ran:** 2026-09-23, against `https://www.conestruct.com/sandbox`.
**Deployed sha:** `fd86079cd0a9c03a48ac36f4c779c966bd535ab0` — `/healthz` = `origin/main` =
`issue-289-band-stack` tip at the time of the run.

The rig is `probe.cjs` (committed beside this file, run from outside the repo); the capture is
`s7-prod.json`. The 16 screenshots and the run log stay outside the repo at
`C:\Users\rtmak\.claude\jobs\40b8f5bc\tmp\s7-prod\` — 4.7 MB of PNGs is not evidence the repo
needs to carry, and every claim below is readable off the JSON.

## What was driven, and what that cost

The pin is **39.74020, -104.95600** — E Colfax mid-block, the arc's standing test spot.
Detection returns several candidates there and the leg **picks the first one the way a user
does**, because that is the picker's own decision work and #189 keeps it in the modal for
Phase 2.

That pick is not incidental: a confirmed road is what makes the **site scan** run, and the scan
is what gives NEEDS YOU a row to stage. Two quieter pins (rural US-287, CO-93) arm Save in ~14 s
but report *no road at this point*, so they generate a plan with no NEEDS YOU block at all —
and with no block there is no CORRECTION half, which is half of what this leg has to prove.
The first run used one of those pins and could only show a field folding; it is recorded here
because the second run's value is exactly that it does not have that hole.

## The four situations, at 1440 and 380 — identical at both widths

| | state | status row (rule 95.4) |
|---|---|---|
| **7a** | `idle` | `change the value to see what it does` |
| **7b** | `loading` | `computing…` |
| **7c** | `ready` | `computed for 35 mph · taper, buffer, spacing and counts only` |
| **7d** | `error` | `preview unavailable — the plan on screen is unchanged` |

Six rows in every one of them (`7a_rows: 6`), and rule 91's header note reads
`for 35 mph · before site conditions` — the value AND the computation, which is R3's clause.

**The deferred pair is never predicted**, in 7c where the numbers are in hand for the rows
above: `Verdict | on screen | recomputes on apply` and `Needs you | 2 | recomputes on apply`.
That is rulings 195 and 204 holding on the real surface, not in a fixture — the `was` column
carries the plan's own current value and the `now` column refuses to guess at it.

**7b and 7d keep APPLY enabled**, with these two footers read off the page:

> 1 field staged · preview still computing — Apply re-generates the full plan either way
> 1 field staged · preview failed — Apply re-generates the full plan without a preview

Those are **ruling 202's sentences carrying ruling 191's enumeration**, and the difference is
worth stating rather than glossing: ruling 202 writes its example as "1 **change** staged",
and the build substitutes what is actually staged ("1 field", "1 field · 1 correction") because
ruling 191 requires the sentence to enumerate. The clause after the middle dot is 202's, word
for word. Calling the whole string "verbatim 202" would be wrong, and the first draft of this
file did.

## The preview, off the wire

```json
{ "url": "/api/render/device-breakdown", "preview": true, "speed": 35 }
```

One request, the breakdown path, carrying #282's flag — **the first live sender of a field
whose sender count was deliberately zero when it shipped.** No audit, no scan, no PDF.

## APPLY folds both halves into one write

Staged sentence on the page, ruling 191's enumeration:

> 1 field · 1 correction staged · not yet applied

and the write it produces, at both widths:

```json
[{ "url": "/api/render/device-breakdown", "speed": 40,
   "overrides": ["adjacent_interchange:assert"] },
 { "url": "/api/render/audit", "speed": 40,
   "overrides": ["adjacent_interchange:assert"] }]
```

One generate — the pair — carrying the staged FIELD (`speed: 40`) and the staged CORRECTION
(`adjacent_interchange:assert`) together. Neither was on the wire before APPLY.

## DISCARD, and the way back to the column

- **DISCARD fired ZERO requests** at both widths (`discard_requests: 0`) and closed the panel.
  This is #289's own acceptance, and it holds because the only request in the neighbourhood is
  fired on commit.
- **CHANGE SOMETHING ELSE returned the column** (`column_back: true`) and also fired zero
  requests (`else_requests: 0`). Approved by Ryan 2026-09-23 and recorded in `rulings.md` as the
  post-generate route to the pin, the extent and the kind.

## What this leg does not cover

- The **map** half of the picker (dragging a pin, the aerial) — #189 defers that migration, and
  a headless leg driving a Mapbox canvas would be a test of the harness rather than of the
  surface.
- A **jurisdiction-carrying** plan: no jurisdiction was selected, so the plan's NEEDS YOU count
  (`2` here, from the site scan's own findings) carries no jurisdiction deltas. The row's
  TREATMENT is what this leg proves — `was` shows it, `now` refuses to predict it — and its
  number is whatever the plan on screen has.
