# #435 production check on 3b89b45: 9 PASS, 0 FAIL, 0 N/A (at 1440 and 390)

2026-11-02, after SHIP VERIFIED (healthz `3b89b45dea13353d82f5f615e54809e40451a020`, served frontend at `3b89b45`).

`script/shoot.mjs` is `../script/shoot.mjs` with four changes:
1. `BASE` takes a full origin.
2. The axe path points at the main checkout's `conestruct/site/node_modules`; the build worktree that held the old path is gone.
3. The five phase checks read `phase !== 'before'`, so the `prod` phase uses this branch's selectors.
4. It waits for the counted disclosure tiers before reading them. The Reference row can mount first: the first run read only "Reference" at 1440, and that run was replaced.

`script/landing-copy.mjs` captures the landing's copy as served at 1440, saved in `shots/landing-copy-prod.json`.

It ran against https://www.conestruct.com/sandbox through the gate header, with no token printed, using Playwright Chromium at DPR 2, 1440x900 and 390x844. `/api/road-bearing` is stubbed with the Option C artboard's three roads. The Generate leg is a real render on the live backend. Raw figures are in `shots/text-prod.json`, and the crops are in `shots/`.

| # | check | 1440 | 390 | result |
|---|---|---|---|---|
| 1 | gaps strip → WHERE → WHAT → GENERATE → footer line = 24 | 24, 24, 24, 24 | 24, 24, 24, 24 | PASS |
| 2 | disclosure group → footer line after a Generate = 24 | 24 | 24 | PASS |
| 3 | header rows 12 / 16 (band head, collapsed band, strip, disclosure head, picker head, picked row); band body and generate frame 16 | all as ruled | all as ruled | PASS |
| 4 | opened disclosure body: 16 padding, first child at 16 + the 1 px rule | 16, 17 | 16, 17 | PASS |
| 5 | no in-scope text under 12.5 px outside a short mono label (landing, picker) | 0 | 0 | PASS |
| 6 | targets: input and Pick on map ≥ 44, rows ≥ 56, Change 44 | 44 / 44, rows 58.39, Change 44 | 44 / 48, rows 58.39, Change 44 | PASS ("i details" is 32 at 1440, 44 at 390, per call B4) |
| 7 | copy: landing (strip, WHERE helper, no WHERE hint, WHAT line, Generate line, no Generate caption, draft line) from `landing-copy-prod.json` at 1440; picker, picked row and disclosure counts from `text-prod.json` at both widths | as ruled | picker, picked, disclosures as ruled | PASS |
| 8 | contrast: text pairs ≥ 4.5 (lowest 6.00, the WHAT line); unpicked marker outline ≥ 3 (3.75) | as stated | as stated | PASS |
| 9 | axe: landing 0, picker 0; after Generate, only the pre-existing `heading-order` at `#needs-you-h` (NEEDS YOU, out of scope, on the base too) | as stated | as stated | PASS |

Copy read live:
- **Landing (1440):**
  - strip "◌NO SITE CHOSEN YET"
  - WHERE helper "Type an address or two cross streets, the way an 811 ticket describes it. Or drop a pin on the map."
  - WHERE header hint: none
  - WHAT "Opens after you find the work"
  - Generate "Type an address or pick on map first, then Generate turns on."
  - Generate caption: none
  - footer "Draft, not a sealed plan. This is engineering reference, with every dimension cited to MUTCD or CDOT. A licensed PE must review and seal it before field use."
- **Picker:** "⚠ PICK THE ROAD · 3 FOUND", "i details", "East Colfax Avenue, westbound / Primary road · 1 m from your pin", and the other two roads. Escape closes the details and the picker stays open.
- **Picked row:** "✓ ROAD East Colfax Avenue, westbound", "i details", "Change".
- **Disclosures:** "✓ Checked & passed 13 checks, each cited"; "◌ Pending / not verified 3 not verified yet"; "i Reference Denver · Arterial · …".

Crops: `prod-{1440,390}-landing.png`, `-picker-unpicked.png`, `-picker-details.png`, `-picker-picked.png`, `-disclosures-closed.png`, `-checked-open.png`, `-reference-head.png`.

Ryan's browser check is still open. This is a visible design change (R145).
