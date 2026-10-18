# cc-prompt-landing-v2-page.md: build the new landing page at `/`

**Lane:** light lane. `/` only; copy, layout, CSS and SVG. No wire field, API route, middleware, gate, or scenario/audit/pricing logic. The form's submit is wired in the separate prompt `cc-prompt-landing-v2-form.md`; until that lands, the form renders but its button is disabled with "Opening soon".
**Ship hold:** build and preview, **do not ship**. The page ships only after the three prerequisites below are closed, and together with the form arc.

## Source of truth
Everything is in `design/landing-v2/` (copy this handoff folder there first, outside `app/`):
- `landing-v2-reference.html`: the approved page from the design canvas. Match its copy word for word, its section order, and its spacing system. It's one hand-written HTML file; rebuild it as proper components using the existing design tokens (`app/globals.css` `.workbench` scope). Don't paste it in.
- `hero-plan.svg`, `hero-plan-narrow.svg` (phones, ≤720px), `step1-plan.svg`: the drawn Colfax plan. Inline them as components. Every top-level `<g>` carries class `z` plus a key (`k-int`, `k-walk`, `k-taper`, `k-buffer`, `k-work`), which motion.css uses. `illus.py` is the generator, for reference only.
- `motion.css`: B (traffic + soft turn signals + arrow-board blink), C (hover/focus spotlight) and D (scroll reveal). All motion is inside `prefers-reduced-motion: no-preference`.
- `public/colfax-plan-dark.jpg`: stopgap for step 3. **Preferred:** render the Colfax plan from the generator in page colors (vector), and report if that isn't reachable from `/` without touching scenario logic. If it isn't, use the jpg.

## The spacing system (keep it exact)
Gutter `clamp(16px,4vw,40px)` · column 1240px · section padding `clamp(56px,6.5vw,88px)` top and bottom, with a 1px rule between sections · label→heading 32 · heading→content 48 · blocks inside a section 64 · card padding `clamp(20px,2.5vw,28px)` · panel header `14px 20px` · rows `12px 0`. Bordered grids use a 1px gap over a `--rule` ground so lines never double when they wrap. Square corners everywhere.

## Interaction
- **C, the spotlight:** the NEEDS YOU card's two rows and three numbers are `<button>`s. Hover **or focus** sets one class on the hero `svg.plan`: intersection row → `f-int`, sidewalk row → `f-walk`, 43 → `f-dev`, 50 ft → `f-taper`, 200 ft → `f-buffer`. Leaving or blurring clears it. Keyboard works.
- **Form controls:** "Kind of work" is radio tiles; "Hours" is a two-part segmented radio. Native inputs, visually hidden, with the visible state from `:checked`. Real `<label>`, `<fieldset>`/`<legend>`. Focus ring is 2px `--act-bright`, 2px offset.
- **D, scroll reveal:** CSS `animation-timeline: view()` is fine as progressive enhancement. If you prefer IntersectionObserver, keep it to a one-time 12px rise and the rule draw.
- **Phones:** nav links hide (wordmark + "SEND US A PAST JOB" stay), founders stack, hero uses `hero-plan-narrow.svg`, no horizontal scroll at 390px.

## Ruling to record
Landing page motion is an exception to the design system's "almost no motion": B, C and D only, all off under reduced motion. Add it to DESIGN-PRINCIPLES.md rulings, or tell me where it belongs.

## Prerequisites (separate issues; this page doesn't ship until they're closed)
1. **Geocoder:** a cross-street pair returns a street address ~1.5 mi off (`lib/geocode.ts:24`, `limit=1`, no proximity/type filter). Repro is in `conestruct-captures/landing-2026-10-17/geocoder-repro/`. The hero promises "drop a pin where the work is".
2. **MUTCD edition label (Rule 9):** the results Reference row says "MUTCD 2009 R2 (pinned)" while the sheet and nav say 11th Edition. The page cites "mutcd 11th edition" throughout.
3. **Colfax plan sheet:** it labels E Colfax at Williams "SHOULDER CLOSURE · DIVIDED HIGHWAY" and draws a median, and PROJECT reads "Untitled Project". Confirm or fix before the sample download goes live. Until then, the "Download the sample plan" button stays hidden.

## Also check before ship
- Every factual line against the copy doc's claim ledger, especially the Aurora "fee per additional review" (2020 PDF; verify current).
- `/privacy` covers the form data and the promise "used only to draft your comparison". Flag; don't rewrite legal text.
- Unslop rules on every string.

## Report
Preview URL; screenshots at 1440 and 390 (hero, form with a tile and Hours selected, hero with the intersection row focused); Lighthouse accessibility score; the list of anything you couldn't match from the reference, and why.
