# #450 production check on 11402d0 (2026-11-07)

SHIP VERIFIED: `/healthz` sha is `11402d0269589706fc26d7931b66645ca76f7dff`, which is `origin/main`; the served frontend at 11402d0 was confirmed at the ship.

Run: `script/walk-prod.mjs` against https://www.conestruct.com/sandbox. Everything live: geocoding, `/api/road-bearing` (no stub, no Overpass replay), the generate, the audit and the audit PDF. The context comes from the shared helper `scripts/gate.cjs` `newGatedContext`; the gate token from `conestruct/site/.env.local` (`GATE_BYPASS_TOKEN`), never printed or saved. Chromium at DPR 2 (crops saved at CSS scale to keep them small), 1440x900 and 390x844. Plan: 1600 E Colfax Ave, Denver, East Colfax eastbound, kind Shoulder, One-way, Generate through the page, as the local walk. Numbers: `walk/walk.json` (every attempt kept).

**Result: PASS at 1440x900 and 390x844 on live data.** Live road detection was up: the one `/api/road-bearing` call per run answered `ok` with 4 candidates.

| Check | 1440x900 | 390x844 |
|---|---|---|
| Clerk loads (`window.Clerk.loaded`; clerk.conestruct.com answered 307 then 200; no Clerk console error) | PASS | PASS |
| Gate header only on the site's own host (measured per `route.fetch` hop, see below) | PASS: www.conestruct.com 49 of 49 hops; no other host | PASS: www.conestruct.com 48 of 48; no other host |
| Strip, questions open | "Plan ready. Answer 3 quick questions before you send it." | same |
| Strip after the 3 NEEDS YOU questions (first option each): "… under Not checked yet …" | PASS: "Plan ready. 1 item above and 3 under Not checked yet need a check before field use." | PASS, same text |
| "Checked and passed", every rule-check row closed: title + short result | PASS: 8 rule-check rows, each 1 line | 2,2,3,2,3,3,2,2 lines (no one-line bar at 390; the same as the local walk) |
| Ruling 2's example, letter for letter | PASS: "Signs on both sides of one-way street: Not required · 0 left, 10 right" | PASS |
| One row opened: full sentence, quote, citations | PASS: the sentence, Fig. 6P-3 Note 1's quote (p. 864), the Denver line, "Source: CDOT S-630-1 (July 2026) Sheet 2, General Note 8" (same text as the local walk) | PASS, same text |
| Placeholder | PASS: "A number, a rule or a word: taper, 6B, sidewalk, $500" (#443's), whole (878 px) | PASS: "Search: taper, 6B, sidewalk", whole (360 px) |
| Search for text only inside a detail ("Signs placed"; in no closed row's head) | PASS: "7 matching lines, in 2 sections", the both-sides row opens with "Opened because the match is inside." and "Signs placed" marked | PASS, same |
| Audit PDF downloaded through the page (the audit card's "Download audit trail PDF" button) | PASS: `East-Colfax-Avenue_shoulder_2026-11-07_540ad2.audit.pdf`, 4 pages | not downloaded at 390 (see below) |
| PDF page 1 | PASS: "Plan status: 2 changes · 4 needs attention · 13 checked · 3 not checked yet · reference" | |
| PDF page 4 | PASS: heading "Not checked yet", "2 reference(s) not checked yet.", Site Adjustments row "No devices added: the cross-street approach layout isn't generated. See Not checked yet." | |
| "pending" anywhere in the PDF text | PASS: none | |
| axe: strip (open and answered), checked section closed, one row opened, search | PASS: 0 in every state | PASS: 0 |
| 44 px sweep | PASS: 17 targets closed and opened, 12 in search, 0 under 44 px | PASS, same |
| Horizontal overflow | 0 | 0 |
| Page errors | 0 | 0 |
| Layout shift (no recent input) | RECORDED: total 0.96; 0.57 by the time the plan rendered (one 0.55 shift), one 0.39 shift after the last answer | RECORDED: total 1.73; 0.96 by the plan (one 0.87), one 0.77 after the last answer |

Live data differs from the local replay in two rows: "Adjacent interchange (highway ramps)" and "School zone nearby" read "none along the corridor" here (scanned and not found live), where the local replay had an interchange site row. Both are rows that already read short (rulings.md, "Rows that already read short"). PDF cover vs list (3 vs 2) is the same split the local evidence records as predating this branch.

## The gate header, measured

The helper's route was wrapped in the walk (a proxy on the browser's `newContext`; `scripts/gate.cjs` itself untouched), so each `route.fetch` hop recorded its host and whether the gate header was on it (presence only, never the value). Every hop the route made went to www.conestruct.com, every one with the header. Requests the route doesn't match leave the browser directly, and the browser never holds the header: the other hosts the page reached were clerk.conestruct.com, api.mapbox.com, events.mapbox.com and the Sentry ingest host, none through the route, so none with the header. Clerk's own 307 → 200 chain loaded and `window.Clerk.loaded` was true at both widths.

## Attempts

- **1440, attempt 1: the walk's fault.** All three NEEDS YOU questions were answered ("3 of 3 answered", `walk/1440-error-1.png`), and the walk's answer loop then tried to click an answer on a card that was no longer answerable and timed out after 30 s. Every check before that point read the same as attempt 2 (same strip, rows, detail, search, PDF). Attempt 2 passed in full; the 1440 numbers above are attempt 2's.
- **390, attempt 1:** passed.
- No live service failed in any attempt.

## Crops opened (`walk/`)

- `1440-03-checked-rows-closed.png`: "Checked and passed" open, every row closed; the 8 rule-check rows each title in bold then the short result, one line each.
- `1440-04-checked-one-row-open.png`: the both-sides row open: the sentence, the quote, the Denver line and the Source line in the detail; the short result stays on the head.
- `390-02-placeholder.png`: "Search: taper, 6B, sidewalk", whole, no cut.
- `390-05-search-inside-detail.png`: "7 matching lines, in 2 sections", the both-sides row opened because the match is inside, "Signs placed" marked in its sentence.
- `1440-06-strip-no-question-open.png`: "Plan ready. 1 item above and 3 under Not checked yet need a check before field use." on one line.
- `pdf-page-1.png`: the cover's Plan status line ending "3 not checked yet · reference".
- `pdf-page-4.png`: the Site Adjustments row ending "See Not checked yet.", the "Not checked yet" heading and its first line.
- `1440-error-1.png`: attempt 1's stop, the answered questions.

Not opened one by one: `*-01-strip`, `1440-02-placeholder`, `390-03`, `390-04`, `1440-05`, `390-06` (their text is in `walk.json`). Ryan's browser check is still the visual gate.

## Not seen

- The audit PDF at 390 (downloaded at 1440 only; the file is the same backend render for the same scenario).
- The driveways and no-move sight-distance short results (not on this plan, as locally).
- A live failure of road detection or the backend, and so the walk's retry on one.
- A layout-shift baseline: earlier production checks didn't record CLS, so the two large shifts (the plan rendering after Generate, the plan updating after the last answer) can't be attributed to or cleared from #450 here. #450 changed text only (strip words, short results, placeholder), not these transitions. Flagged for Ryan, not failed.
- The spreadsheet and crew narrative (no user-readable "pending" there per rulings.md; not opened in production).
- Real phones, real Safari, a screen reader.
