# issue-315-stale-left: the rulings this arc is built under

**Issue:** #315. **Base:** `issue-301-modal-cleanup` at `469ebfb` (stacked: R124's ship order is
issue-301-modal-cleanup, then this fix, then issue-301-road-properties, then
issue-301-cross-street-entry). Prod is `60bbe09`.

## #315's body, verbatim (fetched 2026-10-09 with `gh issue view 315`)

> Title: A stale left side empties the side control: the side-options read is refused by the check it should explain
> Labels: bug, priority-medium, frontend, ux, p2, p8
> Created: 2026-10-09T13:52:58Z
>
> ## Problem
> #300 (R119 Q4) meant a stored left side that the backend no longer builds to show one line at the side control, with nothing reset (`WhereBand.tsx:236-240`, `side-control-stale`). On prod `60bbe09` that line cannot render.
>
> The side options come from `/render/corridor-geometry`. `useCorridorGeometry` sends it the scenario verbatim, stored `meta.work.side: "left"` included (`lib/corridor-geometry.ts:230-234`). The endpoint runs `_ensure_scenario_enabled` first (`src/api/render_api.py:1275`), so `_ensure_pin_model_complete` refuses with 400 `pin_model_input` before any options are built. The hook maps the 400 to `error`, so `options` is empty, and `staleLeft` needs `options.length > 0`. `/render/corridor-map` runs the same check (`:1409`), so the aerial fails too.
>
> Result: the control shows the wrong state (P8). It says the road's sides are unavailable when the real reason is that left needs a one-way street, and the operator gets no curb to pick.
>
> ## Reproduction
> 1. Prod sandbox, pin 39.73370, -104.98753 (N Broadway SB), pick the road, Save.
> 2. Shoulder work, then East side · southbound traffic (left).
> 3. Switch the kind to Flagger lane closure.
>
> Expected: West offered, plus "Left-side shoulder work needs a one-way street. Pick a right-side curb, or plan shoulder work on a one-way street."
> Actual: no options; "the road's sides are unavailable. Reopen the map to retry"; "The aerial didn't load." The last geometry response is a 400 with the R120 refusal.
>
> Evidence: `validation-artifacts/committed/issue-300-left-side-oneway/r120-prod/` (branch `issue-301-picker-pieces`, `fb12f6e`).
>
> ## Impact
> - The operator is stuck at the side question with a false "unavailable" message. To recover, they have to guess that switching back to Shoulder or undoing the divided answer fixes it.
> - R119 Q4 ("the side picker shows it") is unmet on prod. The vitest passes only because its fetch mock returns options whatever the request contains.
>
> ## Proposed solution
> - (a) Recommended: `/render/corridor-geometry` builds `side_options` with the stored side treated as unset when that side is refused, and returns the refusal message beside them (`side_refused`). The control renders the options and the backend's message (one voice, P2). This is a logic change, so the Rule 5 churn is predicted at the checkpoint. The aerial stays refused until a side is chosen.
> - (b) The frontend reads the 400's `message` into the control. The operator still has no options to pick and stays stuck. Rejected.
>
> ## Acceptance
> - The prod repro above shows West plus the stale line, and picking West clears it.
> - A test drives the real refusal path with no options-always mock: a stale left on a flagger scenario returns options plus the message.
> - Right-side and built-left responses are byte-identical before and after.
>
> ## Reference
> - `conestruct/site/components/bands/WhereBand.tsx:236-240`
> - `conestruct/site/lib/corridor-geometry.ts:216-254`
> - `src/api/render_api.py:193`, `:229-279`, `:1247-1275`, `:1409`
> - `conestruct/site/components/bands/WhereBand.left-side.test.tsx`
> - Refs #300 (R119 Q4, R120)
> - Priority-medium: reachable on prod; no deliverable is wrong.

## R124 (Ryan, 2026-10-09), verbatim

> R124, the stale-left issue: option (a). Investigate first, with a 📋 checkpoint before code: the Rule 5 churn and the exact response shape.
>
> Ship order: issue-301-modal-cleanup, then the stale-left fix, then issue-301-road-properties, then issue-301-cross-street-entry. Report after each build.

(R123, given in the same message, is #301's; it is recorded in
`validation-artifacts/committed/issue-301-picker-pieces/rulings.md`.)

## Carried in

- **R119 Q4** (#300): "Q4: Yes, backend refuses with a message naming the fix; the side picker
  shows it; no frontend reset." (`validation-artifacts/committed/issue-300-left-side-oneway/rulings.md:44`).
- **R120** (#300): the refusal and the side control's line, worded with no "not X" contrast
  (same file).
- **#290's pre-side ruling:** before the side is confirmed, the picture is the pin and "Say which
  side is occupied to lay out the work" (`issue-301-band-aerial/rulings.md:109-111`).

## The ruling on the checkpoint

Not yet given. Appended here verbatim when it lands; nothing is built before it.
