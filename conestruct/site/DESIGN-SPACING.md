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

## Panel structure + glyph vocabulary (issue #227)

The setup panel's structural rules, adopted from the committed design
PDF (`validation-artifacts/committed/s2-arc9-type-system/…pdf`) with
the GO rulings of 2026-08-27. The seven surfaces: fact strip,
jurisdiction band, one suggestion shape, resolved-state records,
corridor table + bar, schedule window reference block,
detected-vs-applied block (the last closes #214).

### One glyph vocabulary, panel-wide

The tier set (#219) plus the two #227 marks; the PDF's `!` maps to
`⚠`, its `○` to `◌`. Every glyph carries a word or sentence beside it
(Rule 13) and sizes its cell from `--glyph-cell`.

| Glyph | Meaning | Color |
|---|---|---|
| `▲` | delta / count-affecting (tier set) | `--dim` |
| `⚠` | changed / needs attention / conflicts | `--warn` |
| `✓` | confirmed or passing | `--pass` |
| `◌` | unevaluated / not set / pending — never a verdict | `--none` |
| `i` | reference (tier set) | neutral |
| `⌁` | proposed — a suggestion awaiting Confirm/Dismiss | `--ink-on-dark` CHOSEN (chromaless; the buttons are the interactive surface — `--act` stays interactive-only) |
| `×` | dismissed — a recorded decision, not a verdict | `--none` |

The corridor extent rows **dropped their hard-prefixed `✓`** (GO
ruling 5): they carry no verdict, and `✓` is reserved.

### Sizing tokens (CHOSEN, unsheeted — GO ruling 4)

Single-sourced in `lib/design/tokens.ts`, mirrored to `.workbench`
(`lib/design/tokens.test.ts` pins equality). The PDF names both needs
without numbers (Rule 12):

- `--glyph-cell: 16px` — the glyph column width (#226 ruling 8's
  deferral, landed here).
- `--bar-seg-min: 6px` — the corridor bar's minimum segment width;
  it deliberately over-draws small segments, so the bar is aria-hidden
  and the table stays the source of truth (PDF p. 5).

### Structural rules

- **The system-event container** (`.sys-event`): "a value the user
  didn't set is a system event, not a field annotation" (PDF p. 4).
  `.warn` = the promoted #198 handoff notes; `.confirmed` / `.dismissed`
  = resolved suggestion records. State changes reuse the container they
  replace — nothing vanishes on resolution.
- **No inline bold in the promoted disclosure sentences** (GO ruling
  2, a contract-preserving deviation from PDF p. 2): the four #198
  strings must stay single text nodes — testing-library's default
  matcher reads direct text-node children only, and the byte-identity
  suite passes unmodified. The container carries the weight instead.
- **The jurisdiction band** is the single-column adoption of the PDF's
  "row one" band: our panel is one column, so the two decision cards
  form their own full-width section directly below Location (pin →
  suggestions → confirm still reads top to bottom). Not a numbered
  step and not a rail entry (#228 owns rail vocabulary). Pre-pin it
  is pending like every downstream step (#222 mechanics).
- **The fact strip renders in the pinned state only** (GO ruling 1, a
  recorded deviation from the empty-state principle): pre-pin the
  Location step's job is the pick CTA + manual fallback (#222 gates
  everything downstream of the pin), and a strip of `—` cells above
  that CTA would compete with it. Cell labels ride the step-index
  register as micro-labels.
- **Resolution records are shell state** (GO ruling 3): cleared on pin
  move, never written to scenario state or the payload (the
  `handoff-summary.ts` precedent). The record distinguishes an absent
  key from an explicit null (`priorPresent`) so undo restores absence
  as absence — a confirm-then-undo payload is byte-identical to one
  that never confirmed (#179 semantics, asserted).
- **Schedule per-row verdicts are a display-only join** (GO ruling 6):
  presentation of one backend `hours_eval`; violations attribute to the
  window rows the backend's echo names; no client-side time arithmetic
  — backend authoritative. Real class-scoped rows from the #206 window
  data; the PDF's four rows were the designer's invention (its p. 6
  caveat anticipated exactly this).
- **Below ~900px the band's cards stack** — recorded, not designed
  (PDF p. 5): the mobile/tablet layout is future work and may change
  the band decision.

Out of scope here: #228 rail vocabulary, #224 site-conditions
retirement, #205 multi-jurisdiction boundary pins.
