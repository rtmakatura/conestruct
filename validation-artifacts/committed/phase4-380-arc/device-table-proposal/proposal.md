# Phase 4 branch 3 (R139): the device table at 360, proposal (nothing built)

Measured 2026-10-13 on production (`/sandbox`, N Broadway SB, shoulder work, Generate, every
disclosure opened) with `devtable.cjs`. Options A–C are mockups: the CSS is injected into the live
page, so the data and the surrounding layout are real.

## What's there now

| | 360×800 | 1440×1000 |
|---|---|---|
| Table width | 356.4 px, right edge at 421.4 | 778 px, fits |
| Page scroll width | **421** (the phone widens the page) | 1440 |
| Rows | 11 devices | 11 |

The table also breaks MUTCD codes across lines ("G20-/1", "W21-/5aR") at 360 (`now-360.png`).

**The box it has to fit:** at 360 the opened device section sits inside three nested disclosure
frames, so the table's container is **230 px** wide (left edge at 65 px). Every option below has to
work in 230.

## The options at 360

| | A: stack | B: wrap | C: scroll in its own box |
|---|---|---|---|
| Page scroll width | 360 ✓ | 360 ✓ | 360 ✓ |
| Screenshot | `A-360.png` | `B-360.png` | `C-360.png`, `C-360-scrolled.png` |
| Device name | whole, one or two lines | broken mid-word ("CONST/RUCTI/ON") | whole, one line, cut by the fade when long |
| MUTCD code | whole, labelled "MUTCD" | whole | off-screen until scrolled |
| Function | whole | broken mid-word ("Advanc/e/warnin/g") | off-screen until scrolled |
| Qty | beside the name, labelled | visible | **off-screen until scrolled** |
| Table semantics | changes layout of `tr`/`td`, so the build must keep the table roles explicit | unchanged | unchanged |

## Recommendation: A, stack, at the phone width only

- **Every fact is readable without a gesture.** The quantity, the number a crew loads a truck from,
  stays on the first line beside the device name.
- **B fails at 230 px:** four columns cannot hold these words without breaking them.
- **C hides the quantity behind a sideways scroll** on every row, and the cue is the only thing
  telling the reader it's there.

**How it would be built:** `@media (max-width: 480px)` only, so the desk table is unchanged.
- Each row becomes a two-column grid: the name and the jurisdiction tag on the left, "QTY" and the
  number on the right, with "MUTCD" and the code under the name, then the function.
- The header row is hidden at the phone width; the "MUTCD" and "QTY" labels are real text in the
  markup, hidden at the desk, rather than CSS `content`, so a screen reader hears them.
- `role="table"`, `row`, `columnheader` and `cell` are kept explicit, because changing a `tr`'s
  `display` drops its table role in some browsers.
- A test that the page's scroll width is 360 at 360×800 with the schedule open, and that the desk
  table is unchanged.

**Alternatives:**
- **C with the quantity moved first** (Qty, Device, Code, Function): the number is visible
  without scrolling, but the code and function still need it, and the column order changes at
  every width or only on phones.
- **Separately (not R139):** the three nested frames that leave the table 230 px of a 360 screen.
  Flattening them would help every disclosure at the phone width; I'd raise it as its own item
  rather than fold it in.
