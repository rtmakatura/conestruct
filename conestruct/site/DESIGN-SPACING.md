# Spacing scale (issue #165)

Six steps, all on Tailwind's default grid. Every margin/padding on the
generator page uses one of these; `globals.css` pixel values use the px
equivalents.

| Step | px | Tailwind | Rule — applies to |
|---|---|---|---|
| **micro** | 4 | `1` | icon/label nudges, chip padding y |
| **hairline** | 6 | `1.5` | helper text under an input; title → subtitle |
| **tight** | 8 | `2` | micro-label (10px mono) → its content; in-form note inset y |
| **row** | 12 | `3` | form-row gap; section header → content; list-row inset y; banner inset y |
| **block** | 16 | `4` | gap between blocks inside a zone; card inset; banner inset x |
| **section** | 24 | `6` | gap between numbered zones (01/02/03) and their peers (context bar, status strip); large-panel gutter (setup panel, hero cells) |

Two banner tiers: **page-level banners** (status strip, draft note, error
ribbons) inset `12×16`; **in-form notes** inset `8×12`.

Exceptions (documented, deliberate):

- **QuotePanel estimate-table rows** (`py-1.5`) — tabular density, not a
  section gap. Kept off the scale on purpose.
- **`.audit-body` left inset** (68px) — aligns to the accordion's number
  column (`36px` grid column + `16px` gap), not a spacing-scale value.
- **`.jbar` internals** — pixel-measured geometric-stability slots
  (`.jbar-slot-*` in `globals.css`). Re-measure with
  `scripts/verify-jbar-stability.mjs` before touching any `.jbar` padding.
## LocationPickerModal (issue #166)

The modal is on the same six steps. Its roles map onto the page's:

- **modal gutter** — `px-6` (section 24), matching the generator page's
  panel gutter; the header, tab bar, status lines, footer, and every
  full-width strip share it.
- **nested road-candidate cards** — inset `8×12` (tight × row). The one
  role the page lacks: candidate cards stack inside an already-inset
  section, so they take a deliberately denser inset than the page's
  16px card step.
- Everything else (chips, hint nudges, row gaps) uses the page's role
  table above. Negative pull-ups (`-mt-1`) are allowed at on-scale
  magnitudes.

## Type roles (issue #226)

The setup panel's four label roles, adopted from the 2026-08-25 design
round (the PDF in `validation-artifacts/committed/s2-arc9-type-system/`,
p. 3). The authoritative table is `lib/design/type-roles.ts`; the
`.workbench .tr-*` blocks in `globals.css` are its mirror, and
`lib/design/type-roles.test.ts` asserts both the rule below and the
mirror's agreement.

| Role | class | family | casing | size | tracking | color | decoration |
|---|---|---|---|---|---|---|---|
| **section** | `tr-section` | mono 500 | UPPERCASE | 10px | 0.20em | `#ffffff` CHOSEN | none |
| **step index** | `tr-step` | mono 400 | UPPERCASE | 10px | 0.14em | `--ink-on-dark-faint` CHOSEN | none |
| **field label** | `tr-field` | sans 500 | Sentence case | 12px | 0 | `--ink-on-dark` CHOSEN | none |
| **provenance** | `tr-prov` | mono 400 | lowercase voice | 10px | 0.04em | `--ink-on-dark-faint` CHOSEN | dotted underline |

Rules:

- **The two-axis rule** (PDF p. 3, verbatim adoption): *any two label
  roles differ in at least two of family, casing, size, tracking,
  color, and decoration.* One axis of difference fails in grayscale, in
  print, and on a sun-washed tablet. **Weight is not an axis** — the
  500/400 weights above are extra, uncounted differentiation.
- **The voice rule** (PDF p. 4): *mono caps means the system is
  speaking; sentence-case sans means the user is.* If it labels a
  control, it is never uppercase.
- **Provenance "lowercase" is voice, not CSS** (GO ruling 1, Rule 9):
  the role carries **no `text-transform`** — do not re-add one.
  Provenance strings are authored in lowercase voice, but acronyms and
  edition names keep canonical casing (`MUTCD`, `S-630-1`, `OSM`,
  `TA-10`): edition naming is load-bearing.
- **The provenance dotted underline** marks the string inspectable
  (`text-decoration: underline dotted` — per-line, not `border-bottom`;
  it echoes the `.chain .seg[title]` there's-more idiom rather than
  forking it).
- **CHOSEN markers**: the PDF sheets *no* color values ("brightest
  ink / dim / mid") and no font family names — every color above and
  the Inter / JetBrains Mono families are CHOSEN (GO ruling 2, Rule
  12), mapped onto the existing workbench palette. Contrast measured
  (Rule 13), committed in the arc's evidence: floor is
  `--ink-on-dark-faint` at 6.19:1 on `--canvas`, 5.61:1 on
  `--canvas-tint`.
- **Glyph cell sizing is unsheeted** — deferred to #227 (Rule 10:
  nothing invented here). Rail entries share the step-index register
  but are navigation, not a label role; their vocabulary is #228's.
