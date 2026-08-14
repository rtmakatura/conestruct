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
