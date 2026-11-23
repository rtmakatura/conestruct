# #545: the no-pin ring, and the "Toggle attribution" button's tap area

Mission `ux-map-window-tidy` (tracking #546), item #545. Branch `issue-545-ring-attribution`, stacked on `issue-544-brackets-nowrap` (5737d8d2).

## The rulings

Ryan, 2026-11-22 (`docs/prompts/cc-prompt-ux-map-window-tidy.md`), verbatim:

> 1. **The no-pin mark.**
>    - With no pin, the mark beside "No pin yet" is a hollow ring: an `--ink-faint` outline, no fill.
>    - It turns into today's orange (`--dim`) dot only once a pin exists.
>    - The bar keeps its height and position.

> 4. **Mapbox's "Toggle attribution" button (24 x 24 at 1198).** If a CSS-only change gives it a 44 px tap area without changing how Mapbox's attribution looks or what it says, do that. If not, add it to #505's exception by name and record why. Don't hide or remove the attribution.

> 5. Inter only, tokens only, no new hex, 44 px targets (apart from #505's exception), axe clean. List every new string with its source. Unslop.

The same prompt, § Evidence, last paragraph, verbatim:

> Run axe and the 44 px measure. Also measure closing the window with Cancel and with the Close button, which #541's production check skipped. Commit the crops.

#505's ruling (Ryan, 2026-11-10, on issue #505), verbatim, for ruling 4's other branch:

> Mapbox's required logo and attribution links ("© Maxar", "© Mapbox", "© OpenStreetMap", "Improve this map") are an exception to the 44 px rule in every check, with a recorded reason.

## Plan (the prediction below was written before the diff)

1. **Problem.**
   - `conestruct/site/components/LocationPickerModal.tsx:1589` at 5737d8d2: the bar's mark is one `<span className="mw-cbar-dot">` whatever `hasPin` is, and `conestruct/site/app/globals.css:5594-5600` fills it with `--dim`. With no pin the bar shows a filled orange dot beside "No pin yet".
   - `conestruct/site/app/globals.css:7000-7009`: the 44 px rule for Mapbox's `.mapboxgl-ctrl-attrib-button` sits inside `@media (max-width: 480px)`. Mapbox shows that compact button whenever the map itself is 640 px wide or less, which the map window's map is at a 1198 px viewport (620.19 px wide, `../../ux-coords-in-search/prod-check/outcome.md:70`). There the button keeps Mapbox's own 24 x 24.
2. **Rulings.** 1, 4 and 5 above.
3. **Change.**
   - The mark carries `data-pin="true"` or `"false"` from `hasPin`. Its base rule is the ring (an `--ink-faint` border, no background); `[data-pin="true"]` is today's `--dim` dot. The box stays 10 x 10 in both states.
   - Ruling 4, the first branch, if the measure bears it out: one CSS rule gives the button a transparent `::after`, 44 x 44, centred on it. The button's own box, its icon and its ground are untouched, so nothing drawn changes. If the measure shows a visible change or less than 44 x 44, I take the other branch and amend this prediction before that diff.
4. **Rule 5 churn prediction.** Stated behaviour changes:
   - (a) With no pin, the bar's mark is a ring: `--ink-faint` outline, transparent inside. Before: a filled `--dim` dot.
   - (b) With a pin, the mark is the `--dim` dot, as before.
   - (c) In the map window, a click or tap within the 44 x 44 square centred on the "Toggle attribution" button reaches the button wherever nothing of Mapbox's own (an attribution link) is under the pointer. Before: only its own box (24 x 24 above 480 px).

   Unchanged, byte-identical: the bar's text in both states, its box (height 44, same x, y and width), the mark's 10 x 10 box and its 12 px gap, every string, every API body, the pin path, the road lookup, the search row and its list, the rail, device counts, Mapbox's attribution text, links, logo, icon and pill at every width, and the `@media (max-width: 480px)` rules.

   Files and lines predicted:

   | File | Predicted |
   |---|---|
   | `conestruct/site/components/LocationPickerModal.tsx` | +8 / -3 |
   | `conestruct/site/app/globals.css` | +40 / -3 |
   | `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | +45 / -0 |
   | `conestruct/site/components/tap-targets.test.ts` | +15 / -0 |
   | this folder | new: `rulings.md`, `red-proof.txt`, `walk.md`, `strings.md`, `before/walk.json`, `shots/`, `walk-script/` |

   No Python, no API route, no wire field, no string.

   **Amendment 1, written before the second diff.** The first build raised the attribution links above the `::after` (`position: relative; z-index: 1` on `.mapboxgl-ctrl-attrib-inner a`) so that each link kept its taps where the open line's last 6 px meet the `::after`. The walk on that build, compared with the walk on 5737d8d2, found the attribution's pixels changed: with the line open, 13 of 15,344 px inside its box at 390 (largest channel step 10 of 255) and 1 of 7,680 at 1198 (step 1); 1 of 6,360 on the full line at 1440 (step 1; that one pixel is in the final build's comparison too, `walk.md`). Ruling 4 allows the CSS route only "without changing how Mapbox's attribution looks", so that rule goes. Instead, while the line is open, the `::after` is cut back with a `clip-path` notch, 6 px wide and 20 px high, where Mapbox's line sits; nothing of Mapbox's is restyled or restacked. Change (c) then reads: with the line closed, the whole 44 x 44 square reaches the button; with it open, the square less that 6 x 20 notch does, and the notch still reaches Mapbox's line and its last link as it did before. The `globals.css` prediction stays +40 / -3. Those first-build numbers are in `first-build/` (its `compare.json` and both walks' attribution crops).
5. **Proof.**
   - Mounted tests in `LocationPickerModal.coords-bar.test.tsx` (the real modal, no pin and with a pin, and a pin placed from the search box), red on 5737d8d2's code first (`red-proof.txt`).
   - A browser walk at 1440x900, 1198x930 and 390x844, run once on 5737d8d2's code (`before/`) and once on the fix (`shots/`): the bar's box and the mark's computed style in both states, the ring's contrast from the computed colours, the button's box and its tap area probed point by point, a pixel comparison of the attribution with the rule on and off (collapsed and expanded), axe, the 44 px list, and closing with Cancel and with Close.

## Calls made (R145 self-ruled)

1. **R145 self-ruled: ruling 4, the first branch (CSS only).** A transparent 44 x 44 `::after` centred on Mapbox's button. Reason: the walk shows the tap area at 1198 goes from 625 to 1,936 of 1,936 probe points with the line closed, and the attribution's pixels, text, links and boxes are the same before and after (`walk.md`; `compare.json`). The button is not added to #505's exception; the 44 px check counts it.
2. **R145 self-ruled: with the line open at 1198, the tap area is the 44 x 44 square less a 6 x 20 px notch (1,816 of 1,936 points).** Mapbox's line ends 4 px from its 24 px button and the map ends 10 px to the button's right, so a full 44 px square has to lie over 6 px of Mapbox's line. The choices were: take those taps from Mapbox's "© Maxar" link; raise the links above the square (built first, and it changed the line's pixels, Amendment 1); or cut the square back there. I cut it back: Mapbox's attribution is a licence term, so its links keep every tap they had and nothing of Mapbox's is restyled. Outside the notch the square is whole (44 wide above and below the line, 38 wide beside it).
3. **R145 self-ruled: the mark's state is `data-pin="true"` / `"false"` on the one existing element, and the ring is the base rule.** With the attribute missing or false the mark draws as "no pin" (Rule 10: absence renders as absence). The element stays `aria-hidden`; the bar's words carry the state for a screen reader.
4. **R145 self-ruled: the ring's stroke is 2 px, CHOSEN (Rule 12).** The ruling gives the colour and "no fill", not a width. 2 px is whole pixels at 1x and leaves a 6 px hole in the 10 px mark. `border-box`, so the box stays 10 x 10. Measured 6.47:1 on the bar's ground.
5. **R145 self-ruled: the 44 px check in this item's walk probes the tap area.** A control whose box is under 44 passes only if every point of the 44 x 44 square centred on it reaches the control or one of Mapbox's marks. It is not a size cutoff and it names no control, so a small control of ours with no enlarged tap area still fails. #505's exception stays the logo and the attribution links, by selector, printed with the reason on every run.
6. **R145 self-ruled: the static guard goes in `tap-targets.test.ts`,** the file that already asserts the phone-width rule for this button.
7. **R145 self-ruled: Escape is walked beside Cancel and Close** as the control, since #541's production check closed every window with Escape and recorded only that the dialog was gone.

## Prediction against the diff

| File | Predicted | Actual |
|---|---|---|
| `conestruct/site/components/LocationPickerModal.tsx` | +8 / -3 | +5 / -2 |
| `conestruct/site/app/globals.css` | +40 / -3 | +36 / -0 |
| `conestruct/site/components/LocationPickerModal.coords-bar.test.tsx` | +45 / -0 | +64 / -0 |
| `conestruct/site/components/tap-targets.test.ts` | +15 / -0 | +42 / -0 |

- The two test files ran over the estimate: five cases in the first and four in the second, each block with its comment.
- `globals.css` shows -0 because the mark's old rule was edited in place (its `background: var(--dim)` line now sits in the `[data-pin="true"]` rule).
- This folder also holds what the prediction did not list: `compare.json`, `walk-script/compare545.mjs`, `first-build/` (Amendment 1) and the two `run.log` files.
- Behaviour: (a), (b) and (c) as amended, and nothing else. The walk found every box, the text, axe and the close paths the same before and after.

## Parked

Nothing.

## Follow-ups

None filed. #505 stays open as it was: its ruling asks for the exception's reason to be recorded once in shared code, and no shared 44 px check exists yet (each walk carries its own). This item did not need the exception.
