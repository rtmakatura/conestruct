# Design-token inventory — the generator column ("Direction A")

*Generated 2026-09-26 at git HEAD `0ddc85e`. Paths relative to `conestruct/site/` unless noted. Every value is quoted from source, not approximated; computed values show their source expression. Read-only investigation — nothing edited.*

*Verification: compiled by a read-only research pass, then spot-checked by subject against source (globals.css:818, :875, :881, :35-43; ink-exceptions.ts:170-179; AppNav.tsx:37-44; type-roles.ts:160-171; GeneratorShell.tsx:1749; DESIGN-SPACING.md:98-112): all matched.*

**For Claude Design, the one thing to know first:** the generator is dark-only. There is no theme toggle. "Light" is the old `:root` paper palette (landing, /terms, /privacy); "dark" is the `.workbench` scope that the generator column always lives in. Build the coming-soon page on the `.workbench` values (§1c) with square corners (§3c).

---

## 0. How theme is chosen

No `prefers-color-scheme`, no `data-theme`, no Tailwind `dark:` anywhere in `app/`, `components/`, `lib/`. Theme is **scope**:

- **Light** = `:root` (`app/globals.css:5-44`) — paper palette; used by `/terms`, `/privacy` (via `components/Nav.tsx`) and the archived landing.
- **Dark** = `.workbench` (`app/globals.css:747-962`). Comment `:744-746`: *"Workbench (dark generator app) overrides … Scope: any descendant of `.workbench`. The landing page stays untouched. Locks the slate palette (no runtime toggle)."*
- `/` (`app/page.tsx:4`) and `/sandbox` (`app/sandbox/page.tsx:11`) render `<GeneratorShell mode="sandbox" />`, whose root is `<div className={`workbench min-h-screen${inFlight ? " ws-locked" : ""}`} data-stage={genState}>` (`components/GeneratorShell.tsx:1711-1714`).
- Underneath: `<body className="font-sans bg-beige text-ink antialiased blueprint-grid">` (`app/layout.tsx:53`); `.workbench` covers it with `background: var(--canvas)` (`app/globals.css:951`).

`.workbench` base (`app/globals.css:951-961`):
```css
background: var(--canvas);
color: var(--ink-on-dark);
font-family: var(--font-sans);
font-size: 13px;
line-height: 1.5;
```
Body base `line-height: 1.6;` (`app/globals.css:53-55`).

---

## 1. Color tokens

### 1a. Defined in both scopes (dark overrides light)

| token | light (`:root`) | dark (`.workbench`) | file:line |
|---|---|---|---|
| `--orange` | `#e8710a` | `var(--dim)` → `#ff8a2e` | globals.css:6 / :940 |
| `--orange-deep` | `#c45f08` | `var(--dim-deep)` → `#e8710a` | :7 / :941 |
| `--orange-soft` | `#fce9d6` | `var(--dim-soft)` → `rgba(255, 138, 46, 0.16)` | :8 / :942 |
| `--green` | `#27ae60` | `var(--pass)` → `#4fd787` | :12 / :943 |
| `--green-soft` | `#ddf1e5` | `var(--pass-soft)` → `rgba(39, 174, 96, 0.2)` | :13 / :944 |
| `--red` | `#eb5757` | `var(--fail)` → `#ff7a7a` | :14 / :945 |
| `--red-soft` | `#fbe0e0` | `var(--fail-soft)` → `rgba(235, 87, 87, 0.2)` | :15 / :946 |
| `--paper` | `#faf6f0` | `#243447` | :18 / :834 |
| `--ink` | `#1b2838` | `#eaf0f7` | :21 / :840 |
| `--ink-mute` | `#5c6b7e` | `#aebbcc` | :22 / :846 |
| `--ink-faint` | `#8a95a4` | `#93a0b0` | :23 / :847 |

Dark `--orange/--green/--red/--cyan` are "legacy aliases — safety net so a missed var() reference can never fall back to the light :root palette. New code uses role names." (`globals.css:938-939`)

### 1b. Light-only (`:root`; inherited unchanged by `.workbench`)

| token | value | file:line |
|---|---|---|
| `--navy` | `#1b2838` | globals.css:9 |
| `--navy-soft` | `#2a3b50` | :10 |
| `--blue` | `#2d9cdb` | :11 |
| `--beige` | `#f5f0eb` | :16 |
| `--beige-deep` | `#ece4d9` | :17 |
| `--line` | `#d9cfc1` | :19 |
| `--line-soft` | `#e5dccd` | :20 |

### 1c. Dark-only (`.workbench`) — the generator column's palette

**Surfaces**

| token | value | file:line | note |
|---|---|---|---|
| `--canvas` | `#14202e` | :818 | "dark canvas (fix-spec-02 surface set)" |
| `--canvas-tint` | `#16232f` | :826 | Part 2 rule 1's `--panel2` "raised cell / nav ground" (:819-825) |
| `--da-ground` | `#101c29` | :810 | Direction A stack-component shell ground (:804-809) |
| `--da-hair` | `#223345` | :811 | Direction A inner hairline |
| `--panel-ground` | `#0f1c29` | :923 | "rule 90's panel ground" |
| `--panel-fail-ground` | `#1b1a12` | :926 | "Rule 95.4 7d" failed status row ground |
| `--ws-surface-rgb` | `15 26 38` | :863 | channel triplet |
| `--ws-surface` | `rgb(var(--ws-surface-rgb))` | :864 | also `rgb(var(--ws-surface-rgb) / 0.9)` at :5083, :5129 |
| `--rule` | `#2c3e53` | :827 | |
| `--rule-soft` | `#223244` | :828 | |
| `--raise` | `#22344a` | :829 | |
| `--raise-hi` | `#294056` | :830 | |
| `--paper` | `#243447` | :834 | "slate cards" |
| `--paper-deep` | `#1e2d3f` | :835 | |
| `--paper-line` | `#3a4d66` | :836 | |
| `--paper-line-soft` | `#2e4058` | :837 | |

**Inks**

| token | value | file:line |
|---|---|---|
| `--ink` | `#eaf0f7` | :840 |
| `--ink-bright` | `#ffffff` | :845 |
| `--ink-mute` | `#aebbcc` | :846 |
| `--ink-faint` | `#93a0b0` | :847 |
| `--heading-on-paper` | `#ffffff` | :848 |
| `--match-bg` | `rgba(232, 113, 10, 0.18)` | :849 |
| `--match-ink` | `#ffd9b0` | :850 |
| `--ink-on-dark` | `#c8d1dd` | :853 |
| `--ink-on-dark-faint` | `#93a0b0` | :854 |

**Role colors** — "one job each" (`globals.css:866-874`): act = INTERACTIVE; dim = OUTPUT/DIMENSION ("generated numbers only. Never interactive."); warn = WARNING ("never hue-alone"); pass/fail = verdict; none = "deliberately chromaless".

| token | value | file:line |
|---|---|---|
| `--act` | `#34a9e8` | :875 |
| `--act-bright` | `#56bcf2` | :876 |
| `--act-deep` | `#1f7bb0` | :877 |
| `--act-glow` | `rgba(52, 169, 232, 0.32)` | :878 |
| `--act-hair` | `rgba(52, 169, 232, 0.3)` | :927 |
| `--on-act` | `#0c1622` | :879 |
| `--dim` | `#ff8a2e` | :881 |
| `--dim-deep` | `#e8710a` | :882 |
| `--dim-soft` | `rgba(255, 138, 46, 0.16)` | :883 |
| `--warn` | `#f4c020` | :885 |
| `--warn-deep` | `#c79300` | :886 |
| `--warn-soft` | `rgba(244, 192, 32, 0.15)` | :887 |
| `--pass` | `#4fd787` | :889 |
| `--pass-soft` | `rgba(39, 174, 96, 0.2)` | :890 |
| `--fail` | `#ff7a7a` | :891 |
| `--fail-soft` | `rgba(235, 87, 87, 0.2)` | :892 |
| `--none` | `#93a0b0` | :893 |
| `--none-soft` | `rgba(147, 160, 176, 0.14)` | :894 |
| `--cyan` | `var(--act)` | :947 |
| `--cyan-deep` | `var(--act-deep)` | :948 |
| `--cyan-glow` | `var(--act-glow)` | :949 |

**Primary / field / verdict strip** ("TRACED to #281 comment 1, not chosen", :896-920)

| token | value | file:line |
|---|---|---|
| `--pri-off` | `#1d2c3c` | :905 |
| `--pri-off-ink` | `#6e7c8e` | :906 |
| `--fld-invalid` | `#6b2a2a` | :907 |
| `--vd-ready-line` | `#2d6b4d` | :915 |
| `--vd-ready-ground` | `#112620` | :916 |
| `--vd-flag-line` | `#6b5a18` | :917 |
| `--vd-flag-ground` | `#221e10` | :918 |
| `--vd-bad-line` | `var(--fld-invalid)` → `#6b2a2a` | :919 |
| `--vd-bad-ground` | `#231416` | :920 |
| `--conf-fill` | `#c6d2e0` | :930 |
| `--conf-empty` | `#33475e` | :931 |

**Locally scoped:** `--sc-act-wash: rgba(52, 169, 232, 0.14)` and `--sc-disabled: rgba(147, 160, 176, 0.35)` on `.workbench .needs-you` (:2092, :2093).

**Focus ring** (`globals.css:970-973`): `outline: 2px solid var(--act-bright); outline-offset: 2px;`
**Frame** (`globals.css:983-990`): `.workbench-frame { position: fixed; inset: 8px; border: 1px solid var(--rule); border-bottom: none; pointer-events: none; z-index: var(--z-frame); }`

**Contrast recorded in source (measured by earlier arcs, not re-measured here):** ring "7.74:1 on --canvas, 7.50:1 on --canvas-tint … 5.96:1 on the slate --paper cards" (`globals.css:967-969`); on `--ws-surface`: "--act 6.68, --act-bright 8.25, --ink 15.30, --ink-on-dark 11.39, --ink-on-dark-faint / --none 6.60, --warn 10.37" (`globals.css:859-862`).

### 1d. Tailwind `theme.extend.colors` (`tailwind.config.ts:13-46`) — literal hexes, do NOT follow `.workbench`

| key | value | line |
|---|---|---|
| `orange` / `orange-deep` / `orange-soft` | `#E8710A` / `#C45F08` / `#FCE9D6` | 15-17 |
| `navy` / `navy-soft` | `#1B2838` / `#2A3B50` | 20-21 |
| `blue` | `#2D9CDB` | 23 |
| `green` / `green-soft` | `#27AE60` / `#DDF1E5` | 25-26 |
| `red` / `red-soft` | `#EB5757` / `#FBE0E0` | 29-30 |
| `beige` / `beige-deep` | `#F5F0EB` / `#ECE4D9` | 33-34 |
| `paper` | `#FAF6F0` | 36 |
| `line` / `line-soft` | `#D9CFC1` / `#E5DCCD` | 38-39 |
| `ink` / `ink-mute` / `ink-faint` | `#1B2838` / `#5C6B7E` / `#8A95A4` | 42-44 |

Generator components use `text-[color:var(--…)]` arbitrary values instead (e.g. `components/AppNav.tsx:31,39`).

Clerk theme (`app/layout.tsx:43-50`): `baseTheme: dark`, `colorPrimary: "#2D9CDB"`, `colorBackground: "#0F1620"`, `colorText: "#E6EDF5"` — declared "third-party theme" at `lib/design/ink-exceptions.ts:131-138`. (Relevant if the gate shows a Clerk sign-in: these do not match the `.workbench` palette.)

### 1e. The two ruled decorative overlay hexes

| hex | name | file:line |
|---|---|---|
| **`#3fd3a8`** | "corridor overlay — work-zone channel" | `lib/design/ink-exceptions.ts:170-171` |
| **`#e0a63c`** | "corridor overlay — buffer channel" | `lib/design/ink-exceptions.ts:178-179` |

- Ruling field, verbatim: *"#281 ruling 181 — approved as decorative-and-labelled; Part 2 rule 12 names it with rule 74's overlay. Nowhere else."* (`ink-exceptions.ts:173`, :181)
- Also `DESIGN-PRINCIPLES.md:153` (repo root): *"Two off-palette hexes, decorative and word-labelled: the corridor overlay's work-zone channel `#3fd3a8` and buffer channel `#e0a63c`. Every channel has a word in the legend; no meaning by hue alone. Nowhere else."*
- **Status: RESERVED, not painted.** They sit in `INK_RESERVED` (`ink-exceptions.ts:168-185`): "A reserved row asserts ABSENCE … These are NOT a licence to use the hex" (:152-160); pinned by `lib/design/ink-literals.test.ts:256-258`. **"Nowhere else" means they must not appear on a coming-soon page.**
- What ships instead: `ZONE_COLOR` in `lib/corridor-zones.ts:32-36` — advance_warning `#FFD166`, transition `#F3722C`, buffer `#FF7A00`, work_zone `#1EC8A5`, downstream `#8A8A8A` (recorded deviation, `validation-artifacts/committed/issue-301-band-aerial/rulings.md:153-160`).

---

## 2. Type

### 2a. Families and loading (`app/layout.tsx`)

- `import { Inter, JetBrains_Mono } from "next/font/google";` (:2) — self-hosted at build by next/font; no `@font-face`/`@import` in globals.css.
- Inter: `subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap"` (:7-12)
- JetBrains Mono: `subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap"` (:14-19)
- `<html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>` (:52)
- Tailwind stacks (`tailwind.config.ts:47-50`): `sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"]`, `mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo"]`
- letterSpacing (`tailwind.config.ts:51-54`): `tightest: "-0.03em"`, `tighter: "-0.02em"`

### 2b. Role table — `lib/design/type-roles.ts:97-172` (source of truth; CSS mirror `app/globals.css:2671-2729`)

| # | role | cssClass | family | weight | casing | size | lineHeight | tracking | color | decoration | lines |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | section | `tr-section` | mono | 500 | `"uppercase"` | `"10px"` | `"1.2"` | `"0.18em"` | `"var(--ink)"` | `"none"` | 99-109 |
| 2 | step | `tr-step` | mono | 400 | `"caps-voice"` | `"10px"` | `"1.2"` | `"0.12em"` | `"var(--ink-on-dark-faint)"` | `"none"` | 113-123 |
| 3 | field | `tr-field` | sans | 500 | `"sentence"` | `"12.5px"` | `"1.4"` | `"0"` | `"var(--ink)"` | `"none"` | 126-136 |
| 4 | provenance | `tr-prov` | mono | 400 | `"lowercase-voice"` | `"10.5px"` | `"1.5"` | `"0.04em"` | `"var(--ink-on-dark-faint)"` | `"none"` | 141-151 |
| 5 | question | `tr-question` | sans | 600 | `"sentence"` | `"var(--fs-step-question)"` (22px) | `"1.25"` | `"0"` | `"var(--ink)"` | `"none"` | 160-171 |

- Role 5 also has `sizeBelow520: "var(--fs-step-question-520)"` (19px) (:166); CSS: `@container (max-width: 519px) { .workbench .tr-question { font-size: var(--fs-step-question-520); } }` (`globals.css:2725-2729`).
- Trace comments (verbatim): section `// TRACED — Part 2 rule 3, #eaf0f7 (#289 F2; was --ink-bright, GO rulings 2-3)` (:107); step `// Part 2 rule 4: "Not uppercased by CSS; write the string in caps"` (:117), `// TRACED — Part 2 rule 4, #93a0b0` (:121); field `// TRACED — Part 2 rule 5, #eaf0f7 (#289 F2; was --ink-on-dark)` (:134); provenance `// voice, not CSS — GO ruling 1` (:145), `// TRACED — Part 2 rule 6, #93a0b0` (:149); question `// TRACED — Part 2 rule 7 names `--ink` (#eaf0f7 in workbench scope)` (:169).
- Casing → CSS (`expectedDeclarations`, :186-188): only `"uppercase"` emits `text-transform: uppercase`; `caps-voice`, `lowercase-voice`, `sentence` emit `text-transform: none` (caps are written in the string).
- Governing rule (:7-9): "any two label roles differ in at least two of family / casing / size / tracking / color / decoration." Weight is "deliberately NOT an axis" (:14).

### 2c. The nine ruled sizes (#283, Direction A Phase 0)

Declared on `:root` `app/globals.css:35-43`; mirrored `lib/design/tokens.ts:32-51`; ruled `DESIGN-SPACING.md:254-289` (table :270-280).

| size | token | globals.css | tokens.ts | owner |
|---|---|---|---|---|
| 22px | `--fs-step-question` | :35 | :33 | Part 2 rule 7 — role 5 |
| 19px | `--fs-step-question-520` | :36 | :36 | rules 7 + 162 — below 520 |
| 17.5px | `--fs-primary-xl` | :37 | :38 | rule 131 — `.pri.xl` (GENERATE PLAN only) |
| 15.5px | `--fs-primary` | :38 | :40 | rule 130 — `.pri` |
| 15px | `--fs-refusal` | :39 | :42 | rule 9 — refusal sentence |
| 13.5px | `--fs-body-value` | :40 | :44 | rules 8 + 9 — body / item body |
| 12.5px | `--fs-field-label` | :41 | :47 | rules 5 + 17 — field label, symbols |
| 62px | `--fs-hero-numeral` | :42 | :49 | rules 10 + 81 — counts hero |
| 42px | `--fs-hero-numeral-380` | :43 | :51 | rule 169 — counts hero at 380 |

Part 2 rule texts are quoted in `validation-artifacts/committed/s2-arc32-type-sizes/part2-owners.md`; Part 2 itself is #281 comment 1 (not in the tree). `--fs-refusal` currently has no consumer.

Reference components:
- `.pri` (`globals.css:3227-3241`): `min-height: 56px; background: var(--act); color: var(--on-act); border: 0;` Inter 600 at `var(--fs-primary)`; hover `--act-bright` (:3243), active `--act-deep` (:3246).
- `.a-pri.is-xl` (`globals.css:4822-4825`): `height: 66px`.
- Hero numeral (`globals.css:3075-3088`): mono, `line-height: 1; font-weight: 500; color: var(--dim); letter-spacing: -0.02em; margin: 10px 0 8px;`

---

## 3. Spacing, layout, radius

### 3a. Layout / chrome custom props (`.workbench`)

| token | value | file:line |
|---|---|---|
| `--nav-h` | `52px` | globals.css:752 |
| `--rail-h` | `38px` | :753 |
| `--status-h` | `57px`; `80px` in the ≤480/380 block | :765, :3430 |
| `--pin-h` | `var(--rail-h)`; `0px` under `.workbench:not([data-stage="pre"])` | :771, :1493 |
| `--fact-min-h` | `48px` | :798 |
| `--z-strip` / `--z-nav` / `--z-frame` / `--z-band` | `30` / `40` / `60` / `70` | :812-815 |
| `--glyph-cell` | `16px` (CHOSEN, GO ruling 4) | :935 (mirror `lib/design/tokens.ts:28`) |
| `--bar-seg-min` | `6px` (CHOSEN) | :936 (mirror `tokens.ts:30`) |
| `--check-box-size` | `16px` `.check-list`; `14px` `.workbench .check-list` | :1462, :1465 |

Computed: `.workbench .zone { scroll-margin-top: calc(var(--nav-h) + var(--pin-h) + 8px); margin-bottom: 24px; }` (`globals.css:1485-1488`).

**Column** (`components/GeneratorShell.tsx:1749`): `<main className="px-10 pt-[26px] pb-[30px] max-w-[960px] mx-auto max-md:px-[14px] max-md:py-4">` — comment quotes Part 2 rule 24: "Column. Width 880 px, margin 0 auto. Page padding 26 px 40 px 0; when the column is the last thing on the page, 30 px bottom." and "880 + 2 × 40 = 960 outer" (:1743-1748).

**Breakpoints** (`tailwind.config.ts:6-11`): `sm: "640px"`, `md: "980px"`, `lg: "1280px"`, `xl: "1440px"`; `maxWidth.page: "1280px"` (:55-57).

**Motion** (`tailwind.config.ts:58-75`): `pulse` `"pulse 1.6s ease-in-out infinite"` (opacity 1 → 0.35 at 50%); `blink` `"blink 1s step-end infinite"`; `spin` `"spin 0.7s linear infinite"`.

**Blueprint backgrounds** (`globals.css:59-78`): `.blueprint-grid` `rgba(27, 40, 56, 0.04)` 1px at `32px 32px`; `-light` `rgba(255, 255, 255, 0.04)` at `32px 32px`; `-fine` `rgba(27, 40, 56, 0.05)` at `24px 24px`.

### 3b. Spacing scale (`DESIGN-SPACING.md:7-17`, verbatim)

| Step | px | Tailwind | Rule — applies to |
|---|---|---|---|
| **micro** | 4 | `1` | icon/label nudges, chip padding y |
| **hairline** | 6 | `1.5` | helper text under an input; title → subtitle |
| **tight** | 8 | `2` | micro-label (10px mono) → its content; in-form note inset y |
| **row** | 12 | `3` | form-row gap; section header → content; list-row inset y; banner inset y |
| **block** | 16 | `4` | gap between blocks inside a zone; card inset; banner inset x |
| **section** | 24 | `6` | gap between numbered zones (01/02/03) and their peers (context bar, status strip); large-panel gutter (setup panel, hero cells) |

":16-17: Two banner tiers: **page-level banners** (status strip, draft note, error ribbons) inset `12×16`; **in-form notes** inset `8×12`." Exceptions :19-27.

### 3c. Radius

**No radius tokens.** Every `border-radius` in globals.css is `0` (lines 157, 165, 279, 1658, 2055, 2997); comment :3681 "No radius, no appear/disappear motion (spec 21)". Only `rounded-full` on spinner/dot glyphs and `rounded` on two map tooltips. **Square corners.**

### 3d. Glyph vocabulary (`DESIGN-SPACING.md:98-115`, verbatim)

> ### One glyph vocabulary, panel-wide
>
> The tier set (#219) plus the two #227 marks; the PDF's `!` maps to `⚠`, its `○` to `◌`. Every glyph carries a word or sentence beside it (Rule 13) and sizes its cell from `--glyph-cell`.

| Glyph | Meaning | Color |
|---|---|---|
| `▲` | delta / count-affecting (tier set) | `--dim` |
| `⚠` | changed / needs attention / conflicts | `--warn` |
| `✓` | confirmed or passing | `--pass` |
| `◌` | unevaluated / not set / pending — never a verdict | `--none` |
| `i` | reference (tier set) | neutral |
| `⌁` | proposed — a suggestion awaiting Confirm/Dismiss | `--ink-on-dark` CHOSEN (chromaless; the buttons are the interactive surface — `--act` stays interactive-only) |
| `×` | dismissed — a recorded decision, not a verdict | `--none` |

> The corridor extent rows **dropped their hard-prefixed `✓`** (GO ruling 5): they carry no verdict, and `✓` is reserved. (:114-115)

Rail states (`DESIGN-SPACING.md:183-189`): done `✓` (no word, `--pass`); attention `⚠` "needs attention"/blocker (`--warn`/`--fail`); pending `◌` "pending" (`--none`); notset `◌` "optional · not set" (`--none`); stale `▲` "detection stale" (`--dim`).

**Supersession:** `globals.css:2095-2100` — "▲ detected is --warn, not --dim. Part 2 rule 18: '▲ #f4c020 … A symbol never changes hue by context'". The `--dim` entry in the DESIGN-SPACING table predates this.

**For a coming-soon page:** `✓` is reserved for verdicts — do not use it decoratively (the old landing's green ✓ citation chips would violate this).

---

## 4. Wordmark "conestruct."

**Text, not an asset.** No `public/` directory; no logo/wordmark SVG anywhere in `conestruct/site`.

Generator column (`components/AppNav.tsx:37-44`):
```tsx
<Link
  href="/"
  className="flex items-center gap-3 px-5 border-r border-[color:var(--rule)] font-sans font-semibold text-[14.5px] tracking-[-0.01em] text-[color:var(--ink)] hover:text-[color:var(--act)] transition-colors"
>
  <span>
    conestruct<span className="text-[color:var(--dim)]">.</span>
  </span>
</Link>
```
- Comment :33-36: *"Part 2 rule 22: the wordmark 'conestruct.' is Inter 600 14.5 px #eaf0f7, letter-spacing −.01em, the period #ff8a2e (it was 700 / 16 px / #ffffff). The v0.4 tag is gone (ruled Q2)"*.
- Resolved: Inter 600 · 14.5px · −0.01em · `--ink` `#eaf0f7` · period `--dim` `#ff8a2e` · hover `--act` `#34a9e8`.
- Nav container (:31): `sticky top-0 z-[var(--z-nav)] flex items-stretch justify-between h-[var(--nav-h)] border-b border-[color:var(--rule)] bg-[color:var(--canvas-tint)]`; nav items (:61): `font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--ink-on-dark-faint)]`.
- Same markup at `app/app/page.tsx:53`. Prototype match: `validation-artifacts/committed/issue-289-band-stack/prototype/band-stack.html:36,47-48`.

Old version (`components/Nav.tsx:8-13`, used by `/terms`, `/privacy`, archived landing): Inter 700, 22px, `tracking-tighter` (−0.02em), `#1B2838`, hover `#E8710A`, **no period**, followed by "v0.4 · Colorado · MUTCD 2023" (ruled gone in the new wordmark, Q2).

Footer (`components/AppFooter.tsx:37`): `px-10 py-6 border-t border-[color:var(--rule)] bg-[color:var(--canvas-tint)] font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--ink-on-dark-faint)]`, text "© 2026 Conestruct · Built in Colorado".

---

## 5. Inconsistencies a designer will trip on

1. **Tailwind color names ignore the dark scope** — `text-orange` is `#E8710A` everywhere, `var(--orange)` in `.workbench` is `#ff8a2e`. Same split for `ink`, `paper`, `green`, `red`. Use `[color:var(--token)]`.
2. **Same name, different meaning per scope** — `--paper`, `--ink`, `--ink-mute`, `--ink-faint`, `--orange*`, `--green*`, `--red*` (§1a).
3. **One gray, three names** — `--ink-faint`, `--ink-on-dark-faint`, `--none` all `#93a0b0` (:847, :854, :893). `--dim-deep` `#e8710a` = light `--orange`.
4. **DESIGN-SPACING.md type-role table (:54-57) is stale** — superseded by #289 F2 in `type-roles.ts:40-59`; rail register text :207-209 likewise.
5. **Stale "only one consumer" comments** — `globals.css:32-34`, `tokens.ts:24-25`, `DESIGN-SPACING.md:282-284`, `globals.css:2708`; eight of nine sizes are now consumed (`--fs-refusal` is not). `DESIGN-SPACING.md:239,304` still says hero numeral "76/60"; CSS uses 62/42.
6. **Column-width comment stale** — `globals.css:4006-4007` says `max-w-[1180px]`; `GeneratorShell.tsx:1749` is `max-w-[960px]`. `.wb-row` still caps at 1180px (:3753).
7. **Two disabled-primary treatments** — `.workbench .pri:disabled` `var(--rule)`/`var(--ink-on-dark-faint)` (:3252-3255) vs `.a-pri:disabled`/`.dl-btn:disabled` `--pri-off`/`--pri-off-ink` (:4804-4808, :3350-3352).
8. **Two focus rings** — global `var(--act-bright)` (:971); `.pri:focus-visible` `var(--act)` (:3249).
9. **Nav height** — `--nav-h: 52px` vs Part 2 rule 21's 48 (flagged RULING NEEDED in `band-stack.html:26-29,37`).
10. **Corridor channel colors** — ruled `#3fd3a8`/`#e0a63c` reserved and unpainted; `ZONE_COLOR` ships (§1e).
11. **Old handoff prototype values differ** — `design_handoff_conestruct_new/prototypes/gen-app.jsx:37-57` (May 2026, pre-Direction A): `--ink-mute #A8B5C6`, `--ink-faint #7E8DA1`, `--green #5BD68A`, soft alphas 0.22. **Do not take values from it**; `globals.css` `.workbench` is current.
