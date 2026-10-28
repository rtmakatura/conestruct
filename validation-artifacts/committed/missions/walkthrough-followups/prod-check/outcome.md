# Production check of 0de3917 (mission walkthrough-followups, #423)

Run 2026-10-28 against https://www.conestruct.com/sandbox. Healthz serves `0de39178` (healthz.json).

Each check ran in headless Playwright Chromium at 1440x900 and 390x844, DPR 2 (script/check.mjs). Every flow except `detect` stubs `/api/road-bearing` with one candidate, as the items' own shot scripts did. The audit, renders, bundle and quote are live. `detect` and script/probe405.mjs use live road detection.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | #405: median from SEARCH to the candidate list under 8 s; no "Detection service unavailable" | PASS | detect-1440.json, detect-390.json, probe405-run1.json, measurements.json |
| 2 | #405: per-trip `overpass` log line in the Vercel logs | PASS | vercel-overpass-log.jsonl (30 lines, 2 trips per request) |
| 3 | #398: "◌ previous answer, refreshing…" clears after Generate (jurisdiction Denver) | PASS | gen-1440.json, gen-390.json, shots/gen-*-cue-slot.png, shots/gen-*-tier-stack.png |
| 4 | #398: declined plan's windows line reads "Windows · not checked: the plan was declined" | PASS | declined-1440.json, declined-390.json, shots/declined-*-windows-line.png |
| 5 | #409: untouched 1,000 ft: audit PDF has "Work zone length: 1,000 ft. Defaulted to the tool's starting length…" | PASS (see note a) | gen-*.json (auditZip, auditCard), north-*.json |
| 6 | #409: a typed length (1,200 ft) adds no such line | PASS | typed-1440.json, typed-390.json |
| 7 | #399: banner gives the distance from the pin and two moves | PASS | ni-1440.json, ni-390.json, shots/ni-*-declined-banner.png |
| 8 | #399: following the forward move generates | PASS (see note b) | ni-*.json (afterMove), shots/ni-*-move-picker.png, shots/ni-*-after-move-status.png |
| 9 | #399: banner height at 390 (browser check for Ryan) | N/A (Ryan's browser check); measured 362 x 244.25, same as the item's after shot | ni-390.json |
| 10 | #401: zip holds 6 files; label "6 files, with the quote" | PASS | gen-*.json (zipEntries, zipRow, filesLine), shots/gen-*-zip-row.png, shots/gen-390-files-line.png |
| 11 | #401: card, quote and zip names follow `<road>_<kind>_<date>_<fp>`; quote saves `.quote.xlsx` | PASS | gen-*.json (cardNames, zipName, quoteName) |
| 12 | #401: two plans that differ only by side get different names | PASS | gen-*.json (746f0e, South) vs north-*.json (a1e0e7, North) |
| 13 | #401: six-render zip time against maxDuration 60 s | PASS | gen-*.json (zipMs, bundleStatus 200), measurements.json |
| 14 | #403: -5 keeps "-5", marker "yours", field error "⚠ WORK ZONE LENGTH MUST BE MORE THAN 0 FT.", blocker "Work zone length must be more than 0 ft.", Generate disabled | PASS | neg-*.json (minus5), shots/neg-*-minus5-*.png |
| 15 | #403: cleared field reads "◌ not set" and "Work zone length is required." | PASS | neg-*.json (cleared), shots/neg-*-cleared-*.png |
| 16 | #403: 99999 gives the 20,000 ft cap message | PASS | neg-*.json (over), shots/neg-*-99999-*.png |

## Timings

- #405, in the picker (live), SEARCH to the candidate list:
  - 1440: 3840, 2565, 2732, 3038, 2649 ms (median 2732).
  - 390: 2630, 2716, 2238, 3120, 2609 ms (median 2630).
  - Every lookup returned road-bearing 200 and listed 3 or 4 candidates.
- #405, probe405.mjs on the route alone: 3483, 14372, 2270, 2520, 2480 ms (median 2520). The 14.4 s lookup is "Colfax & Williams". In the same row, the probe's own direct mirror queries got no answer from overpass-api.de or kumi in 25 s, and .fr answered in 2.5 s.
- #401, zip from click to download: 1951 ms at 1440 and 3389 ms at 390, against the 60 s server limit. The bundle route returned 200. An earlier 1440 run, overwritten by the re-run, took 5067 ms.

## Notes

a. #409's heading. The check list says the line sits under "Defaulted inputs". On this plan the heading is "Guessed and defaulted inputs", because road type and the other R108 prefills are guessed too. #409's spec gives that form when both kinds are present (994d2ee message, audit_blocks.py). The line itself is word for word as specified.

b. #399's forward move.
   - The script clicked the picker map 47 ft ahead of the pin (the banner's "more than 32 ft" plus 15 ft), using the zoom-16 scale.
   - The moved pin asked the side again, as a new pin does, and the script answered it as before.
   - The plan then generated, with status "⚠ VERIFIED · 1 PLAN FLAG". The cross street stayed marked.
   - Observation, not a fail: after the move, the picker showed "CORRIDOR PREVIEW UNAVAILABLE. COULDN'T REACH THE LAYOUT SERVICE." This may come from the stubbed candidate. Not investigated.
