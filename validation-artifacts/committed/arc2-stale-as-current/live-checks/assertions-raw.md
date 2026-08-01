## Context A — #192 keep-mounted + #185 quote + refusal precedence

- `2026-08-01T18:48:05.792Z` generated (default sandbox scenario); hero mounted
- `2026-08-01T18:48:06.022Z` intercepted device-breakdown — delaying 4000 ms
- `2026-08-01T18:48:06.072Z` **PASS** — 192a: recomputing ribbon renders on a post-generate edit
- `2026-08-01T18:48:06.080Z` **PASS** — 192b: no 'Generating…' empty-state swap — subtree stays mounted
- `2026-08-01T18:48:06.083Z` **PASS** — 192c: results dim (.results-stale) while the answer is in flight
- `2026-08-01T18:48:06.086Z` **PASS** — 192d: hero (previous answer) still on screen under the dim
- `2026-08-01T18:48:06.183Z` screenshot: a-192-recomputing-dim.png
- `2026-08-01T18:48:10.630Z` **PASS** — 192e: settle clears the ribbon and the dim
- `2026-08-01T18:48:11.383Z` screenshot: a-185-previewed.png
- `2026-08-01T18:48:11.731Z` **PASS** — 185a: settings edit replaces figures with the re-preview state
- `2026-08-01T18:48:11.738Z` **PASS** — 185b: dollar figures no longer render as current
- `2026-08-01T18:48:11.741Z` **PASS** — 185c: collapsed headline resets to its unset note
- `2026-08-01T18:48:11.981Z` screenshot: a-185-inputs-changed.png
- `2026-08-01T18:48:12.491Z` **PASS** — 185d: re-preview renders fresh figures (on-screen 2dp total: $1,124.64)
- `2026-08-01T18:48:12.802Z` screenshot: a-185-repreviewed.png
- `2026-08-01T18:48:15.372Z` **PASS** — 185e: the page issued the quote POST
- `2026-08-01T18:48:15.949Z` XLSX captured via identical re-POST: HTTP 200, 10120 bytes -> quote-after-edit.xlsx
- `2026-08-01T18:48:15.949Z` 185f: screen/file cent agreement parsed post-run (parse-quote-xlsx.py)
- `2026-08-01T18:48:16.052Z` intercepted device-breakdown — delaying 6000 ms
- `2026-08-01T18:48:16.337Z` **PASS** — 192f: refusal/inputError surfaces while the recompute is still in flight (ribbon in flight: true; strip: "PLAN DECLINED · Work zone length (50 ft) is shorter than the required …")
- `2026-08-01T18:48:16.337Z` **PASS** — 192g: COMPUTING does not mask it
- `2026-08-01T18:48:16.456Z` screenshot: a-192-declined-over-computing.png

## Context B — #86 refusal → #187 audit honesty + #196 window

- `2026-08-01T18:48:17.656Z` kind: flagger lane closure (pre-generate flow)
- `2026-08-01T18:48:22.981Z` candidate picked: "East Colfax Avenue eastbound (primary, 90°)5 m from pin · way 600545947"
- `2026-08-01T18:48:23.960Z` #86 refusal settled; strip: "PLAN DECLINED · Detection saw a multi-lane road — confirm the lane count in the Road section to proc"
- `2026-08-01T18:48:23.960Z` **PASS** — B-86: the E Colfax two-way relays arm a refusal (PLAN DECLINED) (picked: East Colfax Avenue eastbound (primary, 90°)5 m from pin · way 600545947)
- `2026-08-01T18:48:24.058Z` screenshot: b-86-refusal-settled.png
- `2026-08-01T18:48:24.089Z` **PASS** — 187a: declined chip + banner present
- `2026-08-01T18:48:24.096Z` **PASS** — 187b: rows blank with a stated reason, never 'Computing…'
- `2026-08-01T18:48:24.103Z` **PASS** — 187c: no cited '= N ft' value renders anywhere under the decline
- `2026-08-01T18:48:24.105Z` **PASS** — 187d: no ✓ check rows under the decline (span.check count: 0)
- `2026-08-01T18:48:24.122Z` **PASS** — 187e: Audit PDF disabled with a declined reason (title: "Unavailable — generation declined for this input")
- `2026-08-01T18:48:24.559Z` screenshot: b-187-audit-declined-blank.png
- `2026-08-01T18:48:24.571Z` **PASS** — 196a: settled refusal gates Generate
- `2026-08-01T18:48:24.580Z` **PASS** — 196b: confirm affordance row on screen (rows: 1)
- `2026-08-01T18:48:24.670Z` intercepted audit — delaying 6000 ms
- `2026-08-01T18:48:25.488Z` **PASS** — 196c: THE window — Generate stays gated while the re-check is in flight
- `2026-08-01T18:48:25.495Z` **PASS** — 196d: the gate names itself
- `2026-08-01T18:48:25.499Z` **PASS** — 196/192: no COMPUTING during the window
- `2026-08-01T18:48:25.581Z` screenshot: b-196-window-gated.png
- `2026-08-01T18:49:10.578Z` **PASS** — 196e: settled CTA state matches the settled verdict (declined=false disabled=false; strip: "VERIFIED · 1 plan flag ▸REVIEW FLAGS")
- `2026-08-01T18:49:10.647Z` screenshot: b-196-settled.png

## Context C — #189-3 relay clear on settled-null save

- `2026-08-01T18:49:25.687Z` candidate picked: "East Colfax Avenue eastbound (primary, 90°)5 m from pin · way 600545947"
- `2026-08-01T18:49:26.178Z` **PASS** — 189-3a: relays applied — confirm affordance renders after the Colfax save
- `2026-08-01T18:49:26.436Z` screenshot: c-1893-relays-armed.png
- `2026-08-01T18:49:42.986Z` **PASS** — 189-3b: settled-null save at the new pin clears the relays — affordance gone
- `2026-08-01T18:49:43.013Z` **PASS** — 189-3c: strip no longer declines (nothing detected = nothing to refuse) (strip: "VERIFIED · 0 validation warningsREADY FOR TCS REVIEW")
- `2026-08-01T18:49:43.086Z` screenshot: c-1893-relays-cleared.png

## Context D — #197 download-error stamp

- `2026-08-01T18:49:44.338Z` intercepted /api/render/pdf — fulfilling synthetic 400 (never reached the server)
- `2026-08-01T18:49:44.378Z` **PASS** — 197a: download error renders for the scenario it answered
- `2026-08-01T18:49:44.454Z` screenshot: d-197-error-shown.png
- `2026-08-01T18:49:44.940Z` **PASS** — 197b: the scenario edit drops the stale error and its Try-again label
- `2026-08-01T18:49:45.005Z` screenshot: d-197-error-cleared.png

**Result: ALL PASS**
