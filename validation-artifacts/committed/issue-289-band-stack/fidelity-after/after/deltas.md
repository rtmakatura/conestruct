
### A · wrong token (a Direction A class with the wrong value) — 11 rows

| # | element | Part 2 rule | property | spec | measured | delta | states |
|---|---|---|---|---|---|---|---|
| 1 | provenance — time.sc-time | 6 | decoration | none | underline | ≠ | S5 S7 · both widths |
| 2 | provenance — span.tr-prov.a-deferred | 6 | size | 10.5px | 9.5px | -1px | S7 @380 |
| 3 | provenance — span.tr-prov.a-deferred | 6 | line-height | 15.75px (1.5) | 14.25px | -1.5px | S7 @380 |
| 4 | band header — div.a-head | 62 | border-bottom | 1px solid #223345 | 1px solid #34a9e8@0.3 | 0px | S7 · both widths |
| 5 | NEEDS YOU item — li.ny-item.is-changed<br>NEEDS YOU item — li.ny-item.is-attention<br>NEEDS YOU item — li.ny-item.ny-cond.site-correction-row<br>NEEDS YOU item — li.ny-item.ny-cond.site-condition-manual | 74 | column-gap | 14px | 12px | -2px | S5 S7 @380 |
| 6 | Apply row — li.ny-item.ny-apply.sc-apply | 78 | padding | 13px 16px 13px 16px | 14px 16px 14px 16px | +1px | S5 S7 · both widths |
| 7 | panel row — div.a-panel-row.is-deferred | 92 / 95.15 | grid | 1fr 92px 22px 92px | 272px 92px 22px 130px | +271px | S7 @1440 |
| 8 | WHAT grid — div.a-grid | 116 | grid tracks | 3 | 1 | ≠ | S7 @1440 |
| 9 | primary — button.a-pri.a-confirm | 130 | colour | #0c1622 | #6e7c8e | ≠ | S2 · both widths |
| 10 | primary — button.a-pri.a-apply | 130 | size | 15.5px | 13.5px | -2px | S7 · both widths |
| 11 | ledger action (recommended, on) — button.act.tr-step.is-on | 133 on | colour | #34a9e8 | #c8d1dd | ≠ | S5 · both widths |

### B · inherited old-page style — 5 rows

| # | element | Part 2 rule | property | spec | measured | delta | states |
|---|---|---|---|---|---|---|---|
| 12 | suggestion line — b.sugg-name | 6 | colour | #93a0b0 | #c8d1dd | ≠ | S3 · both widths |
| 13 | page padding — main | 24 / 160 | padding | 26px 40px 0px 40px | 26px 40px 30px 40px | 0px | all @1440 |
| 14 | download row — div.dls | 84 | renders at 380 | no (rule 168) | yes | ≠ | S5 S7 @380 |
| 15 | primary XL (Generate) — button.generate-btn | 131 | colour | #0c1622 | #6e7c8e | ≠ | S1 S2 · both widths |
| 16 | hero geometry cell at 380 — div.hero-meta | 169 | renders at 380 | no (rule 168) | yes | ≠ | S5 S7 @380 |

### C · missing rule (nothing declared; the body's 16 px or a browser default shows through) — 2 rows

| # | element | Part 2 rule | property | spec | measured | delta | states |
|---|---|---|---|---|---|---|---|
| 17 | panel was / now — span.a-val.a-was<br>panel was / now — span.a-val.a-now | 93 | size | 12.5px | 11.5px | -1px | S7 @380 |
| 18 | S7 body grid — div.a-body | 121 | grid | 240px 1fr | 318px | +78px | S7 @380 |

### Unmapped text nodes — no Part 2 rule names them (24)

| element | text | measured | where |
|---|---|---|---|
| button | Local | sans 12px/18px 400 #93a0b0 none | S3 · both widths |
| button | Collector | sans 12px/18px 400 #93a0b0 none | S3 · both widths |
| button | Arterial | sans 12px/18px 400 #93a0b0 none | S3 · both widths |
| button.a-discard | DISCARD | sans 13px/19.5px 500 #eaf0f7 none | S7 · both widths |
| span | 11×17 · TA-3 · S-630-1 | mono 10.5px/15.75px 400 #93a0b0 none | S5 S7 · both widths |
| span | CDOT BID-READY | mono 10.5px/15.75px 400 #93a0b0 none | S5 S7 · both widths |
| span | SETUP + TAKEDOWN | mono 10.5px/15.75px 400 #93a0b0 none | S5 S7 · both widths |
| span | EVERY CHECK CITED | mono 10.5px/15.75px 400 #93a0b0 none | S5 S7 · both widths |
| span | computed for 35 mph · taper, buffer, spacing and c | mono 10.5px/15.75px 400 #93a0b0 none | S7 · both widths |
| span.a-arrow | → | mono 11.5px/17.25px 400 #93a0b0 none | S7 · both widths |
| span.font-mono | ↓ | mono 9.5px/11.4px 400 #c8d1dd uppercase | S5 S7 · both widths |
| span.lbl-long | Taper L | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @1440 |
| span.lbl-long | Buffer B | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @1440 |
| span.lbl-long | Device spacing | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @1440 |
| span.lbl-long | Total devices | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @1440 |
| span.lbl-long | Verdict | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @1440 |
| span.lbl-long | Needs you | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @1440 |
| span.lbl-short | Taper L | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @380 |
| span.lbl-short | Buffer B | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @380 |
| span.lbl-short | Spacing | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @380 |
| span.lbl-short | Devices | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @380 |
| span.lbl-short | Verdict | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @380 |
| span.lbl-short | Needs you | sans 12.5px/17.5px 500 #eaf0f7 none | S7 @380 |
| span.sugg-glyph | ⌁ | mono 12.5px/12.5px 400 #c8d1dd none | S3 · both widths |
