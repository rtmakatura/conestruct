# landing-form-polish rulings

## The round's prompt, word for word (cc-prompt-form-polish.md, 2026-10-19)

> # cc-prompt-form-polish.md: two fixes in the lean page's form
> 
> **Lane:** light lane. Branch `landing-form-polish` off main (`f2006b5` or later). **Don't ship.** Ryan reviews the preview, then types `ship landing-form-polish`.
> 
> Ryan found these on production (www.conestruct.com, the "Send us a job you've already permitted" form at 1440):
> 
> ## 1. The Hours control has no top border
> The "Daytime | Night" control shows its left, right and bottom borders and the divider between them, but no top border. Every other field in the form has all four.
> 
> - Find the cause in the CSS. Likely suspects are a collapsed border, a negative margin, the group's label or legend overlapping it, or `overflow` clipping.
> - Fix it so the control has a full 1px border on all four sides, the same colour as the other fields.
> - Make its outer height match the Side of the road and Length fields next to it (46px).
> - Check the selected state, the hover state and the keyboard focus ring on both options too.
> 
> ## 2. Kind of work: the four options on one line
> At 1440 the four options wrap to two lines ("Something else" drops to a second line). They should sit in **one row at 1280 and wider**.
> 
> - **Don't change the labels.** The text stays exactly: Shoulder work, Flagger lane closure, Lane closure near an intersection, Something else.
> - **Make room in this order, stopping as soon as they fit at 1280:**
>   1. Tighten each option's side padding and the gap between the radio dot and the label.
>   2. Tighten the gap between options to 6px.
>   3. Give the form column more of the row: change the form/side split from 1.5 : 1 to 1.75 : 1 and shrink the gap between the columns. The side panel's text must still not wrap mid-phrase badly.
> - **Limits:**
>   - Options keep a 44px minimum tap height.
>   - The label font size stays where it is.
>   - Nothing may overflow its column.
> - **Below 1280:** the options may wrap. Phones are out of scope (the mobile pass is deferred), but 390 must not break.
> - **If they still don't fit at 1280 after all three steps:** stop and report the overflow in px. Don't change the copy.
> 
> ## Checks before you report
> - **Screenshots of the form at 1440, 1280 and 390:**
>   - The Hours control has its full border.
>   - Kind of work is one row at 1440 and 1280.
> - **Hours:** crop it in four states (rest, hover, selected, keyboard focus).
> - **Basics:** the light check at 1440 and 390 (axe, contrast, tap targets, no sideways scroll, page errors).
> - **Form:** the #346 tests still pass unchanged.
> - **Tests and gates:** vitest, tsc and lint are clean, the diff-verifier passes and CI is green.
> 
> ## Report
> The sha, the preview URL, the screenshots, what caused the missing border, and which of the three steps it took to fit the options. End with the `result:` line naming `landing-form-polish`.

## Flags (light lane, built with CC's recommended default)

- **P1. 46 px vs 48 px.** The prompt says the Side of the road and Length fields are 46 px tall. Measured on main `f2006b5` at 1440, 1280 and 390, they are 48 px (`.lv-input` min-height 48). The Hours control matches the fields as measured: 48 px outer (1 px border + 46 px option + 1 px border). It was already 48 px before; the change is how its edge is drawn.
- **P2. The missing top border: not reproduced; the structural difference removed.** Every other field draws its edge with a CSS `border`. The Hours control didn't: `.lv-segs` had `padding: 1px` over a `var(--rule)` background, and the two options' own backgrounds covered everything but that 1 px ring and the 1 px gap between them. That is the only way it differed from the fields beside it, and it's the likely cause, but I couldn't make the top edge disappear. On production `f2006b5` at 1440, the old control's top edge matched Length's (`#2c3e53`, the same strength) in all of these: headless Chromium at device scale 1 and 1.5, headed Chrome at 100% and with the display scale forced to 0.9, 1.1 and 1.25, and Firefox and WebKit at 100%. Headless screenshots at 1.25 (and below 1) showed a blended edge on both Hours and Length alike; that's the screenshot's resampling, not the page, and real Chrome at those scales draws both edges solid. The fix draws the control the fields' way: `border: 1px solid var(--rule)` on `.lv-segs` and a `border-left` divider on the second option. A real border always paints at least one device pixel. If Ryan still sees the top edge missing on the preview, the browser, zoom level and display scale he's using are the next thing to know.
- **P3. Kind of work took all three steps.** Step 1 (chip padding 14 → 7 px, dot gap 10 → 6 px) and step 2 (gap between options 8 → 6 px) weren't enough on their own: the row needed 714.5 px with 8 px padding and the form column was 657.6 px at 1280. Step 3: the split is 1.75 : 1, and the column gap is a fixed 32 px (was `clamp(32px, 5vw, 72px)`, i.e. 64 px at 1280 and 72 at 1440). A gap that grows with the width left only 0.3 px of room at 1440, so it's fixed. Result: one row at 1280 and 1440 with 10.8 px to spare.
- **P4. Side panel wrap.** At the new width (410 px) step 2's line wrapped to leave "back." alone on its own line. `text-wrap: pretty` on the How-it-works items moves the break earlier ("…send the four / files back."). CSS only; no copy change. At 390 it also changes step 3's break to "…the plan that / got approved."
