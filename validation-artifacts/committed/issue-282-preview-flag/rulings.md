# issue-282-preview-flag — the rulings this arc is built under

**Ruled by Ryan, 2026-09-16**, in chat, adopting the checkpoint's recommendation. Quoted
verbatim below. This file is the arc's authority: every commit on this branch cites it,
and the diff-verifier checks the commits against it rather than against a message it
cannot read. Filed as this arc's **first** commit, per the per-arc rulings convention.

**Issue:** #282 — "Preview-as-read backend flag — the render request cannot distinguish a
preview from a generate". **Phase:** 0 (#287). **Design authority:** #281.

---

## The ruling, verbatim

> #282 (preview flag): adopt your recommendation. `preview: bool = False` on the render
> request, Pydantic first; when true the endpoint runs the breakdown path only — no memo
> write, no audit, no scan, no PDF; returns the cheap numbers with a `preview: true` echo
> so the frontend can never mistake a preview for a generate. Payload-level tests for both
> branches (Rule 11); absent → byte-identical to today, fixtures unchanged. Enumerate
> every sender when the field lands; none send it yet. rulings.md first commit. Build,
> verify, stop with the ship line.

## What #281 requires of a preview, quoted

From #281's "Rulings the audit added":

> **A preview is a read.** No band, no lock, never memoised, never written;
> commit-on-blur/Enter, never per keystroke; the fast request only (breakdown), never the
> audit, scan or PDFs. Needs a backend preview flag on the request (Phase 0).

## What the checkpoint found

- **`/render/device-breakdown`** (`render_api.py`) is the "fast request (breakdown)" the
  ruling names.
- **Sender enumeration is clean — exactly one.** `GeneratorShell.tsx:556` →
  `app/api/render/device-breakdown/route.ts` (30/min/IP rate limit) →
  `lib/render-proxy.ts`. Nothing else posts to it.
- **The flag is not just a marker.** The endpoint calls `_placements_for`, which runs
  `run_site_scan(...)` and raises an honest 400 when Overpass never answers. So a
  breakdown request today can fire an Overpass round trip, write the memo, and refuse.
  Honouring "never memoised, never written … never the scan" means the flag must
  **bypass the scan inside `_placements_for`**, which is the chokepoint every render path
  funnels through (pdf, xlsx, markdown, crew-pdf, audit, breakdown, quote). That is the
  blast radius to be careful with.

## The honesty question this raises, and its answer

A preview that skips the scan computes taper/buffer/spacing **without the site
adjustments Apply will add**. That is preview ≠ applied — #198's family, the same one
#267 is about.

The ruling answers it with the **`preview: true` echo**: the response says what it is, on
the wire, so the surface consuming it cannot present it as a generate. That is the
mechanism; a frontend convention would not be one. Whether the revision panel additionally
needs wording in ruling 202's "you are applying blind" family is Phase 2's question, on
Phase 2's surface — not this arc's, because no surface consumes the flag yet.

## Acceptance, from the ruling

- `preview: bool = False` on the render request, **Pydantic first** (backend-first: an
  unknown field is silently dropped, so the flag must exist server-side before any sender
  sets it).
- `preview: true` ⇒ breakdown path only: **no memo write, no audit, no scan, no PDF.**
- The response carries a `preview: true` echo.
- **Payload-level tests for both branches** (Rule 11 — test where the bug lives; a
  pure-function test would pass while this shipped broken).
- **Absent ⇒ byte-identical to today.** Fixtures unchanged.
- Every sender enumerated when the field lands. **None send it yet**, and that is the
  expected state at the end of this arc: Phase 0 is "foundations, nothing visible".
