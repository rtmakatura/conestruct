# s2-arc9 — #226 setup-panel type system

Arc evidence folder. Refs #226.

## The design source of record

- `Conestruct—Setup-Panel-Design-Recommendations.pdf` — the 2026-08-25 Claude
  Design round, advise-only (it says what, we decide how). Copied byte-for-byte
  from Ryan's download on 2026-08-26.
  - Size: **561,704 bytes** (matches the GO ruling's recorded size).
  - SHA-256: `3289099724AC7B28E302B1E02261A826BF844C0679ECED9B5D4CFF5221949067`
  - 10 pages. The token spec quoted in the arc checkpoint is p. 3 ("Label
    roles, as designed" + "One role per treatment, differentiated on two
    axes"); the voice rule is p. 4; the sentence-case recommendation is p. 1.

## Rulings applied (GO, 2026-08-26)

1. Provenance "lowercase" is **voice, not CSS** — no `text-transform` on the
   provenance role; acronyms/edition names keep canonical casing (Rule 9).
2. Color/family values are **CHOSEN**, not sheeted (the PDF sheets no hex and
   no family names): Section `#ffffff` · Step index `--ink-on-dark-faint` ·
   Field label `--ink-on-dark` · Provenance `--ink-on-dark-faint` ·
   Inter / JetBrains Mono.
3. Section brightest ink = `#ffffff`.
4. STEP tag recolors `--act` → dim (also repairs the act=interactive-only
   role rule, globals.css "Role colors" block).
5. Field-label restyle scope = workbench **including LocationPickerModal**
   (one voice); the modal is in the before/after screenshot set.
6. `.check-desc` maps to the provenance role (the largest visual delta).
7. This folder is the PDF's committed home.
8. No glyph token this arc — glyph cell sizing is unsheeted (Rule 10),
   deferred to #227.

## Hardening candidates (logged, not acted on — GO rider R2)

- `GeneratorShell.rail-single-source.test.tsx:63` selects the under-CTA
  reason alert by the raw Tailwind class `text-[color:var(--fail)]`. Works
  today; a re-token of that alert's color would break the selector silently
  (test fails as "no alert on screen", not as a color assertion). Candidate:
  select by `role="alert"` position or a stable semantic class.

## Contents

- `red-proof-type-roles-test.txt` — the two-axis/mirror test failing
  against the pre-arc CSS (red-prove, GO sequence 4): pure half green,
  every `.tr-*` mirror assertion red. Turned green by the commit that
  landed the CSS blocks.
- `probes/contrast-measure.py` → `contrast-measurements.txt` — WCAG
  ratios for all four role colors on both panel surfaces, measured not
  asserted (Rule 13). All PASS; floor is `--ink-on-dark-faint` at
  6.19:1 on `--canvas` / 5.61:1 on `--canvas-tint`. The 0.35 pending-dim
  column is recorded for the record, not held to the floor (the body is
  `inert` + `aria-hidden`; the ◌ summary is the accessible path — #222).
- `live-checks/s2a9-live-checks.js` + `outS2A9LC/` — the local
  before/after run (GO sequence 7: BEFORE = main checkout dev at the
  pre-arc HEAD on :3111, AFTER = this branch on :3112; the prod re-run
  happens after ship). 11/11 assertions PASS (`assertions-raw.md`):
  computed-style spot checks for all four roles, the STEP tag's literal
  caps + dim ink, rail-entry byte-identity, and axe zero-new on both the
  pre-pin and pinned states (`axe-before.json` = `axe-after.json`:
  `[region]` pre-pin, `[label, region]` pinned — the known baseline).
  Screenshots: `before-/after-{shoulder,flagger,near-intersection,modal}.png`
  plus `after-*-gray.png` (CSS `grayscale(1)`) — the acceptance
  desaturation check; roles separate by luminance, family, casing, and
  decoration, never hue alone.
