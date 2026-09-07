# s2-arc23 GO rulings — #252 the global working band (Ryan, 2026-09-07)

Ryan's GO message against the 📋 checkpoint of 2026-09-07, recorded verbatim
(the rulings section and the parts the commits cite). Chat rulings are posted
to the issue by Ryan at close per CLAUDE.md's session protocol; this file is
the tracked record until then. Where a ruling below differs from the issue
body's "Known conflicts" text (filed earlier the same day), the ruling
supersedes: conflict 1's "build the spec-16 fallback only" is superseded by
ruling (a)'s "stage line omitted"; conflict 4's "add at most one scoped
`--ws-surface`" is met by `--ws-surface-rgb` + `--ws-surface`; the band's
z-index is 70 (above the frame), not spec 2's 50; spec 4's padding moves to
the root below the footer.

> # s2-arc23 GO — #252 the global working band
>
> Rulings issued against the 📋 checkpoint of 2026-09-07. All seven
> recommendations adopted with two tweaks (a: no stage line without stage
> events; e: band above the frame). Branch `issue-252-working-band` off `main`
> at `00ecbf0` (confirm healthz first). Rebase before every commit; stage
> named files only; `git commit -F <file>`; `Refs #252`. Frontend-only;
> backend, wire, pin fixtures, snapshots, payload senders **0** — state and
> prove it. Commit the investigate evidence dir in commit 1.
>
> ## Rulings
>
> - **(a) Predicate + coverage.** `planInFlight = generated &&
>   (deviceBreakdown.state === "loading" || stripAudit.state === "loading")`;
>   `inFlight = planInFlight || openRenders.size > 0`. **Post-generate only.**
>   `openRenders` = shell-owned Set via `RequestContext.begin(label)/end()`
>   around requests 4–7 (bundle, per-file renders, audit PDF, quote
>   breakdown/download). Exempt: pre-generate per-edit pair, suggest,
>   distance, picker fetches, debug snapshot, PlanSave (nav control; keeps
>   its own "saving" word). **Verbs:** GENERATING · "new plan · {address}"
>   or, with empty `meta.address`, "new plan · pin {lat}, {lng}" (four
>   decimals, wire facts) — never a placeholder name; RE-GENERATING · "after
>   a correction to {name}" / "after undoing the correction to {name}" /
>   "after an edit to {field}" (nine-entry label map) / "retrying the site
>   scan" / "without the site check" / "the plan" — each a true statement of
>   the diff between `lastReadyFor` and `fetchScenario`; RENDERING · {file}
>   for 4–7 (vocabulary addition to spec 14, declared). **VERIFYING dropped**
>   (no wire referent). **Stage line: omitted when there are no stage
>   events** (spec 16's gerund fallback rejected — the verb already says it);
>   the band is symbol · verb · object · lock notice.
> - **(b) Write lock.** `WriteLockContext` boolean from the shell +
>   `useWriteLock()`. Every write control: `disabled={locked || ownReason}` +
>   `data-write=""`. Every read control: `data-read=""`. Root `.ws-locked`;
>   one rule `.workbench.ws-locked [data-write]:disabled { opacity:.45;
>   pointer-events:none; cursor:default }` after the `--sc-disabled` rules.
>   Saved-mode `<a href>`: `aria-disabled` + `tabIndex -1` + pointer-events
>   none. `inert` not used. **Honesty test (Rule 11, mounted):** post-generate
>   with the audit held open, enumerate every `button, input, select,
>   textarea, a[href]` under `main` and `nav`; each must be
>   `data-write`+disabled, `data-read`+enabled (expanders toggle on click), or
>   a route link; anything else fails by name. Second case: every
>   `data-write` re-enables at settle unless it has its own reason. #249's
>   spec-34 `inFlight` prop stays, fed by the same predicate; its visual
>   folds into the lock rule; `--sc-disabled` remains only for the
>   incomplete-Confirm state.
> - **(c) CANCEL dropped** (spec 38's own fallback). Abort controllers remain
>   cleanup-only.
> - **(d) Glyph ◌ in `--none`** (pending, one meaning one colour); the track
>   + `--act` border carry "alive". `aria-hidden` on the glyph.
> - **(e) Tokens.** Add in `.workbench`: `--ws-surface-rgb: 15 26 38`
>   (`--ws-surface: rgb(var(--ws-surface-rgb))`; #253 will use `/ .97`),
>   `--z-strip: 30`, `--z-nav: 40`, `--z-band: 70`, `--z-frame: 60` (**band
>   above the frame** — the corner ticks never draw over it; declared).
>   AppNav moves from Tailwind `z-30` to `z-[var(--z-nav)]`. Reuse `--act`,
>   `--act-bright`, `--ink`, `--ink-on-dark`, `--ink-on-dark-faint`, `--warn`,
>   `--rule`, `--act-glow` (reduced-motion static track). Reject `#a9dcf8`,
>   `#5cbef0`, `#3c5069`-style literals; shadow `rgba(6,12,20,.55)` stays a
>   literal in its one rule. **Bottom padding (150px) on the `.workbench`
>   root below the footer, not on `main`** — Terms/Privacy reachable at max
>   scroll while the band is up (spec 26 honoured; spec 4 corrected,
>   declared). Measured pairs on `--ws-surface` per the checkpoint table go
>   in the README.
> - **(f) StatusBar.** COMPUTING (264–276) removed with the
>   `status`/`scanning` props; VERIFYING (309–323) renders null
>   post-generate, stays pre-generate (`verifySlow` timer stays
>   pre-generate, never feeds the band); `scanning` lines 316–317 die;
>   verdict states unchanged in StatusBar's own polite region. Wait line
>   removed (`ResultsHead` returns null in flight; lockup unchanged). Stale
>   ribbon (`GeneratorShell.tsx:1274–1284`) trimmed to "Previous answer —
>   values below predate the request in flight." (text channel of
>   `results-stale`, Rule 13). Empty-state "Generating…" (:1247–1256) → null.
>   Per-button "Rendering…"/"Calculating…"/audit-PDF busy/zip labels retired
>   with RENDERING.
> - **aria.** Band content row = the one working region (`role=status`,
>   polite). Speakers: flight = band, refusal = `role=alert`, verdict =
>   StatusBar, package = #193 sr-only. Sentence = visible text in DOM order
>   (glyph hidden). No second live region ever announces the flight.
> - **#247 acceptance restated:** band rect within the viewport, bottom at
>   `innerHeight`, top below the nav's bottom — true by construction;
>   measured anyway.
> - **#253 hooks:** the four z tokens + `--ws-surface-rgb`; results-head slot
>   order after this arc: `<ResultsHead>` (lockup | null) → refusal → stale
>   wrapper → hero → OutputCards → PricingCard. Nothing else for #253 built
>   here.
>
> ## Commit sequence (each shippable)
>
> 1. **Band + retirements** — `WorkingBand.tsx` + CSS + tokens; predicate +
>    `lastReadyFor` on the audit loading variant (`render-types.ts:159`);
>    verb/object derivation (pure function, unit-tested against wire-object
>    pairs); StatusBar COMPUTING removed / VERIFYING nulled post-generate;
>    wait line, ribbon trim, empty-state null; one aria region; padding
>    under footer; band above frame. [...] **Red-prove.** One voice from the
>    first ship.
> 2. **Write lock** — attributes on every enumerated control (list from §3 of
>    the checkpoint, re-grepped), hook, the one rule, #249 visual folded,
>    saved-mode anchor treatment, the two honesty tests. Red-prove.
> 3. **RENDERING** — `RequestContext` around requests 4–7; labels; per-button
>    busy labels retired; +tests.
> 4. **Evidence** — [...] README with declarations (spec 4 corrected, spec 14
>    RENDERING added, VERIFYING dropped, stage line omitted, CANCEL dropped,
>    band above frame).

## Implementation notes against the rulings

- Ruling (a) names the carried stamp `lastReadyFor`. The commit names it
  `lastSettledFor`, because the band needs the last **settled** answer's
  stamp (ready or refused): after a refused scan, Retry and proceed-anyway
  must diff against the refused scenario, not the last ready one. Same
  field, honest name; declared here and in the commit message.
- Ruling (a)'s "diff between `lastReadyFor` and `fetchScenario`": the diff
  runs against `wireScenario` so the deferred debounce window reads as in
  flight, as every verdict derivation already does (#182).
