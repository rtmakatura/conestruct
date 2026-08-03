# Arc 8 live-site verification — #179 (production, headless)

Run 2026-08-03T14:08Z against `https://www.conestruct.com/sandbox`,
Playwright headless Chromium (job tmp — no repo package.json churn).
Read-only: no accounts, no DB writes, no plan saves; the ONLY route
interception is a delay throttle on the page's own audit POST (to widen
the in-flight windows) — every response is the real backend's.

## Build gate

| Surface | SHA |
|---|---|
| `git rev-parse origin/main` | `97d8443315737991d8dabe638ac9fe391e5eeb81` |
| Modal `/healthz` | `97d8443315737991d8dabe638ac9fe391e5eeb81` |
| Served Vercel bundle (`/_next/static` chunk scan) | `97d8443315737991d8dabe638ac9fe391e5eeb81` |

Gate PASSED — all three equal. Frontend-only arc; both surfaces at the
same sha regardless of ordering.

## Results — 23/23 PASS, 0 failures (22 checks + gate)

**Context A — the full #86 loop at E Colfax (39.73997, -104.96632).**
- **1.** The standing pin's Colfax candidate arms the refusal: strip
  PLAN DECLINED, armed confirm row on screen unchecked.
  `01-armed-refusal.png`.
- **2.** Keyboard tick (Space): the row **stays mounted and renders
  checked** with the marker-built description — "Map data reported
  **5 total lanes (3 forward, 2 backward)** — untick to restore
  detection" (actual detected values, never invented). Refusal clears
  at settle; Generate enables; the strip reads VERIFIED · 1 plan flag —
  the `detection_overridden` audit item surfacing live. Post-tick
  payload: exactly one `flagger_multilane_confirm` override riding, no
  scenario-level relays. `02-ticked-checked.png`.
- **3.** Keyboard untick under a 5 s audit throttle: the row re-arms
  unchecked immediately; **the CTA stays gated through the in-flight
  window** (the #179 mirror-window fix) and the gate names itself
  ("Re-checking the declined input"); the strip goes VERIFYING and the
  **original refusal returns at settle** — honestly re-derived, not
  cached. **Post-untick audit POST body byte-identical to pre-tick
  (2123 B === 2123 B).** `03-untick-window-gated.png`,
  `04-refusal-returned.png`.
- **4.** Focus: `document.activeElement` stayed on the row through both
  the tick and the untick (both performed via keyboard).
- **5.** Tick-untick-tick: exactly one override in the payload — no
  accumulation.
- **8.** Supersession: with the row confirmed, re-open picker → save the
  quiet Park pin → **confirmed row and marker vanish together** (0
  checked rows; `detectionOverrides` absent from the next payload).
  `05-supersession.png`.

**Context B — the #158 one-way loop at Lincoln St (39.73310,
-104.98630).**
- **6.** "North Lincoln Street northbound" relays a blocking oneway —
  the armed two-way row rendering is itself the verification (it
  renders on nothing else). The road's 4-lane count co-armed #86,
  confirmed first per backend gate order. Tick: checked with **"Map
  data reported a one-way road (oneway=yes)"** — the recorded raw tag.
  Refusal clears once every armed row is confirmed (VERIFIED · 2 plan
  flags — both overrides on the audit). Untick: the one-way refusal
  returns, row re-arms, oneway relay restored, its marker gone,
  payload byte-identical to the pre-tick capture.
  `06-oneway-armed.png`, `07-oneway-ticked.png`,
  `08-oneway-refusal-returned.png`.

**Context C — #136 single-lane (best-effort, one pin per the GO).**
- **7.** The LoDo attempt resolved "17th Street southeast (tertiary)" —
  no single-lane relay armed. Logged as not-found; the #136 loop rests
  on the mounted round-trip in `GeneratorForms.confirm-undo.test.tsx`
  (same code path as the two rows verified live: identical CheckRow
  two-state render and marker-reversal restore).

## Run notes

- **OSM data drift disclosed:** the Arc 2 era's two-way "East Colfax
  Avenue" candidate no longer appears at the standing pin — detection
  now returns "East Colfax Avenue eastbound" (way 600545947), which is
  NAMED eastbound but tagged both-directions (3 forward, 2 backward, no
  blocking oneway), so it arms #86 only. Runs 1–2 failed only their own
  probe assumptions while discovering this (run 1 expected the old
  two-way candidate; run 2 expected the eastbound name to imply a
  oneway tag); no production assertion that executed correctly ever
  failed. The #158 loop moved to Lincoln St (the GO's named candidate),
  which genuinely carries `oneway=yes`.
- Full timestamped assertion log: `assertions-raw.md`.
- Script: `arc8-live-checks.js` (run with
  `EXPECTED_SHA=$(git rev-parse origin/main) NODE_PATH=<tmp>/pw/node_modules node arc8-live-checks.js`;
  outputs land in `out8/`).
