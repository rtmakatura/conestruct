# #435 evidence: local browser run, before and after

2026-11-02. `script/shoot.mjs` runs Playwright Chromium at DPR 2, 1440x900 and 390x844, against a local `next dev`:
- **Before:** a git archive of `d1c415f` on :3462.
- **After:** this branch on :3461.

API calls go to the `.env.local` backend; no backend change. `/api/road-bearing` is stubbed with the Option C artboard's three roads. Raw figures are in `shots/text-before.json` and `shots/text-after.json`; the crops are in `shots/`.

## Measured (the same at 1440 and 390 unless split)

| check | before | after | target |
|---|---|---|---|
| gaps: strip → WHERE → WHAT → GENERATE → footer line (landing) | 18, 12, 12, 48 | **24, 24, 24, 24** | 24 |
| disclosure group → footer line (after Generate) | 40 | **24** | 24 |
| band head padding (`.a-open .a-head`) | 14 / 16 | **12 / 16** | 12 / 16 |
| collapsed band (`.a-fact`), strip | 13 / 16 | **12 / 16** | 12 / 16 |
| band body, generate frame | 18 / 16 | **16** | 16 |
| disclosure head | 0 / 16, min-h 48 | **12 / 16** | 12 / 16 |
| opened disclosure body (Reference): top padding, first child offset | 0 | **16 px, 17 (16 + the 1 px rule)** | 16 |
| picker head, picked row | n/a | **12 / 16** | 12 / 16 |
| in-scope text nodes under 12.5 px that aren't a short mono label | 7 (strip, hint, helper, WHAT line, reason, caption, draft line) | **0** (landing, picker) | 0 |
| landing targets | input 44, Pick on map 44 (48 at 390) | unchanged | ≥ 44 |
| picker rows | 45.5 / 62 (no floor) | **58.39** | ≥ 56 |
| Change | ~22 above 480 | **44** | 44 |
| "i details" (picker head, picked row) | n/a | 32 at 1440, 44 at 390 | rule 15 / 163 (not in ruling 3's list) |
| axe (landing, picker, after Generate) | 0, 0, 1 (`heading-order`, `#needs-you-h`) | **0, 0, 1** (the same pre-existing NEEDS YOU finding) | 0 in scope |

Contrast, ink against the nearest painted ground (after):

| pair | size / family | ratio |
|---|---|---|
| strip word | 11 mono | 9.84 |
| WHERE helper (`.tr-help`) | 13.5 Inter | 11.16 |
| Generate reason (`.tr-help`) | 13.5 Inter | 11.16 |
| WHAT line (`.tr-note`) | 12.5 Inter | 6.00 |
| footer line (`.tr-note`) | 12.5 Inter | 6.19 |
| picker title | 10 mono | 15.0 |
| road name | 13.5 / 600 Inter | 13.91 |
| row second line (`--ink-mute`) | 12.5 Inter | 8.19 |
| unpicked marker outline (`--pri-off-ink`, non-text, 3:1 floor) | | 3.75 |
| ROAD label | | 6.47 |
| Change | | 6.55 |
| disclosure count (`.tr-note`) | | 6.47 |
| Reference words (`.tr-note`) | | 6.47 |

## Copy as rendered (after)

- Strip: "◌ NO SITE CHOSEN YET".
- WHERE helper: "Type an address or two cross streets, the way an 811 ticket describes it. Or drop a pin on the map." The header has no hint.
- WHAT, collapsed: "Opens after you find the work".
- Generate: "Type an address or pick on map first, then Generate turns on." There's no caption.
- Footer line: "Draft, not a sealed plan. This is engineering reference, with every dimension cited to MUTCD or CDOT. A licensed PE must review and seal it before field use."
- Picker:
  - Header: "⚠ PICK THE ROAD · 3 FOUND", with "i details".
  - Rows: "East Colfax Avenue, westbound / Primary road · 1 m from your pin"; "… eastbound / Primary road · 6 m …"; "Pennsylvania Street, northbound / Residential street · 24 m …".
  - Details: "East Colfax Avenue, westbound · 271° · way 1547338992 · from OSM" (one per road).
  - Escape closes the details and leaves the picker open.
- Picked: "✓ ROAD East Colfax Avenue, westbound", with "i details" (the detected-from line, verbatim) and "Change".
- Disclosures: "✓ Checked & passed 13 checks, each cited"; "◌ Pending / not verified 3 not verified yet"; "i Reference Denver · Arterial · …".

## Out of scope, seen

- The Pricing quote row's provenance ("FYI: contractor estimate, …") is still mono 10.5. That row isn't one of the three disclosure headers ruling 6 names; it's group 5's.
- The open Checked body's inner lines (SCOPE caps, citations) are group 5's (ruling 6).
- `heading-order` at `#needs-you-h` is on the base too (NEEDS YOU, group 2).

## Crops (`shots/`)

`{before,after}-{1440,390}-landing.png`, `-picker-unpicked.png`, `-picker-picked.png`, `-disclosures-closed.png`, `-checked-open.png`, `-reference-head.png`; `after-*-picker-details.png`. Compare them with `OptionC.dc.html` (landing) and `OptionCDetail.dc.html` (picker, picked, section header).
