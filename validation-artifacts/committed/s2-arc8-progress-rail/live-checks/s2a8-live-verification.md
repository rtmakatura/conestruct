# s2-arc8 live checks — production at `0a4dfa4` (Refs #221, #222)

Read-only, headless, 2026-08-25.  Triple gate re-asserted first:
origin/main == healthz == `0a4dfa4…`; the served bundle carries the
`progress-rail` marker.

## Tally — 15 PASS, 0 open FAIL

**`s2a8-live-checks.js` + `s2a8-lc-rerun.js` → `outS2A8LC/s2a8-lc-raw.md`:**

- **L1 ×5 — S1 measured gone** (pre-pin NI): step tags ascend
  `[1,2,3,4,5,6,7]` with Scenario STEP 1 above Location STEP 2 (the
  baseline's inversion dead); five downstream steps pending — focusable
  summaries + `inert` bodies; the summary names the gate in text
  ("◌ Pending — set a location first", rule 13); the rail renders with
  Location ⚠ current carrying the location string and every downstream
  entry ◌; **one voice live**: rail blocker === under-CTA reason
  (L1-ni-prepin.png).
- **L2 ×4 — S4 measured gone** (Race∩Colfax hold): post-pin the pending
  chrome is fully gone (0 summaries, 0 inert — unchanged behavior);
  rail blocker === CTA reason === the hold string; **the sticky rail
  sits at railTop=0 at the CTA's scroll position** — blocker and CTA
  co-visible where the baseline measured 963 px of separation;
  Schedule reads ◌ "not set" (L2-hold-sticky.png).
- **L3 — the invisible queue is dead**: wz=0 stacked on the pending
  hold → Work ⚠ (current, "Work zone length is required.") AND Cross
  street ⚠ (aria carries the hold string) render on the rail at once,
  where the baseline showed one reason and a hidden queue
  (R-L3-multiblocker.png).
- **L4 — jump link**: clicking the rail's Cross street entry scrolls
  the section into view and lands focus on `rail-step-extra` (the #193
  armed-action policy, live).
- **L5 ×4 — clean-kind control** (shoulder + Lakewood):
  Location/Road/Work ✓, Schedule ◌, no blocker string anywhere;
  Generate enabled; the plan generates; **post-generate the rail is
  gone** — the panel swaps to the strip by design (L5-clean-rail.png,
  L5-post-generate.png).

**Axe** (pre-pin NI + hold states): **zero violations on any rail or
gating node**.  One `region` (moderate) finding per scan at `.gap-8` =
AppSheetMeta — pre-existing chrome, untouched by this diff (not in any
of the four commits), surfacing only because the pre-generate states
were never axe-scanned before (s2-arc7 scanned post-generate).  Goes to
the deferred a11y pile as an observation, not a rail defect.  The
recorded `.opacity-80` color-contrast FAIL did not appear here — it is
post-generate Zone-3 chrome, absent from these states.

## Runner defect (disclosed; not a product defect)

First-pass L3 FAIL: the runner's reason-picker took the FIRST
`--fail`-styled `role=alert` on the page, which in the wz=0 state is
the inline field error ("⚠ Work zone length is required.",
glyph-prefixed) rather than the under-CTA reason — the same diagnostic
already showed the rail state fully correct (Work ⚠ current + Cross
street ⚠ both rendered).  Fixed by reading the Generate footer's own
alert (`#rail-step-generate [role=alert]`); rerun green.

Refs #221, #222.
