# Handoff: Conestruct landing page + generator UI redesign

## Overview

Conestruct (conestruct.com) is a web tool that generates MUTCD-compliant traffic control plans ("MHT" — Method of Handling Traffic) for Colorado traffic control supervisors. A TCS describes a work zone scenario and the tool produces a PDF plan sheet, an Excel device list, and crew instructions in under two minutes.

This handoff covers two surfaces:

1. **Marketing landing page** at `conestruct.com` (`/`) — short, blueprint/plan-paper aesthetic with an animated "describe → plan" hero and a "show the math" section.
2. **Generator app UI** — facelift of the existing Streamlit generator to match the landing-page aesthetic. Sidebar form on the left, output panel on the right with download cards, audit trail accordion, and device breakdown.

## About the design files

The files in `prototypes/` are **design references created in HTML** — visual prototypes built with React + Babel-in-the-browser that demonstrate the intended look, behavior, and animation. They are **not production code to copy directly**.

Your task is to **recreate these designs in the production codebase** (most likely a Next.js / React + Tailwind setup for the marketing site, and either a custom Next.js UI calling your Python backend or a heavily themed Streamlit app for the generator). Pull values, layout, typography, and behavior from these prototypes, but rebuild the components using the established patterns of the target codebase. Do **not** ship Babel-in-the-browser to production.

## Fidelity

**High-fidelity (hifi).** All colors, typography, spacing, and interaction details in the prototypes are intended as final values. Recreate the UI pixel-perfectly using the target codebase's component library, but follow the visual specs in this README exactly.

---

## Brand & design system

### Colors

| Token | Hex | Use |
|---|---|---|
| `--orange` | `#E8710A` | Primary brand · CTAs · cones · accent dimensions |
| `--orange-deep` | `#C45F08` | Pressed/hover state on orange |
| `--orange-soft` | `#FCE9D6` | Pill backgrounds, highlight rows |
| `--navy` | `#1B2838` | Headings, body text, dark CTA backgrounds |
| `--navy-soft` | `#2A3B50` | Hover state on navy |
| `--blue` | `#2D9CDB` | Links, info accents |
| `--green` | `#27AE60` | Success/pass states, audit checks |
| `--green-soft` | `#DDF1E5` | Success pill background |
| `--red` | `#EB5757` | Error states |
| `--red-soft` | `#FBE0E0` | Error pill background |
| `--beige` | `#F5F0EB` | Page background |
| `--beige-deep` | `#ECE4D9` | Subtle differentiation (median, raised tints) |
| `--paper` | `#FAF6F0` | Card backgrounds, plan-sheet background |
| `--line` | `#D9CFC1` | Borders, dividers |
| `--line-soft` | `#E5DCCD` | Subtle dividers (dashed, soft separators) |
| `--ink` | `#1B2838` | Body copy |
| `--ink-mute` | `#5C6B7E` | Secondary copy |
| `--ink-faint` | `#8A95A4` | Tertiary copy, mono micro-labels |

Page background uses a faint blueprint grid (32px) drawn with `linear-gradient` borders at `rgba(27,40,56,0.04)`.

### Typography

- **Sans (UI + headings):** `Inter` 400 / 500 / 600 / 700.
- **Mono (technical metadata, labels, sheet strips):** `JetBrains Mono` 400 / 500 / 600.
- Use the mono face for **anything that reads like plan-sheet metadata** — sheet numbers, sign codes, dimension labels, citations, metric readouts. Headings, hero copy, and CTAs are sans.
- Type scale on the landing hero: `56px / 700 / -0.03em / 1.02 line-height`. Section heads: `36px / 700 / -0.02em`. Generator main head: `36px / 700`. Body: `16px / 400 / 1.55–1.6`.

### Tone of voice

- Professional, industry-native, no-nonsense. Use the right vocabulary: MHT, TCS, MUTCD, CDOT, S-630-1.
- Mono micro-labels are uppercase with `letter-spacing: 0.10em – 0.16em`. Treat them as on-sheet metadata.

### Recurring motifs

These are the visual signatures of the system. Reuse them:

1. **Blueprint grid** behind the page (`background-size: 32px 32px`, navy 4% opacity).
2. **Sheet metadata strip** — a horizontal strip beneath the nav with `SHEET: 01 / 03`, project name, issued date, by, scale. Mono, uppercase, `10px`, `0.12em` letter-spacing, `--ink-faint`.
3. **Eyebrow with tick** — `0X · SECTION NAME` orange mono uppercase, prefixed by a `24×1px` orange line. Used above each major heading.
4. **Corner ticks** on cards — four `12–14px` orange L-shapes anchored to each corner of important cards (formula cards, output cards), with the corresponding inner border edges hidden.
5. **Dimension lines** — orange `0.6px` extension lines + horizontal dim line + chevron tick arrows + a centered mono label sitting on a paper rectangle that masks the line. Used in the hero plan sheet, the math section taper viz, and as an aesthetic cue (top-bottom borders of stat strips).
6. **Construction orange used sparingly** — only on cones, dimension callouts, the primary CTA, key numerical readouts, and corner ticks. Everything else is navy on beige/paper.
7. **Mono progress bars / readouts** — small orange-on-beige progress fills with mono percentage text.

---

## Screen 1 — Landing page (`/`)

### Layout (top to bottom)

1. **Top nav** — `1280px` max width, `48px` horizontal page padding, `24px` vertical. Bottom border `1px var(--line)`.
   - Left: wordmark `conestruct` (Inter 700, 22px, `-0.02em`, navy). Beside it, `v0.4 · COLORADO · MUTCD 2023` in mono `11px` ink-faint.
   - Right: nav links (How it works, Sample plan, Sign in) sans 14/500 navy, then a navy CTA button **Try the generator →** (sans 13/600, `10×16px` padding, navy bg → orange on hover).

2. **Sheet metadata strip** — mono 10px uppercase, justified row of: `SHEET: 01 / 03`, `PROJECT: CONESTRUCT.COM / LANDING`, `ISSUED: 2026-04-26`, `BY: TCS · CDOT`, `SCALE: AS NOTED`. Bottom border `1px var(--line-soft)`.

3. **Hero** — two-column grid `1fr 1.15fr`, `64px` gap, `80px` top / `64px` bottom padding, vertically centered.
   - **Left column**:
     - Eyebrow: `01 · MHT GENERATOR · COLORADO`
     - H1 (56px, navy, `-0.03em`): _MUTCD-compliant **traffic control plans** in under two minutes._ The phrase "traffic control plans" is `--orange`.
     - Tagline row (mono 13px ink-mute) — words separated, each prefixed by a `6×6px` orange square dot. Default words: `Plan.` `Generate.` `Go.`
     - Sub copy (18px, ink-mute, `max-width: 460px`): _Describe a work zone. Conestruct computes the taper, buffer, device count and sign placement — then ships a stamped-ready PDF, Excel device list and crew narrative._
     - CTA row: orange primary button **Try the generator →** (16/600, `16×28px` padding, white text, `box-shadow: 0 1px 0 var(--orange-deep), 0 0 0 1px var(--orange-deep)`, `translateY(-1px)` on hover) + mono 11px `Free · No card · ~90 sec`.
   - **Right column** — animated demo of the product, two layers:
     - **Scenario card** (absolute, `top: -20px; left: -10px; width: 280px; z-index: 3`). White card with navy header strip (`8×12px`, mono 10/uppercase `0.12em`, "SCENARIO INPUT" + a 6px green pulsing dot). Body lists `key:` `value` lines as if being typed (38ms per char, 240ms pause between fields). Footer strip: phase label (INPUT / GENERATING / READY) + mono progress bar (`4px` tall, beige rail, orange fill) + percent.
     - **Plan sheet** behind it: 11×8.5 aspect ratio paper, `1px var(--line)` border, dropshadow `0 24px 48px -24px rgba(27,40,56,0.25)`, faint 24px grid overlay. Title block (top, white strip): "METHOD OF HANDLING TRAFFIC" + "SHT 1 OF 1 · MUTCD 2023 · CDOT S-630-1". Bottom split panel: legend (cone/sign/arrow swatches) + notes (Taper L, Buffer B, Spacing, Devices). Center stage: schematic SVG (1100×380 viewBox).
     - **Animation**: 4 reveal stages keyed off `--progress`. Stage 1 (12%): roadway lanes appear. Stage 2 (36%): closed lane fills with hatched pink, cones appear in taper + tangent. Stage 3 (64%): orange dimension lines for L, B, work zone draw on. Stage 4 (88%): green diamond signs (W20-1, W20-5, W4-2) and yellow arrow board fade in. After 100% → 800ms hold → loop after 5.5s.

4. **Stats / dimension strip** — full-width, top + bottom `1px var(--line-soft)` border, `14px` vertical padding, mono 11/uppercase `0.12em`. 4 stats separated by `· · · ·` characters: `~90s from scenario to PDF`, `3 scenarios supported`, `PDF + XLSX + MD in one click`, `100% MUTCD-cited`. The leading number in each stat is orange 600.

5. **Math section** (`02 · SHOW THE WORK`) — `96px / 80px` vertical padding.
   - Section head: `36px / 700` two-line H2 (_The math is the / product._), with a `var(--num) accent · SHOW THE WORK` mono label aligned baseline-right. Bottom border `1px var(--line)`.
   - Two-column grid `1.2fr 1fr`, `48px` gap.
   - **Left**: white **formula card** with the four orange corner ticks. Mono caption: `MUTCD § 6C.08 · MERGING TAPER LENGTH`. Below, the **formula display**: `28px` mono row showing `L = W × S = {W} × {S} = {L} ft`. Variables (`L`, `W`, `S`) in orange 600; result `{L} ft` in green 600; operators in ink-mute. Two range sliders below: lane width 9–14 ft (default 12), speed 25–75 mph step 5 (default 65). Inputs trigger live recompute. Slider thumbs are `16×16px` orange squares with white border + orange ring. Below the sliders: a paper-bg **taper viz** (SVG, 800×180 viewBox) showing live lane cross-section + cone placement + dimension lines that recompute. Footer of card: dashed top border + 3 citation chips: `✓ MUTCD § 6C.08`, `✓ CDOT S-630-1`, `✓ FHWA TABLE 6C-3`. Each chip has a 12×12 green check tile.
   - **Right**: 17px ink-mute lede paragraph (max-width 440), then a top-bordered **calc list** of 5 items. Each row: 36px mono num column (orange) · label (16/600 navy) + mono uppercase desc · right-aligned value (mono 13/600 orange) + mono 10/uppercase citation. Items: 01 Merging taper length, 02 Buffer space, 03 Channelizing device spacing, 04 Advance warning sign placement, 05 S-630-1 case match.

6. **Final CTA section** — full-width inside `.page` container. Navy bg `#1B2838`, beige `#F5F0EB` text, `80×64px` padding. White-on-navy faint grid overlay. Two-column grid `1.4fr 1fr` aligned to bottom.
   - Left: mono eyebrow `03 · GET STARTED · FREE DEMO` + 56px H2 _Stop drawing. **Start describing.**_ ("Start describing." is orange) + 17px paragraph at 70% opacity + orange CTA button (slightly larger: `18×32px`, 16px).
   - Right: spec-sheet two-column key/value table — OUTPUT, SHEET SIZE, STANDARD, SUPPLEMENT, TIME, PRICE. Mono 11px, label 50% opacity, value full opacity 500.

7. **Footer** — `32px / 48px` padding, top border, mono 11/uppercase `0.10em` ink-faint. Left: `© 2026 CONESTRUCT` · `BUILT IN COLORADO`. Right: `OUTPUT REQUIRES TCS REVIEW · NOT A SUBSTITUTE FOR LICENSED JUDGMENT`.

### Tweaks (variations to expose)

The prototype exposes these as a Tweaks panel. In production, expose them as either CMS knobs or A/B variants:

- **Tagline**: `Plan. Generate. Go.` (default) · `Describe / Download` · `Scenario → MHT` · `Fastest in Colorado`
- **Logo**: `wordmark plain` (default) · `with dot` (orange period) · `cone icon` (small orange triangle to left) · `[ brackets ]` (orange brackets around wordmark)
- **Hero layout**: `split` (default) · `stacked` (single column, scenario card stacks above plan sheet, max-width 720)
- **Color intensity**: `restrained` (orange limited to underlines + nav CTA) · `balanced` (default) · `orange-heavy` (page bg becomes orange, hero h1 highlight becomes white).

### Behavior / animation

- The hero animation runs on a loop. Per-character typing 38ms; 240ms pause between fields. Generation phase 70ms tick × 25 ticks = ~1.75s. Hold 800ms after 100%, then 5.5s pause, then restart.
- Live dot in scenario card header pulses 1.6s ease-in-out (opacity 1 → 0.35 → 1).
- Cursor blink 1s step-end.
- Plan-sheet reveal stages each transition `opacity 0.5s ease`, with delays `0ms / 300ms / 550ms / 850ms / 1100ms`.

---

## Screen 2 — Generator app UI

The current generator is a Streamlit app (see screenshot in `reference/`). This redesign keeps the same form fields and outputs **but intentionally diverges from the landing-page aesthetic** — the app is a **dark "workbench"** UI (CAD/drafting-board metaphor), not the beige paper of the marketing site. The landing page sells the product; the app is where TCSs do work and the dark canvas reduces eye strain on long sessions.

### Identity divergence (read first)

| | Landing page | Generator app |
|---|---|---|
| Page bg | `#F5F0EB` beige + 32px blueprint grid | `#14202E` dark navy "drawing board" |
| Cards | White / `#FAF6F0` paper | **Slate** `#243447` tinted dark surface (default) |
| Heading text | `#1B2838` navy on beige | `#FFFFFF` on slate cards |
| Body text | `#1B2838` ink | `#EAF0F7` ink-on-dark |
| Interactive accent | Orange | **Cyan `#2D9CDB`** (orange is reserved for outputs/dimensions/numerical readouts only) |
| Borders | `#D9CFC1` warm tan | `#28384B` rule lines |
| Frame | Standard padded layout | Technical-drawing **frame** around the entire app shell with corner ticks |

The orange/navy brand tokens, Inter/JetBrains Mono fonts, mono micro-labels, dimension callouts, eyebrows-with-tick, corner ticks, and citation patterns all carry over — the app reads as the same product, just in a darker working environment.

### Palette system (Tweaks-driven)

The app supports **four card palettes** via a Tweaks panel toggle. Each palette overrides a small set of CSS variables on `:root`:

| Palette | When to use | `--paper` | `--paper-deep` | `--heading-on-paper` |
|---|---|---|---|---|
| **slate** (default) | Production | `#243447` | `#1E2D3F` | `#FFFFFF` |
| vellum | Light alternative | `#F7F2EA` | `#EFE7DA` | `#1B2838` |
| bone | Cooler off-white | `#F4F1EC` | `#EAE5DD` | `#1B2838` |
| porcelain | Cool near-white | `#F2F4F6` | `#E6EAEE` | `#1B2838` |

Slate additionally overrides `--ink`, `--ink-mute`, `--ink-faint` (lighter), `--match-bg` / `--match-ink` (translucent orange tint with peach text instead of solid cream — stays readable on dark), `--orange` lifted to `#FF8A2E` for punch on dark, and the green/red soft pill backgrounds become translucent versions of their fg colors.

**Production decision needed:** keep the runtime toggle (useful for accessibility / user preference), or hard-code slate and remove the other three. Recommend: keep slate as the only palette in v1, drop the toggle.

### Layout

- **Frame** — the entire app shell sits inside a `1px solid var(--rule)` frame inset `8px` from each viewport edge, with **four orange corner ticks** (`L` shapes, ~`14px`) anchored to the outer corners. This is the "you are inside a drawing" cue.
- **Top toolbar** (CAD-style command bar, sticky, `52px` tall, bg `--canvas-tint` `#1B2838`, bottom border `1px var(--rule)`).
  - Left, divided into vertical cells by `1px var(--rule)` separators:
    - Brand cell: `conestruct` wordmark (Inter 700, 17px, `-0.02em`, `#EAF0F7`) + `v0.4` mono 10px ink-on-dark-faint.
    - Breadcrumb cell: mono 10/uppercase `0.10em`, `GENERATOR / NEW MHT` — slash and last segment in cyan.
    - Project case-id cell: mono 10/uppercase, `CASE: {caseId}` — `{caseId}` in orange.
  - Right: mono `MUTCD 2023 · CDOT` + ghost icon buttons (Recent, Settings, Help). Ghost button = `28×28px`, `1px var(--rule)` border, `--canvas` bg, mono `›` glyph.
- **Sheet rule strip** — a thinner version of the landing-page sheet strip, but rendered as a CAD ruler: tick marks every `40px` along the bottom border, mono 10/uppercase, `SHT 01/01 · MHT · S-630-1 · ISSUED 2026-04-26 · BY TCS` justified across.
- **App shell** — `360px 1fr` two-column grid below the toolbar, fills `100vh - 52px - frame`.

### Sidebar (`360px`, bg `--canvas-tint`, right border `1px var(--rule)`)

The sidebar is a **command-palette / inspector panel** feel, not a form. Dense, tabular, mono-heavy.

Header strip: `Scenario` (15/600, `#EAF0F7`) + `01 · INPUT` cyan mono uppercase right-aligned.

Three field groups, each with a sticky group label row (mono 10/uppercase `0.10em`, ink-on-dark-faint, bg `--canvas`, `8×22px` padding, top + bottom `1px var(--rule)` borders) showing `<group>` left and an index letter right:

**Group A — Roadway**:
- Road type: full-width custom select. Bg `--canvas`, `1px var(--rule)` border, white text, cyan chevron. No native styling.
- Speed limit: mono label `SPEED LIMIT` ink-on-dark-faint + right-aligned `{S} mph` in cyan 600. Range slider 25–75 step 5. Track is `--rule` `2px`; **thumb is a cyan square** `14×14px` with `2px var(--canvas-tint)` border + `1px` cyan glow ring (no rounded corners — square thumbs reinforce the technical feel). Hint below in mono 10/uppercase ink-on-dark-faint.
- Lanes per direction: chip-row of 4 (1 / 2 / 3 / 4). Chip = `--canvas` bg, `1px var(--rule)` border, mono 11px white. Active chip: cyan bg + cyan-deep border + white text + faint cyan glow `0 0 0 1px var(--cyan-glow)`.
- Lane width: range 9–14 step 0.5, `{W} ft` cyan readout.

**Group B — Closure**:
- Closure type: chip-row of 4 (Shoulder / Lane / Full road / Mobile).
- Work zone length: mono number input, same bg/border treatment as the select.
- Two **check-rows** (divided highway, night ops): horizontal strip, top + bottom `1px var(--rule-soft)` borders, `10×22px` padding, `14×14px` square checkbox (`--canvas` bg, `1.5px var(--rule)` border; when checked: cyan bg + white tick), 13px sans label, mono 10/uppercase ink-on-dark-faint description right-aligned.

**Group C — Location · OPT**:
- Address text input, two-column lat/lng inputs (mono), project name input. All inputs share the dark-canvas / cyan-focus treatment.

**Generate footer**: top border `1px var(--rule)`, `18×22 24px` padding, subtle `linear-gradient(to bottom, transparent, rgba(0,0,0,0.15))` background.
- **Generate button**: full-width orange primary (the only orange CTA in the app — generation is the moment outputs are produced). Same shoulders as the landing CTA.
- Below: mono 10px centered "Output requires TCS review".

### Main panel (`32×40px` padding, `max-width: 1100`, bg `--canvas`)

1. **Header**: cyan eyebrow `02 · GENERATOR` + H1 _Method of Handling Traffic — plan generator_ (28/700 `#EAF0F7`) + 14px ink-on-dark description (`#A8B5C6`).

2. **Status bar**: full-width strip, bg `--canvas-tint`, `1px var(--rule)`, left border `3px` in semantic color. Mono 11/uppercase. States:
   - `idle` — gray indicator + "AWAITING SCENARIO · fill the panel on the left, then generate".
   - `generating` — cyan indicator + "COMPUTING · taper · buffer · spacing · sign placement".
   - `done` — green indicator + "GENERATED · 3 validation warnings · all CDOT supplement checks pass" + green pill "READY FOR TCS REVIEW".

3. **Output cards** — three-up grid, 16px gap. Each card:
   - Bg `var(--paper)` (slate `#243447` by default), `1px solid var(--paper-line)` border, **two corner ticks** (top-left, bottom-right, orange).
   - Mono caption `A · DELIVERABLE 01` (letter is orange), ink-faint.
   - H3 (16/700, `var(--heading-on-paper)` — white on slate): Plan sheet / Device list / Crew instructions.
   - Mono meta line: `PDF · 11×17 LANDSCAPE · {caseId}` / `XLSX · CDOT BID-READY` / `MARKDOWN · SETUP + TAKEDOWN`.
   - Stat row: dashed top + bottom borders (`var(--paper-line)`), mono `lbl` left + huge mono **orange 22/600** number right (Devices / Unique types / Steps). On slate, orange is the lifted `#FF8A2E`.
   - Navy CTA button (`var(--navy)` bg, white text) "Download PDF ↓" / etc. Hover → orange. Disabled → `--paper-line` bg, `--ink-faint` text. Note: navy bg is intentional even on slate — it's the "dark CTA on dark card" pattern, distinguished by the lighter card surface.

   When status is `idle`: replace with an **empty state** card (dashed border, paper bg, 60×32 padding, centered).

4. **Verification & audit trail section**:
   - Section head: H2 (20/700 white) + `03 · SHOW THE WORK` cyan mono right-aligned.
   - Sub line: mono uppercase ink-on-dark-faint.
   - **Audit list** = vertical accordion. Each item is a paper-bg card.
     - **Head row** (clickable): 5-col grid `36px 1fr auto auto auto`, `14×18px` padding. Cells: orange mono num, `var(--heading-on-paper)` 14/600 title, orange mono 12/600 result, `var(--ink-faint)` mono 10/uppercase citation, `var(--ink-faint)` mono `›` chevron that rotates 90° when open. Hover bg `var(--paper-deep)`.
     - **Body**: dashed top border, `var(--paper-deep)` bg, padded `0 18 20 70`. Contains: lead paragraph, optional formula box (white-on-paper bg, mono 15px, `var(--heading-on-paper)` text), optional table (mono headers, soft borders, **active row uses `var(--match-bg)` + `var(--match-ink)`** — translucent orange + peach text on slate, solid cream + navy on light palettes), and a citation row at the bottom (mono 10/uppercase `var(--ink-faint)`, `display: flex` block-level, `12×12` green check tile).
   - 6 items: 01 Taper length · 02 Buffer space · 03 Channelizing device spacing · 04 Advance warning sign placement · 05 Colorado supplement requirements · 06 S-630-1 case reference.

5. **Plan details** section (only when `status === 'done'`): section head `04 · BREAKDOWN` + `device-table` (paper card, mono uppercase headers in `var(--paper-deep)` header row, `1px var(--paper-line-soft)` row borders). Columns: Device type / MUTCD code / Function / Qty (right-aligned mono orange 600).

6. **App footer**: top border `1px var(--rule)`, mono 10/uppercase `var(--ink-on-dark-faint)`, `24×40px` padding, `--canvas-tint` bg, copyright left + TCS-review legal right.

### Computation logic (already in your Python backend — replicate or reuse)

The prototype computes results client-side from form params; in production these come from your existing engine. For reference, the formulas the audit trail surfaces:

- **Taper length** `L`: if `S ≥ 45`, `L = W × S`. Else `L = W × S² / 60`. (MUTCD § 6C.08 / Eq 6C-1.)
- **Buffer space** `B`: lookup table by speed (`{25:155, 30:200, 35:250, 40:305, 45:360, 50:425, 55:495, 60:570, 65:645, 70:730, 75:820}`). Round speed to nearest 5. (MUTCD Table 6C-2.)
- **Channelizing device spacing**: `≈ S` ft on-center. (MUTCD § 6F.65.)
- **Cones**: `max(4, ceil(L/spacing)) + ceil(workLen/spacing)` total.
- **Drums**: when night ops, `ceil(cones × 0.25)`; else 0.
- **Signs**: 3-sign series for `S ≥ 45`, else 2.
- **Arrow boards**: 1 if closure is `lane` or `full_road`, else 0.
- **Case match**: shoulder + divided → Case 1A; shoulder + undivided → 1B; lane + divided → 2A; lane + undivided → 2B; full_road → 3A; mobile → M-1.

### Behavior

- All form changes are local state. Generate button → 1100ms simulated compute → recompute results → status `done`.
- The audit accordion: clicking an open item closes it; only one open at a time (your call — could allow multi-open).
- Download buttons are stubs in the prototype; wire them to your existing PDF/XLSX/MD endpoints.
- All visible numbers (`L`, `B`, spacing, devices, unique types, steps, case ID) recompute live as the form changes — even before the user re-clicks generate. Decide whether you want to keep this or gate the audit trail behind generate clicks.

---

## Files included

```
prototypes/
  landing.html             # Landing page (open in browser to preview)
  generator.html           # Generator UI (open in browser to preview)
  styles.css               # Landing-page styles + design tokens
  app-styles.css           # Generator app styles (shares same tokens)
  hero-anim.jsx            # Landing: scenario card + plan sheet + Schematic
  math-section.jsx         # Landing: math section + taper viz
  app.jsx                  # Landing: top-level App + Tweaks
  gen-sidebar.jsx          # Generator: sidebar form
  gen-main.jsx             # Generator: main panel (status, outputs, audit, breakdown)
  gen-app.jsx              # Generator: top-level App
  tweaks-panel.jsx         # Tweaks panel helper (only used by landing prototype)

reference/
  conestruct_brand_brief.md     # Original brand brief (full color/type/voice spec)
  conestruct_design_instructions.md  # Original design ask
```

## Recommended implementation path

1. Spin up a **Next.js + Tailwind** project for the marketing site. Configure design tokens (colors above + Inter / JetBrains Mono via `next/font`). Port `landing.html` as a single page at `/`, splitting hero/math/cta into components. Animate the hero with Framer Motion or `useEffect` timers (the patterns in `hero-anim.jsx` translate directly).
2. For the generator: either (a) **rebuild the UI as a Next.js route** (`/app`) calling your Python computation engine via an API, or (b) **theme Streamlit** with custom CSS injected via `st.markdown(..., unsafe_allow_html=True)` — note this won't get the chip-row, accordion, or dimension-strip patterns to look right, so option (a) is recommended.
3. Deploy to **Vercel**, add `conestruct.com` as the custom domain, point DNS at Vercel's records. Optional split: marketing on `conestruct.com`, app on `app.conestruct.com`.

## Things to keep in mind

- Construction orange should remain the rare hero color — only on cones, dimension callouts, primary CTAs (generate button), key numerical readouts (output card stat numbers, audit results, device qty column), corner ticks, and the case-id callout. **In the generator, cyan `#2D9CDB` is the interactive accent** (sliders, chips, links, focus rings, breadcrumb highlights) — orange is reserved for outputs/dimensions.
- The mono micro-labels and sheet-metadata strips are load-bearing; don't drop them — they're what gives the site its industry-native feel vs. generic SaaS.
- Don't add gradient blobs, abstract illustrations, stock photography, or playful tone. The user is a TCS, not a startup founder.
- The landing page is light/beige. The generator app is dark/slate. **This split is intentional** — the marketing site sells the product, the app is a working environment. Don't unify them.
- Mobile responsive: at `< 980px`, sidebar collapses above the main panel, hero goes single-column, output cards stack.
