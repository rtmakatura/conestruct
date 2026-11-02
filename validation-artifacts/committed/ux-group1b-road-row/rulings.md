# #436 — picked-road row fits its panel (UX group 1b)

Ryan's rulings 1-5 (2026-11-02, Option A, "Picked-road row: 3 options") are quoted verbatim on #436.
Design reference: `RoadA.dc.html` on https://claude.ai/artifact/WYUpkwpZT2vHQUKVEt5br1.

## Calls (R145 self-ruled)

- **D1. The name's 15 px is `var(--fs-refusal)`.** It is the only 15 px token in `:root` (Part 2 rule 9), and 15px is already in the type census (landing v2's register). No size, token or hex is added; the census gains one site, `.workbench .road-picked-name`, under #435's tool-page exception.
- **D2. Change keeps a 44 px hit area without growing line 1.** The button is `min-height: 44px` with `margin-block: -10px`, so line 1 lays out at the mock's 24 px and the extra 10 px each side sits inside the band's 12 px top padding. It keeps `tap-44` (the tap-targets count is unchanged). The boxed hover fill goes with the box; a text button gets no hover (ruling 2's "no hover" read across the row).
- **D3. Details reuses InfoToggle's logic, not its markup.** The open state, the outside-click close and the capture-phase Escape (which stops the picker's own Escape) move into an exported `useDetailsToggle` hook in `InfoToggle.tsx`; `InfoToggle` and the row both call it. The row's box is the whole row, so a click on the row's own lines does not close it. The test ids `info-toggle-road-picked` and `info-road-picked` and the aria-label "Details for the picked road" stay.
- **D4. The Details block sits 8 px under line 3** (4 px of column gap plus 4 px margin), in `.tr-note` (Inter 12.5) `--ink-mute`, the same words as before (`CandidateCaption`). Gap CHOSEN; not a safety number.
- **D5. Details is an inline text button inside line 3**, so it takes the WCAG 2.5.8 inline exception; no tap-44.

## Churn prediction (Rule 5, before the diff)

- `components/LocationPickerModal.tsx` ~+40/-20
- `components/InfoToggle.tsx` ~+30/-20
- `app/globals.css` ~+50/-25
- `lib/design/type-exceptions.ts` ~+3/-2
- `components/LocationPickerModal.road-pick.test.tsx` ~+60/-5

Behaviour change, stated: the picked-road row goes from one line to three; "i DETAILS" and the boxed Change leave the row; nothing else moves (no payload, no backend, the picker header's "i details" untouched).

## Churn (predicted -> actual)

- `LocationPickerModal.tsx` ~+40/-20 -> +54/-24 (the row's JSX comment block and the Details button's ARIA attributes ran longer)
- `InfoToggle.tsx` ~+30/-20 -> +24/-13
- `globals.css` ~+50/-25 -> +52/-12 (the old row had fewer rules to remove than predicted)
- `type-exceptions.ts` ~+3/-2 -> +11/-4 (missed in the prediction: the `cssDeclarations` 177 -> 179 and `cssSizes` 32 -> 33 pins and their comments)
- `type-census.test.ts`: not predicted, +3 (the exception-sizes list takes `var(--fs-refusal)`)
- `LocationPickerModal.road-pick.test.tsx` ~+60/-5 -> +48/-2
