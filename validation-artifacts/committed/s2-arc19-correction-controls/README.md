# s2-arc19 — #245 reason picker contrast · #246 correction controls reachable

Branch `issue-245-246-correction-controls` off main `ed878cf` (the s2-arc18
evidence merge). GO of 2026-09-05 against the 📋 checkpoint of the same day.
Frontend-only; **the wire is unchanged** (`meta.siteConditionOverrides`
marker shape, `DISMISS_REASONS` values, `provenance.corrections[]`,
no payload sender touched — pin fixtures 6, snapshots, containment 8,
backend suite all 0 churn; `test_scan_never_writes_the_wire_scenario` 0).

Ship line: `.\scripts\ship.ps1 -Branch issue-245-246-correction-controls`.
Prod run after the ship: `node s2a19-lc-prod.js` (sha-gated on healthz ==
origin/main), both viewports; Ryan hand-confirms on a hard-refreshed tab.

## The two defects (measured on prod `ed878cf`, `investigate/`)

Both found on Ryan's 2026-09-05 hand-check of the shipped "Site conditions
— scanned" strip block (s2-arc18 commit `0d6b6f9`).

**#245.** The dismiss reason picker was a native `<select>` with no matching
CSS rule. Under the Tailwind 3.4 preflight (`select { color: inherit }`, no
background reset; the page declares no `color-scheme` — computed `normal`)
it inherited the row's `--ink-on-dark #c8d1dd` onto the UA's default white
field. Measured with the picker open (`investigate/prod-ed878cf-
measurement-log.txt`, `axe-picker-open-*-ed878cf.json`):

| surface | fg | bg | ratio |
|---|---|---|---|
| closed select "Choose a reason" | `#c8d1dd` | `#ffffff` (UA) | **1.54** |
| option popup (Chrome renders it from the same pair; outside the DOM) | `#c8d1dd` | `#ffffff` | 1.54 (asserted from the pair) |
| the `sugg-name` label beside it | `#c8d1dd` | `#14202e` (`--canvas`) | 10.68 |
| `button.confirm` ink | `#34a9e8` (`--act`) | `#14202e` | 6.26 |
| `button.ghost` ink | `#93a0b0` (`--ink-on-dark-faint`) | `#14202e` | 6.19 |

Why arc 18's axe passed: the script chose the reason with
`selectOption("fenced")` (never opening the menu) and axe ran at
`dismissed` / `asserted`, when the record had already replaced the picker.
Axe **does** flag the closed control once the picker is open
(`color-contrast select … 1.54`, both viewports); the popup stays
unmeasurable regardless. #245's text says the placeholder sat "against the
dark input"; the measurement says the field was white — same defect,
corrected description.

**#246.** The post-generate landing (#152 E) scrolls the Zone 2 section to
`block:"start"`; the block lives in Zone 1 above it, so it is hidden by
construction at every viewport:

| viewport | scrollY after landing | block top…bottom vs viewport | zone 02 top |
|---|---|---|---|
| 1440×1000 | 956 | −364 … −74 (h 290) | 103 |
| 380×800 | 1648 | −796 … −239 (h 557) | 83 |

## Rulings (2026-09-05)

- **(a) #245 = in-DOM radio-chip group.** `<fieldset role=radiogroup>` +
  legend "Reason for dismissing <label>" (the same accessible name), four
  radio chips from `DISMISS_REASONS`; ghost pair unselected, act pair +
  ✓ glyph + native `:checked` chosen (rule 13); note input on the
  `.field-input` workbench pair. `dismissIsComplete` unchanged.
- **(b) #246 = O1+.** Results-head jump line "Site conditions — N
  detected · correct in setup ↑" from the settled scan (0 ⇒ no line, rule
  10) + section 03 row signposts through one optional `CheckRow` slot.
  Nothing writes from section 03; the #152 E landing and #193 focus are
  untouched. Both are **links** to the block's anchor
  (`SITE_CORRECTIONS_ANCHOR`), so the rows' "no button" write sentinel
  (`TieredReference.corrections.test`) stands with 0 churn.
- **(c)** lands now; O3 out of scope. **(d)** axe baselines: 1440 stays 2;
  380 = 2 with `scrollable-region-focusable .gap-8` and `target-size
  .strip-edit-all` (130×19 px) named — pre-existing, a11y pile.

## Commits

1. `89d0a8f` — #245: the picker markup (`SetupStrip.tsx`), the chip / note
   rules (`globals.css`), `SetupStrip.corrections.test` "Dismiss needs a
   reason" rewritten to the radiogroup (+1 DOM-presence case), +3 token
   rules in `SetupStrip.corrections-tokens.test`. Red run
   `red-run-c1-picker.txt`: 5 failed against main's sources.
2. `0b614fa` — #246: the jump line (`GeneratorShell.tsx`), the `CheckRow`
   slot (`AuditTrail.tsx`), the signposts (`TieredReference.tsx`), the
   anchor id (`SetupStrip.tsx`, `site-corrections.ts`), CSS;
   `GeneratorShell.site-jump.test` (+2, real shell + real strip),
   `TieredReference.signposts.test` (+2 on the recorded fixtures). Red run
   `red-run-c2-signposts.txt`: 4 failed against main's sources.
3. this commit — evidence: this README, `s2a19-lc-prod.js`, the local run,
   the investigate-phase measurement, test accounting.

## Rule 5 churn — predicted vs actual

| suite | predicted | actual |
|---|---|---|
| `SetupStrip.corrections.test` | 1 rewritten, +1 | 1 rewritten, +1 |
| CSS-rule test | +1 | +3 (one file, three rules: chips, focusable radio, note) |
| `GeneratorShell` mounted | +2 | +2 (`site-jump.test`) |
| `TieredReference` mounted | +1 | +2 (`signposts.test`: counts per row kind, the dismissed row) |
| `post-generate-scroll.test` | 0 | 0 |
| `TieredReference.corrections.test` (write sentinel) | — | 0 (links, not buttons) |
| pin fixtures 6 · snapshots · containment 8 · backend | 0 | 0 (pytest 2036 passed + 2 skipped, unchanged) |
| rail sentinel · `.sys-event` strings | 0 | 0 |
| vitest total | — | 920 → 928 |
| axe 1440 | 2 → 2 | picker open / chosen / other: **0** (the local run had a live breakdown; no dimmed results) |
| axe 380 | new baseline 2, named | 2 / 2 / 2, exactly the two named |

Off-prediction, recorded: the two ruling-b signposts were written as
`<a>` not `<button>` after the corrections suite's row sentinel
(`queryByRole("button")` null) caught the first draft — the sentinel did
its job; a button in a tier row reads as a write affordance. The dismissed
(OPERATOR) row signposts "Correct in setup ↑" (its Undo lives in the
block), not "Assert" — a judgment call outside the two named row kinds.

## Local run — `outS2A19Local/` — ALL PASS 34/34 (+2 INFO)

`next dev` on the working tree at `0b614fa` (+ the uncommitted script) with
`MODAL_RENDER_URL` at a local uvicorn of the same tree; Playwright on the
real `/sandbox` at 1440×1000 and 380×800; every leg through the Next proxy
routes.

**Honest note on the scan.** Both public Overpass mirrors were unreachable
from this machine during the run (overpass-api.de closed the TLS
connection in 0.2–0.5 s; overpass.kumi.systems timed out at 40 s — probed
from PowerShell and curl; prod's backend scanned the same pin in 12 s from
Modal's IP). Three local attempts ended in `scan budget exceeded (20 s)`
refusals. The run recorded here served the scan from
`tests/fixtures/site_scan/lakewood_overpass.json` — the live payload
captured 2026-09-03 for this corridor — through a local stand-in mirror
(`local-stack/a19-overpass-mock.py`, the backend launched by
`local-stack/a19-uvicorn-stubbed.py` with `OVERPASS_MIRRORS` pointed at
it). The scan's own code path, the audit, the corrections, the breakdown
and every browser surface are the working tree's real code; only the
Overpass HTTP hop is recorded. The prod run scans live.

- **P1** Generate settles with an ok scan and a live breakdown (477 ms /
  480 ms).
- **P2** the jump line is inside the post-generate viewport — 1440: top 147
  bottom 164 of 1000; 380: top 727 bottom 744 of 800 — "Site conditions — 3
  detected · correct in setup ↑". The block after the landing: 1440 −364…−74
  (above the fold, as on `ed878cf`); 380 −228…329 (this pin's block is
  partly visible at 380 with the sandbox's default scenario).
- **P3** the click lands the block at top 98 (nav + rail + 8) — 1440
  98…388, 380 98…655; focus on the block.
- **P4** Dismiss opens the picker: `fenced,removed,not_in_work_zone,other`
  as radios, no `<select>`, Confirm disabled.
- **P5** axe with the picker open: zero color-contrast targets in the
  picker; total 0 (1440) / 2 named (380).
- **P6–P8** measured pairs: legend `#c8d1dd` on `#14202e` **10.68**; chip
  unselected `#93a0b0` **6.19**; chip chosen `#34a9e8` **6.26** with ✓ +
  text + `:checked`; note ink `#ffffff` **16.46**; placeholder `#93a0b0`
  **6.19**. Axe after choosing and after other + note: zero in the picker,
  totals as P5. Other without a note keeps Confirm disabled.
- **P9** Confirm: the next audit request carries
  `[{flag: pedestrian_facility, action: dismiss, reason: other, note:
  "construction fence", recorded_at}]` — the same marker as before; the
  plan re-generates; the × record shows.
- **P10** section 03 (all tiers opened): 3 × "Correct in setup ↑", 2 ×
  "Assert in setup ↑", zero buttons in signposted rows; a signpost lands
  the block at top 98 at both viewports.

Screenshots per viewport: `post-generate-*.png`, `after-jump-*.png`,
`picker-open-*.png`, `picker-chosen-*.png`, `picker-other-*.png`,
`after-signpost-*.png`; axe JSON per state.

Script fixes during the run (all in the committed script): the chip is
clicked, not the 1 px visually-hidden radio; `getByLabel("Say what")` made
exact (the Other chip's label contains the words); a breakdown-side scan
refusal (stale ribbon with the audit ok) re-fires Generate the way the
refusal container's Retry does.

## Contracts

- #198 — no existing `.sys-event` string changes; record sentences printed
  verbatim (P9b). Rail untouched; `deriveRail` sentinel green (full vitest).
- Suggest-never-set — no new state; the marker is still built only at
  Confirm (P8, P9).
- Rule 3 — nothing computed: N is a count of `detected === true` over the
  five keyed buckets of the served scan. Rule 10 — line and signposts
  render only from the settled audit; no keyed detections ⇒ no line
  (`site-jump.test` case 2). Rule 13 — figures above, measured; chosen =
  border + ink + ✓ + `:checked`.
- Citation counter 19 — no MUTCD / spec citation added.
- `getByText` direct text nodes — the line's text is one template literal;
  each chip's text is its own span; the ✓ is an `aria-hidden` span.
- Payload senders — none changed.

## Prod run — pending the ship

`outS2A19Prod/` after `.\scripts\ship.ps1`; the gate aborts unless healthz
sha == origin/main.
