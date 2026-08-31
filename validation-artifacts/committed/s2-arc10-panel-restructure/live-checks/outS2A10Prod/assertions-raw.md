# s2a10 PROD live checks — raw log

- `2026-08-31T14:12:09.099Z` — P1: prod captures (https://www.conestruct.com/sandbox) —
- `2026-08-31T14:12:13.687Z` screenshot: prod-shoulder.png
- `2026-08-31T14:12:19.706Z` screenshot: prod-flagger.png
- `2026-08-31T14:12:22.430Z` screenshot: prod-near-intersection.png
- `2026-08-31T14:12:22.648Z` screenshot: prod-near-intersection-gray.png
- `2026-08-31T14:12:22.648Z` — P2: fact strip —
- `2026-08-31T14:12:23.740Z` **PASS** — pre-pin: no fact strip (GO ruling 1)
- `2026-08-31T14:12:24.286Z` **PASS** — pinned: five labeled cells (["Lat","Lng","Bearing","Speed","Jurisdiction"])
- `2026-08-31T14:12:24.288Z` **PASS** — jurisdiction cell answers "None — baseline" ("None — baseline")
- `2026-08-31T14:12:24.288Z` — P3: the band —
- `2026-08-31T14:12:25.598Z` **PASS** — band is a full-width sibling below Location
- `2026-08-31T14:12:25.599Z` **PASS** — pre-pin: the band body is pending (inert + aria-hidden)
- `2026-08-31T14:12:25.599Z` — P4: dismiss record + undo (read-only interaction) —
- `2026-08-31T14:12:26.964Z` **PASS** — proposal: ⌁ glyph + two explicit buttons
- `2026-08-31T14:12:27.006Z` **PASS** — dismiss: ×-record with sentence + evidence + Undo
- `2026-08-31T14:12:27.158Z` screenshot: prod-record-dismissed.png
- `2026-08-31T14:12:27.188Z` **PASS** — undo re-arms the live proposal
- `2026-08-31T14:12:27.339Z` screenshot: prod-record-rearmed.png
- `2026-08-31T14:12:27.339Z` — P5: corridor bar —
- `2026-08-31T14:12:27.343Z` **PASS** — five segments render, every one at least the 6px floor ([266,38,114,71,9])
- `2026-08-31T14:12:27.344Z` **PASS** — bar is aria-hidden (the table is the record)
- `2026-08-31T14:12:27.348Z` **PASS** — segment order matches row order (proportional rank agreement) (rows=[1500,217,645,400,50] segs=[266,38,114,71,9])
- `2026-08-31T14:12:27.352Z` **PASS** — extent rows carry no ✓ prefix (GO ruling 5)
- `2026-08-31T14:12:27.352Z` — P6: schedule window block —
- `2026-08-31T14:12:27.355Z` **PASS** — no jurisdiction: the one-row answer
- `2026-08-31T14:12:34.215Z` **PASS** — real class-scoped rows render ◌ '— set dates to check' ([{"glyph":"◌","label":"Arterial / Collector · Weekday","value":"— set dates to check"}])
- `2026-08-31T14:12:34.419Z` screenshot: prod-schedule-unevaluated.png
- `2026-08-31T14:12:34.419Z` — P7: the #214 repro on prod —
- `2026-08-31T14:12:42.948Z` **PASS** — picker: the bearing role note stands beside the field (GO ruling 7)
- `2026-08-31T14:12:43.361Z` screenshot: prod-214-picker-bearing-90.png
- `2026-08-31T14:12:43.500Z` **PASS** — #214 prod repro: detected AND applied bearing + the governs sentence (Detected vs appliedOSM detection · East Bayaud Avenue · way 39508704 · operator pickDetectedAppliedBearing85°90°Lanes per direction22Road typeRural — undividedR)
- `2026-08-31T14:12:43.698Z` screenshot: prod-214-detected-vs-applied.png
- `2026-08-31T14:12:43.698Z` — P8: axe vs the committed local baseline —
- `2026-08-31T14:12:45.833Z` **PASS** — axe prepin: violation ids == committed baseline (baseline=[region] prod=[region])
- `2026-08-31T14:12:45.833Z` **PASS** — axe pinned: violation ids == committed baseline (baseline=[label,region] prod=[label,region])

**ALL PASS**
