# s2-arc1 live checks — production, 2026-08-17

Runner: `s2a1-live-checks.js` (headless Playwright, read-only — transient
picker/form state only, nothing saved server-side). Raw log:
`outS2A1/assertions-raw.md`. Two earlier partial runs (a bad second pin,
a wrong-tooltip locator, one transient no-candidate flake) were runner
defects, fixed in the script; this is the complete run.

## Gate

healthz `46a0df8…` == `git rev-parse origin/main` == served-bundle sha
(found in the served `_next/static` chunks). Passed first probe; no
mid-propagation retry needed.

## Results — 14 checks: 12 PASS (gate included), 2 FAIL (both pre-existing nodes)

The raw log records check names; the exact rendered note sentences are
asserted by the runner's text locators (`s2a1-live-checks.js`) and
visible in the numbered screenshots — the log's PASS means the locator
found that sentence on the page. One sentence IS quoted verbatim in the
log itself: the F1 sibling note (a `log()` line, not an assertion).

| # | check (assertion target in the runner) | evidence | result |
|---|---|---|---|
| gate | healthz == origin/main == served bundle | log | PASS |
| F3a | in-modal clamp annotation on the lanes row (locator: `plans draw at most 4 lanes per direction. Plan will use 4.`) | `01-…png` | PASS |
| F3b | seam note after save (locator: `Lanes 4/direction (clamped from 6 manual entry`) | `02-…png` | PASS |
| F1 | changed detection (Lakewood → Greeley) names the laneWidth overwrite (locator: `Lane width set to 12 ft (OSM detection — was 10.5 ft).`) | `03-…png` | PASS |
| F1+ | sibling family-1 note, quoted verbatim in the log: "Lanes set to 2/direction (OSM detection — was 4)." (logged, not asserted) | log | — |
| F2a | flagger + picker lanes override skipped note (locator: `Lanes setting 3/direction from the picker not applied — flagger plans don't take a lane count.`) | `04-…png` | PASS |
| F2b | flagger + picker divided override skipped note (locator: `Divided setting from the picker not applied — flagger plans don't take a divided toggle.`) | `04-…png` | PASS |
| F4a | reduction 55 under posted 65, Colfax pick lowers posted (locator: `Work-zone speed reduction removed (was 55 mph`) | `05-…png` | PASS |
| F4b | reduction input gone (workZoneSpeed cleared from form state) | log | PASS |
| F4c | no `workZoneSpeed … must be <= posted speed` text anywhere on the page | log | PASS |
| #123 ×3 | couplet-never-with-undivided invariant on three real roads; measured provenance strings quoted verbatim in the log (below) | log + `06-…png` | PASS |
| AX1 | axe, open modal post-candidate-pick | `axe-modal-clamp-note.json` | **FAIL — pre-existing (below)** |
| AX2 | axe, page with seam notes visible | `axe-seam-notes.json` | **FAIL — pre-existing (below)** |

## The #123 measurements

- **E 13th Ave (Denver): the exact filed defect case, live** — a real
  `secondary` one-way (`oneway=true`), value **undivided**, provenance
  now `inferred from class=secondary`. The pre-fix ternary emitted
  `OSM oneway=yes (couplet → divided)` on exactly this input.
- **E 14th Ave**: `tertiary` one-way, undivided, `inferred from
  class=tertiary` — the second filed class, same correction.
- **Lincoln St pin**: the 30 m snap landed on an adjacent `tertiary`
  side road (`oneway=false`), not the primary couplet itself — so the
  primary control (couplet string retained with `divided: true`) was
  **not measured live**; stated, covered by the committed unit fixture
  (`classify.test.ts`, primary/trunk arms).

## The two axe findings — pre-existing, newly surfaced, Ryan's disposition

Both nodes are untouched by this arc's diff and belong to states no
prior axe pass reached (the arc16 quiet-band pattern):

1. **AX1 `label` (critical)** — `input[min="5"]` / `input[step="1"]`:
   the modal's speed and lanes `NumericFieldEditor` inputs carry no
   accessible label. Pre-existing markup (this arc added only the
   `note` string on the lanes row — zero input-element lines in the
   diff). Prior modal scans (arc16 5b) ran **pre-candidate-pick**, where
   DetectedRows and its editors are unmounted — this run's post-pick
   scan is the first to see them. Same family as the a11y pile's
   lat/lng-label item (deferred to the tail by ruling).
2. **AX2 `color-contrast` (serious)** — `.opacity-80`
   (`AuditTrail.tsx:333`, `--ink-on-dark-faint` at 0.8): the recorded
   **faint-register family**, named as likely-failing anywhere it
   renders by the arc16 coda note. Zero diff hits for `opacity-80`.

Left FAILING in the log rather than exempted in the script — the
disposition is Ryan's. Both belong on the deferred a11y pile; noting
them there when it's filed keeps the pile complete.

## Verdict

s2-arc1 is live and verified at `46a0df8`: gate green first probe, 12
of 14 checks PASS — all four #198 families speaking on production with
the planned wording (locator-asserted, screenshot-evidenced), family
4's app-created 400 gone from the flow, and the #123 correction
measured on two real one-ways including the filed secondary case. Two
honest FAILs on record, both pre-existing and pile-bound.
Refs #198, #123.
