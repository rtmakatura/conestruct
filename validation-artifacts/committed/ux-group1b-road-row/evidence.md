# #436 evidence: picked-road row

2026-11-02. `script/shoot.mjs` runs Playwright Chromium at DPR 2, 1440x900 and 390x844 against a local `next dev` of this branch, with `/api/road-bearing` stubbed (two roads: pick "westbound", then the row with Change; one road: the auto-adopted row). Raw figures: `shots/facts.json`. Crops: `shots/{1440,390}-{two,one}-{closed,details-open}.png`, to compare with `RoadA.dc.html`.

| Check (#436 ruling) | 1440 | 390 |
|---|---|---|
| "East Colfax Avenue, westbound" on one line (1) | 1 line, row 407 wide | 1 line, row 340 wide |
| Name Inter 15 / 600, `--ink` rgb(234, 240, 247), 24 px in from the label edge (1) | yes (left 41 = 1 border + 16 pad + 24) | yes |
| Change: no border, `--act` rgb(52, 169, 232), 13.5 / 600, hit box 44 tall, inside the row (1) | 0px, 44 | 0px, 44 |
| Line 1 24 tall; gaps 8 (line 1 -> name) and 4 (name -> line 3); padding 12 / 16 (3) | 24 / 8 / 4 / 12px 16px | same |
| Line 3 Inter 12.5 `--ink-mute` rgb(174, 187, 204), "Primary road · 1 m from your pin · Details" (2) | yes | yes |
| Details underlined `--act`; opens the block, a second click closes it, Escape closes it and the picker stays open (2) | yes / yes / yes / yes | yes / yes / yes / yes |
| One road found: same layout, no Change (4) | yes, same 100.5 height | yes |
| No mono "i details" in the row; the picker header's "i details" still there after Change (5) | yes / yes | yes / yes |
| axe on the row, closed and open | 0 / 0 | 0 / 0 |

Row height is 100.5 closed at both widths in both cases (the #435 row, one line with the name wrapped, is in `../ux-group1-spacing-text/shots/after-*-picker-picked.png`).
