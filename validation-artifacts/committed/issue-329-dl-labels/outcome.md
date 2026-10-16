# #329 outcome: every download button's label fits on one line

## Ryan's ruling (2026-10-16), verbatim
> 1. Download buttons: in the output cards (e.g. "Crew instructions"), "Download PDF" and "Download .md" wrap onto two lines inside small boxes. Ryan finds it very ugly. Make every download button's label fit on one line at 1440, 360 and 320, keeping 44 px tap height (e.g. shorter labels like "PDF ↓" / ".md ↓", stack the buttons, or widen them). File an issue first, then post before/after at all three widths and stop for Ryan's look before shipping.

R145 self-ruled: shorter labels, Ryan's first example. Stacking would move the crew card's first button off the edge every card's first button shares (#261, P4), and the four-column grid leaves no room to widen.

## Built (`conestruct/site/components/OutputCards.tsx`, `28b49a8`)
- **Shared-row buttons say the format:** a card offering two formats (the crew card) labels them "PDF ↓" and ".md ↓" under its own title.
- **Full action stays in the accessible name:** "Download crew instructions PDF" / ".md". It contains the visible text (WCAG 2.5.3), and it's dropped while the button reads "Try again".
- **Single-button cards keep their labels:** "Download PDF ↓" / "Download XLSX ↓".

## Measured (`capdl.cjs`: a generated shoulder plan, every `.dl-btn`'s size and label lines)

| width | before (prod `41c74cc`) | after (preview `28b49a8`) |
|---|---|---|
| 1440 | crew buttons 87 px, **2 lines**; others 1 line | every button 1 line, 44 px tall |
| 1024 | crew buttons 87 px, **2 lines** | every button 1 line, 44 px tall |
| 360 | every button 1 line | every button 1 line, 44 px tall |
| 320 | every button 1 line | every button 1 line, 44 px tall |

No horizontal overflow at any width. The images are `before-*.png` and `after-*.png` (output cards, 2x).

## Tests
- **Updated:** `OutputCards.test.tsx`'s crew assertion now finds the buttons by their accessible names and pins the visible "PDF↓". It counts "Download PDF" texts as 2 (plan, audit), where it was 3.
- **Suites:** vitest 2,308 passed; tsc clean. No backend change.
